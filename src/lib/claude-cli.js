// ReadLater for Obsidian - Claude CLI Library
// ローカルのClaude CLIとの連携、翻訳・要約機能を提供

/**
 * カスタム例外クラス
 */
class ClaudeCLIError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'ClaudeCLIError';
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

class ClaudeCLITimeoutError extends ClaudeCLIError {
    constructor(timeout, details = {}) {
        super(`Claude CLI command timed out after ${timeout}ms`, details);
        this.name = 'ClaudeCLITimeoutError';
        this.timeout = timeout;
    }
}

class ClaudeCLIProcessError extends ClaudeCLIError {
    constructor(message, code, stderr, details = {}) {
        super(message, details);
        this.name = 'ClaudeCLIProcessError';
        this.exitCode = code;
        this.stderr = stderr;
    }
}

class ClaudeCLINotFoundError extends ClaudeCLIError {
    constructor(details = {}) {
        super('Claude CLI not found. Please install Claude CLI first.', details);
        this.name = 'ClaudeCLINotFoundError';
    }
}

/**
 * リトライ設定クラス
 */
class RetryConfig {
    constructor(options = {}) {
        this.maxAttempts = options.maxAttempts || 3;
        this.initialDelay = options.initialDelay || 4000; // 4秒
        this.maxDelay = options.maxDelay || 10000; // 10秒
        this.multiplier = options.multiplier || 2;
    }
    
    shouldRetry(error, attemptNumber) {
        if (attemptNumber >= this.maxAttempts) return false;
        
        // エラータイプでリトライ判断
        if (error instanceof ClaudeCLINotFoundError) return false;
        if (error instanceof ClaudeCLITimeoutError) return true;
        if (error instanceof ClaudeCLIProcessError) return true;
        
        // Node.js エラーコード
        const retryableErrors = ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'];
        return retryableErrors.includes(error.code);
    }
    
    getDelay(attemptNumber) {
        const delay = this.initialDelay * Math.pow(this.multiplier, attemptNumber - 1);
        return Math.min(delay, this.maxDelay);
    }
}

/**
 * Claude CLI の主要インターフェース
 * ローカルのClaude CLIコマンドを使用（APIキー不要）
 */
class ClaudeCLI {
    // クラスレベルの状態（全インスタンスで共有）
    static _lastRequestTime = 0;
    static _requestLock = Promise.resolve();
    
    constructor(options = {}) {
        this.model = options.model || 'sonnet';
        this.maxTurns = options.maxTurns || 1;
        this.timeout = options.timeout || 120000; // 120秒（nookと同じ）
        this.skipPermissions = options.skipPermissions !== false; // デフォルトでtrue
        this.minRequestInterval = options.minRequestInterval || 2000; // 2秒
        this.maxPromptChars = options.maxPromptChars || 100000; // 10万文字
        this.retryConfig = new RetryConfig(options.retry || {});
        
        // セッション履歴管理
        this.sessionHistory = [];
        this.maxHistoryMessages = options.maxHistoryMessages || 4; // 直近2往復
        
        // Claude CLIの実行可能性をチェック
        this.isAvailable = this.checkClaudeAvailability();
    }
    
    /**
     * Claude CLIの利用可能性をチェック
     * @returns {boolean} Claude CLIが利用可能かどうか
     */
    checkClaudeAvailability() {
        try {
            // ブラウザ環境では常にfalse
            if (typeof window !== 'undefined') {
                console.log('ClaudeCLI: Browser environment detected, CLI not available');
                return false;
            }
            
            // Node.js環境でのみチェック
            const { execSync } = require('child_process');
            const version = execSync('claude --version', { stdio: 'pipe', timeout: 5000 }).toString().trim();
            console.log('ClaudeCLI: Claude CLI is available', { version });
            return true;
        } catch (error) {
            console.warn('ClaudeCLI: Claude CLI not available:', error.message);
            return false;
        }
    }
    
    /**
     * レート制限制御：前のリクエストから十分な時間が経過するまで待機
     */
    async throttleIfNeeded() {
        if (!this.minRequestInterval || this.minRequestInterval <= 0) {
            return;
        }
        
        const now = Date.now();
        const elapsed = now - ClaudeCLI._lastRequestTime;
        const waitTime = this.minRequestInterval - elapsed;
        
        if (waitTime > 0) {
            console.log(`ClaudeCLI: Throttling request, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        ClaudeCLI._lastRequestTime = Date.now();
    }
    
    /**
     * 排他制御：同時リクエストを防ぐ
     */
    async acquireLock() {
        // 前のリクエストが完了するまで待機
        await ClaudeCLI._requestLock;
        
        let releaseLock;
        ClaudeCLI._requestLock = new Promise(resolve => {
            releaseLock = resolve;
        });
        
        return releaseLock;
    }
    
    /**
     * プロンプトの文字数制限を適用
     */
    enforcePromptLimit(prompt, systemInstruction = null) {
        if (!this.maxPromptChars) {
            return { prompt, systemInstruction };
        }
        
        let prefixLength = 0;
        if (systemInstruction) {
            prefixLength = systemInstruction.length + 20; // "System: \n\nUser: ".length
        }
        
        const availableForPrompt = Math.max(this.maxPromptChars - prefixLength, 0);
        
        if (availableForPrompt === 0) {
            return {
                prompt: '[入力テキストは長すぎるため全体を送信できませんでした]'.slice(0, this.maxPromptChars),
                systemInstruction
            };
        }
        
        if (prompt.length <= availableForPrompt) {
            return { prompt, systemInstruction };
        }
        
        const truncatedPrompt = prompt.slice(0, availableForPrompt).trimEnd() + 
            '\n\n[入力テキストは制限により途中までで送信されています]';
        
        console.warn(`ClaudeCLI: Prompt truncated from ${prompt.length} to ${truncatedPrompt.length} chars`);
        
        return { prompt: truncatedPrompt, systemInstruction };
    }
    
    /**
     * エラーログの記録
     */
    logError(error, context = {}) {
        console.error('ClaudeCLI Error:', {
            errorType: error.name,
            message: error.message,
            timestamp: error.timestamp || new Date().toISOString(),
            context,
            details: error.details,
            exitCode: error.exitCode,
            stderr: error.stderr
        });
    }
    
    /**
     * Claude CLIにクエリを送信（リトライ付き）
     * @param {string} prompt - プロンプト
     * @param {Object} options - リクエストオプション
     * @returns {Promise<string>} Claude CLIレスポンス
     */
    async makeRequest(prompt, options = {}) {
        if (!this.isAvailable) {
            throw new ClaudeCLINotFoundError({ prompt: prompt.slice(0, 100) });
        }
        
        // リトライメカニズムで実行
        return await this.executeWithRetry(async () => {
            return await this._executeClaudeCommand(prompt, options);
        });
    }
    
    /**
     * リトライメカニズム付きで関数を実行
     * @param {Function} fn - 実行する非同期関数
     * @returns {Promise<any>} 関数の実行結果
     */
    async executeWithRetry(fn) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (!this.retryConfig.shouldRetry(error, attempt)) {
                    this.logError(error, { attempt, maxAttempts: this.retryConfig.maxAttempts });
                    throw error;
                }
                
                const delay = this.retryConfig.getDelay(attempt);
                console.log(`ClaudeCLI: Retry attempt ${attempt}/${this.retryConfig.maxAttempts} after ${delay}ms`, {
                    error: error.message,
                    errorType: error.name
                });
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        this.logError(lastError, { 
            attempt: this.retryConfig.maxAttempts, 
            maxAttempts: this.retryConfig.maxAttempts,
            retriesExhausted: true
        });
        throw lastError;
    }
    
    /**
     * Claude CLI コマンドを実行（内部メソッド）
     * @param {string} prompt - プロンプト
     * @param {Object} options - リクエストオプション
     * @returns {Promise<string>} Claude CLIレスポンス
     */
    async _executeClaudeCommand(prompt, options = {}) {
        const releaseLock = await this.acquireLock();
        
        try {
            // レート制限チェック
            await this.throttleIfNeeded();
            
            // プロンプト制限適用
            const { prompt: limitedPrompt } = this.enforcePromptLimit(prompt, options.systemInstruction);
            
            const { spawn } = require('child_process');
            
            // Claude CLIコマンドの構築
            const args = [
                '-p',  // 印刷モード
                '--model', options.model || this.model,
                '--max-turns', String(options.maxTurns || this.maxTurns),
                '--output-format', 'text'  // テキスト形式で出力
            ];
            
            // パフォーマンス最適化：権限チェックスキップ
            if (this.skipPermissions) {
                args.push('--dangerously-skip-permissions');
            }
            
            // プロンプトを引数として追加
            args.push(limitedPrompt);
            
            console.log('ClaudeCLI: Executing command', { 
                model: options.model || this.model,
                promptLength: limitedPrompt.length,
                originalLength: prompt.length,
                truncated: prompt.length !== limitedPrompt.length,
                timeout: this.timeout,
                skipPermissions: this.skipPermissions
            });
            
            const response = await new Promise((resolve, reject) => {
                const claudeProcess = spawn('claude', args, {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    shell: false  // セキュリティのため false に変更
                });
                
                let stdout = '';
                let stderr = '';
                let timedOut = false;
                
                claudeProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });
                
                claudeProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
                
                claudeProcess.on('close', (code) => {
                    if (timedOut) return; // タイムアウト済みの場合は無視
                    
                    if (code === 0) {
                        const response = stdout.trim();
                        if (response) {
                            resolve(response);
                        } else {
                            reject(new ClaudeCLIProcessError(
                                'Empty response from Claude CLI',
                                code,
                                stderr,
                                { stdout, stderr }
                            ));
                        }
                    } else {
                        reject(new ClaudeCLIProcessError(
                            `Claude CLI failed with code ${code}`,
                            code,
                            stderr,
                            { stdout, stderr }
                        ));
                    }
                });
                
                claudeProcess.on('error', (error) => {
                    if (timedOut) return;
                    
                    if (error.code === 'ENOENT') {
                        reject(new ClaudeCLINotFoundError({ originalError: error.message }));
                    } else {
                        reject(new ClaudeCLIProcessError(
                            `Claude CLI execution error: ${error.message}`,
                            error.code,
                            '',
                            { originalError: error }
                        ));
                    }
                });
                
                // タイムアウト処理
                const timeoutId = setTimeout(() => {
                    timedOut = true;
                    try {
                        claudeProcess.kill('SIGTERM');
                        // SIGTERM で終了しない場合は強制終了
                        setTimeout(() => {
                            try {
                                claudeProcess.kill('SIGKILL');
                            } catch (e) {}
                        }, 5000);
                    } catch (e) {}
                    reject(new ClaudeCLITimeoutError(this.timeout, { promptLength: limitedPrompt.length }));
                }, this.timeout);
                
                claudeProcess.on('close', () => {
                    clearTimeout(timeoutId);
                });
            });
            
            // セッション履歴に追加
            this.addToHistory('user', prompt);
            this.addToHistory('assistant', response);
            
            return response;
            
        } finally {
            releaseLock();
        }
    }
    
    /**
     * レスポンスの検証（従来のAPI互換性のため）
     * @param {string} response - Claude CLIからのレスポンス
     * @returns {string} 検証済みレスポンス
     */
    validateResponse(response) {
        if (!response || typeof response !== 'string') {
            throw new Error('Invalid response format from Claude CLI');
        }
        
        if (response.trim().length === 0) {
            throw new Error('Empty content in Claude CLI response');
        }
        
        return response.trim();
    }
    
    /**
     * スリープ関数（レート制限対応）
     * @param {number} ms - ミリ秒
     * @returns {Promise} スリープPromise
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * セッション履歴に追加
     * @param {string} role - ロール（user/assistant）
     * @param {string} content - メッセージ内容
     * @param {Object} metadata - 追加のメタデータ
     */
    addToHistory(role, content, metadata = {}) {
        this.sessionHistory.push({
            role,
            content,
            timestamp: new Date().toISOString(),
            ...metadata
        });
        
        // 履歴が長すぎる場合は古いものを削除
        if (this.sessionHistory.length > this.maxHistoryMessages) {
            this.sessionHistory = this.sessionHistory.slice(-this.maxHistoryMessages);
        }
    }
    
    /**
     * 直近のセッション履歴を取得
     * @returns {Array} セッション履歴
     */
    getRecentHistory() {
        return this.sessionHistory.slice(-this.maxHistoryMessages);
    }
    
    /**
     * コンテキスト付きプロンプトを構築
     * @param {string} message - 新しいメッセージ
     * @returns {string} コンテキスト付きプロンプト
     */
    buildContextPrompt(message) {
        const history = this.getRecentHistory();
        
        if (history.length === 0) {
            return message;
        }
        
        const context = history
            .map(entry => `${entry.role.charAt(0).toUpperCase() + entry.role.slice(1)}: ${entry.content}`)
            .join('\n');
        
        return `${context}\nUser: ${message}`;
    }
    
    /**
     * セッション履歴をクリア
     */
    clearHistory() {
        this.sessionHistory = [];
    }
}

/**
 * 言語検出器（ローカル処理、APIキー不要）
 */
class LanguageDetector {
    constructor() {
        // 言語パターンの定義
        this.patterns = {
            ja: [
                /[\u3040-\u309F]/,  // ひらがな
                /[\u30A0-\u30FF]/,  // カタカナ
                /[\u4E00-\u9FAF]/   // 漢字
            ],
            zh: [
                /[\u4E00-\u9FAF]/,  // 漢字
                /[的了是在不一有大人]/  // 中国語特有の文字
            ],
            ko: [
                /[\uAC00-\uD7AF]/,  // ハングル
                /[\u1100-\u11FF]/,  // ハングル字母
                /[\u3130-\u318F]/   // ハングル互換字母
            ],
            en: [
                /\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|have|has|had|will|would|can|could|this|that)\b/gi,
                /\b\w+(ing|ed|ly|tion|ness|ment|able|ible)\b/gi
            ]
        };
    }
    
    /**
     * テキストの言語を検出
     * @param {string} text - 検出対象テキスト
     * @returns {Promise<Object>} 検出結果 {language, confidence}
     */
    async detectLanguage(text) {
        if (!text || typeof text !== 'string') {
            return { language: 'unknown', confidence: 0.0 };
        }
        
        const cleanText = text.trim();
        if (cleanText.length === 0) {
            return { language: 'unknown', confidence: 0.0 };
        }
        
        if (cleanText.length < 3) {
            return { language: 'unknown', confidence: 0.1 };
        }
        
        const sampleText = cleanText.slice(0, 500); // 最初の500文字でサンプリング
        const results = [];
        
        // 日本語検出
        const hasHiragana = /[\u3040-\u309F]/.test(sampleText);
        const hasKatakana = /[\u30A0-\u30FF]/.test(sampleText);
        if (hasHiragana || hasKatakana) {
            return { language: 'ja', confidence: 0.9 };
        }
        
        // 韓国語検出
        const hasHangul = /[\uAC00-\uD7AF]/.test(sampleText);
        if (hasHangul) {
            return { language: 'ko', confidence: 0.95 };
        }
        
        // 中国語検出（漢字ベース）
        const chineseChars = sampleText.match(/[\u4E00-\u9FAF]/g);
        if (chineseChars && chineseChars.length > 5) {
            // 中国語特有の文字パターンをチェック
            const chineseIndicators = /[的了是在不一有大人这个我们来说]/g;
            const indicators = sampleText.match(chineseIndicators);
            if (indicators && indicators.length > 2) {
                return { language: 'zh', confidence: 1.0 };
            }
            return { language: 'zh', confidence: 0.7 };
        }
        
        // アルファベットベースの言語検出（改良版）
        const alphabeticRatio = sampleText.match(/[a-zA-Z]/g)?.length / sampleText.length || 0;
        
        if (alphabeticRatio > 0.7) {
            // 英語特有の単語パターン（より包括的）
            const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'this', 'that'];
            const words = sampleText.toLowerCase().split(/\s+/);
            const englishWordCount = englishWords.filter(word => words.includes(word)).length;
            
            // 英語らしいパターンの検出
            const englishPatterns = [
                /\b(ing|ed|ly|tion|ness|ment|able|ible)\b/g,  // 英語特有の語尾
                /\b(a|an|the)\s+\w+/g,  // 冠詞パターン
                /\w+\s+(is|are|was|were)\s+\w+/g  // be動詞パターン
            ];
            
            let patternScore = 0;
            englishPatterns.forEach(pattern => {
                const matches = sampleText.match(pattern);
                if (matches) patternScore += matches.length;
            });
            
            const totalScore = englishWordCount + patternScore;
            
            if (totalScore >= 5) {
                return { language: 'en', confidence: Math.min(0.8 + totalScore * 0.02, 0.95) };
            } else if (totalScore >= 2) {
                return { language: 'en', confidence: 0.6 };
            }
            
            // その他のヨーロッパ言語の特殊文字
            if (/[àáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ]/.test(sampleText)) {
                return { language: 'unknown', confidence: 0.6 }; // ヨーロッパ言語
            }
            
            // アルファベット中心なら英語と推測
            return { language: 'en', confidence: 0.4 };
        }
        
        // 最も信頼度の高い結果を返す
        if (results.length > 0) {
            results.sort((a, b) => b.confidence - a.confidence);
            return results[0];
        }
        
        // デフォルト
        return { language: 'unknown', confidence: 0.0 };
    }
}

/**
 * 翻訳サービス（Claude CLI使用）
 */
class TranslationService {
    constructor(claudeCLI) {
        this.claudeCLI = claudeCLI;
        this.rateLimitDelay = 2000; // 2秒
    }
    
    /**
     * テキストを翻訳
     * @param {string} text - 翻訳対象テキスト
     * @param {string} sourceLanguage - 元言語
     * @param {string} targetLanguage - 翻訳先言語
     * @param {Object} options - 翻訳オプション
     * @returns {Promise<Object>} 翻訳結果
     */
    async translateText(text, sourceLanguage, targetLanguage, options = {}) {
        try {
            if (!text || text.trim().length === 0) {
                throw new Error('Empty text provided for translation');
            }
            
            // 同じ言語の場合はスキップ
            if (sourceLanguage === targetLanguage) {
                return {
                    translatedText: text,
                    sourceLanguage,
                    targetLanguage,
                    skipped: true,
                    reason: 'Same language detected',
                    options
                };
            }
            
            // 言語名のマッピング
            const languageNames = {
                'en': '英語',
                'ja': '日本語',
                'zh': '中国語',
                'ko': '韓国語',
                'fr': 'フランス語',
                'de': 'ドイツ語',
                'es': 'スペイン語'
            };
            
            const sourceLangName = languageNames[sourceLanguage] || sourceLanguage;
            const targetLangName = languageNames[targetLanguage] || targetLanguage;
            
            // プロンプトの生成
            let prompt = `以下のテキストを${sourceLangName}から${targetLangName}に翻訳してください。`;
            
            if (options.isTitle) {
                prompt += '\n\nこれはタイトルとして翻訳してください。自然で読みやすいタイトルにしてください。';
            }
            
            if (options.preserveMarkdown) {
                prompt += '\n\nMarkdown記法（**太字**、*斜体*、リンクなど）はそのまま保持してください。';
            }
            
            prompt += '\n\n翻訳対象テキスト:\n';
            prompt += text;
            prompt += '\n\n翻訳結果のみを出力してください。説明や前置きは不要です。';
            
            console.log('TranslationService: Requesting translation', {
                sourceLanguage,
                targetLanguage,
                textLength: text.length,
                isTitle: options.isTitle
            });
            
            const translatedText = await this.claudeCLI.makeRequest(prompt, {
                model: 'sonnet',
                maxTurns: 1
            });
            
            return {
                translatedText: translatedText.trim(),
                sourceLanguage,
                targetLanguage,
                skipped: false,
                options
            };
            
        } catch (error) {
            console.error('TranslationService: Translation failed', error);
            throw new Error(`Translation failed: ${error.message}`);
        }
    }
    
    /**
     * 複数テキストの一括翻訳
     * @param {Array<string>} texts - 翻訳対象テキスト配列
     * @param {string} sourceLanguage - 元言語
     * @param {string} targetLanguage - 翻訳先言語
     * @param {Object} options - 翻訳オプション
     * @returns {Promise<Array<Object>>} 翻訳結果配列
     */
    async batchTranslate(texts, sourceLanguage, targetLanguage, options = {}) {
        const results = [];
        
        for (let i = 0; i < texts.length; i++) {
            const text = texts[i];
            
            try {
                const result = await this.translateText(text, sourceLanguage, targetLanguage, options);
                results.push(result);
                
                // レート制限対応（最後以外は待機）
                if (i < texts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
                }
                
            } catch (error) {
                console.error(`TranslationService: Batch translation failed for text ${i}:`, error);
                results.push({
                    translatedText: text, // フォールバック
                    sourceLanguage,
                    targetLanguage,
                    skipped: true,
                    error: error.message,
                    options
                });
            }
        }
        
        return results;
    }
}

/**
 * 要約サービス（Claude CLI使用）
 */
class SummaryService {
    constructor(claudeCLI) {
        this.claudeCLI = claudeCLI;
        this.minWordCount = 100; // 最小単語数
    }
    
    /**
     * 記事の要約を生成
     * @param {string} text - 要約対象テキスト
     * @param {Object} options - 要約オプション
     * @returns {Promise<Object>} 要約結果
     */
    async generateSummary(text, options = {}) {
        try {
            if (!text || text.trim().length === 0) {
                throw new Error('Empty text provided for summarization');
            }
            
            const wordCount = text.split(/\s+/).length;
            const style = options.style || 'structured';
            const maxLength = options.maxLength || 400;
            
            // 短すぎる記事はスキップ
            if (wordCount < this.minWordCount) {
                return {
                    summary: '',
                    summaryWordCount: 0,
                    skipped: true,
                    reason: `Article too short (${wordCount} words, minimum ${this.minWordCount})`
                };
            }
            
            let prompt = '以下の記事の要約を日本語で作成してください。\n\n';
            
            switch (style) {
                case 'bullet':
                    prompt += '箇条書き形式で主要なポイントを整理してください。\n';
                    prompt += '• 形式で3-5個のポイントにまとめてください。\n';
                    break;
                    
                case 'paragraph':
                    prompt += '段落形式で簡潔にまとめてください。\n';
                    prompt += '2-3段落で記事の要点を説明してください。\n';
                    break;
                    
                case 'structured':
                default:
                    prompt += '以下の形式で構造化された要約を作成してください：\n\n';
                    prompt += '## 記事の要点\n\n';
                    prompt += '- [主要ポイント1]\n';
                    prompt += '- [主要ポイント2]\n';
                    prompt += '- [主要ポイント3]\n\n';
                    prompt += '## 主な内容\n\n';
                    prompt += '[記事の概要を2-3文で説明]\n\n';
                    break;
            }
            
            prompt += `要約は${maxLength}文字以内にしてください。\n\n`;
            prompt += '記事内容:\n';
            prompt += text;
            
            console.log('SummaryService: Generating summary', {
                wordCount,
                style,
                maxLength
            });
            
            const summary = await this.claudeCLI.makeRequest(prompt, {
                model: 'sonnet',
                maxTurns: 1
            });
            
            const summaryWordCount = summary.split(/\s+/).length;
            const summaryRatio = summaryWordCount / wordCount;
            
            return {
                summary: summary.trim(),
                summaryWordCount,
                summaryRatio,
                originalWordCount: wordCount,
                skipped: false,
                style,
                maxLength
            };
            
        } catch (error) {
            console.error('SummaryService: Summary generation failed', error);
            throw new Error(`Summary generation failed: ${error.message}`);
        }
    }
    
    /**
     * キーワード抽出
     * @param {string} text - キーワード抽出対象テキスト
     * @param {Object} options - 抽出オプション
     * @returns {Promise<Object>} キーワード抽出結果
     */
    async generateKeywords(text, options = {}) {
        try {
            const maxKeywords = options.maxKeywords || 8;
            
            const prompt = `以下の記事から重要なキーワードを抽出してください。
            
要求:
- 最大${maxKeywords}個のキーワードを抽出
- 単語またはフレーズ形式
- 重要度順に並べる
- カンマ区切りで出力
- キーワードのみを出力（説明不要）

記事内容:
${text}`;
            
            const keywordsText = await this.claudeCLI.makeRequest(prompt, {
                model: 'sonnet',
                maxTurns: 1
            });
            
            const keywords = keywordsText
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0)
                .slice(0, maxKeywords);
            
            return {
                keywords,
                extractedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('SummaryService: Keyword extraction failed', error);
            return {
                keywords: [],
                error: error.message,
                extractedAt: new Date().toISOString()
            };
        }
    }
}

// モジュールのエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        ClaudeCLI, 
        LanguageDetector, 
        TranslationService, 
        SummaryService,
        // カスタム例外クラスもエクスポート
        ClaudeCLIError,
        ClaudeCLITimeoutError,
        ClaudeCLIProcessError,
        ClaudeCLINotFoundError,
        RetryConfig
    };
} else {
    window.ClaudeCLI = ClaudeCLI;
    window.LanguageDetector = LanguageDetector;
    window.TranslationService = TranslationService;
    window.SummaryService = SummaryService;
    window.ClaudeCLIError = ClaudeCLIError;
    window.ClaudeCLITimeoutError = ClaudeCLITimeoutError;
    window.ClaudeCLIProcessError = ClaudeCLIProcessError;
    window.ClaudeCLINotFoundError = ClaudeCLINotFoundError;
    window.RetryConfig = RetryConfig;
}
