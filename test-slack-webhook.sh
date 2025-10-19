#!/bin/bash

# Slack Webhook URLのテストスクリプト
# 使用方法: ./test-slack-webhook.sh YOUR_WEBHOOK_URL

if [ -z "$1" ]; then
    echo "エラー: Webhook URLを引数として指定してください"
    echo "使用方法: $0 YOUR_WEBHOOK_URL"
    echo ""
    echo "例:"
    echo "  $0 https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"
    exit 1
fi

WEBHOOK_URL="$1"

echo "========================================"
echo "Slack Webhook URL テスト"
echo "========================================"
echo ""
echo "Webhook URL: ${WEBHOOK_URL:0:50}..."
echo ""

# URLの形式チェック
if [[ ! "$WEBHOOK_URL" =~ ^https://hooks\.slack\.com/services/ ]]; then
    echo "❌ エラー: Webhook URLの形式が正しくありません"
    echo "   URLは https://hooks.slack.com/services/ で始まる必要があります"
    exit 1
fi

echo "✅ Webhook URLの形式は正しいです"
echo ""
echo "テストメッセージを送信中..."
echo ""

# curlでテストメッセージを送信
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d '{"text":"📖 ReadLater for Obsidian - Webhook テスト\n\nこのメッセージが表示されれば、Webhook URLは正常に動作しています。"}')

# HTTPステータスコードを取得
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "HTTPステータスコード: $HTTP_STATUS"
echo "レスポンスボディ: $BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ] && [ "$BODY" = "ok" ]; then
    echo "========================================"
    echo "✅ 成功！Webhook URLは正常に動作しています"
    echo "========================================"
    echo ""
    echo "Slackのチャンネルを確認してください。"
    echo "テストメッセージが表示されているはずです。"
    exit 0
elif [ "$HTTP_STATUS" = "403" ]; then
    echo "========================================"
    echo "❌ 403 Forbidden エラー"
    echo "========================================"
    echo ""
    echo "原因:"
    echo "  - Webhook URLが無効または期限切れ"
    echo "  - Webhook URLが削除された"
    echo "  - ワークスペースの権限設定"
    echo ""
    echo "解決策:"
    echo "  1. https://api.slack.com/apps でアプリを確認"
    echo "  2. Incoming Webhooksが 'Active' になっているか確認"
    echo "  3. 新しいWebhook URLを生成"
    echo "  4. 拡張機能の設定画面で新しいURLを設定"
    exit 1
elif [ "$HTTP_STATUS" = "404" ]; then
    echo "========================================"
    echo "❌ 404 Not Found エラー"
    echo "========================================"
    echo ""
    echo "Webhook URLが存在しません。"
    echo "URLを再確認するか、新しいWebhookを作成してください。"
    exit 1
else
    echo "========================================"
    echo "❌ エラー: HTTP $HTTP_STATUS"
    echo "========================================"
    echo ""
    echo "予期しないエラーが発生しました。"
    echo "レスポンス: $BODY"
    exit 1
fi


