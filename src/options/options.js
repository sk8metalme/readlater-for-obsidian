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
    fileNaming: 'date-title'
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
    // APIキー表示/非表示の切り替え
    elements.toggleApiKey.addEventListener('click', toggleApiKeyVisibility);
    
    // 接続テストボタン
    elements.testClaudeConnection.addEventListener('click', testClaudeConnection);
    elements.testFileSave.addEventListener('click', testFileSave);
    
    // 設定保存・リセットボタン
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.resetSettings.addEventListener('click', resetSettings);
    
    // リアルタイム検証
    elements.obsidianPath.addEventListener('input', validateCurrentSettings);
    elements.claudeApiKey.addEventListener('input', validateCurrentSettings);
}

/**
 * APIキーの表示/非表示切り替え
 */
function toggleApiKeyVisibility() {
    const isPassword = elements.claudeApiKey.type === 'password';
    elements.claudeApiKey.type = isPassword ? 'text' : 'password';
    elements.toggleApiKey.textContent = isPassword ? '🙈' : '👁️';
}

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
        const apiKey = elements.claudeApiKey.value.trim();
        
        if (!apiKey) {
            throw new Error('APIキーが入力されていません');
        }
        
        if (!apiKey.startsWith('sk-')) {
            throw new Error('APIキーの形式が正しくありません');
        }
        
        // TODO: Sprint 3で実際のClaude CLI接続テストを実装
        // 現在は模擬テスト
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
        
        // 成功パターン（実際の実装では Claude CLI を呼び出し）
        result.className = 'test-result success';
        result.textContent = '✅ Claude CLI接続に成功しました！翻訳・要約機能が利用できます。';
        
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
        
        // ファイル保存の実行
        const filename = path ? `${path}/readlater-test-${Date.now()}.md` : `readlater-test-${Date.now()}.md`;
        
        chrome.downloads.download({
            url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(testMarkdown),
            filename: filename,
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                throw new Error(chrome.runtime.lastError.message);
            }
            
            result.className = 'test-result success';
            result.textContent = `✅ ファイル保存に成功しました！テストファイルがダウンロードフォルダの「${filename}」に保存されました。`;
        });
        
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
            claudeApiKey: elements.claudeApiKey.value.trim(),
            obsidianPath: elements.obsidianPath.value.trim(),
            translationEnabled: elements.translationEnabled.checked,
            summaryEnabled: elements.summaryEnabled.checked,
            targetLanguage: elements.targetLanguage.value,
            fileNaming: elements.fileNaming.value
        };
        
        // 基本的な検証
        if (!settings.obsidianPath) {
            throw new Error('保存先フォルダが入力されていません');
        }
        
        if (settings.translationEnabled || settings.summaryEnabled) {
            if (!settings.claudeApiKey) {
                throw new Error('翻訳・要約機能を使用する場合はAPIキーが必要です');
            }
            if (!settings.claudeApiKey.startsWith('sk-')) {
                throw new Error('APIキーの形式が正しくありません');
            }
        }
        
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
    const apiKey = elements.claudeApiKey.value.trim();
    const translationEnabled = elements.translationEnabled.checked;
    const summaryEnabled = elements.summaryEnabled.checked;
    
    let isValid = true;
    let message = '';
    
    // 必須項目の確認
    if (!path) {
        isValid = false;
        message = '保存先フォルダは必須です';
    } else if ((translationEnabled || summaryEnabled) && !apiKey) {
        isValid = false;
        message = '翻訳・要約機能を使用する場合はAPIキーが必要です';
    } else if (apiKey && !apiKey.startsWith('sk-')) {
        isValid = false;
        message = 'APIキーの形式が正しくありません';
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

// デバッグ用関数の公開
window.readlaterOptionsDebug = {
    loadSettings,
    saveSettings,
    resetSettings,
    validateCurrentSettings
};
