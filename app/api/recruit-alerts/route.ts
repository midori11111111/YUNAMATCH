import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { recruitAlerts } from "../../../db/schema";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const [preference] = await getDb()
    .select({ enabled: recruitAlerts.enabled })
    .from(recruitAlerts)
    .where(eq(recruitAlerts.userId, user.userId))
    .limit(1);
  return Response.json({ enabled: Boolean(preference?.enabled) });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const rateLimit = await checkRateLimit(user.userId, {
    action: "recruit-alert-setting",
    limit: 20,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);
  const payload = (await request.json()) as { enabled?: boolean };
  if (typeof payload.enabled !== "boolean") {
    return Response.json({ error: "通知設定を確認してください" }, { status: 400 });
  }
  const now = new Date();
  await getDb()
    .insert(recruitAlerts)
    .values({
      userId: user.userId,
      enabled: payload.enabled,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: recruitAlerts.userId,
      set: { enabled: payload.enabled, updatedAt: now },
    });
  return Response.json({ enabled: payload.enabled });
}
