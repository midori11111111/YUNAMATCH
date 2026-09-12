import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("serves Fifth Match on its own domain without an external redirect", async () => {
  const config = await read("vercel-proxy/next.config.ts");
  assert.match(config, /\["daigomatch\.com", "www\.daigomatch\.com"\]/);
  assert.match(config, /destination: `\$\{upstream\}\/shoenmate`/);
  assert.doesNotMatch(config, /SERVICE_HOME_PATH/);
});

test("publishes the AdSense ownership tag, loader, and ads.txt", async () => {
  const [layout, ads] = await Promise.all([read("app/layout.tsx"), read("public/ads.txt")]);
  assert.match(layout, /google-adsense-account/);
  assert.match(layout, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-2909796543320281/);
  assert.equal(ads.trim(), "google.com, pub-2909796543320281, DIRECT, f08c47fec0942fa0");
});
