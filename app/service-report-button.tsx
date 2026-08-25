"use client";
import { useState } from "react";
export default function ServiceReportButton({
  service,
  targetProfileId,
  connectionId,
  onNotice,
  className = "",
}: {
  service: string;
  targetProfileId: number;
  connectionId?: number;
  onNotice: (text: string) => void;
  className?: string;
}) {
  const [sending, setSending] = useState(false);
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
  return (
    <button
      type="button"
      className={className}
      disabled={sending}
      onClick={report}
    >
      {sending ? "送信中…" : "通報"}
    </button>
  );
}
