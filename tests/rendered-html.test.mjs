import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("states the romance and dating prohibition at the end of the terms", async () => {
  const terms = await readFile(new URL("app/terms/page.tsx", root), "utf8");
  const prohibition = terms.indexOf("恋愛・出会い目的の利用禁止");
  assert.ok(prohibition > terms.indexOf("お問い合わせ"));
  assert.match(terms.slice(prohibition), /異性交際を希望する情報/);
  assert.match(terms.slice(prohibition), /18歳未満の利用者に対する連絡先交換/);
  assert.match(terms.slice(prohibition), /アカウント削除/);
});

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

test("keeps discover results inside every selected filter", async () => {
  const { filterDiscoverCandidates } = await import(
    new URL("../lib/discover-filter.ts", import.meta.url)
  );
  const candidates = [
    { trainerName: "みどり", mainPokemon: ["ミュウ"], gender: "女性", playTime: ["平日 夜（18〜22時）"], likeCount: 3 },
    { trainerName: "みどり2", mainPokemon: ["ミュウツーX"], gender: "男性", playTime: ["平日 夜（18〜22時）"], likeCount: 12 },
    { trainerName: "あお", mainPokemon: ["ミュウツーY"], gender: "女性", playTime: ["土日 朝・昼"], likeCount: 24 },
  ];
  const baseFilters = {
    trainerQuery: "",
    gender: "",
    sharedTimeOnly: false,
    minLikes: null,
    maxLikes: null,
    role: "",
    myPlayTime: ["平日 夜（18〜22時）"],
    officialPokemon: ["ミュウ", "ミュウツーX", "ミュウツーY"],
  };
  assert.deepEqual(
    filterDiscoverCandidates(candidates, { ...baseFilters, pokemonQuery: "ミュウ" }).map((person) => person.trainerName),
    ["みどり"],
  );
  assert.deepEqual(
    filterDiscoverCandidates(candidates, { ...baseFilters, pokemonQuery: "ミュウツ" }).map((person) => person.trainerName),
    ["みどり2", "あお"],
  );
  assert.deepEqual(
    filterDiscoverCandidates(candidates, { ...baseFilters, pokemonQuery: "", trainerQuery: "みどり" }).map((person) => person.trainerName),
    ["みどり"],
  );
  assert.deepEqual(
    filterDiscoverCandidates(candidates, { ...baseFilters, pokemonQuery: "", gender: "女性", sharedTimeOnly: true }).map((person) => person.trainerName),
    ["みどり"],
  );
  assert.deepEqual(
    filterDiscoverCandidates(candidates, { ...baseFilters, pokemonQuery: "", minLikes: 10, maxLikes: 20 }).map((person) => person.trainerName),
    ["みどり2"],
  );
  assert.deepEqual(
    filterDiscoverCandidates(candidates, { ...baseFilters, pokemonQuery: "", role: "attack" }).map((person) => person.trainerName),
    ["みどり", "あお"],
  );
});

test("resolves profiles beyond the former 300-account action limit", async () => {
  const { profilePublicId, resolveProfilePublicId } = await import(
    new URL("../lib/profile-id.ts", import.meta.url)
  );
  const userIds = Array.from({ length: 350 }, (_, index) => `user-${index}`);
  const targetId = await profilePublicId(userIds[349]);
  assert.equal(await resolveProfilePublicId(userIds, targetId), userIds[349]);
});

test("supports casual and ranked recruiting on the site and Discord", async () => {
  const [app, recruitsApi, discordApi, commandScript, adminCommandApi, schema, migration] =
    await Promise.all([
      readFile(new URL("app/match-app.tsx", root), "utf8"),
      readFile(new URL("app/api/recruits/route.ts", root), "utf8"),
      readFile(new URL("app/api/discord/interactions/route.ts", root), "utf8"),
      readFile(new URL("scripts/register-discord-command.mjs", root), "utf8"),
      readFile(new URL("app/api/admin/discord-command/route.ts", root), "utf8"),
      readFile(new URL("db/schema.ts", root), "utf8"),
      readFile(new URL("drizzle/0029_many_shadow_king.sql", root), "utf8"),
    ]);
  assert.match(app, /遊ぶモード/);
  assert.match(app, /ランクマッチ/);
  assert.match(app, /カジュアル/);
  assert.match(app, /recruit\.matchType/);
  assert.match(recruitsApi, /matchType:recruits\.matchType/);
  assert.match(discordApi, /options\.match_type/);
  assert.match(commandScript, /name: "match_type"/);
  assert.match(commandScript, /required: true/);
  assert.match(adminCommandApi, /requireAdmin/);
  assert.match(adminCommandApi, /method: "PATCH"/);
  assert.match(schema, /matchType: text\("match_type"\)/);
  assert.match(migration, /ADD `match_type` text DEFAULT 'ランクマッチ' NOT NULL/);
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
    ranks,
    legendRankMigration,
    ageMigration,
    adminPage,
    adminLogin,
    adminAuth,
    adminSessionApi,
    playInviteMigration,
    playInviteIndexMigration,
    recruitAlertsApi,
    recruitAlertsMigration,
    voiceRoomsApi,
    bioMigration,
    adminReportsApi,
    reportsTargetMigration,
    reportEvidenceMigration,
    messageFavoritesApi,
    messageFavoritesMigration,
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
    readFile(new URL("lib/ranks.ts", root), "utf8"),
    readFile(new URL("drizzle/0017_legend_rank.sql", root), "utf8"),
    readFile(new URL("drizzle/0018_unique_ironclad.sql", root), "utf8"),
    readFile(new URL("app/admin/page.tsx", root), "utf8"),
    readFile(new URL("app/admin/admin-login.tsx", root), "utf8"),
    readFile(new URL("lib/admin.ts", root), "utf8"),
    readFile(new URL("app/api/admin/session/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0019_lovely_lenny_balinger.sql", root), "utf8"),
    readFile(new URL("drizzle/0020_parched_frightful_four.sql", root), "utf8"),
    readFile(new URL("app/api/recruit-alerts/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0021_breezy_silk_fever.sql", root), "utf8"),
    readFile(new URL("app/api/discord/voice-rooms/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0022_vengeful_prowler.sql", root), "utf8"),
    readFile(new URL("app/api/admin/reports/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0023_broken_hiroim.sql", root), "utf8"),
    readFile(new URL("drizzle/0026_heavy_gwen_stacy.sql", root), "utf8"),
    readFile(new URL("app/api/message-favorites/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0027_bitter_carnage.sql", root), "utf8"),
  ]);
  assert.match(page, /getChatGPTUser/);
  assert.match(page, /initialProfile/);
  assert.match(page, /getDb\(\)\.select\(\)\.from\(profiles\)/);
  assert.match(app, /moveCard/);
  assert.match(app, /guestMode\s*\|\|\s*preview\s*\|\|\s*initialProfile\s*!==\s*undefined/);
  assert.match(app, /AbortController/);
  assert.match(app, /プレイ申請を送る/);
  assert.match(app, /マッチ成立/);
  assert.doesNotMatch(app, /ユナイトをプレイする/);
  assert.match(app, /また遊びたい/);
  assert.match(app, /トレーナーカードを共有/);
  assert.match(app, /通報せずブロックのみ/);
  assert.match(app, /通報などのチャットメニューを開く/);
  assert.match(app, /この発言を通報/);
  assert.match(app, /前後の会話も運営へ送信されます/);
  assert.match(app, /toggleConnectionPin/);
  assert.match(app, /チャットをピン留め/);
  assert.doesNotMatch(app, /お気に入りメッセージ/);
  assert.doesNotMatch(app, /toggleMessageFavorite/);
  assert.match(app, /このユーザーへの通報は受付済みです/);
  assert.match(app, /あなたのことを/);
  assert.match(app, /1〜5体・複数選択できます/);
  assert.match(app, /登録してメイトを探す/);
  assert.match(app, /未入力の項目/);
  assert.match(app, /onboardingMissing/);
  assert.match(app, /id="profile-edit-form"[\s\S]*termsAccepted/);
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
  assert.match(app, /承認待ちはまとめて確認できます/);
  assert.match(app, /pendingConversationGroup/);
  assert.ok(
    app.indexOf("{pendingConversationCount > 0") <
      app.indexOf("{connections.map"),
    "承認待ちのまとめをチャット一覧の先頭に表示する",
  );
  assert.match(app, /yunamatch-chat-tutorial-v1/);
  assert.match(app, /次のプレイまで/);
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
  assert.match(app, /receivedProfileCandidates/);
  assert.match(app, /const receivedCards = receivedProfileCandidates/);
  assert.match(app, /receivedProfileCandidates\.findIndex/);
  assert.doesNotMatch(discoverApi, /from\(profiles\)\.limit\(300\)/);
  assert.doesNotMatch(likesApi, /from\(profiles\)\.limit\(300\)/);
  assert.doesNotMatch(likesApi, /action:\s*["']profile-like["']/);
  assert.doesNotMatch(
    likesApi,
    /where\(eq\(profileLikes\.recipientId,user\.userId\)\)[\s\S]{0,100}\.limit\(50\)/,
  );
  assert.match(app, /yunamatch-push-intro-v1/);
  assert.match(app, /ホーム画面から開くと通知できます/);
  assert.match(app, /install-required/);
  assert.match(app, /通知をオンにする/);
  assert.match(app, /すべて消す/);
  assert.match(app, /visiblePendingIncoming/);
  assert.match(app, /request:\$\{notice\.id\}/);
  assert.match(app, /await dismissNotifications\(keys\)/);
  assert.match(app, /uniqueKeys\.slice\(index, index \+ 100\)/);
  assert.match(app, /notificationDismissBusy \? "削除中…" : "すべて消す"/);
  assert.match(app, /タップして確認、×で一覧から消せます/);
  assert.match(app, /notificationDismiss/);
  assert.match(app, /\/api\/notifications/);
  assert.match(app, /navPersonIcon/);
  assert.match(app, /メイト申請を送る/);
  assert.match(app, /指定なし（どのポケモンでも）/);
  assert.match(app, /承認前でも、ロールや編成について相談できます/);
  assert.match(app, /中央以外のロールもできますか/);
  assert.match(app, /理由を添えて断る/);
  assert.match(app, /ロールが重なっているため/);
  assert.match(app, /この理由を伝えて断る/);
  assert.match(app, /\/api\/application-messages/);
  assert.match(app, /使うポケモンは相談したいそうです/);
  assert.match(app, /MATCHED MATE PROFILE/);
  assert.match(app, /mateCount/);
  assert.match(app, /いいね済み/);
  assert.match(app, /onClick=\{\(\) => sendProfileLikeTo\(candidateDetail\)\}/);
  assert.doesNotMatch(app, /current\?\.id === candidateDetail\.id/);
  assert.match(app, /登録済みアカウントでログイン/);
  assert.match(app, /yunamatch-pending-action-v1/);
  assert.match(app, /PokemonLabel/);
  assert.match(app, /すぐ参加申請/);
  assert.match(app, /クイック募集/);
  assert.match(app, /新しい募集が出たら通知/);
  assert.match(app, /集合ロビー/);
  assert.match(app, /プッシュ通知/);
  assert.match(app, /全員そろったらプレイ開始/);
  assert.match(app, /この人を評価/);
  assert.match(app, /人気のメイト/);
  assert.match(app, /人からいいねされています/);
  assert.match(app, /自己紹介（任意）/);
  assert.match(app, /candidateDetail\.bio/);
  assert.match(app, /matchedProfile\.mateBio/);
  assert.match(css, /bottomNav/);
  assert.match(connectionsApi, /mutualAgain/);
  assert.match(connectionsApi, /userAPlayed/);
  assert.match(messagesApi, /connectionId/);
  assert.match(messagesApi, /clientId/);
  assert.match(messagesApi, /onConflictDoNothing/);
  assert.match(messagesApi, /play_invite/);
  assert.match(messagesApi, /export async function PATCH/);
  assert.match(messagesApi, /送信者は回答できません/);
  assert.match(playInviteMigration, /ADD `kind` text/);
  assert.match(playInviteMigration, /ADD `response` text/);
  assert.match(playInviteIndexMigration, /idx_messages_pending_play_invite/);
  assert.match(recruitAlertsApi, /onConflictDoUpdate/);
  assert.match(recruitAlertsMigration, /CREATE TABLE `recruit_alerts`/);
  assert.match(recruitAlertsMigration, /idx_recruit_alerts_enabled/);
  assert.match(recruitAlertsMigration, /PRAGMA optimize/);
  assert.match(app, /一緒にプレイしませんか/);
  assert.match(app, /二人だけのDiscord VCを作る/);
  assert.match(app, /respondPlayInvite/);
  assert.match(app, /className="chatPlayInvite"/);
  assert.doesNotMatch(app, /playInviteComposerButton/);
  assert.match(safetyApi, /allowedReasons/);
  assert.match(profileApi, /mainPokemon/);
  assert.match(profileApi, /contactFor/);
  assert.match(profileApi, /bio\.length>160/);
  assert.match(profileApi, /containsProhibitedContent\(bio\)/);
  assert.match(profileApi, /!genders\.has\(gender\)/);
  assert.match(applicationsApi, /プロフィールの未入力項目/);
  assert.match(applicationsApi, /match-wave-/);
  assert.match(applicationsApi, /body:`👋 \$\{row\.applicationMessage\}`/);
  assert.match(app, /承認前のあいさつ/);
  assert.match(app, /あなたに手を振っています/);
  assert.match(app, /相手と相談しながら承認を待てます/);
  assert.match(app, /shareMatchToX/);
  assert.match(app, /x\.com\/intent\/tweet/);
  assert.match(app, /このマッチをシェア/);
  assert.match(app, /マッチをシェア/);
  assert.match(applicationsApi, /matePokemon:row\.applicantPokemon/);
  assert.match(discoverApi, /kind:\s*"profile"/);
  assert.match(discoverApi, /requestedRows/);
  assert.doesNotMatch(discoverApi, /eq\(applications\.status, "pending"\),\s*eq\(recruits\.kind, "profile"\)/);
  assert.match(discoverApi, /👋 手を振っています/);
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
  assert.match(app, /二人だけのDiscord VCを作る/);
  assert.match(voiceRoomsApi, /VC1.*VC2.*VC3.*VC4.*VC5/);
  assert.match(voiceRoomsApi, /permission_overwrites/);
  assert.match(voiceRoomsApi, /legacyRoomNames/);
  assert.match(bioMigration, /ALTER TABLE `profiles` ADD `bio` text/);
  assert.match(expansionMigration, /CREATE TABLE `lobbies`/);
  assert.match(analyticsApi, /yunamatch_visitor/);
  assert.match(analyticsApi, /siteVisitors/);
  assert.match(statsApi, /管理者権限が必要です/);
  assert.match(analyticsMigration, /CREATE TABLE `daily_visitors`/);
  assert.match(analyticsMigration, /CREATE TABLE `site_visitors`/);
  assert.match(adminPanel, /今日の訪問者/);
  assert.match(adminPanel, /募集 → 申請あり/);
  assert.match(adminPanel, /バックアップをダウンロード/);
  assert.match(adminPanel, /登録ユーザーの男女比/);
  assert.match(adminPanel, /5件以上の要確認ユーザー/);
  assert.match(adminPanel, /チャットから通報/);
  assert.match(adminPanel, /通報された発言/);
  assert.match(adminPanel, /前後の会話を確認/);
  assert.match(adminReportsApi, /count\(distinct/);
  assert.match(adminReportsApi, /conversationContext/);
  assert.match(adminReportsApi, />= 5/);
  assert.match(adminReportsApi, /flaggedUsers/);
  assert.match(safetyApi, /alreadyReported/);
  assert.match(reportsTargetMigration, /idx_reports_target_created/);
  assert.match(reportEvidenceMigration, /reported_content/);
  assert.match(reportEvidenceMigration, /conversation_context/);
  assert.match(messageFavoritesApi, /favoriteMessageIds/);
  assert.match(messageFavoritesApi, /getMembership/);
  assert.match(messageFavoritesMigration, /CREATE TABLE `message_favorites`/);
  assert.match(messageFavoritesMigration, /idx_message_favorites_user_connection_created/);
  assert.match(messageFavoritesMigration, /PRAGMA optimize/);
  assert.match(statsApi, /demographics/);
  assert.match(connectionsApi, /adoptLegacyConnectionHistory/);
  assert.match(connectionsApi, /leftJoin\(connections/);
  assert.match(connectionsApi, /Connection backfill skipped/);
  assert.match(connectionsApi, /userAPinned/);
  assert.match(connectionsApi, /action === "pin"/);
  assert.match(safetyMigration, /rate_limit_buckets/);
  assert.match(safetyMigration, /support_tickets/);
  assert.match(supportApi, /24\*60\*60_000/);
  assert.match(exportApi, /content-disposition/);
  assert.match(exportApi, /connectionRatings/);
  assert.match(likesApi, /いいねが届きました/);
  assert.match(likesApi, /receivedProfiles/);
  assert.match(likesApi, /profiles:receivedProfiles/);
  assert.match(likesApi, /onConflictDoNothing/);
  assert.match(likesMigration, /CREATE TABLE `profile_likes`/);
  for (const name of ["バクフーン", "ソルガレオ", "レシラム", "イベルタル", "メガニウム", "ウェーニバル"]) {
    assert.match(app, new RegExp(name));
  }
  assert.doesNotMatch(app, /official-artwork|pokemonArtUrl|raw\.githubusercontent\.com\/PokeAPI/);
  assert.match(app, /fullCardPokemonName/);
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
  assert.match(loginPage, /すでに登録済みの方/);
  assert.match(loginPage, /登録時と同じSNS・同じアカウント/);
  assert.match(loginPage, /prompt: "select_account"/);
  assert.match(loginPage, /force_login: "true"/);
  assert.match(app, /登録済みアカウントでログイン/);
  assert.match(app, /別のスマホでも/);
  assert.match(app, /別のアカウントでログイン/);
  assert.match(privacyPage, /取得する情報/);
  assert.match(privacyPage, /外部サービスと委託先/);
  assert.match(privacyPage, /YUNAMATCH運営（個人開発）/);
  assert.match(contactPage, /不具合・改善リクエスト/);
  assert.match(app, /refreshedConnections\.find/);
  assert.match(publicSupportApi, /public-support/);
  assert.match(publicSupportApi, /sha256/);
  assert.match(app, /共有せずチャットへ/);
  assert.match(app, /連絡先を共有/);
  assert.match(app, /通報などのチャットメニューを開く/);
  assert.match(app, /chatActionsOpen && selectedConnection/);
  assert.doesNotMatch(app, /className="reconnectBar"/);
  assert.doesNotMatch(app, /className="contactConsentBar"/);
  assert.match(app, /ポケモン名/);
  assert.match(app, /プレイヤーネーム/);
  assert.match(app, /genderFilter/);
  assert.match(app, /すべて/);
  assert.match(app, /名前の一部でも検索できます/);
  assert.match(app, /filterDiscoverCandidates/);
  assert.match(app, /setAnimation\(""\)/);
  assert.match(app, /条件をリセット/);
  assert.match(app, /もらったいいね数/);
  assert.match(app, /minLikes/);
  assert.match(app, /maxLikes/);
  assert.match(app, /ポケモンのロール/);
  assert.match(app, /roleFilter/);
  assert.match(app, /プロフィールヘッダー/);
  assert.match(app, /headerUrl/);
  assert.match(app, /プロフィール画像を見る/);
  assert.match(app, /recruitProfileView/);
  assert.match(app, /yunamatch-discover-filters-v1/);
  assert.match(app, /localStorage\.setItem\(\s*discoverFiltersStorageKey/);
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
  assert.match(ranks, /レジェンド 1000〜1199/);
  assert.match(ranks, /マスター 1600〜1799.*レジェンド 1000〜1199/s);
  assert.doesNotMatch(app, /マスター 1600〜1799/);
  assert.match(legendRankMigration, /UPDATE `profiles`/);
  assert.match(legendRankMigration, /UPDATE `recruits`/);
  assert.match(legendRankMigration, /レジェンド 1400〜/);
  assert.match(app, /年齢を選択/);
  assert.match(app, /保護者の同意を得ています/);
  assert.match(profileApi, /age<13\|\|age>99/);
  assert.match(ageMigration, /ALTER TABLE `profiles` ADD `age` integer/);
  assert.match(privacyPage, /遊べる時間帯、年齢、性別/);
  assert.match(adminPage, /AdminLogin/);
  assert.match(adminLogin, /管理者パスワードを入力してください/);
  assert.match(adminAuth, /HMAC/);
  assert.match(adminAuth, /HttpOnly|adminSessionCookieName/);
  assert.match(adminSessionApi, /SameSite=Strict/);
  assert.match(adminSessionApi, /admin-login/);
  assert.match(adminSessionApi, /limit: 5/);
  assert.doesNotMatch(adminAuth + adminSessionApi, /unimatch/);
});
