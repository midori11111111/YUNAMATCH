import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { blocks, connections, messages, profiles } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { sendPush } from "../../../lib/push";
import { isSuspended } from "../../../lib/safety";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { containsProhibitedContent, prohibitedContentMessage } from "../../../lib/content-policy";
import { identityAliases } from "../../../lib/account-aliases";
import { runInBackground } from "../../../lib/background";

const signIn = "/login";
const playInviteBody = "一緒にプレイしませんか？";

async function getMembership(connectionId: number, userIds: string[]) {
  const [connection] = await getDb().select().from(connections).where(and(
    eq(connections.id, connectionId),
    or(
      inArray(connections.userAId, userIds),
      inArray(connections.userBId, userIds),
    ),
  )).limit(1);
  return connection;
}

async function isBlocked(userIds: string[], mateId: string) {
  const [blocked] = await getDb().select({ id: blocks.id }).from(blocks).where(or(
    and(inArray(blocks.blockerId, userIds), eq(blocks.blockedId, mateId)),
    and(eq(blocks.blockerId, mateId), inArray(blocks.blockedId, userIds)),
  )).limit(1);
  return Boolean(blocked);
}

function serializeMessage(
  row: typeof messages.$inferSelect,
  userIds: Set<string>,
  mateLastRead?: Date | null,
) {
  return {
    id: row.id,
    clientId: row.clientId,
    body: row.body,
    sender: userIds.has(row.senderId) ? "me" : "mate",
    kind: row.kind === "play_invite" ? "play_invite" : "text",
    response: row.response,
    canRespond:
      row.kind === "play_invite" &&
      !row.response &&
      !userIds.has(row.senderId),
    createdAt: row.createdAt,
    read:
      userIds.has(row.senderId) &&
      Boolean(mateLastRead && row.createdAt <= mateLastRead),
  };
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "ログインが必要です", signIn }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const connectionId = Number(params.get("connectionId"));
  const beforeValue = Number(params.get("before"));
  const before = Number.isInteger(beforeValue) && beforeValue > 0 ? beforeValue : null;
  if (!Number.isInteger(connectionId)) return Response.json({ error: "マッチを選択してください" }, { status: 400 });
  const aliases = await identityAliases(user.userId, user.email);
  const aliasSet = new Set(aliases);
  const connection = await getMembership(connectionId, aliases);
  if (!connection) return Response.json({ error: "マッチが見つかりません" }, { status: 404 });
  const mateId = aliasSet.has(connection.userAId)
    ? connection.userBId
    : connection.userAId;
  // Keep the most recent part of long conversations. Ordering ascending before
  // applying the limit returned the oldest 100 messages and made new messages
  // appear to disappear once a conversation grew past that point.
  const pageSize = 100;
  const [newestRows, mateProfiles] = await Promise.all([
    getDb()
      .select()
      .from(messages)
      .where(and(
        eq(messages.connectionId, connectionId),
        before ? lt(messages.id, before) : undefined,
      ))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(pageSize + 1),
    getDb()
      .select({ readReceiptsEnabled: profiles.readReceiptsEnabled })
      .from(profiles)
      .where(eq(profiles.userId, mateId))
      .limit(1)
      .catch(() => []),
  ]);
  const hasMore = newestRows.length > pageSize;
  const rows = newestRows.slice(0, pageSize).reverse();
  const isA=aliasSet.has(connection.userAId);
  const mateAllowsReadReceipts=mateProfiles[0]?.readReceiptsEnabled!==false;
  const mateLastRead=mateAllowsReadReceipts
    ? isA?connection.userBLastReadAt:connection.userALastReadAt
    : null;
  runInBackground(
    getDb().update(connections).set(isA?{userALastReadAt:new Date()}:{userBLastReadAt:new Date()}).where(eq(connections.id,connection.id)),
    "Chat read receipt",
  );
  return Response.json({
    messages: rows.map((row) =>
      serializeMessage(row, aliasSet, mateLastRead),
    ),
    hasMore,
    nextCursor: rows[0]?.id ?? null,
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "ログインが必要です", signIn }, { status: 401 });
  if(await isSuspended(user.userId))return Response.json({error:"このアカウントは現在利用できません"},{status:403});
  const rateLimit=await checkRateLimit(user.userId,{action:"message",limit:30,windowMs:60_000});
  if(!rateLimit.allowed)return rateLimitResponse(rateLimit.retryAfter);
  const payload = await request.json() as {
    connectionId?: number;
    body?: string;
    clientId?: string;
    kind?: "text" | "play_invite";
  };
  const kind = payload.kind === "play_invite" ? "play_invite" : "text";
  const body = kind === "play_invite" ? playInviteBody : payload.body?.trim();
  const clientId = typeof payload.clientId === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(payload.clientId) ? payload.clientId : null;
  if (!payload.connectionId || !body) return Response.json({ error: "メッセージを入力してください" }, { status: 400 });
  if (body.length > 300) return Response.json({ error: "メッセージは300文字以内です" }, { status: 400 });
  if (kind === "text" && containsProhibitedContent(body)) return Response.json({ error: prohibitedContentMessage }, { status: 400 });
  const aliases = await identityAliases(user.userId, user.email);
  const aliasSet = new Set(aliases);
  const connection = await getMembership(payload.connectionId, aliases);
  if (!connection) return Response.json({ error: "マッチが見つかりません" }, { status: 404 });
  const mateId = aliasSet.has(connection.userAId) ? connection.userBId : connection.userAId;
  if (await isBlocked(aliases, mateId)) return Response.json({ error: "この相手にはメッセージを送れません" }, { status: 403 });
  if (kind === "play_invite") {
    const [pendingInvite] = await getDb().select({ id: messages.id }).from(messages).where(and(
      eq(messages.connectionId, payload.connectionId),
      eq(messages.kind, "play_invite"),
      isNull(messages.response),
    )).limit(1);
    if (pendingInvite) return Response.json({ error: "返事待ちのプレイ招待があります" }, { status: 409 });
  }
  let createdMessage: typeof messages.$inferSelect | undefined;
  try {
    [createdMessage] = await getDb().insert(messages).values({
      connectionId: payload.connectionId,
      senderId: user.userId,
      clientId,
      body,
      kind,
      createdAt: new Date(),
    }).onConflictDoNothing().returning();
  } catch (error) {
    if (kind === "play_invite") {
      return Response.json({ error: "返事待ちのプレイ招待があります" }, { status: 409 });
    }
    throw error;
  }
  const [message] = createdMessage
    ? [createdMessage]
    : clientId
      ? await getDb().select().from(messages).where(and(eq(messages.senderId,user.userId),eq(messages.clientId,clientId))).limit(1)
      : [];
  if (!message && kind === "play_invite") {
    return Response.json({ error: "返事待ちのプレイ招待があります" }, { status: 409 });
  }
  if(!message)return Response.json({error:"送信結果を確認できませんでした"},{status:500});
  if(!createdMessage)return Response.json({ message: serializeMessage(message, aliasSet) });
  const senderName=aliasSet.has(connection.userAId)?connection.userAName:connection.userBName;
  runInBackground(
    sendPush(
      mateId,
      kind === "play_invite"
        ? `${senderName}さんからプレイのお誘い`
        : `${senderName}さんからメッセージ`,
      body.slice(0,80),
      `/?chat=${connection.id}`,
    ),
    "Message push",
  );
  return Response.json({ message: serializeMessage(message, aliasSet) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "ログインが必要です", signIn }, { status: 401 });
  if (await isSuspended(user.userId)) return Response.json({ error: "このアカウントは現在利用できません" }, { status: 403 });
  const rateLimit = await checkRateLimit(user.userId, {
    action: "play-invite-response",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);
  const payload = await request.json() as {
    messageId?: number;
    response?: "accepted" | "declined";
  };
  if (!Number.isInteger(payload.messageId) || !["accepted", "declined"].includes(payload.response || "")) {
    return Response.json({ error: "回答を選んでください" }, { status: 400 });
  }
  const [invite] = await getDb().select().from(messages).where(eq(messages.id, payload.messageId!)).limit(1);
  if (!invite || invite.kind !== "play_invite") return Response.json({ error: "プレイ招待が見つかりません" }, { status: 404 });
  const aliases = await identityAliases(user.userId, user.email);
  const aliasSet = new Set(aliases);
  const connection = await getMembership(invite.connectionId, aliases);
  if (!connection) return Response.json({ error: "マッチが見つかりません" }, { status: 404 });
  if (aliasSet.has(invite.senderId)) return Response.json({ error: "送信者は回答できません" }, { status: 403 });
  if (await isBlocked(aliases, invite.senderId)) return Response.json({ error: "この招待には回答できません" }, { status: 403 });
  const [updated] = await getDb().update(messages).set({
    response: payload.response!,
    respondedAt: new Date(),
  }).where(and(eq(messages.id, invite.id), isNull(messages.response))).returning();
  if (!updated) return Response.json({ error: "この招待には回答済みです" }, { status: 409 });
  const responderName = aliasSet.has(connection.userAId)
    ? connection.userAName
    : connection.userBName;
  runInBackground(
    sendPush(
      invite.senderId,
      payload.response === "accepted"
        ? `${responderName}さんがプレイ招待を承認しました`
        : `${responderName}さんがプレイ招待を見送りました`,
      payload.response === "accepted"
        ? "チャットからDiscordへ合流できます"
        : "また都合のいい時に誘ってみましょう",
      `/?chat=${connection.id}`,
    ),
    "Play invite response push",
  );
  return Response.json({ message: serializeMessage(updated, aliasSet) });
}
