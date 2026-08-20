import { and, asc, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { blocks, connections, messages } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { sendPush } from "../../../lib/push";
import { isSuspended } from "../../../lib/safety";

const signIn = "/login";

async function getMembership(connectionId: number, userId: string) {
  const [connection] = await getDb().select().from(connections).where(and(
    eq(connections.id, connectionId),
    or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
  )).limit(1);
  return connection;
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "ログインが必要です", signIn }, { status: 401 });
  const connectionId = Number(new URL(request.url).searchParams.get("connectionId"));
  if (!Number.isInteger(connectionId)) return Response.json({ error: "マッチを選択してください" }, { status: 400 });
  const connection = await getMembership(connectionId, user.userId);
  if (!connection) return Response.json({ error: "マッチが見つかりません" }, { status: 404 });
  const rows = await getDb().select().from(messages).where(eq(messages.connectionId, connectionId)).orderBy(asc(messages.createdAt)).limit(100);
  const isA=connection.userAId===user.userId;const mateLastRead=isA?connection.userBLastReadAt:connection.userALastReadAt;
  await getDb().update(connections).set(isA?{userALastReadAt:new Date()}:{userBLastReadAt:new Date()}).where(eq(connections.id,connection.id));
  return Response.json({ messages: rows.map((row) => ({
    id: row.id,
    body: row.body,
    sender: row.senderId === user.userId ? "me" : "mate",
    createdAt: row.createdAt,
    read:row.senderId===user.userId&&Boolean(mateLastRead&&row.createdAt<=mateLastRead),
  })) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "ログインが必要です", signIn }, { status: 401 });
  if(await isSuspended(user.userId))return Response.json({error:"このアカウントは現在利用できません"},{status:403});
  const payload = await request.json() as { connectionId?: number; body?: string };
  const body = payload.body?.trim();
  if (!payload.connectionId || !body) return Response.json({ error: "メッセージを入力してください" }, { status: 400 });
  if (body.length > 300) return Response.json({ error: "メッセージは300文字以内です" }, { status: 400 });
  const connection = await getMembership(payload.connectionId, user.userId);
  if (!connection) return Response.json({ error: "マッチが見つかりません" }, { status: 404 });
  const mateId = connection.userAId === user.userId ? connection.userBId : connection.userAId;
  const [blocked] = await getDb().select({ id: blocks.id }).from(blocks).where(or(
    and(eq(blocks.blockerId, user.userId), eq(blocks.blockedId, mateId)),
    and(eq(blocks.blockerId, mateId), eq(blocks.blockedId, user.userId)),
  )).limit(1);
  if (blocked) return Response.json({ error: "この相手にはメッセージを送れません" }, { status: 403 });
  const [message] = await getDb().insert(messages).values({
    connectionId: payload.connectionId,
    senderId: user.userId,
    body,
    createdAt: new Date(),
  }).returning();
  const senderName=connection.userAId===user.userId?connection.userAName:connection.userBName;
  await sendPush(mateId,`${senderName}さんからメッセージ`,body.slice(0,80),`/?chat=${connection.id}`);
  return Response.json({ message: { id: message.id, body: message.body, sender: "me", createdAt: message.createdAt } }, { status: 201 });
}
