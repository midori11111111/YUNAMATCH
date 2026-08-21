import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "YUNAMATCH｜ユナマッチ",
    short_name: "ユナマッチ",
    description: "相性のいいポケモンユナイト仲間を探して、そのまま一緒に遊べるサービス",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f5ff",
    theme_color: "#7257e8",
    icons: [
      {
        src: "/yunamatch-official-icon-v2.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/yunamatch-official-icon-v2.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
