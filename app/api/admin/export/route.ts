import { getDb } from "../../../../db";
import {
  accountLinks,
  applications,
  blocks,
  connectionRatings,
  connections,
  dailyVisitors,
  lobbies,
  lobbyMembers,
  messages,
  profiles,
  recruits,
  reports,
  siteVisitors,
  supportTickets,
} from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin";

export async function GET() {
  if (!(await requireAdmin()))
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const db = getDb();
  const [
    profileRows,
    accountRows,
    recruitRows,
    applicationRows,
    connectionRows,
    messageRows,
    ratingRows,
    lobbyRows,
    lobbyMemberRows,
    blockRows,
    reportRows,
    ticketRows,
    visitorRows,
    dailyRows,
  ] = await Promise.all([
    db.select().from(profiles),
    db.select().from(accountLinks),
    db.select().from(recruits),
    db.select().from(applications),
    db.select().from(connections),
    db.select().from(messages),
    db.select().from(connectionRatings),
    db.select().from(lobbies),
    db.select().from(lobbyMembers),
    db.select().from(blocks),
    db.select().from(reports),
    db.select().from(supportTickets),
    db.select().from(siteVisitors),
    db.select().from(dailyVisitors),
  ]);
  const generatedAt = new Date();
  return new Response(
    JSON.stringify(
      {
        schemaVersion: 2,
        generatedAt: generatedAt.toISOString(),
        profiles: profileRows,
        accountLinks: accountRows,
        recruits: recruitRows,
        applications: applicationRows,
        connections: connectionRows,
        messages: messageRows,
        connectionRatings: ratingRows,
        lobbies: lobbyRows,
        lobbyMembers: lobbyMemberRows,
        blocks: blockRows,
        reports: reportRows,
        supportTickets: ticketRows,
        siteVisitors: visitorRows,
        dailyVisitors: dailyRows,
      },
      null,
      2,
    ),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="yunamatch-backup-${generatedAt.toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    },
  );
}
