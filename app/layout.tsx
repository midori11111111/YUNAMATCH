import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import VisitTracker from "./visit-tracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const adsensePublisherId = "ca-pub-2909796543320281";

function isFifthMatchHost(host: string | null) {
  const hostname = (host ?? "").split(":")[0].toLowerCase();
  return hostname === "daigomatch.com" || hostname === "www.daigomatch.com";
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "yunamatch.com";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const fifthMatchHost = isFifthMatchHost(host);
  const title = fifthMatchHost
    ? "第五マッチ｜ゲーム仲間探し"
    : "ユナマッチ｜相性でつながるユナイト仲間";
  const description = fifthMatchHost
    ? "サバイバー・ハンター、段位、得意な役割、遊べる時間帯から一緒に遊ぶ仲間を探せる非公式コミュニティサービス。"
    : "使用ポケモンと実力からメイトを探し、プレイ申請・承認で一緒にユナイトできるファンメイドサービス。";
  const socialImage = fifthMatchHost
    ? "https://daigomatch.com/og-daigomatch.png?v=237"
    : new URL("/og-yunamatch-logo.png", base).toString();

  return {
    metadataBase: base,
    title,
    description,
    icons: {
      icon: fifthMatchHost ? "/daigomatch-icon.svg?rev=2" : "/favicon.svg",
      shortcut: fifthMatchHost ? "/daigomatch-icon.svg?rev=2" : "/favicon.svg",
      apple: fifthMatchHost ? "/daigomatch-icon.svg?rev=2" : "/yunamatch-official-icon-v2.png",
    },
    manifest:"/manifest.webmanifest",
    appleWebApp:{capable:true,statusBarStyle:"default",title:fifthMatchHost ? "第五マッチ" : "ユナマッチ"},
    other: fifthMatchHost
      ? { "google-adsense-account": adsensePublisherId }
      : undefined,
    openGraph: { title, description, type: "website", url: fifthMatchHost ? "https://daigomatch.com/" : base, images: [{ url: socialImage, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const fifthMatchHost = isFifthMatchHost(host);

  return (
    <html lang="ja">
      <head>
        {fifthMatchHost ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsensePublisherId}`}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <VisitTracker />
        {children}
      </body>
    </html>
  );
}
