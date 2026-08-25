import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { serviceAdminAuditLogs } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin";

export async function GET() {
  if (!(await requireAdmin()))
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const logs = await getDb()
    .select()
    .from(serviceAdminAuditLogs)
    .orderBy(desc(serviceAdminAuditLogs.createdAt))
    .limit(500);
  return Response.json({ logs });
}
