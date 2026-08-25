import { and, asc, eq, or } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  serviceConnections,
  serviceMessages,
  serviceProfiles,
  serviceReports,
} from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import {
  checkRateLimit,
  rateLimitResponse,
} from "../../../../../lib/rate-limit";
import { cleanText, isServiceId } from "../../../../../lib/service-config";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const { service } = await params;
  if (!isServiceId(service))
    return Response.json({ error: "サービスIDが不正です" }, { status: 404 });
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const db = getDb(),
    [reporter] = await db
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
  if (!reporter || reporter.suspendedAt)
    return Response.json(
      { error: "プロフィールを確認してください" },
      { status: 403 },
    );
  const limit = await checkRateLimit(`${service}:${user.userId}`, {
    action: "service-report",
    limit: 10,
    windowMs: 24 * 60 * 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);
  const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >,
    targetProfileId =
      typeof body.targetProfileId === "number" ? body.targetProfileId : 0,
    connectionId =
      typeof body.connectionId === "number" ? body.connectionId : null,
    messageId = typeof body.messageId === "number" ? body.messageId : null,
    reason = cleanText(body.reason, 60),
    details = cleanText(body.details, 500);
  if (!targetProfileId || targetProfileId === reporter.id || !reason)
    return Response.json(
      { error: "通報対象と理由を確認してください" },
      { status: 400 },
    );
  const [target] = await db
    .select()
    .from(serviceProfiles)
    .where(
      and(
        eq(serviceProfiles.id, targetProfileId),
        eq(serviceProfiles.serviceId, service),
      ),
    )
    .limit(1);
  if (!target)
    return Response.json(
      { error: "対象プロフィールが見つかりません" },
      { status: 404 },
    );
  let reportedContent = "",
    conversationContext = "[]";
  if (connectionId) {
    const [connection] = await db
      .select()
      .from(serviceConnections)
      .where(
        and(
          eq(serviceConnections.id, connectionId),
          eq(serviceConnections.serviceId, service),
          or(
            eq(serviceConnections.userAProfileId, reporter.id),
            eq(serviceConnections.userBProfileId, reporter.id),
          ),
          or(
            eq(serviceConnections.userAProfileId, target.id),
            eq(serviceConnections.userBProfileId, target.id),
          ),
        ),
      )
      .limit(1);
    if (!connection)
      return Response.json(
        { error: "この会話は通報できません" },
        { status: 403 },
      );
    const messages = await db
      .select()
      .from(serviceMessages)
      .where(
        and(
          eq(serviceMessages.serviceId, service),
          eq(serviceMessages.connectionId, connectionId),
        ),
      )
      .orderBy(asc(serviceMessages.id))
      .limit(20);
    const selected = messageId
      ? messages.find((item) => item.id === messageId)
      : undefined;
    if (messageId && (!selected || selected.senderProfileId !== target.id))
      return Response.json(
        { error: "通報するメッセージを確認してください" },
        { status: 400 },
      );
    reportedContent = selected?.body || "";
    conversationContext = JSON.stringify(
      messages.map((item) => ({
        id: item.id,
        senderProfileId: item.senderProfileId,
        body: item.body,
        createdAt: item.createdAt,
        isReported: item.id === messageId,
      })),
    );
  }
  const [row] = await db
    .insert(serviceReports)
    .values({
      serviceId: service,
      reporterProfileId: reporter.id,
      targetProfileId: target.id,
      connectionId,
      messageId,
      reason,
      details,
      reportedContent,
      conversationContext,
      status: "open",
      createdAt: new Date(),
    })
    .returning();
  return Response.json(
    { report: { id: row.id, status: row.status } },
    { status: 201 },
  );
}
