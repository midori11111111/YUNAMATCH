"use client";
import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import styles from "./brawl-preview.module.css";
import ServiceOnboarding from "../service-onboarding";
import ServiceTermsGate from "../service-terms-gate";
import ServiceReportButton from "../service-report-button";
import ServiceAccountSafety from "../service-account-safety";
import ServiceDiscordLink from "../service-discord-link";
type Tab = "find" | "team" | "chat" | "me";
type Profile = {
  id?: number;
  displayName: string;
  gameIdentity: string;
  skillTier: string;
  roles: string[];
  playTimes: string[];
  bio: string;
  avatarUrl: string;
};
type Candidate = Profile & { id: number; gender: string; age: number };
type Recruit = {
  id: number;
  mode: string;
  partySize: number;
  desiredRoles: string[];
  note: string;
  createdAt: string;
  owner: Profile | null;
};
type Connection = {
  id: number;
  status: string;
  other: Profile & { id: number };
  latestMessage: { body: string; createdAt: string } | null;
};
type Message = {
  id: number;
  senderProfileId: number;
  body: string;
  createdAt: string;
};
const nav: { id: Tab; icon: string; label: string }[] = [
  { id: "find", icon: "⌕", label: "さがす" },
  { id: "team", icon: "+", label: "募集" },
  { id: "chat", icon: "□", label: "やりとり" },
  { id: "me", icon: "○", label: "マイページ" },
];
const tiers = [
    "未設定",
    "ブロンズ",
    "シルバー",
    "ゴールド",
    "ダイヤモンド",
    "ミシック",
    "レジェンド",
    "マスター",
    "プロ",
  ],
  roles = [
    "アタッカー",
    "アサシン",
    "スナイパー",
    "グレネーディア",
    "タンク",
    "サポート",
    "コントローラー",
    "指定なし",
  ],
  modes = [
    "トロフィー",
    "ガチバトル",
    "フリープレイ",
    "マップメーカー",
    "スペシャルイベント",
    "フレンドバトル",
    "その他",
  ];
export default function BrawlPreview({
  basePath = "/brawl-preview",
}: {
  basePath?: string;
}) {
  const [auth, setAuth] = useState<
      "checking" | "guest" | "onboarding" | "consent" | "ready"
    >("checking"),
    [profile, setProfile] = useState<Profile | null>(null),
    [suggestedName, setSuggestedName] = useState(""),
    [tab, setTab] = useState<Tab>("find"),
    [toast, setToast] = useState(""),
    [profiles, setProfiles] = useState<Candidate[]>([]),
    [recruits, setRecruits] = useState<Recruit[]>([]),
    [connections, setConnections] = useState<Connection[]>([]),
    [incoming, setIncoming] = useState<Connection[]>([]),
    [outgoing, setOutgoing] = useState<Connection[]>([]),
    [activeChat, setActiveChat] = useState<Connection | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false);
  const notify = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2400);
  };
  const load = async () => {
    setLoading(true);
    try {
      const [d, r, c] = await Promise.all([
          fetch("/api/services/stamate/discover"),
          fetch("/api/services/stamate/recruits"),
          fetch("/api/services/stamate/connections"),
        ]),
        [dd, rr, cc] = await Promise.all([d.json(), r.json(), c.json()]);
      if (d.ok) setProfiles(dd.profiles || []);
      if (r.ok) setRecruits(rr.recruits || []);
      if (c.ok) {
        setConnections(cc.connections || []);
        setIncoming(cc.incoming || []);
        setOutgoing(cc.outgoing || []);
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let live = true;
    fetch("/api/services/stamate/profile")
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!live) return;
        if (response.status === 401 || !response.ok) {
          setAuth("guest");
          return;
        }
        setSuggestedName(data.suggestedName || "");
        if (data.profile) {
          setProfile(data.profile);
          setAuth(data.termsCurrent ? "ready" : "consent");
        } else setAuth("onboarding");
      })
      .catch(() => live && setAuth("guest"));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (auth === "ready") void load();
  }, [auth]);
  const current = profiles[0],
    initials = (profile?.displayName || "YOU").slice(0, 2).toUpperCase(),
    removeCurrent = () => setProfiles((value) => value.slice(1));
  async function like() {
    if (!current) return;
    const response = await fetch("/api/services/stamate/likes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetProfileId: current.id }),
      }),
      data = await response.json();
    if (response.ok) {
      notify(
        data.matched ? "相互いいねでマッチしました！" : "いいねを送りました",
      );
      removeCurrent();
      void load();
    } else notify(data.error || "送信できませんでした");
  }
  async function requestTarget(targetProfileId: number) {
    const response = await fetch("/api/services/stamate/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetProfileId }),
      }),
      data = await response.json();
    if (response.ok) {
      notify("メイト申請を送りました");
      setTab("chat");
      void load();
    } else notify(data.error || "申請できませんでした");
  }
  async function requestMate() {
    if (!current) return;
    const id = current.id;
    removeCurrent();
    await requestTarget(id);
  }
  async function act(
    connectionId: number,
    action: "accept" | "decline" | "cancel",
  ) {
    const response = await fetch("/api/services/stamate/connections", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId, action }),
      }),
      data = await response.json();
    notify(
      response.ok
        ? action === "accept"
          ? "承認してチャットを開始しました"
          : action === "cancel"
            ? "申請を取り消しました"
            : "申請をお断りしました"
        : data.error || "操作できませんでした",
    );
    if (response.ok) void load();
  }
  async function createRecruit() {
    const mode = prompt(
      `募集モード（${modes.join(" / ")}）`,
      "ガチバトル",
    );
    if (!mode) return;
    if (!modes.includes(mode)) {
      notify("表示された募集モードから選んでください");
      return;
    }
    const partySize = Number(prompt("パーティ人数（2人 / 3人 / 5人）", "3"));
    if (![2, 3, 5].includes(partySize)) {
      notify("募集人数は2人・3人・5人から選んでください");
      return;
    }
    const desiredRole = prompt(
        `希望するタイプ（任意：${roles.slice(0, -1).join(" / ")}）`,
        "",
      )?.trim(),
      note = prompt("募集のひとこと（任意）", "") || "";
    if (desiredRole && !roles.includes(desiredRole)) {
      notify("表示されたキャラクタータイプから選んでください");
      return;
    }
    const response = await fetch("/api/services/stamate/recruits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          partySize,
          desiredRoles: desiredRole ? [desiredRole] : [],
          note,
          durationMinutes: 120,
        }),
      }),
      data = await response.json();
    notify(
      response.ok ? "募集を公開しました" : data.error || "募集できませんでした",
    );
    if (response.ok) void load();
  }
  async function openChat(connection: Connection) {
    setActiveChat(connection);
    const response = await fetch(
        `/api/services/stamate/messages?connectionId=${connection.id}`,
      ),
      data = await response.json();
    setMessages(response.ok ? data.messages || [] : []);
  }
  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!activeChat || !message.trim()) return;
    const body = message.trim();
    setMessage("");
    const response = await fetch("/api/services/stamate/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectionId: activeChat.id,
          body,
          clientId: crypto.randomUUID(),
        }),
      }),
      data = await response.json();
    if (response.ok) setMessages((value) => [...value, data.message]);
    else notify(data.error || "送信できませんでした");
  }
  if (auth === "checking")
    return (
      <main className={styles.login}>
        <section className={styles.intro}>
          <Image
            className={styles.mark}
            src="/brand/stamate-mark.svg"
            alt="スタメイト"
            width={66}
            height={66}
            priority
          />
          <h1>STAMATE</h1>
          <p>プロフィールを確認しています…</p>
        </section>
      </main>
    );
  if (auth === "onboarding")
    return (
      <ServiceOnboarding
        service="stamate"
        name="スタメイト"
        suggestedName={suggestedName}
        identityLabel="プレイヤー名 / プレイヤータグ（#を含む）"
        tiers={tiers}
        roles={roles}
        returnPath={basePath}
        onComplete={(value) => {
          setProfile(value as Profile);
          setAuth("ready");
        }}
      />
    );
  if (auth === "consent")
    return (
      <ServiceTermsGate
        service="stamate"
        name="スタメイト"
        onComplete={() => setAuth("ready")}
      />
    );
  if (auth === "guest")
    return (
      <main className={styles.login}>
        <section className={styles.intro}>
          <Image
            className={styles.mark}
            src="/brand/stamate-mark.svg"
            alt="スタメイト"
            width={66}
            height={66}
            priority
          />
          <b>
            STAMATE <small>スタメイト</small>
          </b>
          <h1>
            最高のチームは、
            <br />
            相性からつくる。
          </h1>
          <p>
            トロフィーだけじゃない。得意な役割、遊びたいモード、プレイ時間からブロスタ仲間を探そう。
          </p>
          <div className={styles.bubbles}>
            <i>AT</i>
            <i>MI</i>
            <i>RE</i>
            <span>TEAM UP!</span>
          </div>
        </section>
        <section className={styles.sheet}>
          <i />
          <small>CHOOSE ACCOUNT</small>
          <h2>アカウントを選んで続ける</h2>
          <p>登録済みの方は、以前使ったアカウントを選んでください。</p>
          {[
            ["D", "Discord", "discord", "#5865f2"],
            ["𝕏", "X", "twitter", "#111"],
            ["L", "LINE", "line", "#06c755"],
          ].map((x) => (
            <button
              key={x[1]}
              onClick={() => {
                location.href = `/api/login/${x[2]}?returnTo=${encodeURIComponent(basePath)}`;
              }}
            >
              <b style={{ background: x[3] }}>{x[0]}</b>
              <span>
                <strong>{x[1]}で続ける</strong>
                <small>アカウントを選択してログイン</small>
              </span>
              <em>›</em>
            </button>
          ))}
          <p className={styles.terms}>
            続けることで<a href="/legal?service=stamate">利用条件・安全方針</a>
            と<a href="/privacy">プライバシーポリシー</a>に同意します。
            <a href="/community-guidelines">コミュニティガイドライン</a>も確認してください。
          </p>
          <footer>UNOFFICIAL COMMUNITY SERVICE · BY YUNAMATCH</footer>
        </section>
      </main>
    );
  return (
    <main className={styles.app}>
      <header>
        <button onClick={() => setTab("me")}>{initials}</button>
        <div>
          <Image
            src="/brand/stamate-mark.svg"
            alt=""
            width={36}
            height={36}
          />
          <b>
            STAMATE<small>PLAY TOGETHER</small>
          </b>
        </div>
        <button onClick={() => setTab("chat")}>
          ♢{incoming.length > 0 && <i>{incoming.length}</i>}
        </button>
      </header>
      <section className={styles.body}>
        {tab === "find" && (
          <>
            <div className={styles.top}>
              <div>
                <small>FOR YOU</small>
                <h1>仲間を探す</h1>
              </div>
              <button onClick={() => void load()}>↻ 更新</button>
            </div>
            {current ? (
              <article className={styles.card}>
                <div className={styles.cardhead}>
                  <span>● プロフィール公開中</span>
                  <b>{current.skillTier}</b>
                </div>
                <div className={styles.visual}>
                  {current.avatarUrl ? (
                    <img src={current.avatarUrl} alt="" />
                  ) : (
                    <>
                      <i />
                      <i />
                      <span>{current.displayName.slice(0, 2)}</span>
                      <strong>{current.roles[0]}</strong>
                    </>
                  )}
                </div>
                <div className={styles.info}>
                  <div className={styles.name}>
                    <span>{current.displayName.slice(0, 2)}</span>
                    <div>
                      <h2>{current.displayName}</h2>
                      <p>
                        {current.gameIdentity} ·{" "}
                        {current.gender || `${current.age}歳`}
                      </p>
                    </div>
                    <ServiceReportButton
                      service="stamate"
                      targetProfileId={current.id}
                      onNotice={notify}
                    />
                  </div>
                  <div className={styles.tags}>
                    {current.roles.map((x) => (
                      <span key={x}>{x}</span>
                    ))}
                  </div>
                  <p>{current.bio || "一緒に遊べる仲間を探しています。"}</p>
                  <small>{current.playTimes.join(" · ")}</small>
                </div>
                <div className={styles.actions}>
                  <button onClick={removeCurrent}>× 次の人</button>
                  <button onClick={like}>♡ いいね</button>
                  <button onClick={requestMate}>⚡ メイト申請</button>
                </div>
              </article>
            ) : (
              <section className={styles.screen}>
                <h1>{loading ? "読み込み中…" : "表示できる仲間がいません"}</h1>
                <p>時間を置いて更新すると、新しいプレイヤーが表示されます。</p>
                <button className={styles.create} onClick={() => void load()}>
                  再読み込み
                </button>
              </section>
            )}
          </>
        )}
        {tab === "team" && (
          <section className={styles.screen}>
            <small>TEAM FINDER</small>
            <h1>今すぐ遊べる募集</h1>
            {recruits.length ? (
              recruits.map((item) => (
                <article className={styles.recruit} key={item.id}>
                  <div>
                    <b>{item.mode}</b>
                    <time>
                      {new Date(item.createdAt).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <h2>{item.partySize}人パーティー募集</h2>
                  <p>
                    募集者：{item.owner?.displayName || "退会ユーザー"} ·{" "}
                    {item.owner?.skillTier}
                    <br />
                    希望：{item.desiredRoles.join(" / ") || "指定なし"}
                    <br />
                    {item.note}
                  </p>
                  {item.owner?.id && (
                    <button onClick={() => void requestTarget(item.owner!.id!)}>
                      この募集に参加申請
                    </button>
                  )}
                </article>
              ))
            ) : (
              <p>現在公開中の募集はありません。</p>
            )}
            <button className={styles.create} onClick={createRecruit}>
              ＋ 募集を作成
            </button>
          </section>
        )}
        {tab === "chat" && (
          <section className={styles.screen}>
            <small>MESSAGES</small>
            <h1>やりとり</h1>
            {incoming.map((item) => (
              <article className={styles.pending} key={item.id}>
                <b>⚡</b>
                <div>
                  <strong>{item.other.displayName}</strong>
                  <p>
                    {item.other.skillTier} · {item.other.roles.join(" / ")}
                  </p>
                </div>
                <button onClick={() => act(item.id, "accept")}>承認</button>
                <button onClick={() => act(item.id, "decline")}>断る</button>
              </article>
            ))}
            {outgoing.map((item) => (
              <article className={styles.pending} key={item.id}>
                <b>⚡</b>
                <div>
                  <strong>{item.other.displayName}さんへ申請中</strong>
                  <p>承認されるとチャットが始まります</p>
                </div>
                <button onClick={() => act(item.id, "cancel")}>取消</button>
              </article>
            ))}
            {connections.map((item) => (
              <button
                className={styles.message}
                key={item.id}
                onClick={() => void openChat(item)}
              >
                <b>{item.other.displayName.slice(0, 2)}</b>
                <div>
                  <strong>{item.other.displayName}</strong>
                  <p>
                    {item.latestMessage?.body ||
                      "マッチしました。挨拶してみましょう！"}
                  </p>
                </div>
              </button>
            ))}
            {!incoming.length && !outgoing.length && !connections.length && (
              <p>まだやりとりがありません。</p>
            )}
          </section>
        )}
        {tab === "me" && (
          <section className={styles.screen}>
            <div className={styles.profile}>
              <span>{initials}</span>
              <small>MY PROFILE</small>
              <h1>{profile?.displayName}</h1>
              <p>
                {profile?.skillTier} · {profile?.roles.join(" / ")}
              </p>
            </div>
            <div className={styles.stats}>
              <article>
                <b>—</b>
                <small>いいね</small>
              </article>
              <article>
                <b>{connections.length}</b>
                <small>メイト</small>
              </article>
              <article>
                <b>100%</b>
                <small>登録完了</small>
              </article>
            </div>
            <article className={styles.link}>
              <div>
                <strong>プレイヤー情報</strong>
                <small>{profile?.gameIdentity}</small>
              </div>
              <button onClick={() => setAuth("onboarding")}>編集</button>
            </article>
            <ServiceDiscordLink service="stamate" />
            <a
              className={styles.logout}
              href={`/api/auth/signout?callbackUrl=${encodeURIComponent(basePath)}`}
            >
              ログアウト
            </a>
            <ServiceAccountSafety service="stamate" onNotice={notify} />
          </section>
        )}
      </section>
      <nav>
        {nav.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? styles.active : ""}
            onClick={() => {
              setTab(item.id);
              if (item.id !== "me") void load();
            }}
          >
            <b>{item.icon}</b>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {activeChat && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "#fff",
            padding: "24px",
            overflow: "auto",
          }}
        >
          <button onClick={() => setActiveChat(null)}>← 戻る</button>
          <h2>{activeChat.other.displayName}</h2>
          <ServiceReportButton
            service="stamate"
            targetProfileId={activeChat.other.id}
            connectionId={activeChat.id}
            onNotice={notify}
            onBlocked={() => {
              setActiveChat(null);
              void load();
            }}
          />
          {messages.map((item) => (
            <p
              key={item.id}
              style={{ padding: 12, background: "#f3efff", borderRadius: 14 }}
            >
              {item.body}
            </p>
          ))}
          <form
            onSubmit={sendMessage}
            style={{
              position: "fixed",
              left: 16,
              right: 16,
              bottom: 20,
              display: "flex",
              gap: 8,
            }}
          >
            <input
              style={{
                flex: 1,
                fontSize: 16,
                padding: 14,
                borderRadius: 14,
                border: "1px solid #ddd",
              }}
              value={message}
              maxLength={500}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="メッセージを入力"
            />
            <button
              style={{
                padding: "0 18px",
                border: 0,
                borderRadius: 14,
                background: "#7357f6",
                color: "#fff",
              }}
            >
              送信
            </button>
          </form>
        </div>
      )}
      {toast && <aside>{toast}</aside>}
      <div className={styles.disclaimer}>
        このコンテンツは非公式であり、Supercellによる承認を受けていません。
        <a
          href="https://supercell.com/en/fan-content-policy/jp/"
          target="_blank"
          rel="noreferrer"
        >
          Fan Content Policy
        </a>
      </div>
    </main>
  );
}
