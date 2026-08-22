import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";

type MediaEnv = { MEDIA?: R2Bucket };

async function headerId(userId: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const rateLimit = await checkRateLimit(user.userId, { action: "profile-header", limit: 10, windowMs: 60 * 60_000 });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);
  const media = (env as unknown as MediaEnv).MEDIA;
  if (!media) return Response.json({ error: "画像保存を準備中です" }, { status: 503 });
  const contentType = request.headers.get("content-type")?.split(";")[0] || "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType))
    return Response.json({ error: "JPEG・PNG・WebP画像を選んでください" }, { status: 400 });
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 900_000)
    return Response.json({ error: "画像サイズが大きすぎます" }, { status: 413 });
  const id = await headerId(user.userId);
  await media.put(`headers/${id}`, bytes, { httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" } });
  return Response.json({ headerUrl: `/api/media/header/${id}?v=${Date.now()}` });
}

export async function DELETE() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const media = (env as unknown as MediaEnv).MEDIA;
  if (media) await media.delete(`headers/${await headerId(user.userId)}`);
  return Response.json({ ok: true });
}
