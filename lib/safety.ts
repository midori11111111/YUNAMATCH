import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { profiles } from "../db/schema";

export async function isSuspended(userId:string){const [profile]=await getDb().select({suspendedAt:profiles.suspendedAt}).from(profiles).where(eq(profiles.userId,userId)).limit(1);return Boolean(profile?.suspendedAt)}
