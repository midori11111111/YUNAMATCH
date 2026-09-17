import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "第五マッチ｜ゲーム仲間探し",
  icons: { icon: "/daigomatch-icon.svg?rev=2" },
  description:
    "陣営・段位・得意な役割・遊べる時間帯から仲間を探す非公式コミュニティサービス。",
  openGraph: {
    title: "第五マッチ｜ゲーム仲間探し",
    description:
      "サバイバー・ハンター、段位、得意な役割、遊べる時間帯から一緒に遊ぶ仲間を探せます。",
    type: "website",
    url: "https://daigomatch.com/",
    images: [
      {
        url: "https://daigomatch.com/og-daigomatch.png?v=237",
        width: 1200,
        height: 630,
        alt: "第五マッチ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "第五マッチ｜ゲーム仲間探し",
    description:
      "サバイバー・ハンター、段位、得意な役割、遊べる時間帯から一緒に遊ぶ仲間を探せます。",
    images: ["https://daigomatch.com/og-daigomatch.png?v=237"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
