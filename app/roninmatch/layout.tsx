import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "浪マッチ｜同じ一年を走る勉強仲間探し",
  description:
    "志望校、現在の模試判定、科目、勉強できる時間から、浪人生活を一緒に走る勉強仲間を探せます。",
  openGraph: {
    title: "浪マッチ｜同じ一年を走る勉強仲間探し",
    description:
      "志望校、模試判定、科目、勉強時間から勉強仲間を探すサービスです。",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "浪マッチ｜同じ一年を走る勉強仲間探し",
    description:
      "志望校、模試判定、科目、勉強時間から勉強仲間を探すサービスです。",
    images: [],
  },
};

export default function RoninMatchLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
