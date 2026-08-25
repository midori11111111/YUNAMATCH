# 外部確認・許諾 証跡台帳

最終更新: 2026-08-26

秘密情報やメール本文そのものはGitへ保存しない。受付番号、確認日、結論、運営側の安全な保管場所だけを記録する。

|対象|確認事項|現在の状態|確認日|受付・参照番号|証跡の保管場所|公開判断|
|---|---|---|---|---|---|---|
|電気通信事業|3サービスの名称・URL・役務追加が変更届・報告対象か|管轄局確認待ち||||一般公開不可|
|Riot Games|製品登録、名称、Riot Sign On/API、公開可能範囲|製品申請中||||審査範囲内のみ|
|Supercell|Fan Content Policy、名称、素材、収益化|最終照合待ち||||限定ベータ|
|NetEase Games|名称、素材、API、収益化、一般公開|回答待ち||||プレビュー限定|

## 管理画面へ反映する値

確認が終わった項目だけ `true` にし、必ず対応する参照番号を設定する。

- `TELECOM_SERVICES_CONFIRMED` / `TELECOM_CONFIRMATION_REFERENCE`
- `VALOMATCH_PUBLIC_RELEASE_APPROVED` / `VALOMATCH_APPROVAL_REFERENCE`
- `STAMATE_PUBLIC_RELEASE_APPROVED` / `STAMATE_APPROVAL_REFERENCE`
- `SHOENMATE_PUBLIC_RELEASE_APPROVED` / `SHOENMATE_APPROVAL_REFERENCE`

口頭確認の場合も、日時・部署・担当者名または担当識別情報・こちらから説明した機能・回答要旨を運営メモに残す。
