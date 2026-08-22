import type { NextConfig } from "next";

const upstream =
  process.env.YUNAMATCH_UPSTREAM_URL ||
  "https://unite-mate-jp.tomoki-ashizawa.chatgpt.site";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "yunamatch.vercel.app" }],
        destination: "https://yunamatch.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/_next/static/css/:path*",
          destination: `${upstream}/_next/static/css/:path*`,
        },
        {
          source: "/_next/static/_vinext_fonts/:path*",
          destination: `${upstream}/_next/static/_vinext_fonts/:path*`,
        },
        {
          source: "/_next/static/chunks/:path*",
          destination: `${upstream}/_next/static/chunks/:path*`,
        },
      ],
      fallback: [
        {
          source: "/:path*",
          destination: `${upstream}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
