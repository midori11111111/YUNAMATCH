import Image from "next/image";
import Link from "next/link";
import styles from "./services.module.css";

export const metadata = {
  title: "ゲーム別サービス｜YUNAMATCH運営",
  description:
    "YUNAMATCH運営が提供するゲーム仲間探しサービスと公開状況の一覧です。",
};

const safeExternalUrl = (
  value: string | undefined,
  allowedHosts: readonly string[],
) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && allowedHosts.includes(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const services = [
  {
    id: "valomatch",
    mark: "V",
    markImage: null,
    name: "バロマッチ",
    game: "VALORANT",
    summary: "ランク、役割、遊べる時間から、一緒にプレイする仲間を探します。",
    href: "/valomatch",
    legal: "/legal?service=valomatch",
    stage: "Riot公開範囲を確認中",
    stageClass: "review",
    x: "VALOMATCH_X_URL",
    discord: "NEXT_PUBLIC_VALOMATCH_DISCORD_URL",
  },
  {
    id: "stamate",
    mark: "S",
    markImage: "/brand/stamate-mark.svg",
    name: "スタメイト",
    game: "ブロスタ",
    summary: "トロフィー、得意ロール、モード、時間帯から仲間を探します。",
    href: "/stamate",
    legal: "/legal?service=stamate",
    stage: "限定ベータ準備中",
    stageClass: "beta",
    x: "STAMATE_X_URL",
    discord: "NEXT_PUBLIC_STAMATE_DISCORD_URL",
  },
  {
    id: "shoenmate",
    mark: "荘",
    markImage: null,
    name: "荘園メイト",
    game: "第五人格",
    summary: "陣営、段位、役割、遊べる時間から仲間を探します。",
    href: "/shoenmate",
    legal: "/legal?service=shoenmate",
    stage: "NetEase回答待ち・プレビュー限定",
    stageClass: "hold",
    x: "SHOENMATE_X_URL",
    discord: "NEXT_PUBLIC_SHOENMATE_DISCORD_URL",
  },
] as const;

export default function ServicesPage() {
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <Link href="/" className={styles.back}>
          ← YUNAMATCHへ戻る
        </Link>
        <header className={styles.hero}>
          <span>Y</span>
          <small>YUNAMATCH NETWORK</small>
          <h1>ゲーム仲間を、もっと見つけやすく。</h1>
          <p>
            ゲームごとのランクや役割に合わせて仲間を探せる、YUNAMATCH運営の非公式コミュニティサービスです。
          </p>
        </header>
        <section className={styles.grid} aria-label="ゲーム別サービス">
          {services.map((service) => {
            const xUrl = safeExternalUrl(process.env[service.x], ["x.com"]);
            const discordUrl = safeExternalUrl(process.env[service.discord], [
              "discord.gg",
              "discord.com",
            ]);
            return (
              <article className={styles[service.stageClass]} key={service.id}>
                <div className={styles.cardTop}>
                  {service.markImage ? (
                    <Image
                      src={service.markImage}
                      width={48}
                      height={48}
                      alt=""
                    />
                  ) : (
                    <b>{service.mark}</b>
                  )}
                  <span>
                    <small>{service.game}</small>
                    <h2>{service.name}</h2>
                  </span>
                </div>
                <em>{service.stage}</em>
                <p>{service.summary}</p>
                <div className={styles.actions}>
                  <Link href={service.href}>サービスを見る</Link>
                  <Link href={service.legal}>規約・安全方針</Link>
                  {xUrl && (
                    <a href={xUrl} target="_blank" rel="noopener noreferrer">
                      公式X
                    </a>
                  )}
                  {discordUrl && (
                    <a
                      href={discordUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      公式Discord
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </section>
        <section className={styles.safety}>
          <h2>共通の安全方針</h2>
          <p>
            恋愛・異性交際目的の利用を禁止し、通報・ブロック・退会・未成年者保護に対応します。通常の個別チャットを運営者が自由に閲覧する機能は設けません。
          </p>
          <nav>
            <Link href="/terms">利用規約</Link>
            <Link href="/privacy">プライバシーポリシー</Link>
            <Link href="/community-guidelines">コミュニティガイドライン</Link>
            <Link href="/contact">お問い合わせ</Link>
          </nav>
        </section>
        <footer>
          各サービスは対象ゲームおよび権利者の公式サービスではありません。
        </footer>
      </div>
    </main>
  );
}
