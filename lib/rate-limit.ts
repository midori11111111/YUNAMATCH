import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { rateLimitBuckets } from "../db/schema";

export type RateLimitRule = { action: string; limit: number; windowMs: number };

export async function checkRateLimit(userId: string, rule: RateLimitRule) {
  const db = getDb();
  const now = new Date();
  const key = `${rule.action}:${userId}`;
  const [current] = await db.select().from(rateLimitBuckets).where(eq(rateLimitBuckets.key, key)).limit(1);

  if (!current || current.resetAt <= now) {
    await db.insert(rateLimitBuckets).values({ key, count: 1, resetAt: new Date(now.getTime() + rule.windowMs), updatedAt: now })
      .onConflictDoUpdate({ target: rateLimitBuckets.key, set: { count: 1, resetAt: new Date(now.getTime() + rule.windowMs), updatedAt: now } });
    return { allowed: true, remaining: rule.limit - 1, retryAfter: 0 };
  }

  if (current.count >= rule.limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((current.resetAt.getTime() - now.getTime()) / 1000)) };
  }

  await db.update(rateLimitBuckets).set({ count: current.count + 1, updatedAt: now }).where(eq(rateLimitBuckets.key, key));
  return { allowed: true, remaining: rule.limit - current.count - 1, retryAfter: 0 };
}

export function rateLimitResponse(retryAfter: number) {
  return Response.json({ error: "短時間の操作回数が多すぎます。少し待ってからもう一度お試しください", retryAfter }, {
    status: 429,
    headers: { "retry-after": String(retryAfter) },
  });
}
