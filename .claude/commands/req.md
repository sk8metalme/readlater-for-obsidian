---
name: req 
description: ワークフローループ実行（計画→実装→レビューを全ステップ完了まで繰り返し）
---

## 実行内容
このコマンドが実行されたら、以下のループを全ステップ完了まで自動的に繰り返します。

### ワークフローループ
```
1. @manager-pj → PJ計画 
2. @manager-agent,@analyze-pj,@design-expert,@developer → PJ内部レビュー/改善
3. @design-expert → 詳細設計
4. @manager-agent,@analyze-pj,@design-expert,@developer → 詳細設計内部レビュー/改善
5. @design-test → テスト設計
6. @design-test,@developer → テスト設計内部レビュー/改善
7. @developer,@test-developer → TDDでの開発
   7-1. @test-developer → テスト開発
   7-2. @developer → 開発
   7-3. @test-developer → テスト実施
   7-4. @review-cq → 内部コードレビューの実施
8. @manager-doc → ドキュメント最新化
9. @manager-agent,@manager-pj,@design-expert → 全体の内部レビュー
10. @manager-agent → 各種エージェントへの改善指示
11. @developer → ghコマンドでPR作成
12. @developer, @test-developer →　PRを確認してCIが成功しているか確認
13. @manager-pj → 進捗確認を実施し次のタスク決定を行う
```

### 重要な動作仕様
- **ユーザーの停止指示まで自動継続**
- **1 回の実装 = 1 ステップのみ**
- **各エージェント呼び出し前に必ず `docs/context.md` と `docs/plan.md` を読み込む（最新状態を把握）**
- **各実装ステップ後に必ずレビュー**
- **レビュー後に必ず次の計画を更新**
- **`docs/context.md` で進捗・コンテキスト管理(UTF-8)**
- **`docs/plan.md` で実行計画管理(UTF-8)**
- **PR作成後、push後はCIが成功するまで確認を継続**


## 停止方法
- Ctrl+C または「停止」と入力
- 特定のステップで停止したい場合は「Step Nで停止」と指定

## 進捗確認
実行中の進捗は`docs/context.md`で確認できます。