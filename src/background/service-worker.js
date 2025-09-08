// ReadLater for Obsidian - Service Worker
// Chrome拡張機能のバックグラウンド処理を管理

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
        
        // TODO: Sprint 3で実装予定
        // 1. Claude CLI による翻訳処理
        // 2. Claude CLI による要約処理
        // 3. Markdownファイル生成
        // 4. ファイル保存
        
        // 現在は基本情報のみでMarkdownを生成（Phase 1の簡易実装）
        const markdown = generateBasicMarkdown(articleData);
        
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
