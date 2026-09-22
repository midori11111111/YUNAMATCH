import Link from "next/link";
import { notFound } from "next/navigation";
import { findShoenmateGuide, shoenmateGuides } from "../../../lib/shoenmate-guides";
import styles from "../guide.module.css";

export function generateStaticParams() {
  return shoenmateGuides.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const guide = findShoenmateGuide((await params).slug);
  return guide ? { title: `${guide.title}｜第五マッチ`, description: guide.description } : {};
}

export default async function ShoenmateGuideArticle({ params }: { params: Promise<{ slug: string }> }) {
  const guide = findShoenmateGuide((await params).slug);
  if (!guide) notFound();
  return <main className={styles.page}><article className={styles.wrap}>
    <nav className={styles.nav}><Link href="/guide">使い方ガイドへ戻る</Link><Link href="/">プレイヤー名簿</Link><Link href="/safety">安全ガイド</Link></nav>
    <header className={styles.hero}><small>{guide.label}</small><h1>{guide.title}</h1><p>{guide.description}</p></header>
    <section className={styles.steps}>{guide.sections.map((section) => <section className={styles.step} key={section.heading}><div><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.points && <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>}</div></section>)}</section>
    <section className={styles.section}><small>NEXT GUIDE</small><h2>他のガイドも読む</h2><ul>{shoenmateGuides.filter(({ slug }) => slug !== guide.slug).slice(0, 4).map((item) => <li key={item.slug}><Link href={`/guide/${item.slug}`}>{item.title}</Link></li>)}</ul></section>
    <p className={styles.terms}>第五マッチは第五人格のゲーム仲間探し専用です。恋愛、異性交際、面会、性的目的では利用できません。</p>
  </article></main>;
}
