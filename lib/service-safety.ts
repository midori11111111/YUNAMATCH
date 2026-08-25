import { and, eq, or } from "drizzle-orm";
import { getDb } from "../db";
import { serviceBlocks } from "../db/schema";

export async function isServicePairBlocked(
  service: string,
  firstProfileId: number,
  secondProfileId: number,
) {
  const rows = await getDb()
    .select({ id: serviceBlocks.id })
    .from(serviceBlocks)
    .where(
      and(
        eq(serviceBlocks.serviceId, service),
        or(
          and(
            eq(serviceBlocks.blockerProfileId, firstProfileId),
            eq(serviceBlocks.blockedProfileId, secondProfileId),
          ),
          and(
            eq(serviceBlocks.blockerProfileId, secondProfileId),
            eq(serviceBlocks.blockedProfileId, firstProfileId),
          ),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
