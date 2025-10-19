# ReadLater for Obsidian - Slack通知機能のテスト手順

## 前提条件

1. Chrome拡張機能がインストールされている
2. Slack Incoming Webhookが作成済み（[こちら](https://api.slack.com/messaging/webhooks)から作成）

## テスト手順

### 1. 拡張機能の設定

1. Chromeで `chrome://extensions/` を開く
2. 「開発者モード」をONにする
3. 「ReadLater for Obsidian」の「詳細」をクリック
4. 「拡張機能のオプション」をクリック
5. 以下を設定：
   - ✅ **Slack通知を有効にする** をチェック
   - 📝 **Slack Webhook URL** を入力（例: `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`）
   - ⚠️ **集約保存を有効にする** は**チェックを外す**（個別保存モード）
6. 「設定を保存」をクリック

### 2. Service WorkerのDevToolsを開く

1. `chrome://extensions/` に戻る
2. 「ReadLater for Obsidian」の「Service Workerを検査」をクリック
3. DevToolsが開きます
4. **Consoleタブ**を選択

### 3. テストページで記事保存をテスト

1. ブラウザで以下のURLを開く：
   ```
   file:///Users/arigatatsuya/Work/git/readlater-for-obsidian/tests/manual/slack-test.html
   ```

2. ページ上で**右クリック**

3. **「後で読む（ReadLater）」**を選択

4. DevToolsのConsoleで以下のログを確認：

   ```javascript
   ✅ 期待されるログ:
   
   ReadLater for Obsidian: Context menu clicked readlater-save-article
   ReadLater for Obsidian: Starting article save process
   ReadLater for Obsidian: Article extraction successful
   ReadLater for Obsidian: Processing extracted article
   ReadLater for Obsidian: Starting AI processing via Native Host
   ReadLater for Obsidian: Using individual saving mode
   ReadLater for Obsidian: Sending Slack notification {title: "...", url: "..."}
   ReadLater for Obsidian: Slack notification sent successfully
   ReadLater for Obsidian: Notification created
   ```

5. **Slackのチャンネル**を確認：
   - 📖 「記事を保存しました」というメッセージが届く
   - タイトルとURLが表示される
   - 保存日時が表示される

### 4. エラー時の確認

もし通知が送信されない場合、Consoleで以下を確認：

```javascript
❌ エラーの例:

// 設定が無効な場合
ReadLater for Obsidian: Slack notification skipped (disabled or no webhook URL)

// Webhook URLが無効な場合
ReadLater for Obsidian: Failed to send Slack notification
Error: Slack API returned 404: Not Found

// ネットワークエラーの場合
ReadLater for Obsidian: Failed to send Slack notification
TypeError: Failed to fetch
```

## トラブルシューティング

### 問題1: 通知が送信されない

**原因と解決策:**

1. **Slack通知が無効**
   - 設定画面で「Slack通知を有効にする」をチェック

2. **Webhook URLが未設定または無効**
   - 設定画面でWebhook URLを確認
   - URLが `https://hooks.slack.com/` で始まることを確認

3. **集約保存モードになっている**
   - 設定画面で「集約保存を有効にする」のチェックを外す
   - Slack通知は個別保存モードでのみ動作します

4. **ネットワークエラー**
   - インターネット接続を確認
   - ファイアウォール設定を確認

### 問題2: 記事は保存されるが通知が届かない

**原因:**
- Slack通知の失敗は記事保存を妨げません（仕様）

**確認事項:**
1. DevToolsのConsoleでSlack通知のエラーを確認
2. Webhook URLが正しいか確認
3. SlackのIncoming Webhookが有効か確認

### 問題3: DevToolsが開けない

**解決策:**
1. `chrome://extensions/` を開く
2. 拡張機能の「削除」→「再読み込み」
3. 「Service Workerを検査」をクリック

## 期待される動作

### 正常なフロー

```
1. ユーザーが右クリック → 「後で読む」を選択
2. 記事が抽出される
3. AI処理（要約）が実行される
4. Markdownファイルが保存される
5. ✅ Slackに通知が送信される
6. Chrome通知が表示される
```

### Slack通知の内容

```
📖 記事を保存しました

タイトル:
[記事のタイトル]

URL:
[記事のURL]（クリック可能）

保存日時: 2025/10/14 22:34:56
```

## 追加のテストケース

### テストケース1: 長いタイトル

```
タイトル: これは非常に長いタイトルのテストです。タイトルが長い場合でも正しく表示されることを確認します...
```

### テストケース2: 特殊文字を含むタイトル

```
タイトル: テスト記事: "特殊文字" & <タグ> | パイプ
```

### テストケース3: 日本語と英語の混在

```
タイトル: ReadLater Test 記事 - Slack通知機能のテスト
```

## コマンドラインでのテスト

Node.jsでSlack通知をテストすることもできます：

```bash
# node-fetchをインストール（必要な場合）
npm install node-fetch

# Webhook URLを環境変数に設定
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# テストを実行
node tests/manual/slack-notification-test.js
```

## ログの見方

### 成功時のログパターン

```
✅ 記事保存プロセス開始
✅ 記事抽出成功
✅ AI処理開始
✅ Markdown生成
✅ ファイル保存成功
✅ Slack通知送信中...
✅ Slack通知送信成功
```

### 失敗時のログパターン

```
✅ 記事保存プロセス開始
✅ 記事抽出成功
✅ AI処理開始
✅ Markdown生成
✅ ファイル保存成功
❌ Slack通知送信失敗: Error: Slack API returned 404
⚠️ Article saved successfully despite Slack notification failure
```

## まとめ

- Slack通知は**個別保存モードでのみ**動作します
- 通知の失敗は記事保存を妨げません
- DevToolsのConsoleで詳細なログを確認できます
- テストページを使用して簡単にテストできます

---

**作成日**: 2025-10-14  
**関連ファイル**:
- `src/background/service-worker.js` - Slack通知実装
- `src/options/options.html` - Slack設定UI
- `src/options/options.js` - Slack設定処理
- `tests/manual/slack-test.html` - テストページ
- `tests/manual/slack-notification-test.js` - コマンドラインテスト


