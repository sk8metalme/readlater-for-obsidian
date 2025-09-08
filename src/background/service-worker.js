// ReadLater for Obsidian - Service Worker
// Chrome拡張機能のバックグラウンド処理を管理

// 必要なライブラリをインポート
try {
    importScripts(
        'src/lib/claude-cli.js',
        'src/lib/markdown-generator.js',
        'src/utils/error-handler.js'
    );
    console.log('ReadLater for Obsidian: Libraries imported successfully');
} catch (error) {
    console.warn('ReadLater for Obsidian: Failed to import some libraries', error);
}

console.log('ReadLater for Obsidian: Service Worker initialized');

// 拡張機能インストール時の初期化
chrome.runtime.onInstalled.addListener((details) => {
    console.log('ReadLater for Obsidian: Extension installed/updated', details.reason);
    
    // コンテキストメニューの作成
    createContextMenu();
    
    // 初期設定の確認
    initializeDefaultSettings();
});

// 拡張機能起動時の初期化
chrome.runtime.onStartup.addListener(() => {
    console.log('ReadLater for Obsidian: Extension started');
    createContextMenu();
});

/**
 * コンテキストメニュー（右クリックメニュー）の作成
 */
function createContextMenu() {
    // 既存のメニューをクリア
    chrome.contextMenus.removeAll(() => {
        // メインメニューの作成
        chrome.contextMenus.create({
            id: 'readlater-save-article',
            title: '📖 後で読む（ReadLater）',
            contexts: ['page', 'selection'],
            documentUrlPatterns: ['http://*/*', 'https://*/*']
        });
        
        // 設定メニューの作成
        chrome.contextMenus.create({
            id: 'readlater-settings',
            title: '⚙️ ReadLater設定',
            contexts: ['page']
        });
        
        console.log('ReadLater for Obsidian: Context menu created');
    });
}

/**
 * コンテキストメニュークリック時の処理
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log('ReadLater for Obsidian: Context menu clicked', info.menuItemId);
    
    switch (info.menuItemId) {
        case 'readlater-save-article':
            handleSaveArticle(info, tab);
            break;
        case 'readlater-settings':
            handleOpenSettings();
            break;
        default:
            console.warn('ReadLater for Obsidian: Unknown menu item', info.menuItemId);
    }
});

/**
 * 記事保存処理の開始
 * @param {Object} info - コンテキストメニュー情報
 * @param {Object} tab - アクティブなタブ情報
 */
async function handleSaveArticle(info, tab) {
    try {
        console.log('ReadLater for Obsidian: Starting article save process', {
            url: tab.url,
            title: tab.title,
            selection: info.selectionText
        });
        
        // 設定の確認
        const settings = await getSettings();
        if (!validateSettings(settings)) {
            showNotification('設定エラー', '設定を確認してください。APIキーまたは保存先が未設定です。', 'error');
            handleOpenSettings();
            return;
        }
        
        // 進行状況通知
        showProgressNotification('記事抽出開始', 10, 'ページから記事を抽出しています...');
        
        // Content Scriptに記事抽出を依頼
        chrome.tabs.sendMessage(tab.id, {
            action: 'extractArticle',
            data: {
                url: tab.url,
                title: tab.title,
                selection: info.selectionText || null
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('ReadLater for Obsidian: Failed to communicate with content script', chrome.runtime.lastError);
                showNotification('エラー', 'ページの解析に失敗しました', 'error');
                return;
            }
            
            if (response && response.success) {
                console.log('ReadLater for Obsidian: Article extraction successful');
                showProgressNotification('記事抽出完了', 30, '記事データを処理しています...');
                processExtractedArticle(response.data, settings);
            } else {
                console.error('ReadLater for Obsidian: Article extraction failed', response);
                showErrorNotification('記事抽出エラー', new Error('記事の抽出に失敗しました'), { url: tab.url });
            }
        });
        
    } catch (error) {
        console.error('ReadLater for Obsidian: Error in handleSaveArticle', error);
        showErrorNotification('記事保存エラー', error, { url: tab?.url });
    }
}

/**
 * 抽出された記事データの処理
 * @param {Object} articleData - 抽出された記事データ
 * @param {Object} settings - ユーザー設定
 */
async function processExtractedArticle(articleData, settings) {
    try {
        console.log('ReadLater for Obsidian: Processing extracted article', articleData);
        
        // Markdownファイル生成（改良版）
        showProgressNotification('Markdown生成', 50, '記事をMarkdown形式に変換しています...');
        let markdown;
        try {
            if (typeof MarkdownGenerator !== 'undefined') {
                console.log('ReadLater for Obsidian: Using MarkdownGenerator library');
                const generator = new MarkdownGenerator();
                const result = await generator.generateMarkdown(articleData, settings);
                markdown = result.content;
                console.log('ReadLater for Obsidian: Markdown generated with library', result.filename);
            } else {
                console.log('ReadLater for Obsidian: Using fallback markdown generation');
                markdown = generateBasicMarkdown(articleData);
            }
        } catch (error) {
            console.warn('ReadLater for Obsidian: Markdown generation failed, using fallback', error);
            markdown = generateBasicMarkdown(articleData);
        }
        
        // Claude CLI連携による翻訳・要約処理
        if (settings.translationEnabled || settings.summaryEnabled) {
            try {
                console.log('ReadLater for Obsidian: Starting Claude CLI processing');
                showProgressNotification('AI処理', 70, '翻訳・要約を生成しています...');
                articleData = await processWithClaude(articleData, settings);
                showProgressNotification('AI処理完了', 85, 'AI機能の処理が完了しました');
            } catch (error) {
                console.warn('ReadLater for Obsidian: Claude processing failed, continuing without AI features', error);
                showNotification('AI処理警告', 'AI機能の処理に失敗しました。記事は保存されます。', 'warning');
            }
        }
        
        // ファイル保存（Downloads APIを使用）
        showProgressNotification('ファイル保存', 90, 'Markdownファイルを保存しています...');
        const saveResult = await saveMarkdownFile(markdown, articleData.title, settings);
        
        showSuccessNotification(articleData.title, saveResult);
        
    } catch (error) {
        console.error('ReadLater for Obsidian: Error processing article', error);
        showErrorNotification('記事処理エラー', error, { url: articleData.url });
    }
}

/**
 * 基本的なMarkdown生成（簡易版 - Sprint 4で詳細実装予定）
 * @param {Object} articleData - 記事データ
 * @returns {string} Markdownコンテンツ
 */
function generateBasicMarkdown(articleData) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    return `---
title: "${articleData.title}"
url: "${articleData.url}"
date: "${dateStr}"
tags: ["ReadLater"]
---

# ${articleData.title}

**元記事**: [${articleData.title}](${articleData.url})  
**保存日**: ${dateStr}

## 記事内容

${articleData.content || '記事内容の抽出に失敗しました'}

---
*Generated by ReadLater for Obsidian*
`;
}

/**
 * Markdownファイルの保存
 * @param {string} markdown - Markdownコンテンツ
 * @param {string} title - 記事タイトル
 * @param {Object} settings - ユーザー設定
 */
/**
 * Markdownファイルを保存
 * @param {string} markdown - 保存するMarkdownコンテンツ
 * @param {string} title - 記事タイトル
 * @param {Object} settings - ユーザー設定
 * @returns {Promise<Object>} 保存結果
 */
async function saveMarkdownFile(markdown, title, settings) {
    return new Promise((resolve, reject) => {
        try {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            
            // ファイル名の生成（安全な文字のみ使用、長さ制限）
            const safeTitle = title
                .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\-_]/g, '')
                .replace(/\s+/g, '_')
                .trim()
                .substring(0, 50); // 最大50文字
            
            const filename = `${dateStr}_${timeStr}_${safeTitle}.md`;
            
            // 進捗通知
            showNotification('保存中', 'Markdownファイルを保存しています...', 'info');
            
            console.log('ReadLater for Obsidian: Starting file save', {
                filename,
                contentLength: markdown.length,
                obsidianPath: settings.obsidianPath
            });
            
            // Downloads APIでファイル保存
            chrome.downloads.download({
                url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(markdown),
                filename: settings.obsidianPath ? `${settings.obsidianPath}/${filename}` : filename,
                saveAs: false
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error('ReadLater for Obsidian: Download failed', chrome.runtime.lastError);
                    reject(new Error(`ファイル保存に失敗しました: ${chrome.runtime.lastError.message}`));
                    return;
                }
                
                console.log('ReadLater for Obsidian: File saved with ID', downloadId);
                
                // ダウンロード完了を監視
                const checkDownloadStatus = () => {
                    chrome.downloads.search({ id: downloadId }, (downloads) => {
                        if (chrome.runtime.lastError) {
                            console.error('ReadLater for Obsidian: Error checking download status', chrome.runtime.lastError);
                            reject(new Error('ダウンロード状況の確認に失敗しました'));
                            return;
                        }
                        
                        if (downloads.length === 0) {
                            // ダウンロードが見つからない場合、少し待って再試行
                            setTimeout(checkDownloadStatus, 1000);
                            return;
                        }
                        
                        const download = downloads[0];
                        console.log('ReadLater for Obsidian: Download status', {
                            id: download.id,
                            state: download.state,
                            filename: download.filename
                        });
                        
                        if (download.state === 'complete') {
                            resolve({
                                success: true,
                                downloadId: download.id,
                                filename: download.filename,
                                fileSize: download.fileSize || markdown.length,
                                savedAt: new Date().toISOString()
                            });
                        } else if (download.state === 'interrupted') {
                            reject(new Error(`ダウンロードが中断されました: ${download.error || '不明なエラー'}`));
                        } else {
                            // 進行中の場合は少し待って再確認
                            setTimeout(checkDownloadStatus, 1000);
                        }
                    });
                };
                
                // ダウンロード状況の確認を開始
                setTimeout(checkDownloadStatus, 500);
            });
            
        } catch (error) {
            console.error('ReadLater for Obsidian: Error in saveMarkdownFile', error);
            reject(error);
        }
    });
}

/**
 * 設定画面を開く
 */
function handleOpenSettings() {
    chrome.runtime.openOptionsPage();
}

/**
 * 初期設定の設定
 */
async function initializeDefaultSettings() {
    const existingSettings = await chrome.storage.sync.get(['readlaterSettings']);
    
    if (!existingSettings.readlaterSettings) {
        const defaultSettings = {
            claudeApiKey: '',
            obsidianPath: '',
            translationEnabled: true,
            summaryEnabled: true,
            language: 'ja'
        };
        
        await chrome.storage.sync.set({ readlaterSettings: defaultSettings });
        console.log('ReadLater for Obsidian: Default settings initialized');
    }
}

/**
 * 設定の取得
 * @returns {Promise<Object>} ユーザー設定
 */
async function getSettings() {
    const result = await chrome.storage.sync.get(['readlaterSettings']);
    return result.readlaterSettings || {};
}

/**
 * 設定の検証
 * @param {Object} settings - ユーザー設定
 * @returns {boolean} 設定が有効かどうか
 */
function validateSettings(settings) {
    // 現在は基本チェックのみ（Sprint 3でClaude CLI関連の検証を追加予定）
    return settings && typeof settings === 'object';
}

/**
 * Claude CLI連携による翻訳・要約処理
 * @param {Object} articleData - 記事データ
 * @param {Object} settings - ユーザー設定
 * @returns {Promise<Object>} 処理済み記事データ
 */
async function processWithClaude(articleData, settings) {
    try {
        // Claude CLIはAPIキー不要
        
        // Claude CLIライブラリの初期化
        let claudeCLI, languageDetector, translationService, summaryService;
        
        try {
            if (typeof ClaudeCLI !== 'undefined') {
                claudeCLI = new ClaudeCLI();
                languageDetector = new LanguageDetector();
                translationService = new TranslationService(claudeCLI);
                summaryService = new SummaryService(claudeCLI);
                console.log('ReadLater for Obsidian: Claude CLI services initialized');
                
                // Claude CLIの利用可能性をチェック
                if (!claudeCLI.isAvailable) {
                    throw new Error('Claude CLI is not available on this system. Please install Claude CLI first.');
                }
            } else {
                throw new Error('Claude CLI library not available');
            }
        } catch (error) {
            console.error('ReadLater for Obsidian: Failed to initialize Claude CLI services', error);
            throw error;
        }
        
        const result = { ...articleData };
        
        // 言語検出
        console.log('ReadLater for Obsidian: Detecting content language');
        const languageResult = await languageDetector.detectLanguage(articleData.content);
        result.detectedLanguage = languageResult.language;
        result.languageConfidence = languageResult.confidence;
        
        console.log('ReadLater for Obsidian: Detected language', languageResult);
        
        // 翻訳処理
        if (settings.translationEnabled && languageResult.language !== 'ja') {
            console.log('ReadLater for Obsidian: Starting translation');
            
            try {
                // タイトルの翻訳
                const titleTranslation = await translationService.translateText(
                    articleData.title,
                    languageResult.language,
                    settings.targetLanguage || 'ja',
                    { isTitle: true }
                );
                
                // 本文の翻訳
                const contentTranslation = await translationService.translateText(
                    articleData.content,
                    languageResult.language,
                    settings.targetLanguage || 'ja',
                    { preserveMarkdown: true }
                );
                
                result.translatedTitle = titleTranslation.translatedText;
                result.translatedContent = contentTranslation.translatedText;
                result.translationSkipped = titleTranslation.skipped && contentTranslation.skipped;
                
                console.log('ReadLater for Obsidian: Translation completed', {
                    titleTranslated: !titleTranslation.skipped,
                    contentTranslated: !contentTranslation.skipped
                });
                
            } catch (error) {
                console.error('ReadLater for Obsidian: Translation failed', error);
                result.translationError = error.message;
            }
        } else {
            console.log('ReadLater for Obsidian: Translation skipped', {
                enabled: settings.translationEnabled,
                language: languageResult.language
            });
        }
        
        // 要約処理
        if (settings.summaryEnabled) {
            console.log('ReadLater for Obsidian: Starting summarization');
            
            try {
                const contentToSummarize = result.translatedContent || articleData.content;
                
                const summaryResult = await summaryService.generateSummary(contentToSummarize, {
                    style: settings.summaryStyle || 'structured',
                    maxLength: settings.summaryLength || 500
                });
                
                result.summary = summaryResult.summary;
                result.summarySkipped = summaryResult.skipped;
                result.summaryWordCount = summaryResult.summaryWordCount;
                
                // キーワード抽出も実行
                if (!summaryResult.skipped) {
                    const keywordsResult = await summaryService.generateKeywords(contentToSummarize);
                    result.keywords = keywordsResult.keywords;
                }
                
                console.log('ReadLater for Obsidian: Summarization completed', {
                    summaryGenerated: !summaryResult.skipped,
                    keywordsCount: result.keywords?.length || 0
                });
                
            } catch (error) {
                console.error('ReadLater for Obsidian: Summarization failed', error);
                result.summaryError = error.message;
            }
        } else {
            console.log('ReadLater for Obsidian: Summarization skipped (disabled)');
        }
        
        return result;
        
    } catch (error) {
        console.error('ReadLater for Obsidian: Claude processing failed', error);
        throw error;
    }
}

/**
 * 通知の表示
 * @param {string} title - 通知タイトル
 * @param {string} message - 通知メッセージ
 * @param {string} type - 通知タイプ (info, success, error)
 */
function showNotification(title, message, type = 'info', options = {}) {
    const iconMap = {
        info: 'icons/icon.svg',
        success: 'icons/icon.svg',
        error: 'icons/icon.svg',
        warning: 'icons/icon.svg'
    };
    
    const notificationOptions = {
        type: 'basic',
        iconUrl: iconMap[type] || iconMap.info,
        title: `ReadLater for Obsidian: ${title}`,
        message: message,
        priority: type === 'error' ? 2 : (type === 'warning' ? 1 : 0),
        requireInteraction: type === 'error' || options.requireInteraction || false,
        ...options
    };
    
    chrome.notifications.create(notificationOptions, (notificationId) => {
        if (chrome.runtime.lastError) {
            console.error('ReadLater for Obsidian: Failed to create notification', chrome.runtime.lastError);
        } else {
            console.log('ReadLater for Obsidian: Notification created', {
                id: notificationId,
                type,
                title,
                message: message.substring(0, 50) + (message.length > 50 ? '...' : '')
            });
        }
    });
}

/**
 * 進捗通知を表示
 * @param {string} stage - 処理段階
 * @param {number} progress - 進捗率 (0-100)
 * @param {string} details - 詳細情報
 */
function showProgressNotification(stage, progress, details = '') {
    const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
    const message = `${stage}\n${progressBar} ${progress}%\n${details}`;
    
    showNotification('処理中', message, 'info', {
        requireInteraction: false
    });
}

/**
 * 成功通知を表示
 * @param {string} title - 記事タイトル
 * @param {Object} result - 保存結果
 */
function showSuccessNotification(title, result) {
    const message = `記事「${title}」を保存しました\nファイル: ${result.filename}\nサイズ: ${formatFileSize(result.fileSize)}`;
    
    showNotification('保存完了', message, 'success', {
        requireInteraction: false
    });
}

/**
 * エラー通知を表示
 * @param {string} title - エラータイトル
 * @param {Error} error - エラーオブジェクト
 * @param {Object} context - エラーコンテキスト
 */
function showErrorNotification(title, error, context = {}) {
    let message = error.message || '不明なエラーが発生しました';
    
    // エラーの種類に応じて詳細メッセージを追加
    if (error.message.includes('Claude CLI')) {
        message += '\n\nClaude CLIがインストールされているか確認してください。';
    } else if (error.message.includes('ファイル保存')) {
        message += '\n\n保存先フォルダの権限を確認してください。';
    } else if (error.message.includes('記事抽出')) {
        message += '\n\nページの構造が対応していない可能性があります。';
    }
    
    if (context.url) {
        message += `\n\nURL: ${context.url}`;
    }
    
    showNotification(title, message, 'error', {
        requireInteraction: true
    });
}

/**
 * ファイルサイズをフォーマット
 * @param {number} bytes - バイト数
 * @returns {string} フォーマットされたサイズ
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Claude CLI状態の確認
 * @returns {Promise<Object>} 状態確認結果
 */
async function checkClaudeCLIStatus() {
    try {
        if (typeof ClaudeCLI !== 'undefined') {
            const claudeCLI = new ClaudeCLI();
            return {
                success: claudeCLI.isAvailable,
                available: claudeCLI.isAvailable,
                message: claudeCLI.isAvailable ? 'Claude CLI is available' : 'Claude CLI is not available'
            };
        } else {
            return {
                success: false,
                available: false,
                message: 'Claude CLI library not loaded'
            };
        }
    } catch (error) {
        console.error('ReadLater for Obsidian: Claude CLI status check failed', error);
        return {
            success: false,
            available: false,
            message: error.message
        };
    }
}

// メッセージリスナーの設定
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('ReadLater for Obsidian: Message received', request);
    
    switch (request.action) {
        case 'saveArticle':
            handleSaveArticle(request.data, sender.tab);
            break;
            
        case 'openSettings':
            handleOpenSettings();
            break;
            
        case 'checkClaudeCLIStatus':
            checkClaudeCLIStatus().then(sendResponse).catch(error => {
                console.error('ReadLater for Obsidian: Claude CLI status check failed', error);
                sendResponse({ success: false, error: error.message });
            });
            return true; // 非同期レスポンスのため
            
        default:
            console.warn('ReadLater for Obsidian: Unknown action', request.action);
    }
});
