import AdSenseScript from "../adsense-script";

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdSenseScript />
      {children}
    </>
  );
}
