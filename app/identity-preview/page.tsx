"use client";
import { FormEvent, useEffect, useState } from "react";
import styles from "./identity-preview.module.css";
import ServiceOnboarding from "../service-onboarding";
import ServiceTermsGate from "../service-terms-gate";
import ServiceReportButton from "../service-report-button";
import ServiceAccountSafety from "../service-account-safety";
import ServiceDiscordLink from "../service-discord-link";
type Tab = "find" | "recruit" | "chat" | "profile";
type Profile = {
  id?: number;
  displayName: string;
  gameIdentity: string;
  skillTier: string;
  roles: string[];
  playTimes: string[];
  bio: string;
  avatarUrl: string;
  age?: number;
  gender?: string;
  showGender?: boolean;
};
type Candidate = Profile & { id: number; age: number; gender: string };
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
  other: Profile & { id: number };
  latestMessage: { body: string } | null;
};
type Message = { id: number; body: string };
const loginProviders = [
  { id: "line", label: "LINE", mark: "L", color: "#06c755" },
  { id: "twitter", label: "X", mark: "X", color: "#181818" },
  { id: "discord", label: "Discord", mark: "D", color: "#5865f2" },
  { id: "google", label: "Google", mark: "G", color: "#4285f4" },
];
const tiers = [
    "未設定",
    "サバイバー1段",
    "サバイバー2段",
    "サバイバー3段",
    "サバイバー4段",
    "サバイバー5段",
    "サバイバー6段以上",
    "ハンター1段",
    "ハンター2段",
    "ハンター3段",
    "ハンター4段",
    "ハンター5段",
    "ハンター6段以上",
  ],
  roles = ["救助", "牽制", "補助", "解読", "ハンター", "指定なし"];
export default function IdentityPreview({
  basePath = "/identity-preview",
}: {
  basePath?: string;
}) {
  const [auth, setAuth] = useState<
      "checking" | "guest" | "onboarding" | "consent" | "ready"
    >("checking"),
    [me, setMe] = useState<Profile | null>(null),
    [suggestedName, setSuggestedName] = useState(""),
    [tab, setTab] = useState<Tab>("find"),
    [notice, setNotice] = useState(""),
    [profiles, setProfiles] = useState<Candidate[]>([]),
    [recruits, setRecruits] = useState<Recruit[]>([]),
    [connections, setConnections] = useState<Connection[]>([]),
    [incoming, setIncoming] = useState<Connection[]>([]),
    [outgoing, setOutgoing] = useState<Connection[]>([]),
    [activeChat, setActiveChat] = useState<Connection | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [message, setMessage] = useState(""),
    [loginOpen, setLoginOpen] = useState(false),
    [loginAction, setLoginAction] = useState("この機能"),
    [profileAction, setProfileAction] = useState("第五マッチ");
  const say = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(""), 2200);
  };
  const loadPublic = async () => {
    const [d, r] = await Promise.all([
        fetch("/api/services/shoenmate/discover"),
        fetch("/api/services/shoenmate/recruits"),
      ]),
      [dd, rr] = await Promise.all([d.json(), r.json()]);
    if (d.ok) setProfiles(dd.profiles || []);
    if (r.ok) setRecruits(rr.recruits || []);
  };
  const load = async () => {
    const [, c] = await Promise.all([
        loadPublic(),
        fetch("/api/services/shoenmate/connections"),
      ]),
      cc = await c.json();
    if (c.ok) {
      setConnections(cc.connections || []);
      setIncoming(cc.incoming || []);
      setOutgoing(cc.outgoing || []);
    }
  };
  useEffect(() => {
    let live = true;
    fetch("/api/services/shoenmate/profile")
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!live) return;
        if (response.status === 401 || !response.ok) {
          setAuth("guest");
          return;
        }
        setSuggestedName(data.suggestedName || "");
        if (data.profile) {
          setMe(data.profile);
          setAuth(data.termsCurrent ? "ready" : "consent");
        } else setAuth("ready");
      })
      .catch(() => live && setAuth("guest"));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (auth === "ready" && me) void load();
    if (auth === "ready" && !me) void loadPublic();
    if (auth === "guest") void loadPublic();
  }, [auth, me]);
  const current = profiles[0],
    removeCurrent = () => setProfiles((value) => value.slice(1));
  function requireLogin(action: string) {
    if (auth !== "guest") return false;
    setLoginAction(action);
    setLoginOpen(true);
    return true;
  }
  function requireProfile(action: string) {
    if (requireLogin(action)) return true;
    if (auth === "ready" && !me) {
      setProfileAction(action);
      setAuth("onboarding");
      return true;
    }
    return false;
  }
  async function like() {
    if (requireProfile("いいね")) return;
    if (!current) return;
    const response = await fetch("/api/services/shoenmate/likes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetProfileId: current.id }),
      }),
      data = await response.json();
    say(
      response.ok
        ? data.matched
          ? "相互いいねでマッチしました！"
          : "いいねを送りました"
        : data.error || "送信できませんでした",
    );
    if (response.ok) {
      removeCurrent();
      void load();
    }
  }
  async function requestTarget(targetProfileId: number) {
    if (requireProfile("メイト申請")) return;
    const response = await fetch("/api/services/shoenmate/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetProfileId }),
      }),
      data = await response.json();
    say(
      response.ok
        ? "メイト申請を送りました"
        : data.error || "申請できませんでした",
    );
    if (response.ok) {
      setTab("chat");
      void load();
    }
  }
  async function requestMate() {
    if (requireProfile("メイト申請")) return;
    if (!current) return;
    const id = current.id;
    removeCurrent();
    await requestTarget(id);
  }
  async function act(
    connectionId: number,
    action: "accept" | "decline" | "cancel",
  ) {
    const response = await fetch("/api/services/shoenmate/connections", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId, action }),
      }),
      data = await response.json();
    say(
      response.ok
        ? action === "accept"
          ? "承認しました"
          : "申請を更新しました"
        : data.error || "操作できませんでした",
    );
    if (response.ok) void load();
  }
  async function createRecruit() {
    if (requireProfile("募集の作成")) return;
    const mode = prompt(
      "モード（ランク戦 / マルチ戦 / 協力狩り / カスタム / その他）",
      "ランク戦",
    );
    if (!mode) return;
    const partySize = Number(prompt("パーティ人数（2〜5）", "4")),
      note = prompt("募集のひとこと（任意）", "") || "";
    const response = await fetch("/api/services/shoenmate/recruits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          partySize,
          desiredRoles: [],
          note,
          durationMinutes: 120,
        }),
      }),
      data = await response.json();
    say(
      response.ok ? "募集を公開しました" : data.error || "募集できませんでした",
    );
    if (response.ok) void load();
  }
  async function openChat(connection: Connection) {
    if (requireProfile("やりとり")) return;
    setActiveChat(connection);
    const response = await fetch(
        `/api/services/shoenmate/messages?connectionId=${connection.id}`,
      ),
      data = await response.json();
    setMessages(response.ok ? data.messages || [] : []);
  }
  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!activeChat || !message.trim()) return;
    const body = message.trim();
    setMessage("");
    const response = await fetch("/api/services/shoenmate/messages", {
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
    else say(data.error || "送信できませんでした");
  }
  if (auth === "checking")
    return (
      <main className={styles.app}>
        <div className={styles.login}>
          <section className={styles.hero}>
            <div className={styles.seal}>五</div>
            <h1>第五マッチ</h1>
            <p>プロフィールを確認しています…</p>
          </section>
        </div>
      </main>
    );
  if (auth === "onboarding")
    return (
      <ServiceOnboarding
        service="shoenmate"
        name="第五マッチ"
        suggestedName={suggestedName}
        identityLabel="ゲーム内プレイヤー名・ID"
        tiers={tiers}
        roles={roles}
        profileHeading={`${profileAction}にはプレイヤー情報が必要です`}
        returnPath={basePath}
        initialProfile={me}
        onCancel={() => setAuth("ready")}
        onComplete={(value) => {
          setMe(value as Profile);
          setAuth("ready");
        }}
      />
    );
  if (auth === "consent")
    return (
      <ServiceTermsGate
        service="shoenmate"
        name="第五マッチ"
        onComplete={() => setAuth("ready")}
      />
    );
  const nav: [Tab, string, string][] = [
    ["find", "⌕", "さがす"],
    ["recruit", "＋", "募集"],
    ["chat", "✉", "やりとり"],
    ["profile", "♙", "マイページ"],
  ];
  return (
    <main className={styles.app}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <b>五</b>
            <span>
              <strong>第五マッチ</strong>
              <small>DAIGO MATCH</small>
            </span>
          </div>
          <button
            onClick={() => {
              if (requireProfile("届いた申請の確認")) return;
              setTab("chat");
            }}
          >
            ♢{incoming.length || ""}
          </button>
        </header>
        <aside className={styles.betaBar}>
          <b>無料限定ベータ</b>
          <span>非公式／公式素材・公式API不使用</span>
          <a href="/legal?service=shoenmate">確認する</a>
        </aside>
        {auth === "guest" && (
          <aside className={styles.guestBanner}>
            <div>
              <strong>登録前でも仲間と募集を見られます</strong>
              <span>いいね・申請・募集・やりとりはログイン後に使えます。</span>
            </div>
            <button onClick={() => requireLogin("第五マッチ")}>ログイン</button>
          </aside>
        )}
        {auth === "ready" && !me && (
          <aside className={styles.guestBanner}>
            <div>
              <strong>ログインできました</strong>
              <span>
                まずはサイトを見てみてください。使いたい機能を押した時にプレイヤー情報を登録します。
              </span>
            </div>
            <button onClick={() => requireProfile("プロフィール登録")}>
              登録する
            </button>
          </aside>
        )}
        {tab === "find" && (
          <>
            <div className={styles.title}>
              <small>DISCOVER</small>
              <h1>一緒に遊ぶ人を探す</h1>
            </div>
            {current ? (
              <article className={styles.card}>
                <div className={styles.portrait}>
                  {current.avatarUrl ? (
                    <img src={current.avatarUrl} alt="" />
                  ) : (
                    <div className={styles.silhouette}>
                      {current.displayName.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className={styles.profile}>
                  <h2>{current.displayName}</h2>
                  <p>
                    {current.gameIdentity}・{current.skillTier}・
                    {current.gender || `${current.age}歳`}
                  </p>
                  <div className={styles.tags}>
                    {current.roles.map((role) => (
                      <span key={role}>{role}</span>
                    ))}
                  </div>
                  <p>{current.bio || "一緒に遊べる仲間を探しています。"}</p>
                  <small>{current.playTimes.join(" · ")}</small>
                  {auth !== "ready" || !me ? (
                    <button
                      className={styles.textButton}
                      onClick={() => requireProfile("通報")}
                    >
                      このプロフィールを通報
                    </button>
                  ) : (
                    <ServiceReportButton
                      service="shoenmate"
                      targetProfileId={current.id}
                      onNotice={say}
                    />
                  )}
                  <div className={styles.actions}>
                    <button
                      onClick={() => {
                        removeCurrent();
                        if (profiles.length <= 1) void loadPublic();
                      }}
                    >
                      次の人
                    </button>
                    <button onClick={like}>♡ いいね</button>
                    <button onClick={requestMate}>封蝋で申請</button>
                  </div>
                </div>
              </article>
            ) : (
              <article className={styles.panel}>
                <h2>表示できるプレイヤーがいません</h2>
                <button
                  className={styles.primary}
                  onClick={() =>
                    auth === "ready" ? void load() : void loadPublic()
                  }
                >
                  再読み込み
                </button>
              </article>
            )}
          </>
        )}
        {tab === "recruit" && (
          <>
            <div className={styles.title}>
              <small>RECRUIT</small>
              <h1>現在の募集</h1>
            </div>
            {recruits.map((item) => (
              <article
                className={`${styles.panel} ${styles.recruit}`}
                key={item.id}
              >
                <header>
                  <strong>{item.mode}</strong>
                  <small>
                    {new Date(item.createdAt).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </header>
                <h2>{item.partySize}人パーティー募集</h2>
                <p>
                  {item.owner?.displayName}／{item.owner?.skillTier}／
                  {item.desiredRoles.join(" / ") || "役割指定なし"}
                  <br />
                  {item.note}
                </p>
                {item.owner?.id && (
                  <button
                    className={styles.primary}
                    onClick={() => void requestTarget(item.owner!.id!)}
                  >
                    募集へ参加する
                  </button>
                )}
              </article>
            ))}
            {!recruits.length && <p>現在公開中の募集はありません。</p>}
            <button className={styles.primary} onClick={createRecruit}>
              募集を作成する
            </button>
          </>
        )}
        {tab === "chat" && (
          <>
            <div className={styles.title}>
              <small>MESSAGES</small>
              <h1>やりとり</h1>
            </div>
            {incoming.map((item) => (
              <article
                className={`${styles.panel} ${styles.chat}`}
                key={item.id}
              >
                <span>申</span>
                <div>
                  <strong>{item.other.displayName}</strong>
                  <small>メイト申請が届いています</small>
                </div>
                <button onClick={() => act(item.id, "accept")}>承認</button>
                <button onClick={() => act(item.id, "decline")}>断る</button>
              </article>
            ))}
            {outgoing.map((item) => (
              <article
                className={`${styles.panel} ${styles.chat}`}
                key={item.id}
              >
                <span>待</span>
                <div>
                  <strong>{item.other.displayName}</strong>
                  <small>承認待ち</small>
                </div>
                <button onClick={() => act(item.id, "cancel")}>取消</button>
              </article>
            ))}
            {connections.map((item) => (
              <button
                type="button"
                className={`${styles.panel} ${styles.chat}`}
                key={item.id}
                onClick={() => void openChat(item)}
              >
                <span>{item.other.displayName.slice(0, 1)}</span>
                <div>
                  <strong>{item.other.displayName}</strong>
                  <small>{item.latestMessage?.body || "マッチしました"}</small>
                </div>
                <b>›</b>
              </button>
            ))}
            {!incoming.length && !outgoing.length && !connections.length && (
              <p>まだやりとりがありません。</p>
            )}
          </>
        )}
        {tab === "profile" && (
          <>
            <div className={styles.title}>
              <small>MY PAGE</small>
              <h1>プロフィール</h1>
            </div>
            <article className={styles.panel}>
              <h2>{me?.displayName}</h2>
              <p>
                {me?.gameIdentity}・{me?.skillTier}
              </p>
              <div className={styles.tags}>
                {me?.roles.map((role) => (
                  <span key={role}>{role}</span>
                ))}
              </div>
              <p>{me?.bio}</p>
              <button
                className={styles.primary}
                onClick={() => setAuth("onboarding")}
              >
                プロフィールを編集
              </button>
              <ServiceDiscordLink service="shoenmate" />
              <a
                href={`/api/auth/signout?callbackUrl=${encodeURIComponent(basePath)}`}
              >
                ログアウト
              </a>
              <ServiceAccountSafety service="shoenmate" onNotice={say} />
            </article>
          </>
        )}
        <nav className={styles.nav}>
          {nav.map((item) => (
            <button
              key={item[0]}
              className={tab === item[0] ? styles.active : ""}
              onClick={() => {
                if (
                  (auth === "guest" || (auth === "ready" && !me)) &&
                  (item[0] === "chat" || item[0] === "profile")
                ) {
                  requireProfile(
                    item[0] === "chat" ? "やりとり" : "マイページ",
                  );
                  return;
                }
                setTab(item[0]);
                if (auth === "ready") void load();
                else void loadPublic();
              }}
            >
              <b>{item[1]}</b>
              {item[2]}
            </button>
          ))}
        </nav>
        {activeChat && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 300,
              background: "#f8f4eb",
              padding: 24,
              overflow: "auto",
            }}
          >
            <button onClick={() => setActiveChat(null)}>← 戻る</button>
            <h2>{activeChat.other.displayName}</h2>
            <ServiceReportButton
              service="shoenmate"
              targetProfileId={activeChat.other.id}
              connectionId={activeChat.id}
              onNotice={say}
              onBlocked={() => {
                setActiveChat(null);
                void load();
              }}
            />
            {messages.map((item) => (
              <p
                key={item.id}
                style={{ padding: 12, background: "#fff", borderRadius: 14 }}
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
                  border: "1px solid #bbb",
                }}
                value={message}
                maxLength={500}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="メッセージを入力"
              />
              <button className={styles.primary}>送信</button>
            </form>
          </div>
        )}
        {auth === "guest" && loginOpen && (
          <div
            className={styles.loginBackdrop}
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) setLoginOpen(false);
            }}
          >
            <section
              className={styles.loginSheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby="shoenmate-login-title"
            >
              <button
                className={styles.loginClose}
                onClick={() => setLoginOpen(false)}
                aria-label="ログイン画面を閉じる"
              >
                ×
              </button>
              <div className={styles.loginSeal}>五</div>
              <small>OPEN THE MANOR GATE</small>
              <h2 id="shoenmate-login-title">ログインして{loginAction}を使う</h2>
              <p>
                登録済みの方は、以前使ったものと同じSNSアカウントを選んでください。
              </p>
              <div className={styles.loginProviders}>
                {loginProviders.map((provider) => (
                  <a
                    key={provider.id}
                    href={`/api/login/${provider.id}?returnTo=${encodeURIComponent(basePath)}`}
                  >
                    <b style={{ background: provider.color }}>{provider.mark}</b>
                    <span>
                      <strong>{provider.label}で続ける</strong>
                      <small>ログイン／新規登録</small>
                    </span>
                    <em>›</em>
                  </a>
                ))}
              </div>
              <p className={styles.consent}>
                続けることで
                <a href="/legal?service=shoenmate">利用条件・安全方針</a>と
                <a href="/privacy">プライバシーポリシー</a>に同意します。
              </p>
            </section>
          </div>
        )}
        {notice && <div className={styles.notice}>{notice}</div>}
        <footer className={styles.disclaimer}>
          本サービスはNetEase GamesおよびIdentity
          V／第五人格の公式サービスではありません。
          <br />
          <a href="/legal?service=shoenmate">規約・安全方針を見る</a>
        </footer>
      </div>
    </main>
  );
}
