# Project Structure

## Directory Organization

```
readlater-for-obsidian/
├── src/                           # 拡張機能の主要ソースコード
│   ├── background/                # バックグラウンド処理（Service Worker）
│   │   └── service-worker.js      # Chrome拡張のメイン制御ロジック
│   ├── content/                   # Webページ内で実行されるスクリプト
│   │   └── content-script.js      # 記事抽出・DOM操作ロジック
│   ├── options/                   # 設定画面関連
│   │   ├── options.html           # 設定UI（HTML）
│   │   ├── options.js             # 設定ロジック（JavaScript）
│   │   └── options.css            # 設定画面スタイル
│   ├── lib/                       # 再利用可能なライブラリ・コアロジック
│   │   ├── article-extractor.js   # Web記事抽出エンジン
│   │   ├── claude-cli.js          # Claude CLI連携（レガシー）
│   │   ├── markdown-generator.js  # Markdown形式生成
│   │   └── native-messaging.js    # ネイティブメッセージング統合
│   └── utils/                     # 汎用ユーティリティ
│       └── error-handler.js       # エラー処理・ログ管理
├── tests/                         # テストファイル群
│   ├── lib/                       # ライブラリのユニットテスト
│   │   └── claude-cli.test.js     # Claude CLI関連テスト
│   ├── manual/                    # 手動テスト・開発用スクリプト
│   │   ├── browser-test.html      # ブラウザ環境テスト
│   │   ├── claude-cli-local-test.js  # ローカルClaude CLIテスト
│   │   ├── claude-local-test.js   # Claude統合テスト
│   │   ├── performance-test.js    # パフォーマンステスト
│   │   └── README.md              # 手動テスト手順
│   └── setup.js                   # Jest環境設定
├── native_host/                   # ネイティブメッセージングホスト
│   ├── claude_host.js             # Node.jsホスト実装
│   ├── claude_host.sh             # Unixシェルホスト
│   └── com.readlater.claude_host.json # ホスト設定ファイル
├── scripts/                       # ビルド・デプロイスクリプト
│   └── install-native-host.js     # ネイティブホスト自動インストール
├── docs/                          # プロジェクト文書
│   ├── context.md                 # プロジェクト文脈・背景
│   ├── native-messaging.md        # ネイティブメッセージング設定手順
│   └── plan.md                    # 開発計画・ロードマップ
├── icons/                         # 拡張機能アイコン
│   └── icon.svg                   # 拡張機能アイコン（SVG）
├── .claude/                       # Claude Code専用設定
│   ├── agents/                    # 専門エージェント設定
│   │   ├── test-developer.md      # TDD開発エージェント
│   │   ├── analyzer-pj.md         # プロジェクト解析エージェント
│   │   ├── developer.md           # 汎用開発エージェント
│   │   ├── manager-pj.md          # プロジェクト管理エージェント
│   │   ├── design-expert.md       # UI/UXデザインエージェント
│   │   ├── manager-doc.md         # ドキュメント管理エージェント
│   │   ├── review-cq.md           # コード品質レビューエージェント
│   │   └── manager-agent.md       # チーム調整エージェント
│   └── commands/                  # カスタムコマンド
│       ├── req.md                 # 開発ワークフローコマンド
│       └── pr.md                  # プルリクエストコマンド
├── .spec-workflow/                # Spec Workflow管理（一時的）
│   ├── steering/                  # ステアリングドキュメント
│   │   ├── product.md             # プロダクト要件
│   │   └── tech.md                # 技術仕様
│   └── session.json               # ワークフローセッション管理
└── 設定・メタファイル
    ├── manifest.json              # Chrome拡張機能メタデータ
    ├── package.json               # Node.js依存関係・スクリプト
    ├── jest.config.js             # Jestテスト設定
    ├── babel.config.js            # Babelトランスパイレーション設定
    ├── CLAUDE.md                  # Claude Code専用指示書
    └── README.md                  # プロジェクト概要・使用手順
```

## Naming Conventions

### Files
- **Chrome拡張機能コンポーネント**: `kebab-case` (例: `service-worker.js`, `content-script.js`)
- **ライブラリ・モジュール**: `kebab-case` (例: `article-extractor.js`, `markdown-generator.js`)
- **ユーティリティ・ヘルパー**: `kebab-case` (例: `error-handler.js`, `dom-utils.js`)
- **テストファイル**: `[filename].test.js` または `[filename]-test.js`

### Code
- **クラス・コンストラクタ**: `PascalCase` (例: `ClaudeCLI`, `ArticleExtractor`)
- **関数・メソッド**: `camelCase` (例: `extractArticle`, `generateMarkdown`)
- **定数**: `UPPER_SNAKE_CASE` (例: `HOST_NAME`, `DEFAULT_TIMEOUT`)
- **変数**: `camelCase` (例: `articleContent`, `translateResult`)

## Import Patterns

### Import Order
1. Chrome Extension APIs (`chrome.*`)
2. Node.js標準ライブラリ（ネイティブホスト内）
3. 外部依存関係（現在なし）
4. プロジェクト内部モジュール
5. 相対インポート

### Module/Package Organization
```javascript
// Chrome Extension API（グローバル変数として利用可能）
chrome.contextMenus.create(...)
chrome.storage.local.get(...)

// プロジェクト内モジュール（ES6 modules）
import { ArticleExtractor } from '../lib/article-extractor.js';
import { MarkdownGenerator } from '../lib/markdown-generator.js';

// 相対インポート（同一ディレクトリ内）
import { ErrorHandler } from './error-handler.js';
```

## Code Structure Patterns

### Module/Class Organization
```javascript
1. ファイルヘッダーコメント（著作権・目的）
2. Chrome Extension APIアクセス
3. モジュールインポート
4. 定数定義・設定値
5. クラス定義・メイン実装
6. ヘルパー関数・ユーティリティ
7. イベントリスナー・初期化コード
8. エクスポート（必要に応じて）
```

### Function/Method Organization
```javascript
- JSDoc形式の関数説明
- 引数バリデーション
- メインロジック実装
- エラーハンドリング
- 戻り値（Promiseの場合は適切な解決・拒否）
```

### File Organization Principles
```javascript
- 1ファイル1クラス原則（大きなクラスの場合）
- 機能関連コードのグループ化
- パブリックAPI（エクスポート関数）をファイル上部に配置
- プライベート関数・実装詳細を下部に配置
```

## Code Organization Principles

1. **Single Responsibility**: 各ファイルは単一の明確な責任を持つ（記事抽出、Markdown生成など）
2. **Modularity**: Chrome Extension環境でのモジュール性を考慮した分離設計
3. **Testability**: Jest環境での単体テストが容易な構造
4. **Consistency**: Chrome Extension API使用パターンの統一化

## Module Boundaries

### Core vs Plugins
- **Core**: `src/lib/`（記事抽出、Markdown生成、ネイティブメッセージング）
- **Extension Specific**: `src/background/`, `src/content/`, `src/options/`（Chrome拡張機能固有）

### Public API vs Internal
- **Public**: Chrome Extension間メッセージパッシングAPI
- **Internal**: ライブラリ間の内部インターフェース

### Platform-specific vs Cross-platform
- **Platform-specific**: Chrome Extension API依存コード
- **Cross-platform**: `src/lib/`内の汎用ロジック

### Dependencies direction
```
Chrome Extension Context → lib/ → utils/
       ↓                      ↓
native_host/ ←—————————————————
```

## Code Size Guidelines

### 推奨ガイドライン
- **File size**: 300行以下（複雑なクラスは500行まで許可）
- **Function/Method size**: 50行以下（非常に複雑な処理は80行まで）
- **Class/Module complexity**: 1ファイル1メインクラス
- **Nesting depth**: 3レベル以下（if-else、try-catch、loop）

## Dashboard/Monitoring Structure (if applicable)

### Chrome Extension Options Page
```
src/options/
├── options.html           # 設定UIレイアウト
├── options.js             # 設定ロジック・UI制御
└── options.css            # スタイリング
```

### Separation of Concerns
- **UI Layer**: HTMLフォーム、CSS styling
- **Logic Layer**: JavaScript設定管理、Chrome Storage API
- **Data Layer**: Chrome Extension Storage API

## Documentation Standards

- **Public APIs**: JSDoc形式でのドキュメント必須
- **Complex Logic**: インラインコメントで処理説明
- **README files**: 各主要モジュール（`docs/`, `tests/manual/`）
- **Chrome Extension特有**: 権限・API使用に関する詳細説明