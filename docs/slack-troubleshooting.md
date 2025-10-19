# Slack通知 トラブルシューティングガイド

## 403 Forbidden エラー

### エラーメッセージ
```
ReadLater for Obsidian: Failed to send Slack notification 
Error: Slack API returned 403 (Forbidden)
```

### 原因

403エラーは以下の理由で発生します：

#### 1. Webhook URLが無効または期限切れ

**確認方法:**
```bash
# curlでWebhook URLをテスト
curl -X POST YOUR_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"テストメッセージ"}'
```

**解決策:**
1. Slack Appの管理画面を開く: https://api.slack.com/apps
2. 該当のアプリを選択
3. 「Incoming Webhooks」セクションを確認
4. Webhookが「Active」になっているか確認
5. 新しいWebhook URLを再生成

#### 2. Webhook URLが削除された

**解決策:**
1. Slackワークスペースの管理者に確認
2. アプリが削除されていないか確認
3. 必要に応じて新しいIncoming Webhookを作成

#### 3. ワークスペースの権限設定

**確認項目:**
- ワークスペースでIncoming Webhooksが許可されているか
- アプリがチャンネルに投稿する権限があるか

**解決策:**
1. Slackワークスペース管理画面を開く
2. 「設定と管理」→「ワークスペースの設定」
3. 「権限」タブで「アプリ」の設定を確認

#### 4. URLのコピーミス

**確認方法:**
```javascript
// DevToolsのConsoleで確認
chrome.storage.sync.get(['readlaterSettings'], (result) => {
  console.log('Webhook URL:', result.readlaterSettings.slackWebhookUrl);
});
```

**よくある間違い:**
- ❌ URLの一部がコピーされていない
- ❌ 前後に空白が入っている
- ❌ `https://hooks.slack.com/` で始まっていない

**解決策:**
1. Slackの管理画面からWebhook URLを再コピー
2. 拡張機能の設定画面で再設定
3. 前後の空白を削除

## 新しいWebhook URLの作成方法

### ステップ1: Slack Appの作成

1. https://api.slack.com/apps にアクセス
2. 「Create New App」をクリック
3. 「From scratch」を選択
4. アプリ名を入力（例: ReadLater Notifications）
5. ワークスペースを選択
6. 「Create App」をクリック

### ステップ2: Incoming Webhooksの有効化

1. 左サイドバーの「Incoming Webhooks」をクリック
2. 「Activate Incoming Webhooks」をONにする
3. 「Add New Webhook to Workspace」をクリック
4. 通知を送信するチャンネルを選択
5. 「許可する」をクリック

### ステップ3: Webhook URLをコピー

1. 生成されたWebhook URLをコピー
   ```
   https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
   ```
2. ReadLater for Obsidianの設定画面に貼り付け

## その他のエラー

### 400 Bad Request

**原因:** メッセージの形式が正しくない

**解決策:**
- 現在のバージョンではシンプルなテキスト形式を使用しているため、通常は発生しません
- DevToolsのConsoleで詳細なエラーメッセージを確認

### 404 Not Found

**原因:** Webhook URLが存在しない

**解決策:**
1. Webhook URLを再確認
2. 新しいWebhook URLを作成

### ネットワークエラー

**エラーメッセージ:**
```
TypeError: Failed to fetch
```

**原因:**
- インターネット接続の問題
- ファイアウォールやプロキシの設定
- Slackのサーバーダウン

**解決策:**
1. インターネット接続を確認
2. 他のWebサイトにアクセスできるか確認
3. Slackのステータスページを確認: https://status.slack.com/

## デバッグ方法

### 1. DevToolsでログを確認

```javascript
// Service WorkerのDevToolsを開く
chrome://extensions/ → Service Workerを検査

// 期待されるログ
ReadLater for Obsidian: Sending Slack notification
ReadLater for Obsidian: Sending Slack message { format: 'simple', messageLength: 123 }
ReadLater for Obsidian: Slack notification sent successfully

// エラーの場合
ReadLater for Obsidian: Slack API error details
{
  status: 403,
  statusText: 'Forbidden',
  responseBody: 'invalid_token',
  webhookUrl: 'https://hooks.slack.com/services/T000...'
}
```

### 2. curlでテスト

```bash
# シンプルなメッセージ
curl -X POST YOUR_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"テストメッセージ"}'

# 成功時のレスポンス
ok

# 失敗時のレスポンス（例）
invalid_token
```

### 3. Webhook URLの検証

```bash
# URLの形式チェック
echo "YOUR_WEBHOOK_URL" | grep -E '^https://hooks\.slack\.com/services/'

# 出力がある場合: 形式は正しい
# 出力がない場合: 形式が間違っている
```

## チェックリスト

問題解決のための確認項目：

- [ ] Webhook URLが `https://hooks.slack.com/services/` で始まっている
- [ ] Webhook URLに余分な空白や改行が含まれていない
- [ ] Slack AppのIncoming Webhooksが「Active」になっている
- [ ] Webhookが削除されていない
- [ ] ワークスペースでアプリの使用が許可されている
- [ ] 投稿先のチャンネルが存在する
- [ ] インターネット接続が正常
- [ ] 拡張機能が最新版にアップデートされている

## サポート

上記の方法で解決しない場合：

1. DevToolsのConsoleログ全体をコピー
2. Webhook URLの最初の50文字（例: `https://hooks.slack.com/services/T00000000/B00...`）
3. 発生しているエラーの詳細

これらの情報を添えて、GitHubのIssuesに報告してください。

---

**最終更新**: 2025-10-14


