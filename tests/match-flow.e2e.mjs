import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = join(root, "node_modules", ".bin", "wrangler");
const temporary = await mkdtemp(join(tmpdir(), "yunamatch-e2e-"));
const state = join(temporary, "state");
const config = join(temporary, "wrangler.json");
const port = 8799;
const base = `http://127.0.0.1:${port}`;

const configBody = {
  name: "yunamatch-match-flow-test",
  main: join(root, "dist", "server", "index.js"),
  compatibility_date: "2026-05-15",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [{ binding: "DB", database_name: "yunamatch-e2e", database_id: "00000000-0000-4000-8000-000000000000" }],
  r2_buckets: [{ binding: "MEDIA", bucket_name: "yunamatch-e2e-media" }],
  assets: { directory: join(root, "dist", "client"), binding: "ASSETS" },
};

function run(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(wrangler, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolvePromise(output) : reject(new Error(output)));
  });
}

function userHeaders(id, email) {
  return { "oai-authenticated-user-id": id, "oai-authenticated-user-email": email };
}

async function api(path, { user, method = "GET", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(user ?? {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json();
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${base}/`)).ok) return; } catch { /* 起動完了まで再試行する */ }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("ローカルテストサーバーを起動できませんでした");
}

let server;
try {
  await writeFile(config, JSON.stringify(configBody));
  const migrations = (await readdir(join(root, "drizzle"))).filter((name) => name.endsWith(".sql")).sort();
  for (const migration of migrations) {
    await run(["d1", "execute", "yunamatch-e2e", "--local", "--config", config, "--persist-to", state, "--file", join(root, "drizzle", migration)]);
  }

  server = spawn(wrangler, ["dev", "--local", "--config", config, "--persist-to", state, "--ip", "127.0.0.1", "--port", String(port)], { cwd: root, stdio: "ignore" });
  await waitForServer();

  const owner = userHeaders("e2e-owner", "owner@example.test");
  const applicant = userHeaders("e2e-applicant", "applicant@example.test");
  const cancelTester = userHeaders("e2e-cancel", "cancel@example.test");
  const profile = (trainerName, pokemon, gender, contact) => ({ trainerName, mainPokemon: [pokemon], highestRate: "マスター 1400〜1599", playTime: ["平日 夜（18〜22時）"], gender, contact, avatarUrl: "", ageConfirmed: true, termsAccepted: true });
  await api("/api/profile", { user: owner, method: "PUT", body: profile("募集テスター", "ゲッコウガ", "男性", "Discord: owner-test") });
  await api("/api/profile", { user: applicant, method: "PUT", body: profile("申請テスター", "ハピナス", "女性", "Discord: applicant-test") });
  await api("/api/profile", { user: cancelTester, method: "PUT", body: profile("取消テスター", "ピカチュウ", "男性", "Discord: cancel-test") });

  const undecided = await api("/api/recruits", { user: cancelTester, method: "POST", body: { pokemon: "ピカチュウ", roles: ["下レーン"], matches: 800, winRate: 52, startsIn: "undecided", duration: 1, partySize: 2, desiredPokemon: "すべて", desiredRole: "指定なし", note: "時間相談" } });
  assert.equal(undecided.recruit.startTimeUndecided, true);
  await api("/api/recruits", { user: cancelTester, method: "PATCH", body: { recruitId: undecided.recruit.id, action: "cancel" } });
  const afterCancel = await api("/api/recruits", { user: applicant });
  assert.equal(afterCancel.recruits.some((row) => row.id === undecided.recruit.id), false);

  const created = await api("/api/recruits", { user: owner, method: "POST", body: { pokemon: "ゲッコウガ", role: "スピード型", matches: 1200, winRate: 54.5, startsIn: 0, duration: 1, partySize: 2, desiredPokemon: "ハピナス", desiredRole: "サポート型", note: "通しテスト" } });
  const listed = await api("/api/recruits", { user: applicant });
  assert.equal(listed.recruits[0].id, created.recruit.id);

  await api("/api/applications", { user: applicant, method: "POST", body: { recruitId: created.recruit.id, pokemon: "ハピナス", message: "参加します" } });
  const notices = await api("/api/applications", { user: owner });
  assert.equal(notices.incoming.length, 1);
  assert.equal(notices.incoming[0].message, "参加します");
  const pendingOutgoing = await api("/api/applications", { user: applicant });
  assert.equal(pendingOutgoing.outgoing[0].status, "pending");
  assert.equal(pendingOutgoing.outgoing[0].message, "参加します");
  const accepted = await api("/api/applications", { user: owner, method: "PATCH", body: { applicationId: notices.incoming[0].id, action: "accept" } });
  assert.ok(accepted.lobbyId);
  assert.equal(accepted.applicantContact, null);
  assert.equal(accepted.mateName, "申請テスター");
  assert.equal(accepted.matePokemon, "ハピナス");

  let ownerConnections = await api("/api/connections", { user: owner });
  let applicantConnections = await api("/api/connections", { user: applicant });
  assert.equal(ownerConnections.connections.length, 1);
  assert.equal(applicantConnections.connections.length, 1);
  assert.equal(ownerConnections.connections[0].latestMessage, "👋 参加します");
  assert.equal(applicantConnections.connections[0].latestMessage, "👋 参加します");
  assert.equal(ownerConnections.connections[0].mateContact, null);
  assert.equal(applicantConnections.connections[0].mateContact, null);
  const connectionId = ownerConnections.connections[0].id;
  const greetingThread = await api(`/api/messages?connectionId=${connectionId}`, { user: owner });
  assert.equal(greetingThread.messages[0].body, "👋 参加します");
  assert.equal(greetingThread.messages[0].sender, "mate");

  await api("/api/connections", { user: owner, method: "PATCH", body: { connectionId, action: "share_contact" } });
  applicantConnections = await api("/api/connections", { user: applicant });
  assert.equal(applicantConnections.connections[0].mateContact, "Discord: owner-test");
  await api("/api/connections", { user: applicant, method: "PATCH", body: { connectionId, action: "share_contact" } });
  ownerConnections = await api("/api/connections", { user: owner });
  assert.equal(ownerConnections.connections[0].mateContact, "Discord: applicant-test");
  await api("/api/connections", { user: owner, method: "PATCH", body: { connectionId, action: "share_contact" } });
  applicantConnections = await api("/api/connections", { user: applicant });
  assert.equal(applicantConnections.connections[0].mateContact, null);

  const prohibitedMessage = await fetch(`${base}/api/messages`, { method: "POST", headers: { ...applicant, "content-type": "application/json" }, body: JSON.stringify({ connectionId, body: "リアルで会おう" }) });
  assert.equal(prohibitedMessage.status, 400);
  await api("/api/messages", { user: applicant, method: "POST", body: { connectionId, body: "よろしくお願いします" } });
  const thread = await api(`/api/messages?connectionId=${connectionId}`, { user: owner });
  assert.equal(thread.messages.at(-1).body, "よろしくお願いします");

  const played = await api("/api/connections", { user: owner, method: "PATCH", body: { connectionId, action: "played" } });
  assert.equal(played.playedByMe, true);
  const applicantAfterPlay = await api("/api/connections", { user: applicant });
  assert.equal(applicantAfterPlay.connections[0].playedByMate, true);

  await api("/api/safety", { user: owner, method: "POST", body: { action: "block", connectionId } });
  const hiddenConnections = await api("/api/connections", { user: owner });
  assert.equal(hiddenConnections.connections.length, 0);
  const blockedMessage = await fetch(`${base}/api/messages`, { method: "POST", headers: { ...applicant, "content-type": "application/json" }, body: JSON.stringify({ connectionId, body: "届かないメッセージ" }) });
  assert.equal(blockedMessage.status, 403);

  const support = await api("/api/support", { user: owner, method: "POST", body: { category: "不具合", message: "通しテストのお問い合わせです" } });
  assert.ok(support.ticketId);
  await api("/api/profile", { user: owner, method: "DELETE", body: { confirmation: "退会する" } });
  const deletedProfile = await api("/api/profile", { user: owner });
  assert.equal(deletedProfile.profile, null);
  const connectionsAfterDeletion = await api("/api/connections", { user: applicant });
  assert.equal(connectionsAfterDeletion.connections.length, 0);

  console.log("✓ 登録→時間相談募集→募集キャンセル→申請→承認→チャット→プレイ完了→NGワード→ブロック→問い合わせ→退会を確認しました");
} finally {
  if (server) server.kill("SIGTERM");
  await rm(temporary, { recursive: true, force: true });
}
