const discordApi = "https://discord.com/api/v10";
const defaultGuildId = "1540060798297182268";
const recruitVoiceCategory = "YUNAMATCH 募集VC";
const recruitVoicePrefix = "募集VC｜";
const voiceRoomLifetimeMs = 24 * 60 * 60_000;

const viewChannel = 1 << 10;
const sendMessages = 1 << 11;
const readMessageHistory = 1 << 16;
const stream = 1 << 9;
const connect = 1 << 20;
const speak = 1 << 21;
const useVad = 1 << 25;
const manageChannels = 1 << 4;
const memberPermissions = (
  viewChannel |
  sendMessages |
  readMessageHistory |
  stream |
  connect |
  speak |
  useVad
).toString();
const botPermissions = (Number(memberPermissions) | manageChannels).toString();

type DiscordOverwrite = {
  id: string;
  type: number;
  allow?: string;
  deny?: string;
};

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
};

function settings(guildId?: string) {
  return {
    token: process.env.DISCORD_BOT_TOKEN || "",
    appId: process.env.DISCORD_APP_ID || "",
    guildId: guildId || process.env.DISCORD_GUILD_ID || defaultGuildId,
  };
}

async function discord<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { token } = settings();
  if (!token) throw new Error("Discord Botが設定されていません");
  const response = await fetch(`${discordApi}${path}`, {
    method,
    headers: {
      authorization: `Bot ${token}`,
      "content-type": "application/json",
      "x-audit-log-reason": encodeURIComponent("YUNAMATCH recruit voice room"),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error(
      "Discord recruit VC API error",
      response.status,
      detail.slice(0, 500),
    );
    throw new Error("Discordの募集VCを操作できませんでした");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function guildChannels(guildId?: string) {
  return discord<DiscordChannel[]>(
    "GET",
    `/guilds/${settings(guildId).guildId}/channels`,
  );
}

function publicVoiceOverwrites(discordId?: string, requestedGuildId?: string) {
  const { appId, guildId } = settings(requestedGuildId);
  const overwrites: DiscordOverwrite[] = [
    { id: guildId, type: 0, allow: memberPermissions, deny: "0" },
  ];
  if (appId)
    overwrites.push({
      id: appId,
      type: 1,
      allow: botPermissions,
      deny: "0",
    });
  if (discordId)
    overwrites.push({
      id: discordId,
      type: 1,
      allow: memberPermissions,
      deny: "0",
    });
  return overwrites;
}

async function ensureRecruitVoiceCategory(
  channels: DiscordChannel[],
  guildId?: string,
  categoryName = recruitVoiceCategory,
) {
  const existing = channels.find(
    (channel) => channel.type === 4 && channel.name === categoryName,
  );
  if (existing) return existing;
  return discord<DiscordChannel>(
    "POST",
    `/guilds/${settings(guildId).guildId}/channels`,
    {
      name: categoryName,
      type: 4,
      permission_overwrites: publicVoiceOverwrites(undefined, guildId),
    },
  );
}

function snowflakeCreatedAt(id: string) {
  try {
    return Number((BigInt(id) >> 22n) + 1420070400000n);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export async function cleanupExpiredRecruitVoiceRooms(
  now = Date.now(),
  options: { guildId?: string; categoryName?: string; roomPrefix?: string } = {},
) {
  const categoryName = options.categoryName || recruitVoiceCategory;
  const roomPrefix = options.roomPrefix || recruitVoicePrefix;
  const channels = await guildChannels(options.guildId);
  const category = channels.find(
    (channel) => channel.type === 4 && channel.name === categoryName,
  );
  if (!category) return [];
  const expired = channels.filter(
    (channel) =>
      channel.type === 2 &&
      channel.parent_id === category.id &&
      channel.name.startsWith(roomPrefix) &&
      now - snowflakeCreatedAt(channel.id) >= voiceRoomLifetimeMs,
  );
  for (const channel of expired)
    await discord<DiscordChannel>("DELETE", `/channels/${channel.id}`);
  return expired.map((channel) => channel.name);
}

export async function createRecruitVoiceRoom({
  discordId,
  trainerName,
  userLimit,
  guildId,
  categoryName = recruitVoiceCategory,
  roomPrefix = recruitVoicePrefix,
}: {
  discordId: string;
  trainerName: string;
  userLimit: number;
  guildId?: string;
  categoryName?: string;
  roomPrefix?: string;
}) {
  if (![2, 3, 4, 5].includes(userLimit))
    throw new Error("VC人数を確認してください");
  await cleanupExpiredRecruitVoiceRooms(Date.now(), {
    guildId,
    categoryName,
    roomPrefix,
  });
  const channels = await guildChannels(guildId);
  const category = await ensureRecruitVoiceCategory(
    channels,
    guildId,
    categoryName,
  );
  const safeName =
    trainerName
      .replace(/[\r\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 70) || "トレーナー";
  const channel = await discord<DiscordChannel>(
    "POST",
    `/guilds/${settings(guildId).guildId}/channels`,
    {
      name: `${roomPrefix}${safeName}`,
      type: 2,
      parent_id: category.id,
      user_limit: userLimit,
      permission_overwrites: publicVoiceOverwrites(discordId, guildId),
    },
  );
  return {
    name: channel.name,
    url: `https://discord.com/channels/${settings(guildId).guildId}/${channel.id}`,
  };
}
