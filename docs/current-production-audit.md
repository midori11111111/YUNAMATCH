# 本番構成監査（2026-08-26）

## 現在の構成

- `yunamatch.com`: Vercelの認証・独自ドメイン入口
- Sites: UI、API、D1、R2の上流
- Vercelは画面・APIをSitesへリライトし、Google / LINE / Discord / XのOAuthを処理する

3日公開ではこの二層構成を維持する。新しい基盤へ同時移行せず、障害原因を増やさない。

## 確認済み

- Vercel本番にGoogle、LINE、Discord、X、`AUTH_SECRET`の環境変数が存在する
- Sites本番に認証、管理、Discord Bot、Push、問い合わせ先の主要環境変数が存在する
- SitesにD1 `DB` とR2 `MEDIA` のバインディングがある
- Sitesは公開設定で稼働中
- GitHubとSites専用リポジトリへ公開候補コミットを同期済み

## 公開前に必要

- 現在のSites本番DBは既存YUNAMATCH表のみ。新3サービスのマイグレーションを含む候補バージョンへ更新する
- 更新直前に管理画面から本番バックアップを取得する
- Sites側に `RESEND_API_KEY` と `FEEDBACK_FROM_EMAIL` を設定する。未設定でも問い合わせはDBへ保存されるが、メール通知は送られない
- Vercelの上流URLを変更せず、Sitesの公開切替後に既存OAuthを実機確認する
- 公開後にD1で `service_profiles` から `service_admin_audit_logs` までの8表を確認する

## 公開順

1. 本番バックアップを取得
2. Sitesの新バージョンを公開
3. D1の新8表を確認
4. `yunamatch.com`から3プレビューを開く
5. 2アカウントでサービスごとの通し試験
6. スタメイトを限定公開
7. バロマッチ・荘園メイトは権利者確認範囲に応じて公開

