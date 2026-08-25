# 本番運用手順

## 公開前

1. 本番の秘密情報を環境変数へ登録する。値をリポジトリやチャットへ貼らない。
2. `npm run check:production` を本番と同じ環境変数で実行する。
3. 管理画面のバックアップからJSONを書き出し、日付・容量・`schemaVersion: 4`を確認する。
4. DBマイグレーションを先にステージングへ適用し、E2Eテストを通す。
5. 本番DBをバックアップしてからマイグレーションを適用する。
6. 限定公開で登録・マッチ・チャット・通報・ブロック・退会を実機確認する。

## 必須環境変数

- 認証: `AUTH_SECRET`
- 管理: `ADMIN_PASSWORD`
- Discord: `DISCORD_PUBLIC_KEY`, `DISCORD_APP_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`
- Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- 問い合わせ: `FEEDBACK_TO_EMAIL`, `FEEDBACK_FROM_EMAIL`, `RESEND_API_KEY`

`AUTH_SECRET`と`ADMIN_PASSWORD`は24文字以上のランダム値にする。過去に共有した文字列やサービス名を使わない。

## 3サービス公開フラグ

管理画面の公開準備チェックは、次の環境変数が設定された場合だけ完了表示になる。

- `VALOMATCH_SITE_URL` / `STAMATE_SITE_URL` / `SHOENMATE_SITE_URL`
- `VALOMATCH_X_URL` / `STAMATE_X_URL` / `SHOENMATE_X_URL`
- `NEXT_PUBLIC_VALOMATCH_DISCORD_URL` / `NEXT_PUBLIC_STAMATE_DISCORD_URL` / `NEXT_PUBLIC_SHOENMATE_DISCORD_URL`
- `VALOMATCH_PUBLIC_RELEASE_APPROVED` / `STAMATE_PUBLIC_RELEASE_APPROVED` / `SHOENMATE_PUBLIC_RELEASE_APPROVED`
- `VALOMATCH_APPROVAL_REFERENCE` / `STAMATE_APPROVAL_REFERENCE` / `SHOENMATE_APPROVAL_REFERENCE`
- `TELECOM_SERVICES_CONFIRMED` / `TELECOM_CONFIRMATION_REFERENCE`

確認フラグは、権利者の回答・公開方針・管轄窓口への確認記録が残ってから `true` にし、対応する参照番号も設定する。審査待ちを便宜的に完了扱いにしない。参照番号には秘密情報やメール本文を入れず、運営者だけが参照できる保管記録の管理番号を使う。

## バックアップ

- 毎日1回、およびDBマイグレーション直前に管理画面から書き出す。
- バックアップにはYUNAMATCHと3サービスのプロフィール、募集、いいね、マッチ、チャット、通報、ブロック、管理監査ログを含める。
- バックアップファイルは公開ストレージへ置かず、アクセス制限と暗号化のある保管先へ移す。
- 月1回、複製した検証DBで復元試験を行い、件数と主要な関係を確認する。

## 復元確認

1. 空の検証DBを作る。
2. 本番と同じマイグレーションを全て適用する。
3. バックアップの各配列を外部キーの親から順に取り込む。
4. プロフィール、マッチ、チャット、ブロック、通報、管理監査ログの件数を照合する。
5. 3サービスで同じユーザーIDが存在しても、`serviceId`を跨いで表示されないことをE2Eで確認する。

## 障害時

- 書き込みエラーやサービス間のデータ混在があれば新規登録・チャットを停止する。
- 直前バックアップを保全し、`docs/security-incident-runbook.md`に従う。
- 復旧後は限定公開から再開し、いきなり全体公開へ戻さない。
