import { and, desc, eq, gte, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  serviceBlocks,
  serviceConnections,
  serviceLikes,
  serviceProfiles,
} from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { matchesShoenmateRole, normalizeShoenmateTier, shoenmateCharacterSet, shoenmateTierDatabaseValues, shoenmateUsername } from "../../../../../lib/shoenmate-profile";
import {
  cleanText,
  isServiceId,
  serviceConfig,
} from "../../../../../lib/service-config";

function output(row: typeof serviceProfiles.$inferSelect) {
  const username = row.serviceId === "shoenmate"
    ? shoenmateUsername(row.displayName, row.gameIdentity)
    : "";
  return {
    id: row.id,
    displayName: username || row.displayName,
    gameIdentity: username || row.gameIdentity,
    skillTier: row.serviceId === "shoenmate" ? normalizeShoenmateTier(row.skillTier) : row.skillTier,
    roles: JSON.parse(row.roles) as string[],
    characters: JSON.parse(row.characters) as string[],
    playTimes: JSON.parse(row.playTimes) as string[],
    age: row.age,
    gender: row.showGender && row.age >= 18 ? row.gender : "",
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    updatedAt: row.updatedAt,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const { service } = await params;
  if (!isServiceId(service))
    return Response.json({ error: "サービスIDが不正です" }, { status: 404 });
  const url = new URL(request.url),
    before = Number(url.searchParams.get("before") || 0),
    role = cleanText(url.searchParams.get("role"), 40),
    tier = cleanText(url.searchParams.get("tier"), 40),
    query = cleanText(url.searchParams.get("q"), 24),
    character = cleanText(url.searchParams.get("character"), 40),
    activity = cleanText(url.searchParams.get("activity"), 20),
    config = serviceConfig[service];
  if (role && !config.roles.has(role))
    return Response.json(
      { error: service === "stamate" ? "キャラの指定が不正です" : "役割の指定が不正です" },
      { status: 400 },
    );
  if (tier && !config.tiers.has(tier))
    return Response.json({ error: "ランクの指定が不正です" }, { status: 400 });
  if (character && (service !== "shoenmate" || !shoenmateCharacterSet.has(character)))
    return Response.json({ error: "キャラの指定が不正です" }, { status: 400 });
  const activityMinutes = activity === "online" ? 5 : activity === "recent" ? 180 : activity === "today" ? 1440 : 0;
  if (activity && !activityMinutes)
    return Response.json({ error: "活動状況の指定が不正です" }, { status: 400 });
  const user = await getChatGPTUser(),
    db = getDb();
  const [own] = user
    ? await db
        .select({ id: serviceProfiles.id })
        .from(serviceProfiles)
        .where(
          and(
            eq(serviceProfiles.serviceId, service),
            eq(serviceProfiles.userId, user.userId),
          ),
        )
        .limit(1)
    : [];
  let excluded: number[] = [];
  if (own) {
    const [likes, connections, blocks] = await Promise.all([
      db
        .select({ id: serviceLikes.recipientProfileId })
        .from(serviceLikes)
        .where(
          and(
            eq(serviceLikes.serviceId, service),
            eq(serviceLikes.senderProfileId, own.id),
            eq(serviceLikes.status, "active"),
          ),
        )
        .limit(1000),
      db
        .select({
          a: serviceConnections.userAProfileId,
          b: serviceConnections.userBProfileId,
        })
        .from(serviceConnections)
        .where(
          and(
            eq(serviceConnections.serviceId, service),
            inArray(serviceConnections.status, ["pending", "active"]),
            or(
              eq(serviceConnections.userAProfileId, own.id),
              eq(serviceConnections.userBProfileId, own.id),
            ),
          ),
        )
        .limit(1000),
      db
        .select({
          a: serviceBlocks.blockerProfileId,
          b: serviceBlocks.blockedProfileId,
        })
        .from(serviceBlocks)
        .where(
          and(
            eq(serviceBlocks.serviceId, service),
            or(
              eq(serviceBlocks.blockerProfileId, own.id),
              eq(serviceBlocks.blockedProfileId, own.id),
            ),
          ),
        )
        .limit(1000),
    ]);
    excluded = [
      own.id,
      ...likes.map((row) => row.id),
      ...connections.flatMap((row) =>
        row.a === own.id ? [row.b] : row.b === own.id ? [row.a] : [],
      ),
      ...blocks.map((row) => (row.a === own.id ? row.b : row.a)),
    ];
  }
  const rows = await db
    .select()
    .from(serviceProfiles)
    .where(
      and(
        eq(serviceProfiles.serviceId, service),
        eq(serviceProfiles.status, "active"),
        isNull(serviceProfiles.suspendedAt),
        before ? lt(serviceProfiles.id, before) : undefined,
        own ? ne(serviceProfiles.id, own.id) : undefined,
        tier
          ? service === "shoenmate"
            ? inArray(serviceProfiles.skillTier, shoenmateTierDatabaseValues(tier))
            : eq(serviceProfiles.skillTier, tier)
          : undefined,
        query
          ? or(
              sql`instr(${serviceProfiles.displayName}, ${query}) > 0`,
              sql`instr(${serviceProfiles.gameIdentity}, ${query}) > 0`,
            )
          : undefined,
        character
          ? sql`instr(${serviceProfiles.characters}, ${JSON.stringify(character)}) > 0`
          : undefined,
        activityMinutes
          ? gte(serviceProfiles.updatedAt, new Date(Date.now() - activityMinutes * 60_000))
          : undefined,
      ),
    )
    .orderBy(desc(serviceProfiles.updatedAt), desc(serviceProfiles.id))
    .limit(121);
  const filtered = rows.filter(
      (row) =>
        !excluded.includes(row.id) &&
        (!role || (service === "shoenmate"
          ? matchesShoenmateRole(JSON.parse(row.roles), role)
          : (JSON.parse(row.roles) as string[]).includes(role))),
    ),
    page = filtered.slice(0, 30);
  return Response.json({
    profiles: page.map(output),
    nextBefore:
      rows.length > 30
        ? (rows[Math.min(rows.length, 120) - 1]?.id ?? null)
        : null,
  });
}
