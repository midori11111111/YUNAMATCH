import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { notificationDismissals } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const keyPattern = /^(?:like|heart|accepted|declined|chat|request):\d+$/;

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
  for (let index = 0; index < keys.length; index += 50) {
    await db
      .insert(notificationDismissals)
      .values(
        keys.slice(index, index + 50).map((notificationKey) => ({
          userId: user.userId,
          notificationKey,
          createdAt: now,
        })),
      )
      .onConflictDoNothing();
  }
  return Response.json({ ok: true, dismissedKeys: keys });
}
