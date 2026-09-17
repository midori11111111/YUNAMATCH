"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./identity-preview.module.css";
import ServiceOnboarding from "../service-onboarding";
import ServiceTermsGate from "../service-terms-gate";
import ServiceReportButton from "../service-report-button";
import ServiceAccountSafety from "../service-account-safety";
import ServiceDiscordLink from "../service-discord-link";
import { matchesShoenmateRole, normalizeShoenmateTier, shoenmateCharacterGroups, shoenmateRoles, shoenmateRoleLabel, shoenmateTiers } from "../../lib/shoenmate-profile";
type Tab = "find" | "explore" | "recruit" | "chat" | "profile";
function Icon({ name }: { name: Tab | "heart" | "bell" | "arrow" | "filter" | "skip" | "info" }) {
  const paths = {
    find: <path d="m3 10 9-8 9 8v11h-6v-7H9v7H3Z" />,
    explore: <><path d="M5 21V10a7 7 0 0 1 14 0v11" /><path d="M9 21v-8h6v8M12 6v3" /></>,
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
  characters?: string[];
  playTimes: string[];
  bio: string;
  avatarUrl: string;
  age?: number;
  gender?: string;
  showGender?: boolean;
  updatedAt?: string;
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
type Message = { id: number; senderProfileId: number; body: string };
const loginProviders = [
  { id: "line", label: "LINE", mark: "L", color: "#06c755" },
  { id: "twitter", label: "X", mark: "X", color: "#181818" },
  { id: "discord", label: "Discord", mark: "D", color: "#5865f2" },
  { id: "google", label: "Google", mark: "G", color: "#4285f4" },
];
const tiers = [...shoenmateTiers],
  roles = shoenmateRoles;
type DiscoverMode = "recommended" | "received" | "skipped";
type Filters = { query: string; character: string; role: string; tier: string; activity: string };
const emptyFilters: Filters = { query: "", character: "", role: "", tier: "", activity: "" };
function activityLabel(updatedAt?: string) {
  if (!updatedAt) return "活動状況は未取得";
  const elapsed = Date.now() - new Date(updatedAt).getTime();
  if (elapsed <= 5 * 60_000) return "オンライン中";
  if (elapsed <= 3 * 60 * 60_000) return "最近オンライン";
  if (elapsed <= 24 * 60 * 60_000) return "今日アクセスあり";
  const days = Math.max(1, Math.floor(elapsed / (24 * 60 * 60_000)));
  return `${days}日前にアクセス`;
}
function matchesActivity(updatedAt: string | undefined, activity: string) {
  if (!activity) return true;
  if (!updatedAt) return false;
  const elapsed = Date.now() - new Date(updatedAt).getTime();
  const limit = activity === "online" ? 5 : activity === "recent" ? 180 : 1440;
  return elapsed <= limit * 60_000;
}
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
  const [discoverMode, setDiscoverMode] = useState<DiscoverMode>("recommended");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [receivedLikes, setReceivedLikes] = useState<{ id: number; profile: Candidate }[]>([]);
  const [skippedProfiles, setSkippedProfiles] = useState<Candidate[]>([]);
  const [detailProfile, setDetailProfile] = useState<Profile | null>(null);
  const [detailNotice, setDetailNotice] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [recruitDetail, setRecruitDetail] = useState<Recruit | null>(null);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState("");
  const filterDialog = useRef<HTMLDialogElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const recruitDetailDialog = useRef<HTMLDialogElement>(null);
  const queryRevision = useRef(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  useEffect(() => { setDetailNotice(""); if (detailProfile) detailDialog.current?.showModal(); }, [detailProfile]);
  useEffect(() => { if (recruitDetail) recruitDetailDialog.current?.showModal(); }, [recruitDetail]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("shoenmate-skipped") || "[]");
      if (Array.isArray(stored)) setSkippedProfiles(stored.slice(0, 60));
    } catch { /* Device-local history is optional. */ }
  }, []);
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
    if (selected.query) params.set("q", selected.query);
    if (selected.character) params.set("character", selected.character);
    if (selected.role) params.set("role", selected.role);
    if (selected.tier) params.set("tier", selected.tier);
    if (selected.activity) params.set("activity", selected.activity);
    const [d, r] = await Promise.all([
        params.size ? fetch(`/api/services/shoenmate/discover?${params}`) : fetch("/api/services/shoenmate/discover"),
        fetch("/api/services/shoenmate/recruits"),
      ]),
      [dd, rr] = await Promise.all([d.json(), r.json()]);
    if (revision !== queryRevision.current) return;
    if (!d.ok) throw new Error("仲間を読み込めませんでした");
    let skippedIds = new Set<number>();
    try {
      const stored = JSON.parse(localStorage.getItem("shoenmate-skipped") || "[]");
      skippedIds = new Set((Array.isArray(stored) ? stored : []).map((person: Candidate) => person.id));
    } catch { /* Device-local history is optional. */ }
    setProfiles((dd.profiles || []).filter((person: Candidate) => !skippedIds.has(person.id)));
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
  const visibleReceived = receivedLikes.filter(({ profile }) =>
    matchesShoenmateRole(profile.roles, filters.role) &&
    (!filters.tier || normalizeShoenmateTier(profile.skillTier) === filters.tier) &&
    (!filters.query || profile.displayName.includes(filters.query)) &&
    (!filters.character || profile.characters?.includes(filters.character)) &&
    matchesActivity(profile.updatedAt, filters.activity)
  );
  const activeProfiles = discoverMode === "received"
    ? visibleReceived.map(item => item.profile)
    : discoverMode === "skipped"
      ? skippedProfiles
      : profiles;
  const safeCurrentIndex = Math.min(currentIndex, Math.max(activeProfiles.length - 1, 0));
  const current = activeProfiles[safeCurrentIndex];
  const canGoPrevious = safeCurrentIndex > 0;
  const canGoNext = safeCurrentIndex < activeProfiles.length - 1;
  useEffect(() => setCurrentIndex(0), [discoverMode]);
  useEffect(() => {
    setCurrentIndex(index => Math.min(index, Math.max(activeProfiles.length - 1, 0)));
  }, [activeProfiles.length]);
  const moveProfile = (direction: -1 | 1) => {
    setCurrentIndex(index => Math.max(0, Math.min(index + direction, activeProfiles.length - 1)));
  };
  const removeCurrent = () => {
    if (discoverMode === "received") setReceivedLikes(value => value.filter(item => item.profile.id !== current?.id));
    else if (discoverMode === "skipped") setSkippedProfiles(value => {
      const next = value.filter(person => person.id !== current?.id);
      localStorage.setItem("shoenmate-skipped", JSON.stringify(next));
      return next;
    });
    else setProfiles(value => value.filter(person => person.id !== current?.id));
  };
  const skipCurrent = () => {
    if (!current) return;
    if (discoverMode === "skipped") {
      setSkippedProfiles(value => value.length > 1 ? [...value.slice(1), value[0]] : value);
      return;
    }
    setSkippedProfiles(value => {
      const next = [current, ...value.filter(person => person.id !== current.id)].slice(0, 60);
      localStorage.setItem("shoenmate-skipped", JSON.stringify(next));
      return next;
    });
    removeCurrent();
  };
  const restoreCurrent = () => {
    if (!current || discoverMode !== "skipped") return;
    setProfiles(value => [current, ...value.filter(person => person.id !== current.id)]);
    removeCurrent();
    setDiscoverMode("recommended");
    say("おすすめに戻しました");
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
            <img className={styles.seal} src="/daigomatch-icon.svg?rev=2" alt="" />
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
        identityLabel="ユーザー名"
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
    ["find", "", "探す"],
    ["recruit", "＋", "募集"],
    ["chat", "✉", "やりとり"],
    ["explore", "", "ロビー"],
    ["profile", "♙", "マイページ"],
  ];
  return (
    <main className={`${styles.app} ${tab === "find" ? styles.focusMode : ""}`}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <img src="/daigomatch-icon.svg?rev=2" alt="" width="48" height="48" />
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
                <button className={discoverMode === "skipped" ? styles.selected : ""} aria-pressed={discoverMode === "skipped"} onClick={() => setDiscoverMode("skipped")}>保留{skippedProfiles.length > 0 && <small>{skippedProfiles.length}</small>}</button>
              </div>
              <button className={styles.filterButton} aria-label="絞り込み" onClick={() => filterDialog.current?.showModal()}><Icon name="filter" />{Object.values(filters).some(Boolean) && <i />}</button>
            </div>
            {current && !publicError && !publicLoading ? (
              <article className={styles.card} key={`${discoverMode}-${current.id}`} onTouchStart={event => { if ((event.target as HTMLElement).closest("[data-card-actions]")) { swipeStart.current = null; return; } const touch = event.touches[0]; swipeStart.current = { x: touch.clientX, y: touch.clientY }; swiped.current = false; }} onTouchEnd={event => { const start = swipeStart.current; const touch = event.changedTouches[0]; if (start && Math.abs(touch.clientX - start.x) > 80 && Math.abs(touch.clientX - start.x) > Math.abs(touch.clientY - start.y) * 1.5) { swiped.current = true; moveProfile(touch.clientX < start.x ? 1 : -1); } swipeStart.current = null; }}>
                <button className={styles.portrait} aria-label={`${current.displayName}のプロフィールを見る`} onClick={() => { if (swiped.current) { swiped.current = false; return; } setDetailProfile(current); }}>
                  {current.avatarUrl ? (
                    <img src={current.avatarUrl} alt="" />
                  ) : (
                    <div className={styles.silhouette}>
                      {current.displayName.slice(0, 1)}
                    </div>
                  )}
                </button>
                <button type="button" className={`${styles.cardStepper} ${styles.cardPrevious}`} disabled={!canGoPrevious} aria-label="前の人を見る" onClick={() => moveProfile(-1)}><Icon name="arrow" /></button>
                <button type="button" className={`${styles.cardStepper} ${styles.cardNext}`} disabled={!canGoNext} aria-label="次の人を見る" onClick={() => moveProfile(1)}><Icon name="arrow" /></button>
                <div className={styles.photoProgress}><span /></div>
                <span className={styles.activityBadge}>{activityLabel(current.updatedAt)}</span>
                <div className={styles.profile}>
                  <button className={styles.profileHeading} onClick={() => setDetailProfile(current)}><h2>{current.displayName}</h2><Icon name="info" /></button>
                  <p className={styles.cardMeta}>{current.skillTier}{current.gender ? ` · ${current.gender}` : ""}</p>
                  <div className={styles.tags}>
                    {current.roles.map((role) => (
                      <span key={role}>{shoenmateRoleLabel(role)}</span>
                    ))}
                  </div>
                  {!!current.characters?.length && <p className={styles.cardMeta}>よく使うキャラ：{current.characters.slice(0,3).join(" · ")}{current.characters.length > 3 ? ` ほか${current.characters.length - 3}体` : ""}</p>}
                  <button className={styles.cardBio} onClick={() => setDetailProfile(current)}>{current.bio || "一緒に遊べる仲間を探しています。"}</button>
                  <div className={styles.actions} data-card-actions>
                    <button
                      onClick={discoverMode === "skipped" ? restoreCurrent : skipCurrent}
                    >
                      <Icon name={discoverMode === "skipped" ? "arrow" : "skip"} /><span>{discoverMode === "skipped" ? "戻す" : "保留"}</span>
                    </button>
                    <button onClick={like}><Icon name="heart" /><span>いいね</span></button>
                    <button onClick={requestMate}><Icon name="chat" /><span>メイト申請</span></button>
                  </div>
                </div>
              </article>
            ) : (
              <article className={`${styles.panel} ${styles.empty}`}>
                <img src="/daigomatch-icon.svg?rev=2" alt="" width="80" height="80" />
                <h2>{publicLoading ? "仲間を探しています…" : publicError ? "読み込みに失敗しました" : discoverMode === "received" ? "まだ表示できるいいねがありません" : discoverMode === "skipped" ? "保留中の相手はいません" : "今の条件では仲間が見つかりません"}</h2>
                <p>{publicError || (discoverMode === "received" ? "あなたへのいいねが、ここに届きます。" : discoverMode === "skipped" ? "保留した相手はここから戻せます。" : "条件を変えるか、募集から探してみましょう。")}</p>
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
              <span>MANOR LOBBY</span>
              <strong>今いる仲間に、<br />声をかけよう。</strong>
              <em>おすすめを見る <Icon name="arrow" /></em>
            </button>
            <div className={styles.sectionHeading}><h1>募集中のロビー</h1><button onClick={() => setTab("recruit")}>すべて見る</button></div>
            <p className={styles.sectionLead}>いま参加できる募集</p>
            {recruits.length ? <div className={styles.lobbyList}>
              {recruits.slice(0, 3).map(item => <button type="button" key={item.id} onClick={() => setRecruitDetail(item)}>
                <span>{item.mode}</span><strong>{item.partySize}人募集</strong><small>{item.owner?.displayName || "募集者"} · 詳細を見る</small>
              </button>)}
            </div> : <div className={styles.galleryEmpty}><p>{publicLoading ? "読み込んでいます…" : "現在公開中の募集はありません。"}</p><button className={styles.textButton} onClick={createRecruit}>募集を作る →</button></div>}
            <div className={styles.sectionHeading}><h1>仲間をさがす</h1><button aria-label="仲間を絞り込む" onClick={() => filterDialog.current?.showModal()}><Icon name="filter" /></button></div>
            <p className={styles.sectionLead}>公開中のプレイヤーをチェック</p>
            {profiles.length ? <div className={styles.peopleRail}>
              {profiles.map(person => <button className={styles.miniCard} key={person.id} onClick={() => setDetailProfile(person)}>
                {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : <span className={styles.miniInitial}>{person.displayName.slice(0,1)}</span>}
                <div><strong>{person.displayName}</strong><small>{person.skillTier}</small><span>{person.roles.slice(0,2).map(shoenmateRoleLabel).join(" · ") || "役割指定なし"}</span></div>
              </button>)}
            </div> : <div className={styles.galleryEmpty}><p>{publicLoading ? "読み込んでいます…" : publicError || "今の条件に合う仲間はまだいません。"}</p><button className={styles.textButton} onClick={() => filterDialog.current?.showModal()}>条件を変更する →</button></div>}
            <div className={styles.sectionHeading}><h2>役割から見つける</h2></div>
            <div className={styles.roleChoices}>{roles.map(role => <button key={role} onClick={() => { const next = { ...filters, role }; setFilters(next); setCurrentIndex(0); setDiscoverMode("recommended"); setTab("find"); void loadPublic(next); }}>{shoenmateRoleLabel(role)}<Icon name="arrow" /></button>)}</div>
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
              <button
                type="button"
                className={styles.recruitCard}
                key={item.id}
                onClick={() => setRecruitDetail(item)}
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
                <div className={styles.recruitLine}>
                  <span>{item.owner?.avatarUrl ? <img src={item.owner.avatarUrl} alt="" /> : (item.owner?.displayName || "募").slice(0, 1)}</span>
                  <div><strong>{item.owner?.displayName || "募集者"}</strong><small>{item.owner?.skillTier || "段位未設定"}</small></div>
                  <b>{item.partySize}人</b>
                </div>
                <p>{item.note || "ひとことはありません"}</p>
                <footer>募集の詳細を見る <Icon name="arrow" /></footer>
              </button>
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
            {!!(incoming.length || outgoing.length) && <div className={styles.listHeading}><h2>申請待ち</h2><span>{incoming.length + outgoing.length}</span></div>}
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
            {!!connections.length && <div className={styles.listHeading}><h2>チャット</h2><span>{connections.length}</span></div>}
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
              <p>{me?.skillTier}</p>
              <div className={styles.tags}>
                {me?.roles.map((role) => (
                  <span key={role}>{shoenmateRoleLabel(role)}</span>
                ))}
              </div>
              <p>よく使うキャラ：{me?.characters?.join(" · ") || "未設定"}</p>
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
              <p
                key={item.id}
                className={item.senderProfileId === me?.id ? styles.mine : ""}
              >
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
              <img className={styles.loginSeal} src="/daigomatch-icon.svg?rev=2" alt="" />
              <small>OPEN THE MANOR GATE</small>
              <h2 id="shoenmate-login-title">ログインして{loginAction}を使う</h2>
              <p>
                登録済みの方は、以前使ったものと同じSNSアカウントを選んでください。
              </p>
              <div className={styles.loginProviders}>
                {loginProviders.map((provider) => (
                  <a
                    key={provider.id}
                    href={`/api/login/${provider.id}?returnTo=${encodeURIComponent(`${basePath}?setup=1`)}&service=shoenmate`}
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
          <form key={Object.values(filters).join(":")} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next: Filters = { query: String(data.get("query") || ""), character: String(data.get("character") || ""), role: String(data.get("role") || ""), tier: String(data.get("tier") || ""), activity: String(data.get("activity") || "") }; setFilters(next); setCurrentIndex(0); filterDialog.current?.close(); void loadPublic(next); }}>
            <div className={styles.sheetHandle} />
            <button type="button" className={styles.loginClose} aria-label="絞り込みを閉じる" onClick={() => filterDialog.current?.close()}>×</button>
            <h2 id="filter-title">仲間を絞り込む</h2>
            <label>ユーザー名<input name="query" defaultValue={filters.query} maxLength={24} placeholder="名前で検索" /></label>
            <label>よく使うキャラ<select name="character" defaultValue={filters.character}><option value="">すべてのキャラ</option>{shoenmateCharacterGroups.map(group => <optgroup label={group.label} key={group.label}>{group.names.map(character => <option key={character}>{character}</option>)}</optgroup>)}</select></label>
            <label>得意な役割<select name="role" defaultValue={filters.role}><option value="">すべての役割</option>{roles.map(role => <option key={role} value={role}>{shoenmateRoleLabel(role)}</option>)}</select></label>
            <label>現在の段位<select name="tier" defaultValue={filters.tier}><option value="">すべての段位</option>{tiers.map(tier => <option key={tier}>{tier}</option>)}</select></label>
            <label>活動状況<select name="activity" defaultValue={filters.activity}><option value="">すべて</option><option value="online">オンライン中</option><option value="recent">最近オンライン（3時間以内）</option><option value="today">今日アクセスあり</option></select></label>
            <button type="button" className={styles.textButton} onClick={() => { setFilters(emptyFilters); setCurrentIndex(0); filterDialog.current?.close(); void loadPublic(emptyFilters); }}>条件をクリア</button>
            <button className={styles.primary}>この条件で探す</button>
          </form>
        </dialog>
        {detailProfile && <dialog ref={detailDialog} className={`${styles.recruitDialog} ${styles.bottomSheet} ${styles.detailSheet}`} aria-labelledby="detail-title" onClose={() => setDetailProfile(null)}>
          <div className={styles.sheetHandle} />
          <button type="button" className={styles.loginClose} aria-label="プロフィールを閉じる" onClick={() => setDetailProfile(null)}>×</button>
          <div className={styles.detailAvatar}>{detailProfile.avatarUrl ? <img src={detailProfile.avatarUrl} alt="" /> : <Icon name="profile" />}</div>
          <h2 id="detail-title">{detailProfile.displayName}</h2>
          <p>{detailProfile.skillTier}</p><p className={styles.detailActivity}>{activityLabel(detailProfile.updatedAt)}</p>
          <div className={styles.tags}>{detailProfile.roles.map(role => <span key={role}>{shoenmateRoleLabel(role)}</span>)}</div>
          <h3>よく使うキャラ</h3><p>{detailProfile.characters?.join(" · ") || "未設定"}</p>
          <h3>自己紹介</h3><p className={styles.fullBio}>{detailProfile.bio || "自己紹介はまだありません。"}</p>
          <h3>遊べる時間</h3><p>{detailProfile.playTimes.join(" · ") || "未設定"}</p>
          <button className={styles.primary} onClick={() => { const id = detailProfile.id; setDetailProfile(null); if (id) void requestTarget(id); }}>メイト申請を送る</button>
          {auth === "ready" && me && detailProfile.id ? <ServiceReportButton service="shoenmate" targetProfileId={detailProfile.id} onNotice={text => { setDetailNotice(text); say(text); }} onBlocked={() => { setDetailProfile(null); void load(); }} /> : <button className={styles.textButton} onClick={() => { setDetailProfile(null); requireProfile("通報"); }}>このプロフィールを通報</button>}
          {detailNotice && <p role="status">{detailNotice}</p>}
        </dialog>}
        {recruitDetail && <dialog ref={recruitDetailDialog} className={`${styles.recruitDialog} ${styles.bottomSheet} ${styles.recruitDetail}`} aria-labelledby="recruit-detail-title" onClose={() => setRecruitDetail(null)}>
          <div className={styles.sheetHandle} />
          <button type="button" className={styles.loginClose} aria-label="募集詳細を閉じる" onClick={() => setRecruitDetail(null)}>×</button>
          <small className={styles.eyebrow}>OPEN RECRUIT</small>
          <h2 id="recruit-detail-title">{recruitDetail.mode}・{recruitDetail.partySize}人募集</h2>
          <div className={styles.recruitOwner}>
            <span>{recruitDetail.owner?.avatarUrl ? <img src={recruitDetail.owner.avatarUrl} alt="" /> : (recruitDetail.owner?.displayName || "募").slice(0, 1)}</span>
            <div><strong>{recruitDetail.owner?.displayName || "募集者"}</strong><small>{recruitDetail.owner?.skillTier || "段位未設定"}</small></div>
          </div>
          <dl><div><dt>希望する役割</dt><dd>{recruitDetail.desiredRoles.join(" / ") || "指定なし"}</dd></div><div><dt>募集した時間</dt><dd>{new Date(recruitDetail.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</dd></div></dl>
          <h3>ひとこと</h3><p className={styles.fullBio}>{recruitDetail.note || "ひとことはありません。"}</p>
          {recruitDetail.owner?.id && <button className={styles.primary} onClick={() => { const id = recruitDetail.owner!.id!; setRecruitDetail(null); void requestTarget(id); }}>募集へ参加する</button>}
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
