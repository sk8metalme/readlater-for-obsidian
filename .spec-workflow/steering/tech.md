# Technology Stack

## Project Type
Chrome Manifest V3 拡張機能 - WebブラウザでWebページの記事を抽出し、AI処理によりObsidianに保存するクライアントサイドアプリケーション

## Core Technologies

### Primary Language(s)
- **Language**: JavaScript ES6+ (ES2020)
- **Runtime/Compiler**: Chrome V8 エンジン（Chrome拡張機能コンテキスト内）
- **Language-specific tools**: npm（パッケージマネージャー）、Node.js 16+（開発環境）

### Key Dependencies/Libraries
- **Chrome Extension APIs**: Manifest V3（contextMenus, activeTab, downloads, storage, notifications, nativeMessaging, scripting）
- **Jest**: テスティングフレームワーク（v29.7.0）
- **ESLint**: 静的解析・コード品質管理（v8.0.0）
- **Babel**: JavaScript トランスパイレーション（Jest環境用、v7.28.4）
- **JSDOM**: DOM環境シミュレーション（テスト用、v26.1.0）

### Application Architecture
イベント駆動型のChrome拡張機能アーキテクチャ
- **Service Worker**: バックグラウンド処理、コンテキストメニュー管理、メッセージングハブ
- **Content Scripts**: Webページの記事抽出、DOM操作
- **Options Page**: 設定UI、ユーザー設定管理
- **Native Messaging Bridge**: ローカルClaude CLIとの通信

### Data Storage (if applicable)
- **Primary storage**: Chrome Extension Storage API（chrome.storage.local/sync）
- **Caching**: ブラウザのメモリ内キャッシュ（セッション間での設定保持）
- **Data formats**: JSON（設定、記事メタデータ）、Markdown（保存される記事ファイル）

### External Integrations (if applicable)
- **APIs**: Claude CLI（ローカルネイティブホスト経由）
- **Protocols**: Native Messaging Protocol（Chrome ↔ ローカルホスト通信）
- **Authentication**: APIキー不要（ローカルClaude CLI使用）

### Monitoring & Dashboard Technologies (if applicable)
- **Dashboard Framework**: 素のHTML/CSS/JavaScript（Chrome Extension Options Page）
- **Real-time Communication**: Chrome Extension Message Passing API
- **Visualization Libraries**: なし（シンプルなUI）
- **State Management**: Chrome Storage API、ローカル変数管理

## Development Environment

### Build & Development Tools
- **Build System**: npm scripts（lint、test、build組み合わせ）
- **Package Management**: npm（Node.js 16+環境）
- **Development workflow**: 手動リロード（chrome://extensions/でのデベロッパーモード）

### Code Quality Tools
- **Static Analysis**: ESLint（コードスタイル、潜在的エラー検出）
- **Formatting**: ESLint設定による自動フォーマット
- **Testing Framework**: Jest（単体テスト、統合テスト、カバレッジ80%以上）
- **Documentation**: インラインJSDoc、README.md

### Version Control & Collaboration
- **VCS**: Git
- **Branching Strategy**: Feature Branching（feature/mvp-development等）
- **Code Review Process**: プルリクエストベース

### Dashboard Development (if applicable)
- **Live Reload**: なし（手動リロード）
- **Port Management**: なし（Static HTML）
- **Multi-Instance Support**: なし（単一拡張機能インスタンス）

## Deployment & Distribution (if applicable)
- **Target Platform(s)**: Chrome 100以上、Windows 10/11、macOS 12以上、Linux (Ubuntu 20.04以上)
- **Distribution Method**: 開発者向け手動インストール（chrome://extensions/でのパッケージ化されていない拡張機能）
- **Installation Requirements**: Chrome、Claude CLI、Obsidian 0.15.0以上
- **Update Mechanism**: 手動（Git pull、再インストール）

## Technical Requirements & Constraints

### Performance Requirements
- 記事抽出：3秒以内
- AI翻訳・要約：30秒以内（Claude CLI依存）
- ファイル保存：1秒以内
- UI応答性：100ms以内

### Compatibility Requirements  
- **Platform Support**: Chrome Manifest V3準拠ブラウザ
- **Dependency Versions**: Node.js 16+（開発環境）、Chrome 100+（実行環境）
- **Standards Compliance**: Chrome Extension API v3、ECMAScript 2020

### Security & Compliance
- **Security Requirements**: ローカル実行のみ、外部API通信なし、Chrome Extension セキュリティモデル準拠
- **Compliance Standards**: Chrome Web Store ポリシー準拠（将来の公開用）
- **Threat Model**: クロスサイトスクリプティング防止、権限最小化

### Scalability & Reliability
- **Expected Load**: 個人利用（週10記事程度）
- **Availability Requirements**: ローカル実行のため高可用性
- **Growth Projections**: 単一ユーザーから小規模チーム利用への拡張

## Technical Decisions & Rationale

### Decision Log
1. **Chrome Manifest V3採用**: 将来性とセキュリティ、Chrome Web Store対応のため（V2は廃止予定）
2. **Claude CLI（ローカル）選択**: APIキー管理不要、プライバシー保護、レート制限なし
3. **Native Messaging使用**: 拡張機能からローカルCLIへの唯一の安全な通信手段
4. **Jest + JSDOM**: DOM操作テストの必要性、Chrome拡張機能環境のシミュレーション
5. **バニラJavaScript**: 軽量性、依存関係最小化、Chrome環境での確実な動作

## Known Limitations

- **Native Messaging設定の複雑さ**: ユーザーが手動でネイティブホストを設定する必要
- **Claude CLI依存**: ローカルインストールが必要、バージョン互換性の課題
- **単一ブラウザ対応**: Chrome系のみ（Firefox等は別実装が必要）
- **ファイル保存制限**: ローカルファイルシステムへの直接書き込み不可（Downloads APIまたはネイティブホスト経由）