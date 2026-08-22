import { eq, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { accountLinks } from "../db/schema";

export async function identityAliases(userId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const rows = await getDb()
    .select({ canonicalUserId: accountLinks.canonicalUserId })
    .from(accountLinks)
    .where(
      normalizedEmail
        ? or(
            eq(accountLinks.canonicalUserId, userId),
            sql`lower(${accountLinks.email}) = ${normalizedEmail}`,
          )
        : eq(accountLinks.canonicalUserId, userId),
    );
  return [...new Set([userId, ...rows.map((row) => row.canonicalUserId)])];
}
