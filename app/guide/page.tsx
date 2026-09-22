import Link from "next/link";
import styles from "./guide.module.css";

export const metadata = {
  title: "第五マッチの使い方｜第五人格のゲーム仲間探し",
  description: "第五マッチで仲間を探し、募集し、マッチ後に相談するまでの使い方を説明します。",
};

export default function GuidePage() {
  return <main className={styles.page}><div className={styles.wrap}>
    <nav className={styles.nav}><Link href="/">第五マッチへ戻る</Link><Link href="/safety">安全ガイド</Link><Link href="/legal?service=shoenmate">運営・安全方針</Link><Link href="/contact">お問い合わせ</Link></nav>
    <header className={styles.hero}><small>HOW TO USE</small><h1>段位と役割から、<br/>遊ぶ仲間を見つける。</h1><p>第五マッチは、プレイヤー名簿と募集掲示板を使って、ランク戦やマルチ戦を一緒に遊ぶ仲間を探すサービスです。登録前でも公開中の名簿と募集を確認できます。</p></header>
    <section className={styles.steps}>
      <article className={styles.step}><div><h2>名簿から探す</h2><p>サバイバー／ハンター、段位、救助・牽制・補助・解読などの役割、よく使うキャラで絞り込みます。カード上部の左右で前後のプレイヤーへ移動し、下部から詳細を確認できます。</p></div></article>
      <article className={styles.step}><div><h2>気になる・一緒に遊ぶ</h2><p>「気になる」は、相手へ関心があることを伝える機能です。お互いが選ぶとマッチします。「一緒に遊ぶ」は、今すぐ相談したい相手へ直接送る申請で、承認後にチャットが開きます。</p></div></article>
      <article className={styles.step}><div><h2>募集から合流する</h2><p>ランク戦、マルチ戦、協力狩りなどのモードと必要人数を指定して募集できます。募集時間と募集者の段位を確認し、条件が合う場合だけ参加申請を送ります。</p></div></article>
      <article className={styles.step}><div><h2>編成とVCを相談する</h2><p>マッチ後のやりとりで、使うキャラ、役割、開始時間、VCの有無を相談します。連絡先は自動公開されず、必要な相手とだけやりとりできます。</p></div></article>
    </section>
    <section className={styles.section}><small>GOOD PROFILE</small><h2>一緒に遊びやすいプロフィール</h2><ul><li>よく遊ぶ時間帯を具体的に書く</li><li>ランクを勝率重視で回すか、練習重視かを書く</li><li>救助・牽制・補助・解読の得意分野を選ぶ</li><li>VCの可否と、初回はチャットだけでもよいかを書く</li></ul></section>
    <p className={styles.terms}>第五マッチはゲーム仲間探し専用です。恋愛、異性交際、面会、性的目的では利用できません。本サービスはNetEase GamesおよびIdentity V／第五人格の公式サービスではありません。</p>
  </div></main>;
}
