import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  applicationMessages,
  applications,
  profiles,
  recruits,
} from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import {
  containsProhibitedContent,
  prohibitedContentMessage,
} from "../../../lib/content-policy";
import { sendPush } from "../../../lib/push";

async function applicationForUser(applicationId: number, userId: string) {
  const [row] = await getDb()
    .select({
      id: applications.id,
      applicantId: applications.applicantId,
      applicantName: applications.applicantName,
      status: applications.status,
      ownerId: recruits.ownerId,
      ownerName: recruits.trainerName,
    })
    .from(applications)
    .innerJoin(recruits, eq(applications.recruitId, recruits.id))
    .where(eq(applications.id, applicationId))
    .limit(1);
  if (!row || (row.applicantId !== userId && row.ownerId !== userId)) return null;
  return row;
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn: "/login" },
      { status: 401 },
    );
  const applicationId = Number(new URL(request.url).searchParams.get("applicationId"));
  if (!Number.isInteger(applicationId) || applicationId <= 0)
    return Response.json({ error: "申請を確認してください" }, { status: 400 });
  const application = await applicationForUser(applicationId, user.userId);
  if (!application)
    return Response.json({ error: "申請が見つかりません" }, { status: 404 });
  const rows = await getDb()
    .select()
    .from(applicationMessages)
    .where(eq(applicationMessages.applicationId, applicationId))
    .orderBy(asc(applicationMessages.createdAt))
    .limit(100);
  return Response.json({
    messages: rows.map((row) => ({
      id: row.id,
      body: row.body,
      sender: row.senderId === user.userId ? "me" : "mate",
      createdAt: row.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "ログインが必要です", signIn: "/login" },
      { status: 401 },
    );
  const rateLimit = await checkRateLimit(user.userId, {
    action: "application-message",
    limit: 30,
    windowMs: 10 * 60_000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);
  const payload = (await request.json().catch(() => ({}))) as {
    applicationId?: number;
    body?: string;
  };
  const applicationId = Number(payload.applicationId);
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!Number.isInteger(applicationId) || applicationId <= 0 || !body || body.length > 180)
    return Response.json({ error: "ひとことを180文字以内で入力してください" }, { status: 400 });
  if (containsProhibitedContent(body))
    return Response.json({ error: prohibitedContentMessage }, { status: 400 });
  const application = await applicationForUser(applicationId, user.userId);
  if (!application)
    return Response.json({ error: "申請が見つかりません" }, { status: 404 });
  if (application.status !== "pending")
    return Response.json({ error: "この申請はすでに処理されています" }, { status: 409 });
  const [inserted] = await getDb()
    .insert(applicationMessages)
    .values({ applicationId, senderId: user.userId, body, createdAt: new Date() })
    .returning();
  const [profile] = await getDb()
    .select({ trainerName: profiles.trainerName })
    .from(profiles)
    .where(eq(profiles.userId, user.userId))
    .limit(1);
  const recipientId =
    user.userId === application.ownerId
      ? application.applicantId
      : application.ownerId;
  await sendPush(
    recipientId,
    "申請についてひとことが届きました",
    `${profile?.trainerName || "メイト"}さん: ${body}`,
    "/",
  );
  return Response.json({
    message: {
      id: inserted.id,
      body: inserted.body,
      sender: "me",
      createdAt: inserted.createdAt,
    },
  });
}
