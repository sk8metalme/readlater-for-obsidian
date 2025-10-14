// ReadLater for Obsidian - Service Worker (ES Module)
// Chrome拡張機能のバックグラウンド処理を管理

// ESMとして静的インポート（副作用でself.*にエクスポートされる）
import '../lib/native-messaging.js';
import '../lib/markdown-generator.js';
import '../lib/aggregated-file-manager.js';
import '../utils/error-handler.js';
console.log('ReadLater for Obsidian: Libraries imported as modules');

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
        
        // 対象URLの確認（chrome:// や Chrome Web Storeでは動作不可）
        if (!isSupportedUrl(tab.url)) {
            showNotification('未対応のページ', 'このページではコンテンツ抽出が許可されていません。別のサイトでお試しください。', 'warning');
            return;
        }

        // 進行状況通知
        showProgressNotification('記事抽出開始', 10, 'ページから記事を抽出しています...');
        
        // Content Scriptに記事抽出を依頼（必要なら動的注入）
        await ensureContentScript(tab.id, tab.url);

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
        
        // ネイティブメッセージング経由のAI処理（翻訳・要約）
        if (settings.translationEnabled || settings.summaryEnabled) {
            try {
                console.log('ReadLater for Obsidian: Starting AI processing via Native Host');
                showProgressNotification('AI処理', 60, '翻訳・要約を生成しています...');
                articleData = await processWithNativeClaude(articleData, settings);
                showProgressNotification('AI処理完了', 85, 'AI機能の処理が完了しました');
            } catch (error) {
                console.warn('ReadLater for Obsidian: AI processing via Native Host failed; continue without AI', error);
                showNotification('AI処理警告', 'AI機能の処理に失敗しました。記事は保存されます。', 'warning');
            }
        }
        // 保存方式の決定（集約 vs 個別）
        showProgressNotification('保存方式確認', 85, '保存方式を確認しています...');
        
        if (settings.aggregatedSavingEnabled) {
            // 集約保存モード
            console.log('ReadLater for Obsidian: Using aggregated saving mode');
            showProgressNotification('集約保存', 90, '集約ファイルに記事を追加しています...');
            const saveResult = await saveToAggregatedFile(articleData, settings);
            showSuccessNotification(articleData.title, saveResult);
        } else {
            // 個別保存モード（既存の処理）
            console.log('ReadLater for Obsidian: Using individual saving mode');
            
            // AI反映後にMarkdown生成（翻訳・要約を含める）
            showProgressNotification('Markdown生成', 90, '記事をMarkdown形式に変換しています...');
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

            // ファイル保存（Downloads APIを使用）
            showProgressNotification('ファイル保存', 95, 'Markdownファイルを保存しています...');
            const saveResult = await saveMarkdownFile(markdown, articleData.title, settings);
            showSuccessNotification(articleData.title, saveResult);
            
            // Slack通知の送信（個別保存モードのみ）
            await sendSlackNotification(articleData.title, articleData.url, settings);
        }
        
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
    // If absolute path is provided, try native host write first
    try {
        if (settings.obsidianPath && /^\//.test(settings.obsidianPath)) {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            const safeTitle = title
                .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\-_]/g, '')
                .replace(/\s+/g, '_')
                .trim()
                .substring(0, 50);
            const filename = `${dateStr}_${timeStr}_${safeTitle}.md`;

            if (typeof NativeClaudeBridge !== 'undefined') {
                const bridge = new NativeClaudeBridge();
                const status = await bridge.checkStatus();
                if (status.available) {
                    const res = await new Promise((resolveNative, rejectNative) => {
                        chrome.runtime.sendNativeMessage('com.readlater.claude_host', {
                            type: 'writeFile',
                            baseDir: settings.obsidianPath,
                            filename,
                            content: markdown,
                            encoding: 'utf8'
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                return rejectNative(new Error(chrome.runtime.lastError.message));
                            }
                            if (!response || response.ok === false) {
                                return rejectNative(new Error(response?.error || 'Native host write failed'));
                            }
                            resolveNative(response);
                        });
                    });
                    return {
                        success: true,
                        downloadId: null,
                        filename: res.filePath,
                        fileSize: markdown.length,
                        savedAt: new Date().toISOString()
                    };
                }
            }
            // If native not available, fall through to Downloads API
        }
    } catch (e) {
        console.warn('ReadLater for Obsidian: Native write failed, fallback to Downloads API', e);
    }

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
            const isAbsolute = settings.obsidianPath && /^\//.test(settings.obsidianPath);
            const dlFilename = (!settings.obsidianPath || isAbsolute) ? filename : `${settings.obsidianPath}/${filename}`;
            chrome.downloads.download({
                url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(markdown),
                filename: dlFilename,
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
            obsidianPath: '',
            translationEnabled: true,
            summaryEnabled: true,
            targetLanguage: 'ja',
            fileNaming: 'date-title',
            aggregatedSavingEnabled: false,
            aggregatedFileName: 'ReadLater_Articles.md',
            slackNotificationEnabled: false,
            slackWebhookUrl: ''
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
    if (!settings || typeof settings !== 'object') {
        return false;
    }
    
    // 集約保存が有効な場合、集約ファイル名が必要
    if (settings.aggregatedSavingEnabled && !settings.aggregatedFileName) {
        return false;
    }
    
    return true;
}

/**
 * 集約保存用のクラスを動的に読み込む
 */
async function loadAggregatedSavingClasses() {
    try {
        console.log('ReadLater for Obsidian: Loading aggregated saving classes');
        
        // importMaps APIまたはfetchを使用してクラスを読み込み
        if (!globalThis.AggregatedFileManager) {
            await importAggregatedSavingModules();
        }
        
        console.log('ReadLater for Obsidian: Aggregated saving classes loaded successfully');
    } catch (error) {
        console.error('ReadLater for Obsidian: Failed to load aggregated saving classes', error);
        throw error;
    }
}

/**
 * 集約保存モジュールをインポート
 */
async function importAggregatedSavingModules() {
    try {
        // Service Worker環境で動作するスクリプト実行
        const modules = [
            'src/utils/error-handler.js',
            'src/lib/article-table-manager.js', 
            'src/lib/aggregated-markdown-generator.js',
            'src/lib/aggregated-file-manager.js'
        ];
        
        for (const modulePath of modules) {
            const url = chrome.runtime.getURL(modulePath);
            const response = await fetch(url);
            const moduleCode = await response.text();
            
            // Global スコープでコードを実行
            eval(moduleCode);
        }
    } catch (error) {
        console.error('ReadLater for Obsidian: Error importing aggregated saving modules:', error);
        throw error;
    }
}

/**
 * 集約ファイルに記事を保存
 * @param {Object} articleData - 記事データ
 * @param {Object} settings - ユーザー設定
 * @returns {Promise<Object>} 保存結果
 */
async function saveToAggregatedFile(articleData, settings) {
    try {
        console.log('ReadLater for Obsidian: Starting aggregated save process');
        
        // 集約保存に必要なクラスを動的に読み込み
        await loadAggregatedSavingClasses();
        
        if (typeof globalThis.AggregatedFileManager === 'undefined') {
            throw new Error('AggregatedFileManager is not available after loading');
        }
        
        const aggregatedManager = new globalThis.AggregatedFileManager();
        const result = await aggregatedManager.addArticleToAggregatedFile(articleData, settings);
        
        console.log('ReadLater for Obsidian: Aggregated save completed', result);
        return {
            success: true,
            filePath: result.filePath,
            message: `記事を集約ファイル「${settings.aggregatedFileName}」に追加しました`,
            aggregated: true
        };
        
    } catch (error) {
        console.error('ReadLater for Obsidian: Aggregated save failed', error);
        
        // フォールバック: 個別保存に切り替え
        console.log('ReadLater for Obsidian: Falling back to individual save');
        showNotification('集約保存失敗', '集約保存に失敗しました。個別ファイルで保存します。', 'warning');
        
        // 個別保存のMarkdown生成
        let markdown;
        try {
            if (typeof MarkdownGenerator !== 'undefined') {
                const generator = new MarkdownGenerator();
                const result = await generator.generateMarkdown(articleData, settings);
                markdown = result.content;
            } else {
                markdown = generateBasicMarkdown(articleData);
            }
        } catch (markdownError) {
            console.warn('ReadLater for Obsidian: Markdown generation failed, using fallback', markdownError);
            markdown = generateBasicMarkdown(articleData);
        }
        
        return await saveMarkdownFile(markdown, articleData.title, settings);
    }
}

// (旧) processWithClaude はネイティブメッセージング実装に置き換え済み

/**
 * 通知の表示
 * @param {string} title - 通知タイトル
 * @param {string} message - 通知メッセージ
 * @param {string} type - 通知タイプ (info, success, error)
 */
function showNotification(title, message, type = 'info', options = {}) {
    const notificationOptions = {
        type: 'basic',
        title: `ReadLater for Obsidian: ${title}`,
        message: message,
        priority: type === 'error' ? 2 : (type === 'warning' ? 1 : 0),
        requireInteraction: type === 'error' || options.requireInteraction || false,
        ...options
    };
    
    // アイコンは指定しない（デフォルトを使用）
    // Service Workerではdata URLが問題を起こす可能性があるため
    
    try {
        // Try Chrome notifications API (callback style)
        if (chrome?.notifications?.create) {
            chrome.notifications.create(notificationOptions, (notificationId) => {
                if (chrome.runtime.lastError) {
                    console.warn('ReadLater for Obsidian: Failed to create notification', chrome.runtime.lastError);
                    // Fallback to ServiceWorker showNotification
                    tryShowSWNotification(title, message);
                } else {
                    console.log('ReadLater for Obsidian: Notification created', {
                        id: notificationId,
                        type,
                        title,
                        message: message.substring(0, 50) + (message.length > 50 ? '...' : '')
                    });
                }
            });
            return;
        }
    } catch (e) {
        console.warn('ReadLater for Obsidian: Notification API threw', e);
    }

    // Absolute fallback
    tryShowSWNotification(title, message);
}

function tryShowSWNotification(title, message) {
    if (self?.registration?.showNotification) {
        try {
            self.registration.showNotification(`ReadLater for Obsidian: ${title}` , {
                body: message,
                icon: undefined,
            }).catch(e => {
                console.warn('ReadLater for Obsidian: SW showNotification failed', e);
            });
        } catch (e) {
            console.warn('ReadLater for Obsidian: SW showNotification threw', e);
        }
    }
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
 * Slackに通知を送信
 * @param {string} title - 記事タイトル
 * @param {string} url - 記事URL
 * @param {Object} settings - ユーザー設定
 * @returns {Promise<void>}
 */
async function sendSlackNotification(title, url, settings) {
    // Slack通知が無効またはWebhook URLが未設定の場合はスキップ
    if (!settings.slackNotificationEnabled || !settings.slackWebhookUrl) {
        console.log('ReadLater for Obsidian: Slack notification skipped (disabled or no webhook URL)');
        return;
    }
    
    try {
        console.log('ReadLater for Obsidian: Sending Slack notification', { 
            title: title.substring(0, 50), 
            url: url.substring(0, 50),
            webhookUrl: settings.slackWebhookUrl.substring(0, 50) + '...'
        });
        
        // シンプルなテキストメッセージ（フォールバック用）
        const simpleMessage = {
            text: `📖 記事を保存しました\n\n*タイトル:* ${title}\n*URL:* ${url}\n*保存日時:* ${new Date().toLocaleString('ja-JP')}`
        };
        
        // リッチなBlock Kit形式のメッセージ
        const richMessage = {
            text: '📖 記事を保存しました',
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: '📖 記事を保存しました',
                        emoji: true
                    }
                },
                {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: `*タイトル:*\n${title}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*URL:*\n<${url}|リンクを開く>`
                        }
                    ]
                },
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: `保存日時: ${new Date().toLocaleString('ja-JP')}`
                        }
                    ]
                }
            ]
        };
        
        // まずシンプルな形式で試す
        let message = simpleMessage;
        let useSimple = true;
        
        // 設定でリッチ形式が有効な場合はBlock Kitを使用
        // （今後の拡張用：settings.slackUseRichFormat が true の場合）
        if (settings.slackUseRichFormat === true) {
            message = richMessage;
            useSimple = false;
        }
        
        console.log('ReadLater for Obsidian: Sending Slack message', { 
            format: useSimple ? 'simple' : 'rich',
            messageLength: JSON.stringify(message).length 
        });
        
        // Slack Webhook URLにPOSTリクエストを送信
        const response = await fetch(settings.slackWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
        });
        
        // レスポンスの詳細を取得
        const responseText = await response.text();
        
        if (!response.ok) {
            console.error('ReadLater for Obsidian: Slack API error details', {
                status: response.status,
                statusText: response.statusText,
                responseBody: responseText,
                webhookUrl: settings.slackWebhookUrl.substring(0, 50) + '...'
            });
            
            // エラーメッセージの詳細化
            let errorMessage = `Slack API returned ${response.status}`;
            if (response.status === 403) {
                errorMessage += ' (Forbidden): Webhook URLが無効か、権限がありません。Webhook URLを再確認してください。';
            } else if (response.status === 404) {
                errorMessage += ' (Not Found): Webhook URLが見つかりません。URLを確認してください。';
            } else if (response.status === 400) {
                errorMessage += ' (Bad Request): メッセージの形式が正しくありません。';
            }
            
            throw new Error(errorMessage);
        }
        
        console.log('ReadLater for Obsidian: Slack notification sent successfully', {
            status: response.status,
            responseBody: responseText
        });
        
    } catch (error) {
        // Slack通知の失敗は記事保存処理に影響を与えない
        console.error('ReadLater for Obsidian: Failed to send Slack notification', error);
        console.error('ReadLater for Obsidian: Error details', {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack
        });
        console.warn('ReadLater for Obsidian: Article saved successfully despite Slack notification failure');
    }
}

/**
 * Claude CLI状態の確認
 * @returns {Promise<Object>} 状態確認結果
 */
async function checkClaudeCLIStatus() {
    try {
        if (typeof NativeClaudeBridge !== 'undefined') {
            const bridge = new NativeClaudeBridge();
            const status = await bridge.checkStatus();
            return {
                success: true,
                available: !!status.available,
                message: status.message,
                version: status.version || null,
            };
        }
        return { success: false, available: false, message: 'Native bridge not loaded' };
    } catch (error) {
        console.error('ReadLater for Obsidian: Native host status check failed', error);
        return { success: false, available: false, message: error.message };
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

/**
 * 対象URLがコンテンツスクリプト注入を許可しているか
 */
function isSupportedUrl(url) {
    try {
        const u = new URL(url);
        if (u.protocol === 'http:' || u.protocol === 'https:') return true;
        // file: はユーザーの「ファイルのURLへのアクセスを許可」が必要
        if (u.protocol === 'file:') return true;
        return false; // chrome:// などは不可
    } catch {
        return false;
    }
}

/**
 * 必要に応じてコンテンツスクリプトを動的注入
 */
async function ensureContentScript(tabId, url) {
    // まず軽くpingして存在確認
    try {
        const ping = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: 'ping' }, (resp) => {
                if (chrome.runtime.lastError) return resolve(null);
                resolve(resp);
            });
        });
        if (ping) return; // 既に注入済み
    } catch {}

    // scripting.executeScript で注入
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['src/lib/article-extractor.js', 'src/lib/markdown-generator.js', 'src/content/content-script.js']
        });
        console.log('ReadLater for Obsidian: Content scripts injected');
    } catch (e) {
        console.warn('ReadLater for Obsidian: Failed to inject content scripts', e);
    }
}

/**
 * AI処理（Native Messaging使用）
 * @param {Object} articleData
 * @param {Object} settings
 * @returns {Promise<Object>}
 */
async function processWithNativeClaude(articleData, settings) {
    if (typeof NativeClaudeBridge === 'undefined') throw new Error('Native bridge not available');

    const bridge = new NativeClaudeBridge();
    const status = await bridge.checkStatus();
    if (!status.available) throw new Error('Claude Native Host unavailable');

    const result = { ...articleData };

    // Detect language locally
    let lang = 'unknown';
    let conf = 0.0;
    if (typeof detectLanguageSimple === 'function') {
        const d = await detectLanguageSimple(articleData.content || '');
        lang = d.language; conf = d.confidence;
    }
    result.detectedLanguage = lang; result.languageConfidence = conf;

     // Translation functionality removed - keep original language
     // No translation processing - articles are saved in their original language

     // Summarization (hierarchical for stability)
     if (settings.summaryEnabled) {
         try {
             const base = articleData.content || ''; // 元のコンテンツを使用（翻訳済みコンテンツは使用しない）
            const CHUNK_SIZE_SUM = 2000; // smaller chunks for stability
            let finalSummary = '';

            if (base.length > CHUNK_SIZE_SUM) {
                const chunks = chunkText(base, CHUNK_SIZE_SUM);
                const partials = [];
                let i = 0;
                for (const ch of chunks) {
                    i++;
                    showProgressNotification('AI要約', Math.min(75 + Math.floor((i / chunks.length) * 10), 85), `部分要約 ${i}/${chunks.length}`);
                    const part = await bridge.summarize(ch, { style: 'bullet', maxLength: 280, timeoutMs: 180000 });
                    partials.push(part.summary || part.data || '');
                }
                const combined = partials.join('\n\n');
                const reduced = await bridge.summarize(combined.slice(0, 12000), { style: settings.summaryStyle || 'structured', maxLength: settings.summaryLength || 500, timeoutMs: 240000 });
                finalSummary = reduced.summary || reduced.data || '';
            } else {
                const summary = await bridge.summarize(base, { style: settings.summaryStyle || 'structured', maxLength: settings.summaryLength || 500, timeoutMs: 240000 });
                finalSummary = summary.summary || summary.data || '';
            }

            result.summary = finalSummary;
            result.summarySkipped = false;
            if (!result.keywords) {
                const k = await bridge.keywords(base.slice(0, 12000), { maxKeywords: 8, timeoutMs: 90000 });
                result.keywords = k.keywords || k.data || [];
            }
        } catch (e) {
            console.warn('Summarization via native host failed', e);
            result.summaryError = e.message;
             // Local heuristic fallback summary (no AI)
             try {
                 const src = articleData.content || ''; // 元のコンテンツを使用
                 const lang = result.detectedLanguage || 'unknown';
                const local = generateLocalSummaryFromText(src, lang, settings.summaryLength || 500);
                if (local && local.length > 0) {
                    let finalLocal = local;
                    // If target is Japanese but source language is not, try lightweight translation of the local summary only
                    if ((settings.targetLanguage || 'ja') === 'ja' && lang !== 'ja') {
                        try {
                            const bridge = new NativeClaudeBridge();
                            const st = await bridge.checkStatus();
                            if (st.available) {
                                const tr = await bridge.translate(local, lang === 'unknown' ? 'en' : lang, 'ja', { preserveMarkdown: true, timeoutMs: 30000 });
                                finalLocal = tr.translatedText || tr.data || local;
                            }
                        } catch (x) {
                            console.warn('ReadLater for Obsidian: Local summary translation skipped', x);
                        }
                    }
                    result.summary = finalLocal;
                    result.summarySkipped = false;
                    console.log('ReadLater for Obsidian: Local heuristic summary generated');
                }
            } catch (f) {
                console.warn('ReadLater for Obsidian: Local heuristic summary failed', f);
            }
        }
    }

    return result;
}

function chunkText(text, chunkSize) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + chunkSize));
        i += chunkSize;
    }
    return chunks;
}

/**
 * ローカル簡易要約（ヒューリスティック、AI不使用）
 */
function generateLocalSummaryFromText(text, lang = 'ja', maxLen = 500) {
    if (!text || typeof text !== 'string') return '';
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return '';

    // 文分割（簡易）
    let sentences;
    if (lang === 'ja') {
        sentences = clean.split(/(?<=[。！？])/);
    } else {
        sentences = clean.split(/(?<=[\.\?!])\s+/);
    }
    sentences = sentences.map(s => s.trim()).filter(Boolean);
    if (sentences.length === 0) return '';

    // 先頭重視で3-5文抽出（極端に短い/長い文は除外）
    const picked = [];
    for (const s of sentences) {
        if (s.length < 20) continue;
        picked.push(s);
        if (picked.length >= 5) break;
    }
    if (picked.length === 0) picked.push(sentences[0]);

    // 長さ制限
    let summaryBody = picked.join('\n');
    if (summaryBody.length > maxLen) {
        summaryBody = summaryBody.slice(0, maxLen - 1) + '…';
    }

    // Markdown組み立て（構造化）
    const title = lang === 'ja' ? '## 記事の要点 (ローカル要約)' : '## Key Points (Local Summary)';
    const bullets = summaryBody.split(/\n/).map(line => `- ${line}`).join('\n');
    return `${title}\n\n${bullets}`;
}
