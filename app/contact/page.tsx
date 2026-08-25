"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ContactPage() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setResult(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/public-support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        category: form.get("category"),
        replyContact: form.get("replyContact"),
        message: form.get("message"),
      }),
    });
    const data = await response.json().catch(() => ({})) as {
      error?: string;
      ticketId?: number;
    };
    setSending(false);
    if (!response.ok) {
      setResult({ ok: false, message: data.error || "送信できませんでした。時間をおいて再度お試しください。" });
      return;
    }
    event.currentTarget.reset();
    setResult({
      ok: true,
      message: data.ticketId
        ? `お問い合わせを受け付けました。受付番号：${data.ticketId}`
        : "お問い合わせを受け付けました。内容を確認します。",
    });
  }

  return (
    <main className="legalPage">
      <section>
        <nav className="legalNav" aria-label="サービス情報">
          <Link href="/">← YUNAMATCH</Link>
          <Link href="/privacy">プライバシーポリシー</Link>
          <Link href="/terms">利用規約</Link>
        </nav>
        <h1>お問い合わせ（不具合・改善リクエスト）</h1>
        <p className="legalLead">不具合、改善要望、ログイン、個人情報の開示・訂正・利用停止・削除、安全上の問題を運営へ送れます。</p>
        <form className="contactForm" onSubmit={submit}>
          <label>お問い合わせの種類
            <select name="category" defaultValue="不具合" required>
              <option>アカウント・ログイン</option>
              <option>個人情報・退会</option>
              <option>安全・通報</option>
              <option>不具合</option>
              <option>改善してほしい点</option>
              <option>その他</option>
            </select>
          </label>
          <label>返信先
            <input name="replyContact" maxLength={120} placeholder="メールアドレス、X ID、Discord IDなど" required />
          </label>
          <label>お問い合わせ内容
            <textarea name="message" minLength={10} maxLength={1000} placeholder="状況を10〜1000文字で入力してください" required />
          </label>
          <p>入力した返信先と内容は、問い合わせ対応のためにのみ使用します。</p>
          <p>個人情報に関する請求では、登録サービス、表示名、ログイン方法、請求内容を記載してください。第三者への開示を防ぐため、追加の本人確認をお願いする場合があります。</p>
          <button type="submit" disabled={sending}>{sending ? "送信中…" : "運営へ送信"}</button>
          {result && <p className={`contactResult${result.ok ? "" : " error"}`} role="status">{result.message}</p>}
        </form>
      </section>
    </main>
  );
}
