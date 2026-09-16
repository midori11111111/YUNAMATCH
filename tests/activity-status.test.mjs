import assert from "node:assert/strict";
import test from "node:test";
import { activityStatus, isRecentlyOnline, ONLINE_WINDOW_MS, RECENT_WINDOW_MS, TODAY_WINDOW_MS } from "../lib/activity-status.ts";
import { rankDiscoverCandidates } from "../lib/discover-ranking.ts";
import { filterDiscoverCandidates } from "../lib/discover-filter.ts";

const now = Date.parse("2026-09-15T12:00:00Z");
test("activity labels use real timestamps and expire cached online flags", () => {
  assert.equal(activityStatus(now - ONLINE_WINDOW_MS, true, now).label, "オンライン中");
  assert.equal(activityStatus(now - ONLINE_WINDOW_MS - 1, true, now).label, "最近オンライン");
  assert.equal(activityStatus(now - RECENT_WINDOW_MS, false, now).label, "最近オンライン");
  assert.equal(activityStatus(now - RECENT_WINDOW_MS - 1, false, now).label, "今日アクセスあり");
  assert.equal(activityStatus(now - TODAY_WINDOW_MS, false, now).label, "今日アクセスあり");
  assert.equal(activityStatus(now - TODAY_WINDOW_MS - 1, false, now).label, "1日前にオンライン");
  for (const value of [null, undefined, "", "invalid", now + 60_000]) {
    assert.equal(isRecentlyOnline(value, now), false);
    assert.equal(activityStatus(value, true, now).label, "最終アクセス不明");
  }
  assert.notEqual(activityStatus(now, false, now).kind, "online");
});

test("online slots prefer recently active people when nobody is online, without duplicates or exclusion", () => {
  const candidates = Array.from({ length: 40 }, (_, i) => ({
    userId: `user-${i}`, mainPokemon: ["ピカチュウ"], highestRate: "マスター 0〜249",
    playTime: [], createdAt: new Date(now - 90 * TODAY_WINDOW_MS),
    lastActiveAt: new Date(now - (i < 10 ? 2 * 60 * 60_000 : i < 20 ? 12 * 60 * 60_000 : 20 * TODAY_WINDOW_MS)),
    online: false, likeCount: 10, qualityScore: 4,
  }));
  for (const rotationSeed of ["one", "two", "three"]) {
    const ranked = rankDiscoverCandidates(candidates, {userId:"viewer", mainPokemon:[], highestRate:"", playTime:[], rotationSeed}, now);
    assert.equal(ranked.length, candidates.length);
    assert.equal(new Set(ranked.map(p => p.userId)).size, candidates.length);
    assert.ok(ranked.slice(0, 10).filter(p => now - p.lastActiveAt.getTime() <= TODAY_WINDOW_MS).length >= 6);
    assert.ok(ranked.every(p => p.online === false));
  }
});

test("online filter ages out stale flags and excludes unknown or future activity", () => {
  const base = {trainerName:"test",mainPokemon:[],gender:"",playTime:[],likeCount:0,online:true};
  const candidates = [4, 6, 120, 720, 1500].map(minutes => ({...base,trainerName:String(minutes),lastActiveAt:new Date(now-minutes*60_000).toISOString()}));
  const filters = {pokemonQuery:"",trainerQuery:"",gender:"",sharedTimeOnly:false,minLikes:null,maxLikes:null,role:"",activity:"online",myPlayTime:[],officialPokemon:[]};
  assert.deepEqual(filterDiscoverCandidates(candidates, filters, now).map(p=>p.trainerName), ["4"]);
  assert.equal(filterDiscoverCandidates(candidates, {...filters,activity:"3h"}, now).length, 3);
  assert.equal(filterDiscoverCandidates(candidates, {...filters,activity:"24h"}, now).length, 4);
});
