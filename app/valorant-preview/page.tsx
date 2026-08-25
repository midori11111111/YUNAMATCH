"use client";

import { useState } from "react";
import styles from "./valorant-preview.module.css";

const flows = [
  { id: "connect", label: "1. Riot連携" },
  { id: "profile", label: "2. プロフィール" },
  { id: "discover", label: "3. 仲間を探す" },
  { id: "match", label: "4. マッチ後" },
] as const;

type Flow = (typeof flows)[number]["id"];

const player = {
  name: "Sora#JP1",
  rank: "ゴールド 2",
  roles: ["コントローラー", "センチネル"],
  modes: ["コンペティティブ", "スイフトプレイ"],
  times: ["平日 21〜24時", "土日 夜"],
};

export default function ValorantPreviewPage() {
  const [flow, setFlow] = useState<Flow>("connect");
  const [notice, setNotice] = useState("");

  const move = (next: Flow, message = "") => {
    setFlow(next);
    setNotice(message);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label="V-MATCH prototype top">
          <span className={styles.mark}>⚡</span>
          <span>
            <strong>V-MATCH</strong>
            <small>バロマッチ · BY YUNAMATCH</small>
          </span>
        </a>
        <span className={styles.reviewBadge}>RIOT REVIEW BUILD</span>
      </header>

      <section className={styles.hero} id="top">
        <div>
          <p className={styles.eyebrow}>FIND THE RIGHT TEAMMATE</p>
          <h1>ランクだけではなく、<br />プレイスタイルでつながる。</h1>
          <p className={styles.lead}>
            VALORANTを一緒にプレイする仲間を、ランク・ロール・モード・時間帯・VC方針から探す非公式LFGサービスです。
          </p>
        </div>
        <div className={styles.safetyCard}>
          <span>設計原則</span>
          <strong>Opt-in only</strong>
          <p>個人戦績は、本人がRiotアカウントを連携し、公開に同意した場合だけ表示します。</p>
        </div>
      </section>

      <nav className={styles.flowNav} aria-label="審査用ユーザーフロー">
        {flows.map((item) => (
          <button
            key={item.id}
            type="button"
            className={flow === item.id ? styles.activeFlow : ""}
            onClick={() => move(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className={styles.demoShell} aria-live="polite">
        <div className={styles.phone}>
          <div className={styles.phoneTop}><span>9:41</span><span>● ●●</span></div>

          {flow === "connect" && (
            <div className={styles.screen}>
              <p className={styles.screenKicker}>STEP 1</p>
              <h2>Riotアカウントを連携</h2>
              <p className={styles.screenText}>ランクや戦績をプロフィールに表示するには、本人の許可が必要です。</p>
              <div className={styles.consentBox}>
                <strong>連携によって公開される情報</strong>
                <ul>
                  <li>Riot ID・現在のランク</li>
                  <li>本人が公開を選んだ戦績</li>
                  <li>最終更新日時</li>
                </ul>
                <p>連携はいつでも設定から解除でき、解除後は戦績を非公開にします。</p>
              </div>
              <button className={styles.primary} type="button" onClick={() => move("profile", "デモ：本人がデータ公開に同意しました")}>Riotアカウントで続ける</button>
              <button className={styles.textButton} type="button" onClick={() => move("profile", "デモ：戦績を連携せずに続行します")}>戦績を連携せずに続ける</button>
            </div>
          )}

          {flow === "profile" && (
            <div className={styles.screen}>
              <p className={styles.screenKicker}>STEP 2</p>
              <h2>プレイスタイルを登録</h2>
              <div className={styles.formGrid}>
                <label>Riot ID<input value={player.name} readOnly /></label>
                <label>ランク<input value={player.rank} readOnly /></label>
                <fieldset><legend>よく使うロール</legend>{player.roles.map((v) => <span key={v} className={styles.selectedChip}>{v}</span>)}</fieldset>
                <fieldset><legend>遊びたいモード</legend>{player.modes.map((v) => <span key={v} className={styles.selectedChip}>{v}</span>)}</fieldset>
                <label>ひとこと<textarea value="雰囲気よく報告しながら上達したいです。負けても引きずりません。" readOnly /></label>
              </div>
              <button className={styles.primary} type="button" onClick={() => move("discover", "プロフィールを保存しました")}>保存して仲間を探す</button>
            </div>
          )}

          {flow === "discover" && (
            <div className={styles.screen}>
              <div className={styles.screenHeading}><div><p className={styles.screenKicker}>DISCOVER</p><h2>おすすめ</h2></div><button type="button" className={styles.filter}>絞り込み</button></div>
              <article className={styles.playerCard}>
                <div className={styles.cardVisual}><span className={styles.avatar}>RN</span><div><strong>Rin#TOKYO</strong><small>最終オンライン 12分前</small></div><b>82%</b></div>
                <div className={styles.cardBody}>
                  <div className={styles.metaRow}><span>プラチナ 1</span><span>VCあり</span><span>成人</span></div>
                  <h3>デュエリスト / イニシエーター</h3>
                  <p>コンペ中心。報告はしっかり、雰囲気は柔らかく遊びたいです。</p>
                  <div className={styles.chips}><span>平日夜</span><span>コンペ</span><span>固定希望</span></div>
                  <small className={styles.verified}>✓ Riot連携済み・本人の同意によりランク表示</small>
                </div>
              </article>
              <div className={styles.actions}>
                <button type="button" className={styles.secondary} onClick={() => setNotice("次の候補を表示します")}>次の人</button>
                <button type="button" className={styles.like} onClick={() => setNotice("いいねを送りました。相互いいねになるとマッチします")}>♡ いいね</button>
                <button type="button" className={styles.primary} onClick={() => move("match", "デモ：相互いいねでマッチしました")}>メイト申請</button>
              </div>
            </div>
          )}

          {flow === "match" && (
            <div className={styles.screen}>
              <p className={styles.screenKicker}>MATCHED</p>
              <div className={styles.matchHero}><span className={styles.avatarLarge}>SO</span><span className={styles.matchBolt}>⚡</span><span className={styles.avatarLarge}>RN</span></div>
              <h2>Rinさんとマッチしました</h2>
              <p className={styles.screenText}>承認後にサイト内チャットが開きます。ゲームアカウントのログイン情報を要求することはありません。</p>
              <div className={styles.chatCard}>
                <div><span className={styles.avatarSmall}>RN</span><p><strong>Rin</strong><br />はじめまして！今夜コンペどうですか？</p></div>
                <div className={styles.chatActions}><button type="button">プロフィール</button><button type="button">通報・ブロック</button></div>
              </div>
              <button className={styles.primary} type="button" onClick={() => setNotice("デモ：チャット画面へ進みます")}>チャットを開く</button>
              <button className={styles.textButton} type="button" onClick={() => move("discover")}>仲間探しに戻る</button>
            </div>
          )}

          {notice && <div className={styles.toast} role="status">{notice}</div>}
        </div>

        <aside className={styles.reviewPanel}>
          <p className={styles.eyebrow}>REVIEW NOTES</p>
          <h2>審査で確認できること</h2>
          <ol>
            <li><strong>明示的な同意</strong><span>戦績公開前にRSOによる本人のオプトインを求めます。</span></li>
            <li><strong>目的を限定</strong><span>ゲーム仲間探しに限定し、対戦中の優位性を与える機能は提供しません。</span></li>
            <li><strong>公平な検索</strong><span>公式ランク、ロール、時間帯、モード、VC方針で候補を提示します。</span></li>
            <li><strong>安全な交流</strong><span>通報、ブロック、申請取消、連携解除、アカウント削除を提供します。</span></li>
          </ol>
          <div className={styles.notProvided}>
            <strong>提供しない機能</strong>
            <p>非公式MMR、試合前の相手調査、リアルタイム助言、ゲームクライアント改変、非公開プレイヤー情報の表示、賭博。</p>
          </div>
        </aside>
      </section>

      <footer className={styles.footer}>
        <strong>V-MATCH（バロマッチ）｜非公式プロトタイプ</strong>
        <p>このページはRiot Gamesへの製品登録・審査説明を目的とした試作品です。V-MATCHはYUNAMATCHが運営を予定する非公式LFGサービスです。Riot Gamesは本サービスを承認・支援していません。公式素材は使用していません。</p>
      </footer>
    </main>
  );
}
