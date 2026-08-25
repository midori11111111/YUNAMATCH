import { and, asc, desc, eq, gte, inArray, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { availabilitySlots, blocks, connections, profiles } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { identityAliases } from "../../../lib/account-aliases";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { isSuspended } from "../../../lib/safety";

const allowedMatchTypes = new Set(["ランクマッチ", "カジュアル"]);
const allowedVisibility = new Set(["mates", "favorites", "private"]);
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const queryChunkSize = 80;

function chunked<T>(values: T[], size = queryChunkSize) {
  const groups: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    groups.push(values.slice(index, index + size));
  return groups;
}

function todayInJapan() {
  return new Date(Date.now() + 9 * 60 * 60_000).toISOString().slice(0, 10);
}

function serialize(row: typeof availabilitySlots.$inferSelect) {
  return {
    id: row.id,
    day: row.day,
    startTime: row.startTime,
    endTime: row.endTime,
    matchType: row.matchType,
    visibility: row.visibility,
    note: row.note,
  };
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const aliases = await identityAliases(user.userId, user.email);
  const aliasSet = new Set(aliases);
  const db = getDb();
  const connectionId = Number(
    new URL(request.url).searchParams.get("connectionId"),
  );
  const scope = new URL(request.url).searchParams.get("scope");
  const [profile] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(inArray(profiles.userId, aliases))
    .limit(1);
  const ownIds = [...new Set([...aliases, profile?.userId].filter(Boolean))] as string[];
  const own = await db
    .select()
    .from(availabilitySlots)
    .where(
      and(
        inArray(availabilitySlots.userId, ownIds),
        gte(availabilitySlots.day, todayInJapan()),
      ),
    )
    .orderBy(asc(availabilitySlots.day), asc(availabilitySlots.startTime))
    .limit(40);

  if (scope === "mates") {
    const [connectionRows, blockRows] = await Promise.all([
      db
        .select({
          id: connections.id,
          userAId: connections.userAId,
          userBId: connections.userBId,
          userAName: connections.userAName,
          userBName: connections.userBName,
          userAPinned: connections.userAPinned,
          userBPinned: connections.userBPinned,
          userAArchived: connections.userAArchived,
          userBArchived: connections.userBArchived,
        })
        .from(connections)
        .where(
          or(
            inArray(connections.userAId, aliases),
            inArray(connections.userBId, aliases),
          ),
        )
        .orderBy(desc(connections.id))
        .limit(300),
      db
        .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
        .from(blocks)
        .where(
          or(
            inArray(blocks.blockerId, aliases),
            inArray(blocks.blockedId, aliases),
          ),
        ),
    ]);
    const hidden = new Set(
      blockRows.map((row) =>
        aliasSet.has(row.blockerId) ? row.blockedId : row.blockerId,
      ),
    );
    const relationByMate = new Map<
      string,
      { connectionId: number; mateId: string; mateName: string; favoriteViewer: boolean }
    >();
    for (const row of connectionRows) {
      const isA = aliasSet.has(row.userAId);
      const mateId = isA ? row.userBId : row.userAId;
      const archived = isA ? row.userAArchived : row.userBArchived;
      if (archived || hidden.has(mateId) || relationByMate.has(mateId)) continue;
      relationByMate.set(mateId, {
        connectionId: row.id,
        mateId,
        mateName: isA ? row.userBName : row.userAName,
        // お気に入り限定は、予定の持ち主が閲覧者をピン留めしている場合だけ見せる。
        favoriteViewer: isA ? row.userBPinned : row.userAPinned,
      });
    }
    const mateIds = [...relationByMate.keys()];
    if (!mateIds.length)
      return Response.json({ own: own.map(serialize), mates: [] });
    const [slotGroups, profileGroups] = await Promise.all([
      Promise.all(
        chunked(mateIds).map((ids) =>
          db
            .select()
            .from(availabilitySlots)
            .where(
              and(
                inArray(availabilitySlots.userId, ids),
                gte(availabilitySlots.day, todayInJapan()),
              ),
            )
            .orderBy(asc(availabilitySlots.day), asc(availabilitySlots.startTime))
            .limit(200),
        ),
      ),
      Promise.all(
        chunked(mateIds).map((ids) =>
          db
            .select({ userId: profiles.userId, avatarUrl: profiles.avatarUrl })
            .from(profiles)
            .where(inArray(profiles.userId, ids)),
        ),
      ),
    ]);
    const avatarByMate = new Map(
      profileGroups.flat().map((row) => [row.userId, row.avatarUrl || ""]),
    );
    const mates = slotGroups
      .flat()
      .flatMap((slot) => {
        const relation = relationByMate.get(slot.userId);
        if (
          !relation ||
          slot.visibility === "private" ||
          (slot.visibility === "favorites" && !relation.favoriteViewer)
        )
          return [];
        return [{
          ...serialize(slot),
          connectionId: relation.connectionId,
          mateId: relation.mateId,
          mateName: relation.mateName,
          mateAvatarUrl: avatarByMate.get(relation.mateId) || "",
        }];
      })
      .slice(0, 200);
    return Response.json({ own: own.map(serialize), mates });
  }

  if (!Number.isInteger(connectionId) || connectionId < 1)
    return Response.json({ own: own.map(serialize), mate: [] });

  const [connection] = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.id, connectionId),
        or(
          inArray(connections.userAId, aliases),
          inArray(connections.userBId, aliases),
        ),
      ),
    )
    .limit(1);
  if (!connection)
    return Response.json({ error: "マッチが見つかりません" }, { status: 404 });

  const isA = aliasSet.has(connection.userAId);
  const mateId = isA ? connection.userBId : connection.userAId;
  const matePinnedThisChat = isA
    ? connection.userBPinned
    : connection.userAPinned;
  const mate = await db
    .select()
    .from(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.userId, mateId),
        gte(availabilitySlots.day, todayInJapan()),
        matePinnedThisChat
          ? inArray(availabilitySlots.visibility, ["mates", "favorites"])
          : eq(availabilitySlots.visibility, "mates"),
      ),
    )
    .orderBy(asc(availabilitySlots.day), asc(availabilitySlots.startTime))
    .limit(40);
  return Response.json({ own: own.map(serialize), mate: mate.map(serialize) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  if (await isSuspended(user.userId))
    return Response.json(
      { error: "このアカウントは現在利用できません" },
      { status: 403 },
    );
  const rateLimit = await checkRateLimit(user.userId, {
    action: "availability",
    limit: 30,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);
  const payload = (await request.json()) as {
    day?: string;
    startTime?: string;
    endTime?: string;
    matchType?: string;
    visibility?: string;
    note?: string;
  };
  const day = payload.day?.trim() || "";
  const startTime = payload.startTime?.trim() || "";
  const endTime = payload.endTime?.trim() || "";
  const matchType = payload.matchType?.trim() || "";
  const visibility = payload.visibility?.trim() || "mates";
  const note = payload.note?.trim().slice(0, 80) || "";
  const maxDay = new Date(Date.now() + 31 * 24 * 60 * 60_000)
    .toISOString()
    .slice(0, 10);
  if (
    !dayPattern.test(day) ||
    day < todayInJapan() ||
    day > maxDay ||
    !timePattern.test(startTime) ||
    !timePattern.test(endTime) ||
    endTime <= startTime ||
    !allowedMatchTypes.has(matchType) ||
    !allowedVisibility.has(visibility)
  )
    return Response.json({ error: "予定の内容を確認してください" }, { status: 400 });

  const aliases = await identityAliases(user.userId, user.email);
  const [profile] = await getDb()
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(inArray(profiles.userId, aliases))
    .limit(1);
  const ownerId = profile?.userId || aliases[0] || user.userId;
  const [slot] = await getDb()
    .insert(availabilitySlots)
    .values({
      userId: ownerId,
      day,
      startTime,
      endTime,
      matchType,
      visibility,
      note,
      createdAt: new Date(),
    })
    .returning();
  return Response.json({ slot: serialize(slot) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const payload = (await request.json()) as { id?: number };
  if (!Number.isInteger(payload.id))
    return Response.json({ error: "予定を選択してください" }, { status: 400 });
  const aliases = await identityAliases(user.userId, user.email);
  const deleted = await getDb()
    .delete(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.id, payload.id!),
        inArray(availabilitySlots.userId, aliases),
      ),
    )
    .returning({ id: availabilitySlots.id });
  if (!deleted.length)
    return Response.json({ error: "予定が見つかりません" }, { status: 404 });
  return Response.json({ ok: true });
}
