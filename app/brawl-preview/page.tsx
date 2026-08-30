"use client";
import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import styles from "./brawl-preview.module.css";
import ServiceOnboarding from "../service-onboarding";
import ServiceTermsGate from "../service-terms-gate";
import ServiceReportButton from "../service-report-button";
import ServiceAccountSafety from "../service-account-safety";
import ServiceDiscordLink from "../service-discord-link";
import { stamateBrawlers } from "../../lib/stamate-brawlers";
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
  age?: number;
  gender?: string;
  showGender?: boolean;
};
type Candidate = Profile & { id: number; gender: string; age: number };
type ReceivedLike = { id: number; createdAt: string; profile: Candidate };
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
  kind: "text" | "play_invite";
  response: "accepted" | "declined" | null;
  canRespond: boolean;
  reactions: Array<{ reaction: string; count: number }>;
  myReaction: string | null;
  deleted?: boolean;
};
type Filters = { brawler: string; tier: string };
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
  brawlers = [...stamateBrawlers],
  brawlerSet = new Set<string>(brawlers),
  modes = [
    "トロフィー",
    "ガチバトル",
    "フリープレイ",
    "マップメーカー",
    "スペシャルイベント",
    "フレンドバトル",
    "その他",
  ];
const validBrawlers = (values: string[]) =>
  values.filter((value) => brawlerSet.has(value));
function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "たった今";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}
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
    [tab, setTab] = useState<Tab>(() => {
      if (typeof window === "undefined") return "find";
      const saved = window.localStorage.getItem("stamate:last-tab");
      return nav.some((item) => item.id === saved) ? (saved as Tab) : "find";
    }),
    [findView, setFindView] = useState<"recommended" | "received">(
      "recommended",
    ),
    [toast, setToast] = useState(""),
    [profiles, setProfiles] = useState<Candidate[]>([]),
    [receivedLikes, setReceivedLikes] = useState<ReceivedLike[]>([]),
    [recruits, setRecruits] = useState<Recruit[]>([]),
    [connections, setConnections] = useState<Connection[]>([]),
    [incoming, setIncoming] = useState<Connection[]>([]),
    [outgoing, setOutgoing] = useState<Connection[]>([]),
    [activeChat, setActiveChat] = useState<Connection | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false),
    [chatLoading, setChatLoading] = useState(false),
    [chatError, setChatError] = useState(""),
    [chatMenuOpen, setChatMenuOpen] = useState(false),
    [quickMessageOpen, setQuickMessageOpen] = useState(false),
    [reactionPickerId, setReactionPickerId] = useState<number | null>(null),
    [reactionUpdatingId, setReactionUpdatingId] = useState<number | null>(null),
    [playInviteSending, setPlayInviteSending] = useState(false),
    [respondingInviteId, setRespondingInviteId] = useState<number | null>(null),
    [conversationCloseOpen, setConversationCloseOpen] = useState(false),
    [conversationCloseReason, setConversationCloseReason] = useState(""),
    [conversationCloseNote, setConversationCloseNote] = useState(""),
    [conversationClosing, setConversationClosing] = useState(false),
    [filterOpen, setFilterOpen] = useState(false),
    [tutorialOpen, setTutorialOpen] = useState(false),
    [recruitOpen, setRecruitOpen] = useState(false),
    [expandedRecruitId, setExpandedRecruitId] = useState<number | null>(null),
    [viewProfile, setViewProfile] = useState<Profile | null>(null),
    [filters, setFilters] = useState<Filters>(() => {
      if (typeof window === "undefined") return { brawler: "", tier: "" };
      try {
        const stored = JSON.parse(
          window.localStorage.getItem("stamate:filters") ||
            '{"brawler":"","tier":""}',
        ) as Filters & { role?: string };
        return {
          brawler: stored.brawler || "",
          tier: stored.tier || "",
        };
      } catch {
        return { brawler: "", tier: "" };
      }
    }),
    [recruitForm, setRecruitForm] = useState({
      mode: "ガチバトル",
      partySize: "3",
      desiredBrawler: "",
      startAt: "",
      durationMinutes: "120",
      note: "",
    });
  const notify = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2400);
  };
  const load = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextFilters.brawler) params.set("role", nextFilters.brawler);
      if (nextFilters.tier) params.set("tier", nextFilters.tier);
      const discoverRequest = params.size
        ? fetch(`/api/services/stamate/discover?${params}`)
        : fetch("/api/services/stamate/discover");
      const [d, r, c] = await Promise.all([
          discoverRequest,
          fetch("/api/services/stamate/recruits"),
          fetch("/api/services/stamate/connections"),
        ]),
        likes = await fetch("/api/services/stamate/likes"),
        [dd, rr, cc, ll] = await Promise.all([
          d.json(),
          r.json(),
          c.json(),
          likes.json(),
        ]);
      if (d.ok) setProfiles(dd.profiles || []);
      if (r.ok) setRecruits(rr.recruits || []);
      if (c.ok) {
        setConnections(cc.connections || []);
        setIncoming(cc.incoming || []);
        setOutgoing(cc.outgoing || []);
      }
      if (likes.ok) setReceivedLikes(ll.received || []);
      if (![d, r, c, likes].every((response) => response.ok))
        notify("一部の情報を更新できませんでした。前回の表示を残しています");
    } catch {
      notify("通信に失敗しました。表示中の情報はそのまま残しています");
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
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("stamate:last-tab", tab);
  }, [tab]);
  useEffect(() => {
    if (auth !== "ready" || typeof window === "undefined") return;
    if (!window.localStorage.getItem("stamate:tutorial-seen"))
      setTutorialOpen(true);
  }, [auth]);
  const current = profiles[0],
    receivedCurrent = receivedLikes[0]?.profile,
    initials = (profile?.displayName || "YOU").slice(0, 2).toUpperCase(),
    currentBrawlers = validBrawlers(profile?.roles || []),
    removeCurrent = () => setProfiles((value) => value.slice(1)),
    completionItems = [
      ["プレイヤー名", profile?.displayName],
      ["プレイヤータグ", profile?.gameIdentity],
      ["ランク", profile?.skillTier && profile.skillTier !== "未設定"],
      ["よく使うキャラ", currentBrawlers.length],
      ["遊べる時間", profile?.playTimes?.length],
      ["自己紹介", profile?.bio],
      ["アイコン", profile?.avatarUrl],
    ] as const,
    completedCount = completionItems.filter(([, value]) => Boolean(value)).length,
    completion = Math.round((completedCount / completionItems.length) * 100),
    missingItems = completionItems
      .filter(([, value]) => !value)
      .map(([label]) => label);
  async function likeTarget(targetProfileId: number, after: () => void) {
    const response = await fetch("/api/services/stamate/likes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetProfileId }),
      }),
      data = await response.json();
    if (response.ok) {
      notify(
        data.matched ? "相互いいねでマッチしました！" : "いいねを送りました",
      );
      after();
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
    const partySize = Number(recruitForm.partySize),
      desiredBrawler = recruitForm.desiredBrawler,
      startAt = recruitForm.startAt
        ? new Date(recruitForm.startAt).toISOString()
        : undefined;
    if (![2, 3, 5].includes(partySize)) {
      notify("募集人数は2人・3人・5人から選んでください");
      return;
    }
    const response = await fetch("/api/services/stamate/recruits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: recruitForm.mode,
          partySize,
          desiredRoles: desiredBrawler ? [desiredBrawler] : [],
          note: recruitForm.note,
          startAt,
          durationMinutes: Number(recruitForm.durationMinutes),
        }),
      }),
      data = await response.json();
    notify(
      response.ok ? "募集を公開しました" : data.error || "募集できませんでした",
    );
    if (response.ok) {
      setRecruitOpen(false);
      setRecruitForm((value) => ({ ...value, note: "", startAt: "" }));
      void load();
    }
  }
  async function openChat(connection: Connection) {
    setActiveChat(connection);
    setChatMenuOpen(false);
    setQuickMessageOpen(false);
    setReactionPickerId(null);
    setChatLoading(true);
    setChatError("");
    try {
      const controller = new AbortController(),
        timeout = window.setTimeout(() => controller.abort(), 12_000),
        response = await fetch(
          `/api/services/stamate/messages?connectionId=${connection.id}`,
          { signal: controller.signal },
        );
      window.clearTimeout(timeout);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "読み込めませんでした");
      setMessages(data.messages || []);
    } catch (value) {
      setChatError(
        value instanceof Error && value.name !== "AbortError"
          ? value.message
          : "読み込みに時間がかかっています。再試行してください",
      );
    } finally {
      setChatLoading(false);
    }
  }
  async function postMessage(
    body: string,
    kind: "text" | "play_invite" = "text",
  ) {
    if (!activeChat || !body.trim()) return false;
    const response = await fetch("/api/services/stamate/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectionId: activeChat.id,
          body: body.trim(),
          kind,
          clientId: crypto.randomUUID(),
        }),
      }),
      data = await response.json();
    if (response.ok) {
      setMessages((value) =>
        value.some((item) => item.id === data.message.id)
          ? value
          : [...value, data.message],
      );
      return true;
    }
    notify(data.error || "送信できませんでした");
    return false;
  }
  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const body = message.trim();
    if (!body) return;
    if (await postMessage(body)) setMessage("");
  }
  async function sendQuickMessage(body: string) {
    if (await postMessage(body)) {
      setQuickMessageOpen(false);
      notify("ひとことを送りました");
    }
  }
  async function sendPlayInvite() {
    if (playInviteSending) return;
    setPlayInviteSending(true);
    try {
      if (await postMessage("一緒にプレイしませんか？", "play_invite"))
        notify("一緒にプレイの申請を送りました");
    } finally {
      setPlayInviteSending(false);
    }
  }
  async function respondPlayInvite(
    messageId: number,
    responseValue: "accepted" | "declined",
  ) {
    if (respondingInviteId !== null) return;
    setRespondingInviteId(messageId);
    try {
      const response = await fetch("/api/services/stamate/messages", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messageId, response: responseValue }),
        }),
        data = await response.json();
      if (!response.ok) {
        notify(data.error || "回答できませんでした");
        return;
      }
      setMessages((rows) =>
        rows.map((row) => (row.id === messageId ? data.message : row)),
      );
      notify(
        responseValue === "accepted"
          ? "一緒にプレイすることになりました！"
          : "今回は見送りました",
      );
    } finally {
      setRespondingInviteId(null);
    }
  }
  async function reactToMessage(item: Message, reaction: string) {
    if (reactionUpdatingId !== null || item.deleted) return;
    setReactionUpdatingId(item.id);
    try {
      const response = await fetch(
          "/api/services/stamate/message-reactions",
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              messageId: item.id,
              reaction: item.myReaction === reaction ? null : reaction,
            }),
          },
        ),
        data = await response.json();
      if (!response.ok) {
        notify(data.error || "リアクションできませんでした");
        return;
      }
      setMessages((rows) =>
        rows.map((row) =>
          row.id === item.id
            ? {
                ...row,
                reactions: data.reactions || [],
                myReaction: data.myReaction || null,
              }
            : row,
        ),
      );
      setReactionPickerId(null);
    } finally {
      setReactionUpdatingId(null);
    }
  }
  async function closeConversation() {
    if (!activeChat || !conversationCloseReason || conversationClosing) return;
    setConversationClosing(true);
    try {
      const farewell = [
        "今回は会話を見送ります",
        conversationCloseReason,
        conversationCloseNote.trim(),
      ]
        .filter(Boolean)
        .join("。")
        .slice(0, 220);
      if (!(await postMessage(farewell))) return;
      const response = await fetch("/api/services/stamate/connections", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            connectionId: activeChat.id,
            action: "archive",
          }),
        }),
        data = await response.json();
      if (!response.ok) {
        notify(data.error || "会話を終了できませんでした");
        return;
      }
      setConversationCloseOpen(false);
      setChatMenuOpen(false);
      setActiveChat(null);
      setConversationCloseReason("");
      setConversationCloseNote("");
      notify("一言を伝えて、会話を一覧から閉じました");
      void load();
    } finally {
      setConversationClosing(false);
    }
  }
  function applyFilters() {
    window.localStorage.setItem("stamate:filters", JSON.stringify(filters));
    setFilterOpen(false);
    void load(filters);
  }
  function closeTutorial() {
    window.localStorage.setItem("stamate:tutorial-seen", "1");
    setTutorialOpen(false);
  }
  function candidateCard(candidate: Candidate, received = false) {
    const candidateBrawlers = validBrawlers(candidate.roles);
    const onSkip = () =>
      received
        ? setReceivedLikes((value) => value.slice(1))
        : removeCurrent();
    return (
      <article className={styles.card} key={`${received ? "received" : "recommended"}-${candidate.id}`}>
        <div className={styles.cardhead}>
          <span>{received ? "♥ あなたにいいね" : "● プロフィール公開中"}</span>
          <b>{candidate.skillTier}</b>
        </div>
        <button
          className={styles.visual}
          onClick={() => setViewProfile(candidate)}
          aria-label={`${candidate.displayName}さんの詳しいプロフィールを見る`}
        >
          {candidate.avatarUrl ? (
            <img src={candidate.avatarUrl} alt="" />
          ) : (
            <>
              <i />
              <i />
              <span>{candidate.displayName.slice(0, 2)}</span>
              <strong>{candidateBrawlers[0] || "キャラ未設定"}</strong>
            </>
          )}
          <em>タップで詳しく見る</em>
        </button>
        <div className={styles.info}>
          <div className={styles.name}>
            <span>{candidate.displayName.slice(0, 2)}</span>
            <div>
              <h2>{candidate.displayName}</h2>
              <p>
                {candidate.gameIdentity}
                {candidate.gender ? ` · ${candidate.gender}` : ""}
              </p>
            </div>
            <ServiceReportButton
              service="stamate"
              targetProfileId={candidate.id}
              onNotice={notify}
            />
          </div>
          <div className={styles.tags}>
            {candidateBrawlers.length ? (
              candidateBrawlers.map((x) => <span key={x}>{x}</span>)
            ) : (
              <span>キャラ未設定</span>
            )}
          </div>
          <p>{candidate.bio || "一緒に遊べる仲間を探しています。"}</p>
          <small>{candidate.playTimes.join(" · ")}</small>
        </div>
        <div className={styles.actions}>
          <button onClick={onSkip}>× スキップ</button>
          <button
            onClick={() =>
              void likeTarget(candidate.id, () => {
                if (received) setReceivedLikes((value) => value.slice(1));
                else removeCurrent();
              })
            }
          >
            ♡ いいね
          </button>
          <button onClick={() => void requestTarget(candidate.id)}>
            ⚡ メイト申請
          </button>
        </div>
      </article>
    );
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
        roles={brawlers}
        selectionLabel="よく使うキャラ（最大5体）"
        selectionPicker
        selectionPlaceholder="キャラを選ぶ"
        returnPath={basePath}
        initialProfile={profile}
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
            トロフィーだけじゃない。よく使うキャラ、遊びたいモード、プレイ時間からブロスタ仲間を探そう。
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
            ["G", "Google", "google", "#4285f4"],
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
        <button onClick={() => setTab("me")} aria-label="マイページ">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" />
          ) : (
            initials
          )}
        </button>
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
        <button onClick={() => setTab("chat")} aria-label="申請とやりとり">
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
              <div className={styles.topActions}>
                <button onClick={() => setTutorialOpen(true)}>？ 使い方</button>
                <button onClick={() => setFilterOpen(true)}>≡ 絞り込み</button>
              </div>
            </div>
            <div className={styles.findTabs}>
              <button
                className={findView === "recommended" ? styles.selected : ""}
                onClick={() => setFindView("recommended")}
              >
                おすすめ <span>{profiles.length}</span>
              </button>
              <button
                className={findView === "received" ? styles.selected : ""}
                onClick={() => setFindView("received")}
              >
                相手から <span>{receivedLikes.length}</span>
              </button>
              <button onClick={() => void load()}>↻</button>
            </div>
            {(filters.brawler || filters.tier) && (
              <div className={styles.activeFilters}>
                <span>絞り込み中</span>
                {filters.brawler && <b>{filters.brawler}</b>}
                {filters.tier && <b>{filters.tier}</b>}
                <button
                  onClick={() => {
                    const reset = { brawler: "", tier: "" };
                    setFilters(reset);
                    window.localStorage.removeItem("stamate:filters");
                    void load(reset);
                  }}
                >
                  解除
                </button>
              </div>
            )}
            {findView === "recommended" && current ? (
              candidateCard(current)
            ) : findView === "received" && receivedCurrent ? (
              candidateCard(receivedCurrent, true)
            ) : (
              <section className={styles.screen}>
                <h1>
                  {loading
                    ? "読み込み中…"
                    : findView === "received"
                      ? "新しいいいねはありません"
                      : "条件に合う仲間がいません"}
                </h1>
                <p>
                  {findView === "received"
                    ? "いいねが届くと、ここで相手のプロフィールを確認できます。"
                    : "絞り込みを解除するか、時間を置いて更新してください。"}
                </p>
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
                <article
                  className={`${styles.recruit} ${expandedRecruitId === item.id ? styles.expanded : ""}`}
                  key={item.id}
                >
                  <button
                    className={styles.recruitSummary}
                    onClick={() =>
                      setExpandedRecruitId((value) =>
                        value === item.id ? null : item.id,
                      )
                    }
                  >
                    <span>{item.mode}</span>
                    <div>
                      <h2>{item.partySize}人パーティー募集</h2>
                      <p>
                        {item.owner?.displayName || "退会ユーザー"} · 募集者のランク {item.owner?.skillTier}
                      </p>
                    </div>
                    <time>{relativeTime(item.createdAt)}</time>
                    <b>{expandedRecruitId === item.id ? "⌃" : "⌄"}</b>
                  </button>
                  {expandedRecruitId === item.id && (
                    <div className={styles.recruitDetail}>
                      <p>
                        希望するキャラ：{item.desiredRoles.join(" / ") || "指定なし"}
                        <br />
                        {item.note || "ひとことはありません"}
                      </p>
                      {item.owner && (
                        <button
                          className={styles.secondary}
                          onClick={() => setViewProfile(item.owner)}
                        >
                          募集者のプロフィール・自己紹介を見る
                        </button>
                      )}
                      {item.owner?.id && item.owner.id !== profile?.id && (
                        <button
                          onClick={() => void requestTarget(item.owner!.id!)}
                        >
                          この募集に参加申請
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p>現在公開中の募集はありません。</p>
            )}
            <button className={styles.create} onClick={() => setRecruitOpen(true)}>
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
                    {item.other.skillTier} · {validBrawlers(item.other.roles).join(" / ") || "キャラ未設定"}
                  </p>
                  <button
                    className={styles.textButton}
                    onClick={() => setViewProfile(item.other)}
                  >
                    プロフィールを見る
                  </button>
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
              <span>
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" />
                ) : (
                  initials
                )}
              </span>
              <small>MY PROFILE</small>
              <h1>{profile?.displayName}</h1>
              <p>
                {profile?.skillTier} · {currentBrawlers.join(" / ") || "キャラ未設定"}
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
                <b>{completion}%</b>
                <small>登録完了</small>
              </article>
            </div>
            {missingItems.length > 0 && (
              <article className={styles.completion}>
                <div>
                  <strong>プロフィールをもっと充実</strong>
                  <small>未入力：{missingItems.join("・")}</small>
                </div>
                <button onClick={() => setAuth("onboarding")}>入力する</button>
              </article>
            )}
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
      {filterOpen && (
        <div className={styles.modalBackdrop}>
          <section className={styles.modal}>
            <div className={styles.modalHead}>
              <div>
                <small>SEARCH FILTER</small>
                <h2>仲間を絞り込む</h2>
              </div>
              <button onClick={() => setFilterOpen(false)}>×</button>
            </div>
            <label>
              キャラ
              <select
                value={filters.brawler}
                onChange={(event) =>
                  setFilters((value) => ({
                    ...value,
                    brawler: event.target.value,
                  }))
                }
              >
                <option value="">すべてのキャラ</option>
                {brawlers.map((brawler) => (
                  <option key={brawler}>{brawler}</option>
                ))}
              </select>
            </label>
            <label>
              ランク
              <select
                value={filters.tier}
                onChange={(event) =>
                  setFilters((value) => ({ ...value, tier: event.target.value }))
                }
              >
                <option value="">すべてのランク</option>
                {tiers.map((tier) => (
                  <option key={tier}>{tier}</option>
                ))}
              </select>
            </label>
            <div className={styles.modalActions}>
              <button
                className={styles.secondary}
                onClick={() => setFilters({ brawler: "", tier: "" })}
              >
                条件をリセット
              </button>
              <button onClick={applyFilters}>この条件で表示</button>
            </div>
          </section>
        </div>
      )}
      {tutorialOpen && (
        <div className={styles.modalBackdrop}>
          <section className={`${styles.modal} ${styles.tutorial}`}>
            <small>HOW TO USE</small>
            <h2>スタメイトの使い方</h2>
            <div className={styles.tutorialList}>
              <article><b>♡</b><div><strong>いいね</strong><p>気になる相手へ軽く興味を伝えます。お互いにいいねすると自動でマッチし、チャットが始まります。</p></div></article>
              <article><b>⚡</b><div><strong>メイト申請</strong><p>一緒に遊びたい相手へ直接申請します。相手が承認するとチャットできます。</p></div></article>
              <article><b>×</b><div><strong>スキップ</strong><p>ブロックせず、今表示している候補を次の人へ送ります。</p></div></article>
              <article><b>＋</b><div><strong>募集</strong><p>今すぐ遊びたい時は条件を選び、参加者を募集できます。</p></div></article>
            </div>
            <button className={styles.primaryWide} onClick={closeTutorial}>使ってみる</button>
          </section>
        </div>
      )}
      {recruitOpen && (
        <div className={styles.modalBackdrop}>
          <section className={styles.modal}>
            <div className={styles.modalHead}>
              <div><small>CREATE TEAM</small><h2>募集を作成</h2></div>
              <button onClick={() => setRecruitOpen(false)}>×</button>
            </div>
            <div className={styles.formGrid}>
              <label>モード<select value={recruitForm.mode} onChange={(event) => setRecruitForm((value) => ({ ...value, mode: event.target.value }))}>{modes.map((mode) => <option key={mode}>{mode}</option>)}</select></label>
              <label>パーティ人数<select value={recruitForm.partySize} onChange={(event) => setRecruitForm((value) => ({ ...value, partySize: event.target.value }))}><option value="2">2人</option><option value="3">3人</option><option value="5">5人</option></select></label>
              <label>希望するキャラ（任意）<select value={recruitForm.desiredBrawler} onChange={(event) => setRecruitForm((value) => ({ ...value, desiredBrawler: event.target.value }))}><option value="">指定なし</option>{brawlers.map((brawler) => <option key={brawler}>{brawler}</option>)}</select></label>
              <label>開始時間（任意）<input type="datetime-local" value={recruitForm.startAt} onChange={(event) => setRecruitForm((value) => ({ ...value, startAt: event.target.value }))} /></label>
              <label>掲載時間<select value={recruitForm.durationMinutes} onChange={(event) => setRecruitForm((value) => ({ ...value, durationMinutes: event.target.value }))}><option value="60">1時間</option><option value="120">2時間</option><option value="360">6時間</option><option value="1440">24時間</option></select></label>
              <label className={styles.full}>ひとこと（任意）<textarea maxLength={160} value={recruitForm.note} onChange={(event) => setRecruitForm((value) => ({ ...value, note: event.target.value }))} placeholder="例：VCなし、楽しく遊びたいです" /></label>
            </div>
            <button className={styles.primaryWide} onClick={() => void createRecruit()}>この内容で公開</button>
          </section>
        </div>
      )}
      {viewProfile && (
        <div className={styles.modalBackdrop}>
          <section className={styles.modal}>
            <div className={styles.modalHead}>
              <div><small>PLAYER PROFILE</small><h2>{viewProfile.displayName}</h2></div>
              <button onClick={() => setViewProfile(null)}>×</button>
            </div>
            <div className={styles.profilePreview}>
              <span>{viewProfile.avatarUrl ? <img src={viewProfile.avatarUrl} alt="" /> : viewProfile.displayName.slice(0, 2)}</span>
              <div><b>{viewProfile.skillTier}</b><p>{viewProfile.gameIdentity}</p></div>
            </div>
            <div className={styles.tags}>{validBrawlers(viewProfile.roles).length ? validBrawlers(viewProfile.roles).map((brawler) => <span key={brawler}>{brawler}</span>) : <span>キャラ未設定</span>}</div>
            <p className={styles.profileBio}>{viewProfile.bio || "自己紹介はまだありません。"}</p>
            <small className={styles.profileTimes}>{viewProfile.playTimes?.join(" · ") || "遊べる時間は未設定です"}</small>
          </section>
        </div>
      )}
      {activeChat && (
        <div className={styles.chatOverlay}>
          <div className={styles.chatHead}>
            <button
              onClick={() => {
                setChatMenuOpen(false);
                setActiveChat(null);
              }}
              aria-label="やりとり一覧へ戻る"
            >
              ←
            </button>
            <button onClick={() => setViewProfile(activeChat.other)}>
              <strong>{activeChat.other.displayName}</strong>
              <small>{activeChat.other.skillTier} · プロフィールを見る</small>
            </button>
            <button
              className={styles.chatMenuButton}
              onClick={() => setChatMenuOpen(true)}
              aria-label="チャットメニューを開く"
            >
              •••
            </button>
          </div>
          <div className={styles.chatPrimaryActions}>
            <button
              onClick={() => void sendPlayInvite()}
              disabled={playInviteSending}
            >
              <b>🎮</b>
              <span>
                {playInviteSending ? "送信中…" : "一緒にプレイを申請"}
              </span>
            </button>
            <button onClick={() => setQuickMessageOpen(true)}>
              <b>💬</b>
              <span>一言を送る</span>
            </button>
          </div>
          <div className={styles.chatMessages}>
            {chatLoading && <p className={styles.chatState}>メッセージを読み込んでいます…</p>}
            {chatError && <div className={styles.chatState}><p>{chatError}</p><button onClick={() => void openChat(activeChat)}>再試行</button></div>}
            {!chatLoading && !chatError && !messages.length && <p className={styles.chatState}>マッチしました。まずは挨拶してみましょう！</p>}
            {messages.map((item) => {
              const mine = item.senderProfileId === profile?.id;
              if (item.kind === "play_invite")
                return (
                  <article
                    className={`${styles.playInvite} ${mine ? styles.mine : ""}`}
                    key={item.id}
                  >
                    <div>
                      <b>🎮</b>
                      <span>
                        <small>PLAY INVITE</small>
                        <strong>一緒にプレイしませんか？</strong>
                      </span>
                    </div>
                    {!item.response && item.canRespond && (
                      <div className={styles.playInviteAnswers}>
                        <button
                          onClick={() =>
                            void respondPlayInvite(item.id, "declined")
                          }
                          disabled={respondingInviteId === item.id}
                        >
                          今回は見送る
                        </button>
                        <button
                          onClick={() =>
                            void respondPlayInvite(item.id, "accepted")
                          }
                          disabled={respondingInviteId === item.id}
                        >
                          一緒にプレイ
                        </button>
                      </div>
                    )}
                    {!item.response && !item.canRespond && (
                      <p>相手の返事を待っています</p>
                    )}
                    {item.response === "accepted" && (
                      <p className={styles.accepted}>✓ 一緒にプレイします</p>
                    )}
                    {item.response === "declined" && (
                      <p>今回は見送りになりました</p>
                    )}
                    <time>{relativeTime(item.createdAt)}</time>
                  </article>
                );
              return (
                <article
                  className={`${styles.messageBubble} ${mine ? styles.mine : ""}`}
                  key={item.id}
                >
                  <p>{item.body}</p>
                  <time>{relativeTime(item.createdAt)}</time>
                  {!item.deleted && (
                    <div className={styles.reactionArea}>
                      {(item.reactions || []).map((reaction) => (
                        <button
                          type="button"
                          key={reaction.reaction}
                          className={
                            item.myReaction === reaction.reaction
                              ? styles.reacted
                              : ""
                          }
                          onClick={() =>
                            void reactToMessage(item, reaction.reaction)
                          }
                          disabled={reactionUpdatingId === item.id}
                        >
                          {reaction.reaction} <b>{reaction.count}</b>
                        </button>
                      ))}
                      <button
                        type="button"
                        className={styles.reactionAdd}
                        onClick={() =>
                          setReactionPickerId((current) =>
                            current === item.id ? null : item.id,
                          )
                        }
                        aria-label="リアクションを追加"
                      >
                        ＋☺
                      </button>
                      {reactionPickerId === item.id && (
                        <div className={styles.reactionPicker}>
                          {["👍", "❤️", "😂", "🎮"].map((reaction) => (
                            <button
                              type="button"
                              key={reaction}
                              onClick={() =>
                                void reactToMessage(item, reaction)
                              }
                              disabled={reactionUpdatingId === item.id}
                            >
                              {reaction}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <form onSubmit={sendMessage} className={styles.chatForm}>
            <input
              value={message}
              maxLength={500}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="メッセージを入力"
            />
            <button>送信</button>
          </form>
          {chatMenuOpen && (
            <div className={styles.chatSheetBackdrop}>
              <button
                className={styles.sheetDismiss}
                onClick={() => setChatMenuOpen(false)}
                aria-label="チャットメニューを閉じる"
              />
              <section className={styles.chatActionSheet}>
                <div className={styles.sheetHandle} />
                <small>CHAT MENU</small>
                <h2>{activeChat.other.displayName}さんとのメニュー</h2>
                <div className={styles.chatActionGrid}>
                  <button onClick={() => setViewProfile(activeChat.other)}>
                    <b>👤</b>
                    プロフィール
                  </button>
                  <button
                    onClick={() => {
                      setChatMenuOpen(false);
                      setQuickMessageOpen(true);
                    }}
                  >
                    <b>💬</b>
                    一言を送る
                  </button>
                  <button
                    onClick={() => {
                      setChatMenuOpen(false);
                      void sendPlayInvite();
                    }}
                  >
                    <b>🎮</b>
                    一緒にプレイ
                  </button>
                  <button
                    className={styles.conversationEnd}
                    onClick={() => {
                      setChatMenuOpen(false);
                      setConversationCloseOpen(true);
                    }}
                  >
                    <b>−</b>
                    会話を見送る
                  </button>
                </div>
                <div className={styles.safetyActions}>
                  <ServiceReportButton
                    service="stamate"
                    targetProfileId={activeChat.other.id}
                    connectionId={activeChat.id}
                    onNotice={notify}
                    onBlocked={() => {
                      setChatMenuOpen(false);
                      setActiveChat(null);
                      void load();
                    }}
                    className={styles.safetyActionButton}
                  />
                </div>
                <p className={styles.chatMenuHint}>
                  ブロックすると、お互いの検索・募集・申請・チャットに表示されなくなります。
                </p>
              </section>
            </div>
          )}
        </div>
      )}
      {quickMessageOpen && activeChat && (
        <div className={styles.modalBackdrop}>
          <section className={`${styles.modal} ${styles.quickMessageSheet}`}>
            <div className={styles.modalHead}>
              <div>
                <small>QUICK MESSAGE</small>
                <h2>一言を送る</h2>
              </div>
              <button onClick={() => setQuickMessageOpen(false)}>×</button>
            </div>
            <div className={styles.quickMessages}>
              {[
                "よろしくお願いします！",
                "今から一緒に遊べますか？",
                "どのモードで遊びますか？",
                "VCなしでも大丈夫です！",
                "また時間が合う時に遊びましょう！",
              ].map((text) => (
                <button key={text} onClick={() => void sendQuickMessage(text)}>
                  <span>💬</span>
                  {text}
                </button>
              ))}
            </div>
            <button
              className={styles.secondaryWide}
              onClick={() => {
                setQuickMessageOpen(false);
                window.setTimeout(() =>
                  document.querySelector<HTMLInputElement>(
                    `.${styles.chatForm} input`,
                  )?.focus(),
                0);
              }}
            >
              自分で入力する
            </button>
          </section>
        </div>
      )}
      {conversationCloseOpen && activeChat && (
        <div className={styles.modalBackdrop}>
          <section className={`${styles.modal} ${styles.conversationCloseSheet}`}>
            <div className={styles.modalHead}>
              <div>
                <small>END CONVERSATION</small>
                <h2>会話を見送る</h2>
              </div>
              <button onClick={() => setConversationCloseOpen(false)}>×</button>
            </div>
            <p>
              ブロックはせず、理由と一言を相手に伝えてこの会話を一覧から閉じます。
            </p>
            <div className={styles.closeReasons}>
              {[
                "時間が合わなかったため",
                "遊びたいモードが違ったため",
                "今回はメンバーが決まったため",
                "また別の機会に遊びたいため",
              ].map((reason) => (
                <button
                  key={reason}
                  className={
                    conversationCloseReason === reason ? styles.selected : ""
                  }
                  onClick={() => setConversationCloseReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
            <label>
              補足の一言（任意）
              <textarea
                maxLength={100}
                value={conversationCloseNote}
                onChange={(event) => setConversationCloseNote(event.target.value)}
                placeholder="例：夜ならまた遊べます！"
              />
            </label>
            <button
              className={styles.endConversationButton}
              onClick={() => void closeConversation()}
              disabled={!conversationCloseReason || conversationClosing}
            >
              {conversationClosing ? "送信中…" : "理由を伝えて会話を閉じる"}
            </button>
          </section>
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
