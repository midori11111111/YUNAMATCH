import { sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { dailyVisitors, siteVisitors } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

const VISITOR_COOKIE = "yunamatch_visitor";
const ONE_YEAR = 60 * 60 * 24 * 365;

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

function japanDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (/bot|crawler|spider|slurp|preview/i.test(userAgent)) return new Response(null, { status: 204 });

  const user = await getChatGPTUser();
  const storedVisitor = cookieValue(request, VISITOR_COOKIE);
  const anonymousId = /^[a-f0-9-]{20,64}$/i.test(storedVisitor) ? storedVisitor : crypto.randomUUID();
  const visitorKey = user ? `user:${user.userId}` : `anon:${anonymousId}`;
  const now = new Date();
  const day = japanDay(now);
  const db = getDb();

  await db.batch([
    db.insert(siteVisitors).values({
      visitorKey,
      userId: user?.userId ?? null,
      firstSeenAt: now,
      lastSeenAt: now,
      visitCount: 1,
    }).onConflictDoUpdate({
      target: siteVisitors.visitorKey,
      set: {
        userId: user?.userId ?? null,
        lastSeenAt: now,
        visitCount: sql`${siteVisitors.visitCount} + 1`,
      },
    }),
    db.insert(dailyVisitors).values({
      day,
      visitorKey,
      pageViews: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    }).onConflictDoUpdate({
      target: [dailyVisitors.day, dailyVisitors.visitorKey],
      set: {
        lastSeenAt: now,
        pageViews: sql`${dailyVisitors.pageViews} + 1`,
      },
    }),
  ]);

  const response = new Response(null, { status: 204 });
  if (!storedVisitor) {
    response.headers.set(
      "set-cookie",
      `${VISITOR_COOKIE}=${anonymousId}; Path=/; Max-Age=${ONE_YEAR}; HttpOnly; SameSite=Lax; Secure`,
    );
  }
  return response;
}
