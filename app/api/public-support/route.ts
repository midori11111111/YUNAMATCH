import { createHash } from "node:crypto";
import { getDb } from "../../../db";
import { supportTickets } from "../../../db/schema";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";

const categories = new Set(["アカウント・ログイン", "個人情報・退会", "安全・通報", "不具合", "その他"]);

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { category?: unknown; replyContact?: unknown; message?: unknown };
  const category = typeof payload.category === "string" ? payload.category : "";
  const replyContact = typeof payload.replyContact === "string" ? payload.replyContact.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!categories.has(category) || replyContact.length < 3 || replyContact.length > 120 || message.length < 10 || message.length > 1000) {
    return Response.json({ error: "返信先と10〜1000文字のお問い合わせ内容を確認してください" }, { status: 400 });
  }

  const anonymousId = createHash("sha256").update(replyContact.toLowerCase()).digest("hex").slice(0, 24);
  const rateLimit = await checkRateLimit(`public:${anonymousId}`, { action: "public-support", limit: 3, windowMs: 24 * 60 * 60_000 });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  const now = new Date();
  const [ticket] = await getDb().insert(supportTickets).values({
    userId: `public:${anonymousId}`,
    trainerName: "ログイン前のお問い合わせ",
    category,
    message: `返信先: ${replyContact}\n\n${message}`,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: supportTickets.id });
  return Response.json({ ok: true, ticketId: ticket.id }, { status: 201 });
}
