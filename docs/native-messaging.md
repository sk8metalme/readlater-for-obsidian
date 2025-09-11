# ネイティブメッセージング導入ガイド（Claude CLI 連携）

この拡張機能は Chrome のネイティブメッセージングを用いてローカルの `claude` CLI を呼び出します。

## 構成

- 拡張 → `chrome.runtime.sendNativeMessage('com.readlater.claude_host', …)`
- ネイティブホスト（Node.js）: `native_host/claude_host.js`
- ホストマニフェスト: `native_host/com.readlater.claude_host.json`

## 事前条件

- Claude CLI がローカルにインストール済みで `claude --version` が通ること
- Node.js 16+（ホストスクリプト実行用）

## インストール手順（macOS）

1) ホストスクリプトのパス確認

```
pwd  # リポジトリのルート
node native_host/claude_host.js  # 実行可能にするなら chmod +x も付与
```

2) ホストマニフェストの `path` を絶対パスに修正

```
native_host/com.readlater.claude_host.json
  "path": "/ABSOLUTE/PATH/TO/claude_host.js" → 実際の絶対パスに変更
```

3) ホストマニフェスト設置（ユーザー領域）

```
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
cp native_host/com.readlater.claude_host.json \
   ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
```

4) `allowed_origins` の拡張IDを書き換え

- 拡張を「パッケージ化されていない拡張機能」として読み込んだ後、拡張IDを確認し、
  `chrome-extension://YOUR_EXTENSION_ID/` に置き換えます。

5) 実行権限

```
chmod +x native_host/claude_host.js
```

## Windows

- ホストマニフェスト配置: レジストリ `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.readlater.claude_host` に `Default` 値で JSON の絶対パスを登録。
- JSON は `%USERPROFILE%\AppData\Local\Google\Chrome\User Data\NativeMessagingHosts\` などに配置。

## Linux

```
mkdir -p ~/.config/google-chrome/NativeMessagingHosts/
cp native_host/com.readlater.claude_host.json ~/.config/google-chrome/NativeMessagingHosts/
```

## 動作確認

1) 拡張のオプションページで「🤖 Claude CLI接続テスト」をクリック
2) 成功時: 「ネイティブホスト接続OK（バージョン表示）」

## トラブルシュート

- 「Host not found」: マニフェストの `path` と配置場所、権限、拡張IDの `allowed_origins` を確認
- 「Native host timeout」: CLI の応答が遅延。記事テキストが大きい場合は分割を検討
- 「Claude CLI not found」: `claude --version` が実行できるよう PATH を調整

## セキュリティ注意

- ホストは `claude` 以外の任意コマンド実行を行わない実装です（`native_host/claude_host.js` を参照）。
- 受け取る JSON を信頼しない前提で、追加のバリデーションを行っています。

