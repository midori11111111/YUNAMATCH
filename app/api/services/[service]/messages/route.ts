import { and, asc, eq, gt, or } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  serviceConnections,
  serviceMessages,
  serviceProfiles,
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
import { cleanText, isServiceId } from "../../../../../lib/service-config";
import { isServicePairBlocked } from "../../../../../lib/service-safety";

async function member(service: string, connectionId: number) {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = getDb(),
    [profile] = await db
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
  if (!profile || profile.suspendedAt) return null;
  const [connection] = await db
    .select()
    .from(serviceConnections)
    .where(
      and(
        eq(serviceConnections.id, connectionId),
        eq(serviceConnections.serviceId, service),
        eq(serviceConnections.status, "active"),
        or(
          eq(serviceConnections.userAProfileId, profile.id),
          eq(serviceConnections.userBProfileId, profile.id),
        ),
      ),
    )
    .limit(1);
  if (!connection) return null;
  const otherProfileId =
    connection.userAProfileId === profile.id
      ? connection.userBProfileId
      : connection.userAProfileId;
  if (await isServicePairBlocked(service, profile.id, otherProfileId))
    return null;
  return { user, profile, connection };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const { service } = await params;
  if (!isServiceId(service))
    return Response.json({ error: "サービスIDが不正です" }, { status: 404 });
  const url = new URL(request.url),
    connectionId = Number(url.searchParams.get("connectionId")),
    after = Number(url.searchParams.get("after") || 0),
    ctx = await member(service, connectionId);
  if (!ctx)
    return Response.json(
      { error: "この会話を表示できません" },
      { status: 403 },
    );
  const rows = await getDb()
    .select()
    .from(serviceMessages)
    .where(
      and(
        eq(serviceMessages.serviceId, service),
        eq(serviceMessages.connectionId, connectionId),
        after ? gt(serviceMessages.id, after) : undefined,
      ),
    )
    .orderBy(asc(serviceMessages.id))
    .limit(101);
  return Response.json({
    messages: rows.slice(0, 100),
    hasMore: rows.length > 100,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const { service } = await params;
  if (!isServiceId(service))
    return Response.json({ error: "サービスIDが不正です" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >,
    connectionId =
      typeof body.connectionId === "number" ? body.connectionId : 0,
    ctx = await member(service, connectionId);
  if (!ctx)
    return Response.json(
      { error: "この会話へ送信できません" },
      { status: 403 },
    );
  const limit = await checkRateLimit(`${service}:${ctx.user.userId}`, {
    action: "service-message",
    limit: 1,
    windowMs: 1_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);
  const text = cleanText(body.body, 500),
    clientId = cleanText(body.clientId, 80);
  if (!text || !clientId)
    return Response.json(
      { error: "メッセージを入力してください" },
      { status: 400 },
    );
  if (containsProhibitedContent(text))
    return Response.json({ error: prohibitedContentMessage }, { status: 400 });
  const [row] = await getDb()
    .insert(serviceMessages)
    .values({
      serviceId: service,
      connectionId,
      senderProfileId: ctx.profile.id,
      clientId,
      body: text,
      createdAt: new Date(),
    })
    .onConflictDoNothing({
      target: [serviceMessages.senderProfileId, serviceMessages.clientId],
    })
    .returning();
  if (row) return Response.json({ message: row }, { status: 201 });
  const [existing] = await getDb()
    .select()
    .from(serviceMessages)
    .where(
      and(
        eq(serviceMessages.senderProfileId, ctx.profile.id),
        eq(serviceMessages.clientId, clientId),
      ),
    )
    .limit(1);
  return Response.json({ message: existing, deduplicated: true });
}
