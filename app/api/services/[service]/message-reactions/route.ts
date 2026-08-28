import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  serviceConnections,
  serviceMessageReactions,
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

const allowedReactions = new Set(["👍", "❤️", "😂", "🎮"]);

async function reactionState(
  service: string,
  messageId: number,
  profileId: number,
) {
  const rows = await getDb()
    .select({
      profileId: serviceMessageReactions.profileId,
      reaction: serviceMessageReactions.reaction,
    })
    .from(serviceMessageReactions)
    .where(
      and(
        eq(serviceMessageReactions.serviceId, service),
        eq(serviceMessageReactions.messageId, messageId),
      ),
    );
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(row.reaction, (counts.get(row.reaction) || 0) + 1);
  return {
    messageId,
    reactions: [...counts].map(([reaction, count]) => ({ reaction, count })),
    myReaction:
      rows.find((row) => row.profileId === profileId)?.reaction || null,
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const { service } = await params;
  if (!isServiceId(service))
    return Response.json({ error: "サービスIDが不正です" }, { status: 404 });
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const payload = (await request.json().catch(() => ({}))) as {
      messageId?: unknown;
      reaction?: unknown;
    },
    messageId =
      typeof payload.messageId === "number" &&
      Number.isInteger(payload.messageId)
        ? payload.messageId
        : 0,
    reaction =
      typeof payload.reaction === "string" ? payload.reaction : null;
  if (!messageId)
    return Response.json(
      { error: "メッセージを確認してください" },
      { status: 400 },
    );
  if (reaction !== null && !allowedReactions.has(reaction))
    return Response.json(
      { error: "リアクションを選んでください" },
      { status: 400 },
    );
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
      .limit(1),
    [message] = await db
      .select({
        id: serviceMessages.id,
        deletedAt: serviceMessages.deletedAt,
        userAProfileId: serviceConnections.userAProfileId,
        userBProfileId: serviceConnections.userBProfileId,
        userAArchived: serviceConnections.userAArchived,
        userBArchived: serviceConnections.userBArchived,
      })
      .from(serviceMessages)
      .innerJoin(
        serviceConnections,
        eq(serviceMessages.connectionId, serviceConnections.id),
      )
      .where(
        and(
          eq(serviceMessages.id, messageId),
          eq(serviceMessages.serviceId, service),
          eq(serviceConnections.serviceId, service),
          eq(serviceConnections.status, "active"),
        ),
      )
      .limit(1);
  if (!profile || profile.suspendedAt || !message || message.deletedAt)
    return Response.json(
      { error: "このメッセージにはリアクションできません" },
      { status: 404 },
    );
  if (
    profile.id !== message.userAProfileId &&
    profile.id !== message.userBProfileId
  )
    return Response.json(
      { error: "このメッセージにはリアクションできません" },
      { status: 403 },
    );
  if (
    profile.id === message.userAProfileId
      ? message.userAArchived
      : message.userBArchived
  )
    return Response.json(
      { error: "この会話は終了しています" },
      { status: 403 },
    );
  const otherProfileId =
    profile.id === message.userAProfileId
      ? message.userBProfileId
      : message.userAProfileId;
  if (await isServicePairBlocked(service, profile.id, otherProfileId))
    return Response.json(
      { error: "この相手にはリアクションできません" },
      { status: 403 },
    );
  const limit = await checkRateLimit(`${service}:${user.userId}`, {
    action: "service-message-reaction",
    limit: 60,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);
  await db
    .delete(serviceMessageReactions)
    .where(
      and(
        eq(serviceMessageReactions.serviceId, service),
        eq(serviceMessageReactions.messageId, messageId),
        eq(serviceMessageReactions.profileId, profile.id),
      ),
    );
  if (reaction) {
    const now = new Date();
    await db.insert(serviceMessageReactions).values({
      serviceId: service,
      messageId,
      profileId: profile.id,
      reaction,
      createdAt: now,
      updatedAt: now,
    });
  }
  return Response.json(await reactionState(service, messageId, profile.id));
}
