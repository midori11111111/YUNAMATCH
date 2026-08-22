import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  accountLinks,
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

async function identityAliases(userId: string, email: string) {
  const db = getDb();
  const rows = await db
    .select({ canonicalUserId: accountLinks.canonicalUserId })
    .from(accountLinks)
    .where(
      email.includes("@")
        ? or(
            eq(accountLinks.canonicalUserId, userId),
            eq(accountLinks.email, email),
          )
        : eq(accountLinks.canonicalUserId, userId),
    );
  return [...new Set([userId, ...rows.map((row) => row.canonicalUserId)])];
}

async function adoptLegacyConnectionHistory(userId: string, aliases: string[]) {
  const legacyIds = aliases.filter((id) => id !== userId);
  if (!legacyIds.length) return;
  const db = getDb();
  await db
    .update(connections)
    .set({ userAId: userId })
    .where(inArray(connections.userAId, legacyIds));
  await db
    .update(connections)
    .set({ userBId: userId })
    .where(inArray(connections.userBId, legacyIds));
  try {
    await db
      .update(messages)
      .set({ senderId: userId })
      .where(inArray(messages.senderId, legacyIds));
  } catch {
    /* 古い重複メッセージがあっても、メイト履歴の復元は続ける */
  }
}

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return value ? [value] : [];
  }
}

async function backfillAcceptedConnections(userIds: string[]) {
  const db = getDb();
  const currentUserId = userIds[0];
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
    .leftJoin(connections, eq(applications.id, connections.applicationId))
    .where(
      and(
        eq(applications.status, "accepted"),
        isNull(connections.id),
        or(
          inArray(recruits.ownerId, userIds),
          inArray(applications.applicantId, userIds),
        ),
      ),
    )
    .limit(50);

  if (!rows.length) return;
  for (const row of rows) {
    const userAId = userIds.includes(row.ownerId)
      ? currentUserId
      : row.ownerId;
    const userBId = userIds.includes(row.applicantId)
      ? currentUserId
      : row.applicantId;
    if (userAId === userBId) continue;
    try {
      await db
        .insert(connections)
        .values({
        applicationId: row.applicationId,
        recruitId: row.recruitId,
        userAId,
        userBId,
        userAName: row.ownerName,
        userBName: row.applicantName,
        userAPokemon: row.ownerPokemon,
        userBPokemon: row.applicantPokemon,
        userAContact: "",
        userBContact: "",
        createdAt: row.createdAt,
        })
        .onConflictDoNothing();
    } catch (error) {
      console.error(
        "Connection backfill row skipped",
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn },
      { status: 401 },
    );
  const aliases = await identityAliases(user.userId, user.email);
  try {
    await adoptLegacyConnectionHistory(user.userId, aliases);
  } catch (error) {
    console.error(
      "Legacy connection adoption skipped",
      error instanceof Error ? error.message : error,
    );
  }
  try {
    await backfillAcceptedConnections(aliases);
  } catch (error) {
    console.error(
      "Connection backfill skipped",
      error instanceof Error ? error.message : error,
    );
  }

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
            trainerName: profiles.trainerName,
            mainPokemon: profiles.mainPokemon,
            highestRate: profiles.highestRate,
            playTime: profiles.playTime,
            gender: profiles.gender,
            age: profiles.age,
            bio: profiles.bio,
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
  const mateProfileById = new Map(
    mateProfiles.map((profile) => [profile.userId, profile]),
  );
  const ownRatingByConnection = new Map(
    ownRatings.map((rating) => [rating.connectionId, rating]),
  );
  const result = await Promise.all(
    visible.map(async (row) => {
      const isA = row.userAId === user.userId;
      const mateId = isA ? row.userBId : row.userAId;
      const mateProfile = mateProfileById.get(mateId);
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
        mateId,
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
        mateMainPokemon: mateProfile
          ? parseList(mateProfile.mainPokemon).slice(0, 5)
          : [isA ? row.userBPokemon : row.userAPokemon],
        mateHighestRate: mateProfile?.highestRate || "未設定",
        matePlayTime: mateProfile ? parseList(mateProfile.playTime) : [],
        mateGender: mateProfile?.gender || "未設定",
        mateAge: mateProfile?.age ?? null,
        mateBio: mateProfile?.bio || "",
        againByMe: isA ? row.userAAgain : row.userBAgain,
        againByMate: isA ? row.userBAgain : row.userAAgain,
        mutualAgain: row.userAAgain && row.userBAgain,
        playedByMe: isA ? row.userAPlayed : row.userBPlayed,
        playedByMate: isA ? row.userBPlayed : row.userAPlayed,
        pinned: isA ? row.userAPinned : row.userBPinned,
        myRatingScore: myRating?.score || 0,
        myRatingTags,
        latestMessage:
          latest?.body ?? "マッチ成立！最初のメッセージを送りましょう",
        latestAt: latest?.createdAt ?? row.createdAt,
        unreadCount: unreadRows.length,
      };
    }),
  );
  result.sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.latestAt.getTime() - a.latestAt.getTime(),
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
    action?: "again" | "played" | "share_contact" | "pin";
  };
  if (
    !payload.connectionId ||
    !["again", "played", "share_contact", "pin"].includes(payload.action || "")
  ) {
    return Response.json({ error: "操作を確認してください" }, { status: 400 });
  }
  const row = await connectionForUser(payload.connectionId, user.userId);
  if (!row)
    return Response.json({ error: "マッチが見つかりません" }, { status: 404 });
  const isA = row.userAId === user.userId;
  if (payload.action === "pin") {
    const pinned = !(isA ? row.userAPinned : row.userBPinned);
    await getDb()
      .update(connections)
      .set(isA ? { userAPinned: pinned } : { userBPinned: pinned })
      .where(eq(connections.id, row.id));
    return Response.json({ ok: true, pinned });
  }
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
