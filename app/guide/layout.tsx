import AdSenseScript from "../adsense-script";

export const metadata = {
  other: { "google-adsense-account": "ca-pub-2909796543320281" },
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdSenseScript />
      {children}
    </>
  );
}
