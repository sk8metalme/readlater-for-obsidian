# Requirements Document

## Introduction

記事集約保存機能は、従来の「記事ごとに個別Markdownファイル保存」から「1つのMarkdownファイルに記事を追加していく集約型保存」への変更を実現する機能です。ユーザーは複数の記事を同一ファイルに集約し、記事一覧を表形式で管理できるようになります。これにより、記事の全体像把握と効率的な情報管理が可能になります。

## Alignment with Product Vision

この機能は以下の点でプロダクトビジョンに合致します：

- **知識統合の促進**: 散在する記事情報を1つのファイルに集約し、体系的管理を実現
- **学習効率の向上**: 記事一覧表により、保存した記事の全体像を素早く把握可能
- **シームレスな統合**: Obsidianワークフローにより自然に組み込まれる集約型管理
- **継続的な学習習慣の構築**: 集約ファイルによる記事の蓄積可視化で学習継続性を向上

## Requirements

### Requirement 1: 集約ファイル管理

**User Story:** Obsidianユーザーとして、保存した記事を1つのMarkdownファイルに集約したい。そうすることで、記事が散らばることなく、統一された場所で管理できる。

#### Acceptance Criteria

1. WHEN ユーザーが最初の記事を保存する THEN システムは集約ファイルを新規作成し、表ヘッダーを含む基本構造を生成SHALL
2. WHEN ユーザーが2回目以降の記事を保存する THEN システムは既存の集約ファイルに新しい記事エントリを追加SHALL
3. IF 集約ファイルが既に存在する THEN システムは既存内容を保持し、新規記事を末尾に追加SHALL

### Requirement 2: 記事一覧表形式管理

**User Story:** 学習者として、保存した記事の一覧を表形式で確認したい。そうすることで、記事のタイトル、URL、要約を一目で把握し、効率的に記事を選択できる。

#### Acceptance Criteria

1. WHEN 記事が保存される THEN 集約ファイルの表に記事タイトル、元URL、要約、保存日時が記録SHALL
2. WHEN 記事タイトルが日本語に翻訳される THEN 表には翻訳後の日本語タイトルが表示SHALL
3. WHEN 記事要約が生成される THEN 表には簡潔な要約（100文字以内）が記録SHALL

### Requirement 3: 記事詳細コンテンツ管理

**User Story:** 研究者として、記事の詳細な翻訳内容と要約を後から参照したい。そうすることで、表での概要確認後に、必要に応じて詳細内容を読むことができる。

#### Acceptance Criteria

1. WHEN 記事が保存される THEN 集約ファイルに記事の詳細セクションが追加SHALL
2. WHEN 記事の翻訳が完了する THEN 詳細セクションに完全な翻訳テキストが保存SHALL
3. WHEN 記事の要約が生成される THEN 詳細セクションに詳細要約が保存SHALL

### Requirement 4: 設定可能な集約ファイル管理

**User Story:** Obsidianユーザーとして、集約ファイルの名前と保存先を設定したい。そうすることで、自分のObsidianワークフローに合わせた記事管理ができる。

#### Acceptance Criteria

1. WHEN ユーザーがオプション画面を開く THEN 集約ファイル名設定欄が表示SHALL
2. WHEN ユーザーが集約ファイル名を変更する THEN 次回保存時から新しい名前のファイルが使用SHALL
3. IF 集約ファイル名が未設定 THEN システムはデフォルト名「ReadLater_Articles.md」を使用SHALL

### Requirement 5: 既存機能との互換性

**User Story:** 既存ユーザーとして、従来の個別ファイル保存機能から集約機能にスムーズに移行したい。そうすることで、機能変更による混乱なく新機能を利用できる。

#### Acceptance Criteria

1. WHEN 集約機能が有効化される THEN 既存の個別保存ファイルは保持SHALL
2. WHEN ユーザーが個別保存から集約保存に変更する THEN オプション画面で切り替え可能SHALL
3. WHEN 設定が変更される THEN 次回記事保存時から新しい保存方式が適用SHALL

## Non-Functional Requirements

### Code Architecture and Modularity
- **Single Responsibility Principle**: 集約ファイル管理は専用クラス（AggregatedFileManager）で処理
- **Modular Design**: MarkdownGenerator、ArticleExtractor、FileManagerの明確な分離
- **Dependency Management**: 既存のnative-messaging、storage管理との最小限の結合
- **Clear Interfaces**: 集約保存と個別保存の統一インターフェース提供

### Performance
- **ファイル読み書き効率**: 集約ファイルの読み込み・更新は3秒以内で完了
- **メモリ使用量**: 大きな集約ファイル（100記事以上）でもメモリ使用量50MB以下
- **並行処理**: 複数記事の同時保存時の競合状態を適切に処理

### Security
- **ファイルアクセス制御**: Obsidian指定フォルダ内のみでの集約ファイル操作
- **データ整合性**: 書き込み中断時の部分更新防止機構
- **入力検証**: ファイル名、パスの不正文字除去とサニタイゼーション

### Reliability
- **データ永続性**: 集約ファイル更新の原子性保証（全成功または全失敗）
- **エラー回復**: ファイル破損時の自動バックアップからの復旧機能
- **フォールバック**: 集約保存失敗時の個別保存への自動切り替え

### Usability
- **設定の直感性**: オプション画面での集約機能ON/OFF切り替えが明確
- **進行状況表示**: 集約ファイル更新中の進行状況をユーザーに通知
- **エラー通知**: 集約保存失敗時の分かりやすいエラーメッセージ表示