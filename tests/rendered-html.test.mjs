import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the login-only entrance for anonymous visitors", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /YUNA<span>MATCH/);
  assert.match(html, /ログイン \/ 新規登録/);
  assert.match(html, /\/api\/login\/google/);
  assert.match(html, /相性でつながるユナイト仲間/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/i);
});

test("ships the matching app, onboarding, lobby, safety, analytics, and notifications", async () => {
  const [page, app, css, authGateway, loginPage, connectionsApi, messagesApi, safetyApi, profileApi, applicationsApi, discoverApi, migration, profileMigration, lobbyApi, pushApi, discordApi, expansionMigration, analyticsApi, statsApi, analyticsMigration, adminPanel, safetyMigration, supportApi, exportApi, likesApi, likesMigration, pokemonArt] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/match-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("vercel-proxy/auth.ts", root), "utf8"),
    readFile(new URL("vercel-proxy/app/login/page.tsx", root), "utf8"),
    readFile(new URL("app/api/connections/route.ts", root), "utf8"),
    readFile(new URL("app/api/messages/route.ts", root), "utf8"),
    readFile(new URL("app/api/safety/route.ts", root), "utf8"),
    readFile(new URL("app/api/profile/route.ts", root), "utf8"),
    readFile(new URL("app/api/applications/route.ts", root), "utf8"),
    readFile(new URL("app/api/discover/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0003_nifty_spyke.sql", root), "utf8"),
    readFile(new URL("drizzle/0004_omniscient_juggernaut.sql", root), "utf8"),
    readFile(new URL("app/api/lobbies/route.ts", root), "utf8"),
    readFile(new URL("app/api/push/route.ts", root), "utf8"),
    readFile(new URL("app/api/discord/interactions/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0007_wooden_beyonder.sql", root), "utf8"),
    readFile(new URL("app/api/analytics/visit/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/stats/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0008_certain_swarm.sql", root), "utf8"),
    readFile(new URL("app/admin/admin-panel.tsx", root), "utf8"),
    readFile(new URL("drizzle/0009_flat_thanos.sql", root), "utf8"),
    readFile(new URL("app/api/support/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/export/route.ts", root), "utf8"),
    readFile(new URL("app/api/likes/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0011_tearful_karma.sql", root), "utf8"),
    readFile(new URL("lib/pokemon-art.ts", root), "utf8"),
    access(new URL("public/og.png", root)),
  ]);
  assert.match(page, /getChatGPTUser/);
  assert.match(page, /initialProfile/);
  assert.match(page, /getDb\(\)\.select\(\)\.from\(profiles\)/);
  assert.match(app, /moveCard/);
  assert.match(app, /preview\|\|initialProfile!==undefined/);
  assert.match(app, /AbortController/);
  assert.match(app, /プレイ申請を送る/);
  assert.match(app, /マッチ成立/);
  assert.match(app, /また遊びたい/);
  assert.match(app, /トレーナーカードを共有/);
  assert.match(app, /通報せずブロックのみ/);
  assert.match(app, /あなたのことを/);
  assert.match(app, /1〜5体・複数選択できます/);
  assert.match(app, /登録してメイトを探す/);
  assert.match(app, /未入力の項目/);
  assert.match(app, /onboardingMissing/);
  assert.match(app, /募集中のメイト/);
  assert.match(app, /未定（役割から募集）/);
  assert.match(app, /任意・複数選択できます/);
  assert.match(app, /上レーン/);
  assert.match(app, /キャリー/);
  assert.match(app, /おすすめ/);
  assert.match(app, /相手から/);
  assert.match(app, /カードの使い方/);
  assert.match(app, /yunamatch-discover-tutorial-v1/);
  assert.doesNotMatch(app, /次の人/);
  assert.match(app, /まだやりとりがありません/);
  assert.match(app, /yunamatch-chat-tutorial-v1/);
  assert.match(app, /次のプレイまで/);
  assert.match(app, /profileCompletion/);
  assert.match(app, /もらったいいね/);
  assert.match(app, /yunamatch-push-intro-v1/);
  assert.match(app, /通知をオンにする/);
  assert.match(app, /navPersonIcon/);
  assert.match(app, /メイト申請を送る/);
  assert.match(app, /いいね済み/);
  assert.match(app, /PokemonLabel/);
  assert.match(app, /この人にプレイ申請/);
  assert.match(app, /集合ロビー/);
  assert.match(app, /プッシュ通知/);
  assert.match(app, /全員そろったらプレイ開始/);
  assert.match(css, /bottomNav/);
  assert.match(connectionsApi, /mutualAgain/);
  assert.match(messagesApi, /connectionId/);
  assert.match(safetyApi, /allowedReasons/);
  assert.match(profileApi, /mainPokemon/);
  assert.match(profileApi, /contactFor/);
  assert.match(profileApi, /!genders\.has\(gender\)/);
  assert.match(applicationsApi, /プロフィールの未入力項目/);
  assert.match(discoverApi, /kind:"profile"/);
  assert.match(discoverApi, /プロフィールから一緒に遊びたい/);
  assert.match(migration, /CREATE TABLE `connections`/);
  assert.match(profileMigration, /CREATE TABLE `profiles`/);
  assert.match(lobbyApi, /lobbyMembers/);
  assert.match(pushApi, /pushSubscriptions/);
  assert.match(discordApi, /x-signature-ed25519/);
  assert.match(discordApi, /options\.lane/);
  assert.match(discordApi, /options\.play_style/);
  assert.match(expansionMigration, /CREATE TABLE `lobbies`/);
  assert.match(analyticsApi, /yunamatch_visitor/);
  assert.match(analyticsApi, /siteVisitors/);
  assert.match(statsApi, /管理者権限が必要です/);
  assert.match(analyticsMigration, /CREATE TABLE `daily_visitors`/);
  assert.match(analyticsMigration, /CREATE TABLE `site_visitors`/);
  assert.match(adminPanel, /今日の訪問者/);
  assert.match(adminPanel, /募集 → 申請あり/);
  assert.match(adminPanel, /バックアップをダウンロード/);
  assert.match(safetyMigration, /rate_limit_buckets/);
  assert.match(safetyMigration, /support_tickets/);
  assert.match(supportApi, /24\*60\*60_000/);
  assert.match(exportApi, /content-disposition/);
  assert.match(likesApi, /いいねが届きました/);
  assert.match(likesApi, /onConflictDoNothing/);
  assert.match(likesMigration, /CREATE TABLE `profile_likes`/);
  assert.match(pokemonArt, /official-artwork/);
  assert.match(app, /アカウントを削除して退会/);
  assert.match(app, /Discordで募集・VCに参加/);
  assert.match(app, /運営ダッシュボード/);
  assert.doesNotMatch(app, /getPokemonImagePath|pokemonVisualImage/);
  assert.match(authGateway, /scope: "tweet\.read users\.read"/);
  assert.match(authGateway, /providers: \[Google, Line, Discord, xProvider\]/);
  assert.match(loginPage, /LINEでログイン/);
  assert.match(loginPage, /Discordでログイン/);
  assert.match(loginPage, /Xでログイン/);
});
