import { env } from "cloudflare:workers";
import { and, count, countDistinct, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { applications, connections, dailyVisitors, lobbies, messages, profiles, recruits, siteVisitors } from "../../../../db/schema";
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
  const [totals, todayTotals, daily, funnelCounts, firstApplicationSpeed, retentionD1, retentionD7, genderRows] = await Promise.all([
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
    Promise.all([
      db.select({value:countDistinct(recruits.ownerId)}).from(recruits),
      db.select({value:countDistinct(applications.recruitId)}).from(applications),
      db.select({value:count()}).from(connections),
      db.select({value:countDistinct(messages.connectionId)}).from(messages),
      db.select({value:count()}).from(lobbies).where(eq(lobbies.status,"finished")),
      db.select({value:count()}).from(connections).where(and(eq(connections.userAAgain,true),eq(connections.userBAgain,true))),
    ]),
    env.DB.prepare(`SELECT coalesce(avg((first_application_at-created_at)/60000.0),0) AS avg_minutes, count(*) AS applied_recruits, coalesce(sum(CASE WHEN first_application_at-created_at<=900000 THEN 1 ELSE 0 END),0) AS within_15 FROM (SELECT r.id,r.created_at,min(a.created_at) AS first_application_at FROM recruits r INNER JOIN applications a ON a.recruit_id=r.id GROUP BY r.id)`).first<{avg_minutes:number;applied_recruits:number;within_15:number}>(),
    env.DB.prepare(`WITH cohorts AS (SELECT visitor_key,date(first_seen_at/1000,'unixepoch','+9 hours') AS cohort_day FROM site_visitors), eligible AS (SELECT * FROM cohorts WHERE cohort_day<=date('now','+9 hours','-1 day')) SELECT count(*) AS eligible,coalesce(sum(CASE WHEN EXISTS(SELECT 1 FROM daily_visitors d WHERE d.visitor_key=eligible.visitor_key AND d.day=date(eligible.cohort_day,'+1 day')) THEN 1 ELSE 0 END),0) AS returned FROM eligible`).first<{eligible:number;returned:number}>(),
    env.DB.prepare(`WITH cohorts AS (SELECT visitor_key,date(first_seen_at/1000,'unixepoch','+9 hours') AS cohort_day FROM site_visitors), eligible AS (SELECT * FROM cohorts WHERE cohort_day<=date('now','+9 hours','-7 day')) SELECT count(*) AS eligible,coalesce(sum(CASE WHEN EXISTS(SELECT 1 FROM daily_visitors d WHERE d.visitor_key=eligible.visitor_key AND d.day=date(eligible.cohort_day,'+7 day')) THEN 1 ELSE 0 END),0) AS returned FROM eligible`).first<{eligible:number;returned:number}>(),
    db.select({ gender: profiles.gender, value: count() }).from(profiles).groupBy(profiles.gender),
  ]);

  const registered=totals[3][0]?.value??0,recruitTotal=totals[4][0]?.value??0,applicationTotal=totals[5][0]?.value??0;
  const recruiterCount=funnelCounts[0][0]?.value??0,recruitsWithApplication=funnelCounts[1][0]?.value??0,matchCount=funnelCounts[2][0]?.value??0,chattedMatches=funnelCounts[3][0]?.value??0,finishedPlays=funnelCounts[4][0]?.value??0,mutualAgain=funnelCounts[5][0]?.value??0;
  const percent=(value:number,total:number)=>total?Math.round(value/total*1000)/10:0;
  const male=genderRows.find((row)=>row.gender==="男性")?.value??0;
  const female=genderRows.find((row)=>row.gender==="女性")?.value??0;
  const genderTotal=male+female;

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
    funnel:{
      visitToRegistration:percent(registered,totals[0][0]?.value??0),
      registrationToRecruit:percent(recruiterCount,registered),
      recruitToApplication:percent(recruitsWithApplication,recruitTotal),
      applicationToMatch:percent(matchCount,applicationTotal),
      matchToChat:percent(chattedMatches,matchCount),
      matchToFinishedPlay:percent(finishedPlays,matchCount),
      matchToMutualAgain:percent(mutualAgain,matchCount),
      counts:{recruiters:recruiterCount,recruitsWithApplication,matches:matchCount,chattedMatches,finishedPlays,mutualAgain},
    },
    speed:{averageMinutes:Math.round(Number(firstApplicationSpeed?.avg_minutes??0)),within15Rate:percent(Number(firstApplicationSpeed?.within_15??0),Number(firstApplicationSpeed?.applied_recruits??0)),sampleSize:Number(firstApplicationSpeed?.applied_recruits??0)},
    retention:{d1:{rate:percent(Number(retentionD1?.returned??0),Number(retentionD1?.eligible??0)),eligible:Number(retentionD1?.eligible??0)},d7:{rate:percent(Number(retentionD7?.returned??0),Number(retentionD7?.eligible??0)),eligible:Number(retentionD7?.eligible??0)}},
    demographics:{male,female,total:genderTotal,maleRate:percent(male,genderTotal),femaleRate:percent(female,genderTotal)},
  });
}
