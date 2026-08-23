import { desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { profiles, recruits, reports } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin";

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed))
      return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    // Keep supporting profiles stored before array fields were introduced.
  }
  return value.trim() ? [value.trim()] : [];
}

export async function GET(request: Request) {
  if (!(await requireAdmin()))
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 40) ?? "";
  if (!query) return Response.json({ users: [] });

  const db = getDb();
  const rows = await db
    .select({
      userId: profiles.userId,
      trainerName: profiles.trainerName,
      avatarUrl: profiles.avatarUrl,
      gender: profiles.gender,
      age: profiles.age,
      highestRate: profiles.highestRate,
      mainPokemon: profiles.mainPokemon,
      authProvider: profiles.authProvider,
      suspendedAt: profiles.suspendedAt,
      createdAt: profiles.createdAt,
      updatedAt: profiles.updatedAt,
    })
    .from(profiles)
    .where(
      or(
        eq(profiles.trainerName, query),
        like(profiles.trainerName, `%${query}%`),
      ),
    )
    .orderBy(
      sql`case when ${profiles.trainerName} = ${query} then 0 else 1 end`,
      desc(profiles.updatedAt),
    )
    .limit(25);

  const reportCounts = rows.length
    ? await db
        .select({
          userId: reports.targetId,
          count: sql<number>`count(distinct ${reports.reporterId})`,
        })
        .from(reports)
        .where(inArray(reports.targetId, rows.map((row) => row.userId)))
        .groupBy(reports.targetId)
    : [];
  const reportsByUser = new Map(
    reportCounts.map((row) => [row.userId, Number(row.count) || 0]),
  );

  return Response.json({
    users: rows.map((row) => ({
      ...row,
      mainPokemon: parseList(row.mainPokemon).slice(0, 5),
      reportCount: reportsByUser.get(row.userId) || 0,
    })),
  });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin()))
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });

  const payload = (await request.json().catch(() => ({}))) as {
    userId?: unknown;
    action?: unknown;
  };
  const userId = typeof payload.userId === "string" ? payload.userId : "";
  const action = payload.action === "suspend" || payload.action === "restore"
    ? payload.action
    : null;
  if (!userId || !action)
    return Response.json({ error: "対象と操作を確認してください" }, { status: 400 });

  const db = getDb();
  const [profile] = await db
    .select({ userId: profiles.userId, trainerName: profiles.trainerName })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile)
    return Response.json({ error: "アカウントが見つかりません" }, { status: 404 });

  const now = new Date();
  const suspendedAt = action === "suspend" ? now : null;
  await db
    .update(profiles)
    .set({ suspendedAt, updatedAt: now })
    .where(eq(profiles.userId, userId));
  if (action === "suspend")
    await db
      .update(recruits)
      .set({ status: "closed" })
      .where(eq(recruits.ownerId, userId));

  return Response.json({
    ok: true,
    userId,
    trainerName: profile.trainerName,
    suspendedAt,
  });
}
