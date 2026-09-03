"use client";
import { useState } from "react";
import styles from "./service-report-button.module.css";
export default function ServiceReportButton({
  service,
  targetProfileId,
  connectionId,
  onNotice,
  onBlocked,
  className = "",
  compact = false,
}: {
  service: string;
  targetProfileId: number;
  connectionId?: number;
  onNotice: (text: string) => void;
  onBlocked?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  async function report() {
    const reason = prompt(
      "通報理由を入力してください\n例：暴言、なりすまし、不適切な募集、連絡先の強要",
    );
    if (!reason?.trim()) return;
    const details = prompt("状況の詳細（任意）", "") || "";
    if (!confirm("この内容で運営へ通報しますか？")) return;
    setSending(true);
    try {
      const response = await fetch(`/api/services/${service}/reports`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            targetProfileId,
            connectionId,
            reason,
            details,
          }),
        }),
        data = await response.json();
      onNotice(
        response.ok
          ? "通報を受け付けました。運営が確認します"
          : data.error || "通報できませんでした",
      );
    } finally {
      setSending(false);
    }
  }
  async function block() {
    if (
      !confirm(
        "この相手をブロックしますか？\n検索・募集・申請・チャットでお互いに表示されなくなります。",
      )
    )
      return;
    setBlocking(true);
    try {
      const response = await fetch(`/api/services/${service}/safety`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetProfileId }),
        }),
        data = await response.json();
      if (response.ok) {
        onNotice("ブロックしました。設定から解除できます");
        onBlocked?.();
      } else onNotice(data.error || "ブロックできませんでした");
    } finally {
      setBlocking(false);
    }
  }
  if (compact)
    return (
      <div className={styles.compactRoot}>
        <button
          type="button"
          className={`${styles.compactTrigger} ${className}`.trim()}
          onClick={() => setMenuOpen(true)}
          aria-label="通報・ブロックメニューを開く"
          aria-expanded={menuOpen}
        >
          ⋯
        </button>
        {menuOpen && (
          <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="安全メニュー">
            <button type="button" className={styles.dismiss} onClick={() => setMenuOpen(false)} aria-label="安全メニューを閉じる" />
            <section className={styles.sheet}>
              <i />
              <small>SAFETY</small>
              <h2>安全メニュー</h2>
              <p>必要な操作を選んでください。相手に通報内容は通知されません。</p>
              <button type="button" className={styles.reportAction} disabled={sending} onClick={() => { setMenuOpen(false); void report(); }}>
                <b>!</b><span><strong>{sending ? "送信中…" : "運営に通報する"}</strong><small>理由と状況を運営へ送ります</small></span>
              </button>
              <button type="button" className={styles.blockAction} disabled={blocking} onClick={() => { setMenuOpen(false); void block(); }}>
                <b>×</b><span><strong>{blocking ? "処理中…" : "この相手をブロック"}</strong><small>検索・募集・申請・チャットから非表示にします</small></span>
              </button>
              <button type="button" className={styles.cancel} onClick={() => setMenuOpen(false)}>キャンセル</button>
            </section>
          </div>
        )}
      </div>
    );
  return (
    <span className={styles.inlineActions}>
      <button
        type="button"
        className={className}
        disabled={sending}
        onClick={report}
      >
        {sending ? "送信中…" : "通報"}
      </button>
      <button
        type="button"
        className={className}
        disabled={blocking}
        onClick={block}
      >
        {blocking ? "処理中…" : "ブロック"}
      </button>
    </span>
  );
}
