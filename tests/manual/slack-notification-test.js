/**
 * Slack通知機能のテストスクリプト
 * 
 * 実行方法：
 * 1. SLACK_WEBHOOK_URL環境変数にWebhook URLを設定
 * 2. node tests/manual/slack-notification-test.js
 */

// Slack通知送信関数（service-worker.jsからコピー）
async function sendSlackNotification(title, url, webhookUrl) {
    if (!webhookUrl) {
        console.error('❌ Slack Webhook URLが設定されていません');
        return false;
    }
    
    try {
        console.log('📤 Slackに通知を送信中...');
        console.log('  タイトル:', title);
        console.log('  URL:', url);
        
        // Slackメッセージの構築
        const message = {
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
        
        // Slack Webhook URLにPOSTリクエストを送信
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
        });
        
        if (!response.ok) {
            throw new Error(`Slack API returned ${response.status}: ${response.statusText}`);
        }
        
        console.log('✅ Slack通知の送信に成功しました');
        return true;
        
    } catch (error) {
        console.error('❌ Slack通知の送信に失敗しました:', error.message);
        return false;
    }
}

// テスト実行
async function runTest() {
    console.log('=== Slack通知機能テスト ===\n');
    
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!webhookUrl) {
        console.error('❌ エラー: SLACK_WEBHOOK_URL環境変数が設定されていません');
        console.log('\n使用方法:');
        console.log('  export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"');
        console.log('  node tests/manual/slack-notification-test.js');
        process.exit(1);
    }
    
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
        console.error('❌ エラー: Webhook URLの形式が正しくありません');
        console.log('  Webhook URLは https://hooks.slack.com/ で始まる必要があります');
        process.exit(1);
    }
    
    console.log('✅ Webhook URL: ' + webhookUrl.substring(0, 40) + '...\n');
    
    // テストケース1: 通常の記事
    console.log('--- テスト1: 通常の記事 ---');
    const success1 = await sendSlackNotification(
        'Slack通知機能のテスト記事',
        'https://example.com/test-article',
        webhookUrl
    );
    
    if (!success1) {
        process.exit(1);
    }
    
    console.log('');
    
    // テストケース2: 長いタイトル
    console.log('--- テスト2: 長いタイトル ---');
    const success2 = await sendSlackNotification(
        'これは非常に長いタイトルのテストです。タイトルが長い場合でも正しく表示されることを確認します。日本語の文字列が正しくエンコードされているかもチェックします。',
        'https://example.com/long-title-article',
        webhookUrl
    );
    
    if (!success2) {
        process.exit(1);
    }
    
    console.log('');
    
    // テストケース3: 特殊文字を含むタイトル
    console.log('--- テスト3: 特殊文字を含むタイトル ---');
    const success3 = await sendSlackNotification(
        'テスト記事: "特殊文字" & <タグ> | パイプ',
        'https://example.com/special-chars?param=value&test=123',
        webhookUrl
    );
    
    if (!success3) {
        process.exit(1);
    }
    
    console.log('\n=== すべてのテストが完了しました ===');
    console.log('✅ Slackのチャンネルを確認してください');
}

// Node.js環境でfetchを使用するための設定
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

runTest().catch(error => {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    process.exit(1);
});


