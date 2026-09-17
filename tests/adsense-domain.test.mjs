import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("serves Fifth Match on its own domain without an external redirect", async () => {
  const [config, auth, login, brand] = await Promise.all([
    read("vercel-proxy/next.config.ts"),
    read("vercel-proxy/auth.ts"),
    read("vercel-proxy/app/login/page.tsx"),
    read("vercel-proxy/lib/gateway-brand.ts"),
  ]);
  assert.match(config, /\["daigomatch\.com", "www\.daigomatch\.com"\]/);
  assert.match(config, /destination: `\$\{upstream\}\/shoenmate`/);
  assert.doesNotMatch(config, /SERVICE_HOME_PATH/);
  assert.match(auth, /trustHost: true/);
  assert.match(login, /gatewayBrandForHost/);
  assert.match(brand, /daigomatch\.com/);
  assert.match(brand, /第五マッチ/);
});

test("limits the AdSense ownership tag and loader to Fifth Match", async () => {
  const [layout, ads] = await Promise.all([read("app/layout.tsx"), read("public/ads.txt")]);
  assert.match(layout, /hostname === "daigomatch\.com"/);
  assert.match(layout, /hostname === "www\.daigomatch\.com"/);
  assert.match(layout, /fifthMatchHost\s*\?\s*\{ "google-adsense-account"/);
  assert.match(layout, /\{fifthMatchHost \? \(/);
  assert.match(layout, /google-adsense-account/);
  assert.match(layout, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=/);
  assert.equal(ads.trim(), "google.com, pub-2909796543320281, DIRECT, f08c47fec0942fa0");
});

test("shares Fifth Match with its own title, copy, and social card", async () => {
  const [rootLayout, fifthLayout, socialCard] = await Promise.all([
    read("app/layout.tsx"),
    read("app/shoenmate/layout.tsx"),
    read("public/og-daigomatch.png"),
  ]);
  assert.match(rootLayout, /fifthMatchHost[\s\S]*第五マッチ｜ゲーム仲間探し/);
  assert.match(rootLayout, /https:\/\/daigomatch\.com\/og-daigomatch\.png\?v=237/);
  assert.match(fifthLayout, /openGraph/);
  assert.match(fifthLayout, /twitter/);
  assert.match(fifthLayout, /og-daigomatch\.png\?v=237/);
  assert.ok(socialCard.length > 10_000);
});

test("returns Fifth Match logins to daigomatch without changing provider callbacks", async () => {
  const [loginRoute, bridgeRoute, handoffRoute, fifthMatchPage] = await Promise.all([
    read("vercel-proxy/app/api/login/[provider]/route.ts"),
    read("app/api/domain-auth-bridge/route.ts"),
    read("vercel-proxy/app/api/domain-auth-handoff/route.ts"),
    read("app/identity-preview/page.tsx"),
  ]);
  assert.match(loginRoute, /fifthMatchHosts/);
  assert.match(loginRoute, /\/api\/domain-auth-bridge/);
  assert.match(loginRoute, /https:\/\/yunamatch\.com/);
  assert.match(loginRoute, /searchParams\.get\("service"\)===\"shoenmate\"/);
  assert.match(fifthMatchPage, /service=shoenmate/);
  assert.match(bridgeRoute, /ALLOWED_TARGETS/);
  assert.match(bridgeRoute, /encode\(/);
  assert.match(bridgeRoute, /referrer-policy/);
  assert.match(bridgeRoute, /form-action https:\/\/\$\{target\}/);
  assert.match(handoffRoute, /decode\(/);
  assert.match(handoffRoute, /__Secure-authjs\.session-token/);
  assert.match(handoffRoute, /sameSite: "lax"/);
  assert.match(handoffRoute, /Response\.redirect/);
});
