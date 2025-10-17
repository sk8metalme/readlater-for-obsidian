#!/bin/bash

# Claude CLI と Native Host の診断スクリプト

echo "============================================"
echo "ReadLater for Obsidian - Claude診断ツール"
echo "============================================"
echo ""

# 1. Claude CLIの確認
echo "1. Claude CLIの確認"
echo "-------------------"
if command -v claude &> /dev/null; then
    echo "✅ Claude CLIが見つかりました"
    CLAUDE_VERSION=$(claude --version 2>&1 || echo "バージョン取得失敗")
    echo "   バージョン: $CLAUDE_VERSION"
    echo ""
    
    # シンプルなテスト
    echo "   テスト実行中..."
    TEST_OUTPUT=$(echo "こんにちは" | claude -p "この文章を英語に翻訳してください" 2>&1)
    if [ $? -eq 0 ]; then
        echo "✅ Claude CLIは正常に動作しています"
        echo "   出力: ${TEST_OUTPUT:0:50}..."
    else
        echo "❌ Claude CLIの実行に失敗しました"
        echo "   エラー: $TEST_OUTPUT"
    fi
else
    echo "❌ Claude CLIが見つかりません"
    echo ""
    echo "   インストール方法:"
    echo "   npm install -g @anthropic-ai/claude-cli"
    echo ""
    exit 1
fi

echo ""
echo "2. Node.jsの確認"
echo "-------------------"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.jsが見つかりません"
    exit 1
fi

echo ""
echo "3. Native Hostの確認"
echo "-------------------"

NATIVE_HOST_PATH="native_host/claude_host.js"
if [ -f "$NATIVE_HOST_PATH" ]; then
    echo "✅ Native Hostファイルが存在します"
    echo "   パス: $(pwd)/$NATIVE_HOST_PATH"
    
    # 実行権限の確認
    if [ -x "$NATIVE_HOST_PATH" ]; then
        echo "✅ 実行権限あり"
    else
        echo "⚠️  実行権限がありません"
        echo "   修正: chmod +x $NATIVE_HOST_PATH"
    fi
    
    # テスト実行
    echo ""
    echo "   Native Hostテスト実行中..."
    TEST_RESULT=$(echo '{"type":"check"}' | node "$NATIVE_HOST_PATH" 2>&1 | tail -c +5)
    if [ $? -eq 0 ]; then
        echo "✅ Native Hostは正常に応答しました"
        echo "   応答: $TEST_RESULT"
    else
        echo "❌ Native Hostの実行に失敗しました"
        echo "   エラー: $TEST_RESULT"
    fi
else
    echo "❌ Native Hostファイルが見つかりません"
    exit 1
fi

echo ""
echo "4. Native Host マニフェストの確認"
echo "-------------------"

MANIFEST_PATH="native_host/com.readlater.claude_host.json"
if [ -f "$MANIFEST_PATH" ]; then
    echo "✅ マニフェストファイルが存在します"
    
    # パスの確認
    MANIFEST_CONTENT=$(cat "$MANIFEST_PATH")
    echo "   内容:"
    echo "$MANIFEST_CONTENT" | head -5
    
    # インストール先の確認
    if [ "$(uname)" = "Darwin" ]; then
        INSTALL_PATH="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.readlater.claude_host.json"
    else
        INSTALL_PATH="$HOME/.config/google-chrome/NativeMessagingHosts/com.readlater.claude_host.json"
    fi
    
    if [ -f "$INSTALL_PATH" ]; then
        echo "✅ Native Hostはインストール済みです"
        echo "   場所: $INSTALL_PATH"
    else
        echo "⚠️  Native Hostがインストールされていません"
        echo "   インストール方法:"
        echo "   node scripts/install-native-host.js"
    fi
else
    echo "❌ マニフェストファイルが見つかりません"
fi

echo ""
echo "5. Chrome拡張機能の状態"
echo "-------------------"
echo "以下を確認してください:"
echo "  1. chrome://extensions/ を開く"
echo "  2. 開発者モードをONにする"
echo "  3. ReadLater for Obsidianの「Service Workerを検査」をクリック"
echo "  4. Consoleで以下のコマンドを実行:"
echo ""
echo "     chrome.runtime.sendNativeMessage('com.readlater.claude_host', {type:'check'}, console.log)"
echo ""
echo "  期待される出力:"
echo "     {ok: true, available: true, version: '...', message: 'Claude CLI available'}"
echo ""

echo ""
echo "============================================"
echo "診断完了"
echo "============================================"
echo ""
echo "問題が見つかった場合:"
echo "  1. Claude CLIをインストール: npm install -g @anthropic-ai/claude-cli"
echo "  2. Native Hostをインストール: node scripts/install-native-host.js"
echo "  3. Chrome拡張機能を再読み込み"
echo "  4. 上記の手順5でChrome拡張機能の状態を確認"
echo ""



