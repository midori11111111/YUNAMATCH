import { decode } from "next-auth/jwt";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "__Secure-authjs.session-token";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function safeRelativePath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export async function POST(request: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return new Response("Authentication is unavailable", { status: 503 });

  const form = await request.formData();
  const sessionToken = form.get("session");
  if (typeof sessionToken !== "string" || sessionToken.length > 8_000) {
    return new Response("Invalid session", { status: 400 });
  }

  const token = await decode({ token: sessionToken, secret, salt: SESSION_COOKIE_NAME });
  if (!token?.sub || typeof token.userId !== "string") {
    return new Response("Invalid session", { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  const returnTo = safeRelativePath(form.get("returnTo"));
  return Response.redirect(new URL(returnTo, request.url), 303);
}
