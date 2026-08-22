# Discord `/募集` 設定

Discord Developer Portalのアプリ設定で、Interactions Endpoint URLを次に設定します。

`https://yunamatch.com/api/discord/interactions`

公開環境に `DISCORD_PUBLIC_KEY`、`DISCORD_APP_ID`、`DISCORD_BOT_TOKEN` を登録し、次を一度実行すると `/募集` と `/はじめ方` が追加されます。

`npm run discord:register`

DiscordアカウントをYUNAMATCHのマイページで連携した利用者だけが募集を作成できます。

## コミュニティ設定

Discordの「コミュニティを有効にする」をオンにし、オンボーディングで次の質問を作成します。

- 現在のランク：エキスパート未満 / エキスパート / マスター1200〜1399 / 1400〜1599 / 1600〜1799 / 1800〜1999 / 2000〜
- 希望ロール：アタック型 / バランス型 / スピード型 / ディフェンス型 / サポート型
- VC：VCできます / 聞き専 / VCなし

デフォルトチャンネルは「はじめに」「ルール」「ユナイト募集」「お知らせ」にし、サーバーガイドへ `https://yunamatch.com/community` を登録します。
