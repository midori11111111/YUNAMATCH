import { and, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  blocks,
  connections,
  messageReactions,
  messages,
} from "../../../db/schema";
import { identityAliases } from "../../../lib/account-aliases";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { isSuspended } from "../../../lib/safety";
import { getChatGPTUser } from "../../chatgpt-auth";

const allowedReactions = new Set(["👍", "❤️", "😂", "🎮"]);

async function reactionState(messageId: number, aliases: string[]) {
  const rows = await getDb()
    .select({ userId: messageReactions.userId, reaction: messageReactions.reaction })
    .from(messageReactions)
    .where(eq(messageReactions.messageId, messageId));
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(row.reaction, (counts.get(row.reaction) || 0) + 1);
  return {
    messageId,
    reactions: [...counts].map(([reaction, count]) => ({ reaction, count })),
    myReaction: rows.find((row) => aliases.includes(row.userId))?.reaction || null,
  };
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "ログインが必要です", signIn: "/login" }, { status: 401 });
  if (await isSuspended(user.userId))
    return Response.json({ error: "このアカウントは現在利用できません" }, { status: 403 });
  const rateLimit = await checkRateLimit(user.userId, {
    action: "message-reaction",
    limit: 60,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);
  const payload = (await request.json().catch(() => ({}))) as {
    messageId?: number;
    reaction?: string | null;
  };
  const messageId = Number(payload.messageId);
  const reaction = typeof payload.reaction === "string" ? payload.reaction : null;
  if (!Number.isInteger(messageId) || messageId <= 0)
    return Response.json({ error: "メッセージを確認してください" }, { status: 400 });
  if (reaction !== null && !allowedReactions.has(reaction))
    return Response.json({ error: "リアクションを選んでください" }, { status: 400 });

  const aliases = await identityAliases(user.userId, user.email);
  const aliasSet = new Set(aliases);
  const [message] = await getDb()
    .select({
      id: messages.id,
      senderId: messages.senderId,
      deletedAt: messages.deletedAt,
      userAId: connections.userAId,
      userBId: connections.userBId,
    })
    .from(messages)
    .innerJoin(connections, eq(messages.connectionId, connections.id))
    .where(
      and(
        eq(messages.id, messageId),
        or(inArray(connections.userAId, aliases), inArray(connections.userBId, aliases)),
      ),
    )
    .limit(1);
  if (!message || message.deletedAt)
    return Response.json({ error: "このメッセージにはリアクションできません" }, { status: 404 });
  const mateId = aliasSet.has(message.userAId) ? message.userBId : message.userAId;
  const [blocked] = await getDb()
    .select({ id: blocks.id })
    .from(blocks)
    .where(
      or(
        and(inArray(blocks.blockerId, aliases), eq(blocks.blockedId, mateId)),
        and(eq(blocks.blockerId, mateId), inArray(blocks.blockedId, aliases)),
      ),
    )
    .limit(1);
  if (blocked)
    return Response.json({ error: "この相手にはリアクションできません" }, { status: 403 });

  const db = getDb();
  await db
    .delete(messageReactions)
    .where(
      and(
        eq(messageReactions.messageId, messageId),
        inArray(messageReactions.userId, aliases),
      ),
    );
  if (reaction) {
    const now = new Date();
    await db.insert(messageReactions).values({
      messageId,
      userId: user.userId,
      reaction,
      createdAt: now,
      updatedAt: now,
    });
  }
  return Response.json(await reactionState(messageId, aliases));
}
