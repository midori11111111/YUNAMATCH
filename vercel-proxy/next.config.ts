import type { NextConfig } from "next";

const upstream =
  process.env.YUNAMATCH_UPSTREAM_URL ||
  "https://unite-mate-jp.tomoki-ashizawa.chatgpt.site";
const versionedStaticPaths = ["/_next/static/:path*"];
const publicAssetPaths = [
  "/brand/:path*",
  "/og.png",
  "/og-yunamatch-logo.png",
  "/og-comfey-zoroark.png",
  "/og-simple-comfey-zoroark.png",
  "/yunamatch-official-icon.png",
  "/yunamatch-official-icon-v2.png",
  "/yunamatch-official-icon.svg",
  "/yunamatch-official-icon-v2.svg",
  "/discord-server-icon.png",
  "/favicon.svg",
  "/ads.txt",
];

const immutableStaticHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=31536000, immutable",
  },
  {
    key: "CDN-Cache-Control",
    value: "public, s-maxage=31536000, immutable",
  },
  {
    key: "Vercel-CDN-Cache-Control",
    value: "public, s-maxage=31536000, immutable",
  },
];

const publicAssetHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=3600, stale-while-revalidate=604800",
  },
  {
    key: "CDN-Cache-Control",
    value: "public, s-maxage=86400, stale-while-revalidate=604800",
  },
  {
    key: "Vercel-CDN-Cache-Control",
    value: "public, s-maxage=86400, stale-while-revalidate=604800",
  },
];

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
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
      // Public logos may keep the same filename, so revalidate them quickly.
      // API, HTML, service-worker and user-uploaded media stay on no-store.
      ...publicAssetPaths.map((source) => ({
        source,
        headers: publicAssetHeaders,
      })),
      // Framework assets include a content hash and are safe to cache forever.
      ...versionedStaticPaths.map((source) => ({
        source,
        headers: immutableStaticHeaders,
      })),
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Fifth Match has its own public domain. Serve the existing shared
        // Shoenmate route without changing the address in the browser.
        ...["daigomatch.com", "www.daigomatch.com"].map((host) => ({
          source: "/",
          has: [{ type: "host" as const, value: host }],
          destination: `${upstream}/shoenmate`,
        })),
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
