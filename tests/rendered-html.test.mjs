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

test("uses the YUNAMATCH logo social preview", async () => {
  const layout = await readFile(new URL("app/layout.tsx", root), "utf8");
  await access(new URL("public/og-yunamatch-logo.png", root));
  assert.match(layout, /og-yunamatch-logo\.png/);
  assert.match(layout, /width: 1200, height: 630/);
});

test("prevents iPhone from zooming chat inputs on focus", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  for (const selector of [
    ".messageComposer input",
    ".pendingMessageComposer input",
    ".declineReasonPanel input",
  ]) {
    const rule = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")} \\{[^}]+\\}`))?.[0] ?? "";
    assert.match(rule, /font-size:\s*16px/);
    assert.match(rule, /touch-action:\s*manipulation/);
  }
});

test("keeps discover results inside every selected filter", async () => {
  const { filterDiscoverCandidates } = await import(
    new URL("../lib/discover-filter.ts", import.meta.url)
  );
  const now = Date.now();
  const candidates = [
    { trainerName: "みどり", mainPokemon: ["ミュウ"], gender: "女性", playTime: ["平日 夜（18〜22時）"], likeCount: 3, online: true, lastActiveAt: new Date(now - 60_000).toISOString() },
    { trainerName: "みどり2", mainPokemon: ["ミュウツーX"], gender: "男性", playTime: ["平日 夜（18〜22時）"], likeCount: 12, online: false, lastActiveAt: new Date(now - 2 * 60 * 60_000).toISOString() },
    { trainerName: "あお", mainPokemon: ["ミュウツーY"], gender: "女性", playTime: ["土日 朝・昼"], likeCount: 24, online: false, lastActiveAt: new Date(now - 30 * 60 * 60_000).toISOString() },
  ];
  const baseFilters = {
    trainerQuery: "",
    gender: "",
    sharedTimeOnly: false,
    minLikes: null,
    maxLikes: null,
    role: "",
    activity: "",
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
  assert.deepEqual(
    filterDiscoverCandidates(candidates, { ...baseFilters, pokemonQuery: "", activity: "online" }).map((person) => person.trainerName),
    ["みどり"],
  );
  assert.deepEqual(
    filterDiscoverCandidates(candidates, { ...baseFilters, pokemonQuery: "", activity: "3h" }).map((person) => person.trainerName),
    ["みどり", "みどり2"],
  );
});

test("filters and sorts discovery by recent online activity", async () => {
  const [app, discoverApi] = await Promise.all([
    readFile(new URL("app/match-app.tsx", root), "utf8"),
    readFile(new URL("app/api/discover/route.ts", root), "utf8"),
  ]);
  assert.match(app, /最終オンライン/);
  assert.match(app, /オンライン中/);
  assert.match(app, /3時間以内/);
  assert.match(app, /24時間以内/);
  assert.match(app, /params\.set\("activity", activityFilter\)/);
  assert.match(discoverApi, /requestedActivity === "online"/);
  assert.match(discoverApi, /Date\.now\(\) - 3 \* 60 \* 60_000/);
  assert.match(discoverApi, /Date\.now\(\) - 24 \* 60 \* 60_000/);
  assert.match(discoverApi, /right\.lastActiveAt\.getTime\(\) - left\.lastActiveAt\.getTime\(\)/);
});

test("resolves profiles beyond the former 300-account action limit", async () => {
  const { profilePublicId, resolveProfilePublicId } = await import(
    new URL("../lib/profile-id.ts", import.meta.url)
  );
  const userIds = Array.from({ length: 350 }, (_, index) => `user-${index}`);
  const targetId = await profilePublicId(userIds[349]);
  assert.equal(await resolveProfilePublicId(userIds, targetId), userIds[349]);
});

test("diversifies recommendations without gender or popularity ranking", async () => {
  const { rankDiscoverCandidates } = await import(
    new URL("../lib/discover-ranking.ts", import.meta.url)
  );
  const now = new Date("2026-08-23T00:00:00+09:00").getTime();
  const candidate = (overrides) => ({
    userId: "candidate",
    mainPokemon: ["ピカチュウ"],
    highestRate: "レジェンド 1000〜1199",
    playTime: ["土日 朝・昼"],
    createdAt: new Date(now - 90 * 24 * 60 * 60_000),
    lastActiveAt: new Date(now - 20 * 24 * 60 * 60_000),
    likeCount: 50,
    qualityScore: 4,
    avatarUrl: "",
    bio: "",
    ...overrides,
  });
  const ranked = rankDiscoverCandidates(
    [
      candidate({ userId: "popular", likeCount: 500 }),
      candidate({
        userId: "compatible",
        mainPokemon: ["ハピナス"],
        playTime: ["平日 夜（18〜22時）"],
        lastActiveAt: new Date(now - 60_000),
      }),
      candidate({
        userId: "new-zero-like",
        likeCount: 0,
        createdAt: new Date(now - 24 * 60 * 60_000),
      }),
      ...Array.from({ length: 9 }, (_, index) =>
        candidate({ userId: `other-${index}`, likeCount: index + 10 }),
      ),
    ],
    {
      userId: "viewer",
      mainPokemon: ["ゲッコウガ"],
      highestRate: "レジェンド 1000〜1199",
      playTime: ["平日 夜（18〜22時）"],
    },
    now,
  );
  assert.ok(
    ranked.slice(0, 3).some((person) => person.userId === "compatible"),
  );
  assert.ok(ranked.slice(0, 5).some((person) => person.userId === "new-zero-like"));
  assert.notEqual(ranked[0].userId, "popular");
  assert.deepEqual(
    ranked.map((person) => person.userId),
    rankDiscoverCandidates(ranked, {
      userId: "viewer",
      mainPokemon: ["ゲッコウガ"],
      highestRate: "レジェンド 1000〜1199",
      playTime: ["平日 夜（18〜22時）"],
    }, now).map((person) => person.userId),
  );
  const rotated = rankDiscoverCandidates(ranked, {
    userId: "viewer",
    mainPokemon: ["ゲッコウガ"],
    highestRate: "レジェンド 1000〜1199",
    playTime: ["平日 夜（18〜22時）"],
    rotationSeed: "another-session",
  }, now);
  assert.notDeepEqual(
    ranked.slice(0, 6).map((person) => person.userId),
    rotated.slice(0, 6).map((person) => person.userId),
  );
});

test("raises the share of online profiles without removing other discovery slots", async () => {
  const { rankDiscoverCandidates } = await import(
    new URL("../lib/discover-ranking.ts", import.meta.url)
  );
  const now = new Date("2026-08-23T12:00:00+09:00").getTime();
  const candidates = Array.from({ length: 20 }, (_, index) => ({
    userId: `candidate-${index}`,
    mainPokemon: ["ピカチュウ"],
    highestRate: "レジェンド 1000〜1199",
    playTime: ["平日 夜（18〜22時）"],
    createdAt: new Date(now - 60 * 24 * 60 * 60_000),
    lastActiveAt: new Date(now - (index + 1) * 60_000),
    online: index < 8,
    likeCount: 10,
    qualityScore: 4,
    avatarUrl: "",
    bio: "",
  }));
  const ranked = rankDiscoverCandidates(
    candidates,
    {
      userId: "viewer",
      mainPokemon: ["ゲッコウガ"],
      highestRate: "レジェンド 1000〜1199",
      playTime: ["平日 夜（18〜22時）"],
      rotationSeed: "online-ratio-test",
    },
    now,
  );
  assert.ok(
    ranked.slice(0, 10).filter((person) => person.online).length >= 4,
    "先頭10件にオンラインの人を4人以上含める",
  );
  assert.ok(
    ranked.slice(0, 10).some((person) => !person.online),
    "オンライン以外の発見枠も残す",
  );
});

test("supports casual and ranked recruiting on the site and Discord", async () => {
  const [app, recruitsApi, discordApi, commandScript, adminCommandApi, schema, migration, recruitVoice, cleanupWorkflow] =
    await Promise.all([
      readFile(new URL("app/match-app.tsx", root), "utf8"),
      readFile(new URL("app/api/recruits/route.ts", root), "utf8"),
      readFile(new URL("app/api/discord/interactions/route.ts", root), "utf8"),
      readFile(new URL("scripts/register-discord-command.mjs", root), "utf8"),
      readFile(new URL("app/api/admin/discord-command/route.ts", root), "utf8"),
      readFile(new URL("db/schema.ts", root), "utf8"),
      readFile(new URL("drizzle/0029_many_shadow_king.sql", root), "utf8"),
      readFile(new URL("lib/discord-recruit-voice.ts", root), "utf8"),
      readFile(new URL(".github/workflows/cleanup-discord-voice-rooms.yml", root), "utf8"),
    ]);
  assert.match(app, /遊ぶモード/);
  assert.match(app, /ランクマッチ/);
  assert.match(app, /カジュアル/);
  assert.match(app, /recruit\.matchType/);
  assert.match(recruitsApi, /matchType:recruits\.matchType/);
  assert.match(discordApi, /options\.match_type/);
  assert.match(discordApi, /@here \*\*\$\{matchType\}の\$\{partyDisplay\}パーティ募集中です/);
  assert.match(discordApi, /partyChoice === "up_to_3" \? "3人以下" : `\$\{partySize\}人`/);
  assert.match(discordApi, /募集者のレートは/);
  assert.match(discordApi, /allowed_mentions: \{ parse: \["everyone"\] \}/);
  assert.match(discordApi, /label: "Discord連携はこちら"/);
  assert.match(discordApi, /https:\/\/yunamatch\.com\/\?joinDiscord=1/);
  assert.match(discordApi, /options\.lane \? `担当レーンは/);
  assert.match(discordApi, /options\.play_style \? `役割は/);
  assert.match(discordApi, /options\.starts_in !== undefined \? `開始時間は/);
  assert.match(discordApi, /options\.duration !== undefined \? `募集時間は/);
  assert.match(discordApi, /options\.matches !== undefined \? `試合数は/);
  assert.match(discordApi, /options\.win_rate !== undefined \? `勝率は/);
  assert.match(commandScript, /name: "match_type"/);
  assert.match(commandScript, /name: "create_vc"/);
  assert.match(commandScript, /name: "create_vc",[\s\S]*?required: true/);
  assert.match(commandScript, /\{ name: "作成する", value: "yes" \}/);
  assert.match(commandScript, /\{ name: "作成しない", value: "no" \}/);
  assert.match(commandScript, /name: "voice_limit"/);
  assert.doesNotMatch(commandScript, /name: "voice_limit",[\s\S]*?required: true/);
  assert.match(commandScript, /required: true/);
  assert.match(commandScript, /募集者本人/);
  assert.match(commandScript, /"マスター0〜249"/);
  assert.match(commandScript, /"マスター250〜499"/);
  assert.match(commandScript, /"マスター500〜749"/);
  assert.match(commandScript, /"マスター750〜999"/);
  assert.match(commandScript, /"レジェンド1000〜1249"/);
  assert.match(commandScript, /"レジェンド1250〜1499"/);
  assert.match(commandScript, /"レジェンド1500以上"/);
  assert.doesNotMatch(commandScript, /マスター 1200〜1399/);
  assert.match(discordApi, /discordRecruitRanks/);
  assert.match(adminCommandApi, /currentRankChoices/);
  assert.match(adminCommandApi, /option\.name === "current_rank"/);
  assert.match(adminCommandApi, /voiceLimitOption/);
  assert.match(adminCommandApi, /createVoiceOption/);
  assert.match(adminCommandApi, /mappedOptions\.filter\(\(option\) => option\.required\)/);
  assert.match(adminCommandApi, /requireAdmin/);
  assert.match(adminCommandApi, /method: "PATCH"/);
  assert.match(adminCommandApi, /clarifiedDescriptions/);
  assert.match(adminCommandApi, /DISCORD_GUILD_ID/);
  assert.match(adminCommandApi, /guilds\/\$\{guildId\}\/commands/);
  assert.match(discordApi, /String\(options\.create_vc \|\| "yes"\) === "yes"/);
  assert.match(discordApi, /専用VCは\$\{voiceLimit\}人用・24時間で自動削除されます/);
  assert.match(discordApi, /専用VCは作成しません/);
  assert.match(discordApi, /label: `\$\{voiceLimit\}人用VCに入る`/);
  assert.match(recruitVoice, /voiceRoomLifetimeMs = 24 \* 60 \* 60_000/);
  assert.match(recruitVoice, /snowflakeCreatedAt/);
  assert.match(cleanupWorkflow, /7,22,37,52 \* \* \* \*/);
  assert.match(schema, /matchType: text\("match_type"\)/);
  assert.match(migration, /ADD `match_type` text DEFAULT 'ランクマッチ' NOT NULL/);
});

test("explains what happens after likes and mate requests", async () => {
  const app = await readFile(new URL("app/match-app.tsx", root), "utf8");
  assert.match(app, /相手の通知と「相手から」にあなたのプロフィールが表示されます/);
  assert.match(app, /チャットは始まらない/);
  assert.match(app, /メイト成立にもならない/);
  assert.match(app, /「やりとり」の承認待ちで相談できる/);
  assert.match(app, /承認されるとメイト成立・通常チャット開始/);
  assert.match(app, /参加申請やDMが届き、承認するとロビーへ進みます/);
  assert.match(app, /連絡先は自動公開されません/);
});

test("requires a linked Discord account before opening the community invite", async () => {
  const [app, community, linkRoute] = await Promise.all([
    readFile(new URL("app/match-app.tsx", root), "utf8"),
    readFile(new URL("app/community/page.tsx", root), "utf8"),
    readFile(new URL("vercel-proxy/app/api/link/[provider]/route.ts", root), "utf8"),
  ]);
  assert.match(app, /linkedAccounts\.some\(\(account\) => account\.provider === "discord"\)/);
  assert.match(app, /Discordアカウントを連携してから参加できます/);
  assert.match(app, /className="discoverDiscord"/);
  assert.match(app, /aria-label="Discordサーバーに参加"/);
  assert.match(app, /\/api\/link\/discord\?joinDiscord=1/);
  assert.match(community, /href="\/\?joinDiscord=1"/);
  assert.doesNotMatch(community, /discord\.gg/);
  assert.match(linkRoute, /linked=discord&joinDiscord=1/);
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
    recruitsApi,
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
    readFile(new URL("app/api/recruits/route.ts", root), "utf8"),
  ]);
  assert.match(page, /getChatGPTUser/);
  assert.match(page, /initialProfile/);
  assert.match(page, /getDb\(\)\.select\(\)\.from\(profiles\)/);
  assert.match(app, /moveCard/);
  assert.match(app, /guestMode\s*\|\|\s*preview\s*\|\|\s*initialProfile\s*!==\s*undefined/);
  assert.match(app, /AbortController/);
  assert.match(app, /プレイ申請を送る/);
  assert.match(app, /募集者にDM/);
  assert.match(app, /openRecruitDm/);
  assert.match(applicationsApi, /application:\{id:application\.id/);
  assert.match(connectionsApi, /recruitId: row\.recruitId/);
  assert.match(app, /マッチ成立/);
  assert.doesNotMatch(app, /ユナイトをプレイする/);
  assert.match(app, /また遊びたい/);
  assert.match(app, /トレーナーカードを共有/);
  assert.match(app, /通報せずブロックのみ/);
  assert.match(app, /ブロック中のユーザー/);
  assert.match(app, /unblockUser/);
  assert.match(safetyApi, /export async function GET/);
  assert.match(safetyApi, /export async function DELETE/);
  assert.match(safetyApi, /delete\(blocks\)/);
  assert.match(app, /通報などのチャットメニューを開く/);
  assert.match(app, /この発言を通報/);
  assert.match(app, /前後の会話も運営へ送信されます/);
  assert.match(app, /toggleConnectionPin/);
  assert.match(app, /チャットをピン留め/);
  assert.match(app, /connectionsLoaded/);
  assert.match(app, /yunamatch-active-tab-v1/);
  assert.match(app, /sessionStorage\.getItem\(activeTabSessionKey\)/);
  assert.match(app, /sessionStorage\.setItem\(activeTabSessionKey, tab\)/);
  assert.match(app, /guestMode && needsLogin \? "discover" : restoredTab/);
  assert.match(app, /チャットを読み込んでいます/);
  assert.match(app, /通信が戻ると自動で表示されます/);
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
  assert.match(app, /使い方・機能ガイド/);
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
  assert.match(app, /分前にオンライン/);
  assert.match(app, /時間前にオンライン/);
  assert.match(app, /下に引いて更新/);
  assert.match(app, /離して更新/);
  assert.match(app, /handlePullMove/);
  assert.match(app, /tab === "chat" \|\|[\s\S]*?pullRefreshing/);
  assert.match(css, /\.messageThread \{[^}]*overscroll-behavior-y: contain;[^}]*touch-action: pan-y/);
  assert.match(app, /window\.location\.reload/);
  assert.match(app, /ランク行きませんか？/);
  assert.match(app, /一緒に遊んだ/);
  assert.match(app, /プレイ完了/);
  assert.match(app, /相談して決める/);
  assert.match(app, /募集をキャンセル/);
  assert.match(app, /通知をオンにして続ける/);
  assert.match(app, /自分の試合数/);
  assert.match(app, /自分の勝率/);
  assert.match(app, /募集条件/);
  assert.match(app, /希望する相手/);
  assert.match(app, /募集者プロフィール/);
  assert.match(app, /募集者ランク/);
  assert.match(app, /募集者の試合数/);
  assert.match(app, /formatRecruitPostedAt/);
  assert.match(app, /募集日時/);
  assert.match(app, /に掲載/);
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
  assert.match(app, /Discord VCを作る/);
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
  assert.match(app, /#ユナマッチ/);
  assert.doesNotMatch(app, /#YUNAMATCH/);
  assert.match(app, /https:\/\/yunamatch\.com\//);
  assert.match(app, /このマッチをシェア/);
  assert.match(app, /マッチをシェア/);
  assert.match(applicationsApi, /matePokemon:row\.applicantPokemon/);
  assert.match(discoverApi, /kind:\s*"profile"/);
  assert.match(discoverApi, /requestedRows/);
  assert.doesNotMatch(discoverApi, /eq\(applications\.status, "pending"\),\s*eq\(recruits\.kind, "profile"\)/);
  assert.match(discoverApi, /👋 手を振っています/);
  assert.doesNotMatch(discoverApi, /me\.gender\s*===\s*"男性"/);
  assert.match(discoverApi, /rankDiscoverCandidates/);
  assert.match(discoverApi, /query\.hideLiked/);
  assert.match(discoverApi, /query\.likedOnly/);
  assert.match(discoverApi, /likedByMe\.has\(row\.userId\)/);
  assert.match(discoverApi, /likedByMeRows/);
  assert.match(app, /いいねした人だけ表示/);
  assert.match(app, /いいね済みの人を表示しない/);
  assert.match(app, /Discordで共有/);
  assert.match(app, /trainerShareDestinations/);
  assert.match(app, /shareTrainerCard\("x"\)/);
  assert.match(app, /shareTrainerCard\("discord"\)/);
  assert.match(app, /shareTrainerCard\("line"\)/);
  assert.match(app, /https:\/\/discord\.com\/channels\/@me/);
  assert.match(app, /https:\/\/line\.me\/R\/share/);
  assert.match(app, /const currentUrl = "https:\/\/yunamatch\.com\/"/);
  assert.match(app, /discoverSessionSeedRef/);
  assert.match(discoverApi, /activeCutoff/);
  assert.match(discoverApi, /lastActiveAt/);
  assert.match(discoverApi, /limited:\s*true/);
  assert.match(discoverApi, /avatarUrl:\s*""/);
  assert.match(discoverApi, /qualityScore/);
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
  assert.match(discordApi, /getRequestExecutionContext/);
  assert.match(discordApi, /type: 5/);
  assert.match(discordApi, /messages\/@original/);
  assert.match(discordApi, /return json\(\{ type: 5 \}\)/);
  assert.match(app, /Discord VCを作る/);
  assert.match(voiceRoomsApi, /VC1.*VC2.*VC3.*VC4.*VC5/);
  assert.match(voiceRoomsApi, /permission_overwrites/);
  assert.match(voiceRoomsApi, /\[2, 3, 4, 5\]\.includes\(userLimit\)/);
  assert.match(voiceRoomsApi, /"DELETE", `\/channels\/\$\{room\.id\}`/);
  assert.match(app, /VCの人数を選ぶ/);
  assert.match(app, /閉じるとVC内のチャットも削除されます/);
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
  assert.match(connectionsApi, /identityAliases/);
  assert.match(connectionsApi, /inArray\(connections\.userAId, aliases\)/);
  assert.doesNotMatch(connectionsApi, /adoptLegacyConnectionHistory/);
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
  assert.match(app, /messageThreadRef/);
  assert.match(app, /thread\.scrollTo\(\{ top: thread\.scrollHeight/);
  assert.match(css, /\.playInviteMessage \{[^}]*flex-shrink: 0/);
  assert.match(app, /このロビーは10分後に一覧から消えます/);
  assert.match(lobbyApi, /endedLobbyRetentionMs=10\*60\*1000/);
  assert.match(lobbyApi, /gt\(lobbies\.finishedAt,visibleEndedAfter\)/);
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
  assert.match(app, /募集者プロフィールを見る/);
  assert.match(app, /プロフィール画像・自己紹介・募集者情報/);
  assert.match(app, /recruitProfileView\.bio \|\| "自己紹介は未設定です"/);
  assert.match(recruitsApi, /bio:profiles\.bio/);
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

test("keeps chat and recruiting responsive under load", async () => {
  const [app, connectionsApi, messagesApi, applicationMessagesApi, applicationsApi, recruitsApi, background] =
    await Promise.all([
      readFile(new URL("app/match-app.tsx", root), "utf8"),
      readFile(new URL("app/api/connections/route.ts", root), "utf8"),
      readFile(new URL("app/api/messages/route.ts", root), "utf8"),
      readFile(new URL("app/api/application-messages/route.ts", root), "utf8"),
      readFile(new URL("app/api/applications/route.ts", root), "utf8"),
      readFile(new URL("app/api/recruits/route.ts", root), "utf8"),
      readFile(new URL("lib/background.ts", root), "utf8"),
    ]);

  assert.match(app, /delivery: "sending"/);
  assert.match(app, /送信失敗/);
  assert.match(app, /setInterval\(refreshCurrentConversation, 5000\)/);
  assert.match(app, /setInterval\(refreshVisibleSummary, 45000\)/);
  assert.match(app, /setInterval\(ping, 6000\)/);
  assert.match(connectionsApi, /groupBy\(messages\.connectionId\)/);
  assert.match(connectionsApi, /unreadCountByConnection/);
  assert.match(connectionsApi, /innerJoin\(connections/);
  assert.doesNotMatch(connectionsApi, /unreadPredicates/);
  assert.doesNotMatch(connectionsApi, /visible\.map\(async/);
  assert.match(app, /connectionsError/);
  assert.match(app, /チャットを読み込めませんでした/);
  assert.match(app, /もう一度読み込む/);
  assert.match(app, /apiTimeoutMs = 8_000/);
  assert.match(app, /AbortController/);
  assert.match(app, /setConnectionsLoaded\(true\)/);
  assert.match(app, /yunamatch-connections-session-v1/);
  assert.match(app, /yunamatch-messages-session-v1/);
  assert.match(app, /直前に読み込んだやりとりを表示しています/);
  assert.match(app, /通信混雑のため直前のメッセージを表示中/);
  assert.match(app, /activeConnectionIdRef\.current = connection\.id/);
  assert.match(app, /messageLoadRequestRef/);
  assert.match(app, /messageLoadInFlightRef/);
  assert.match(app, /pendingMessageLoadInFlightRef/);
  assert.match(app, /setMessages\(\[\]\)/);
  assert.match(app, /メッセージを読み込めませんでした/);
  assert.match(connectionsApi, /connectionListLimit = 200/);
  assert.match(connectionsApi, /searchParams\.get\("repair"\) === "1"/);
  assert.match(app, /connectionsRepairAttemptedRef/);
  assert.match(app, /\/api\/connections\?repair=1/);
  assert.match(connectionsApi, /Connection profile enrichment skipped/);
  assert.match(connectionsApi, /Connection unread-count lookup skipped/);
  assert.match(connectionsApi, /chunked\(connectionIds\)/);
  assert.match(connectionsApi, /\.values\(group\)/);
  assert.match(messagesApi, /orderBy\(desc\(messages\.createdAt\), desc\(messages\.id\)\)/);
  assert.match(messagesApi, /newestRows\.slice\(0, pageSize\)\.reverse\(\)/);
  assert.match(messagesApi, /before \? lt\(messages\.id, before\)/);
  assert.match(messagesApi, /nextCursor: rows\[0\]\?\.id/);
  assert.match(applicationMessagesApi, /orderBy\(desc\(applicationMessages\.createdAt\), desc\(applicationMessages\.id\)\)/);
  assert.match(applicationMessagesApi, /newestRows\.reverse\(\)/);
  assert.match(messagesApi, /runInBackground/);
  assert.match(applicationMessagesApi, /runInBackground/);
  assert.match(applicationsApi, /runInBackground/);
  assert.match(applicationsApi, /eq\(applications\.status,"pending"\)/);
  assert.match(applicationsApi, /historyPageSize\+1/);
  assert.match(connectionsApi, /connectionListLimit \+ 1/);
  assert.match(connectionsApi, /latestMessageId/);
  assert.match(app, /過去のメッセージを読み込む/);
  assert.match(app, /過去のチャットを読み込む/);
  assert.match(app, /過去の募集をさらに表示/);
  assert.match(app, /過去の申請履歴を読み込む/);
  assert.doesNotMatch(recruitsApi, /recruitAlerts\.enabled, true\)\)\.limit\(100\)/);
  assert.match(recruitsApi, /Recruit alert fanout/);
  assert.match(background, /context\.waitUntil/);
});

test("reduces repeated identity and chat database work during traffic spikes", async () => {
  const [schema, migration, aliases, auth, accountLinks] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0031_fresh_cammi.sql", root), "utf8"),
    readFile(new URL("lib/account-aliases.ts", root), "utf8"),
    readFile(new URL("app/chatgpt-auth.ts", root), "utf8"),
    readFile(new URL("app/api/account-links/internal/route.ts", root), "utf8"),
  ]);

  assert.match(schema, /idx_account_links_email/);
  assert.match(migration, /SET `email` = lower\(trim\(`email`\)\)/);
  assert.match(migration, /CREATE INDEX `idx_account_links_email`/);
  assert.match(aliases, /aliasCacheTtlMs = 5 \* 60_000/);
  assert.match(auth, /canonicalUserCacheTtlMs = 5 \* 60_000/);
  assert.doesNotMatch(aliases + auth + accountLinks, /lower\(\$\{accountLinks\.email\}\)/);
});

test("lets users hide read receipts without keeping their own chats unread", async () => {
  const [app, schema, profileApi, messagesApi, migration] = await Promise.all([
    readFile(new URL("app/match-app.tsx", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/profile/route.ts", root), "utf8"),
    readFile(new URL("app/api/messages/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0032_spotty_tomorrow_man.sql", root), "utf8"),
  ]);

  assert.match(schema, /readReceiptsEnabled/);
  assert.match(migration, /ADD `read_receipts_enabled` integer DEFAULT true NOT NULL/);
  assert.match(profileApi, /export async function PATCH/);
  assert.match(profileApi, /readReceiptsEnabled:body\.readReceiptsEnabled/);
  assert.match(messagesApi, /mateAllowsReadReceipts/);
  assert.match(messagesApi, /Chat read receipt/);
  assert.match(app, /既読をつけない/);
  assert.match(app, /toggleReadReceipts/);
});

test("lets administrators find and suspend any registered account", async () => {
  const [panel, usersApi] = await Promise.all([
    readFile(new URL("app/admin/admin-panel.tsx", root), "utf8"),
    readFile(new URL("app/api/admin/users/route.ts", root), "utf8"),
  ]);

  assert.match(panel, /USER MANAGEMENT/);
  assert.match(panel, /トレーナー名を入力（例：桜みく）/);
  assert.match(panel, /アカウント停止/);
  assert.match(panel, /停止を解除/);
  assert.match(panel, /アカウント削除/);
  assert.match(panel, /window\.prompt/);
  assert.match(panel, /\/api\/admin\/users/);
  assert.match(panel, /window\.confirm/);
  assert.match(usersApi, /requireAdmin/);
  assert.match(usersApi, /eq\(profiles\.trainerName, query\)/);
  assert.match(usersApi, /like\(profiles\.trainerName/);
  assert.match(usersApi, /suspendedAt/);
  assert.match(usersApi, /status: "closed"/);
  assert.match(usersApi, /payload\.confirmation !== profile\.trainerName/);
  assert.match(usersApi, /DELETE FROM profiles WHERE user_id = \?/);
  assert.match(usersApi, /deleted: true/);
});

test("shows the other trainer's public profile before approving a chat request", async () => {
  const [app, applicationsApi] = await Promise.all([
    readFile(new URL("app/match-app.tsx", root), "utf8"),
    readFile(new URL("app/api/applications/route.ts", root), "utf8"),
  ]);

  assert.match(app, /相手のプロフィールを見る/);
  assert.match(app, /自己紹介・使うポケモン・ランク・遊べる時間帯/);
  assert.match(app, /pendingProfileView/);
  assert.match(applicationsApi, /mateProfile:publicProfile/);
  assert.match(applicationsApi, /inArray\(profiles\.userId,mateIds\)/);
  assert.doesNotMatch(app, /pendingProfileView\.contact/);
});

test("lets applicants cancel a pending mate request", async () => {
  const [app, applicationsApi] = await Promise.all([
    readFile(new URL("app/match-app.tsx", root), "utf8"),
    readFile(new URL("app/api/applications/route.ts", root), "utf8"),
  ]);

  assert.match(app, /申請を取り消す/);
  assert.match(app, /cancelSelectedApplication/);
  assert.match(app, /decide\(selectedPending\.notice\.id, "cancel"\)/);
  assert.match(applicationsApi, /p\.action==="cancel"/);
  assert.match(applicationsApi, /eq\(applications\.applicantId,user\.userId\)/);
  assert.match(applicationsApi, /status:"cancelled"/);
  assert.match(applicationsApi, /申請が取り消されました/);
});
