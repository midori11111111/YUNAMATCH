import Link from "next/link";
import styles from "../guide/guide.module.css";

export const metadata = {
  title: "安全に使うために｜第五マッチ",
  description: "第五マッチの通報、ブロック、未成年者保護、個人情報保護とゲーム仲間探しのルールを説明します。",
};

export default function SafetyPage() {
  return <main className={styles.page}><div className={styles.wrap}>
    <nav className={styles.nav}><Link href="/">第五マッチへ戻る</Link><Link href="/guide">使い方</Link><Link href="/community-guidelines">コミュニティガイドライン</Link><Link href="/contact">お問い合わせ</Link></nav>
    <header className={styles.hero}><small>SAFETY GUIDE</small><h1>遊ぶ約束の前に、<br/>自分の情報を守る。</h1><p>第五マッチは、第五人格を一緒に遊ぶためのサービスです。相手との距離感に不安を感じたら、無理に返信せず、通報とブロックを使ってください。</p></header>
    <section className={styles.steps}>
      <article className={styles.step}><div><h2>公開しない情報</h2><p>本名、住所、学校名、電話番号、現在地、ログイン用パスワードはプロフィールやチャットに書かないでください。SNSやDiscordの交換も、信頼できると確認してから自分の判断で行います。</p></div></article>
      <article className={styles.step}><div><h2>恋愛・面会目的は禁止</h2><p>ゲーム以外の交際、実際に会うことの要求、性的な話題や画像、執拗な連絡先交換の要求は禁止しています。相方探しも、ゲーム内で継続して遊ぶ仲間を探す目的に限ります。</p></div></article>
      <article className={styles.step}><div><h2>18歳未満の利用</h2><p>13歳未満は利用できません。18歳未満は保護者の同意を得て利用し、性別は他の利用者に表示しません。外部連絡先や面会を求められた場合は、返信せず保護者に相談してください。</p></div></article>
      <article className={styles.step}><div><h2>通報とブロック</h2><p>プロフィールまたはチャットから通報できます。運営者は通常の個別チャットを自由に閲覧せず、通報された発言と判断に必要な前後の範囲だけを確認します。ブロック後は相手のプロフィール、申請、チャットを非表示にします。</p></div></article>
    </section>
    <section className={styles.section}><small>WHEN SOMETHING HAPPENS</small><h2>問題が起きたとき</h2><ul><li>相手に言い返さず、会話を終了する</li><li>対象のプロフィールまたは発言を通報する</li><li>今後の連絡を防ぐためブロックする</li><li>脅迫、ストーカー、金銭被害など緊急性がある場合は警察や保護者へ相談する</li></ul></section>
    <section className={styles.section}><small>MODERATION PROCESS</small><h2>通報後の確認と削除</h2><p>通報を受けると、対象プロフィールまたは発言と、判断に必要な最小限の前後関係を確認します。禁止行為が確認できた場合は、内容と危険性に応じて投稿削除、機能制限、警告、アカウント停止または削除を行います。通常の個別チャットを通報なく巡回・閲覧することはありません。</p><ul><li>プロフィール・発言のメニューから通報する</li><li>通報項目と状況を選び、必要なら補足を書く</li><li>緊急の場合やログインできない場合は公開お問い合わせ窓口を使う</li><li>処置への異議申立てもお問い合わせ窓口から行う</li></ul></section>
    <p className={styles.terms}>通報・ブロック機能の不具合や、ログインできない状態での安全上の相談は、<Link href="/contact">公開お問い合わせ窓口</Link>から送信できます。</p>
  </div></main>;
}
