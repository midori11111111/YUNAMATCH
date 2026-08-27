import type { Metadata } from "next";
import "./login.css";

const isStamate = process.env.SITE_VARIANT === "stamate";

export const metadata: Metadata = isStamate
  ? {
      title: "ログイン | スタメイト",
      description: "スタメイトへログイン",
      icons: { icon: "/brand/stamate-mark.svg", apple: "/brand/stamate-social-avatar.png" },
    }
  : {
      title: "ログイン | YUNAMATCH",
      description: "YUNAMATCHへログイン",
    };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
