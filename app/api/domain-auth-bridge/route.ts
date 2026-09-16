import { encode } from "@auth/core/jwt";
import { getChatGPTUser } from "../../chatgpt-auth";

const SESSION_COOKIE_NAME = "__Secure-authjs.session-token";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const ALLOWED_TARGETS = new Set(["daigomatch.com", "www.daigomatch.com"]);

function safeRelativePath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.redirect(new URL("/login", "https://yunamatch.com"), 303);
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) return new Response("Authentication is unavailable", { status: 503 });

  const source = new URL(request.url);
  const target = source.searchParams.get("target") ?? "";
  if (!ALLOWED_TARGETS.has(target)) return new Response("Invalid target", { status: 400 });

  const returnTo = safeRelativePath(source.searchParams.get("returnTo"));
  const sessionToken = await encode({
    secret,
    salt: SESSION_COOKIE_NAME,
    maxAge: SESSION_MAX_AGE_SECONDS,
    token: {
      sub: user.providerAccountId || user.userId,
      userId: user.userId,
      provider: user.provider,
      providerAccountId: user.providerAccountId,
      contactId: user.contactId,
      email: user.email,
      name: user.fullName ?? user.displayName,
    },
  });
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const action = `https://${target}/api/domain-auth-handoff`;
  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>第五マッチに戻っています</title></head>
<body><p>第五マッチに戻っています…</p>
<form id="handoff" method="post" action="${action}">
<input type="hidden" name="session" value="${escapeAttribute(sessionToken)}">
<input type="hidden" name="returnTo" value="${escapeAttribute(returnTo)}">
</form><script nonce="${nonce}">document.getElementById("handoff").submit()</script></body></html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'none'; form-action https://${target}; base-uri 'none'; frame-ancestors 'none'`,
    },
  });
}
