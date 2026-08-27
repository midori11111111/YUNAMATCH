const appId = process.env.DISCORD_APP_ID;
const token = process.env.DISCORD_BOT_TOKEN;
const guildId =
  process.env.DISCORD_STAMATE_GUILD_ID || "1541983696780009554";

if (!appId || !token)
  throw new Error("DISCORD_APP_ID と DISCORD_BOT_TOKEN を設定してください");

const choices = (values) => values.map((name) => ({ name, value: name }));
const commands = [
  {
    name: "募集",
    description: "スタメイトとDiscordにブロスタの募集を同時掲載します",
    options: [
      {
        type: 3,
        name: "mode",
        description: "遊びたいモード",
        required: true,
        choices: choices([
          "トロフィー",
          "ガチバトル",
          "フリープレイ",
          "マップメーカー",
          "スペシャルイベント",
          "フレンドバトル",
          "その他",
        ]),
      },
      {
        type: 3,
        name: "current_rank",
        description: "現在のガチバトルランク（プロフィールも更新）",
        required: true,
        choices: choices([
          "未設定",
          "ブロンズ",
          "シルバー",
          "ゴールド",
          "ダイヤモンド",
          "ミシック",
          "レジェンド",
          "マスター",
          "プロ",
        ]),
      },
      {
        type: 3,
        name: "party_size",
        description: "パーティ人数",
        required: true,
        choices: [2, 3, 5].map((value) => ({
          name: `${value}人`,
          value: String(value),
        })),
      },
      {
        type: 3,
        name: "role",
        description: "希望するキャラクタータイプ（任意）",
        required: false,
        choices: choices([
          "アタッカー",
          "アサシン",
          "スナイパー",
          "グレネーディア",
          "タンク",
          "サポート",
          "コントローラー",
          "指定なし",
        ]),
      },
      {
        type: 3,
        name: "create_vc",
        description: "募集専用VCを作成するか",
        required: true,
        choices: [
          { name: "作成する", value: "yes" },
          { name: "作成しない", value: "no" },
        ],
      },
      {
        type: 4,
        name: "starts_in",
        description: "開始時間（任意）",
        required: false,
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
        description: "募集を掲載する時間（任意）",
        required: false,
        choices: [1, 2, 3].map((value) => ({
          name: `${value}時間`,
          value,
        })),
      },
      {
        type: 3,
        name: "note",
        description: "募集のひとこと（任意・120文字まで）",
        required: false,
        max_length: 120,
      },
    ],
  },
  {
    name: "はじめ方",
    description: "スタメイトの募集・申請・VC合流の流れを表示します",
  },
];

const response = await fetch(
  `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`,
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

console.log("スタメイトDiscordへ /募集・/はじめ方 を登録しました");
