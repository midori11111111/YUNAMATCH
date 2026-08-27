import type { Metadata } from "next";
import "./login.css";

export const metadata: Metadata = {
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
