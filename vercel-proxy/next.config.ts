import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/_next/static/css/:path*",
          destination:
            "https://unite-mate-jp.tomoki-ashizawa.chatgpt.site/_next/static/css/:path*",
        },
        {
          source: "/_next/static/_vinext_fonts/:path*",
          destination:
            "https://unite-mate-jp.tomoki-ashizawa.chatgpt.site/_next/static/_vinext_fonts/:path*",
        },
        ...[
          "index",
          "framework",
          "layout-segment-context",
          "match-app",
          "rolldown-runtime",
        ].map((name) => ({
          source: `/_next/static/chunks/${name}-:hash.js`,
          destination: `https://unite-mate-jp.tomoki-ashizawa.chatgpt.site/_next/static/chunks/${name}-:hash.js`,
        })),
      ],
      fallback: [
        {
          source: "/:path*",
          destination:
            "https://unite-mate-jp.tomoki-ashizawa.chatgpt.site/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
