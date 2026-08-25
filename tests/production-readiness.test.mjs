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
