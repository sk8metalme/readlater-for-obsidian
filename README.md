# ReadLater for Obsidian

Web記事を効率的に保存し、Claude CLIによるAI翻訳・要約機能でObsidianに統合できるChrome拡張機能です。

## 🚀 機能

### MVP機能
- **コンテキストメニュー**: 右クリックから「後で読む」で記事を簡単保存
- **自動記事抽出**: Webページから記事タイトル、URL、本文を自動取得
- **AI翻訳**: Claude CLIを使用した高品質な多言語→日本語翻訳
- **AI要約**: 記事の主要ポイントを簡潔にまとめたMarkdown形式の要約
- **Obsidian連携**: 指定フォルダにMarkdown形式で保存
- **設定管理**: APIキーや保存先の柔軟な設定
- **通知機能**: 保存成功・失敗をリアルタイムで通知

## 📋 必要環境

- **ブラウザ**: Chrome 100以上
- **OS**: Windows 10/11、macOS 12以上、Linux (Ubuntu 20.04以上)
- **外部ツール**: Claude CLI (翻訳・要約機能用)
- **Obsidian**: バージョン 0.15.0以上

## 🛠️ インストール

### 1. リポジトリのクローン
```bash
git clone https://github.com/yourusername/readlater-for-obsidian.git
cd readlater-for-obsidian
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. Chrome拡張機能として読み込み
1. Chrome で `chrome://extensions/` を開く
2. 「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. このプロジェクトのフォルダを選択

### 4. Claude CLI の設定
1. Claude CLI をインストール
2. 拡張機能のオプションページでAPIキーを設定
3. Obsidianの保存先フォルダパスを設定

## 📖 使用方法

### 基本的な使い方
1. 保存したい記事のページで右クリック
2. 「後で読む」を選択
3. 自動的に記事抽出→翻訳→要約→保存が実行される
4. Obsidianの指定フォルダにMarkdownファイルが保存される

### 保存されるファイル形式
```markdown
---
title: "記事タイトル（日本語）"
url: "元記事URL"
date: "YYYY-MM-DD"
tags: ["ReadLater"]
---

# 記事タイトル（日本語）

**元記事**: [記事タイトル](元記事URL)  
**保存日**: YYYY-MM-DD

## 要約
[AI生成要約（Markdown形式）]

## 翻訳済み本文
[翻訳された記事本文（Markdown形式）]
```

## ⚙️ 設定

拡張機能のオプションページ（chrome://extensions/ から「詳細」→「拡張機能のオプション」）で以下を設定：

- **Claude CLI APIキー**: 翻訳・要約機能に必要
- **Obsidian保存先フォルダ**: 記事を保存するフォルダパス
- **翻訳機能**: 有効/無効の切り替え
- **要約機能**: 有効/無効の切り替え

## 🏗️ 開発

### 開発環境のセットアップ
```bash
npm install
npm run dev    # リント実行
npm test       # テスト実行
npm run build  # ビルド（リント + テスト）
```

### プロジェクト構造
```
readlater-for-obsidian/
├── manifest.json              # Chrome拡張機能のマニフェスト
├── src/
│   ├── background/
│   │   └── service-worker.js  # バックグラウンドサービスワーカー
│   ├── content/
│   │   └── content-script.js  # コンテンツスクリプト
│   ├── options/
│   │   ├── options.html       # 設定ページ
│   │   ├── options.js         # 設定ページロジック
│   │   └── options.css        # 設定ページスタイル
│   ├── lib/
│   │   ├── article-extractor.js # 記事抽出ライブラリ
│   │   ├── claude-api.js      # Claude CLI連携
│   │   ├── markdown-generator.js # Markdown生成
│   │   └── file-saver.js      # ファイル保存
│   └── utils/
│       ├── dom-utils.js       # DOM操作ユーティリティ
│       ├── storage-utils.js   # ストレージ管理
│       └── notification-utils.js # 通知管理
├── docs/                      # プロジェクト文書
├── tests/                     # テストファイル
└── package.json
```

### 開発フェーズ

#### Phase 1: MVP開発 (4-6週間)
- Sprint 1: 基盤構築 (1週間)
- Sprint 2: 記事抽出機能 (1週間)  
- Sprint 3: Claude CLI連携 (1.5週間)
- Sprint 4: ファイル保存機能 (1週間)
- Sprint 5: テスト・改善 (0.5週間)

詳細な計画は `docs/plan.md` を参照してください。

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は `LICENSE` ファイルを参照してください。

## 🔧 トラブルシューティング

### よくある問題

**記事抽出が失敗する**
- Webサイトの構造によっては抽出が困難な場合があります
- フォールバック機能でページ全体のテキストを取得します

**Claude CLI連携でエラーが発生する**
- APIキーが正しく設定されているか確認してください
- Claude CLIが最新版か確認してください

**ファイル保存ができない**
- 保存先フォルダパスが正しいか確認してください
- フォルダの書き込み権限を確認してください

## 📞 サポート

問題や質問がある場合は、[Issues](https://github.com/yourusername/readlater-for-obsidian/issues) で報告してください。