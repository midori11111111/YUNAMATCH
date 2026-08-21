import { headers } from "next/headers";

export const adminSessionCookieName = "yunamatch_admin_session";
const sessionDurationMs = 12 * 60 * 60_000;

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1)
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

async function signSession(expiresAt: number, password: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`yunamatch-admin:${expiresAt}`),
  );
  return bytesToHex(new Uint8Array(signature));
}

export async function createAdminSessionToken() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  const expiresAt = Date.now() + sessionDurationMs;
  return `${expiresAt}.${await signSession(expiresAt, password)}`;
}

export async function verifyAdminSessionToken(token: string | undefined) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !token) return false;
  const [expiresText, signature, extra] = token.split(".");
  if (!expiresText || !signature || extra) return false;
  const expiresAt = Number(expiresText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return false;
  if (expiresAt > Date.now() + sessionDurationMs + 60_000) return false;
  return safeEqual(signature, await signSession(expiresAt, password));
}

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name)
      return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export async function requireAdmin() {
  const requestHeaders = await headers();
  return verifyAdminSessionToken(
    cookieValue(requestHeaders.get("cookie"), adminSessionCookieName),
  );
}

export async function passwordMatchesAdmin(value: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const [left, right] = await Promise.all(
    [value, expected].map(async (text) =>
      bytesToHex(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
        ),
      ),
    ),
  );
  return safeEqual(left, right);
}
