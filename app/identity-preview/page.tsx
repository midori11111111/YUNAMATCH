"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./identity-preview.module.css";
import ServiceOnboarding from "../service-onboarding";
import ServiceTermsGate from "../service-terms-gate";
import ServiceReportButton from "../service-report-button";
import ServiceAccountSafety from "../service-account-safety";
import ServiceDiscordLink from "../service-discord-link";
type Tab = "find" | "explore" | "recruit" | "chat" | "profile";
function Icon({ name }: { name: Tab | "heart" | "bell" | "arrow" | "filter" | "skip" | "info" }) {
  const paths = {
    find: <path d="m3 10 9-8 9 8v11h-6v-7H9v7H3Z" />,
    explore: <><circle cx="12" cy="12" r="9" /><path d="m16 8-3 5-5 3 3-5Z" /></>,
    filter: <><path d="M3 6h5m4 0h9M3 12h11m4 0h3M3 18h3m4 0h11" /><circle cx="10" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></>,
    skip: <><path d="M5 8a8 8 0 1 1-1 8M5 3v5h5" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    recruit: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></>,
    chat: <path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0ZM7 10h8M7 14h5" />,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    heart: <path d="M20.5 4.8c-2-2-5.1-2-7.1 0L12 6.2l-1.4-1.4a5 5 0 0 0-7.1 7.1L12 21l8.5-9.1a5 5 0 0 0 0-7.1Z" />,
    bell: <><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4M12 2v2" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
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
    [loginAction, setLoginAction] = useState("この機能");
  const recruitDialog = useRef<HTMLDialogElement>(null);
  const loginDialog = useRef<HTMLDialogElement>(null);
  const [recruitBusy, setRecruitBusy] = useState(false);
  const [recruitError, setRecruitError] = useState("");
  const [discoverMode, setDiscoverMode] = useState<"recommended" | "received">("recommended");
  const [receivedLikes, setReceivedLikes] = useState<{ id: number; profile: Candidate }[]>([]);
  const [detailProfile, setDetailProfile] = useState<Profile | null>(null);
  const [detailNotice, setDetailNotice] = useState("");
  const [filters, setFilters] = useState({ role: "", tier: "" });
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState("");
  const filterDialog = useRef<HTMLDialogElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const queryRevision = useRef(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  useEffect(() => { setDetailNotice(""); if (detailProfile) detailDialog.current?.showModal(); }, [detailProfile]);
  useEffect(() => {
    if (loginOpen) loginDialog.current?.showModal();
  }, [loginOpen]);
  const say = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(""), 2200);
  };
  const loadPublic = async (selected = filters) => {
    const revision = ++queryRevision.current;
    setPublicLoading(true);
    setPublicError("");
    try {
    const params = new URLSearchParams();
    if (selected.role) params.set("role", selected.role);
    if (selected.tier) params.set("tier", selected.tier);
    const [d, r] = await Promise.all([
        params.size ? fetch(`/api/services/shoenmate/discover?${params}`) : fetch("/api/services/shoenmate/discover"),
        fetch("/api/services/shoenmate/recruits"),
      ]),
      [dd, rr] = await Promise.all([d.json(), r.json()]);
    if (revision !== queryRevision.current) return;
    if (!d.ok) throw new Error("仲間を読み込めませんでした");
    setProfiles(dd.profiles || []);
    if (r.ok) setRecruits(rr.recruits || []);
    } catch {
      if (revision === queryRevision.current) setPublicError("読み込めませんでした。もう一度お試しください。");
    } finally {
      if (revision === queryRevision.current) setPublicLoading(false);
    }
  };
  const load = async () => {
    try {
    const [, c, likes] = await Promise.all([
        loadPublic(),
        fetch("/api/services/shoenmate/connections"),
        fetch("/api/services/shoenmate/likes"),
      ]),
      cc = await c.json();
    if (c.ok) {
      setConnections(cc.connections || []);
      setIncoming(cc.incoming || []);
      setOutgoing(cc.outgoing || []);
    }
    const liked = await likes.json();
    if (likes.ok) {
      const connected = new Set([...(cc.connections || []), ...(cc.incoming || []), ...(cc.outgoing || [])].map((item: Connection) => item.other.id));
      setReceivedLikes((liked.received || []).filter((item: { profile: Candidate }) => !connected.has(item.profile.id)));
    }
    } catch { say("やりとりを読み込めませんでした。もう一度お試しください。"); }
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
        } else {
          const setupRequested =
            new URLSearchParams(window.location.search).get("setup") === "1";
          setAuth(setupRequested ? "onboarding" : "ready");
        }
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
  const visibleReceived = receivedLikes.filter(({ profile }) => (!filters.role || profile.roles.includes(filters.role)) && (!filters.tier || profile.skillTier === filters.tier));
  const current = discoverMode === "received" ? visibleReceived[0]?.profile : profiles[0];
  const removeCurrent = () => {
    if (discoverMode === "received") setReceivedLikes(value => value.filter(item => item.profile.id !== current?.id));
    else setProfiles(value => value.filter(person => person.id !== current?.id));
  };
  function requireLogin(action: string) {
    if (auth !== "guest") return false;
    setLoginAction(action);
    setLoginOpen(true);
    return true;
  }
  function requireProfile(action: string) {
    if (requireLogin(action)) return true;
    if (auth === "ready" && !me) {
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
    return response.ok;
  }
  async function requestMate() {
    if (requireProfile("メイト申請")) return;
    if (!current) return;
    const id = current.id;
    if (await requestTarget(id)) removeCurrent();
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
  function createRecruit() {
    if (requireProfile("募集の作成")) return;
    setRecruitError("");
    recruitDialog.current?.showModal();
  }
  async function publishRecruit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (recruitBusy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const mode = String(fields.get("mode"));
    const partySize = Number(fields.get("partySize"));
    const note = String(fields.get("note") || "");
    setRecruitBusy(true);
    setRecruitError("");
    try {
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
    if (response.ok) {
      recruitDialog.current?.close();
      form.reset();
      void load();
    } else setRecruitError(data.error || "募集できませんでした");
    } catch {
      setRecruitError("通信できませんでした。もう一度お試しください。");
    } finally {
      setRecruitBusy(false);
    }
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
            <img className={styles.seal} src="/daigomatch-icon.svg" alt="" />
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
        profileHeading="プレイヤー情報を登録"
        returnPath={basePath}
        initialProfile={me}
        onCancel={() => {
          history.replaceState(null, "", basePath);
          setAuth("ready");
        }}
        onComplete={(value) => {
          history.replaceState(null, "", basePath);
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
    ["find", "", "ホーム"],
    ["explore", "", "さがす"],
    ["recruit", "＋", "募集"],
    ["chat", "✉", "やりとり"],
    ["profile", "♙", "マイページ"],
  ];
  return (
    <main className={`${styles.app} ${tab === "find" ? styles.focusMode : ""}`}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <img src="/daigomatch-icon.svg" alt="" width="48" height="48" />
            <span>
              <strong>第五マッチ</strong>
              <small>DAIGO MATCH</small>
            </span>
          </div>
          <button
            aria-label={`届いた申請${incoming.length ? ` ${incoming.length}件` : ""}`}
            onClick={() => {
              if (requireProfile("届いた申請の確認")) return;
              setTab("chat");
            }}
          >
            <Icon name="bell" />{incoming.length > 0 && <span className={styles.badge}>{incoming.length}</span>}
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
            <div className={styles.discoverHeader}>
              <div className={styles.segmented} aria-label="表示する仲間">
                <button className={discoverMode === "recommended" ? styles.selected : ""} aria-pressed={discoverMode === "recommended"} onClick={() => setDiscoverMode("recommended")}>おすすめ</button>
                <button className={discoverMode === "received" ? styles.selected : ""} aria-pressed={discoverMode === "received"} onClick={() => { if (!requireProfile("相手からのいいね")) { setDiscoverMode("received"); void load(); } }}>相手から{receivedLikes.length > 0 && <small>{receivedLikes.length}</small>}</button>
              </div>
              <button className={styles.filterButton} aria-label="絞り込み" onClick={() => filterDialog.current?.showModal()}><Icon name="filter" />{(filters.role || filters.tier) && <i />}</button>
            </div>
            {current && !publicError && !publicLoading ? (
              <article className={styles.card} key={`${discoverMode}-${current.id}`} onTouchStart={event => { const touch = event.touches[0]; swipeStart.current = { x: touch.clientX, y: touch.clientY }; swiped.current = false; }} onTouchEnd={event => { const start = swipeStart.current; const touch = event.changedTouches[0]; if (start && Math.abs(touch.clientX - start.x) > 80 && Math.abs(touch.clientX - start.x) > Math.abs(touch.clientY - start.y) * 1.5) { swiped.current = true; removeCurrent(); } swipeStart.current = null; }}>
                <button className={styles.portrait} aria-label={`${current.displayName}のプロフィールを見る`} onClick={() => { if (!swiped.current) setDetailProfile(current); }}>
                  {current.avatarUrl ? (
                    <img src={current.avatarUrl} alt="" />
                  ) : (
                    <div className={styles.silhouette}>
                      {current.displayName.slice(0, 1)}
                    </div>
                  )}
                </button>
                <div className={styles.photoProgress}><span /></div>
                <div className={styles.profile}>
                  <button className={styles.profileHeading} onClick={() => setDetailProfile(current)}><h2>{current.displayName}</h2><Icon name="info" /></button>
                  <p className={styles.cardMeta}>{current.skillTier}{current.gender ? ` · ${current.gender}` : ""}</p>
                  <div className={styles.tags}>
                    {current.roles.map((role) => (
                      <span key={role}>{role}</span>
                    ))}
                  </div>
                  <button className={styles.cardBio} onClick={() => setDetailProfile(current)}>{current.bio || "一緒に遊べる仲間を探しています。"}</button>
                  <div className={styles.actions}>
                    <button
                      onClick={removeCurrent}
                    >
                      <Icon name="skip" /><span>次の人</span>
                    </button>
                    <button onClick={like}><Icon name="heart" /><span>いいね</span></button>
                    <button onClick={requestMate}><Icon name="chat" /><span>メイト申請</span></button>
                  </div>
                </div>
              </article>
            ) : (
              <article className={`${styles.panel} ${styles.empty}`}>
                <img src="/daigomatch-icon.svg" alt="" width="80" height="80" />
                <h2>{publicLoading ? "仲間を探しています…" : publicError ? "読み込みに失敗しました" : discoverMode === "received" ? "まだ表示できるいいねがありません" : "今の条件では仲間が見つかりません"}</h2>
                <p>{publicError || (discoverMode === "received" ? "あなたへのいいねが、ここに届きます。" : "条件を変えるか、募集から探してみましょう。")}</p>
                <button
                  className={styles.primary}
                  onClick={() =>
                    auth === "ready" ? void load() : void loadPublic()
                  }
                >
                  再読み込み
                </button>
                <button className={styles.textButton} onClick={() => setTab("recruit")}>募集を見てみる →</button>
              </article>
            )}
          </>
        )}
        {tab === "explore" && (
          <section className={styles.explore}>
            <button className={styles.pickup} onClick={() => { setDiscoverMode("recommended"); setTab("find"); }}>
              <span>気の合う仲間と、次の一戦へ</span>
              <strong>あなたのメイトを<br />見つけよう。</strong>
              <em>おすすめの仲間を見る <Icon name="arrow" /></em>
            </button>
            <div className={styles.sectionHeading}><h1>仲間をさがす</h1><button aria-label="仲間を絞り込む" onClick={() => filterDialog.current?.showModal()}><Icon name="filter" /></button></div>
            <p className={styles.sectionLead}>公開中のプレイヤーをチェック</p>
            {profiles.length ? <div className={styles.peopleRail}>
              {profiles.map(person => <button className={styles.miniCard} key={person.id} onClick={() => setDetailProfile(person)}>
                {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : <span className={styles.miniInitial}>{person.displayName.slice(0,1)}</span>}
                <div><strong>{person.displayName}</strong><small>{person.skillTier}</small><span>{person.roles.slice(0,2).join(" · ") || "役割指定なし"}</span></div>
              </button>)}
            </div> : <div className={styles.galleryEmpty}><p>{publicLoading ? "読み込んでいます…" : publicError || "今の条件に合う仲間はまだいません。"}</p><button className={styles.textButton} onClick={() => filterDialog.current?.showModal()}>条件を変更する →</button></div>}
            <div className={styles.sectionHeading}><h2>役割から見つける</h2></div>
            <div className={styles.roleChoices}>{roles.map(role => <button key={role} onClick={() => { const next = { ...filters, role }; setFilters(next); setDiscoverMode("recommended"); setTab("find"); void loadPublic(next); }}>{role}<Icon name="arrow" /></button>)}</div>
            <aside className={styles.guide} aria-label="仲間とつながるには">
              <div><Icon name="heart" /><strong>お互いにいいねでマッチ</strong><p>マッチしたら、チャットで相談。</p></div>
              <div><Icon name="chat" /><strong>直接誘うならメイト申請</strong><p>相手の承認後にやりとりできます。</p></div>
            </aside>
          </section>
        )}
        {tab === "recruit" && (
          <>
            <div className={styles.title}>
              <small>RECRUIT</small>
              <h1>現在の募集</h1>
              <p>遊びたいモードで、仲間と待ち合わせ。</p>
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
            {!recruits.length && <div className={`${styles.panel} ${styles.empty}`}><Icon name="recruit" /><h2>最初の募集を出してみませんか？</h2><p>遊ぶモードと人数を選ぶだけ。<br />ひとことは、決まっていなくても大丈夫。</p></div>}
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
              <div className={`${styles.panel} ${styles.empty}`}><Icon name="chat" /><h2>会話は、ここから。</h2><p>メイト申請が承認されると<br />ここでやりとりできるようになります。</p><button className={styles.primary} onClick={() => setTab("find")}>仲間を探す</button></div>
            )}
          </>
        )}
        {tab === "profile" && (
          <>
            <div className={styles.title}>
              <small>MY PAGE</small>
              <h1>プロフィール</h1>
            </div>
            <article className={`${styles.panel} ${styles.myProfile}`}>
              <div className={styles.myAvatar}>{me?.avatarUrl ? <img src={me.avatarUrl} alt="あなたのプロフィール画像" /> : <Icon name="profile" />}</div>
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
              <div className={styles.profileStats}>
                <button onClick={() => { setDiscoverMode("received"); setTab("find"); }}><Icon name="heart" /><strong>{receivedLikes.length}</strong><span>届いたいいね</span></button>
                <button onClick={() => setTab("chat")}><Icon name="chat" /><strong>{connections.length}</strong><span>メイト</span></button>
                <button onClick={() => setTab("chat")}><Icon name="bell" /><strong>{incoming.length}</strong><span>届いた申請</span></button>
              </div>
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
        <nav className={styles.nav} aria-label="メインメニュー">
          {nav.map((item) => (
            <button
              key={item[0]}
              className={tab === item[0] ? styles.active : ""}
              aria-current={tab === item[0] ? "page" : undefined}
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
              <Icon name={item[0]} />
              {item[2]}
            </button>
          ))}
        </nav>
        {activeChat && (
          <div className={styles.chatWindow}>
            <header className={styles.chatHeader}>
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
            </header>
            <div className={styles.messageList}>
            {messages.map((item) => (
              <p key={item.id}>
                {item.body}
              </p>
            ))}
            </div>
            <form
              onSubmit={sendMessage}
              className={styles.composer}
            >
              <input
                aria-label="メッセージ"
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
          <dialog
            ref={loginDialog}
            className={styles.loginBackdrop}
            aria-labelledby="shoenmate-login-title"
            onClose={() => setLoginOpen(false)}
            onClick={(event) => {
              if (event.target === event.currentTarget) setLoginOpen(false);
            }}
          >
            <section
              className={styles.loginSheet}
            >
              <button
                className={styles.loginClose}
                onClick={() => setLoginOpen(false)}
                aria-label="ログイン画面を閉じる"
              >
                ×
              </button>
              <img className={styles.loginSeal} src="/daigomatch-icon.svg" alt="" />
              <small>OPEN THE MANOR GATE</small>
              <h2 id="shoenmate-login-title">ログインして{loginAction}を使う</h2>
              <p>
                登録済みの方は、以前使ったものと同じSNSアカウントを選んでください。
              </p>
              <div className={styles.loginProviders}>
                {loginProviders.map((provider) => (
                  <a
                    key={provider.id}
                    href={`/api/login/${provider.id}?returnTo=${encodeURIComponent(`${basePath}?setup=1`)}`}
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
          </dialog>
        )}
        <dialog className={styles.recruitDialog} ref={recruitDialog} aria-labelledby="recruit-title">
          <form onSubmit={publishRecruit}>
            <button type="button" className={styles.loginClose} aria-label="募集画面を閉じる" onClick={() => recruitDialog.current?.close()}>×</button>
            <small className={styles.eyebrow}>LET’S PLAY</small>
            <h2 id="recruit-title">一緒に遊ぶ仲間を募集</h2>
            <p>募集は2時間掲載されます。</p>
            <label>遊ぶモード<select name="mode" defaultValue="ランク戦">{["ランク戦", "マルチ戦", "協力狩り", "カスタム", "その他"].map(mode => <option key={mode}>{mode}</option>)}</select></label>
            <label>パーティ人数<select name="partySize" defaultValue="4">{[2,3,4,5].map(size => <option value={size} key={size}>{size}人</option>)}</select></label>
            <label>ひとこと <small>任意</small><textarea name="note" maxLength={200} placeholder="例：ゆっくり相談しながら遊びたいです" rows={3} /></label>
            {recruitError && <p role="alert" className={styles.formError}>{recruitError}</p>}
            <button className={styles.primary} disabled={recruitBusy}>{recruitBusy ? "公開しています…" : "募集を公開する"}</button>
          </form>
        </dialog>
        <dialog ref={filterDialog} className={`${styles.recruitDialog} ${styles.bottomSheet}`} aria-labelledby="filter-title">
          <form key={`${filters.role}:${filters.tier}`} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = { role: String(data.get("role") || ""), tier: String(data.get("tier") || "") }; setFilters(next); filterDialog.current?.close(); void loadPublic(next); }}>
            <div className={styles.sheetHandle} />
            <button type="button" className={styles.loginClose} aria-label="絞り込みを閉じる" onClick={() => filterDialog.current?.close()}>×</button>
            <h2 id="filter-title">仲間を絞り込む</h2>
            <label>得意な役割<select name="role" defaultValue={filters.role}><option value="">すべての役割</option>{roles.map(role => <option key={role}>{role}</option>)}</select></label>
            <label>現在の段位<select name="tier" defaultValue={filters.tier}><option value="">すべての段位</option>{tiers.map(tier => <option key={tier}>{tier}</option>)}</select></label>
            <button type="button" className={styles.textButton} onClick={() => { const next = {role:"",tier:""}; setFilters(next); filterDialog.current?.close(); void loadPublic(next); }}>条件をクリア</button>
            <button className={styles.primary}>この条件で探す</button>
          </form>
        </dialog>
        {detailProfile && <dialog ref={detailDialog} className={`${styles.recruitDialog} ${styles.bottomSheet} ${styles.detailSheet}`} aria-labelledby="detail-title" onClose={() => setDetailProfile(null)}>
          <div className={styles.sheetHandle} />
          <button type="button" className={styles.loginClose} aria-label="プロフィールを閉じる" onClick={() => setDetailProfile(null)}>×</button>
          <div className={styles.detailAvatar}>{detailProfile.avatarUrl ? <img src={detailProfile.avatarUrl} alt="" /> : <Icon name="profile" />}</div>
          <h2 id="detail-title">{detailProfile.displayName}</h2>
          <p>{detailProfile.gameIdentity} · {detailProfile.skillTier}</p>
          <div className={styles.tags}>{detailProfile.roles.map(role => <span key={role}>{role}</span>)}</div>
          <h3>自己紹介</h3><p className={styles.fullBio}>{detailProfile.bio || "自己紹介はまだありません。"}</p>
          <h3>遊べる時間</h3><p>{detailProfile.playTimes.join(" · ") || "未設定"}</p>
          <button className={styles.primary} onClick={() => { const id = detailProfile.id; setDetailProfile(null); if (id) void requestTarget(id); }}>メイト申請を送る</button>
          {auth === "ready" && me && detailProfile.id ? <ServiceReportButton service="shoenmate" targetProfileId={detailProfile.id} onNotice={text => { setDetailNotice(text); say(text); }} onBlocked={() => { setDetailProfile(null); void load(); }} /> : <button className={styles.textButton} onClick={() => { setDetailProfile(null); requireProfile("通報"); }}>このプロフィールを通報</button>}
          {detailNotice && <p role="status">{detailNotice}</p>}
        </dialog>}
        {notice && <div className={styles.notice} role="status">{notice}</div>}
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
