# Discord `/募集` 設定

Discord Developer Portalのアプリ設定で、Interactions Endpoint URLを次に設定します。

`https://yunamatch.vercel.app/api/discord/interactions`

公開環境に `DISCORD_PUBLIC_KEY`、`DISCORD_APP_ID`、`DISCORD_BOT_TOKEN` を登録し、次を一度実行すると `/募集` が追加されます。

`npm run discord:register`

DiscordアカウントをYUNAMATCHのマイページで連携した利用者だけが募集を作成できます。
