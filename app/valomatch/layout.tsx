import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "バロマッチ｜VALORANT仲間探し",
  description:
    "ランク・役割・遊べる時間帯からVALORANT仲間を探す非公式コミュニティサービス。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
