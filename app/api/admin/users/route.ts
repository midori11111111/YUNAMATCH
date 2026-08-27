import { desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
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

async function avatarId(userId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(userId),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function deleteAccount(userId: string) {
  const d1 = env.DB;
  await d1.batch([
    d1.prepare("DELETE FROM connection_ratings WHERE rater_id = ? OR rated_user_id = ?").bind(userId, userId),
    d1.prepare("DELETE FROM message_reactions WHERE user_id = ? OR message_id IN (SELECT messages.id FROM messages INNER JOIN connections ON messages.connection_id = connections.id WHERE connections.user_a_id = ? OR connections.user_b_id = ?)").bind(userId, userId, userId),
    d1.prepare("DELETE FROM message_favorites WHERE user_id = ? OR connection_id IN (SELECT id FROM connections WHERE user_a_id = ? OR user_b_id = ?)").bind(userId, userId, userId),
    d1.prepare("DELETE FROM messages WHERE connection_id IN (SELECT id FROM connections WHERE user_a_id = ? OR user_b_id = ?)").bind(userId, userId),
    d1.prepare("DELETE FROM presence WHERE user_id = ?").bind(userId),
    d1.prepare("DELETE FROM lobby_members WHERE user_id = ? OR lobby_id IN (SELECT id FROM lobbies WHERE owner_id = ?)").bind(userId, userId),
    d1.prepare("DELETE FROM lobbies WHERE owner_id = ?").bind(userId),
    d1.prepare("DELETE FROM mutual_like_matches WHERE user_low_id = ? OR user_high_id = ? OR connection_id IN (SELECT id FROM connections WHERE user_a_id = ? OR user_b_id = ?)").bind(userId, userId, userId, userId),
    d1.prepare("DELETE FROM connections WHERE user_a_id = ? OR user_b_id = ?").bind(userId, userId),
    d1.prepare("DELETE FROM application_messages WHERE sender_id = ? OR application_id IN (SELECT applications.id FROM applications INNER JOIN recruits ON applications.recruit_id = recruits.id WHERE applications.applicant_id = ? OR recruits.owner_id = ?)").bind(userId, userId, userId),
    d1.prepare("DELETE FROM applications WHERE applicant_id = ? OR recruit_id IN (SELECT id FROM recruits WHERE owner_id = ?)").bind(userId, userId),
    d1.prepare("DELETE FROM reports WHERE reporter_id = ? OR target_id = ?").bind(userId, userId),
    d1.prepare("DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?").bind(userId, userId),
    d1.prepare("DELETE FROM profile_likes WHERE sender_id = ? OR recipient_id = ?").bind(userId, userId),
    d1.prepare("DELETE FROM notification_dismissals WHERE user_id = ?").bind(userId),
    d1.prepare("DELETE FROM support_tickets WHERE user_id = ?").bind(userId),
    d1.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").bind(userId),
    d1.prepare("DELETE FROM recruit_alerts WHERE user_id = ?").bind(userId),
    d1.prepare("DELETE FROM recruits WHERE owner_id = ?").bind(userId),
    d1.prepare("DELETE FROM account_links WHERE canonical_user_id = ?").bind(userId),
    d1.prepare("UPDATE site_visitors SET user_id = NULL WHERE user_id = ?").bind(userId),
    d1.prepare("DELETE FROM rate_limit_buckets WHERE substr(key, -length(?)) = ?").bind(userId, userId),
    d1.prepare("DELETE FROM profiles WHERE user_id = ?").bind(userId),
  ]);
  const media = (env as unknown as { MEDIA?: R2Bucket }).MEDIA;
  if (media) {
    const id = await avatarId(userId);
    await Promise.all([
      media.delete(`avatars/${id}`),
      media.delete(`headers/${id}`),
    ]);
  }
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
    confirmation?: unknown;
  };
  const userId = typeof payload.userId === "string" ? payload.userId : "";
  const action = payload.action === "suspend" || payload.action === "restore" || payload.action === "delete"
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

  if (action === "delete") {
    if (payload.confirmation !== profile.trainerName)
      return Response.json(
        { error: "確認のためトレーナー名を正確に入力してください" },
        { status: 400 },
      );
    await deleteAccount(userId);
    return Response.json({ ok: true, userId, deleted: true });
  }

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
