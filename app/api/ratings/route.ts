import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { connectionRatings, connections } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { isSuspended } from "../../../lib/safety";

const allowedTags = new Set([
  "マナーが良い",
  "連携しやすい",
  "雰囲気が良い",
  "VCしやすい",
]);

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn: "/login" },
      { status: 401 },
    );
  if (await isSuspended(user.userId))
    return Response.json(
      { error: "このアカウントは現在利用できません" },
      { status: 403 },
    );
  const rateLimit = await checkRateLimit(user.userId, {
    action: "mate-rating",
    limit: 12,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  const payload = (await request.json()) as {
    connectionId?: number;
    score?: number;
    tags?: unknown[];
  };
  const connectionId = Number(payload.connectionId);
  const score = Number(payload.score);
  const tags = Array.isArray(payload.tags)
    ? [
        ...new Set(
          payload.tags.filter(
            (value): value is string =>
              typeof value === "string" && allowedTags.has(value),
          ),
        ),
      ].slice(0, 4)
    : [];
  if (!Number.isInteger(connectionId) || !Number.isInteger(score) || score < 1 || score > 5)
    return Response.json({ error: "評価内容を確認してください" }, { status: 400 });

  const db = getDb();
  const [connection] = await db
    .select()
    .from(connections)
    .where(eq(connections.id, connectionId))
    .limit(1);
  if (!connection || (connection.userAId !== user.userId && connection.userBId !== user.userId))
    return Response.json({ error: "マッチが見つかりません" }, { status: 404 });
  const isA = connection.userAId === user.userId;
  if (!(isA ? connection.userAPlayed : connection.userBPlayed))
    return Response.json(
      { error: "先に「一緒に遊んだ」を記録してください" },
      { status: 409 },
    );
  const ratedUserId = isA ? connection.userBId : connection.userAId;
  const now = new Date();
  await db
    .insert(connectionRatings)
    .values({
      connectionId,
      raterId: user.userId,
      ratedUserId,
      score,
      tags: JSON.stringify(tags),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [connectionRatings.connectionId, connectionRatings.raterId],
      set: { score, tags: JSON.stringify(tags), updatedAt: now },
    });
  return Response.json({ ok: true, score, tags });
}
