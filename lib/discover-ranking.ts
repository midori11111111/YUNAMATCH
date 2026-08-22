import { pokemonRole } from "./pokemon-role.ts";
import { normalizeRank, rankOptions } from "./ranks.ts";

export type DiscoverRankable = {
  userId: string;
  mainPokemon: string[];
  highestRate: string;
  playTime: string[];
  createdAt: Date;
  lastActiveAt: Date;
  likeCount: number;
  qualityScore: number;
  avatarUrl?: string | null;
  bio?: string | null;
};

export type DiscoverViewer = {
  userId: string;
  mainPokemon: string[];
  highestRate: string;
  playTime: string[];
  rotationSeed?: string;
};

type RankedCandidate<T> = {
  candidate: T;
  affinity: number;
  total: number;
  activityAt: number;
  createdAt: number;
  quality: number;
  discovery: boolean;
  explore: number;
};

const bucketPattern = [
  "affinity",
  "recent",
  "discovery",
  "affinity",
  "quality",
  "explore",
  "affinity",
  "recent",
  "discovery",
  "explore",
] as const;

function stableUnitInterval(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function sharedTimeScore(mine: string[], theirs: string[]) {
  if (!mine.length || !theirs.length) return 8;
  if (
    mine.includes("時間帯はいつでも") ||
    theirs.includes("時間帯はいつでも") ||
    theirs.some((time) => mine.includes(time))
  )
    return 25;
  return 0;
}

function pokemonCompatibilityScore(mine: string[], theirs: string[]) {
  if (!mine.length || !theirs.length) return 10;
  const offensive = new Set(["attack", "speed", "balance"]);
  const supportive = new Set(["defense", "support"]);
  let best = 0;
  for (const myPokemon of mine) {
    for (const theirPokemon of theirs) {
      const myRole = pokemonRole(myPokemon);
      const theirRole = pokemonRole(theirPokemon);
      if (
        (offensive.has(myRole) && supportive.has(theirRole)) ||
        (supportive.has(myRole) && offensive.has(theirRole))
      )
        best = Math.max(best, 25);
      else if (myRole !== theirRole) best = Math.max(best, 18);
      else if (myPokemon !== theirPokemon) best = Math.max(best, 10);
      else best = Math.max(best, 7);
    }
  }
  return best;
}

function rankProximityScore(mine: string, theirs: string) {
  const myIndex = rankOptions.indexOf(
    normalizeRank(mine) as (typeof rankOptions)[number],
  );
  const theirIndex = rankOptions.indexOf(
    normalizeRank(theirs) as (typeof rankOptions)[number],
  );
  if (myIndex < 0 || theirIndex < 0) return 5;
  const distance = Math.abs(myIndex - theirIndex);
  if (distance === 0) return 15;
  if (distance === 1) return 11;
  if (distance === 2) return 7;
  return 2;
}

function activityScore(lastActiveAt: number, now: number) {
  const age = Math.max(0, now - lastActiveAt);
  if (age <= 2 * 60 * 60_000) return 15;
  if (age <= 24 * 60 * 60_000) return 13;
  if (age <= 3 * 24 * 60 * 60_000) return 9;
  if (age <= 7 * 24 * 60 * 60_000) return 5;
  return 1;
}

function newcomerScore(createdAt: number, now: number) {
  const age = Math.max(0, now - createdAt);
  if (age <= 7 * 24 * 60 * 60_000) return 10;
  if (age <= 30 * 24 * 60 * 60_000) return 5;
  return 0;
}

function profileScore(candidate: DiscoverRankable) {
  let completed = 0;
  if (candidate.mainPokemon.length) completed += 1;
  if (candidate.playTime.length) completed += 1;
  if (candidate.highestRate) completed += 1;
  if (candidate.avatarUrl) completed += 1;
  if (candidate.bio?.trim()) completed += 1;
  return completed;
}

/**
 * 相性の高い人を軸に、最近活動した人・新規/低反応の人・高評価の人・
 * 探索枠を10件ごとに混ぜる。性別は使わず、いいね数も人気加点には使わない。
 */
export function rankDiscoverCandidates<T extends DiscoverRankable>(
  candidates: T[],
  viewer: DiscoverViewer,
  now = Date.now(),
) {
  const daySeed = new Date(now).toLocaleDateString("en-CA", {
    timeZone: "Asia/Tokyo",
  });
  const rotationSeed = viewer.rotationSeed || daySeed;
  const ranked: RankedCandidate<T>[] = candidates.map((candidate) => {
    const affinity =
      sharedTimeScore(viewer.playTime, candidate.playTime) +
      pokemonCompatibilityScore(viewer.mainPokemon, candidate.mainPokemon) +
      rankProximityScore(viewer.highestRate, candidate.highestRate);
    const activityAt = candidate.lastActiveAt.getTime();
    const createdAt = candidate.createdAt.getTime();
    const quality = Math.max(0, Math.min(5, candidate.qualityScore));
    const explore = stableUnitInterval(
      `${viewer.userId}:${candidate.userId}:${rotationSeed}`,
    );
    const total =
      affinity +
      activityScore(activityAt, now) +
      newcomerScore(createdAt, now) +
      quality * 2 +
      profileScore(candidate) +
      explore * 3;
    return {
      candidate,
      affinity,
      total,
      activityAt,
      createdAt,
      quality,
      // いいね数は加点せず、まだ反応が少ない人を発見枠へ入れるためだけに使う。
      discovery:
        now - createdAt <= 30 * 24 * 60 * 60_000 || candidate.likeCount <= 2,
      explore,
    };
  });

  const byAffinity = [...ranked].sort(
    (a, b) => b.total - a.total || b.activityAt - a.activityAt,
  );
  const byRecent = [...ranked].sort(
    (a, b) => b.activityAt - a.activityAt || b.total - a.total,
  );
  const byDiscovery = ranked
    .filter((item) => item.discovery)
    .sort(
      (a, b) =>
        b.createdAt - a.createdAt || b.explore - a.explore || b.total - a.total,
    );
  const byQuality = [...ranked].sort(
    (a, b) => b.quality - a.quality || b.total - a.total,
  );
  const byExplore = [...ranked].sort(
    (a, b) => b.explore - a.explore || b.total - a.total,
  );
  const queues = {
    affinity: byAffinity,
    recent: byRecent,
    discovery: byDiscovery,
    quality: byQuality,
    explore: byExplore,
  };
  const used = new Set<string>();
  const result: T[] = [];
  let slot = 0;
  const bucketOffset = Math.floor(
    stableUnitInterval(`${viewer.userId}:${rotationSeed}:bucket`) *
      bucketPattern.length,
  );
  while (result.length < ranked.length) {
    const queue =
      queues[
        bucketPattern[(slot + bucketOffset) % bucketPattern.length]
      ];
    let next = queue.find((item) => !used.has(item.candidate.userId));
    if (!next)
      next = byAffinity.find((item) => !used.has(item.candidate.userId));
    if (!next) break;
    used.add(next.candidate.userId);
    result.push(next.candidate);
    slot += 1;
  }
  return result;
}
