import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "第五マッチ｜ゲーム仲間探し",
  icons: { icon: "/daigomatch-icon.svg?rev=2" },
  description:
    "陣営・段位・得意な役割・遊べる時間帯から仲間を探す非公式コミュニティサービス。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
