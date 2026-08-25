"use client";
import { useEffect, useState } from "react";

type Block = { id: number; blockedProfileId: number; displayName: string };

export default function ServiceAccountSafety({
  service,
  onNotice,
}: {
  service: string;
  onNotice: (text: string) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>([]),
    [busy, setBusy] = useState(false);
  async function load() {
    const response = await fetch(`/api/services/${service}/safety`),
      data = await response.json();
    if (response.ok) setBlocks(data.blocks || []);
  }
  useEffect(() => {
    void load();
  }, [service]);
  async function unblock(item: Block) {
    setBusy(true);
    const response = await fetch(`/api/services/${service}/safety`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetProfileId: item.blockedProfileId }),
    });
    setBusy(false);
    if (response.ok) {
      setBlocks((current) => current.filter((row) => row.id !== item.id));
      onNotice(`${item.displayName}さんのブロックを解除しました`);
    } else onNotice("ブロックを解除できませんでした");
  }
  async function removeAccount() {
    const confirmation = prompt(
      "このサービス内のプロフィール・募集・いいね・マッチ・チャットを削除します。\n続ける場合は「削除」と入力してください。",
    );
    if (confirmation !== "削除") return;
    if (!confirm("削除後は元に戻せません。本当に退会しますか？")) return;
    setBusy(true);
    const response = await fetch(`/api/services/${service}/profile`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation }),
      }),
      data = await response.json();
    setBusy(false);
    if (!response.ok) return onNotice(data.error || "退会できませんでした");
    location.reload();
  }
  return (
    <section
      style={{
        marginTop: 18,
        padding: 18,
        border: "1px solid #ddd",
        borderRadius: 18,
        background: "#fff",
      }}
    >
      <h3>安全・アカウント設定</h3>
      <p style={{ fontSize: 12, color: "#777" }}>
        ブロックした相手は検索・募集・申請・チャットに表示されません。
      </p>
      {blocks.map((item) => (
        <div
          key={item.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <span>{item.displayName}</span>
          <button disabled={busy} onClick={() => void unblock(item)}>
            解除
          </button>
        </div>
      ))}
      {!blocks.length && (
        <p style={{ fontSize: 12, color: "#999" }}>
          ブロック中の相手はいません
        </p>
      )}
      <button
        style={{ marginTop: 18, color: "#b3263f" }}
        disabled={busy}
        onClick={() => void removeAccount()}
      >
        {busy ? "処理中…" : "このサービスから退会"}
      </button>
    </section>
  );
}
