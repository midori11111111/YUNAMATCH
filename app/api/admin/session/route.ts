import {
  adminSessionCookieName,
  createAdminSessionToken,
  passwordMatchesAdmin,
} from "../../../../lib/admin";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";

async function requestFingerprint(request: Request) {
  const source =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("user-agent") ||
    "unknown";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  if (!process.env.ADMIN_PASSWORD)
    return Response.json(
      { error: "管理者ログインは現在利用できません" },
      { status: 503 },
    );
  const rateLimit = await checkRateLimit(await requestFingerprint(request), {
    action: "admin-login",
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);
  const body = (await request.json().catch(() => ({}))) as {
    password?: unknown;
  };
  const password = typeof body.password === "string" ? body.password : "";
  if (!(await passwordMatchesAdmin(password)))
    return Response.json({ error: "パスワードが違います" }, { status: 401 });
  const token = await createAdminSessionToken();
  if (!token)
    return Response.json(
      { error: "管理者ログインは現在利用できません" },
      { status: 503 },
    );
  return Response.json(
    { ok: true },
    {
      headers: {
        "set-cookie": `${adminSessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${12 * 60 * 60}`,
      },
    },
  );
}

export async function DELETE() {
  return Response.json(
    { ok: true },
    {
      headers: {
        "set-cookie": `${adminSessionCookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      },
    },
  );
}
