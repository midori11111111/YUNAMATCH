import { count, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { applications, dailyVisitors, profiles, recruits, siteVisitors } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin";

function japanDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });

  const db = getDb();
  const today = japanDay(new Date());
  const since = japanDay(new Date(Date.now() - 13 * 24 * 60 * 60 * 1000));
  const [totals, todayTotals, daily] = await Promise.all([
    Promise.all([
      db.select({ value: count() }).from(siteVisitors),
      db.select({ value: sql<number>`coalesce(sum(${siteVisitors.visitCount}), 0)` }).from(siteVisitors),
      db.select({ value: count() }).from(siteVisitors).where(isNotNull(siteVisitors.userId)),
      db.select({ value: count() }).from(profiles),
      db.select({ value: count() }).from(recruits),
      db.select({ value: count() }).from(applications),
    ]),
    db.select({
      visitors: count(),
      views: sql<number>`coalesce(sum(${dailyVisitors.pageViews}), 0)`,
    }).from(dailyVisitors).where(sql`${dailyVisitors.day} = ${today}`),
    db.select({
      day: dailyVisitors.day,
      visitors: count(),
      views: sql<number>`coalesce(sum(${dailyVisitors.pageViews}), 0)`,
    }).from(dailyVisitors).where(gte(dailyVisitors.day, since)).groupBy(dailyVisitors.day).orderBy(dailyVisitors.day),
  ]);

  return Response.json({
    today,
    totals: {
      uniqueVisitors: totals[0][0]?.value ?? 0,
      pageViews: Number(totals[1][0]?.value ?? 0),
      signedInVisitors: totals[2][0]?.value ?? 0,
      registeredUsers: totals[3][0]?.value ?? 0,
      recruits: totals[4][0]?.value ?? 0,
      applications: totals[5][0]?.value ?? 0,
      todayVisitors: todayTotals[0]?.visitors ?? 0,
      todayViews: Number(todayTotals[0]?.views ?? 0),
    },
    daily: daily.map((row) => ({
      day: row.day,
      visitors: row.visitors,
      views: Number(row.views),
    })),
  });
}
