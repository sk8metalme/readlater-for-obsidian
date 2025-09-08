// ReadLater for Obsidian - Claude API Library
// Claude CLIとの連携、翻訳・要約機能を提供

/**
 * Claude API の主要インターフェース
 */
class ClaudeAPI {
    constructor(apiKey, options = {}) {
        if (!apiKey) {
            throw new Error('API key is required');
        }
        
        if (!apiKey.startsWith('sk-')) {
            throw new Error('Invalid API key format');
        }
        
        this.apiKey = apiKey;
        this.baseUrl = options.baseUrl || 'https://api.anthropic.com/v1';
        this.model = options.model || 'claude-3-sonnet-20240229';
        this.maxTokens = options.maxTokens || 4000;
        this.temperature = options.temperature || 0.3;
        
        // レート制限対応
        this.rateLimitDelay = 1000; // 1秒
        this.maxRetries = 3;
    }
    
    /**
     * Claude APIにリクエストを送信
     * @param {string} prompt - プロンプト
     * @param {Object} options - リクエストオプション
     * @returns {Promise<string>} APIレスポンス
     */
    async makeRequest(prompt, options = {}) {
        const requestData = {
            model: this.model,
            max_tokens: options.maxTokens || this.maxTokens,
            temperature: options.temperature || this.temperature,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        };
        
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestData)
        };
        
        try {
            let lastError;
            const maxRetries = options.enableRetry ? this.maxRetries : 1;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`Claude API: Making request (attempt ${attempt}/${maxRetries})`);
                    
                    const response = await fetch(`${this.baseUrl}/messages`, requestOptions);
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
                        
                        // レート制限の場合はリトライ
                        if (response.status === 429 && attempt < maxRetries) {
                            const delay = this.rateLimitDelay * Math.pow(2, attempt - 1);
                            console.log(`Claude API: Rate limited, retrying in ${delay}ms`);
                            await this.sleep(delay);
                            continue;
                        }
                        
                        throw new Error(`API request failed: ${errorMessage}`);
                    }
                    
                    const responseData = await response.json();
                    this.validateResponse(responseData);
                    
                    return responseData.content[0].text;
                    
                } catch (error) {
                    lastError = error;
                    
                    // ネットワークエラーの場合はリトライ
                    if (attempt < maxRetries && this.isRetryableError(error)) {
                        const delay = this.rateLimitDelay * attempt;
                        console.log(`Claude API: Request failed, retrying in ${delay}ms`, error.message);
                        await this.sleep(delay);
                        continue;
                    }
                    
                    throw error;
                }
            }
            
            throw lastError;
            
        } catch (error) {
            console.error('Claude API: Request failed', error);
            throw error;
        }
    }
    
    /**
     * APIレスポンスの検証
     * @param {Object} response - APIレスポンス
     */
    validateResponse(response) {
        if (!response || !response.content || !Array.isArray(response.content)) {
            throw new Error('Invalid Claude API response format');
        }
        
        if (response.content.length === 0) {
            throw new Error('Empty response from Claude API');
        }
        
        if (!response.content[0].text) {
            throw new Error('No text content in Claude API response');
        }
    }
    
    /**
     * リトライ可能なエラーかどうかを判定
     * @param {Error} error - エラーオブジェクト
     * @returns {boolean} リトライ可能かどうか
     */
    isRetryableError(error) {
        const retryableMessages = [
            'network error',
            'timeout',
            'connection',
            'rate limit'
        ];
        
        const message = error.message.toLowerCase();
        return retryableMessages.some(keyword => message.includes(keyword));
    }
    
    /**
     * 待機ユーティリティ
     * @param {number} ms - 待機時間（ミリ秒）
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 言語検出サービス
 */
class LanguageDetector {
    constructor() {
        this.patterns = {
            ja: /[\u3040-\u309F\u30A0-\u30FF]/,  // ひらがな・カタカナ
            zh: /[\u4E00-\u9FFF]/,               // 漢字（中国語・日本語共通）
            ko: /[\uAC00-\uD7AF]/,               // ハングル
            ar: /[\u0600-\u06FF]/,               // アラビア語
            th: /[\u0E00-\u0E7F]/,               // タイ語
            hi: /[\u0900-\u097F]/                // ヒンディー語
        };
    }
    
    /**
     * テキストの言語を検出
     * @param {string} text - 検出対象テキスト
     * @returns {Promise<Object>} 検出結果
     */
    async detectLanguage(text) {
        if (!text || text.trim().length === 0) {
            return { language: 'unknown', confidence: 0 };
        }
        
        if (text.length < 3) {
            return { language: 'unknown', confidence: 0.1 };
        }
        
        const sampleText = text.slice(0, 1000); // 最初の1000文字を分析
        const results = [];
        
        // パターンマッチング言語検出
        for (const [lang, pattern] of Object.entries(this.patterns)) {
            const matches = sampleText.match(new RegExp(pattern, 'g'));
            if (matches) {
                const confidence = Math.min(matches.length / sampleText.length * 10, 1);
                results.push({ language: lang, confidence });
            }
        }
        
        // 日本語の特別処理（ひらがな・カタカナがあれば日本語）
        const hasHiragana = /[\u3040-\u309F]/.test(sampleText);
        const hasKatakana = /[\u30A0-\u30FF]/.test(sampleText);
        if (hasHiragana || hasKatakana) {
            return { language: 'ja', confidence: 0.9 };
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
        
        return { language: 'unknown', confidence: 0 };
    }
}

/**
 * 翻訳サービス
 */
class TranslationService {
    constructor(claudeAPI) {
        this.claudeAPI = claudeAPI;
        this.languageDetector = new LanguageDetector();
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
            // 空文字列の場合
            if (!text || text.trim().length === 0) {
                return {
                    translatedText: '',
                    sourceLanguage,
                    targetLanguage,
                    skipped: true,
                    reason: 'Empty text'
                };
            }
            
            // 同じ言語の場合はスキップ
            if (sourceLanguage === targetLanguage) {
                return {
                    translatedText: text,
                    sourceLanguage,
                    targetLanguage,
                    skipped: true,
                    reason: 'Same language'
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
                'es': 'スペイン語',
                'it': 'イタリア語',
                'pt': 'ポルトガル語',
                'ru': 'ロシア語'
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
            
            const translatedText = await this.claudeAPI.makeRequest(prompt, {
                maxTokens: Math.min(text.length * 2 + 500, 4000),
                temperature: 0.1, // 翻訳では一貫性を重視
                enableRetry: true
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
        if (!texts || texts.length === 0) {
            return [];
        }
        
        // 小さなバッチの場合は一度に翻訳
        if (texts.length <= 5 && texts.every(text => text.length < 500)) {
            try {
                const combinedText = texts.join('\n---\n');
                const result = await this.translateText(combinedText, sourceLanguage, targetLanguage, options);
                
                const translatedTexts = result.translatedText.split(/\n---\n|\n—\n|\n\*\*\*\n/);
                
                return texts.map((originalText, index) => ({
                    translatedText: translatedTexts[index]?.trim() || originalText,
                    sourceLanguage,
                    targetLanguage,
                    skipped: false,
                    originalText
                }));
                
            } catch (error) {
                console.warn('TranslationService: Batch translation failed, falling back to individual', error);
            }
        }
        
        // 個別翻訳にフォールバック
        const results = [];
        for (const text of texts) {
            const result = await this.translateText(text, sourceLanguage, targetLanguage, options);
            results.push({ ...result, originalText: text });
        }
        
        return results;
    }
}

/**
 * 要約サービス
 */
class SummaryService {
    constructor(claudeAPI) {
        this.claudeAPI = claudeAPI;
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
                return {
                    summary: '',
                    skipped: true,
                    reason: 'Empty text'
                };
            }
            
            const wordCount = text.split(/\s+/).length;
            
            // 短すぎる記事はスキップ
            if (wordCount < this.minWordCount) {
                return {
                    summary: '',
                    wordCount,
                    skipped: true,
                    reason: 'Article too short for summary'
                };
            }
            
            // 要約スタイルの設定
            const style = options.style || 'structured';
            const maxLength = options.maxLength || 500;
            
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
            
            const summary = await this.claudeAPI.makeRequest(prompt, {
                maxTokens: Math.min(maxLength * 2, 2000),
                temperature: 0.2,
                enableRetry: true
            });
            
            const summaryWordCount = summary.split(/\s+/).length;
            const summaryRatio = summaryWordCount / wordCount;
            
            return {
                summary: summary.trim(),
                wordCount,
                summaryWordCount,
                summaryRatio,
                style,
                skipped: false
            };
            
        } catch (error) {
            console.error('SummaryService: Summary generation failed', error);
            throw new Error(`Summary generation failed: ${error.message}`);
        }
    }
    
    /**
     * キーワード抽出
     * @param {string} text - 対象テキスト
     * @param {Object} options - オプション
     * @returns {Promise<Object>} キーワード抽出結果
     */
    async generateKeywords(text, options = {}) {
        try {
            const maxKeywords = options.maxKeywords || 10;
            
            const prompt = `以下の記事から重要なキーワードを${maxKeywords}個以内で抽出してください。\n\n` +
                          '日本語で、カンマ区切りで出力してください。\n' +
                          'キーワードのみを出力し、説明や前置きは不要です。\n\n' +
                          '記事内容:\n' + text;
            
            const keywordsText = await this.claudeAPI.makeRequest(prompt, {
                maxTokens: 200,
                temperature: 0.1,
                enableRetry: true
            });
            
            const keywords = keywordsText.split(',')
                .map(keyword => keyword.trim())
                .filter(keyword => keyword.length > 0)
                .slice(0, maxKeywords);
            
            return {
                keywords,
                count: keywords.length
            };
            
        } catch (error) {
            console.error('SummaryService: Keyword extraction failed', error);
            throw new Error(`Keyword extraction failed: ${error.message}`);
        }
    }
}

// モジュールのエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ClaudeAPI, LanguageDetector, TranslationService, SummaryService };
} else {
    window.ClaudeAPI = ClaudeAPI;
    window.LanguageDetector = LanguageDetector;
    window.TranslationService = TranslationService;
    window.SummaryService = SummaryService;
}
