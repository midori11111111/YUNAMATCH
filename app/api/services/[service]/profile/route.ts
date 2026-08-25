import { and, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  serviceBlocks,
  serviceConnections,
  serviceLikes,
  serviceMessages,
  serviceProfiles,
  serviceRecruits,
  serviceReports,
} from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import {
  containsProhibitedContent,
  prohibitedContentMessage,
} from "../../../../../lib/content-policy";
import {
  checkRateLimit,
  rateLimitResponse,
} from "../../../../../lib/rate-limit";
import {
  cleanText,
  isServiceId,
  serviceConfig,
  stringList,
} from "../../../../../lib/service-config";

function output(row: typeof serviceProfiles.$inferSelect) {
  return {
    ...row,
    roles: JSON.parse(row.roles) as string[],
    playTimes: JSON.parse(row.playTimes) as string[],
    gender: row.showGender && row.age >= 18 ? row.gender : "",
    showGender: row.showGender && row.age >= 18,
  };
}
async function context(params: Promise<{ service: string }>) {
  const { service } = await params;
  if (!isServiceId(service)) return null;
  const user = await getChatGPTUser();
  return user ? { service, user } : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const ctx = await context(params);
  if (!ctx)
    return Response.json(
      { error: "ログインまたはサービスIDを確認してください" },
      { status: 401 },
    );
  const [row] = await getDb()
    .select()
    .from(serviceProfiles)
    .where(
      and(
        eq(serviceProfiles.serviceId, ctx.service),
        eq(serviceProfiles.userId, ctx.user.userId),
      ),
    )
    .limit(1);
  if (row?.suspendedAt)
    return Response.json(
      { error: "このサービスではアカウントが停止されています" },
      { status: 403 },
    );
  return Response.json({
    profile: row ? output(row) : null,
    suggestedName: ctx.user.displayName,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const ctx = await context(params);
  if (!ctx)
    return Response.json(
      { error: "ログインまたはサービスIDを確認してください" },
      { status: 401 },
    );
  const limit = await checkRateLimit(`${ctx.service}:${ctx.user.userId}`, {
    action: "service-profile",
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);
  const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >,
    config = serviceConfig[ctx.service];
  const displayName = cleanText(body.displayName, 24),
    gameIdentity = cleanText(body.gameIdentity, 60),
    skillTier = cleanText(body.skillTier, 40),
    roles = stringList(body.roles, 5),
    playTimes = stringList(body.playTimes, 7),
    bio = cleanText(body.bio, 200),
    avatarUrl = cleanText(body.avatarUrl, 500),
    age =
      typeof body.age === "number" && Number.isInteger(body.age) ? body.age : 0,
    gender = cleanText(body.gender, 10),
    showGender = body.showGender === true && age >= 18,
    termsAccepted = body.termsAccepted === true;
  if (
    !displayName ||
    !gameIdentity ||
    !config.tiers.has(skillTier) ||
    !roles.length ||
    roles.some((role) => !config.roles.has(role)) ||
    !playTimes.length ||
    age < 13 ||
    age > 99 ||
    !termsAccepted
  )
    return Response.json(
      { error: "必須項目、年齢、利用条件への同意を確認してください" },
      { status: 400 },
    );
  if (
    containsProhibitedContent(displayName) ||
    containsProhibitedContent(gameIdentity) ||
    containsProhibitedContent(bio)
  )
    return Response.json({ error: prohibitedContentMessage }, { status: 400 });
  const now = new Date(),
    values = {
      serviceId: ctx.service,
      userId: ctx.user.userId,
      displayName,
      gameIdentity,
      skillTier,
      roles: JSON.stringify(roles),
      playTimes: JSON.stringify(playTimes),
      age,
      gender,
      showGender,
      bio,
      avatarUrl,
      status: "active",
      termsVersion: config.termsVersion,
      termsAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    };
  await getDb()
    .insert(serviceProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: [serviceProfiles.serviceId, serviceProfiles.userId],
      set: {
        displayName,
        gameIdentity,
        skillTier,
        roles: values.roles,
        playTimes: values.playTimes,
        age,
        gender,
        showGender,
        bio,
        avatarUrl,
        termsVersion: config.termsVersion,
        termsAcceptedAt: now,
        updatedAt: now,
      },
    });
  const [row] = await getDb()
    .select()
    .from(serviceProfiles)
    .where(
      and(
        eq(serviceProfiles.serviceId, ctx.service),
        eq(serviceProfiles.userId, ctx.user.userId),
      ),
    )
    .limit(1);
  return Response.json({ profile: output(row) });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const ctx = await context(params);
  if (!ctx)
    return Response.json(
      { error: "ログインまたはサービスIDを確認してください" },
      { status: 401 },
    );
  const body = (await request.json().catch(() => ({}))) as {
    confirmation?: unknown;
  };
  if (body.confirmation !== "削除")
    return Response.json(
      { error: "確認欄に「削除」と入力してください" },
      { status: 400 },
    );
  const db = getDb(),
    [profile] = await db
      .select({ id: serviceProfiles.id })
      .from(serviceProfiles)
      .where(
        and(
          eq(serviceProfiles.serviceId, ctx.service),
          eq(serviceProfiles.userId, ctx.user.userId),
        ),
      )
      .limit(1);
  if (!profile) return Response.json({ ok: true });
  const connections = await db
    .select({ id: serviceConnections.id })
    .from(serviceConnections)
    .where(
      and(
        eq(serviceConnections.serviceId, ctx.service),
        or(
          eq(serviceConnections.userAProfileId, profile.id),
          eq(serviceConnections.userBProfileId, profile.id),
        ),
      ),
    );
  const connectionIds = connections.map((row) => row.id);
  const queries = [
    db
      .delete(serviceReports)
      .where(
        and(
          eq(serviceReports.serviceId, ctx.service),
          or(
            eq(serviceReports.reporterProfileId, profile.id),
            eq(serviceReports.targetProfileId, profile.id),
          ),
        ),
      ),
    ...(connectionIds.length
      ? [
          db
            .delete(serviceMessages)
            .where(
              and(
                eq(serviceMessages.serviceId, ctx.service),
                inArray(serviceMessages.connectionId, connectionIds),
              ),
            ),
        ]
      : []),
    db
      .delete(serviceLikes)
      .where(
        and(
          eq(serviceLikes.serviceId, ctx.service),
          or(
            eq(serviceLikes.senderProfileId, profile.id),
            eq(serviceLikes.recipientProfileId, profile.id),
          ),
        ),
      ),
    db
      .delete(serviceBlocks)
      .where(
        and(
          eq(serviceBlocks.serviceId, ctx.service),
          or(
            eq(serviceBlocks.blockerProfileId, profile.id),
            eq(serviceBlocks.blockedProfileId, profile.id),
          ),
        ),
      ),
    db
      .delete(serviceConnections)
      .where(
        and(
          eq(serviceConnections.serviceId, ctx.service),
          or(
            eq(serviceConnections.userAProfileId, profile.id),
            eq(serviceConnections.userBProfileId, profile.id),
          ),
        ),
      ),
    db
      .delete(serviceRecruits)
      .where(
        and(
          eq(serviceRecruits.serviceId, ctx.service),
          eq(serviceRecruits.ownerProfileId, profile.id),
        ),
      ),
    db
      .delete(serviceProfiles)
      .where(
        and(
          eq(serviceProfiles.serviceId, ctx.service),
          eq(serviceProfiles.id, profile.id),
        ),
      ),
  ];
  await db.batch(
    queries as [(typeof queries)[number], ...(typeof queries)[number][]],
  );
  return Response.json({ ok: true });
}
