import { and, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accountLinks, connections } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";

const discordApi = "https://discord.com/api/v10";
const defaultGuildId = "1540060798297182268";
const categoryName = "YUNAMATCH PRIVATE VC";
const roomNames = ["VC1", "VC2", "VC3", "VC4", "VC5"];
const legacyRoomNames = new Set(["VCロビー", "VC | デュオ", "VC｜デュオ"]);
const viewChannel = 1 << 10;
const manageChannels = 1 << 4;
const stream = 1 << 9;
const connect = 1 << 20;
const speak = 1 << 21;
const useVad = 1 << 25;
const memberVoicePermissions = (
  viewChannel |
  stream |
  connect |
  speak |
  useVad
).toString();
const botVoicePermissions = (
  viewChannel |
  manageChannels |
  stream |
  connect |
  speak |
  useVad
).toString();

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
  permission_overwrites?: DiscordOverwrite[];
};

function settings() {
  return {
    token: process.env.DISCORD_BOT_TOKEN || "",
    appId: process.env.DISCORD_APP_ID || "",
    guildId: process.env.DISCORD_GUILD_ID || defaultGuildId,
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
      "x-audit-log-reason": encodeURIComponent("YUNAMATCH private voice room"),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("Discord API error", response.status, detail.slice(0, 500));
    if (response.status === 403)
      throw new Error("Discord Botにチャンネル管理権限がありません");
    throw new Error("DiscordのVCを操作できませんでした");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function privateOverwrites(memberIds: string[] = []) {
  const { appId, guildId } = settings();
  const overwrites: DiscordOverwrite[] = [
    { id: guildId, type: 0, allow: "0", deny: viewChannel.toString() },
  ];
  if (appId)
    overwrites.push({
      id: appId,
      type: 1,
      allow: botVoicePermissions,
      deny: "0",
    });
  for (const id of [...new Set(memberIds.filter(Boolean))])
    overwrites.push({
      id,
      type: 1,
      allow: memberVoicePermissions,
      deny: "0",
    });
  return overwrites;
}

async function guildChannels() {
  return discord<DiscordChannel[]>(
    "GET",
    `/guilds/${settings().guildId}/channels`,
  );
}

async function ensureVoiceRooms() {
  let channels = await guildChannels();
  let category = channels.find(
    (channel) => channel.type === 4 && channel.name === categoryName,
  );
  if (!category) {
    category = await discord<DiscordChannel>(
      "POST",
      `/guilds/${settings().guildId}/channels`,
      {
        name: categoryName,
        type: 4,
        permission_overwrites: privateOverwrites(),
      },
    );
    channels = [...channels, category];
  }

  const rooms: DiscordChannel[] = [];
  for (const name of roomNames) {
    let room = channels.find(
      (channel) =>
        channel.type === 2 &&
        channel.parent_id === category?.id &&
        channel.name === name,
    );
    if (!room) {
      room = await discord<DiscordChannel>(
        "POST",
        `/guilds/${settings().guildId}/channels`,
        {
          name,
          type: 2,
          parent_id: category.id,
          user_limit: 5,
          permission_overwrites: privateOverwrites(),
        },
      );
      channels.push(room);
    }
    rooms.push(room);
  }
  return rooms;
}

function assignedMemberIds(channel: DiscordChannel) {
  const { appId } = settings();
  return (channel.permission_overwrites || [])
    .filter((overwrite) => overwrite.type === 1 && overwrite.id !== appId)
    .map((overwrite) => overwrite.id);
}

async function discordIdsForUsers(userIds: string[]) {
  const rows = await getDb()
    .select({
      userId: accountLinks.canonicalUserId,
      discordId: accountLinks.providerAccountId,
    })
    .from(accountLinks)
    .where(
      and(
        eq(accountLinks.provider, "discord"),
        inArray(accountLinks.canonicalUserId, userIds),
      ),
    );
  return new Map(rows.map((row) => [row.userId, row.discordId]));
}

async function connectionForUser(connectionId: number, userId: string) {
  const [connection] = await getDb()
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.id, connectionId),
        or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
      ),
    )
    .limit(1);
  return connection;
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn: "/login" },
      { status: 401 },
    );
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    connectionId?: number;
  };
  const connectionId = Number(body.connectionId);
  if (!Number.isInteger(connectionId) || connectionId <= 0)
    return Response.json({ error: "マッチ情報を確認できません" }, { status: 400 });
  const connection = await connectionForUser(connectionId, user.userId);
  if (!connection)
    return Response.json({ error: "このメイトとのVCは作成できません" }, { status: 403 });

  const mateId =
    connection.userAId === user.userId
      ? connection.userBId
      : connection.userAId;
  const discordIds = await discordIdsForUsers([user.userId, mateId]);
  const myDiscordId = discordIds.get(user.userId);
  const mateDiscordId = discordIds.get(mateId);
  if (!myDiscordId || !mateDiscordId)
    return Response.json(
      { error: "二人ともマイページでDiscord連携を完了するとVCを作れます" },
      { status: 400 },
    );

  const rateLimit = await checkRateLimit(user.userId, {
    action: "discord-private-vc",
    limit: 20,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  try {
    const rooms = await ensureVoiceRooms();
    const mine = rooms.find((room) =>
      assignedMemberIds(room).includes(myDiscordId),
    );
    const action = body.action === "close" ? "close" : "open";
    if (action === "close") {
      if (!mine)
        return Response.json({ ok: true, closed: false, message: "作成中のVCはありません" });
      await discord<DiscordChannel>("PATCH", `/channels/${mine.id}`, {
        permission_overwrites: privateOverwrites(),
      });
      return Response.json({ ok: true, closed: true, roomName: mine.name });
    }

    const room = mine || rooms.find((candidate) => !assignedMemberIds(candidate).length);
    if (!room)
      return Response.json(
        { error: "VC1〜VC5がすべて使用中です。少し待ってからお試しください" },
        { status: 409 },
      );
    await discord<DiscordChannel>("PATCH", `/channels/${room.id}`, {
      user_limit: 5,
      permission_overwrites: privateOverwrites([myDiscordId, mateDiscordId]),
    });
    return Response.json({
      ok: true,
      roomName: room.name,
      channelUrl: `https://discord.com/channels/${settings().guildId}/${room.id}`,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "VCを作成できませんでした" },
      { status: 502 },
    );
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD)
    return Response.json({ error: "管理者パスワードが違います" }, { status: 401 });
  try {
    const channels = await guildChannels();
    const removed: string[] = [];
    for (const channel of channels) {
      if (channel.type === 2 && legacyRoomNames.has(channel.name)) {
        await discord<DiscordChannel>("DELETE", `/channels/${channel.id}`);
        removed.push(channel.name);
      }
    }
    const rooms = await ensureVoiceRooms();
    return Response.json({
      ok: true,
      rooms: rooms.map((room) => room.name),
      removed,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "VCを準備できませんでした" },
      { status: 502 },
    );
  }
}
