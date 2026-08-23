import { eq, or } from "drizzle-orm";
import { getDb } from "../db";
import { accountLinks } from "../db/schema";

const aliasCache = new Map<
  string,
  { aliases: string[]; expiresAt: number }
>();
const aliasCacheTtlMs = 5 * 60_000;

function trimAliasCache() {
  if (aliasCache.size < 2_500) return;
  const now = Date.now();
  for (const [key, value] of aliasCache) {
    if (value.expiresAt <= now) aliasCache.delete(key);
  }
  while (aliasCache.size >= 2_500) {
    const oldest = aliasCache.keys().next().value;
    if (!oldest) break;
    aliasCache.delete(oldest);
  }
}

export async function identityAliases(userId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const cacheKey = `${userId}:${normalizedEmail}`;
  const cached = aliasCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.aliases;
  let rows: { canonicalUserId: string }[];
  try {
    rows = await getDb()
      .select({ canonicalUserId: accountLinks.canonicalUserId })
      .from(accountLinks)
      .where(
        normalizedEmail
          ? or(
              eq(accountLinks.canonicalUserId, userId),
              eq(accountLinks.email, normalizedEmail),
            )
          : eq(accountLinks.canonicalUserId, userId),
      );
  } catch (error) {
    if (cached) return cached.aliases;
    // account_links は過去のログイン方法で作られたIDをまとめるための
    // 補助テーブル。ここが一時的に読めなくても、認証済みの現在IDで
    // チャット一覧そのものは表示できるようにする。
    console.error(
      "Account alias lookup skipped",
      error instanceof Error ? error.message : error,
    );
    const fallbackAliases = [userId];
    trimAliasCache();
    aliasCache.set(cacheKey, {
      aliases: fallbackAliases,
      expiresAt: Date.now() + 30_000,
    });
    return fallbackAliases;
  }
  const aliases = [
    ...new Set([userId, ...rows.map((row) => row.canonicalUserId)]),
  ];
  trimAliasCache();
  aliasCache.set(cacheKey, {
    aliases,
    expiresAt: Date.now() + aliasCacheTtlMs,
  });
  return aliases;
}
