import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  applications,
  blocks,
  connectionRatings,
  connections,
  presence,
  profileLikes,
  profiles,
  recruits,
} from "../../../db/schema";
import { getDb } from "../../../db";
import { getChatGPTUser } from "../../chatgpt-auth";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import {
  containsProhibitedContent,
  prohibitedContentMessage,
} from "../../../lib/content-policy";
import { sendPush } from "../../../lib/push";
import { profilePublicId, resolveProfilePublicId } from "../../../lib/profile-id";
import { normalizeRank } from "../../../lib/ranks";

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed))
      return parsed.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      );
  } catch {
    /* 旧形式は1件として扱う */
  }
  return value.trim() ? [value.trim()] : [];
}

const discoverPageSize = 50;

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
}

function discoverQuery(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const requestedOffset = Number(searchParams.get("offset") || 0);
  const requestedGender = searchParams.get("gender");
  return {
    offset:
      Number.isInteger(requestedOffset) && requestedOffset > 0
        ? requestedOffset
        : 0,
    pokemon: normalizeSearchText(searchParams.get("pokemon") || "").slice(
      0,
      40,
    ),
    pokemonExact: searchParams.get("pokemonExact") === "1",
    trainer: normalizeSearchText(searchParams.get("trainer") || "").slice(
      0,
      40,
    ),
    gender:
      requestedGender === "男性" || requestedGender === "女性"
        ? requestedGender
        : "",
    sharedTimeOnly: searchParams.get("sharedTimeOnly") === "1",
  };
}

async function loadProfileStats(db: ReturnType<typeof getDb>) {
  const [likeRows, ratingRows] = await Promise.all([
    db
      .select({
        userId: profileLikes.recipientId,
        count: sql<number>`count(*)`,
      })
      .from(profileLikes)
      .groupBy(profileLikes.recipientId),
    db
      .select({
        userId: connectionRatings.ratedUserId,
        count: sql<number>`count(*)`,
        average: sql<number>`avg(${connectionRatings.score})`,
      })
      .from(connectionRatings)
      .groupBy(connectionRatings.ratedUserId),
  ]);
  const likes = new Map(
    likeRows.map((row) => [row.userId, Number(row.count) || 0]),
  );
  const ratings = new Map(
    ratingRows.map((row) => [
      row.userId,
      { count: Number(row.count) || 0, average: Number(row.average) || 0 },
    ]),
  );
  const publicStats = (userId: string) => {
    const likeCount = likes.get(userId) || 0;
    const rating = ratings.get(userId) || { count: 0, average: 0 };
    return {
      likeCount,
      popular:
        likeCount >= 3 ||
        (rating.count >= 3 && rating.average >= 4.5),
    };
  };
  const internalScore = (userId: string) => {
    const likeCount = likes.get(userId) || 0;
    const rating = ratings.get(userId) || { count: 0, average: 0 };
    const quality =
      (rating.average * rating.count + 4 * 5) / (rating.count + 5);
    return quality + Math.min(Math.log1p(likeCount) * 0.08, 0.25);
  };
  return { publicStats, internalScore };
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const db = getDb();
  if (!user) {
    const [profileRows, activityRows, stats] = await Promise.all([
      db.select().from(profiles).orderBy(desc(profiles.updatedAt)).limit(80),
      db.select().from(presence).limit(200),
      loadProfileStats(db),
    ]);
    const lastActiveByUser = new Map(
      activityRows.map((row) => [row.userId, row.lastSeenAt]),
    );
    const activeCutoff = Date.now() - 30 * 24 * 60 * 60_000;
    const activityAt = (row: (typeof profileRows)[number]) =>
      lastActiveByUser.get(row.userId) || row.updatedAt;
    const visible = profileRows
      .filter(
        (row) =>
          !row.suspendedAt &&
          row.ageConfirmed &&
          row.termsAcceptedAt &&
          activityAt(row).getTime() >= activeCutoff,
      )
      .sort(
        (a, b) =>
          stats.internalScore(b.userId) - stats.internalScore(a.userId) ||
          activityAt(b).getTime() - activityAt(a).getTime(),
      )
      .slice(0, 30);
    const result = await Promise.all(
      visible.map(async (row) => ({
        id: await profilePublicId(row.userId),
        trainerName: `${row.trainerName.slice(0, 1) || "メ"}••`,
        mainPokemon: parseList(row.mainPokemon).slice(0, 5),
        highestRate: normalizeRank(row.highestRate),
        playTime: parseList(row.playTime).slice(0, 7),
        gender: row.gender,
        age: null,
        avatarUrl: "",
        bio: "",
        ...stats.publicStats(row.userId),
        registeredAt: row.createdAt,
        lastActiveAt: activityAt(row),
      })),
    );
    return Response.json({ profiles: result, limited: true });
  }
  const [me] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.userId))
    .limit(1);
  if (!me) return Response.json({ profiles: [] });
  const query = discoverQuery(request);
  const [
    profileRows,
    activityRows,
    blockedByMe,
    blockedMe,
    connectionRows,
    pendingRows,
    stats,
  ] = await Promise.all([
    db.select().from(profiles).orderBy(desc(profiles.updatedAt)),
    db.select().from(presence),
    db
      .select({ id: blocks.blockedId })
      .from(blocks)
      .where(eq(blocks.blockerId, user.userId)),
    db
      .select({ id: blocks.blockerId })
      .from(blocks)
      .where(eq(blocks.blockedId, user.userId)),
    db
      .select({ userAId: connections.userAId, userBId: connections.userBId })
      .from(connections)
      .where(
        or(
          eq(connections.userAId, user.userId),
          eq(connections.userBId, user.userId),
        ),
      ),
    db
      .select({ ownerId: recruits.ownerId })
      .from(applications)
      .innerJoin(recruits, eq(applications.recruitId, recruits.id))
      .where(
        and(
          eq(applications.applicantId, user.userId),
          eq(applications.status, "pending"),
          eq(recruits.kind, "profile"),
        ),
      ),
    loadProfileStats(db),
  ]);
  const hidden = new Set<string>([
    user.userId,
    ...blockedByMe.map((row) => row.id),
    ...blockedMe.map((row) => row.id),
    ...pendingRows.map((row) => row.ownerId),
  ]);
  for (const row of connectionRows)
    hidden.add(row.userAId === user.userId ? row.userBId : row.userAId);
  const lastActiveByUser = new Map(
    activityRows.map((row) => [row.userId, row.lastSeenAt]),
  );
  const activeCutoff = Date.now() - 30 * 24 * 60 * 60_000;
  const activityAt = (row: (typeof profileRows)[number]) =>
    lastActiveByUser.get(row.userId) || row.updatedAt;
  const visible = profileRows.filter(
    (row) =>
      !row.suspendedAt &&
      !hidden.has(row.userId) &&
      row.ageConfirmed &&
      row.termsAcceptedAt &&
      activityAt(row).getTime() >= activeCutoff,
  );
  const exactTrainerExists =
    Boolean(query.trainer) &&
    visible.some(
      (row) => normalizeSearchText(row.trainerName) === query.trainer,
    );
  const myPlayTime = parseList(me.playTime);
  const filtered = visible.filter((row) => {
    const mainPokemon = parseList(row.mainPokemon);
    const pokemonMatches =
      !query.pokemon ||
      mainPokemon.some((name) => {
        const normalizedName = normalizeSearchText(name);
        return query.pokemonExact
          ? normalizedName === query.pokemon
          : normalizedName.includes(query.pokemon);
      });
    const trainerName = normalizeSearchText(row.trainerName);
    const trainerMatches =
      !query.trainer ||
      (exactTrainerExists
        ? trainerName === query.trainer
        : trainerName.includes(query.trainer));
    const genderMatches = !query.gender || row.gender === query.gender;
    const playTime = parseList(row.playTime);
    const timeMatches =
      !query.sharedTimeOnly ||
      playTime.includes("時間帯はいつでも") ||
      myPlayTime.includes("時間帯はいつでも") ||
      playTime.some((time) => myPlayTime.includes(time));
    return pokemonMatches && trainerMatches && genderMatches && timeMatches;
  });
  const prioritized =
    me.gender === "男性"
      ? [...filtered].sort(
          (a, b) =>
            Number(b.gender === "女性") - Number(a.gender === "女性") ||
            stats.internalScore(b.userId) - stats.internalScore(a.userId) ||
            activityAt(b).getTime() - activityAt(a).getTime(),
        )
      : [...filtered].sort(
          (a, b) =>
            stats.internalScore(b.userId) - stats.internalScore(a.userId) ||
            activityAt(b).getTime() - activityAt(a).getTime(),
        );
  const pageRows = prioritized.slice(
    query.offset,
    query.offset + discoverPageSize,
  );
  const result = await Promise.all(
    pageRows.map(async (row) => ({
      id: await profilePublicId(row.userId),
      trainerName: row.trainerName,
      mainPokemon: parseList(row.mainPokemon).slice(0, 5),
      highestRate: normalizeRank(row.highestRate),
      playTime: parseList(row.playTime).slice(0, 7),
      gender: row.gender,
      age: row.age,
      avatarUrl: row.avatarUrl || "",
      bio: row.bio || "",
      ...stats.publicStats(row.userId),
      registeredAt: row.createdAt,
      lastActiveAt: activityAt(row),
    })),
  );
  const nextOffset = query.offset + pageRows.length;
  return Response.json({
    profiles: result,
    total: prioritized.length,
    hasMore: nextOffset < prioritized.length,
    nextOffset: nextOffset < prioritized.length ? nextOffset : null,
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn: "/login" },
      { status: 401 },
    );
  const rateLimit = await checkRateLimit(user.userId, {
    action: "profile-match",
    limit: 15,
    windowMs: 10 * 60_000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);
  const body = (await request.json()) as {
    targetId?: string;
    pokemon?: string;
    message?: string;
  };
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const pokemon = typeof body.pokemon === "string" ? body.pokemon.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!/^[a-f0-9]{32}$/.test(targetId) || !pokemon || !message)
    return Response.json(
      { error: "申請内容を確認してください" },
      { status: 400 },
    );
  if (message.length > 180 || containsProhibitedContent(message))
    return Response.json(
      {
        error: containsProhibitedContent(message)
          ? prohibitedContentMessage
          : "メッセージは180文字以内にしてください",
      },
      { status: 400 },
    );
  const db = getDb();
  const [profileIdRows, [applicant]] = await Promise.all([
    db.select({ userId: profiles.userId }).from(profiles),
    db.select().from(profiles).where(eq(profiles.userId, user.userId)).limit(1),
  ]);
  if (!applicant)
    return Response.json(
      { error: "先にプロフィールを登録してください" },
      { status: 409 },
    );
  const targetUserId = await resolveProfilePublicId(
    profileIdRows.map((row) => row.userId),
    targetId,
  );
  const [target] = targetUserId
    ? await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, targetUserId))
        .limit(1)
    : [];
  if (!target || target.suspendedAt || target.userId === user.userId)
    return Response.json(
      { error: "このプロフィールは現在表示できません" },
      { status: 404 },
    );
  const [blocked, connected, pending] = await Promise.all([
    db
      .select()
      .from(blocks)
      .where(
        or(
          and(
            eq(blocks.blockerId, user.userId),
            eq(blocks.blockedId, target.userId),
          ),
          and(
            eq(blocks.blockerId, target.userId),
            eq(blocks.blockedId, user.userId),
          ),
        ),
      )
      .limit(1),
    db
      .select()
      .from(connections)
      .where(
        or(
          and(
            eq(connections.userAId, user.userId),
            eq(connections.userBId, target.userId),
          ),
          and(
            eq(connections.userAId, target.userId),
            eq(connections.userBId, user.userId),
          ),
        ),
      )
      .limit(1),
    db
      .select({ id: applications.id })
      .from(applications)
      .innerJoin(recruits, eq(applications.recruitId, recruits.id))
      .where(
        and(
          eq(applications.applicantId, user.userId),
          eq(recruits.ownerId, target.userId),
          eq(recruits.kind, "profile"),
          eq(applications.status, "pending"),
        ),
      )
      .limit(1),
  ]);
  if (blocked.length)
    return Response.json(
      { error: "このプロフィールには申請できません" },
      { status: 403 },
    );
  if (connected.length)
    return Response.json({ error: "すでにマッチしています" }, { status: 409 });
  if (pending.length)
    return Response.json({ error: "すでに申請済みです" }, { status: 409 });
  const targetPokemon = parseList(target.mainPokemon)[0] || "未設定";
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
  const [recruit] = await db
    .insert(recruits)
    .values({
      kind: "profile",
      ownerId: target.userId,
      trainerName: target.trainerName,
      gender: target.gender,
      pokemon: targetPokemon,
      role: "プロフィール",
      matches: 0,
      winRate: 0,
      rank: normalizeRank(target.highestRate),
      playTime: parseList(target.playTime).join("・"),
      note: "",
      contact: "",
      startAt: now,
      expiresAt,
      partySize: 2,
      desiredPokemon: pokemon,
      desiredRole: "プロフィールマッチ",
      createdAt: now,
    })
    .returning();
  await db
    .insert(applications)
    .values({
      recruitId: recruit.id,
      applicantId: user.userId,
      applicantName: applicant.trainerName,
      applicantContact: "",
      pokemon,
      message,
      createdAt: now,
    });
  await sendPush(
    target.userId,
    "👋 手を振っています",
    `${applicant.trainerName}さんが一緒に遊びたいと送っています`,
    "/",
  );
  return Response.json({ ok: true }, { status: 201 });
}
