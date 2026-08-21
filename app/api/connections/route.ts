import { and, desc, eq, gt, inArray, or } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  applications,
  blocks,
  connectionRatings,
  connections,
  messages,
  profiles,
  recruits,
} from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { sendPush } from "../../../lib/push";
import { isSuspended } from "../../../lib/safety";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";

const signIn = "/login";

async function connectionForUser(connectionId: number, userId: string) {
  const [row] = await getDb()
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.id, connectionId),
        or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
      ),
    )
    .limit(1);
  return row;
}

async function backfillAcceptedConnections(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      applicationId: applications.id,
      recruitId: recruits.id,
      ownerId: recruits.ownerId,
      ownerName: recruits.trainerName,
      ownerPokemon: recruits.pokemon,
      applicantId: applications.applicantId,
      applicantName: applications.applicantName,
      applicantPokemon: applications.pokemon,
      createdAt: applications.createdAt,
    })
    .from(applications)
    .innerJoin(recruits, eq(applications.recruitId, recruits.id))
    .where(
      and(
        eq(applications.status, "accepted"),
        or(eq(recruits.ownerId, userId), eq(applications.applicantId, userId)),
      ),
    )
    .limit(50);

  if (!rows.length) return;
  await db
    .insert(connections)
    .values(
      rows.map((row) => ({
        applicationId: row.applicationId,
        recruitId: row.recruitId,
        userAId: row.ownerId,
        userBId: row.applicantId,
        userAName: row.ownerName,
        userBName: row.applicantName,
        userAPokemon: row.ownerPokemon,
        userBPokemon: row.applicantPokemon,
        userAContact: "",
        userBContact: "",
        createdAt: row.createdAt,
      })),
    )
    .onConflictDoNothing();
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn },
      { status: 401 },
    );
  await backfillAcceptedConnections(user.userId);

  const db = getDb();
  const [blockedByMe, blockedMe] = await Promise.all([
    db
      .select({ id: blocks.blockedId })
      .from(blocks)
      .where(eq(blocks.blockerId, user.userId)),
    db
      .select({ id: blocks.blockerId })
      .from(blocks)
      .where(eq(blocks.blockedId, user.userId)),
  ]);
  const hidden = new Set([...blockedByMe, ...blockedMe].map((row) => row.id));
  const rows = await db
    .select()
    .from(connections)
    .where(
      or(
        eq(connections.userAId, user.userId),
        eq(connections.userBId, user.userId),
      ),
    )
    .orderBy(desc(connections.createdAt))
    .limit(50);

  const visible = rows.filter(
    (row) =>
      !hidden.has(row.userAId === user.userId ? row.userBId : row.userAId),
  );
  const mateIds = [
    ...new Set(
      visible.map((row) =>
        row.userAId === user.userId ? row.userBId : row.userAId,
      ),
    ),
  ];
  const [mateProfiles, ownRatings] = await Promise.all([
    mateIds.length
      ? db
          .select({
            userId: profiles.userId,
            avatarUrl: profiles.avatarUrl,
            contact: profiles.contact,
          })
          .from(profiles)
          .where(inArray(profiles.userId, mateIds))
      : Promise.resolve([]),
    db
      .select({
        connectionId: connectionRatings.connectionId,
        score: connectionRatings.score,
        tags: connectionRatings.tags,
      })
      .from(connectionRatings)
      .where(eq(connectionRatings.raterId, user.userId))
      .limit(100),
  ]);
  const mateAvatars = new Map(
    mateProfiles.map((profile) => [profile.userId, profile.avatarUrl]),
  );
  const mateContacts = new Map(
    mateProfiles.map((profile) => [profile.userId, profile.contact]),
  );
  const ownRatingByConnection = new Map(
    ownRatings.map((rating) => [rating.connectionId, rating]),
  );
  const result = await Promise.all(
    visible.map(async (row) => {
      const isA = row.userAId === user.userId;
      const mateId = isA ? row.userBId : row.userAId;
      const [latest] = await db
        .select({ body: messages.body, createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.connectionId, row.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      const myLastRead = isA ? row.userALastReadAt : row.userBLastReadAt;
      const myRating = ownRatingByConnection.get(row.id);
      let myRatingTags: string[] = [];
      try {
        const parsed = myRating ? JSON.parse(myRating.tags) : [];
        if (Array.isArray(parsed))
          myRatingTags = parsed.filter(
            (value): value is string => typeof value === "string",
          );
      } catch {
        /* 古い評価のタグは空として扱う */
      }
      const unreadRows = await db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.connectionId, row.id),
            eq(messages.senderId, mateId),
            gt(messages.createdAt, myLastRead || new Date(0)),
          ),
        )
        .limit(99);
      return {
        id: row.id,
        mateName: isA ? row.userBName : row.userAName,
        mateAvatarUrl: mateAvatars.get(mateId) || "",
        matePokemon: isA ? row.userBPokemon : row.userAPokemon,
        mateContact: (isA ? row.userBShareContact : row.userAShareContact)
          ? mateContacts.get(mateId) || null
          : null,
        mateContactShared: isA
          ? row.userBShareContact
          : row.userAShareContact,
        myContactShared: isA
          ? row.userAShareContact
          : row.userBShareContact,
        myPokemon: isA ? row.userAPokemon : row.userBPokemon,
        againByMe: isA ? row.userAAgain : row.userBAgain,
        againByMate: isA ? row.userBAgain : row.userAAgain,
        mutualAgain: row.userAAgain && row.userBAgain,
        playedByMe: isA ? row.userAPlayed : row.userBPlayed,
        playedByMate: isA ? row.userBPlayed : row.userAPlayed,
        myRatingScore: myRating?.score || 0,
        myRatingTags,
        latestMessage:
          latest?.body ?? "マッチ成立！最初のメッセージを送りましょう",
        latestAt: latest?.createdAt ?? row.createdAt,
        unreadCount: unreadRows.length,
      };
    }),
  );
  return Response.json({ connections: result });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn },
      { status: 401 },
    );
  if (await isSuspended(user.userId))
    return Response.json(
      { error: "このアカウントは現在利用できません" },
      { status: 403 },
    );
  const rateLimit = await checkRateLimit(user.userId, {
    action: "connection",
    limit: 20,
    windowMs: 10 * 60_000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);
  const payload = (await request.json()) as {
    connectionId?: number;
    action?: "again" | "played" | "share_contact";
  };
  if (
    !payload.connectionId ||
    !["again", "played", "share_contact"].includes(payload.action || "")
  ) {
    return Response.json({ error: "操作を確認してください" }, { status: 400 });
  }
  const row = await connectionForUser(payload.connectionId, user.userId);
  if (!row)
    return Response.json({ error: "マッチが見つかりません" }, { status: 404 });
  const isA = row.userAId === user.userId;
  if (payload.action === "share_contact") {
    const next = !(isA ? row.userAShareContact : row.userBShareContact);
    if (next) {
      const [profile] = await getDb()
        .select({ contact: profiles.contact })
        .from(profiles)
        .where(eq(profiles.userId, user.userId))
        .limit(1);
      if (!profile?.contact.trim())
        return Response.json(
          { error: "先にプロフィールへ連絡先を登録してください" },
          { status: 409 },
        );
    }
    await getDb()
      .update(connections)
      .set(isA ? { userAShareContact: next } : { userBShareContact: next })
      .where(eq(connections.id, row.id));
    return Response.json({ ok: true, myContactShared: next });
  }
  if (payload.action === "played") {
    const alreadyPlayed = isA ? row.userAPlayed : row.userBPlayed;
    if (!alreadyPlayed) {
      await getDb()
        .update(connections)
        .set(isA ? { userAPlayed: true } : { userBPlayed: true })
        .where(eq(connections.id, row.id));
      const senderName = isA ? row.userAName : row.userBName;
      const mateId = isA ? row.userBId : row.userAId;
      await sendPush(
        mateId,
        "プレイ完了の記録が届きました",
        `${senderName}さんが「一緒に遊びました」を記録しました`,
        `/?chat=${row.id}`,
      );
    }
    return Response.json({
      ok: true,
      playedByMe: true,
      playedByMate: isA ? row.userBPlayed : row.userAPlayed,
    });
  }
  const next = !(isA ? row.userAAgain : row.userBAgain);
  await getDb()
    .update(connections)
    .set(isA ? { userAAgain: next } : { userBAgain: next })
    .where(eq(connections.id, row.id));
  const mateAgain = isA ? row.userBAgain : row.userAAgain;
  if (next) {
    const senderName = isA ? row.userAName : row.userBName;
    const mateId = isA ? row.userBId : row.userAId;
    await sendPush(
      mateId,
      "また遊びたいが届きました",
      `${senderName}さんからハートが届きました`,
      `/?chat=${row.id}`,
    );
  }
  return Response.json({
    ok: true,
    againByMe: next,
    againByMate: mateAgain,
    mutualAgain: next && mateAgain,
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn },
      { status: 401 },
    );
  if (await isSuspended(user.userId))
    return Response.json(
      { error: "このアカウントは現在利用できません" },
      { status: 403 },
    );
  const payload = (await request.json()) as {
    connectionId?: number;
    action?: "rematch";
  };
  if (!payload.connectionId || payload.action !== "rematch") {
    return Response.json({ error: "操作を確認してください" }, { status: 400 });
  }
  const row = await connectionForUser(payload.connectionId, user.userId);
  if (!row)
    return Response.json({ error: "マッチが見つかりません" }, { status: 404 });
  await getDb().insert(messages).values({
    connectionId: row.id,
    senderId: user.userId,
    body: "また一緒に遊びませんか？ 次の予定を相談しよう！",
    createdAt: new Date(),
  });
  return Response.json({ ok: true });
}
