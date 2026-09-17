import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Fifth Match offers game-specific discovery filters and a reversible hold list", async () => {
  const [page, discover] = await Promise.all([
    read("app/identity-preview/page.tsx"),
    read("app/api/services/[service]/discover/route.ts"),
  ]);
  assert.match(page, /type DiscoverMode = "recommended" \| "received" \| "skipped"/);
  assert.match(page, /shoenmate-skipped/);
  assert.match(page, /よく使うキャラ/);
  assert.match(page, /オンライン中/);
  assert.match(discover, /searchParams\.get\("character"\)/);
  assert.match(discover, /searchParams\.get\("activity"\)/);
  assert.match(discover, /gte\(serviceProfiles\.updatedAt/);
});

test("Fifth Match keeps recruitment details and pending chats clearly separated", async () => {
  const page = await read("app/identity-preview/page.tsx");
  assert.match(page, /募集の詳細を見る/);
  assert.match(page, /recruitDetailDialog/);
  assert.match(page, /<h2>申請待ち<\/h2>/);
  assert.match(page, /<h2>チャット<\/h2>/);
  for (const label of ["探す", "募集", "やりとり", "ロビー", "マイページ"])
    assert.match(page, new RegExp(`"${label}"`));
});

test("opening a Fifth Match profile refreshes its activity without a write storm", async () => {
  const profile = await read("app/api/services/[service]/profile/route.ts");
  assert.match(profile, /ctx\.service === "shoenmate"/);
  assert.match(profile, /> 60_000/);
  assert.match(profile, /set\(\{ updatedAt: now \}\)/);
});

test("Fifth Match profile cards support previous and next navigation without discarding people", async () => {
  const page = await read("app/identity-preview/page.tsx");
  assert.match(page, /const \[currentIndex, setCurrentIndex\] = useState\(0\)/);
  assert.match(page, /aria-label="前の人を見る"/);
  assert.match(page, /aria-label="次の人を見る"/);
  assert.match(page, /moveProfile\(touch\.clientX < start\.x \? 1 : -1\)/);
  assert.doesNotMatch(page, /onTouchEnd=.*skipCurrent\(\)/);
});

test("Fifth Match uses the upper card for navigation and the lower card for details", async () => {
  const page = await read("app/identity-preview/page.tsx");
  assert.match(page, /<div className=\{styles\.portrait\} aria-hidden="true">/);
  assert.match(page, /MAIN CHARACTER/);
  assert.match(page, /current\.characters\?\.\[0\] \|\| "使用キャラ未設定"/);
  assert.match(page, /data-card-detail/);
  assert.match(page, /className=\{styles\.profileSummary\}/);
  assert.match(page, /aria-label=\{`\$\{current\.displayName\}のプロフィール詳細を見る`\}/);
  assert.match(page, /<p className=\{styles\.cardBio\}>/);
  assert.match(page, /aria-label="前の人を見る"/);
  assert.match(page, /aria-label="次の人を見る"/);
  assert.doesNotMatch(page, /className=\{styles\.portrait\}[^>]*setDetailProfile/);
});

test("Fifth Match exposes Discord and a four-step tutorial beside discovery", async () => {
  const page = await read("app/identity-preview/page.tsx");
  assert.match(page, /shoenmateDiscordUrl/);
  assert.match(page, /aria-label="第五マッチの使い方を見る"/);
  assert.match(page, /MANOR GUIDE · \{tutorialStep \+ 1\}\/4/);
  for (const label of ["仲間を見つける", "マッチして話す", "募集に参加する", "Discordでも集まる"])
    assert.match(page, new RegExp(label));
});

test("Fifth Match chat shows the other player, activity and reactions", async () => {
  const [page, connections, reactions] = await Promise.all([
    read("app/identity-preview/page.tsx"),
    read("app/api/services/[service]/connections/route.ts"),
    read("app/api/services/[service]/message-reactions/route.ts"),
  ]);
  assert.match(page, /className=\{styles\.chatAccount\}/);
  assert.match(page, /activityLabel\(activeChat\.other\.updatedAt\)/);
  assert.match(page, /reactToMessage/);
  assert.match(page, /\["👍", "❤️", "😂", "🎭"\]/);
  assert.match(connections, /updatedAt: other\.updatedAt/);
  assert.match(reactions, /"🎭"/);
});

test("Fifth Match My Page includes completion, stats, history and safety sections", async () => {
  const page = await read("app/identity-preview/page.tsx");
  assert.match(page, /profileCompletion/);
  assert.match(page, /MATCH HISTORY/);
  assert.match(page, /マッチした人/);
  assert.match(page, /COMMUNITY/);
  assert.match(page, /SAFETY &amp; ACCOUNT/);
});
