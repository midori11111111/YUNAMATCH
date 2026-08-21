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
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders public browsing before login for anonymous visitors", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /YUNAMATCH/);
  assert.match(html, /見るだけなら登録不要/);
  assert.match(html, /いいね・申請・募集はログイン後/);
  assert.match(html, /メイトを探しています/);
  assert.doesNotMatch(html, /ログイン \/ 新規登録/);
  assert.match(html, /相性でつながるユナイト仲間/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/i);
});

test("ships the matching app, onboarding, lobby, safety, analytics, and notifications", async () => {
  const [
    page,
    app,
    css,
    authGateway,
    loginPage,
    connectionsApi,
    messagesApi,
    safetyApi,
    profileApi,
    applicationsApi,
    discoverApi,
    migration,
    profileMigration,
    lobbyApi,
    pushApi,
    discordApi,
    expansionMigration,
    analyticsApi,
    statsApi,
    analyticsMigration,
    adminPanel,
    safetyMigration,
    supportApi,
    exportApi,
    likesApi,
    likesMigration,
    pokemonArt,
    ogImage,
    privacyPage,
    contactPage,
    publicSupportApi,
    connectionsSchema,
    connectionsApiSource,
    messageIdempotencyMigration,
    loginButton,
    ratingsApi,
    ratingsMigration,
  ] = await Promise.all([
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
    readFile(new URL("app/privacy/page.tsx", root), "utf8"),
    readFile(new URL("app/contact/page.tsx", root), "utf8"),
    readFile(new URL("app/api/public-support/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/connections/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0015_special_harpoon.sql", root), "utf8"),
    readFile(new URL("vercel-proxy/app/login/login-button.tsx", root), "utf8"),
    readFile(new URL("app/api/ratings/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0016_black_stick.sql", root), "utf8"),
  ]);
  assert.match(page, /getChatGPTUser/);
  assert.match(page, /initialProfile/);
  assert.match(page, /getDb\(\)\.select\(\)\.from\(profiles\)/);
  assert.match(app, /moveCard/);
  assert.match(app, /guestMode\s*\|\|\s*preview\s*\|\|\s*initialProfile\s*!==\s*undefined/);
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
  assert.match(app, /ユナイトをプレイする/);
  assert.match(app, /apps\.apple\.com\/jp\/app\/pokemon-unite/);
  assert.match(app, /play\.google\.com\/store\/apps\/details\?id=jp\.pokemon\.pokemonunite/);
  assert.match(app, /profileCompletion/);
  assert.match(app, /profileCompletionInline/);
  assert.doesNotMatch(app, /profileCompletionCard/);
  assert.doesNotMatch(app, /getSynergy/);
  assert.match(app, /今日ログイン/);
  assert.match(app, /ランク行きませんか？/);
  assert.match(app, /一緒に遊んだ/);
  assert.match(app, /プレイ完了/);
  assert.match(app, /相談して決める/);
  assert.match(app, /募集をキャンセル/);
  assert.match(app, /通知をオンにして続ける/);
  assert.match(app, /自分の試合数/);
  assert.match(app, /自分の勝率/);
  assert.match(app, /もらったいいね/);
  assert.match(app, /yunamatch-push-intro-v1/);
  assert.match(app, /通知をオンにする/);
  assert.match(app, /navPersonIcon/);
  assert.match(app, /メイト申請を送る/);
  assert.match(app, /いいね済み/);
  assert.match(app, /ログインすると続けられます/);
  assert.match(app, /yunamatch-pending-action-v1/);
  assert.match(app, /PokemonLabel/);
  assert.match(app, /この人にプレイ申請/);
  assert.match(app, /集合ロビー/);
  assert.match(app, /プッシュ通知/);
  assert.match(app, /全員そろったらプレイ開始/);
  assert.match(app, /この人を評価/);
  assert.match(app, /人気のメイト/);
  assert.match(app, /人からいいねされています/);
  assert.match(css, /bottomNav/);
  assert.match(connectionsApi, /mutualAgain/);
  assert.match(connectionsApi, /userAPlayed/);
  assert.match(messagesApi, /connectionId/);
  assert.match(messagesApi, /clientId/);
  assert.match(messagesApi, /onConflictDoNothing/);
  assert.match(safetyApi, /allowedReasons/);
  assert.match(profileApi, /mainPokemon/);
  assert.match(profileApi, /contactFor/);
  assert.match(profileApi, /!genders\.has\(gender\)/);
  assert.match(applicationsApi, /プロフィールの未入力項目/);
  assert.match(discoverApi, /kind:\s*"profile"/);
  assert.match(discoverApi, /プロフィールから一緒に遊びたい/);
  assert.match(discoverApi, /me\.gender\s*===\s*"男性"/);
  assert.match(discoverApi, /b\.gender\s*===\s*"女性"/);
  assert.match(discoverApi, /activeCutoff/);
  assert.match(discoverApi, /lastActiveAt/);
  assert.match(discoverApi, /limited:\s*true/);
  assert.match(discoverApi, /avatarUrl:\s*""/);
  assert.match(discoverApi, /internalScore/);
  assert.match(discoverApi, /likeCount/);
  assert.doesNotMatch(discoverApi, /averageScore:/);
  assert.match(migration, /CREATE TABLE `connections`/);
  assert.match(profileMigration, /CREATE TABLE `profiles`/);
  assert.match(lobbyApi, /lobbyMembers/);
  assert.match(lobbyApi, /startTimeUndecided/);
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
  assert.match(exportApi, /connectionRatings/);
  assert.match(likesApi, /いいねが届きました/);
  assert.match(likesApi, /onConflictDoNothing/);
  assert.match(likesMigration, /CREATE TABLE `profile_likes`/);
  assert.match(pokemonArt, /official-artwork/);
  assert.equal(ogImage, undefined);
  assert.match(app, /アカウントを削除して退会/);
  assert.match(app, /Discordで募集・VCに参加/);
  assert.match(app, /運営ダッシュボード/);
  assert.match(app, /フィードバックを送る/);
  assert.match(supportApi, /フィードバック・改善案/);
  assert.match(supportApi, /FEEDBACK_TO_EMAIL/);
  assert.doesNotMatch(supportApi, /serizawatomoki0589/);
  assert.doesNotMatch(app, /getPokemonImagePath|pokemonVisualImage/);
  assert.match(authGateway, /scope: "tweet\.read users\.read"/);
  assert.match(authGateway, /providers: \[Google, Line, Discord, xProvider\]/);
  assert.match(authGateway, /AbortSignal\.timeout\(5000\)/);
  assert.match(loginPage, /LINEでログイン/);
  assert.match(loginPage, /Discordでログイン/);
  assert.match(loginPage, /Xでログイン/);
  assert.match(privacyPage, /取得する情報/);
  assert.match(privacyPage, /外部サービスと委託先/);
  assert.match(privacyPage, /YUNAMATCH運営（個人開発）/);
  assert.match(contactPage, /ログインできない場合/);
  assert.match(publicSupportApi, /public-support/);
  assert.match(publicSupportApi, /sha256/);
  assert.match(app, /共有せずチャットへ/);
  assert.match(app, /連絡先を共有/);
  assert.match(privacyPage, /初期状態は非公開/);
  assert.match(privacyPage, /ログイン前のプロフィール表示/);
  assert.match(privacyPage, /試合後評価とおすすめ順/);
  assert.match(connectionsSchema, /userAShareContact/);
  assert.match(connectionsSchema, /userBShareContact/);
  assert.match(connectionsApiSource, /action === "share_contact"/);
  assert.match(messageIdempotencyMigration, /idx_messages_sender_client/);
  assert.match(loginButton, /useFormStatus/);
  assert.match(loginButton, /disabled=\{pending\}/);
  assert.match(ratingsApi, /先に「一緒に遊んだ」を記録してください/);
  assert.match(ratingsApi, /onConflictDoUpdate/);
  assert.match(ratingsMigration, /CREATE TABLE `connection_ratings`/);
  assert.match(ratingsMigration, /idx_connection_ratings_rated_user/);
  assert.match(ratingsMigration, /PRAGMA optimize/);
});
