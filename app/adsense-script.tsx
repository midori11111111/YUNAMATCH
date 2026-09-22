import { headers } from "next/headers";

const adsensePublisherId = "ca-pub-2909796543320281";

export default async function AdSenseScript() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const hostname = host.split(":")[0].toLowerCase();
  const isFifthMatch = hostname === "daigomatch.com" || hostname === "www.daigomatch.com";

  if (!isFifthMatch) return null;

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsensePublisherId}`}
      crossOrigin="anonymous"
    />
  );
}
