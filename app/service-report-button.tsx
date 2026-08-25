"use client";
import { useState } from "react";
export default function ServiceReportButton({
  service,
  targetProfileId,
  connectionId,
  onNotice,
  onBlocked,
  className = "",
}: {
  service: string;
  targetProfileId: number;
  connectionId?: number;
  onNotice: (text: string) => void;
  onBlocked?: () => void;
  className?: string;
}) {
  const [sending, setSending] = useState(false);
  const [blocking, setBlocking] = useState(false);
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
  return (
    <span style={{ display: "inline-flex", gap: 8 }}>
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
