import { requireAdmin } from "../../../../lib/admin";

type DiscordCommandOption = {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  choices?: Array<{ name: string; value: string | number }>;
};

type DiscordCommand = {
  id: string;
  name: string;
  description: string;
  type?: number;
  options?: DiscordCommandOption[];
};

const matchTypeOption: DiscordCommandOption = {
  type: 3,
  name: "match_type",
  description: "カジュアルかランクマッチを選択",
  required: true,
  choices: [
    { name: "ランクマッチ", value: "ランクマッチ" },
    { name: "カジュアル", value: "カジュアル" },
  ],
};

const clarifiedDescriptions: Record<string, string> = {
  current_rank: "あなた（募集者本人）の現在のランク",
  matches: "あなた（募集者本人）の試合数",
  win_rate: "あなた（募集者本人）の勝率",
};
const currentRankChoices = [
  "エキスパート未満",
  "エキスパート",
  "マスター",
  "レジェンド1000〜1499",
  "レジェンド1500以上",
].map((name) => ({ name, value: name }));

export async function POST() {
  if (!(await requireAdmin()))
    return Response.json(
      { error: "管理者権限が必要です" },
      { status: 403 },
    );
  const appId = process.env.DISCORD_APP_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!appId || !token)
    return Response.json(
      { error: "Discord設定が不足しています" },
      { status: 503 },
    );

  const headers = { authorization: `Bot ${token}` };
  const commandResponse = await fetch(
    `https://discord.com/api/v10/applications/${appId}/commands`,
    { headers },
  );
  if (!commandResponse.ok)
    return Response.json(
      { error: "Discordのコマンドを取得できませんでした" },
      { status: 502 },
    );
  const commands = (await commandResponse.json()) as DiscordCommand[];
  const recruitCommand = commands.find((command) => command.name === "募集");
  if (!recruitCommand)
    return Response.json(
      { error: "Discordの募集コマンドが見つかりません" },
      { status: 404 },
    );
  const currentOptions = recruitCommand.options || [];
  const options = [
    matchTypeOption,
    ...currentOptions
      .filter((option) => option.name !== "match_type")
      .map((option) => ({
        ...option,
        description: clarifiedDescriptions[option.name] || option.description,
        ...(option.name === "current_rank"
          ? { choices: currentRankChoices }
          : {}),
      })),
  ];
  const updateResponse = await fetch(
    `https://discord.com/api/v10/applications/${appId}/commands/${recruitCommand.id}`,
    {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ options }),
    },
  );
  if (!updateResponse.ok)
    return Response.json(
      { error: "Discordの募集コマンドを更新できませんでした" },
      { status: 502 },
    );
  const updatedRecruit = (await updateResponse.json()) as DiscordCommand;

  // Global commands can take time to propagate. Register the same commands
  // directly to the official guild as well so /募集 is available immediately.
  if (guildId) {
    const gettingStarted = commands.find(
      (command) => command.name === "はじめ方",
    );
    const guildCommands = [
      {
        type: updatedRecruit.type || 1,
        name: updatedRecruit.name,
        description: updatedRecruit.description,
        options: updatedRecruit.options || options,
      },
      ...(gettingStarted
        ? [
            {
              type: gettingStarted.type || 1,
              name: gettingStarted.name,
              description: gettingStarted.description,
              options: gettingStarted.options || [],
            },
          ]
        : []),
    ];
    const guildResponse = await fetch(
      `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`,
      {
        method: "PUT",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(guildCommands),
      },
    );
    if (!guildResponse.ok)
      return Response.json(
        { error: "YUNAMATCHサーバーへ募集コマンドを登録できませんでした" },
        { status: 502 },
      );
  }
  return Response.json({ ok: true, guildRegistered: Boolean(guildId) });
}
