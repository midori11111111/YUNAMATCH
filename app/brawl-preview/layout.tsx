import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "スタメイト｜ブロスタ仲間探し",
  description:
    "トロフィー・得意ロール・遊べる時間帯からブロスタ仲間を探す非公式コミュニティサービス",
  icons: {
    icon: "/brand/stamate-mark.svg",
    apple: "/brand/stamate-social-avatar.png",
  },
  openGraph: {
    title: "スタメイト｜ブロスタ仲間探し",
    description:
      "トロフィー・得意ロール・遊べる時間帯からブロスタ仲間を探す非公式コミュニティサービス",
    images: [
      {
        url: "/brand/stamate-og.png",
        width: 1200,
        height: 630,
        alt: "スタメイト",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/brand/stamate-og.png"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
