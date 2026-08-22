import { getToken } from "@auth/core/jwt";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  provider: string;
  providerAccountId: string;
  contactId: string;
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/login";
const SIGN_OUT_PATH = "/api/auth/signout";
const CALLBACK_PATH = "/api/auth/callback";

async function resolveCanonicalUserId(
  provider: string,
  providerAccountId: string,
  fallbackUserId: string,
): Promise<string> {
  if (!providerAccountId) return fallbackUserId;

  try {
    const [{ and, eq }, { getDb }, { accountLinks }] = await Promise.all([
      import("drizzle-orm"),
      import("../db"),
      import("../db/schema"),
    ]);
    const [linkedAccount] = await getDb()
      .select({ canonicalUserId: accountLinks.canonicalUserId })
      .from(accountLinks)
      .where(
        and(
          eq(accountLinks.provider, provider),
          eq(accountLinks.providerAccountId, providerAccountId),
        ),
      )
      .limit(1);
    return linkedAccount?.canonicalUserId || fallbackUserId;
  } catch {
    // 認証基盤が一時的に利用できない場合も、ログイン自体は維持する。
    return fallbackUserId;
  }
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const authSecret = process.env.AUTH_SECRET;

  if (authSecret) {
    for (const secureCookie of [true, false]) {
      try {
        const token = await getToken({
          req: { headers: requestHeaders },
          secret: authSecret,
          secureCookie,
        });
        if (token?.sub) {
          const provider =
            typeof token.provider === "string" ? token.provider : "oauth";
          const providerAccountId =
            typeof token.providerAccountId === "string" ? token.providerAccountId : token.sub;
          const tokenUserId =
            typeof token.userId === "string" ? token.userId : `oauth:${provider}:${providerAccountId}`;
          const userId = await resolveCanonicalUserId(
            provider,
            providerAccountId,
            tokenUserId,
          );
          const email =
            typeof token.email === "string"
              ? token.email
              : `${provider}:${token.sub}`;
          const fullName = typeof token.name === "string" ? token.name : null;
          const contactId = typeof token.contactId === "string" ? token.contactId : email;
          return {
            userId,
            displayName: fullName ?? email,
            email,
            fullName,
            provider,
            providerAccountId,
            contactId,
          };
        }
      } catch {
        // 別形式のCookieか、ログイン前のアクセス。次の認証方法を確認する。
      }
    }
  }

  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    userId: await resolveCanonicalUserId("chatgpt", userId, userId),
    displayName: fullName ?? email,
    email,
    fullName,
    provider: "chatgpt",
    providerAccountId: userId,
    contactId: email,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  safeRelativeReturnPath(returnTo);
  return SIGN_IN_PATH;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?callbackUrl=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
