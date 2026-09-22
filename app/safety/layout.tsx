import AdSenseScript from "../adsense-script";

export default function SafetyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdSenseScript />
      {children}
    </>
  );
}
