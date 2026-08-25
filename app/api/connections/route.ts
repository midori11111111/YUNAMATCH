import { and, count, desc, eq, gt, inArray, isNull, lt, max, or, sql } from "drizzle-orm";
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
import { identityAliases } from "../../../lib/account-aliases";

const signIn = "/login";
const connectionListLimit = 200;
const queryChunkSize = 80;

function chunked<T>(values: T[], size = queryChunkSize) {
  const groups: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    groups.push(values.slice(index, index + size));
  return groups;
}

async function connectionForUser(connectionId: number, userIds: string[]) {
  const [row] = await getDb()
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.id, connectionId),
        or(
          inArray(connections.userAId, userIds),
          inArray(connections.userBId, userIds),
        ),
      ),
    )
    .limit(1);
  return row;
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
    .limit(40);

  if (!rows.length) return;
  const values = rows.flatMap((row) => {
    const userAId = userIds.includes(row.ownerId)
      ? currentUserId
      : row.ownerId;
    const userBId = userIds.includes(row.applicantId)
      ? currentUserId
      : row.applicantId;
    if (userAId === userBId) return [];
    return [{
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
    }];
  });
  // D1 has a bounded number of bind parameters per statement. Batching a few
  // rows at a time avoids the previous one-write-per-connection latency while
  // staying under that limit.
  for (const group of chunked(values, 7)) {
    try {
      await db
        .insert(connections)
        .values(group)
        .onConflictDoNothing();
    } catch (error) {
      console.error(
        "Connection backfill row skipped",
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn },
      { status: 401 },
    );
  const aliases = await identityAliases(user.userId, user.email);
  const aliasSet = new Set(aliases);
  const beforeValue = Number(new URL(request.url).searchParams.get("before"));
  const before = Number.isInteger(beforeValue) && beforeValue > 0 ? beforeValue : null;
  const archivedOnly = new URL(request.url).searchParams.get("archived") === "1";
  // 過去データ修復は通常の一覧取得では実行しない。毎回の結合検索が
  // 混雑時のD1負荷を大きくしていたため、明示した保守リクエストだけに限定する。
  if (new URL(request.url).searchParams.get("repair") === "1") {
    try {
      await backfillAcceptedConnections(aliases);
    } catch (error) {
      console.error("Connection backfill skipped", error);
    }
  }

  const db = getDb();
  const blockRows = await db
    .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
    .from(blocks)
    .where(
      or(
        inArray(blocks.blockerId, aliases),
        inArray(blocks.blockedId, aliases),
      ),
    );
  const hidden = new Set(
    blockRows.map((row) =>
      aliasSet.has(row.blockerId) ? row.blockedId : row.blockerId,
    ),
  );
  const rows = await db
    .select()
    .from(connections)
    .where(and(
      or(
        and(
          inArray(connections.userAId, aliases),
          eq(connections.userAArchived, archivedOnly),
        ),
        and(
          inArray(connections.userBId, aliases),
          eq(connections.userBArchived, archivedOnly),
        ),
      ),
      before ? lt(connections.id, before) : undefined,
    ))
    .orderBy(desc(connections.id))
    .limit(connectionListLimit + 1);

  const hasMore = rows.length > connectionListLimit;
  const pageRows = rows.slice(0, connectionListLimit);
  const nextCursor = pageRows.at(-1)?.id ?? null;

  const visible = pageRows.filter(
    (row) =>
      !hidden.has(aliasSet.has(row.userAId) ? row.userBId : row.userAId),
  );
  if (!visible.length) return Response.json({ connections: [], hasMore, nextCursor });
  const mateIds = [
    ...new Set(
      visible.map((row) =>
        aliasSet.has(row.userAId) ? row.userBId : row.userAId,
      ),
    ),
  ];
  const connectionIds = visible.map((row) => row.id);
  // プロフィール、評価、最新文、未読数はチャット一覧の補助情報。
  // 混雑時にどれか一つが失敗しても成立済みチャット自体は隠さない。
  const [mateProfiles, ownRatings, latestIdRows, unreadCountRows] = await Promise.all([
    Promise.all(
      chunked(mateIds).map((ids) => db
          .select({
            userId: profiles.userId,
            avatarUrl: profiles.avatarUrl,
            headerUrl: profiles.headerUrl,
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
          .where(inArray(profiles.userId, ids))),
    )
      .then((groups) => groups.flat())
      .catch((error) => {
        console.error("Connection profile enrichment skipped", error);
        return [];
      }),
    db
      .select({
        connectionId: connectionRatings.connectionId,
        score: connectionRatings.score,
        tags: connectionRatings.tags,
      })
      .from(connectionRatings)
      .where(and(
        inArray(connectionRatings.raterId, aliases),
        inArray(connectionRatings.connectionId, connectionIds),
      ))
      .catch((error) => {
        console.error("Connection rating enrichment skipped", error);
        return [];
      }),
    Promise.all(
      chunked(connectionIds).map((ids) => db
        .select({
          connectionId: messages.connectionId,
          messageId: max(messages.id),
        })
        .from(messages)
        .where(inArray(messages.connectionId, ids))
        .groupBy(messages.connectionId)),
    )
      .then((groups) => groups.flat())
      .catch((error) => {
        console.error("Connection latest-message lookup skipped", error);
        return [];
      }),
    Promise.all(
      chunked(connectionIds).map((ids) => db
        .select({
          connectionId: messages.connectionId,
          unreadCount: count(),
        })
        .from(messages)
        .innerJoin(connections, eq(messages.connectionId, connections.id))
        .where(
          and(
            inArray(messages.connectionId, ids),
            or(
              and(
                inArray(connections.userAId, aliases),
                eq(messages.senderId, connections.userBId),
                gt(
                  messages.createdAt,
                  sql<Date>`coalesce(${connections.userALastReadAt}, 0)`,
                ),
              ),
              and(
                inArray(connections.userBId, aliases),
                eq(messages.senderId, connections.userAId),
                gt(
                  messages.createdAt,
                  sql<Date>`coalesce(${connections.userBLastReadAt}, 0)`,
                ),
              ),
            ),
          ),
        )
        .groupBy(messages.connectionId)),
    )
      .then((groups) => groups.flat())
      .catch((error) => {
        console.error("Connection unread-count lookup skipped", error);
        return [];
      }),
  ]);
  const latestMessageIds = latestIdRows
    .map((row) => row.messageId)
    .filter((id): id is number => typeof id === "number");
  const latestMessages = (
    await Promise.all(
      chunked(latestMessageIds).map((ids) =>
        db
          .select({
            id: messages.id,
            body: messages.body,
            deletedAt: messages.deletedAt,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(inArray(messages.id, ids)),
      ),
    ).catch((error) => {
      console.error("Connection latest-message enrichment skipped", error);
      return [];
    })
  ).flat();
  const latestMessageById = new Map(
    latestMessages.map((message) => [message.id, message]),
  );
  const latestMessageByConnection = new Map(
    latestIdRows.map((row) => [
      row.connectionId,
      typeof row.messageId === "number"
        ? latestMessageById.get(row.messageId)
        : undefined,
    ]),
  );
  const unreadCountByConnection = new Map(
    unreadCountRows.map((row) => [row.connectionId, Number(row.unreadCount)]),
  );
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
  const result = visible.map((row) => {
      const isA = aliasSet.has(row.userAId);
      const mateId = isA ? row.userBId : row.userAId;
      const mateProfile = mateProfileById.get(mateId);
      const latest = latestMessageByConnection.get(row.id);
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
      return {
        id: row.id,
        createdAt: row.createdAt,
        archived: isA ? row.userAArchived : row.userBArchived,
        recruitId: row.recruitId,
        mateId,
        mateName:
          mateProfile?.trainerName ||
          (isA ? row.userBName : row.userAName),
        mateAvatarUrl: mateAvatars.get(mateId) || "",
        mateHeaderUrl: mateProfile?.headerUrl || "",
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
        latestMessage: latest
          ? latest.deletedAt
            ? "メッセージの送信を取り消しました"
            : latest.body
          : "マッチ成立！最初のメッセージを送りましょう",
        latestMessageId: latest?.id ?? null,
        latestAt: latest?.createdAt ?? row.createdAt,
        unreadCount: Math.min(99, unreadCountByConnection.get(row.id) || 0),
      };
    });
  result.sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.latestAt.getTime() - a.latestAt.getTime(),
  );
  return Response.json({ connections: result, hasMore, nextCursor });
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
    action?: "again" | "played" | "share_contact" | "pin" | "archive" | "restore";
  };
  if (
    !payload.connectionId ||
    !["again", "played", "share_contact", "pin", "archive", "restore"].includes(payload.action || "")
  ) {
    return Response.json({ error: "操作を確認してください" }, { status: 400 });
  }
  const aliases = await identityAliases(user.userId, user.email);
  const row = await connectionForUser(payload.connectionId, aliases);
  if (!row)
    return Response.json({ error: "マッチが見つかりません" }, { status: 404 });
  const isA = aliases.includes(row.userAId);
  if (payload.action === "archive" || payload.action === "restore") {
    const archived = payload.action === "archive";
    await getDb()
      .update(connections)
      .set(
        isA
          ? { userAArchived: archived, userAPinned: archived ? false : row.userAPinned }
          : { userBArchived: archived, userBPinned: archived ? false : row.userBPinned },
      )
      .where(eq(connections.id, row.id));
    return Response.json({ ok: true, archived });
  }
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
        .where(inArray(profiles.userId, aliases))
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
  const aliases = await identityAliases(user.userId, user.email);
  const row = await connectionForUser(payload.connectionId, aliases);
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
