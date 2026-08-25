import { and, desc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { connections, messageFavorites, messages } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

async function getMembership(connectionId: number, userId: string) {
  const [connection] = await getDb()
    .select()
    .from(connections)
    .where(and(
      eq(connections.id, connectionId),
      or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
    ))
    .limit(1);
  return connection;
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "ログインが必要です", signIn: "/login" }, { status: 401 });
  const connectionId = Number(new URL(request.url).searchParams.get("connectionId"));
  if (!Number.isInteger(connectionId) || connectionId < 1)
    return Response.json({ error: "チャットを選択してください" }, { status: 400 });
  const connection = await getMembership(connectionId, user.userId);
  if (!connection)
    return Response.json({ error: "チャットが見つかりません" }, { status: 404 });
  const rows = await getDb()
    .select({
      messageId: messages.id,
      body: messages.body,
      senderId: messages.senderId,
      kind: messages.kind,
      createdAt: messages.createdAt,
      favoritedAt: messageFavorites.createdAt,
    })
    .from(messageFavorites)
    .innerJoin(messages, eq(messageFavorites.messageId, messages.id))
    .where(and(
      eq(messageFavorites.userId, user.userId),
      eq(messageFavorites.connectionId, connectionId),
      isNull(messages.deletedAt),
    ))
    .orderBy(desc(messageFavorites.createdAt))
    .limit(100);
  return Response.json({
    favorites: rows.map((row) => ({
      ...row,
      sender: row.senderId === user.userId ? "me" : "mate",
      senderName:
        row.senderId === connection.userAId
          ? connection.userAName
          : connection.userBName,
    })),
    favoriteMessageIds: rows.map((row) => row.messageId),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "ログインが必要です", signIn: "/login" }, { status: 401 });
  const payload = (await request.json()) as { messageId?: number };
  if (!Number.isInteger(payload.messageId) || !payload.messageId)
    return Response.json({ error: "メッセージを選択してください" }, { status: 400 });
  const db = getDb();
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, payload.messageId))
    .limit(1);
  if (!message || message.deletedAt)
    return Response.json({ error: "メッセージが見つかりません" }, { status: 404 });
  const connection = await getMembership(message.connectionId, user.userId);
  if (!connection)
    return Response.json({ error: "メッセージが見つかりません" }, { status: 404 });
  const [existing] = await db
    .select({ id: messageFavorites.id })
    .from(messageFavorites)
    .where(and(
      eq(messageFavorites.userId, user.userId),
      eq(messageFavorites.messageId, message.id),
    ))
    .limit(1);
  if (existing) {
    await db.delete(messageFavorites).where(eq(messageFavorites.id, existing.id));
    return Response.json({ ok: true, favorited: false });
  }
  await db.insert(messageFavorites).values({
    userId: user.userId,
    connectionId: message.connectionId,
    messageId: message.id,
    createdAt: new Date(),
  });
  return Response.json({ ok: true, favorited: true });
}
