import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/shoenmate-profile.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { shoenmateCharacterGroups, shoenmateCharacterSet, shoenmateTiers, normalizeShoenmateTier, shoenmateTierDatabaseValues, matchesShoenmateRole, toggleShoenmateSide, toggleShoenmateSurvivorRole, shoenmateRoleLabel } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("Fifth Match separates both factions and keeps character names unique", () => {
  assert.deepEqual(shoenmateCharacterGroups.map(group => group.label), ["サバイバー", "ハンター"]);
  assert.equal(shoenmateCharacterSet.size, shoenmateCharacterGroups.flatMap(group => group.names).length);
  assert.ok(shoenmateCharacterSet.has("傭兵"));
  assert.ok(shoenmateCharacterSet.has("血の女王"));
});
test("survivor subroles preserve old profiles and support both factions", () => {
  assert.equal(matchesShoenmateRole(["救助"], "サバイバー"), true);
  assert.equal(matchesShoenmateRole(["解読"], "サバイバー"), true);
  assert.equal(matchesShoenmateRole(["ハンター"], "サバイバー"), false);
  assert.equal(matchesShoenmateRole(["救助"], "牽制"), false);
  assert.equal(shoenmateRoleLabel("救助"), "サバイバー（救助）");
  assert.deepEqual(toggleShoenmateSide(["指定なし"], "サバイバー"), ["サバイバー"]);
  assert.deepEqual(toggleShoenmateSide(["救助"], "ハンター"), ["救助", "ハンター"]);
  assert.deepEqual(toggleShoenmateSide(["救助", "解読", "ハンター"], "サバイバー"), ["ハンター"]);
  assert.deepEqual(toggleShoenmateSurvivorRole(["サバイバー", "ハンター"], "救助"), ["ハンター", "救助"]);
  assert.deepEqual(toggleShoenmateSurvivorRole(["救助", "ハンター"], "救助"), ["ハンター", "サバイバー"]);
  assert.deepEqual(toggleShoenmateSurvivorRole(["解読"], "補助"), ["解読", "補助"]);
});
test("Fifth Match exposes all seven tiers plus Peak Tier VII for both factions", () => {
  assert.deepEqual(shoenmateTiers, [
    "未設定",
    ...Array.from({ length: 7 }, (_, index) => `サバイバー${index + 1}段`),
    "サバイバー最高峰7段",
    ...Array.from({ length: 7 }, (_, index) => `ハンター${index + 1}段`),
    "ハンター最高峰7段",
  ]);
});
test("legacy six-plus profiles stay visible as tier six", () => {
  assert.equal(normalizeShoenmateTier("サバイバー6段以上"), "サバイバー6段");
  assert.equal(normalizeShoenmateTier("ハンター6段以上"), "ハンター6段");
  assert.deepEqual(shoenmateTierDatabaseValues("サバイバー6段"), ["サバイバー6段", "サバイバー6段以上"]);
});
