import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "V-MATCH（バロマッチ）｜Riot審査用プロトタイプ",
  description: "Riotアカウントのオプトインから仲間探し、マッチ後までを確認できる非公式LFGプロトタイプ。",
  robots: { index: false, follow: false },
  openGraph: {
    title: "V-MATCH（バロマッチ）｜Review Prototype",
    description: "An opt-in teammate discovery flow for VALORANT players.",
    images: [],
  },
  twitter: {
    title: "V-MATCH（バロマッチ）｜Review Prototype",
    description: "An opt-in teammate discovery flow for VALORANT players.",
    images: [],
  },
};

export default function ValorantPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
