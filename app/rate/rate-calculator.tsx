"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./rate.module.css";

type Queue = "solo" | "duo" | "trio";

const queueData: Record<Queue, { label: string; short: string; weight: number }> = {
  solo: { label: "ソロ中心", short: "SOLO", weight: 1 },
  duo: { label: "デュオ中心", short: "DUO", weight: 0.86 },
  trio: { label: "トリオ中心", short: "TRIO", weight: 0.74 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function RateCalculator() {
  const [rating, setRating] = useState(1450);
  const [matches, setMatches] = useState(20);
  const [wins, setWins] = useState(11);
  const [winGain, setWinGain] = useState(10);
  const [lossDrop, setLossDrop] = useState(8);
  const [queue, setQueue] = useState<Queue>("solo");
  const [calculated, setCalculated] = useState(false);

  const result = useMemo(() => {
    const safeMatches = clamp(matches || 1, 1, 100);
    const safeWins = clamp(wins, 0, safeMatches);
    const winRate = safeWins / safeMatches;
    const formDelta = (winRate - 0.5) * safeMatches * 15 * queueData[queue].weight;
    const pointDelta = clamp(winGain - lossDrop, -12, 12) * 9;
    const sampleWeight = clamp(safeMatches / 20, 0.25, 1);
    const estimated = Math.round(rating + (formDelta + pointDelta) * sampleWeight);
    const uncertainty = Math.round(110 - clamp(safeMatches, 1, 30) * 2.25 + (queue === "solo" ? 0 : 12));
    const score = clamp(Math.round(50 + (estimated - rating) / 6 + (winRate - 0.5) * 45), 1, 99);

    let status = "ほぼレート相応";
    let note = "表示レートと内部評価の差は小さいと推定されます。";
    if (estimated - rating >= 75) {
      status = "上振れ候補";
      note = "最近の実績は表示レートより強め。勝ち越しが続くと帯が上がる可能性があります。";
    } else if (estimated - rating <= -75) {
      status = "下振れ候補";
      note = "直近は苦戦気味。数試合ではぶれるため、対象を増やして再計算してみてください。";
    }

    const confidence = safeMatches >= 20 ? "高め" : safeMatches >= 10 ? "ふつう" : "参考";
    return {
      estimated,
      low: estimated - uncertainty,
      high: estimated + uncertainty,
      score,
      status,
      note,
      winRate: Math.round(winRate * 100),
      confidence,
    };
  }, [lossDrop, matches, queue, rating, winGain, wins]);

  function updateMatches(value: number) {
    const next = clamp(value, 1, 100);
    setMatches(next);
    setWins((current) => Math.min(current, next));
    setCalculated(false);
  }

  return (
    <main className={styles.page}>
      <div className={styles.auroraOne} />
      <div className={styles.auroraTwo} />

      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="ユナマッチに戻る">
          <span className={styles.brandMark}>U</span>
          <span>
            <strong>ユナマッチ</strong>
            <small>UNITE RATE LAB</small>
          </span>
        </Link>
        <span className={styles.unofficial}>非公式ツール</span>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>HIDDEN RATE ESTIMATOR</span>
          <h1>
            あなたの内部レート、
            <br />
            <em>どのあたり？</em>
          </h1>
          <p>マスターレートと直近の戦績を入れて、マッチングの内部評価帯を推定します。</p>
          <div className={styles.featureRow}>
            <span>登録不要</span>
            <span>約30秒</span>
            <span>データ保存なし</span>
          </div>
        </div>
        <div className={styles.heroOrb} aria-hidden="true">
          <div className={styles.orbRing} />
          <div className={styles.orbCore}>
            <small>EST.</small>
            <strong>{calculated ? result.estimated : "???"}</strong>
            <span>INTERNAL RATE</span>
          </div>
          <i className={styles.sparkOne} />
          <i className={styles.sparkTwo} />
        </div>
      </section>

      <section className={styles.workspace}>
        <form
          className={styles.formCard}
          onSubmit={(event) => {
            event.preventDefault();
            setCalculated(true);
          }}
        >
          <div className={styles.cardHeading}>
            <span>01</span>
            <div>
              <h2>プレイデータ</h2>
              <p>わかる範囲でOKです</p>
            </div>
          </div>

          <label className={styles.field}>
            <span>現在のマスターレート</span>
            <div className={styles.numberInput}>
              <input
                type="number"
                min="1000"
                max="3000"
                value={rating}
                onChange={(event) => {
                  setRating(clamp(Number(event.target.value), 1000, 3000));
                  setCalculated(false);
                }}
                aria-label="現在のマスターレート"
              />
              <small>RATE</small>
            </div>
          </label>

          <div className={styles.twoColumns}>
            <label className={styles.field}>
              <span>直近の試合数</span>
              <div className={styles.compactInput}>
                <input type="number" min="1" max="100" value={matches} onChange={(event) => updateMatches(Number(event.target.value))} />
                <small>試合</small>
              </div>
            </label>
            <label className={styles.field}>
              <span>そのうち勝利</span>
              <div className={styles.compactInput}>
                <input
                  type="number"
                  min="0"
                  max={matches}
                  value={wins}
                  onChange={(event) => {
                    setWins(clamp(Number(event.target.value), 0, matches));
                    setCalculated(false);
                  }}
                />
                <small>勝</small>
              </div>
            </label>
          </div>

          <div className={styles.winRateLine}>
            <span>直近勝率</span>
            <div><i style={{ width: `${result.winRate}%` }} /></div>
            <strong>{result.winRate}%</strong>
          </div>

          <div className={styles.twoColumns}>
            <label className={styles.field}>
              <span>勝った時の平均</span>
              <div className={styles.compactInput}>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={winGain}
                  onChange={(event) => {
                    setWinGain(clamp(Number(event.target.value), 1, 30));
                    setCalculated(false);
                  }}
                />
                <small>+</small>
              </div>
            </label>
            <label className={styles.field}>
              <span>負けた時の平均</span>
              <div className={styles.compactInput}>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={lossDrop}
                  onChange={(event) => {
                    setLossDrop(clamp(Number(event.target.value), 1, 30));
                    setCalculated(false);
                  }}
                />
                <small>−</small>
              </div>
            </label>
          </div>

          <fieldset className={styles.queueField}>
            <legend>よく遊ぶ人数</legend>
            <div>
              {(Object.keys(queueData) as Queue[]).map((item) => (
                <button
                  className={queue === item ? styles.activeQueue : ""}
                  type="button"
                  key={item}
                  onClick={() => {
                    setQueue(item);
                    setCalculated(false);
                  }}
                  aria-pressed={queue === item}
                >
                  <small>{queueData[item].short}</small>
                  <strong>{queueData[item].label}</strong>
                </button>
              ))}
            </div>
          </fieldset>

          <button className={styles.calculateButton} type="submit">
            <span>内部レートを推定する</span>
            <b>→</b>
          </button>
        </form>

        <aside className={`${styles.resultCard} ${calculated ? styles.revealed : ""}`} aria-live="polite">
          {!calculated ? (
            <div className={styles.emptyResult}>
              <div className={styles.miniOrb}><span>?</span></div>
              <span className={styles.eyebrow}>YOUR RESULT</span>
              <h2>数値を入れて<br />推定してみよう</h2>
              <p>結果はここに表示されます。</p>
            </div>
          ) : (
            <div className={styles.resultContent}>
              <div className={styles.resultTopline}>
                <span>推定結果</span>
                <small>信頼度：{result.confidence}</small>
              </div>
              <div className={styles.scoreCircle} style={{ "--score": `${result.score * 3.6}deg` } as React.CSSProperties}>
                <div>
                  <small>EST. RATE</small>
                  <strong>{result.estimated}</strong>
                  <span>{result.status}</span>
                </div>
              </div>
              <div className={styles.rangeBox}>
                <span>推定レンジ</span>
                <strong>{result.low.toLocaleString()} <i>—</i> {result.high.toLocaleString()}</strong>
              </div>
              <p className={styles.resultNote}>{result.note}</p>
              <div className={styles.metrics}>
                <div><small>直近勝率</small><strong>{result.winRate}%</strong></div>
                <div><small>表示との差</small><strong>{result.estimated - rating >= 0 ? "+" : ""}{result.estimated - rating}</strong></div>
                <div><small>キュー</small><strong>{queueData[queue].short}</strong></div>
              </div>
              <button className={styles.retryButton} type="button" onClick={() => setCalculated(false)}>条件を変える</button>
            </div>
          )}
        </aside>
      </section>

      <section className={styles.explainer}>
        <span className={styles.eyebrow}>HOW IT WORKS</span>
        <h2>どうやって推定しているの？</h2>
        <div className={styles.explainerGrid}>
          <article><b>1</b><h3>現在地</h3><p>表示中のマスターレートを基準にします。</p></article>
          <article><b>2</b><h3>直近フォーム</h3><p>試合数と勝率から、最近の調子を補正します。</p></article>
          <article><b>3</b><h3>レート変動</h3><p>勝敗時の増減と参加人数を加味します。</p></article>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>本ツールはファンメイドの非公式推定器です。ゲーム内部の実際の数値を表示するものではありません。</p>
        <Link href="/">ユナマッチへ戻る</Link>
      </footer>
    </main>
  );
}
