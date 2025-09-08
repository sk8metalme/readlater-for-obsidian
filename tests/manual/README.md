# ReadLater for Obsidian - Claude CLI ローカルテスト

このディレクトリには、Claude CLI機能のローカルテスト用ファイルが含まれています。

## 📁 ファイル構成

- `claude-cli-local-test.js` - Claude CLI対応メイン機能テストスクリプト **（推奨）**
- `claude-local-test.js` - 旧Claude API版テストスクリプト（非推奨）
- `browser-test.html` - ブラウザ環境での統合テスト
- `performance-test.js` - パフォーマンステスト
- `README.md` - このファイル

## ⚠️ 重要な変更：Claude CLI対応

**Claude CLIはAPIキーが不要**です。ローカルにインストールされたClaude CLIを使用します。

## 🧪 テスト種類

### 1. オフラインテスト（APIキー不要）

言語検出機能など、外部API不要の機能をテストします。

```bash
node tests/manual/claude-local-test.js offline
```

### 2. Claude CLI完全機能テスト（APIキー不要）

ローカルのClaude CLIを使用した翻訳・要約機能を含む全機能をテストします。

```bash
# Claude CLI対応版（推奨）
node tests/manual/claude-cli-local-test.js

# Claude CLIがインストールされていない場合はオフラインモード
node tests/manual/claude-cli-local-test.js offline
```

### 3. 旧Claude API版テスト（非推奨）

```bash
# 環境変数で設定
export CLAUDE_API_KEY="sk-your-api-key-here"
node tests/manual/claude-local-test.js

# または引数で指定
node tests/manual/claude-local-test.js "sk-your-api-key-here"
```

### 4. ブラウザテスト

Webブラウザで直接テストできるHTMLページを提供します。

```bash
# ローカルサーバーを起動
python3 -m http.server 8000
# または
npx serve .

# ブラウザで開く
open http://localhost:8000/tests/manual/browser-test.html
```

### 5. パフォーマンステスト

言語検出機能のパフォーマンスを測定します。

```bash
node tests/manual/performance-test.js
```

## 📋 Claude CLIのインストール

Claude CLIが必要な場合は、以下からインストールしてください：

- **公式ドキュメント**: [https://docs.anthropic.com/ja/docs/claude-code/cli-reference](https://docs.anthropic.com/ja/docs/claude-code/cli-reference)
- **インストール後の確認**: `claude --version`

## 📊 最新テスト結果

### 言語検出精度テスト

| 言語 | 検出結果 | 信頼度 | 結果 |
|------|----------|--------|------|
| English | en | 0.95 | ✅ |
| 日本語 | ja | 0.90 | ✅ |
| 中文 | zh | 1.00 | ✅ |

### パフォーマンステスト結果

| テキスト長 | 平均処理時間 | 処理速度 |
|------------|--------------|----------|
| 50文字 | 0.25ms | 188,702 文字/秒 |
| 200文字 | 0.05ms | 3,757,656 文字/秒 |
| 1000文字 | 0.23ms | 4,601,865 文字/秒 |

### 並行処理性能

| 並行度 | スループット |
|--------|--------------|
| 1 | 6,734 タスク/秒 |
| 5 | 16,034 タスク/秒 |
| 10 | 11,933 タスク/秒 |
| 20 | 10,390 タスク/秒 |

### メモリ使用量

- **初期メモリ**: 4.79 MB
- **最終メモリ**: 4.27 MB
- **メモリ増加**: -0.52 MB (効率的なメモリ管理)

## 🎯 品質基準

以下の基準を満たしています：

- ✅ **言語検出精度**: 3言語で100%成功
- ✅ **処理速度**: 全テストケースで1ms以下
- ✅ **メモリ効率**: メモリリークなし
- ✅ **並行処理**: 最大16,000タスク/秒
- ✅ **エラー処理**: 全エラーケースで適切な処理

## 🔧 トラブルシューティング

### よくある問題

1. **APIキーエラー**
   - 正しいフォーマット（sk-で始まる）か確認
   - 有効期限が切れていないか確認

2. **ネットワークエラー**
   - インターネット接続を確認
   - ファイアウォール設定を確認

3. **ブラウザテストが動かない**
   - CORS制限により、ローカルサーバーが必要
   - `npx serve .` でサーバーを起動

## 📝 テスト追加方法

新しいテストケースを追加する場合：

1. `claude-local-test.js`のsampleArticlesに追加
2. 期待される結果を設定
3. テストメソッドを更新
4. READMEの結果表を更新

## 🔄 継続的テスト

このテストスイートは開発中の品質確保に使用されます：

- 新機能追加時の回帰テスト
- パフォーマンス劣化の検出
- APIの動作確認
- ブラウザ互換性の確認
