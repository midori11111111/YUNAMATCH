import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  serviceProfiles,
  serviceRecruits,
  serviceReports,
} from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin";
import { isServiceId } from "../../../../lib/service-config";

export async function GET() {
  if (!(await requireAdmin()))
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const db = getDb(),
    rows = await db
      .select()
      .from(serviceReports)
      .orderBy(desc(serviceReports.createdAt))
      .limit(300),
    ids = [
      ...new Set(
        rows.flatMap((row) => [row.targetProfileId, row.reporterProfileId]),
      ),
    ],
    profiles = ids.length
      ? await db
          .select()
          .from(serviceProfiles)
          .where(inArray(serviceProfiles.id, ids))
      : [],
    byId = new Map(profiles.map((row) => [row.id, row]));
  return Response.json({
    reports: rows.map((row) => {
      const target = byId.get(row.targetProfileId),
        reporter = byId.get(row.reporterProfileId);
      let context: unknown[] = [];
      try {
        const parsed = JSON.parse(row.conversationContext);
        if (Array.isArray(parsed)) context = parsed;
      } catch {}
      return {
        ...row,
        targetName: target?.displayName || "退会ユーザー",
        targetAvatarUrl: target?.avatarUrl || "",
        targetSuspendedAt: target?.suspendedAt || null,
        reporterName: reporter?.displayName || "退会ユーザー",
        conversationContext: context,
      };
    }),
  });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin()))
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
      reportId?: unknown;
      service?: unknown;
      targetProfileId?: unknown;
      action?: unknown;
    },
    reportId = typeof body.reportId === "number" ? body.reportId : 0,
    targetProfileId =
      typeof body.targetProfileId === "number" ? body.targetProfileId : 0,
    service = typeof body.service === "string" ? body.service : "",
    action = typeof body.action === "string" ? body.action : "";
  if (!isServiceId(service))
    return Response.json(
      { error: "サービスを確認してください" },
      { status: 400 },
    );
  const db = getDb();
  if (action === "resolve" && reportId) {
    const [now] = [new Date()];
    await db
      .update(serviceReports)
      .set({ status: "resolved", resolvedAt: now })
      .where(
        and(
          eq(serviceReports.id, reportId),
          eq(serviceReports.serviceId, service),
        ),
      );
    return Response.json({ ok: true });
  }
  if (
    !targetProfileId ||
    !["suspend", "restore", "removeImage"].includes(action)
  )
    return Response.json({ error: "操作を確認してください" }, { status: 400 });
  if (action === "suspend") {
    await db
      .update(serviceProfiles)
      .set({ suspendedAt: new Date() })
      .where(
        and(
          eq(serviceProfiles.id, targetProfileId),
          eq(serviceProfiles.serviceId, service),
        ),
      );
    await db
      .update(serviceRecruits)
      .set({ status: "closed", updatedAt: new Date() })
      .where(
        and(
          eq(serviceRecruits.ownerProfileId, targetProfileId),
          eq(serviceRecruits.serviceId, service),
        ),
      );
  }
  if (action === "restore")
    await db
      .update(serviceProfiles)
      .set({ suspendedAt: null })
      .where(
        and(
          eq(serviceProfiles.id, targetProfileId),
          eq(serviceProfiles.serviceId, service),
        ),
      );
  if (action === "removeImage")
    await db
      .update(serviceProfiles)
      .set({ avatarUrl: "", updatedAt: new Date() })
      .where(
        and(
          eq(serviceProfiles.id, targetProfileId),
          eq(serviceProfiles.serviceId, service),
        ),
      );
  return Response.json({ ok: true });
}
