// ReadLater for Obsidian - Options Page Script
// 設定画面のロジックを管理

console.log('ReadLater for Obsidian: Options page loaded');

// DOM要素の取得
const elements = {
    // 入力フィールド
    obsidianPath: document.getElementById('obsidian-path'),
    translationEnabled: document.getElementById('translation-enabled'),
    summaryEnabled: document.getElementById('summary-enabled'),
    targetLanguage: document.getElementById('target-language'),
    fileNaming: document.getElementById('file-naming'),
    
    // 集約保存設定
    aggregatedSavingEnabled: document.getElementById('aggregated-saving-enabled'),
    aggregatedFileName: document.getElementById('aggregated-file-name'),
    
    // ボタン
    testClaudeConnection: document.getElementById('test-claude-connection'),
    testFileSave: document.getElementById('test-file-save'),
    saveSettings: document.getElementById('save-settings'),
    resetSettings: document.getElementById('reset-settings'),
    
    // 結果表示
    statusMessage: document.getElementById('status-message'),
    claudeStatus: document.getElementById('claude-status'),
    claudeTestResult: document.getElementById('claude-test-result'),
    fileTestResult: document.getElementById('file-test-result')
};

// デフォルト設定
const defaultSettings = {
    obsidianPath: 'ReadLater',
    translationEnabled: true,
    summaryEnabled: true,
    targetLanguage: 'ja',
    fileNaming: 'date-title',
    aggregatedSavingEnabled: false,
    aggregatedFileName: 'ReadLater_Articles.md'
};

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('ReadLater for Obsidian: Initializing options page');
    
    // 保存済み設定の読み込み
    await loadSettings();
    
    // イベントリスナーの設定
    setupEventListeners();
    
    // Claude CLI状態の確認
    await checkClaudeCLIStatus();
    
    // 初期状態の確認
    validateCurrentSettings();
});

/**
 * 保存済み設定の読み込み
 */
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['readlaterSettings']);
        const settings = result.readlaterSettings || defaultSettings;
        
        console.log('ReadLater for Obsidian: Loading settings', settings);
        
        // フォームに設定値を反映
        elements.obsidianPath.value = settings.obsidianPath || defaultSettings.obsidianPath;
        elements.translationEnabled.checked = settings.translationEnabled !== false;
        elements.summaryEnabled.checked = settings.summaryEnabled !== false;
        elements.targetLanguage.value = settings.targetLanguage || defaultSettings.targetLanguage;
        elements.fileNaming.value = settings.fileNaming || defaultSettings.fileNaming;
        
        // 集約保存設定の反映
        elements.aggregatedSavingEnabled.checked = settings.aggregatedSavingEnabled === true;
        elements.aggregatedFileName.value = settings.aggregatedFileName || defaultSettings.aggregatedFileName;
        
        // 集約保存設定のUI状態更新
        updateAggregatedSavingUI();
        
    } catch (error) {
        console.error('ReadLater for Obsidian: Error loading settings', error);
        showStatusMessage('設定の読み込みに失敗しました', 'error');
    }
}

/**
 * Claude CLI状態の確認
 */
async function checkClaudeCLIStatus() {
    try {
        // Service WorkerにClaude CLI状態を確認
        const response = await chrome.runtime.sendMessage({
            action: 'checkClaudeCLIStatus'
        });
        
        if (response && response.success) {
            updateClaudeStatus('success', '✅ Claude CLI利用可能', 'Claude CLIが正常にインストールされています');
        } else {
            updateClaudeStatus('error', '❌ Claude CLI未インストール', 'Claude CLIをインストールしてください');
        }
    } catch (error) {
        console.error('ReadLater for Obsidian: Failed to check Claude CLI status', error);
        updateClaudeStatus('warning', '⚠️ 状態不明', 'Claude CLIの状態を確認できませんでした');
    }
}

/**
 * Claude CLI状態表示の更新
 */
function updateClaudeStatus(type, icon, text) {
    const statusIcon = elements.claudeStatus.querySelector('.status-icon');
    const statusText = elements.claudeStatus.querySelector('.status-text');
    
    statusIcon.textContent = icon;
    statusText.textContent = text;
    
    // クラスの更新
    elements.claudeStatus.className = `status-indicator ${type}`;
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
    // 接続テストボタン
    elements.testClaudeConnection.addEventListener('click', testClaudeConnection);
    elements.testFileSave.addEventListener('click', testFileSave);
    
    // 設定保存・リセットボタン
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.resetSettings.addEventListener('click', resetSettings);
    
    // リアルタイム検証
    elements.obsidianPath.addEventListener('input', validateCurrentSettings);
    
    // 集約保存設定の変更時イベント
    elements.aggregatedSavingEnabled.addEventListener('change', updateAggregatedSavingUI);
    elements.aggregatedFileName.addEventListener('input', validateCurrentSettings);
}

/**
 * APIキーの表示/非表示切り替え
 */
// APIキー入力は不要（ネイティブメッセージング利用のため）

/**
 * Claude CLI接続テスト
 */
async function testClaudeConnection() {
    const button = elements.testClaudeConnection;
    const result = elements.claudeTestResult;
    
    // ボタンの無効化とローディング表示
    button.disabled = true;
    button.textContent = '🔄 テスト中...';
    
    result.className = 'test-result loading';
    result.style.display = 'block';
    result.textContent = 'Claude CLI接続をテストしています...';
    
    try {
        // Service Worker経由でネイティブホストの状態確認
        const resp = await chrome.runtime.sendMessage({ action: 'checkClaudeCLIStatus' });
        if (resp && resp.available) {
            result.className = 'test-result success';
            const ver = resp.version ? `（${resp.version}）` : '';
            result.textContent = `✅ ネイティブホスト接続OK${ver}`;
        } else {
            throw new Error(resp?.message || 'ネイティブホストに接続できません');
        }
    } catch (error) {
        console.error('ReadLater for Obsidian: Claude connection test failed', error);
        result.className = 'test-result error';
        result.textContent = `❌ 接続テストに失敗しました: ${error.message}`;
    } finally {
        // ボタンの復元
        button.disabled = false;
        button.textContent = '🤖 Claude CLI接続テスト';
    }
}

/**
 * ファイル保存テスト
 */
async function testFileSave() {
    const button = elements.testFileSave;
    const result = elements.fileTestResult;
    
    button.disabled = true;
    button.textContent = '🔄 テスト中...';
    
    result.className = 'test-result loading';
    result.style.display = 'block';
    result.textContent = 'ファイル保存をテストしています...';
    
    try {
        const path = elements.obsidianPath.value.trim();
        
        if (!path) {
            throw new Error('保存先フォルダが入力されていません');
        }
        
        // テスト用のMarkdownコンテンツ
        const testMarkdown = `---
title: "ReadLater テスト記事"
url: "https://example.com/test"
date: "${new Date().toISOString().split('T')[0]}"
tags: ["ReadLater", "Test"]
---

# ReadLater テスト記事

これは設定テスト用のファイルです。
このファイルが正常に保存されていれば、ReadLater for Obsidianの保存機能は正常に動作しています。

## テスト実行時刻
${new Date().toLocaleString('ja-JP')}

---
*Generated by ReadLater for Obsidian - Settings Test*
`;
        
        // 保存方式を切り替え
        const isAbsolute = /^\//.test(path);
        const fnameOnly = `readlater-test-${Date.now()}.md`;

        if (isAbsolute) {
            // ネイティブホストで直接保存
            const resp = await new Promise((resolve, reject) => {
                chrome.runtime.sendNativeMessage('com.readlater.claude_host', {
                    type: 'writeFile',
                    baseDir: path,
                    filename: fnameOnly,
                    content: testMarkdown,
                    encoding: 'utf8'
                }, (r) => {
                    if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
                    if (!r || r.ok === false) return reject(new Error(r?.error || 'Native host write failed'));
                    resolve(r);
                });
            });

            result.className = 'test-result success';
            result.textContent = `✅ ファイル保存に成功しました！「${resp.filePath}」に保存されました。`;

        } else {
            // Downloads APIで保存（相対パス）
            const filename = path ? `${path}/${fnameOnly}` : fnameOnly;
            chrome.downloads.download({
                url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(testMarkdown),
                filename: filename,
                saveAs: false
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    throw new Error(chrome.runtime.lastError.message);
                }
                
                result.className = 'test-result success';
                result.textContent = `✅ ファイル保存に成功しました！ダウンロードフォルダの「${filename}」に保存されました。`;
            });
        }
        
    } catch (error) {
        console.error('ReadLater for Obsidian: File save test failed', error);
        result.className = 'test-result error';
        result.textContent = `❌ ファイル保存テストに失敗しました: ${error.message}`;
    } finally {
        button.disabled = false;
        button.textContent = '💾 ファイル保存テスト';
    }
}

/**
 * 設定の保存
 */
async function saveSettings() {
    const button = elements.saveSettings;
    
    try {
        button.disabled = true;
        button.textContent = '💾 保存中...';
        
        // 入力値の取得と検証
        const settings = {
            obsidianPath: elements.obsidianPath.value.trim(),
            translationEnabled: elements.translationEnabled.checked,
            summaryEnabled: elements.summaryEnabled.checked,
            targetLanguage: elements.targetLanguage.value,
            fileNaming: elements.fileNaming.value,
            aggregatedSavingEnabled: elements.aggregatedSavingEnabled.checked,
            aggregatedFileName: elements.aggregatedFileName.value.trim()
        };
        
        // 基本的な検証
        if (!settings.obsidianPath) {
            throw new Error('保存先フォルダが入力されていません');
        }
        
        // 集約保存設定の検証
        if (settings.aggregatedSavingEnabled && !settings.aggregatedFileName) {
            throw new Error('集約ファイル名が入力されていません');
        }
        
        if (settings.aggregatedFileName && !settings.aggregatedFileName.endsWith('.md')) {
            settings.aggregatedFileName += '.md';
        }
        
        // APIキーは不要（ネイティブメッセージング利用のため）
        
        // 設定の保存
        await chrome.storage.sync.set({ readlaterSettings: settings });
        
        console.log('ReadLater for Obsidian: Settings saved', settings);
        showStatusMessage('設定が正常に保存されました！', 'success');
        
    } catch (error) {
        console.error('ReadLater for Obsidian: Error saving settings', error);
        showStatusMessage(`設定の保存に失敗しました: ${error.message}`, 'error');
    } finally {
        button.disabled = false;
        button.textContent = '💾 設定を保存';
    }
}

/**
 * 設定のリセット
 */
async function resetSettings() {
    if (!confirm('設定をデフォルトに戻しますか？この操作は取り消せません。')) {
        return;
    }
    
    const button = elements.resetSettings;
    
    try {
        button.disabled = true;
        button.textContent = '🔄 リセット中...';
        
        // デフォルト設定の保存
        await chrome.storage.sync.set({ readlaterSettings: defaultSettings });
        
        // フォームの更新
        await loadSettings();
        
        console.log('ReadLater for Obsidian: Settings reset to default');
        showStatusMessage('設定をデフォルトに戻しました', 'info');
        
    } catch (error) {
        console.error('ReadLater for Obsidian: Error resetting settings', error);
        showStatusMessage('設定のリセットに失敗しました', 'error');
    } finally {
        button.disabled = false;
        button.textContent = '🔄 デフォルトに戻す';
    }
}

/**
 * 現在の設定の検証
 */
function validateCurrentSettings() {
    const path = elements.obsidianPath.value.trim();
    const aggregatedSavingEnabled = elements.aggregatedSavingEnabled.checked;
    const aggregatedFileName = elements.aggregatedFileName.value.trim();
    
    let isValid = true;
    let message = '';
    
    // 必須項目の確認
    if (!path) {
        isValid = false;
        message = '保存先フォルダは必須です';
    }
    
    // 集約保存設定の確認
    if (aggregatedSavingEnabled && !aggregatedFileName) {
        isValid = false;
        message = '集約ファイル名は必須です';
    }
    
    // 保存ボタンの有効/無効切り替え
    elements.saveSettings.disabled = !isValid;
    
    return isValid;
}

/**
 * ステータスメッセージの表示
 * @param {string} message - メッセージ内容
 * @param {string} type - メッセージタイプ (success, error, info)
 */
function showStatusMessage(message, type = 'info') {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message ${type}`;
    elements.statusMessage.style.display = 'block';
    
    // 3秒後に自動で非表示
    setTimeout(() => {
        elements.statusMessage.style.display = 'none';
    }, 3000);
}

/**
 * 集約保存設定UIの状態更新
 */
function updateAggregatedSavingUI() {
    const isEnabled = elements.aggregatedSavingEnabled.checked;
    
    // 集約ファイル名入力フィールドの有効/無効切り替え
    elements.aggregatedFileName.disabled = !isEnabled;
    
    // 設定の検証を再実行
    validateCurrentSettings();
    
    console.log('ReadLater for Obsidian: Aggregated saving UI updated', { enabled: isEnabled });
}

// デバッグ用関数の公開
window.readlaterOptionsDebug = {
    loadSettings,
    saveSettings,
    resetSettings,
    validateCurrentSettings,
    updateAggregatedSavingUI
};
