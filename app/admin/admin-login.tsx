"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || sending) return;
    setSending(true);
    setError("");
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setSending(false);
      setError(data.error || "ログインできませんでした");
      return;
    }
    location.reload();
  };

  return (
    <main className="adminLoginPage">
      <section className="adminLoginCard">
        <div className="adminLoginMark">Y</div>
        <small>YUNAMATCH ADMIN</small>
        <h1>運営ダッシュボード</h1>
        <p>管理者パスワードを入力してください。</p>
        <form onSubmit={submit}>
          <label htmlFor="admin-password">パスワード</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
          {error && <p className="adminLoginError">{error}</p>}
          <button disabled={sending}>{sending ? "確認中…" : "管理画面を開く"}</button>
        </form>
        <Link href="/">YUNAMATCHへ戻る</Link>
      </section>
    </main>
  );
}
