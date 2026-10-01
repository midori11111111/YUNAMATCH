import Link from "next/link";

export const metadata = {
  title: "ページが見つかりません｜第五マッチ",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="legalPage">
      <section>
        <p>404</p>
        <h1>ページが見つかりません</h1>
        <p className="legalLead">URLが変更されたか、ページが削除された可能性があります。</p>
        <nav className="legalNav" aria-label="移動先">
          <Link href="/">第五マッチへ戻る</Link>
          <Link href="/guide">使い方ガイド</Link>
          <Link href="/contact">お問い合わせ</Link>
        </nav>
      </section>
    </main>
  );
}
