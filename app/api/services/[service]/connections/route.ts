import { and, desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  serviceBlocks,
  serviceConnections,
  serviceMessages,
  serviceProfiles,
} from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import {
  checkRateLimit,
  rateLimitResponse,
} from "../../../../../lib/rate-limit";
import { isServiceId } from "../../../../../lib/service-config";
import { isServicePairBlocked } from "../../../../../lib/service-safety";

async function context(params: Promise<{ service: string }>) {
  const { service } = await params;
  if (!isServiceId(service)) return null;
  const user = await getChatGPTUser();
  if (!user) return null;
  const [profile] = await getDb()
    .select()
    .from(serviceProfiles)
    .where(
      and(
        eq(serviceProfiles.serviceId, service),
        eq(serviceProfiles.userId, user.userId),
        eq(serviceProfiles.status, "active"),
      ),
    )
    .limit(1);
  return profile && !profile.suspendedAt ? { service, user, profile } : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const ctx = await context(params);
  if (!ctx)
    return Response.json(
      { error: "プロフィール登録またはログインが必要です" },
      { status: 401 },
    );
  const db = getDb(),
    rows = await db
      .select()
      .from(serviceConnections)
      .where(
        and(
          eq(serviceConnections.serviceId, ctx.service),
          or(
            eq(serviceConnections.userAProfileId, ctx.profile.id),
            eq(serviceConnections.userBProfileId, ctx.profile.id),
          ),
        ),
      )
      .orderBy(desc(serviceConnections.createdAt))
      .limit(201),
    blockRows = await db
      .select({
        a: serviceBlocks.blockerProfileId,
        b: serviceBlocks.blockedProfileId,
      })
      .from(serviceBlocks)
      .where(
        and(
          eq(serviceBlocks.serviceId, ctx.service),
          or(
            eq(serviceBlocks.blockerProfileId, ctx.profile.id),
            eq(serviceBlocks.blockedProfileId, ctx.profile.id),
          ),
        ),
      ),
    hidden = new Set(
      blockRows.map((row) => (row.a === ctx.profile.id ? row.b : row.a)),
    ),
    page = rows
      .slice(0, 200)
      .filter(
        (row) =>
          !hidden.has(
            row.userAProfileId === ctx.profile.id
              ? row.userBProfileId
              : row.userAProfileId,
          ) &&
          !(row.userAProfileId === ctx.profile.id
            ? row.userAArchived
            : row.userBArchived),
      ),
    otherIds = [
      ...new Set(
        page.map((row) =>
          row.userAProfileId === ctx.profile.id
            ? row.userBProfileId
            : row.userAProfileId,
        ),
      ),
    ],
    connectionIds = page
      .filter((row) => row.status === "active")
      .map((row) => row.id),
    [profiles, messageRows] = await Promise.all([
      otherIds.length
        ? db
            .select()
            .from(serviceProfiles)
            .where(
              and(
                eq(serviceProfiles.serviceId, ctx.service),
                inArray(serviceProfiles.id, otherIds),
              ),
            )
        : [],
      connectionIds.length
        ? db
            .select()
            .from(serviceMessages)
            .where(
              and(
                eq(serviceMessages.serviceId, ctx.service),
                inArray(serviceMessages.connectionId, connectionIds),
              ),
            )
            .orderBy(desc(serviceMessages.id))
            .limit(1000)
        : [],
    ]),
    byId = new Map(profiles.map((row) => [row.id, row])),
    latestByConnection = new Map<number, typeof serviceMessages.$inferSelect>();
  for (const message of messageRows)
    if (!latestByConnection.has(message.connectionId))
      latestByConnection.set(message.connectionId, message);
  const mapped = page.map((row) => {
    const other = byId.get(
        row.userAProfileId === ctx.profile.id
          ? row.userBProfileId
          : row.userAProfileId,
      ),
      latest = latestByConnection.get(row.id);
    return {
      id: row.id,
      status: row.status,
      direction:
        row.requesterProfileId === ctx.profile.id ? "outgoing" : "incoming",
      createdAt: row.createdAt,
      other: other
        ? {
            id: other.id,
            displayName: other.displayName,
            skillTier: other.skillTier,
            roles: JSON.parse(other.roles),
            avatarUrl: other.avatarUrl,
          }
        : {
            id: 0,
            displayName: "退会ユーザー",
            skillTier: "",
            roles: [],
            avatarUrl: "",
          },
      latestMessage: latest
        ? { body: latest.body, createdAt: latest.createdAt }
        : null,
    };
  });
  return Response.json({
    connections: mapped.filter((row) => row.status === "active"),
    incoming: mapped.filter(
      (row) => row.status === "pending" && row.direction === "incoming",
    ),
    outgoing: mapped.filter(
      (row) => row.status === "pending" && row.direction === "outgoing",
    ),
    hasMore: rows.length > 200,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const ctx = await context(params);
  if (!ctx)
    return Response.json(
      { error: "プロフィール登録またはログインが必要です" },
      { status: 401 },
    );
  const limit = await checkRateLimit(`${ctx.service}:${ctx.user.userId}`, {
    action: "service-connect",
    limit: 30,
    windowMs: 60 * 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);
  const body = (await request.json().catch(() => ({}))) as {
      targetProfileId?: unknown;
    },
    targetProfileId =
      typeof body.targetProfileId === "number" &&
      Number.isInteger(body.targetProfileId)
        ? body.targetProfileId
        : 0;
  if (!targetProfileId || targetProfileId === ctx.profile.id)
    return Response.json({ error: "相手を確認してください" }, { status: 400 });
  const db = getDb(),
    [target] = await db
      .select()
      .from(serviceProfiles)
      .where(
        and(
          eq(serviceProfiles.id, targetProfileId),
          eq(serviceProfiles.serviceId, ctx.service),
          eq(serviceProfiles.status, "active"),
        ),
      )
      .limit(1);
  if (!target || target.suspendedAt)
    return Response.json(
      { error: "このプロフィールは利用できません" },
      { status: 404 },
    );
  if (await isServicePairBlocked(ctx.service, ctx.profile.id, target.id))
    return Response.json(
      { error: "ブロック中の相手には申請できません" },
      { status: 403 },
    );
  const low = Math.min(ctx.profile.id, target.id),
    high = Math.max(ctx.profile.id, target.id),
    pairKey = `${low}:${high}`,
    now = new Date();
  await db
    .insert(serviceConnections)
    .values({
      serviceId: ctx.service,
      pairKey,
      requesterProfileId: ctx.profile.id,
      userAProfileId: low,
      userBProfileId: high,
      status: "pending",
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [serviceConnections.serviceId, serviceConnections.pairKey],
      set: {
        requesterProfileId: ctx.profile.id,
        status: "pending",
        userAArchived: false,
        userBArchived: false,
        endedAt: null,
        createdAt: now,
      },
    });
  const [row] = await db
    .select()
    .from(serviceConnections)
    .where(
      and(
        eq(serviceConnections.serviceId, ctx.service),
        eq(serviceConnections.pairKey, pairKey),
      ),
    )
    .limit(1);
  return Response.json({ connection: row }, { status: 201 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const ctx = await context(params);
  if (!ctx)
    return Response.json(
      { error: "プロフィール登録またはログインが必要です" },
      { status: 401 },
    );
  const body = (await request.json().catch(() => ({}))) as {
      connectionId?: unknown;
      action?: unknown;
    },
    connectionId =
      typeof body.connectionId === "number" ? body.connectionId : 0,
    action = typeof body.action === "string" ? body.action : "",
    db = getDb(),
    [row] = await db
      .select()
      .from(serviceConnections)
      .where(
        and(
          eq(serviceConnections.id, connectionId),
          eq(serviceConnections.serviceId, ctx.service),
          or(
            eq(serviceConnections.userAProfileId, ctx.profile.id),
            eq(serviceConnections.userBProfileId, ctx.profile.id),
          ),
        ),
      )
      .limit(1);
  if (!row)
    return Response.json({ error: "申請が見つかりません" }, { status: 404 });
  if (action === "archive" && row.status === "active") {
    const [updated] = await db
      .update(serviceConnections)
      .set(
        row.userAProfileId === ctx.profile.id
          ? { userAArchived: true }
          : { userBArchived: true },
      )
      .where(eq(serviceConnections.id, row.id))
      .returning();
    return Response.json({ connection: updated });
  }
  if (row.status !== "pending")
    return Response.json({ error: "この申請は処理済みです" }, { status: 409 });
  const incoming = row.requesterProfileId !== ctx.profile.id;
  const otherProfileId =
    row.userAProfileId === ctx.profile.id
      ? row.userBProfileId
      : row.userAProfileId;
  if (await isServicePairBlocked(ctx.service, ctx.profile.id, otherProfileId))
    return Response.json(
      { error: "ブロック中の相手の申請は操作できません" },
      { status: 403 },
    );
  if (action === "accept" && incoming) {
    const [updated] = await db
      .update(serviceConnections)
      .set({
        status: "active",
        userAArchived: false,
        userBArchived: false,
      })
      .where(
        and(
          eq(serviceConnections.id, row.id),
          eq(serviceConnections.status, "pending"),
        ),
      )
      .returning();
    return Response.json({ connection: updated });
  }
  if (action === "decline" && incoming) {
    await db
      .update(serviceConnections)
      .set({ status: "declined", endedAt: new Date() })
      .where(
        and(
          eq(serviceConnections.id, row.id),
          eq(serviceConnections.status, "pending"),
        ),
      );
    return Response.json({ ok: true });
  }
  if (action === "cancel" && !incoming) {
    await db
      .update(serviceConnections)
      .set({ status: "cancelled", endedAt: new Date() })
      .where(
        and(
          eq(serviceConnections.id, row.id),
          eq(serviceConnections.status, "pending"),
        ),
      );
    return Response.json({ ok: true });
  }
  return Response.json({ error: "この操作はできません" }, { status: 403 });
}
