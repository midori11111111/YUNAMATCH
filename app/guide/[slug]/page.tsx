import Link from "next/link";
import { notFound } from "next/navigation";
import { findShoenmateGuide, shoenmateGuides } from "../../../lib/shoenmate-guides";
import styles from "../guide.module.css";

const guideExamples: Record<string, string> = {
  "rank-party": "21時からランク戦を3試合。サバイバー5段、VCは聴き専可。連敗したら一度休憩します。",
  "survivor-roles": "普段は牽制担当です。編成次第で救助もできます。救助順は開始前に相談します。",
  "hunter-practice": "30分だけ月の河公園でチェイス練習。アドバイスは終了後に一つずつ交換します。",
  "profile-writing": "平日21時以降。サバイバー中心でVCはどちらでも可。初回は3試合ほど希望です。",
  "recruit-writing": "22時からランク戦3試合、救助担当1人募集。VCなし、チャットで相談できます。",
  "voice-chat": "VCは試合中の位置報告のみ。雑談なし・聴き専可・録音配信なし、と先に共有します。",
  "first-session": "初回はマルチ戦を2試合だけ遊び、終了時刻になったら継続するか双方で確認します。",
  "team-composition": "牽制2・救助1・補助1を仮置きし、マップを見て使用キャラを調整します。",
  "schedule-sharing": "火・木の21〜23時、ランク戦中心。今週だけ難しい日は募集を停止します。",
  "match-review": "試合後は『良かった連携1つ』『次に変える点1つ』だけ共有します。",
  "trouble-response": "不快な要求には返信せず、画面を閉じて通報・ブロックします。",
  "returning-player": "復帰直後なのでマルチ戦から。現在と以前の最高段位を分けて書きます。",
};

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
    <header className={styles.hero}><small>{guide.label}</small><h1>{guide.title}</h1><p>{guide.description}</p><p className={styles.byline}>第五マッチ編集部 / 最終更新 2026年10月1日</p></header>
    <section className={styles.steps}>{guide.sections.map((section) => <section className={styles.step} key={section.heading}><div><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.points && <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>}</div></section>)}</section>
    <section className={styles.section}><small>PRACTICAL EXAMPLE</small><h2>そのまま使える例</h2><p>{guideExamples[guide.slug]}</p></section>
    <section className={styles.section}><small>EDITORIAL NOTE</small><h2>この記事の作り方</h2><p>第五マッチの募集項目と、仲間探しで起きやすい条件の食い違いをもとに、運営が独自に整理した解説です。ゲーム内の仕様や段位は変更される場合があるため、最新情報はゲーム内でも確認してください。</p></section>
    <section className={styles.section}><small>NEXT GUIDE</small><h2>他のガイドも読む</h2><ul>{shoenmateGuides.filter(({ slug }) => slug !== guide.slug).slice(0, 4).map((item) => <li key={item.slug}><Link href={`/guide/${item.slug}`}>{item.title}</Link></li>)}</ul></section>
    <p className={styles.terms}>第五マッチは第五人格のゲーム仲間探し専用です。恋愛、異性交際、面会、性的目的では利用できません。</p>
  </article></main>;
}
