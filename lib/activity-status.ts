export const ONLINE_WINDOW_MS = 5 * 60_000;
export const RECENT_WINDOW_MS = 3 * 60 * 60_000;
export const TODAY_WINDOW_MS = 24 * 60 * 60_000;

type ActivityTime = string | number | Date | null | undefined;

export function activityAge(value: ActivityTime, now = Date.now()) {
  if (value === null || value === undefined || value === "") return Infinity;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  // Missing, invalid, or future activity must not create a false online badge.
  return Number.isFinite(timestamp) && timestamp <= now ? now - timestamp : Infinity;
}

export function isRecentlyOnline(value: ActivityTime, now = Date.now()) {
  return activityAge(value, now) <= ONLINE_WINDOW_MS;
}

export function activityStatus(value: ActivityTime, online = false, now = Date.now()) {
  const age = activityAge(value, now);
  if (!Number.isFinite(age)) return { kind: "unknown", label: "最終アクセス不明" };
  if (online && age <= ONLINE_WINDOW_MS) return { kind: "online", label: "オンライン中" };
  if (age <= RECENT_WINDOW_MS) return { kind: "recent", label: "最近オンライン" };
  if (age <= TODAY_WINDOW_MS) return { kind: "today", label: "今日アクセスあり" };
  return { kind: "offline", label: `${Math.floor(age / TODAY_WINDOW_MS)}日前にオンライン` };
}
