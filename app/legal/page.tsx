"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./legal.module.css";

type Service = "stamate" | "valomatch" | "shoenmate";
const DATA: Record<
  Service,
  {
    name: string;
    game: string;
    status: string;
    owner: string;
    policy: string;
    policyUrl: string;
    special: string[];
  }
> = {
  stamate: {
    name: "スタメイト",
    game: "ブロスタ",
    status: "限定ベータ公開前の最終確認中",
    owner: "Supercell",
    policy: "Fan Content Policy",
    policyUrl: "https://supercell.com/en/fan-content-policy/",
    special: [
      "SupercellおよびBrawl Starsの公式サービスではありません。",
      "公式ロゴ・キャラクター画像・ゲーム内画像をサービス素材として使用しません。",
      "プレイヤータグ連携を追加する場合は、公式APIの条件と本人同意を確認します。",
      "広告・寄付・有料機能は、Fan Content Policyとの適合性確認が終わるまで提供しません。",
    ],
  },
  valomatch: {
    name: "バロマッチ",
    game: "VALORANT",
    status: "Riot製品審査・登録確認中",
    owner: "Riot Games",
    policy: "Riot Developer Policy",
    policyUrl: "https://developer.riotgames.com/docs/valorant",
    special: [
      "Riot GamesおよびVALORANTの公式サービスではありません。",
      "プレイヤー向け製品としてDeveloper Portalの登録状態を維持します。",
      "公式ランクを代替する独自MMR・ELOは提供しません。",
      "Riot連携で取得する情報は、本人が許可した範囲に限定し、設定から解除可能にします。",
    ],
  },
  shoenmate: {
    name: "荘園メイト",
    game: "第五人格",
    status: "NetEase回答待ち・プレビュー限定",
    owner: "NetEase Games",
    policy: "Identity V公式サイト",
    policyUrl: "https://www.identityvgame.com/",
    special: [
      "NetEase Gamesおよび第五人格の公式サービスではありません。",
      "公式ロゴ・キャラクター画像・ゲーム内画像は、書面で利用範囲が確認できるまで使用しません。",
      "問い合わせ回答で示された名称・素材・API・収益化条件を公開前に反映します。",
      "回答前は登録・チャットを伴う一般公開を行いません。",
    ],
  },
};

export default function LegalCenter() {
  const [service, setService] = useState<Service>("stamate");
  useEffect(() => {
    const x = new URLSearchParams(location.search).get("service");
    if (x && x in DATA) setService(x as Service);
  }, []);
  const d = DATA[service];
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <Link className={styles.back} href="/">
          ← サービスへ戻る
        </Link>
        <section className={styles.hero}>
          <small>LEGAL & SAFETY CENTER</small>
          <h1>規約・安全センター</h1>
          <p>
            ゲーム仲間を安心して探せるよう、取得情報、禁止事項、通報対応、各ゲーム固有のルールを公開します。
          </p>
        </section>
        <nav className={styles.tabs}>
          {(Object.keys(DATA) as Service[]).map((key) => (
            <button
              key={key}
              className={service === key ? styles.active : ""}
              onClick={() => setService(key)}
            >
              {DATA[key].name}
            </button>
          ))}
        </nav>
        <div className={styles.status}>
          <b>公開状態</b>
          {d.status}
        </div>
        <section className={styles.card}>
          <h2>{d.name}の目的</h2>
          <p>
            {d.name}は、{d.game}
            を一緒に遊ぶゲーム仲間を探すための非公式コミュニティサービスです。恋愛、異性交際、営業、宗教、投資、外部サービスへの勧誘を目的とした利用は禁止します。
          </p>
          <h3>ゲーム別特則</h3>
          <ul>
            {d.special.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p>
            <a href={d.policyUrl} target="_blank" rel="noreferrer">
              {d.owner}の{d.policy}を確認する ↗
            </a>
          </p>
        </section>
        <section className={styles.card}>
          <h2>年齢と未成年者の安全</h2>
          <ul>
            <li>13歳未満は利用できません。</li>
            <li>18歳未満は保護者の同意を得て利用してください。</li>
            <li>
              本名、住所、学校名、電話番号、現在地などを相手へ送らないでください。
            </li>
            <li>
              性的な会話、交際目的の誘引、年齢詐称、執拗な外部連絡先要求を禁止します。
            </li>
            <li>
              危険を感じた場合は返信せず、ブロックと通報を利用してください。
            </li>
          </ul>
        </section>
        <section className={styles.card}>
          <h2>取得する情報と利用目的</h2>
          <ul>
            <li>ログイン事業者から提供される識別子、表示名、アイコン</li>
            <li>ゲームプロフィール、希望条件、募集、いいね、申請、マッチ</li>
            <li>チャット、通報、お問い合わせ、接続・操作記録</li>
            <li>
              不正利用防止、本人確認、マッチング、通知、障害調査、統計のために利用
            </li>
          </ul>
          <p>
            通常の個別チャットを運営者が自由に閲覧する機能は設けません。通報があった場合に限り、通報対象と事実確認に必要な前後の範囲を確認します。
          </p>
        </section>
        <section className={styles.card}>
          <h2>管理・削除・安全対策</h2>
          <ul>
            <li>
              管理画面は認証と権限管理を行い、通報解決、停止・復旧、画像削除などの管理操作を記録します。
            </li>
            <li>
              通信の暗号化、アクセス制御、送信回数制限、バックアップを実施します。
            </li>
            <li>
              プロフィール修正、相手のブロック・解除、サービス単位の退会ができます。
            </li>
            <li>
              通報対象者は確認後に警告、機能制限、停止、削除の対象になります。
            </li>
            <li>
              法令上または安全調査上必要な範囲を除き、退会時にアカウントデータを削除します。
            </li>
          </ul>
        </section>
        <section className={styles.card}>
          <h2>正式文書とお問い合わせ</h2>
          <p>
            <Link href="/terms">共通利用規約</Link>{" "}
            <Link href="/privacy">プライバシーポリシー</Link>{" "}
            <Link href="/community-guidelines">コミュニティガイドライン</Link>{" "}
            <Link href="/contact">お問い合わせ</Link>
          </p>
          <p className={styles.note}>
            電気通信事業の届出済みサービスについて、サービス追加後の名称・URL・提供機能が届出内容に含まれるかを公開前に確認します。法令・各社方針・問い合わせ回答が変更された場合、本ページと各規約を更新します。
          </p>
        </section>
        <footer className={styles.footer}>
          各ゲームおよび権利者の公式サービスではありません。
          <br />
          最終更新：2026年8月26日
        </footer>
      </div>
    </main>
  );
}
