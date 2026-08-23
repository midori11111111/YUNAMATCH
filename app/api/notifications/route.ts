import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { notificationDismissals } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const keyPattern = /^(?:(?:like|heart|accepted|declined|request):\d+|chat:\d+(?::\d+)?)$/;

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn: "/login" },
      { status: 401 },
    );
  const rows = await getDb()
    .select({ key: notificationDismissals.notificationKey })
    .from(notificationDismissals)
    .where(eq(notificationDismissals.userId, user.userId))
    .limit(1000);
  return Response.json({ dismissedKeys: rows.map((row) => row.key) });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn: "/login" },
      { status: 401 },
    );
  const body = (await request.json().catch(() => ({}))) as { keys?: unknown };
  const keys = Array.isArray(body.keys)
    ? [...new Set(body.keys.filter((key): key is string => typeof key === "string" && keyPattern.test(key)))]
    : [];
  if (!keys.length)
    return Response.json({ error: "消す通知を確認してください" }, { status: 400 });
  if (keys.length > 500)
    return Response.json({ error: "一度に消せる通知数を超えています" }, { status: 413 });
  const now = new Date();
  const db = getDb();
  // D1 allows at most 100 bound values in one statement. Each row binds
  // userId, notificationKey and createdAt, so keep each multi-row insert
  // comfortably below that limit. This matters when "すべて消す" includes
  // dozens of notifications at once.
  const rowsPerInsert = 25;
  for (let index = 0; index < keys.length; index += rowsPerInsert) {
    await db
      .insert(notificationDismissals)
      .values(
        keys.slice(index, index + rowsPerInsert).map((notificationKey) => ({
          userId: user.userId,
          notificationKey,
          createdAt: now,
        })),
      )
      .onConflictDoNothing();
  }
  return Response.json({ ok: true, dismissedKeys: keys });
}
