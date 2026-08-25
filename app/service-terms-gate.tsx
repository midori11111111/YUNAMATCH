"use client";

import { FormEvent, useState } from "react";
import styles from "./service-terms-gate.module.css";

export default function ServiceTermsGate({
  service,
  name,
  onComplete,
}: {
  service: string;
  name: string;
  onComplete: () => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/services/${service}/profile`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ termsAccepted: accepted }),
        }),
        data = await response.json();
      if (!response.ok) throw new Error(data.error || "同意を保存できませんでした");
      onComplete();
    } catch (value) {
      setError(value instanceof Error ? value.message : "同意を保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <section>
        <small>{name.toUpperCase()} · TERMS UPDATE</small>
        <h1>利用条件が更新されました</h1>
        <p>
          安全対策とゲーム別の非公式サービス表記を更新しました。内容を確認してから続けてください。
        </p>
        <nav>
          <a href={`/legal?service=${service}`} target="_blank" rel="noreferrer">
            ゲーム別の利用条件
          </a>
          <a href="/terms" target="_blank" rel="noreferrer">
            共通利用規約
          </a>
          <a href="/privacy" target="_blank" rel="noreferrer">
            プライバシーポリシー
          </a>
        </nav>
        <form onSubmit={submit}>
          <label>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>更新された利用条件とプライバシーポリシーに同意します</span>
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button disabled={!accepted || saving}>
            {saving ? "保存しています…" : "同意してサービスを続ける"}
          </button>
        </form>
      </section>
    </main>
  );
}

