// ReadLater for Obsidian - Service Worker
// Chrome拡張機能のバックグラウンド処理を管理

// 必要なライブラリをインポート
try {
    importScripts(
        'src/lib/claude-api.js',
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
        showNotification('処理開始', '記事を保存しています...', 'info');
        
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
                processExtractedArticle(response.data, settings);
            } else {
                console.error('ReadLater for Obsidian: Article extraction failed', response);
                showNotification('エラー', '記事の抽出に失敗しました', 'error');
            }
        });
        
    } catch (error) {
        console.error('ReadLater for Obsidian: Error in handleSaveArticle', error);
        showNotification('エラー', '記事保存処理でエラーが発生しました', 'error');
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
                articleData = await processWithClaude(articleData, settings);
            } catch (error) {
                console.warn('ReadLater for Obsidian: Claude processing failed, continuing without AI features', error);
                showNotification('AI処理警告', 'AI機能の処理に失敗しました。記事は保存されます。', 'warning');
            }
        }
        
        // ファイル保存（Downloads APIを使用）
        await saveMarkdownFile(markdown, articleData.title, settings);
        
        showNotification('保存完了', `記事「${articleData.title}」を保存しました`, 'success');
        
    } catch (error) {
        console.error('ReadLater for Obsidian: Error processing article', error);
        showNotification('エラー', '記事の処理中にエラーが発生しました', 'error');
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
async function saveMarkdownFile(markdown, title, settings) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    // ファイル名の生成（安全な文字のみ使用）
    const safeTitle = title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]/g, '').trim();
    const filename = `${dateStr}_${safeTitle}.md`;
    
    // Downloads APIでファイル保存
    chrome.downloads.download({
        url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(markdown),
        filename: settings.obsidianPath ? `${settings.obsidianPath}/${filename}` : filename,
        saveAs: false
    }, (downloadId) => {
        if (chrome.runtime.lastError) {
            console.error('ReadLater for Obsidian: Download failed', chrome.runtime.lastError);
            throw new Error('ファイル保存に失敗しました');
        }
        console.log('ReadLater for Obsidian: File saved with ID', downloadId);
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
        if (!settings.claudeApiKey) {
            throw new Error('Claude API key not configured');
        }
        
        // Claude APIライブラリの初期化
        let claudeAPI, languageDetector, translationService, summaryService;
        
        try {
            if (typeof ClaudeAPI !== 'undefined') {
                claudeAPI = new ClaudeAPI(settings.claudeApiKey);
                languageDetector = new LanguageDetector();
                translationService = new TranslationService(claudeAPI);
                summaryService = new SummaryService(claudeAPI);
                console.log('ReadLater for Obsidian: Claude API services initialized');
            } else {
                throw new Error('Claude API library not available');
            }
        } catch (error) {
            console.error('ReadLater for Obsidian: Failed to initialize Claude services', error);
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
function showNotification(title, message, type = 'info') {
    const iconMap = {
        info: 'icons/icon48.png',
        success: 'icons/icon48.png',
        error: 'icons/icon48.png'
    };
    
    chrome.notifications.create({
        type: 'basic',
        iconUrl: iconMap[type] || iconMap.info,
        title: `ReadLater: ${title}`,
        message: message
    });
}
