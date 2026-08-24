import { and, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { connections, presence, profiles } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { identityAliases } from "../../../lib/account-aliases";

async function resolvedIdentity(userId: string, email?: string | null) {
  const aliases = await identityAliases(userId, email || undefined);
  const [profile] = await getDb()
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(inArray(profiles.userId, aliases))
    .limit(1);
  return {
    aliases,
    canonicalUserId: profile?.userId || aliases[0] || userId,
  };
}

async function connectionFor(connectionId: number, userIds: string[]) {
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

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const connectionId = Number(
    new URL(request.url).searchParams.get("connectionId"),
  );
  if (!connectionId) return Response.json({ online: false, typing: false });
  const identity = await resolvedIdentity(user.userId, user.email);
  const connection = await connectionFor(connectionId, identity.aliases);
  if (!connection)
    return Response.json({ online: false, typing: false });
  const isA = identity.aliases.includes(connection.userAId);
  const mateId = isA ? connection.userBId : connection.userAId;
  const [row] = await getDb()
    .select()
    .from(presence)
    .where(eq(presence.userId, mateId))
    .limit(1);
  const age = row ? Date.now() - row.lastSeenAt.getTime() : Infinity;
  return Response.json({
    online: age < 3 * 60_000,
    typing: Boolean(
      row?.typing && row.connectionId === connectionId && age < 8_000,
    ),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const payload = (await request.json()) as {
    connectionId?: number;
    typing?: boolean;
  };
  const identity = await resolvedIdentity(user.userId, user.email);
  if (
    payload.connectionId &&
    !(await connectionFor(payload.connectionId, identity.aliases))
  )
    return Response.json({ error: "チャットが見つかりません" }, { status: 404 });
  const now = new Date();
  const existing = await getDb()
    .select({ userId: presence.userId })
    .from(presence)
    .where(eq(presence.userId, identity.canonicalUserId))
    .limit(1);
  if (existing.length) {
    await getDb()
      .update(presence)
      .set(
        payload.connectionId
          ? {
              connectionId: payload.connectionId,
              typing: Boolean(payload.typing),
              lastSeenAt: now,
            }
          : { lastSeenAt: now },
      )
      .where(eq(presence.userId, identity.canonicalUserId));
  } else {
    await getDb().insert(presence).values({
      userId: identity.canonicalUserId,
      connectionId: payload.connectionId || null,
      typing: Boolean(payload.typing),
      lastSeenAt: now,
    });
  }
  return Response.json({ ok: true });
}
