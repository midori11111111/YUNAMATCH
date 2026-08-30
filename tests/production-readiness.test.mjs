import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const compact = (value) => value.replace(/\s+/g, "");

test("administrator backup includes every multi-service safety and chat table", async () => {
  const source = compact(await read("app/api/admin/export/route.ts"));
  for (const table of [
    "serviceProfiles",
    "serviceRecruits",
    "serviceConnections",
    "serviceLikes",
    "serviceMessages",
    "serviceMessageReactions",
    "serviceReports",
    "serviceBlocks",
    "serviceAdminAuditLogs",
  ]) {
    assert.match(source, new RegExp(`${table}:`));
    assert.match(source, new RegExp(`db\\.select\\(\\)\\.from\\(${table}\\)`));
  }
  assert.match(source, /schemaVersion:6/);
  assert.match(source, /"cache-control":"no-store"/);
});

test("administrator backup retains core relationship and privacy tables", async () => {
  const source = compact(await read("app/api/admin/export/route.ts"));
  for (const table of [
    "profileLikes",
    "notificationDismissals",
    "applicationMessages",
    "mutualLikeMatches",
    "availabilitySlots",
    "presence",
    "pushSubscriptions",
    "recruitAlerts",
  ]) {
    assert.match(source, new RegExp(`db\\.select\\(\\)\\.from\\(${table}\\)`));
  }
});

test("service Discord links use allowlisted official invites with environment overrides", async () => {
  const source = compact(await read("app/service-discord-link.tsx"));
  assert.match(source, /url\.protocol==="https:"/);
  assert.match(source, /url\.hostname==="discord\.gg"/);
  assert.match(source, /url\.hostname==="discord\.com"/);
  assert.match(source, /url\.pathname\.startsWith\("\/invite\/"\)/);
  assert.match(source, /if\(!isDiscordInviteUrl\(url\)\)returnnull/);
  assert.match(source, /https:\/\/discord\.gg\/yrqnQNEYc/);
  assert.match(source, /https:\/\/discord\.gg\/eUX4kHBef/);
  assert.match(source, /https:\/\/discord\.gg\/qWR5tTyPH/);
  assert.match(source, /NEXT_PUBLIC_VALOMATCH_DISCORD_URL\|\|defaultInviteUrls\.valomatch/);
  for (const page of ["valorant-preview", "brawl-preview", "identity-preview"]) {
    assert.match(await read(`app/${page}/page.tsx`), /<ServiceDiscordLink service=/);
  }
});

test("Stamate uses current geometric branding, game taxonomy, and guild-scoped recruiting", async () => {
  const [
    page,
    config,
    mark,
    registerCommand,
    interactions,
    legal,
    launchKit,
    stamateLayout,
    previewLayout,
    servicesPage,
    brawlers,
  ] = await Promise.all([
    read("app/brawl-preview/page.tsx"),
    read("lib/service-config.ts"),
    read("public/brand/stamate-mark.svg"),
    read("scripts/register-stamate-discord-command.mjs"),
    read("app/api/discord/interactions/route.ts"),
    read("app/legal/page.tsx"),
    read("docs/stamate-launch-kit.md"),
    read("app/stamate/layout.tsx"),
    read("app/brawl-preview/layout.tsx"),
    read("app/services/page.tsx"),
    read("lib/stamate-brawlers.ts"),
  ]);
  for (const tier of ["ブロンズ", "ミシック", "マスター", "プロ"])
    assert.match(config, new RegExp(tier));
  assert.doesNotMatch(config, /stamate:[^\n]+エリート/);
  for (const brawler of ["シェリー", "モーティス", "スパイク", "シリウス"])
    assert.match(brawlers, new RegExp(brawler));
  assert.match(config, /stamateBrawlerSet/);
  assert.match(registerCommand, /name: "brawler"/);
  assert.match(registerCommand, /autocomplete: true/);
  for (const mode of [
    "トロフィー",
    "ガチバトル",
    "フリープレイ",
    "マップメーカー",
    "スペシャルイベント",
    "フレンドバトル",
  ]) {
    assert.match(config, new RegExp(mode));
    assert.match(registerCommand, new RegExp(mode));
  }
  assert.match(page, /\/brand\/stamate-mark\.svg/);
  assert.match(page, /プレイヤー名 \/ プレイヤータグ（#を含む）/);
  assert.match(page, /!\[2, 3, 5\]\.includes\(partySize\)/);
  assert.match(mark, /linearGradient/);
  assert.match(mark, /#6857FF/);
  assert.match(mark, /#397FEF/);
  assert.match(mark, /#F04E9D/);
  assert.match(mark, /#FF8A55/);
  assert.match(mark, /M176 70h-62c-31 0-49 15-49 38/);
  assert.doesNotMatch(mark, /M128 55 150 86 187 90|skull/i);
  assert.doesNotMatch(mark, /filter|image href/);
  assert.match(stamateLayout, /\/brand\/stamate-og\.png/);
  assert.match(previewLayout, /\/brand\/stamate-og\.png/);
  assert.match(servicesPage, /markImage: "\/brand\/stamate-mark\.svg"/);
  assert.match(registerCommand, /DISCORD_STAMATE_GUILD_ID/);
  assert.match(registerCommand, /guilds\/\$\{guildId\}\/commands/);
  assert.match(interactions, /createStamateRecruitMessage/);
  assert.match(interactions, /serviceId: "stamate"/);
  assert.match(interactions, /categoryName: "スタメイト 募集VC"/);
  assert.match(interactions, /スタメイトで参加申請/);
  assert.match(legal, /supercell\.com\/en\/fan-content-policy\/jp\//);
  assert.match(legal, /このコンテンツは非公式であり、Supercellによる承認を受けていません/);
  assert.match(launchKit, /YAPIMARU/);
  assert.match(launchKit, /米将軍/);
});

test("admin launch readiness exposes booleans without leaking configured values", async () => {
  const source = compact(await read("app/api/admin/readiness/route.ts"));
  assert.match(source, /requireAdmin\(\)/);
  assert.match(source, /TELECOM_SERVICES_CONFIRMED/);
  assert.match(source, /TELECOM_CONFIRMATION_REFERENCE/);
  for (const service of ["VALOMATCH", "STAMATE", "SHOENMATE"]) {
    assert.match(source, new RegExp(`${service}_SITE_URL`));
    assert.match(source, new RegExp(`${service}_X_URL`));
    assert.match(source, new RegExp(`${service}_PUBLIC_RELEASE_APPROVED`));
    assert.match(source, new RegExp(`${service}_APPROVAL_REFERENCE`));
  }
  assert.doesNotMatch(source, /value:process\.env/);
  assert.match(await read("app/admin/admin-panel.tsx"), /公開準備チェック/);
});

test("community safety rules and moderation appeals are publicly documented", async () => {
  const source = await read("app/community-guidelines/page.tsx");
  assert.match(source, /恋愛、異性交際、面会、性的な目的では利用できません/);
  assert.match(source, /18歳未満の利用者へ外部連絡先や面会を求めてはいけません/);
  assert.match(source, /通報された発言と確認に必要な前後の範囲だけを確認/);
  assert.match(source, /違反時の対応と異議申立て/);
  for (const page of ["app/legal/page.tsx", "app/terms/page.tsx", "app/privacy/page.tsx"])
    assert.match(await read(page), /community-guidelines/);
});

test("canonical public service routes preserve their own OAuth return path", async () => {
  const routes = [
    ["valomatch", "ValorantPreviewPage"],
    ["stamate", "BrawlPreview"],
    ["shoenmate", "IdentityPreview"],
  ];
  for (const [route, component] of routes) {
    const source = compact(await read(`app/${route}/page.tsx`));
    assert.match(source, new RegExp(`<${component}basePath="/${route}"/>`));
  }
  for (const page of ["valorant-preview", "brawl-preview", "identity-preview"]) {
    const source = await read(`app/${page}/page.tsx`);
    assert.match(source, /encodeURIComponent\(basePath\)/);
  }
  assert.equal(
    (await read("public/valomatch/riot.txt")).trim(),
    "24e56a35-28ce-467c-8f35-ff6ee089ffd2",
  );
});

test("public service portal exposes launch state and only allowlisted social links", async () => {
  const source = compact(await read("app/services/page.tsx"));
  for (const route of ["/valomatch", "/stamate", "/shoenmate"])
    assert.match(source, new RegExp(`href:"${route}"`));
  assert.match(source, /allowedHosts\.includes\(url\.hostname\)/);
  assert.match(source, /url\.protocol==="https:"/);
  assert.match(source, /恋愛・異性交際目的の利用を禁止/);
  assert.match(source, /公式サービスではありません/);
});

test("material terms updates require every existing service profile to consent again", async () => {
  const profileRoute = compact(
      await read("app/api/services/[service]/profile/route.ts"),
    ),
    gate = compact(await read("app/service-terms-gate.tsx")),
    config = await read("lib/service-config.ts");
  assert.match(profileRoute, /termsCurrent:/);
  assert.match(profileRoute, /row\.termsVersion===serviceConfig\[ctx\.service\]\.termsVersion/);
  assert.match(profileRoute, /exportasyncfunctionPATCH/);
  assert.match(profileRoute, /termsAcceptedAt:now/);
  assert.match(gate, /method:"PATCH"/);
  assert.match(gate, /更新された利用条件とプライバシーポリシーに同意します/);
  for (const service of ["valomatch", "stamate", "shoenmate"])
    assert.match(config, new RegExp(`${service}:\\{name:.*termsVersion:"2026-08-26-v2"`));
});

test("publishes a traceable privacy request process", async () => {
  const privacy = await read("app/privacy/page.tsx"),
    contact = await read("app/contact/page.tsx"),
    endpoint = await read("app/api/public-support/route.ts");
  assert.match(privacy, /開示等の請求手続/);
  assert.match(privacy, /受付番号/);
  assert.match(contact, /受付番号/);
  assert.match(endpoint, /ticketId: ticket\.id/);
});
