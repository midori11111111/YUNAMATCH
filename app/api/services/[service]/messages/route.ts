import { and, asc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  serviceConnections,
  serviceMessageReactions,
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

const playInviteBody = "一緒にプレイしませんか？";

function serializeMessage(
  row: typeof serviceMessages.$inferSelect,
  currentProfileId: number,
  reactionRows: Array<{ profileId: number; reaction: string }> = [],
) {
  const counts = new Map<string, number>();
  for (const reaction of reactionRows)
    counts.set(
      reaction.reaction,
      (counts.get(reaction.reaction) || 0) + 1,
    );
  return {
    id: row.id,
    senderProfileId: row.senderProfileId,
    body: row.deletedAt ? "メッセージの送信を取り消しました" : row.body,
    deleted: Boolean(row.deletedAt),
    kind: row.kind === "play_invite" ? "play_invite" : "text",
    response: row.response,
    canRespond:
      row.kind === "play_invite" &&
      !row.response &&
      row.senderProfileId !== currentProfileId,
    reactions: [...counts].map(([reaction, count]) => ({ reaction, count })),
    myReaction:
      reactionRows.find((reaction) => reaction.profileId === currentProfileId)
        ?.reaction || null,
    createdAt: row.createdAt,
  };
}

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
  const archivedByMe =
    connection.userAProfileId === profile.id
      ? connection.userAArchived
      : connection.userBArchived;
  if (archivedByMe) return null;
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
  const db = getDb(),
    rows = await db
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
  const visibleRows = rows.slice(0, 100),
    reactionRows = visibleRows.length
      ? await db
          .select({
            messageId: serviceMessageReactions.messageId,
            profileId: serviceMessageReactions.profileId,
            reaction: serviceMessageReactions.reaction,
          })
          .from(serviceMessageReactions)
          .where(
            inArray(
              serviceMessageReactions.messageId,
              visibleRows.map((row) => row.id),
            ),
          )
      : [],
    reactionsByMessage = new Map<
      number,
      Array<{ profileId: number; reaction: string }>
    >();
  for (const reaction of reactionRows) {
    const current = reactionsByMessage.get(reaction.messageId) || [];
    current.push(reaction);
    reactionsByMessage.set(reaction.messageId, current);
  }
  return Response.json({
    messages: visibleRows.map((row) =>
      serializeMessage(
        row,
        ctx.profile.id,
        reactionsByMessage.get(row.id) || [],
      ),
    ),
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
  const kind = body.kind === "play_invite" ? "play_invite" : "text",
    text =
      kind === "play_invite"
        ? playInviteBody
        : cleanText(body.body, 500),
    clientId = cleanText(body.clientId, 80);
  if (!text || !clientId)
    return Response.json(
      { error: "メッセージを入力してください" },
      { status: 400 },
    );
  if (kind === "text" && containsProhibitedContent(text))
    return Response.json({ error: prohibitedContentMessage }, { status: 400 });
  const db = getDb();
  if (kind === "play_invite") {
    const [pendingInvite] = await db
      .select({ id: serviceMessages.id })
      .from(serviceMessages)
      .where(
        and(
          eq(serviceMessages.serviceId, service),
          eq(serviceMessages.connectionId, connectionId),
          eq(serviceMessages.kind, "play_invite"),
          isNull(serviceMessages.response),
        ),
      )
      .limit(1);
    if (pendingInvite)
      return Response.json(
        { error: "返事待ちのプレイ申請があります" },
        { status: 409 },
      );
  }
  let row: typeof serviceMessages.$inferSelect | undefined;
  try {
    [row] = await db
      .insert(serviceMessages)
      .values({
        serviceId: service,
        connectionId,
        senderProfileId: ctx.profile.id,
        clientId,
        body: text,
        kind,
        createdAt: new Date(),
      })
      .onConflictDoNothing({
        target: [serviceMessages.senderProfileId, serviceMessages.clientId],
      })
      .returning();
  } catch (error) {
    if (kind === "play_invite")
      return Response.json(
        { error: "返事待ちのプレイ申請があります" },
        { status: 409 },
      );
    throw error;
  }
  if (row)
    return Response.json(
      { message: serializeMessage(row, ctx.profile.id) },
      { status: 201 },
    );
  const [existing] = await db
    .select()
    .from(serviceMessages)
    .where(
      and(
        eq(serviceMessages.senderProfileId, ctx.profile.id),
        eq(serviceMessages.clientId, clientId),
      ),
    )
    .limit(1);
  if (!existing)
    return Response.json(
      {
        error:
          kind === "play_invite"
            ? "返事待ちのプレイ申請があります"
            : "送信結果を確認できませんでした",
      },
      { status: kind === "play_invite" ? 409 : 500 },
    );
  return Response.json({
    message: serializeMessage(existing, ctx.profile.id),
    deduplicated: true,
  });
}

export async function PATCH(
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
    messageId = typeof body.messageId === "number" ? body.messageId : 0,
    response =
      body.response === "accepted" || body.response === "declined"
        ? body.response
        : "";
  if (!messageId || !response)
    return Response.json({ error: "回答を選んでください" }, { status: 400 });
  const db = getDb(),
    [invite] = await db
      .select()
      .from(serviceMessages)
      .where(
        and(
          eq(serviceMessages.id, messageId),
          eq(serviceMessages.serviceId, service),
        ),
      )
      .limit(1);
  if (!invite || invite.kind !== "play_invite")
    return Response.json(
      { error: "プレイ申請が見つかりません" },
      { status: 404 },
    );
  const ctx = await member(service, invite.connectionId);
  if (!ctx)
    return Response.json(
      { error: "この申請には回答できません" },
      { status: 403 },
    );
  if (invite.senderProfileId === ctx.profile.id)
    return Response.json({ error: "送信者は回答できません" }, { status: 403 });
  if (invite.response)
    return Response.json({ error: "この申請には回答済みです" }, { status: 409 });
  const limit = await checkRateLimit(`${service}:${ctx.user.userId}`, {
    action: "service-play-invite-response",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);
  const [updated] = await db
    .update(serviceMessages)
    .set({ response, respondedAt: new Date() })
    .where(
      and(
        eq(serviceMessages.id, invite.id),
        isNull(serviceMessages.response),
      ),
    )
    .returning();
  if (!updated)
    return Response.json({ error: "この申請には回答済みです" }, { status: 409 });
  return Response.json({ message: serializeMessage(updated, ctx.profile.id) });
}
