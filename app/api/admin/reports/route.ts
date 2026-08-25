import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { profiles, recruits, reports } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin";

export async function GET() {
  if (!(await requireAdmin()))
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });

  const db = getDb();
  const [rows, flaggedRows] = await Promise.all([
    db
      .select({
        id: reports.id,
        targetId: reports.targetId,
        reporterId: reports.reporterId,
        recruitId: reports.recruitId,
        connectionId: reports.connectionId,
        messageId: reports.messageId,
        reportedContent: reports.reportedContent,
        conversationContext: reports.conversationContext,
        reason: reports.reason,
        details: reports.details,
        status: reports.status,
        createdAt: reports.createdAt,
        resolvedAt: reports.resolvedAt,
        targetName: profiles.trainerName,
        avatarUrl: profiles.avatarUrl,
        suspendedAt: profiles.suspendedAt,
      })
      .from(reports)
      .leftJoin(profiles, eq(reports.targetId, profiles.userId))
      .orderBy(desc(reports.createdAt))
      .limit(300),
    db
      .select({
        targetId: reports.targetId,
        targetName: profiles.trainerName,
        avatarUrl: profiles.avatarUrl,
        suspendedAt: profiles.suspendedAt,
        reportCount: sql<number>`count(distinct ${reports.reporterId})`,
        openCount: sql<number>`count(distinct case when ${reports.status} != 'resolved' then ${reports.reporterId} end)`,
        lastReportedAt: sql<number>`max(${reports.createdAt})`,
      })
      .from(reports)
      .leftJoin(profiles, eq(reports.targetId, profiles.userId))
      .groupBy(
        reports.targetId,
        profiles.trainerName,
        profiles.avatarUrl,
        profiles.suspendedAt,
      )
      .having(sql`count(distinct ${reports.reporterId}) >= 5`)
      .orderBy(desc(sql`max(${reports.createdAt})`)),
  ]);

  const flaggedUsers = flaggedRows.map((row) => ({
    ...row,
    reportCount: Number(row.reportCount) || 0,
    openCount: Number(row.openCount) || 0,
  }));
  return Response.json({
    reports: rows.map((row) => {
      let context: unknown[] = [];
      try {
        const parsed = JSON.parse(row.conversationContext || "[]");
        if (Array.isArray(parsed)) context = parsed;
      } catch {
        // Invalid legacy context is treated as an empty, non-viewable excerpt.
      }
      return { ...row, conversationContext: context };
    }),
    flaggedUsers,
  });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin()))
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const payload = (await request.json()) as {
    reportId?: number;
    targetId?: string;
    action?: "resolve" | "suspend" | "restore" | "removeImage";
  };
  if (!payload.action)
    return Response.json({ error: "操作を確認してください" }, { status: 400 });
  const db = getDb();
  if (payload.action === "resolve" && payload.reportId) {
    const now = new Date();
    await db
      .update(reports)
      .set({ status: "resolved", resolvedAt: now, updatedAt: now })
      .where(eq(reports.id, payload.reportId));
  }
  if (payload.targetId && payload.action === "suspend") {
    await db
      .update(profiles)
      .set({ suspendedAt: new Date() })
      .where(eq(profiles.userId, payload.targetId));
    await db
      .update(recruits)
      .set({ status: "closed" })
      .where(eq(recruits.ownerId, payload.targetId));
  }
  if (payload.targetId && payload.action === "restore")
    await db
      .update(profiles)
      .set({ suspendedAt: null })
      .where(eq(profiles.userId, payload.targetId));
  if (payload.targetId && payload.action === "removeImage")
    await db
      .update(profiles)
      .set({ avatarUrl: "" })
      .where(eq(profiles.userId, payload.targetId));
  return Response.json({ ok: true });
}
