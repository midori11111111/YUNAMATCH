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
    "serviceReports",
    "serviceBlocks",
    "serviceAdminAuditLogs",
  ]) {
    assert.match(source, new RegExp(`${table}:`));
    assert.match(source, new RegExp(`db\\.select\\(\\)\\.from\\(${table}\\)`));
  }
  assert.match(source, /schemaVersion:4/);
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

test("service Discord links are allowlisted and hidden until configured", async () => {
  const source = compact(await read("app/service-discord-link.tsx"));
  assert.match(source, /url\.protocol==="https:"/);
  assert.match(source, /url\.hostname==="discord\.gg"/);
  assert.match(source, /url\.hostname==="discord\.com"/);
  assert.match(source, /url\.pathname\.startsWith\("\/invite\/"\)/);
  assert.match(source, /if\(!isDiscordInviteUrl\(url\)\)returnnull/);
  for (const page of ["valorant-preview", "brawl-preview", "identity-preview"]) {
    assert.match(await read(`app/${page}/page.tsx`), /<ServiceDiscordLink service=/);
  }
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
