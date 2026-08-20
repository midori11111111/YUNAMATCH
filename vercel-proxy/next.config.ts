import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  async rewrites() {
    return {
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
