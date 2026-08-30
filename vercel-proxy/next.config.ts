import type { NextConfig } from "next";

const upstream =
  process.env.YUNAMATCH_UPSTREAM_URL ||
  "https://unite-mate-jp.tomoki-ashizawa.chatgpt.site";
const serviceHomePath = process.env.SERVICE_HOME_PATH || "/";
const immutableStaticPaths = [
  "/_next/static/:path*",
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

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  async redirects() {
    return [
      ...(serviceHomePath !== "/"
        ? [
            {
              source: "/",
              destination: serviceHomePath,
              permanent: false as const,
            },
          ]
        : []),
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
      // These files are versioned or only changed through a deployment. Keep
      // API, HTML, service-worker and user-uploaded media on the no-store rule.
      ...immutableStaticPaths.map((source) => ({
        source,
        headers: immutableStaticHeaders,
      })),
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
