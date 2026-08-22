import { and, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { blocks, connections, recruits, reports } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";

const allowedReasons = new Set(["出会い目的", "迷惑行為", "暴言・嫌がらせ", "なりすまし", "不正なプロフィール", "不適切なプロフィール画像", "その他"]);

async function resolveTarget(userId: string, recruitId?: number, connectionId?: number) {
  const db = getDb();
  if (recruitId) {
    const [row] = await db.select({ targetId: recruits.ownerId }).from(recruits).where(eq(recruits.id, recruitId)).limit(1);
    return row?.targetId ?? null;
  }
  if (connectionId) {
    const [row] = await db.select().from(connections).where(and(
      eq(connections.id, connectionId),
      or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
    )).limit(1);
    if (!row) return null;
    return row.userAId === userId ? row.userBId : row.userAId;
  }
  return null;
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "ログインが必要です", signIn: "/login" }, { status: 401 });
  const rateLimit=await checkRateLimit(user.userId,{action:"safety",limit:8,windowMs:60*60_000});
  if(!rateLimit.allowed)return rateLimitResponse(rateLimit.retryAfter);
  const payload = await request.json() as {
    action?: "block" | "report";
    recruitId?: number;
    connectionId?: number;
    reason?: string;
    details?: string;
    alsoBlock?: boolean;
  };
  const targetId = await resolveTarget(user.userId, payload.recruitId, payload.connectionId);
  if (!targetId || targetId === user.userId) return Response.json({ error: "対象を確認してください" }, { status: 400 });
  const db = getDb();

  if (payload.action === "block") {
    await db.insert(blocks).values({ blockerId: user.userId, blockedId: targetId, createdAt: new Date() }).onConflictDoNothing();
    return Response.json({ ok: true });
  }

  if (payload.action === "report") {
    if (!payload.reason || !allowedReasons.has(payload.reason)) return Response.json({ error: "通報理由を選択してください" }, { status: 400 });
    const [existingReport] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, user.userId),
          eq(reports.targetId, targetId),
        ),
      )
      .limit(1);
    if (existingReport) {
      if (payload.alsoBlock) {
        await db.insert(blocks).values({ blockerId: user.userId, blockedId: targetId, createdAt: new Date() }).onConflictDoNothing();
      }
      return Response.json({ ok: true, created: false, alreadyReported: true });
    }
    await db.insert(reports).values({
      reporterId: user.userId,
      targetId,
      recruitId: payload.recruitId,
      connectionId: payload.connectionId,
      reason: payload.reason,
      details: payload.details?.trim().slice(0, 500) ?? "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if (payload.alsoBlock) {
      await db.insert(blocks).values({ blockerId: user.userId, blockedId: targetId, createdAt: new Date() }).onConflictDoNothing();
    }
    return Response.json({ ok: true, created: true, alreadyReported: false });
  }

  return Response.json({ error: "操作を確認してください" }, { status: 400 });
}
