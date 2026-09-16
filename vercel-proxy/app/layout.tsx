import type { Metadata } from "next";
import { headers } from "next/headers";
import { gatewayBrandForHost } from "@/lib/gateway-brand";
import "./login.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const brand = gatewayBrandForHost(
    requestHeaders.get("host") ?? requestHeaders.get("x-forwarded-host"),
  );
  return { title: brand.title, description: brand.description };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
