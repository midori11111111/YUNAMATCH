import { and, asc, desc, eq, gt, inArray, lte, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { blocks, connections, messages, profiles, recruits, reports } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { identityAliases } from "../../../lib/account-aliases";

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

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn: "/login" },
      { status: 401 },
    );
  const aliases = await identityAliases(user.userId, user.email);
  const rows = await getDb()
    .select({
      id: blocks.id,
      userId: blocks.blockedId,
      trainerName: profiles.trainerName,
      avatarUrl: profiles.avatarUrl,
      createdAt: blocks.createdAt,
    })
    .from(blocks)
    .leftJoin(profiles, eq(blocks.blockedId, profiles.userId))
    .where(inArray(blocks.blockerId, aliases))
    .orderBy(desc(blocks.createdAt));
  return Response.json({
    users: rows.map((row) => ({
      ...row,
      trainerName: row.trainerName || "退会済みユーザー",
      avatarUrl: row.avatarUrl || "",
    })),
  });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn: "/login" },
      { status: 401 },
    );
  const body = (await request.json().catch(() => ({}))) as {
    blockId?: number;
  };
  const blockId = Number(body.blockId);
  if (!Number.isInteger(blockId) || blockId <= 0)
    return Response.json({ error: "解除するユーザーを確認してください" }, { status: 400 });
  const aliases = await identityAliases(user.userId, user.email);
  const [removed] = await getDb()
    .delete(blocks)
    .where(and(eq(blocks.id, blockId), inArray(blocks.blockerId, aliases)))
    .returning({ id: blocks.id });
  if (!removed)
    return Response.json({ error: "ブロック情報が見つかりません" }, { status: 404 });
  return Response.json({ ok: true });
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
    messageId?: number;
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
    let reportedContent = "";
    let conversationContext = "[]";
    if (payload.messageId !== undefined) {
      if (!Number.isInteger(payload.messageId) || !payload.connectionId) {
        return Response.json({ error: "通報する発言を確認してください" }, { status: 400 });
      }
      const [reportedMessage] = await db
        .select()
        .from(messages)
        .where(and(eq(messages.id, payload.messageId), eq(messages.connectionId, payload.connectionId)))
        .limit(1);
      if (!reportedMessage || reportedMessage.senderId !== targetId) {
        return Response.json({ error: "相手の発言を確認できませんでした" }, { status: 400 });
      }
      const [connection, previous, following] = await Promise.all([
        db.select().from(connections).where(eq(connections.id, payload.connectionId)).limit(1),
        db.select().from(messages).where(and(
          eq(messages.connectionId, payload.connectionId),
          lte(messages.id, reportedMessage.id),
        )).orderBy(desc(messages.id)).limit(3),
        db.select().from(messages).where(and(
          eq(messages.connectionId, payload.connectionId),
          gt(messages.id, reportedMessage.id),
        )).orderBy(asc(messages.id)).limit(2),
      ]);
      const match = connection[0];
      if (!match) return Response.json({ error: "チャットを確認できませんでした" }, { status: 400 });
      reportedContent = reportedMessage.body;
      conversationContext = JSON.stringify([...previous.reverse(), ...following].map((message) => ({
        id: message.id,
        senderName: message.senderId === match.userAId ? match.userAName : match.userBName,
        body: message.body,
        kind: message.kind,
        createdAt: message.createdAt.getTime(),
        isReported: message.id === reportedMessage.id,
      })));
    }
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
      if (payload.messageId) {
        const now = new Date();
        await db.update(reports).set({
          messageId: payload.messageId,
          reportedContent,
          conversationContext,
          reason: payload.reason,
          details: payload.details?.trim().slice(0, 500) ?? "",
          status: "open",
          updatedAt: now,
          resolvedAt: null,
        }).where(eq(reports.id, existingReport.id));
      }
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
      messageId: payload.messageId,
      reportedContent,
      conversationContext,
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
