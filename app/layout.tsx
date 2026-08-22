import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "yunamatch.com";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const title = "ユナマッチ｜相性でつながるユナイト仲間";
  const description = "使用ポケモンと実力からメイトを探し、プレイ申請・承認で一緒にユナイトできるファンメイドサービス。";
  const socialImage = new URL("/og-simple-comfey-zoroark.png", base).toString();

  return {
    metadataBase: base,
    title,
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
      apple: "/yunamatch-official-icon-v2.png",
    },
    manifest:"/manifest.webmanifest",
    appleWebApp:{capable:true,statusBarStyle:"default",title:"ユナマッチ"},
    openGraph: { title, description, type: "website", images: [{ url: socialImage, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";

  // The original Sites URL is still present in old bookmarks and shared posts.
  // Authentication lives on the public custom domain, so move legacy visitors
  // before they can hit a relative /login or /api/auth URL that does not exist
  // on the Sites origin.
  if (forwardedHost.endsWith(".chatgpt.site")) {
    redirect("https://yunamatch.com/");
  }

  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <VisitTracker />
        {children}
      </body>
    </html>
  );
}
