function fifthMatchManifest() {
  return {
    id: "/",
    name: "第五マッチ｜第五人格のゲーム仲間探し",
    short_name: "第五マッチ",
    description: "段位、役割、使用キャラ、活動時間から第五人格のゲーム仲間を探せる非公式コミュニティサービス",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f0e9",
    theme_color: "#8e2943",
    icons: [{ src: "/brand/shoenmate-social-avatar.png", sizes: "1024x1024", type: "image/png", purpose: "any maskable" }],
  };
}

function yunamatchManifest() {
  return {
    id: "/",
    name: "YUNAMATCH｜ユナマッチ",
    short_name: "ユナマッチ",
    description: "相性のいポケモンユナイト仲間を探して、そのまま一緒に遊べるサービス",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f5ff",
    theme_color: "#7257e8",
    icons: [{ src: "/yunamatch-official-icon-v2.png", sizes: "1024x1024", type: "image/png", purpose: "any maskable" }],
  };
}

export function GET(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const body = hostname === "daigomatch.com" || hostname === "www.daigomatch.com"
    ? fifthMatchManifest()
    : yunamatchManifest();
  return Response.json(body, { headers: { "cache-control": "public, max-age=3600" } });
}
