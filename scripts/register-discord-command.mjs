const appId = process.env.DISCORD_APP_ID;
const token = process.env.DISCORD_BOT_TOKEN;
if (!appId || !token)
  throw new Error("DISCORD_APP_ID と DISCORD_BOT_TOKEN を設定してください");

const ranks = [
  "エキスパート未満",
  "エキスパート",
  "マスター 1200〜1399",
  "マスター 1400〜1599",
  "レジェンド 1000〜1199",
  "レジェンド 1200〜1399",
  "レジェンド 1400〜",
];
const commands = [
  {
    name: "募集",
    description: "YUNAMATCHとDiscordにユナイト募集を同時掲載します",
    options: [
      {
        type: 3,
        name: "match_type",
        description: "カジュアルかランクマッチを選択",
        required: true,
        choices: ["ランクマッチ", "カジュアル"].map((name) => ({
          name,
          value: name,
        })),
      },
      {
        type: 3,
        name: "current_rank",
        description: "あなた（募集者本人）の現在のランク",
        required: true,
        choices: ranks.map((name) => ({ name, value: name })),
      },
      {
        type: 3,
        name: "party_size",
        description: "募集人数",
        required: true,
        choices: [
          { name: "3人以下", value: "up_to_3" },
          { name: "3人", value: "3" },
          { name: "2人", value: "2" },
          { name: "5人", value: "5" },
        ],
      },
      {
        type: 3,
        name: "lane",
        description: "担当レーン（任意）",
        choices: ["上レーン", "下レーン", "中央"].map((name) => ({
          name,
          value: name,
        })),
      },
      {
        type: 3,
        name: "play_style",
        description: "役割（任意）",
        choices: ["キャリー", "タンク", "サポート"].map((name) => ({
          name,
          value: name,
        })),
      },
      {
        type: 4,
        name: "starts_in",
        description: "開始時間",
        choices: [
          { name: "今から", value: 0 },
          { name: "30分後", value: 30 },
          { name: "1時間後", value: 60 },
          { name: "2時間後", value: 120 },
        ],
      },
      {
        type: 4,
        name: "duration",
        description: "募集時間",
        choices: [
          { name: "1時間", value: 1 },
          { name: "2時間", value: 2 },
          { name: "3時間", value: 3 },
        ],
      },
      { type: 4, name: "matches", description: "あなた（募集者本人）の試合数" },
      { type: 10, name: "win_rate", description: "あなた（募集者本人）の勝率" },
    ],
  },
  {
    name: "はじめ方",
    description: "YUNAMATCHの募集・申請・VC合流の流れを表示します",
  },
];

const response = await fetch(
  `https://discord.com/api/v10/applications/${appId}/commands`,
  {
    method: "PUT",
    headers: {
      authorization: `Bot ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(commands),
  },
);
if (!response.ok)
  throw new Error(`${response.status} ${await response.text()}`);
console.log("Discordの /募集・/はじめ方 コマンドを登録しました");
