import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  serviceAdminAuditLogs,
  serviceBlocks,
  serviceConnections,
  serviceLikes,
  serviceMessageReactions,
  serviceMessages,
  serviceProfiles,
  serviceRecruits,
  serviceReports,
} from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin";
import { isServiceId } from "../../../../lib/service-config";

export async function GET(request: Request) {
  if (!(await requireAdmin()))
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const url = new URL(request.url),
    query = url.searchParams.get("q")?.trim().slice(0, 40) || "",
    service = url.searchParams.get("service") || "";
  if (!query) return Response.json({ users: [] });
  if (service && !isServiceId(service))
    return Response.json(
      { error: "サービスを確認してください" },
      { status: 400 },
    );
  const db = getDb(),
    rows = await db
      .select()
      .from(serviceProfiles)
      .where(
        and(
          service ? eq(serviceProfiles.serviceId, service) : undefined,
          or(
            eq(serviceProfiles.displayName, query),
            like(serviceProfiles.displayName, `%${query}%`),
            like(serviceProfiles.gameIdentity, `%${query}%`),
          ),
        ),
      )
      .orderBy(
        sql`case when ${serviceProfiles.displayName} = ${query} then 0 else 1 end`,
        desc(serviceProfiles.updatedAt),
      )
      .limit(50),
    reportCounts = rows.length
      ? await db
          .select({
            profileId: serviceReports.targetProfileId,
            count: sql<number>`count(distinct ${serviceReports.reporterProfileId})`,
          })
          .from(serviceReports)
          .where(
            inArray(
              serviceReports.targetProfileId,
              rows.map((row) => row.id),
            ),
          )
          .groupBy(serviceReports.targetProfileId)
      : [],
    reportsByProfile = new Map(
      reportCounts.map((row) => [row.profileId, Number(row.count) || 0]),
    );
  return Response.json({
    users: rows.map((row) => ({
      id: row.id,
      serviceId: row.serviceId,
      displayName: row.displayName,
      gameIdentity: row.gameIdentity,
      skillTier: row.skillTier,
      avatarUrl: row.avatarUrl,
      age: row.age,
      suspendedAt: row.suspendedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      reportCount: reportsByProfile.get(row.id) || 0,
    })),
  });
}

async function deleteServiceAccount(service: string, profileId: number) {
  const db = getDb(),
    connections = await db
      .select({ id: serviceConnections.id })
      .from(serviceConnections)
      .where(
        and(
          eq(serviceConnections.serviceId, service),
          or(
            eq(serviceConnections.userAProfileId, profileId),
            eq(serviceConnections.userBProfileId, profileId),
          ),
        ),
      ),
    connectionIds = connections.map((row) => row.id),
    messageRows = connectionIds.length
      ? await db
          .select({ id: serviceMessages.id })
          .from(serviceMessages)
          .where(
            and(
              eq(serviceMessages.serviceId, service),
              inArray(serviceMessages.connectionId, connectionIds),
            ),
          )
      : [],
    messageIds = messageRows.map((row) => row.id),
    queries = [
      db
        .delete(serviceReports)
        .where(
          and(
            eq(serviceReports.serviceId, service),
            or(
              eq(serviceReports.reporterProfileId, profileId),
              eq(serviceReports.targetProfileId, profileId),
            ),
          ),
        ),
      ...(connectionIds.length
        ? [
            ...(messageIds.length
              ? [
                  db
                    .delete(serviceMessageReactions)
                    .where(
                      and(
                        eq(serviceMessageReactions.serviceId, service),
                        inArray(serviceMessageReactions.messageId, messageIds),
                      ),
                    ),
                ]
              : []),
            db
              .delete(serviceMessages)
              .where(
                and(
                  eq(serviceMessages.serviceId, service),
                  inArray(serviceMessages.connectionId, connectionIds),
                ),
              ),
          ]
        : []),
      db
        .delete(serviceLikes)
        .where(
          and(
            eq(serviceLikes.serviceId, service),
            or(
              eq(serviceLikes.senderProfileId, profileId),
              eq(serviceLikes.recipientProfileId, profileId),
            ),
          ),
        ),
      db
        .delete(serviceBlocks)
        .where(
          and(
            eq(serviceBlocks.serviceId, service),
            or(
              eq(serviceBlocks.blockerProfileId, profileId),
              eq(serviceBlocks.blockedProfileId, profileId),
            ),
          ),
        ),
      db
        .delete(serviceConnections)
        .where(
          and(
            eq(serviceConnections.serviceId, service),
            or(
              eq(serviceConnections.userAProfileId, profileId),
              eq(serviceConnections.userBProfileId, profileId),
            ),
          ),
        ),
      db
        .delete(serviceRecruits)
        .where(
          and(
            eq(serviceRecruits.serviceId, service),
            eq(serviceRecruits.ownerProfileId, profileId),
          ),
        ),
      db
        .delete(serviceProfiles)
        .where(
          and(
            eq(serviceProfiles.serviceId, service),
            eq(serviceProfiles.id, profileId),
          ),
        ),
    ];
  await db.batch(queries as [(typeof queries)[number], ...typeof queries]);
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin()))
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
      service?: unknown;
      profileId?: unknown;
      action?: unknown;
      confirmation?: unknown;
    },
    service = typeof body.service === "string" ? body.service : "",
    profileId = typeof body.profileId === "number" ? body.profileId : 0,
    action = typeof body.action === "string" ? body.action : "";
  if (
    !isServiceId(service) ||
    !profileId ||
    !["suspend", "restore", "delete"].includes(action)
  )
    return Response.json(
      { error: "対象と操作を確認してください" },
      { status: 400 },
    );
  const db = getDb(),
    [profile] = await db
      .select({
        id: serviceProfiles.id,
        displayName: serviceProfiles.displayName,
      })
      .from(serviceProfiles)
      .where(
        and(
          eq(serviceProfiles.serviceId, service),
          eq(serviceProfiles.id, profileId),
        ),
      )
      .limit(1);
  if (!profile)
    return Response.json(
      { error: "アカウントが見つかりません" },
      { status: 404 },
    );
  const now = new Date();
  if (action === "delete") {
    if (body.confirmation !== profile.displayName)
      return Response.json(
        { error: "確認のため表示名を正確に入力してください" },
        { status: 400 },
      );
    await deleteServiceAccount(service, profileId);
  } else {
    const suspendedAt = action === "suspend" ? now : null;
    await db
      .update(serviceProfiles)
      .set({ suspendedAt, updatedAt: now })
      .where(
        and(
          eq(serviceProfiles.serviceId, service),
          eq(serviceProfiles.id, profileId),
        ),
      );
    if (action === "suspend")
      await db
        .update(serviceRecruits)
        .set({ status: "closed", updatedAt: now })
        .where(
          and(
            eq(serviceRecruits.serviceId, service),
            eq(serviceRecruits.ownerProfileId, profileId),
          ),
        );
  }
  await db.insert(serviceAdminAuditLogs).values({
    serviceId: service,
    action: `${action}-account`,
    targetProfileId: profileId,
    detail: `ユーザー検索から${action}を実行: ${profile.displayName}`,
    createdAt: now,
  });
  return Response.json({
    ok: true,
    deleted: action === "delete",
    suspendedAt: action === "suspend" ? now : null,
  });
}
