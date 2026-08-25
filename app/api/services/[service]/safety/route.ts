import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { serviceBlocks, serviceProfiles } from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { isServiceId } from "../../../../../lib/service-config";

async function context(service: string) {
  if (!isServiceId(service)) return null;
  const user = await getChatGPTUser();
  if (!user) return null;
  const [profile] = await getDb()
    .select()
    .from(serviceProfiles)
    .where(
      and(
        eq(serviceProfiles.serviceId, service),
        eq(serviceProfiles.userId, user.userId),
        eq(serviceProfiles.status, "active"),
      ),
    )
    .limit(1);
  return profile && !profile.suspendedAt ? { user, profile } : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const { service } = await params,
    ctx = await context(service);
  if (!ctx)
    return Response.json(
      { error: "この操作は利用できません" },
      { status: 401 },
    );
  const rows = await getDb()
      .select()
      .from(serviceBlocks)
      .where(
        and(
          eq(serviceBlocks.serviceId, service),
          eq(serviceBlocks.blockerProfileId, ctx.profile.id),
        ),
      )
      .orderBy(desc(serviceBlocks.createdAt)),
    profiles = await getDb()
      .select()
      .from(serviceProfiles)
      .where(eq(serviceProfiles.serviceId, service)),
    byId = new Map(profiles.map((row) => [row.id, row]));
  return Response.json({
    blocks: rows.map((row) => ({
      ...row,
      displayName:
        byId.get(row.blockedProfileId)?.displayName || "退会ユーザー",
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const { service } = await params,
    ctx = await context(service),
    body = (await request.json().catch(() => ({}))) as {
      targetProfileId?: unknown;
    },
    targetProfileId =
      typeof body.targetProfileId === "number" ? body.targetProfileId : 0;
  if (!ctx)
    return Response.json(
      { error: "この操作は利用できません" },
      { status: 401 },
    );
  if (!targetProfileId || targetProfileId === ctx.profile.id)
    return Response.json({ error: "対象を確認してください" }, { status: 400 });
  const db = getDb(),
    [target] = await db
      .select({ id: serviceProfiles.id })
      .from(serviceProfiles)
      .where(
        and(
          eq(serviceProfiles.id, targetProfileId),
          eq(serviceProfiles.serviceId, service),
          eq(serviceProfiles.status, "active"),
        ),
      )
      .limit(1);
  if (!target)
    return Response.json({ error: "対象が見つかりません" }, { status: 404 });
  await db
    .insert(serviceBlocks)
    .values({
      serviceId: service,
      blockerProfileId: ctx.profile.id,
      blockedProfileId: targetProfileId,
      createdAt: new Date(),
    })
    .onConflictDoNothing();
  return Response.json({ ok: true }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ service: string }> },
) {
  const { service } = await params,
    ctx = await context(service),
    body = (await request.json().catch(() => ({}))) as {
      targetProfileId?: unknown;
    },
    targetProfileId =
      typeof body.targetProfileId === "number" ? body.targetProfileId : 0;
  if (!ctx)
    return Response.json(
      { error: "この操作は利用できません" },
      { status: 401 },
    );
  await getDb()
    .delete(serviceBlocks)
    .where(
      and(
        eq(serviceBlocks.serviceId, service),
        eq(serviceBlocks.blockerProfileId, ctx.profile.id),
        eq(serviceBlocks.blockedProfileId, targetProfileId),
      ),
    );
  return Response.json({ ok: true });
}
