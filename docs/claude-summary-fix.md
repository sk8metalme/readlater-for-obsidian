# Claude要約機能の修正

## 問題の特定

### 発見された問題

Claude要約機能が動作しない問題を調査した結果、**Native Hostのメッセージ読み取り処理**にバグがありました：

```
RangeError [ERR_OUT_OF_RANGE]: The value of "size" is out of range. 
It must be <= 1GiB. Received 2037654139
```

### 根本原因

`claude_host.js`の`readMessage()`関数で、メッセージ長の検証が不足していたため、異常な値を受け取った時にエラーが発生していました。

## 実施した修正

### 1. Native Host (`native_host/claude_host.js`)

#### メッセージ長の検証を追加

```javascript
// Validate message length (max 10MB for safety)
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024; // 10MB
if (len === 0 || len > MAX_MESSAGE_SIZE) {
    console.error(`[claude_host] Invalid message length: ${len}`);
    return resolve(null);
}
```

#### 小さなチャンクで読み取り

```javascript
// Read in smaller chunks (65KB at a time)
const chunk = process.stdin.read(Math.min(remaining, 65536));
```

#### エラーログの追加

```javascript
console.error(`[claude_host] JSON parse error:`, e.message);
```

### 2. Service Worker (`src/background/service-worker.js`)

#### 詳細なデバッグログを追加

要約処理の各ステップでログを出力：

```javascript
console.log('ReadLater for Obsidian: Starting summarization', {
    contentLength: articleData.content?.length || 0,
    language: result.detectedLanguage
});

console.log('ReadLater for Obsidian: Using chunked summarization', {
    totalLength: base.length,
    chunkSize: CHUNK_SIZE_SUM
});

console.log(`ReadLater for Obsidian: Summarizing chunk ${i}/${chunks.length}`, {
    chunkLength: ch.length
});
```

#### 空コンテンツのチェック

```javascript
if (base.length === 0) {
    console.warn('ReadLater for Obsidian: No content to summarize');
    throw new Error('Empty content for summarization');
}
```

### 3. 診断ツール (`diagnose-claude.sh`)

Claude CLIとNative Hostの状態を確認するスクリプトを追加：

- ✅ Claude CLIのインストール確認
- ✅ Claude CLIの動作テスト
- ✅ Node.jsのバージョン確認
- ✅ Native Hostの実行権限確認
- ✅ Native Hostの応答テスト
- ✅ マニフェストファイルの確認

## テスト方法

### ステップ1: 拡張機能をリロード

```
chrome://extensions/ 
→ ReadLater for Obsidian 
→ 「更新」ボタンをクリック
```

### ステップ2: DevToolsを開く

```
chrome://extensions/ 
→ ReadLater for Obsidian 
→ 「Service Workerを検査」をクリック
→ Consoleタブを選択
```

### ステップ3: 記事を保存してログを確認

任意のWebページで右クリック → 「後で読む（ReadLater）」を選択

#### 期待されるログ（成功時）

```javascript
ReadLater for Obsidian: Starting AI processing via Native Host
ReadLater for Obsidian: Starting summarization {contentLength: 5234, language: 'ja'}

// 長い記事の場合
ReadLater for Obsidian: Using chunked summarization {totalLength: 5234, chunkSize: 2000}
ReadLater for Obsidian: Processing 3 chunks
ReadLater for Obsidian: Summarizing chunk 1/3 {chunkLength: 2000}
ReadLater for Obsidian: Chunk 1 summarized {summaryLength: 280}
ReadLater for Obsidian: Summarizing chunk 2/3 {chunkLength: 2000}
ReadLater for Obsidian: Chunk 2 summarized {summaryLength: 280}
ReadLater for Obsidian: Summarizing chunk 3/3 {chunkLength: 1234}
ReadLater for Obsidian: Chunk 3 summarized {summaryLength: 210}
ReadLater for Obsidian: Combining partial summaries {partialCount: 3, combinedLength: 770}
ReadLater for Obsidian: Final summary generated {finalLength: 450}

// 短い記事の場合
ReadLater for Obsidian: Using single-pass summarization {contentLength: 1234}
ReadLater for Obsidian: Summary generated {summaryLength: 320}

// キーワード抽出
ReadLater for Obsidian: Extracting keywords
ReadLater for Obsidian: Keywords extracted {keywordCount: 8, keywords: ['AI', '機械学習', ...]}

ReadLater for Obsidian: Summarization completed successfully
```

#### エラー時のログ

```javascript
ReadLater for Obsidian: Summarization via native host failed Error: ...
ReadLater for Obsidian: Error details {
    errorName: 'Error',
    errorMessage: 'Native host error',
    errorStack: '...'
}
```

### ステップ4: 診断スクリプトの実行（オプション）

```bash
cd /Users/arigatatsuya/Work/git/readlater-for-obsidian
./diagnose-claude.sh
```

## トラブルシューティング

### 問題1: Native Hostに接続できない

**症状:**
```
Error: Native host error
Error: Native bridge not available
```

**解決策:**
```bash
# Native Hostを再インストール
node scripts/install-native-host.js --apply --ext-id YOUR_EXTENSION_ID

# 拡張機能IDの確認方法
cat "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.readlater.claude_host.json" | grep allowed_origins
```

### 問題2: Claude CLIが見つからない

**症状:**
```
Claude CLI not found
```

**解決策:**
```bash
# Claude CLIのインストール
npm install -g @anthropic-ai/claude-cli

# インストール確認
claude --version
```

### 問題3: 要約が空または短すぎる

**症状:**
- 要約が生成されない
- 要約が極端に短い

**確認事項:**
1. DevToolsのConsoleで要約処理のログを確認
2. `summaryLength`の値を確認
3. 記事のコンテンツ長を確認（`contentLength`）

**解決策:**
```javascript
// Chrome拡張機能の設定を確認
chrome.storage.sync.get(['readlaterSettings'], (result) => {
    console.log('Settings:', result.readlaterSettings);
    // summaryEnabled が true であることを確認
    // summaryLength を確認（デフォルト: 500）
});
```

### 問題4: タイムアウトエラー

**症状:**
```
Error: Native host timeout
```

**原因:**
- 記事が長すぎる
- Claude CLIの応答が遅い

**解決策:**
- 現在のタイムアウト設定：
  - チャンク要約: 180秒
  - 最終要約: 240秒
  - キーワード抽出: 90秒

これらは`native-messaging.js`と`claude_host.js`で調整可能です。

## 変更履歴

- **2025-10-14**: Native Hostのメッセージ長検証を追加
- **2025-10-14**: 詳細なデバッグログを追加
- **2025-10-14**: 診断スクリプト（`diagnose-claude.sh`）を追加

## 参考情報

### 関連ファイル

- `native_host/claude_host.js` - Native Host本体
- `src/lib/native-messaging.js` - Native Messaging Bridge
- `src/background/service-worker.js` - Service Worker（要約処理）
- `diagnose-claude.sh` - 診断スクリプト

### Chrome拡張機能のNative Messaging

- [Chrome Native Messaging ドキュメント](https://developer.chrome.com/docs/apps/nativeMessaging/)
- [Manifest V3 ガイド](https://developer.chrome.com/docs/extensions/mv3/intro/)

---

**作成日**: 2025-10-14  
**コミット**: 419d238


