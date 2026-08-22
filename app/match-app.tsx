"use client";

/* eslint-disable @next/next/no-img-element -- user-uploaded profile images are served by the app */

import {
  ChangeEvent,
  FormEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { pokemonArtUrl } from "../lib/pokemon-art";
import { rankOptions } from "../lib/ranks";

type Recruit = {
  id: number;
  trainerName: string;
  gender: string;
  pokemon: string;
  role: string;
  matches: number;
  winRate: number;
  rank: string;
  playTime: string;
  note: string;
  avatarUrl?: string;
  startAt: string;
  startTimeUndecided: boolean;
  expiresAt: string;
  partySize: number;
  desiredPokemon: string;
  desiredRole: string;
  acceptedCount: number;
};
type ProfileCandidate = {
  id: string;
  trainerName: string;
  mainPokemon: string[];
  highestRate: string;
  playTime: string[];
  gender: string;
  age: number | null;
  avatarUrl?: string;
  bio: string;
  likeCount: number;
  popular: boolean;
  registeredAt: string;
  lastActiveAt: string;
};
type ProfileLikeNotice = {
  id: number;
  senderId: string;
  senderName: string;
  senderPokemon: string;
  senderAvatarUrl?: string;
  read: boolean;
  createdAt: string;
};
type Notice = {
  id: number;
  recruitId?: number;
  applicantName?: string;
  applicantContact?: string;
  trainerName?: string;
  pokemon: string;
  message?: string;
  status: string;
  recruitPokemon?: string;
  ownerContact?: string | null;
  createdAt?: string;
};
type PendingConversation = {
  notice: Notice;
  direction: "incoming" | "outgoing";
};
export type Profile = {
  trainerName: string;
  mainPokemon: string[];
  highestRate: string;
  playTime: string[];
  gender: "男性" | "女性" | "";
  contact: string;
  bio: string;
  avatarUrl: string;
  age: number | null;
  ageConfirmed: boolean;
  termsAccepted: boolean;
};
type Connection = {
  id: number;
  mateId: string;
  mateName: string;
  mateAvatarUrl?: string;
  matePokemon: string;
  mateContact: string | null;
  mateContactShared: boolean;
  myContactShared: boolean;
  myPokemon: string;
  mateMainPokemon: string[];
  mateHighestRate: string;
  matePlayTime: string[];
  mateGender: string;
  mateAge: number | null;
  mateBio: string;
  againByMe: boolean;
  againByMate: boolean;
  mutualAgain: boolean;
  playedByMe: boolean;
  playedByMate: boolean;
  myRatingScore: number;
  myRatingTags: string[];
  latestMessage: string;
  latestAt: string;
  unreadCount: number;
};
type ChatMessage = {
  id: number;
  body: string;
  sender: "me" | "mate";
  kind?: "text" | "play_invite";
  response?: "accepted" | "declined" | null;
  canRespond?: boolean;
  createdAt: string;
  read?: boolean;
};
type SafetyTarget = { name: string; recruitId?: number; connectionId?: number };
type LinkedAccount = {
  provider: string;
  label: string;
  contactId: string;
  displayName: string | null;
  isCurrent: boolean;
};
type LobbyMember = {
  userId: string;
  trainerName: string;
  pokemon: string;
  ready: boolean;
  avatarUrl: string;
  isMe: boolean;
};
type Lobby = {
  id: number;
  recruitId: number;
  ownerId: string;
  status: string;
  scheduledAt: string;
  startTimeUndecided: boolean;
  partySize: number;
  pokemon: string;
  desiredPokemon: string;
  desiredRole: string;
  isOwner: boolean;
  active: boolean;
  members: LobbyMember[];
};
type AppTab = "discover" | "recruit" | "chat" | "lobby" | "profile";
type DiscoverMode = "recommended" | "received";
type PendingGuestAction = {
  type:
    | "like"
    | "profile-request"
    | "recruit-apply"
    | "compose"
    | "received"
    | "recruit-alert";
  label: string;
  targetId?: string;
  recruitId?: number;
};
const pendingGuestActionKey = "yunamatch-pending-action-v1";

const pokemon = [
  "アブソル",
  "アマージョ",
  "アローラキュウコン",
  "アローラライチュウ",
  "イワパレス",
  "インテレオン",
  "ウーラオス",
  "ウッウ",
  "エースバーン",
  "エーフィ",
  "エンペルト",
  "オーダイル",
  "オーロット",
  "カイリキー",
  "カイリュー",
  "カビゴン",
  "カメックス",
  "ガブリアス",
  "ガラルギャロップ",
  "キュワワー",
  "ギャラドス",
  "ギルガルド",
  "グレイシア",
  "グレンアルマ",
  "ゲッコウガ",
  "ゲンガー",
  "コダック",
  "サーナイト",
  "ザシアン",
  "シャンデラ",
  "ジュナイパー",
  "ジュラルドン",
  "シャワーズ",
  "スイクン",
  "ストライク",
  "ゼラオラ",
  "ソウブレイズ",
  "ソルガレオ",
  "ゾロアーク",
  "サンダー",
  "タイレーツ",
  "ダークライ",
  "ダダリン",
  "デカヌチャン",
  "ドードリオ",
  "ドラパルト",
  "ニンフィア",
  "ヌメルゴン",
  "ハッサム",
  "ハピナス",
  "バシャーモ",
  "バクフーン",
  "バリヤード",
  "バンギラス",
  "パーモット",
  "パルキア",
  "ピカチュウ",
  "ピクシー",
  "ファイアロー",
  "ファイヤー",
  "フリーザー",
  "フーパ",
  "フシギバナ",
  "ブラッキー",
  "プクリン",
  "ホウオウ",
  "マスカーニャ",
  "マッシブーン",
  "マフォクシー",
  "マホイップ",
  "メガギャラドス",
  "メガニウム",
  "メガリザードンX",
  "メガリザードンY",
  "メガルカリオ",
  "マリルリ",
  "マンムー",
  "ミミッキュ",
  "ミュウ",
  "ミュウツーX",
  "ミュウツーY",
  "ミライドン",
  "メタグロス",
  "ニャース",
  "ネギガナイト",
  "ヤドラン",
  "ヤミラミ",
  "ヨクバリス",
  "ラティアス",
  "ラティオス",
  "ラウドボーン",
  "ラプラス",
  "リーフィア",
  "リザードン",
  "ルカリオ",
  "レシラム",
  "ワタシラガ",
  "ウェーニバル",
  "イベルタル",
];
const playTimeOptions = [
  "平日 朝（6〜12時）",
  "平日 昼（12〜18時）",
  "平日 夜（18〜22時）",
  "平日 深夜（22〜翌2時）",
  "土日 朝・昼",
  "土日 夜・深夜",
  "時間帯はいつでも",
];
const ageOptions = Array.from({ length: 87 }, (_, index) => index + 13);
const recruitRoleOptions = [
  "上レーン",
  "下レーン",
  "中央",
  "キャリー",
  "タンク",
  "サポート",
];
const requestMessagePresets = [
  "ランク行きませんか？",
  "VCできます！",
  "楽しく遊びたいです！",
  "編成を相談したいです",
];
const mateRatingTags = [
  "マナーが良い",
  "連携しやすい",
  "雰囲気が良い",
  "VCしやすい",
];
const mateRatingLabels = [
  "",
  "いまひとつ",
  "少し気になった",
  "ふつう",
  "良かった",
  "最高だった",
];
const discordInviteUrl = "https://discord.gg/sRxr8fD8Z6";
const loginProviders = [
  { id: "google", label: "Google", mark: "G" },
  { id: "line", label: "LINE", mark: "LINE" },
  { id: "discord", label: "Discord", mark: "D" },
  { id: "twitter", label: "X", mark: "X" },
];

const previewRecruit: Recruit = {
  id: -1,
  trainerName: "momo",
  gender: "女性",
  pokemon: "ハピナス",
  role: "サポート型",
  matches: 1842,
  winRate: 58.7,
  rank: "レジェンド 1000〜",
  playTime: "平日 夜（18〜22時）",
  note: "中央キャリーを支えるのが好きです。楽しく連携しながら勝ちたい！",
  startAt: new Date().toISOString(),
  startTimeUndecided: false,
  expiresAt: new Date(Date.now() + 7_200_000).toISOString(),
  partySize: 2,
  desiredPokemon: "ゲッコウガ",
  desiredRole: "指定なし",
  acceptedCount: 0,
};
const previewProfile: ProfileCandidate = {
  id: "preview-momo",
  trainerName: "momo",
  mainPokemon: ["ハピナス", "キュワワー"],
  highestRate: "レジェンド 1000〜1199",
  playTime: ["平日 夜（18〜22時）", "土日 夜・深夜"],
  gender: "女性",
  age: 24,
  avatarUrl: "",
  bio: "中央キャリーを支えるのが好きです。楽しく連携しながら勝ちたいです！",
  likeCount: 12,
  popular: true,
  registeredAt: new Date().toISOString(),
  lastActiveAt: new Date().toISOString(),
};
const roleClass: Record<string, string> = {
  アタック型: "attack",
  バランス型: "balance",
  スピード型: "speed",
  ディフェンス型: "defense",
  サポート型: "support",
};

function roleTone(role: string) {
  if (roleClass[role]) return roleClass[role];
  if (role.includes("サポート")) return "support";
  if (role.includes("タンク")) return "defense";
  if (role.includes("中央")) return "speed";
  if (role.includes("キャリー")) return "attack";
  return "balance";
}

function formatStart(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "今から";
  const diff = date.getTime() - Date.now();
  if (diff < 10 * 60_000) return "今から";
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatRecruitStart(recruit: Recruit) {
  return recruit.startTimeUndecided ? "時間は相談" : `${formatStart(recruit.startAt)}開始`;
}
function formatActivity(value: string) {
  const date = new Date(value);
  const age = Date.now() - date.getTime();
  if (!Number.isFinite(age) || age < 2 * 60_000) return "オンライン";
  if (age < 24 * 60 * 60_000) return "今日ログイン";
  if (age < 3 * 24 * 60 * 60_000) return "3日以内にログイン";
  return "30日以内にログイン";
}
function decodePushKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function PokemonImage({ name }: { name: string }) {
  const mark =
    name === "未定"
      ? "？"
      : name.replace(/^(?:アローラ|ガラル)/, "").slice(0, 2);
  const src = pokemonArtUrl(name);
  return (
    <span className="pokemonVisual" role="img" aria-label={name}>
      <span className="pokemonVisualFallback" aria-hidden="true">
        {mark}
      </span>
      {src && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
  );
}

function PokemonLabel({ name }: { name: string }) {
  return (
    <span className="pokemonLabel">
      <PokemonImage name={name} />
      <strong>{name}</strong>
    </span>
  );
}

function UserAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string;
  className: string;
}) {
  return (
    <span className={className}>
      {src ? (
        <img src={src} alt={`${name}のプロフィール画像`} />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function PokemonPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (names: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const choices = pokemon.filter((name) => name.includes(query));
  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((value) => value !== name));
      return;
    }
    if (selected.length < 5) onChange([...selected, name]);
  };
  return (
    <div className="pokemonPicker">
      <div className="pickerHeading">
        <span>メインポケモン</span>
        <small>1〜5体・複数選択できます</small>
      </div>
      <div className="selectedPokemon">
        {selected.length ? (
          selected.map((name) => (
            <button type="button" key={name} onClick={() => toggle(name)}>
              {name}
              <span>×</span>
            </button>
          ))
        ) : (
          <p>ポケモンを選んでください</p>
        )}
      </div>
      <input
        className="pokemonSearch"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ポケモン名で検索"
        aria-label="ポケモン名で検索"
      />
      <div className="pokemonChoices">
        {choices.map((name) => (
          <button
            type="button"
            key={name}
            className={selected.includes(name) ? "selected" : ""}
            aria-pressed={selected.includes(name)}
            onClick={() => toggle(name)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayTimePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (times: string[]) => void;
}) {
  const toggle = (time: string) => {
    if (selected.includes(time)) {
      onChange(selected.filter((value) => value !== time));
      return;
    }
    if (time === "時間帯はいつでも") {
      onChange([time]);
      return;
    }
    onChange([
      ...selected.filter((value) => value !== "時間帯はいつでも"),
      time,
    ]);
  };
  return (
    <fieldset className="playTimePicker">
      <legend>
        遊べる時間帯 <small>複数選択できます</small>
      </legend>
      <div>
        {playTimeOptions.map((time) => (
          <button
            type="button"
            key={time}
            className={selected.includes(time) ? "selected" : ""}
            aria-pressed={selected.includes(time)}
            onClick={() => toggle(time)}
          >
            {selected.includes(time) && <span>✓</span>}
            {time}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function MatchApp({
  displayName,
  authProvider,
  authContact,
  authenticated = false,
  preview = false,
  initialProfile,
  initialSuspended = false,
  isAdmin = false,
}: {
  displayName: string;
  authProvider: string;
  authContact: string;
  authenticated?: boolean;
  preview?: boolean;
  initialProfile?: Profile | null;
  initialSuspended?: boolean;
  isAdmin?: boolean;
}) {
  const guestMode = !authenticated && !preview;
  const shortName = displayName.includes("@")
    ? displayName.split("@")[0]
    : displayName;
  const providerName =
    authProvider === "twitter"
      ? "X"
      : authProvider === "discord"
        ? "Discord"
        : authProvider === "line"
          ? "LINE"
          : authProvider === "google"
            ? "Google"
            : "ログインアカウント";
  const [sharedRecruitId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const value = Number(
      new URLSearchParams(window.location.search).get("recruit"),
    );
    return Number.isInteger(value) && value > 0 ? value : null;
  });
  const [tab, setTab] = useState<AppTab>(() =>
    sharedRecruitId ? "recruit" : "discover",
  );
  const [profileCandidates, setProfileCandidates] = useState<
    ProfileCandidate[]
  >(preview ? [previewProfile] : []);
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [myRecruit, setMyRecruit] = useState<Recruit | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [animation, setAnimation] = useState<"" | "left" | "right">("");
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pokemonQuery, setPokemonQuery] = useState("");
  const [trainerQuery, setTrainerQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<"" | "男性" | "女性">("");
  const [sharedTimeOnly, setSharedTimeOnly] = useState(false);
  const [compose, setCompose] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginAction, setLoginAction] = useState("この機能");
  const [loginProvider, setLoginProvider] = useState("");
  const [applyTo, setApplyTo] = useState<Recruit | null>(null);
  const [profileApplyTo, setProfileApplyTo] = useState<ProfileCandidate | null>(
    null,
  );
  const [candidateDetail, setCandidateDetail] =
    useState<ProfileCandidate | null>(null);
  const [discoverMode, setDiscoverMode] = useState<DiscoverMode>("recommended");
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialChecked, setTutorialChecked] = useState(false);
  const [chatTutorialOpen, setChatTutorialOpen] = useState(false);
  const [chatTutorialChecked, setChatTutorialChecked] = useState(false);
  const [chatTutorialStep, setChatTutorialStep] = useState<0 | 1>(0);
  const [pushPromptOpen, setPushPromptOpen] = useState(false);
  const [pushPromptChecked, setPushPromptChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const [incoming, setIncoming] = useState<Notice[]>([]);
  const [outgoing, setOutgoing] = useState<Notice[]>([]);
  const [profileLikes, setProfileLikes] = useState<ProfileLikeNotice[]>([]);
  const [receivedProfileCandidates, setReceivedProfileCandidates] = useState<
    ProfileCandidate[]
  >([]);
  const [likedProfileIds, setLikedProfileIds] = useState<string[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [selectedConnection, setSelectedConnection] =
    useState<Connection | null>(null);
  const [matchedProfile, setMatchedProfile] = useState<Connection | null>(null);
  const [selectedPending, setSelectedPending] =
    useState<PendingConversation | null>(null);
  const [pendingGroupOpen, setPendingGroupOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [playInviteSending, setPlayInviteSending] = useState(false);
  const [respondingInviteId, setRespondingInviteId] = useState<number | null>(
    null,
  );
  const messageSendingRef = useRef(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [ratingTarget, setRatingTarget] = useState<Connection | null>(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingTags, setRatingTags] = useState<string[]>([]);
  const [ratingSending, setRatingSending] = useState(false);
  const [matePresence, setMatePresence] = useState({
    online: false,
    typing: false,
  });
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [recruitShare, setRecruitShare] = useState<Recruit | null>(null);
  const [recruitNotifyPrompt, setRecruitNotifyPrompt] =
    useState<Recruit | null>(null);
  const [safetyTarget, setSafetyTarget] = useState<SafetyTarget | null>(null);
  const [chatActionsOpen, setChatActionsOpen] = useState(false);
  const [voiceRoomLoading, setVoiceRoomLoading] = useState(false);
  const [voiceRoom, setVoiceRoom] = useState<{
    connectionId: number;
    roomName: string;
    channelUrl: string;
  } | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportMode, setSupportMode] = useState<"support" | "feedback">(
    "support",
  );
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [deletionText, setDeletionText] = useState("");
  const [matchResult, setMatchResult] = useState<{
    connectionId: number;
    mateContact: string | null;
    mateName: string;
    matePokemon: string;
  } | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>(
    preview
      ? [
          {
            provider: "discord",
            label: "Discord",
            contactId: "preview_trainer",
            displayName: "preview_trainer",
            isCurrent: true,
          },
        ]
      : [],
  );
  const defaultProfile: Profile = {
    trainerName: shortName,
    mainPokemon: [],
    highestRate: "マスター 1400〜1599",
    playTime: ["平日 夜（18〜22時）"],
    gender: "",
    contact: `${providerName}: ${authContact}`,
    bio: "",
    avatarUrl: "",
    age: null,
    ageConfirmed: false,
    termsAccepted: false,
  };
  const [profile, setProfile] = useState<Profile>(
    initialProfile || defaultProfile,
  );
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const [pushState, setPushState] = useState<
    "off" | "on" | "install-required" | "denied" | "unsupported"
  >("off");
  const [pushHelpOpen, setPushHelpOpen] = useState(false);
  const [recruitAlertsEnabled, setRecruitAlertsEnabled] = useState(false);
  const [recruitAlertUpdating, setRecruitAlertUpdating] = useState(false);
  const [quickRecruiting, setQuickRecruiting] = useState("");
  const [quickApplyingId, setQuickApplyingId] = useState<number | null>(null);
  const [profileReady, setProfileReady] = useState(
    guestMode || preview || initialProfile !== undefined,
  );
  const [suspended, setSuspended] = useState(initialSuspended);
  const [onboardingOpen, setOnboardingOpen] = useState(
    !guestMode && (preview || initialProfile === null),
  );
  const primaryPokemon = profile.mainPokemon[0] || "ゲッコウガ";
  const onboardingMissing = [
    !profile.trainerName.trim() && "トレーナー名",
    profile.mainPokemon.length === 0 && "メインポケモン",
    profile.playTime.length === 0 && "遊べる時間帯",
    !profile.gender && "性別",
    (profile.age === null || profile.age < 13 || profile.age > 99) && "年齢",
    profile.age !== null &&
      profile.age < 18 &&
      !profile.ageConfirmed &&
      "保護者の同意",
    !profile.termsAccepted && "利用規約への同意",
  ].filter((value): value is string => Boolean(value));

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const requestLogin = (action: PendingGuestAction) => {
    try {
      window.sessionStorage.setItem(
        pendingGuestActionKey,
        JSON.stringify(action),
      );
    } catch {
      /* ログイン後の自動復帰ができない場合も、認証は続けられる */
    }
    setLoginAction(action.label);
    setLoginProvider("");
    setLoginOpen(true);
  };

  const closeLogin = () => {
    try {
      window.sessionStorage.removeItem(pendingGuestActionKey);
    } catch {
      /* 閉じる操作は続ける */
    }
    setLoginProvider("");
    setLoginOpen(false);
  };

  const selectAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      notify("JPEG・PNG・WebP画像を選んでください");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      notify("画像は8MB以下にしてください");
      return;
    }
    setAvatarProcessing(true);
    try {
      const source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => {
          URL.revokeObjectURL(url);
          resolve(image);
        };
        image.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("image"));
        };
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      const side = Math.min(source.naturalWidth, source.naturalHeight);
      const sx = (source.naturalWidth - side) / 2;
      const sy = (source.naturalHeight - side) / 2;
      ctx.fillStyle = "#f4efff";
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(source, sx, sy, side, side, 0, 0, 512, 512);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.82),
      );
      if (!blob || blob.size > 500_000) throw new Error("size");
      if (preview) {
        setProfile((value) => ({
          ...value,
          avatarUrl: URL.createObjectURL(blob),
        }));
        notify("プロフィール画像を選択しました");
        return;
      }
      const response = await fetch("/api/media/avatar", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: blob,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "upload");
      setProfile((value) => ({ ...value, avatarUrl: data.avatarUrl }));
      notify("プロフィール画像をアップロードしました");
    } catch {
      notify("画像を読み込めませんでした");
    } finally {
      setAvatarProcessing(false);
    }
  };
  const avatarEditor = () => (
    <div className="avatarEditor">
      <UserAvatar
        name={profile.trainerName || "T"}
        src={profile.avatarUrl}
        className="avatarEditorPreview"
      />
      <div>
        <strong>
          プロフィールアイコン <small>任意</small>
        </strong>
        <p>正方形に切り抜いて表示します</p>
        <div>
          <label className="avatarSelectButton">
            {avatarProcessing ? "処理中…" : "写真を選ぶ"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={selectAvatar}
              disabled={avatarProcessing}
            />
          </label>
          {profile.avatarUrl && (
            <button
              type="button"
              onClick={async () => {
                if (!preview)
                  await fetch("/api/media/avatar", { method: "DELETE" });
                setProfile((value) => ({ ...value, avatarUrl: "" }));
              }}
            >
              削除
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const loadRecruits = async () => {
    try {
      const response = await fetch("/api/recruits");
      const data = await response.json();
      setRecruits(data.recruits || []);
      setMyRecruit(data.myRecruit || null);
    } catch {
      notify("募集を読み込めませんでした");
    } finally {
      setLoading(false);
    }
  };
  const loadDiscover = async () => {
    if (preview) {
      setProfileCandidates([previewProfile]);
      return;
    }
    try {
      const response = await fetch("/api/discover", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setProfileCandidates(data.profiles || []);
    } catch {
      /* 募集やチャット画面は利用を続ける */
    }
  };
  const loadNotices = async () => {
    try {
      const response = await fetch("/api/applications");
      if (!response.ok) return;
      const data = await response.json();
      setIncoming(data.incoming || []);
      setOutgoing(data.outgoing || []);
    } catch {
      /* カード表示は続ける */
    }
  };
  const loadLikes = useCallback(async () => {
    if (preview || guestMode) return;
    try {
      const response = await fetch("/api/likes", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setProfileLikes(data.incoming || []);
      setReceivedProfileCandidates(data.profiles || []);
      setLikedProfileIds(data.likedProfileIds || []);
    } catch {
      /* 検索画面は利用を続ける */
    }
  }, [preview, guestMode]);
  const loadConnections = async () => {
    try {
      const response = await fetch("/api/connections", { cache: "no-store" });
      if (!response.ok) return [] as Connection[];
      const data = await response.json();
      const nextConnections = (data.connections || []) as Connection[];
      setConnections(nextConnections);
      return nextConnections;
    } catch {
      /* 検索は続ける */
      return [] as Connection[];
    }
  };
  const loadLobbies = async () => {
    try {
      const response = await fetch("/api/lobbies");
      if (!response.ok) return;
      const data = await response.json();
      setLobbies(data.lobbies || []);
    } catch {
      /* 他画面は利用を続ける */
    }
  };
  const loadMessages = async (connection: Connection) => {
    const response = await fetch(`/api/messages?connectionId=${connection.id}`);
    if (!response.ok) return;
    const data = await response.json();
    setMessages(data.messages || []);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/recruits").then((r) => r.json()),
      fetch("/api/discover", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null,
      ),
      authenticated
        ? fetch("/api/applications").then((r) => (r.ok ? r.json() : null))
        : Promise.resolve(null),
      authenticated
        ? fetch("/api/connections").then((r) => (r.ok ? r.json() : null))
        : Promise.resolve(null),
      authenticated
        ? fetch("/api/lobbies").then((r) => (r.ok ? r.json() : null))
        : Promise.resolve(null),
      authenticated
        ? fetch("/api/likes", { cache: "no-store" }).then((r) =>
            r.ok ? r.json() : null,
          )
        : Promise.resolve(null),
    ])
      .then(
        ([
          recruitData,
          discoverData,
          noticeData,
          connectionData,
          lobbyData,
          likeData,
        ]) => {
          if (!active) return;
          setRecruits(recruitData.recruits || []);
          setMyRecruit(recruitData.myRecruit || null);
          if (discoverData) setProfileCandidates(discoverData.profiles || []);
          if (noticeData) {
            setIncoming(noticeData.incoming || []);
            setOutgoing(noticeData.outgoing || []);
          }
          if (connectionData) setConnections(connectionData.connections || []);
          if (lobbyData) setLobbies(lobbyData.lobbies || []);
          if (likeData) {
            setProfileLikes(likeData.incoming || []);
            setReceivedProfileCandidates(likeData.profiles || []);
            setLikedProfileIds(likeData.likedProfileIds || []);
          }
        },
      )
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    if (guestMode || preview || initialProfile !== undefined)
      return () => {
        active = false;
      };
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    fetch("/api/profile", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (response.status === 401) {
          location.href = data.signIn || "/login";
          return;
        }
        if (data.suspended) {
          setSuspended(true);
          setOnboardingOpen(false);
        } else if (data.profile) {
          setProfile(data.profile);
          setOnboardingOpen(false);
        } else {
          setProfile((value) => ({
            ...value,
            trainerName: data.suggested?.trainerName || value.trainerName,
            contact: data.suggested?.contact || value.contact,
          }));
          setOnboardingOpen(true);
        }
      })
      .catch(() => {
        if (active)
          notify("プロフィールを確認できませんでした。再読み込みしてください");
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setProfileReady(true);
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [authenticated, guestMode, preview, initialProfile]);

  useEffect(() => {
    if (preview || guestMode) return;
    const isAppleMobile =
      /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (isAppleMobile && !isStandalone) {
      Promise.resolve().then(() => setPushState("install-required"));
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      Promise.resolve().then(() => setPushState("unsupported"));
      return;
    }
    if ("Notification" in window && Notification.permission === "denied") {
      Promise.resolve().then(() => setPushState("denied"));
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        if (await registration.pushManager.getSubscription())
          setPushState("on");
      })
      .catch(() => setPushState("unsupported"));
  }, [preview, guestMode]);

  useEffect(() => {
    if (preview || guestMode) return;
    fetch("/api/recruit-alerts", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setRecruitAlertsEnabled(Boolean(data?.enabled)))
      .catch(() => undefined);
  }, [preview, guestMode]);

  useEffect(() => {
    if (preview || guestMode) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      loadNotices();
      loadLikes();
      loadConnections();
      loadLobbies();
      if (selectedConnection) loadMessages(selectedConnection);
    };
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [preview, guestMode, selectedConnection, loadLikes]);

  useEffect(() => {
    if (!selectedPending) return;
    const notices =
      selectedPending.direction === "incoming" ? incoming : outgoing;
    const current = notices.find(
      (notice) => notice.id === selectedPending.notice.id,
    );
    if (!current || current.status !== "pending") setSelectedPending(null);
  }, [incoming, outgoing, selectedPending]);

  useEffect(() => {
    if (preview || guestMode || !profileReady || onboardingOpen || selectedConnection)
      return;
    const heartbeat = () => {
      if (document.visibilityState === "visible")
        fetch("/api/presence", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }).catch(() => undefined);
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 60_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [preview, guestMode, profileReady, onboardingOpen, selectedConnection]);

  useEffect(() => {
    if (!profileReady || onboardingOpen || tutorialChecked) return;
    const timer = window.setTimeout(() => {
      let seen = false;
      try {
        seen =
          window.localStorage.getItem("yunamatch-discover-tutorial-v1") ===
          "seen";
      } catch {
        /* 保存できない環境では初回表示を優先 */
      }
      setTutorialChecked(true);
      if (!seen) setTutorialOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profileReady, onboardingOpen, tutorialChecked]);

  useEffect(() => {
    if (tab !== "chat" || chatTutorialChecked) return;
    const timer = window.setTimeout(() => {
      let seen = false;
      try {
        seen =
          window.localStorage.getItem("yunamatch-chat-tutorial-v1") === "seen";
      } catch {
        /* 保存できない環境では初回表示を優先 */
      }
      setChatTutorialChecked(true);
      if (!seen) {
        setChatTutorialStep(0);
        setChatTutorialOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, chatTutorialChecked]);

  useEffect(() => {
    if (
      preview ||
      guestMode ||
      !profileReady ||
      onboardingOpen ||
      !tutorialChecked ||
      tutorialOpen ||
      pushPromptChecked
    )
      return;
    const timer = window.setTimeout(() => {
      let seen = false;
      try {
        seen =
          window.localStorage.getItem("yunamatch-push-intro-v1") === "seen";
      } catch {
        /* 保存できない環境では確認を表示 */
      }
      setPushPromptChecked(true);
      if (
        !seen &&
        "Notification" in window &&
        Notification.permission === "default" &&
        "serviceWorker" in navigator &&
        "PushManager" in window
      )
        setPushPromptOpen(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    preview,
    guestMode,
    profileReady,
    onboardingOpen,
    tutorialChecked,
    tutorialOpen,
    pushPromptChecked,
  ]);

  useEffect(() => {
    if (preview || !selectedConnection) return;
    let active = true;
    const ping = async () => {
      await fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConnection.id,
          typing: Boolean(messageText.trim()),
        }),
      });
      const response = await fetch(
        `/api/presence?connectionId=${selectedConnection.id}`,
      );
      if (active && response.ok) setMatePresence(await response.json());
    };
    ping();
    const timer = window.setInterval(ping, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
      fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConnection.id,
          typing: false,
        }),
      }).catch(() => undefined);
    };
  }, [preview, selectedConnection, messageText]);

  useEffect(() => {
    if (preview || guestMode) return;
    fetch("/api/account-links")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.accounts) setLinkedAccounts(data.accounts);
      })
      .catch(() => undefined);
    const linked = new URLSearchParams(window.location.search).get("linked");
    if (linked) {
      window.setTimeout(() => notify("アカウントを連携しました"), 350);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [preview, guestMode]);

  const visibleRecruits = useMemo(
    () => (recruits.length === 0 && preview ? [previewRecruit] : recruits),
    [recruits, preview],
  );
  const appliedRecruitIds = useMemo(
    () =>
      new Set(
        outgoing
          .filter(
            (notice) =>
              notice.recruitId &&
              (notice.status === "pending" || notice.status === "accepted"),
          )
          .map((notice) => notice.recruitId as number),
      ),
    [outgoing],
  );
  const normalizedPokemonQuery = pokemonQuery
    .trim()
    .toLocaleLowerCase("ja-JP");
  const normalizedTrainerQuery = trainerQuery
    .trim()
    .toLocaleLowerCase("ja-JP");
  const filteredProfileCandidates = useMemo(
    () =>
      profileCandidates.filter((person) => {
        return (
          (!normalizedPokemonQuery ||
            person.mainPokemon.some((name) =>
              name.toLocaleLowerCase("ja-JP").includes(normalizedPokemonQuery),
            )) &&
          (!normalizedTrainerQuery ||
            person.trainerName
              .toLocaleLowerCase("ja-JP")
              .includes(normalizedTrainerQuery)) &&
          (!genderFilter || person.gender === genderFilter) &&
          (!sharedTimeOnly ||
            person.playTime.includes("時間帯はいつでも") ||
            profile.playTime.includes("時間帯はいつでも") ||
            person.playTime.some((time) => profile.playTime.includes(time)))
        );
      }),
    [
      profileCandidates,
      normalizedPokemonQuery,
      normalizedTrainerQuery,
      genderFilter,
      sharedTimeOnly,
      profile.playTime,
    ],
  );
  const recommendedCards = filteredProfileCandidates;
  const receivedCards = useMemo(
    () =>
      receivedProfileCandidates.filter((person) => {
        return (
          (!normalizedPokemonQuery ||
            person.mainPokemon.some((name) =>
              name.toLocaleLowerCase("ja-JP").includes(normalizedPokemonQuery),
            )) &&
          (!normalizedTrainerQuery ||
            person.trainerName
              .toLocaleLowerCase("ja-JP")
              .includes(normalizedTrainerQuery)) &&
          (!genderFilter || person.gender === genderFilter) &&
          (!sharedTimeOnly ||
            person.playTime.includes("時間帯はいつでも") ||
            profile.playTime.includes("時間帯はいつでも") ||
            person.playTime.some((time) => profile.playTime.includes(time)))
        );
      }),
    [
      receivedProfileCandidates,
      normalizedPokemonQuery,
      normalizedTrainerQuery,
      genderFilter,
      sharedTimeOnly,
      profile.playTime,
    ],
  );
  const cards = discoverMode === "received" ? receivedCards : recommendedCards;
  const activeFilterCount =
    Number(Boolean(pokemonQuery.trim())) +
    Number(Boolean(trainerQuery.trim())) +
    Number(Boolean(genderFilter)) +
    Number(sharedTimeOnly);
  const current = cards.length
    ? cards[((index % cards.length) + cards.length) % cards.length]
    : null;
  const currentPokemon = current?.mainPokemon[0] || "未設定";
  const pendingIncoming = incoming.filter((notice) => notice.status === "pending");
  const pendingOutgoing = outgoing.filter((notice) => notice.status === "pending");
  const pendingCount = pendingIncoming.length;
  const pendingConversationCount = pendingIncoming.length + pendingOutgoing.length;
  const heartCount = connections.filter(
    (c) => c.againByMate && !c.againByMe,
  ).length;
  const profileLikeCount = profileLikes.filter((like) => !like.read).length;
  const unreadCount = connections.reduce(
    (sum, connection) => sum + (connection.unreadCount || 0),
    0,
  );
  const notificationCount =
    pendingCount + heartCount + profileLikeCount + unreadCount;
  const profileCompletion = Math.round(
    ([
      Boolean(profile.trainerName.trim()),
      profile.mainPokemon.length > 0,
      Boolean(profile.highestRate),
      profile.playTime.length > 0,
      Boolean(profile.gender),
      profile.age !== null,
      Boolean(profile.avatarUrl),
      Boolean(profile.bio.trim()),
      profile.mainPokemon.length >= 2,
      profile.playTime.length >= 2,
      pushState === "on",
    ].filter(Boolean).length /
      11) *
      100,
  );
  const mateCount = new Set(connections.map((connection) => connection.mateId)).size;

  const moveCard = (step: -1 | 1) => {
    if (!current || animation) return;
    setAnimation(step > 0 ? "left" : "right");
    window.setTimeout(() => {
      setIndex((value) => value + step);
      setAnimation("");
    }, 220);
  };
  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (dragStart === null) return;
    const distance = event.clientX - dragStart;
    setDragStart(null);
    if (Math.abs(distance) >= 65) moveCard(distance > 0 ? -1 : 1);
  };
  const changeDiscoverMode = (mode: DiscoverMode) => {
    if (guestMode && mode === "received") {
      requestLogin({
        type: "received",
        label: "相手から届いたいいねを見る",
      });
      return;
    }
    setDiscoverMode(mode);
    setIndex(0);
  };
  const openRecruitComposer = () => {
    if (guestMode) {
      requestLogin({ type: "compose", label: "募集を作る" });
      return;
    }
    setCompose(true);
  };
  const closeTutorial = () => {
    try {
      window.localStorage.setItem("yunamatch-discover-tutorial-v1", "seen");
    } catch {
      /* 次回も表示されるだけなので利用は続ける */
    }
    setTutorialOpen(false);
  };
  const openChatTutorial = () => {
    setChatTutorialStep(0);
    setChatTutorialOpen(true);
  };
  const closeChatTutorial = () => {
    try {
      window.localStorage.setItem("yunamatch-chat-tutorial-v1", "seen");
    } catch {
      /* 次回も表示されるだけなので利用は続ける */
    }
    setChatTutorialOpen(false);
  };
  const rememberPushPrompt = () => {
    try {
      window.localStorage.setItem("yunamatch-push-intro-v1", "seen");
    } catch {
      /* 次回も確認されるだけなので利用は続ける */
    }
  };
  const dismissPushPrompt = () => {
    rememberPushPrompt();
    setPushPromptOpen(false);
  };
  const confirmPushPrompt = async () => {
    rememberPushPrompt();
    setPushPromptOpen(false);
    await enablePush();
  };
  const addRequestPreset = (preset: string) =>
    setRequestMessage((current) =>
      current.trim() ? `${current.trim()} ${preset}` : preset,
    );
  const openRecruitApplication = (recruit: Recruit) => {
    if (guestMode) {
      requestLogin({
        type: "recruit-apply",
        label: "この募集へプレイ申請する",
        recruitId: recruit.id,
      });
      return;
    }
    setRequestMessage(
      recruit.pokemon === "未定"
        ? `${recruit.role !== "指定なし" ? recruit.role : "役割"}を相談しながら一緒に遊びたいです！`
        : `${recruit.pokemon}と一緒にランクへ行きたいです！`,
    );
    setApplyTo(recruit);
  };
  const openProfileApplication = (candidate: ProfileCandidate) => {
    if (guestMode) {
      requestLogin({
        type: "profile-request",
        label: "この人へメイト申請する",
        targetId: candidate.id,
      });
      return;
    }
    setRequestMessage(
      `${candidate.mainPokemon[0] || "メインポケモン"}と一緒に遊びたいです！`,
    );
    setProfileApplyTo(candidate);
  };

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!applyTo) return;
    setSending(true);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, recruitId: applyTo.id }),
    });
    const data = await response.json();
    setSending(false);
    if (response.status === 401) {
      location.href = data.signIn;
      return;
    }
    if (!response.ok) {
      notify(data.error || "申請できませんでした");
      return;
    }
    setApplyTo(null);
    notify("👋 手を振りました。承認前からやりとりで確認できます");
    setIndex((v) => v + 1);
    await loadNotices();
  };
  const submitProfileApplication = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!profileApplyTo) return;
    setSending(true);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (preview) {
      setSending(false);
      setProfileApplyTo(null);
      notify("メイト申請を送りました");
      setIndex((value) => value + 1);
      return;
    }
    const response = await fetch("/api/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, targetId: profileApplyTo.id }),
    });
    const data = await response.json();
    setSending(false);
    if (response.status === 401) {
      location.href = data.signIn || "/login";
      return;
    }
    if (!response.ok) {
      notify(data.error || "メイト申請を送れませんでした");
      return;
    }
    setProfileApplyTo(null);
    notify("👋 手を振りました。承認前からやりとりで確認できます");
    setIndex((value) => value + 1);
    await Promise.all([loadDiscover(), loadNotices()]);
  };
  const sendProfileLikeTo = async (candidate: ProfileCandidate) => {
    if (likedProfileIds.includes(candidate.id)) return;
    if (guestMode) {
      requestLogin({
        type: "like",
        label: "この人へいいねする",
        targetId: candidate.id,
      });
      return;
    }
    if (preview) {
      setLikedProfileIds((ids) => [...ids, candidate.id]);
      notify(`${candidate.trainerName}さんにいいねしました`);
      return;
    }
    const response = await fetch("/api/likes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetId: candidate.id }),
    });
    const data = await response.json();
    if (response.status === 401) {
      location.href = data.signIn || "/login";
      return;
    }
    if (!response.ok) {
      notify(data.error || "いいねを送れませんでした");
      return;
    }
    setLikedProfileIds((ids) =>
      ids.includes(candidate.id) ? ids : [...ids, candidate.id],
    );
    notify(
      data.created
        ? `${candidate.trainerName}さんにいいねしました`
        : "いいね済みです",
    );
  };
  const sendProfileLike = async () => {
    if (!current) return;
    await sendProfileLikeTo(current);
  };
  const openNotifications = () => {
    if (guestMode) {
      requestLogin({ type: "received", label: "通知を見る" });
      return;
    }
    setNotificationOpen(true);
    if (!profileLikeCount) return;
    setProfileLikes((rows) => rows.map((row) => ({ ...row, read: true })));
    if (!preview)
      fetch("/api/likes", { method: "PATCH" }).catch(() => undefined);
  };
  useEffect(() => {
    if (!authenticated || !profileReady || onboardingOpen) return;
    let action: PendingGuestAction | null = null;
    try {
      const stored = window.sessionStorage.getItem(pendingGuestActionKey);
      if (stored) action = JSON.parse(stored) as PendingGuestAction;
    } catch {
      return;
    }
    if (!action) return;
    if (action.type === "compose") {
      window.sessionStorage.removeItem(pendingGuestActionKey);
      setTab("recruit");
      setCompose(true);
      notify("ログインできました。募集内容を入力してください");
      return;
    }
    if (action.type === "received") {
      window.sessionStorage.removeItem(pendingGuestActionKey);
      setDiscoverMode("received");
      setIndex(0);
      setTab("discover");
      notify("ログインできました");
      return;
    }
    if (action.type === "recruit-alert") {
      window.sessionStorage.removeItem(pendingGuestActionKey);
      setTab("recruit");
      notify("ログインできました。新着募集の通知をオンにできます");
      return;
    }
    if (action.type === "recruit-apply") {
      const recruit = recruits.find((row) => row.id === action?.recruitId);
      if (!recruit) return;
      window.sessionStorage.removeItem(pendingGuestActionKey);
      setTab("recruit");
      openRecruitApplication(recruit);
      return;
    }
    const candidate = profileCandidates.find(
      (row) => row.id === action?.targetId,
    );
    if (!candidate) return;
    window.sessionStorage.removeItem(pendingGuestActionKey);
    setTab("discover");
    const candidateIndex = recommendedCards.findIndex(
      (row) => row.id === candidate.id,
    );
    if (candidateIndex >= 0) setIndex(candidateIndex);
    if (action.type === "like") void sendProfileLikeTo(candidate);
    else openProfileApplication(candidate);
  }, [
    authenticated,
    profileReady,
    onboardingOpen,
    recruits,
    profileCandidates,
    recommendedCards,
  ]);
  const showLikedProfile = (senderId: string) => {
    const senderIndex = receivedCards.findIndex(
      (person) => person.id === senderId,
    );
    if (senderIndex < 0) {
      notify("このプロフィールは現在表示できません");
      return;
    }
    setDiscoverMode("received");
    setIndex(senderIndex);
    setTab("discover");
    setNotificationOpen(false);
  };
  const submitRecruit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const roles = formData.getAll("roles").map(String);
    const body = { ...Object.fromEntries(formData), roles };
    if (preview) {
      const startTimeUndecided = body.startsIn === "undecided",
        startsIn = startTimeUndecided ? 0 : Number(body.startsIn),
        duration = Number(body.duration),
        startAt = new Date(Date.now() + startsIn * 60_000);
      const recruit = {
        ...previewRecruit,
        id: -2,
        trainerName: profile.trainerName,
        gender: profile.gender || "女性",
        pokemon: String(body.pokemon),
        role: roles.join("・") || "指定なし",
        matches: Number(body.matches),
        winRate: Number(body.winRate),
        rank: profile.highestRate,
        playTime: profile.playTime.join("・"),
        note: typeof body.note === "string" ? body.note.trim() : "",
        startAt: startAt.toISOString(),
        startTimeUndecided,
        expiresAt: new Date(
          startAt.getTime() + duration * 3_600_000,
        ).toISOString(),
        partySize: Number(body.partySize),
        desiredPokemon: String(body.desiredPokemon),
        desiredRole: String(body.desiredRole),
      };
      setMyRecruit(recruit);
      if (pushState === "on") setRecruitShare(recruit);
      else setRecruitNotifyPrompt(recruit);
      setLobbies([
        {
          id: -1,
          recruitId: -2,
          ownerId: "preview",
          status: "forming",
          scheduledAt: recruit.startAt,
          startTimeUndecided: recruit.startTimeUndecided,
          partySize: recruit.partySize,
          pokemon: recruit.pokemon,
          desiredPokemon: recruit.desiredPokemon,
          desiredRole: recruit.desiredRole,
          isOwner: true,
          active: true,
          members: [
            {
              userId: "preview",
              trainerName: profile.trainerName,
              pokemon: recruit.pokemon,
              ready: false,
              avatarUrl: profile.avatarUrl,
              isMe: true,
            },
          ],
        },
      ]);
      setCompose(false);
      setTab("recruit");
      notify("募集を公開しました");
      return;
    }
    setSending(true);
    const response = await fetch("/api/recruits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    setSending(false);
    if (response.status === 401) {
      location.href = data.signIn;
      return;
    }
    if (!response.ok) {
      notify(data.error || "募集を投稿できませんでした");
      return;
    }
    setMyRecruit(data.recruit);
    if (pushState === "on") setRecruitShare(data.recruit);
    else setRecruitNotifyPrompt(data.recruit);
    setCompose(false);
    notify("募集を公開しました");
    await loadRecruits();
    setTab("recruit");
  };

  const createQuickRecruit = async (
    preset: "now-duo" | "later-duo" | "trio",
  ) => {
    if (guestMode) {
      requestLogin({ type: "compose", label: "クイック募集を作る" });
      return;
    }
    if (myRecruit) {
      notify("すでに募集を公開中です");
      return;
    }
    const settings = {
      "now-duo": { startsIn: 0, duration: 1, partySize: 2 },
      "later-duo": { startsIn: "undecided", duration: 2, partySize: 2 },
      trio: { startsIn: "undecided", duration: 2, partySize: 3 },
    }[preset];
    const body = {
      pokemon: primaryPokemon || "未定",
      roles: [],
      matches: 0,
      winRate: 0,
      ...settings,
      desiredPokemon: "すべて",
      desiredRole: "指定なし",
      note: "",
    };
    setQuickRecruiting(preset);
    try {
      if (preview) {
        const startTimeUndecided = settings.startsIn === "undecided";
        const startAt = new Date(
          Date.now() + (startTimeUndecided ? 0 : Number(settings.startsIn)) * 60_000,
        );
        const recruit: Recruit = {
          ...previewRecruit,
          id: -2,
          trainerName: profile.trainerName,
          gender: profile.gender || "女性",
          pokemon: primaryPokemon,
          role: "指定なし",
          matches: 0,
          winRate: 0,
          rank: profile.highestRate,
          playTime: profile.playTime.join("・"),
          note: "",
          startAt: startAt.toISOString(),
          startTimeUndecided,
          expiresAt: new Date(
            startAt.getTime() + settings.duration * 3_600_000,
          ).toISOString(),
          partySize: settings.partySize,
          desiredPokemon: "すべて",
          desiredRole: "指定なし",
          acceptedCount: 0,
        };
        setMyRecruit(recruit);
        notify("募集を公開しました。あとは申請を待つだけです");
        return;
      }
      const response = await fetch("/api/recruits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        notify(data.error || "募集を投稿できませんでした");
        return;
      }
      setMyRecruit(data.recruit);
      if (pushState === "on") setRecruitShare(data.recruit);
      else setRecruitNotifyPrompt(data.recruit);
      notify("募集を公開しました。あとは申請を待つだけです");
      await Promise.all([loadRecruits(), loadLobbies()]);
    } finally {
      setQuickRecruiting("");
    }
  };

  const quickApplyRecruit = async (recruit: Recruit) => {
    if (guestMode) {
      openRecruitApplication(recruit);
      return;
    }
    if (appliedRecruitIds.has(recruit.id)) {
      notify("この募集には申請済みです");
      return;
    }
    setQuickApplyingId(recruit.id);
    try {
      if (preview) {
        setOutgoing((rows) => [
          ...rows,
          {
            id: -recruit.id,
            recruitId: recruit.id,
            trainerName: recruit.trainerName,
            pokemon: primaryPokemon,
            status: "pending",
          },
        ]);
        notify("👋 参加申請を送りました");
        return;
      }
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recruitId: recruit.id,
          pokemon: primaryPokemon,
          message: `${primaryPokemon}で参加したいです！`,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        notify(data.error || "申請できませんでした");
        return;
      }
      notify("👋 参加申請を送りました");
      await loadNotices();
    } finally {
      setQuickApplyingId(null);
    }
  };

  const finishRecruitNotifyPrompt = async (enable: boolean) => {
    const recruit = recruitNotifyPrompt;
    setRecruitNotifyPrompt(null);
    if (enable) await enablePush();
    if (recruit) setRecruitShare(recruit);
  };
  const cancelRecruit = async (recruit: Recruit) => {
    if (!window.confirm("この募集をキャンセルしますか？届いている未承認の申請も終了します。")) return;
    if (preview) {
      setMyRecruit(null);
      setLobbies([]);
      notify("募集をキャンセルしました");
      return;
    }
    const response = await fetch("/api/recruits", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recruitId: recruit.id, action: "cancel" }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.error || "募集をキャンセルできませんでした");
      return;
    }
    setMyRecruit(null);
    await Promise.all([loadRecruits(), loadLobbies(), loadNotices()]);
    notify("募集をキャンセルしました");
  };

  const recruitUrl = (recruit: Recruit) =>
    recruit.id > 0
      ? `https://yunamatch.vercel.app/?recruit=${recruit.id}`
      : "https://yunamatch.vercel.app/";
  const recruitShareText = (recruit: Recruit) =>
    [
      `【ポケモンユナイト仲間募集】`,
      `${recruit.pokemon} / ${recruit.role}`,
      `${recruit.acceptedCount + 1}/${recruit.partySize}人・${formatRecruitStart(recruit)}`,
      recruit.desiredPokemon !== "すべて"
        ? `希望ポケモン: ${recruit.desiredPokemon}`
        : "",
      recruit.desiredRole !== "指定なし"
        ? `希望ロール: ${recruit.desiredRole}`
        : "",
      `${recruit.rank}・勝率${recruit.winRate}%`,
      recruit.playTime,
      recruit.note,
      "#YUNAMATCH #ポケモンユナイト募集",
    ]
      .filter(Boolean)
      .join("\n");
  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    }
  };
  const shareRecruitToX = (recruit: Recruit) =>
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(recruitShareText(recruit))}&url=${encodeURIComponent(recruitUrl(recruit))}`,
      "_blank",
      "noopener,noreferrer",
    );
  const shareRecruitToDiscord = async (recruit: Recruit) => {
    await copyText(`${recruitShareText(recruit)}\n${recruitUrl(recruit)}`);
    window.open(discordInviteUrl, "_blank", "noopener,noreferrer");
    notify("募集文をコピーしてDiscordの募集部屋を開きました");
  };
  const openDiscord = () =>
    window.open(discordInviteUrl, "_blank", "noopener,noreferrer");
  const createPrivateVoiceRoom = async (connectionId: number) => {
    if (voiceRoomLoading) return;
    if (preview) {
      notify("VC1を二人だけに公開しました");
      openDiscord();
      return;
    }
    const discordWindow = window.open("", "_blank");
    setVoiceRoomLoading(true);
    try {
      const response = await fetch("/api/discord/voice-rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId, action: "open" }),
      });
      const data = await response.json();
      if (!response.ok) {
        discordWindow?.close();
        notify(data.error || "二人だけのVCを作成できませんでした");
        return;
      }
      setVoiceRoom({
        connectionId,
        roomName: data.roomName,
        channelUrl: data.channelUrl,
      });
      notify(`${data.roomName}を二人だけに公開しました`);
      if (discordWindow) discordWindow.location.href = data.channelUrl;
      else window.location.href = data.channelUrl;
    } catch {
      discordWindow?.close();
      notify("通信が不安定です。VCを作成できませんでした");
    } finally {
      setVoiceRoomLoading(false);
    }
  };
  const closePrivateVoiceRoom = async (connectionId: number) => {
    if (voiceRoomLoading) return;
    setVoiceRoomLoading(true);
    try {
      const response = await fetch("/api/discord/voice-rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId, action: "close" }),
      });
      const data = await response.json();
      if (!response.ok) {
        notify(data.error || "VCを閉じられませんでした");
        return;
      }
      setVoiceRoom(null);
      notify(data.closed ? `${data.roomName}を閉じました` : data.message);
    } catch {
      notify("通信が不安定です。VCを閉じられませんでした");
    } finally {
      setVoiceRoomLoading(false);
    }
  };
  const shareRecruitToLine = (recruit: Recruit) =>
    window.open(
      `https://line.me/R/share?text=${encodeURIComponent(`${recruitShareText(recruit)}\n${recruitUrl(recruit)}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  const shareRecruitNatively = async (recruit: Recruit) => {
    const text = recruitShareText(recruit),
      url = recruitUrl(recruit);
    try {
      if (navigator.share) {
        await navigator.share({ title: "YUNAMATCH 募集", text, url });
        return;
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
    }
    await copyText(`${text}\n${url}`);
    notify("募集文とリンクをコピーしました");
  };
  const decide = async (
    applicationId: number,
    action: "accept" | "decline",
  ) => {
    const response = await fetch("/api/applications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId, action }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.error || "処理できませんでした");
      return;
    }
    if (action === "accept" && data.connectionId)
      setMatchResult({
        connectionId: data.connectionId,
        mateContact: data.applicantContact || null,
        mateName: data.mateName || "メイト",
        matePokemon: data.matePokemon || "ポケモン",
      });
    if (selectedPending?.notice.id === applicationId)
      setSelectedPending(null);
    notify(
      action === "accept"
        ? "マッチ成立！チャットが開通しました"
        : "今回は見送りました",
    );
    const [, refreshedConnections] = await Promise.all([
      loadNotices(),
      loadConnections(),
      loadRecruits(),
      loadDiscover(),
    ]);
    if (action === "accept" && data.connectionId) {
      const matchedConnection = refreshedConnections.find(
        (connection) => connection.id === data.connectionId,
      );
      if (matchedConnection) await openChat(matchedConnection);
      else setTab("chat");
    }
  };
  const openChat = async (connection: Connection) => {
    setSelectedPending(null);
    setSelectedConnection(connection);
    setTab("chat");
    setNotificationOpen(false);
    await loadMessages(connection);
  };
  const openPendingConversation = (
    notice: Notice,
    direction: "incoming" | "outgoing",
  ) => {
    setSelectedConnection(null);
    setMessages([]);
    setSelectedPending({ notice, direction });
    setTab("chat");
    setNotificationOpen(false);
  };
  const shareMatchToX = (matePokemon: string) => {
    const text = `YUNAMATCHで${matePokemon}を使うメイトとマッチしました！これから一緒にユナイトします⚡ #YUNAMATCH #ポケモンユナイト`;
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent("https://yunamatch.vercel.app/")}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const connectionId = selectedConnection?.id;
    const body = messageText.trim();
    if (!connectionId || !body || messageSendingRef.current) return;
    messageSendingRef.current = true;
    setMessageSending(true);
    const clientId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId, body, clientId }),
      });
      const data = await response.json();
      if (!response.ok) {
        notify(data.error || "送信できませんでした");
        return;
      }
      setMessages((rows) =>
        rows.some((message) => message.id === data.message.id)
          ? rows
          : [...rows, data.message],
      );
      setMessageText((value) => (value.trim() === body ? "" : value));
      void loadConnections();
    } catch {
      notify("通信が不安定です。メッセージは送信されていません");
    } finally {
      messageSendingRef.current = false;
      setMessageSending(false);
    }
  };
  const sendPlayInvite = async () => {
    const connectionId = selectedConnection?.id;
    if (!connectionId || playInviteSending) return;
    const clientId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `play-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (preview) {
      setMessages((rows) => [
        ...rows,
        {
          id: -Date.now(),
          body: "一緒にプレイしませんか？",
          sender: "me",
          kind: "play_invite",
          response: null,
          canRespond: false,
          createdAt: new Date().toISOString(),
        },
      ]);
      notify("プレイのお誘いを送りました");
      return;
    }
    setPlayInviteSending(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectionId,
          kind: "play_invite",
          clientId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        notify(data.error || "プレイのお誘いを送れませんでした");
        return;
      }
      setMessages((rows) =>
        rows.some((message) => message.id === data.message.id)
          ? rows
          : [...rows, data.message],
      );
      notify("プレイのお誘いを送りました");
    } catch {
      notify("通信が不安定です。もう一度お試しください");
    } finally {
      setPlayInviteSending(false);
    }
  };
  const respondPlayInvite = async (
    messageId: number,
    responseValue: "accepted" | "declined",
  ) => {
    if (respondingInviteId) return;
    setRespondingInviteId(messageId);
    try {
      const response = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId, response: responseValue }),
      });
      const data = await response.json();
      if (!response.ok) {
        notify(data.error || "回答を送れませんでした");
        return;
      }
      setMessages((rows) =>
        rows.map((message) =>
          message.id === messageId ? data.message : message,
        ),
      );
      notify(
        responseValue === "accepted"
          ? "一緒にプレイすることになりました！"
          : "今回は見送りました",
      );
    } catch {
      notify("通信が不安定です。もう一度お試しください");
    } finally {
      setRespondingInviteId(null);
    }
  };
  const toggleAgain = async (connection: Connection) => {
    const response = await fetch("/api/connections", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connectionId: connection.id, action: "again" }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.error || "操作できませんでした");
      return;
    }
    setConnections((rows) =>
      rows.map((row) => (row.id === connection.id ? { ...row, ...data } : row)),
    );
    setSelectedConnection((value) =>
      value?.id === connection.id ? { ...value, ...data } : value,
    );
    notify(
      data.mutualAgain
        ? "両想いです！再マッチできます"
        : data.againByMe
          ? "また遊びたいを送りました"
          : "取り消しました",
    );
  };
  const toggleContactSharing = async (connectionId: number) => {
    if (preview) {
      setConnections((rows) =>
        rows.map((row) =>
          row.id === connectionId
            ? { ...row, myContactShared: !row.myContactShared }
            : row,
        ),
      );
      setSelectedConnection((value) =>
        value?.id === connectionId
          ? { ...value, myContactShared: !value.myContactShared }
          : value,
      );
      return true;
    }
    const response = await fetch("/api/connections", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connectionId, action: "share_contact" }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.error || "連絡先の共有設定を変更できませんでした");
      return false;
    }
    setConnections((rows) =>
      rows.map((row) =>
        row.id === connectionId ? { ...row, ...data } : row,
      ),
    );
    setSelectedConnection((value) =>
      value?.id === connectionId ? { ...value, ...data } : value,
    );
    notify(
      data.myContactShared
        ? "この相手に連絡先を共有しました"
        : "連絡先の共有を解除しました",
    );
    return true;
  };
  const openMateRating = (connection: Connection) => {
    setRatingTarget(connection);
    setRatingScore(connection.myRatingScore || 0);
    setRatingTags(connection.myRatingTags || []);
  };
  const toggleRatingTag = (tag: string) =>
    setRatingTags((current) =>
      current.includes(tag)
        ? current.filter((value) => value !== tag)
        : [...current, tag],
    );
  const submitMateRating = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ratingTarget || !ratingScore || ratingSending) return;
    if (preview) {
      const update = {
        myRatingScore: ratingScore,
        myRatingTags: ratingTags,
      };
      setConnections((rows) =>
        rows.map((row) =>
          row.id === ratingTarget.id ? { ...row, ...update } : row,
        ),
      );
      setSelectedConnection((value) =>
        value?.id === ratingTarget.id ? { ...value, ...update } : value,
      );
      setRatingTarget(null);
      notify("評価を保存しました");
      return;
    }
    setRatingSending(true);
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectionId: ratingTarget.id,
          score: ratingScore,
          tags: ratingTags,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        notify(data.error || "評価を保存できませんでした");
        return;
      }
      const update = {
        myRatingScore: data.score,
        myRatingTags: data.tags || [],
      };
      setConnections((rows) =>
        rows.map((row) =>
          row.id === ratingTarget.id ? { ...row, ...update } : row,
        ),
      );
      setSelectedConnection((value) =>
        value?.id === ratingTarget.id ? { ...value, ...update } : value,
      );
      setRatingTarget(null);
      notify("評価を保存しました。今後のおすすめに反映されます");
    } catch {
      notify("通信が不安定です。もう一度お試しください");
    } finally {
      setRatingSending(false);
    }
  };
  const markPlayed = async (connection: Connection) => {
    if (connection.playedByMe) return;
    if (preview) {
      const data = { playedByMe: true };
      setConnections((rows) =>
        rows.map((row) =>
          row.id === connection.id ? { ...row, ...data } : row,
        ),
      );
      setSelectedConnection((value) =>
        value?.id === connection.id ? { ...value, ...data } : value,
      );
      notify("一緒に遊んだことを記録しました");
      openMateRating({ ...connection, ...data });
      return;
    }
    const response = await fetch("/api/connections", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connectionId: connection.id, action: "played" }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.error || "記録できませんでした");
      return;
    }
    setConnections((rows) =>
      rows.map((row) => (row.id === connection.id ? { ...row, ...data } : row)),
    );
    setSelectedConnection((value) =>
      value?.id === connection.id ? { ...value, ...data } : value,
    );
    notify("一緒に遊んだことを記録しました");
    openMateRating({ ...connection, ...data });
  };
  const rematch = async (connection: Connection) => {
    const response = await fetch("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connectionId: connection.id, action: "rematch" }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.error || "再マッチできませんでした");
      return;
    }
    notify("再マッチのお誘いを送りました");
    await openChat(connection);
  };
  const lobbyAction = async (
    lobby: Lobby,
    action: "ready" | "start" | "finish" | "cancel",
  ) => {
    if (preview) {
      setLobbies((rows) =>
        rows.map((row) =>
          row.id === lobby.id
            ? {
                ...row,
                status:
                  action === "start"
                    ? "playing"
                    : action === "finish" || action === "cancel"
                      ? "finished"
                      : row.status,
                members:
                  action === "ready"
                    ? row.members.map((member) =>
                        member.isMe
                          ? { ...member, ready: !member.ready }
                          : member,
                      )
                    : row.members,
              }
            : row,
        ),
      );
      notify(
        action === "ready"
          ? "準備状態を更新しました"
          : action === "start"
            ? "プレイを開始しました"
            : "ロビーを終了しました",
      );
      return;
    }
    const response = await fetch("/api/lobbies", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lobbyId: lobby.id, action }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.error || "ロビーを更新できませんでした");
      return;
    }
    await Promise.all([loadLobbies(), loadRecruits()]);
    notify(
      action === "ready"
        ? "準備状態を更新しました"
        : action === "start"
          ? "プレイ開始！"
          : "ロビーを更新しました",
    );
  };
  const enablePush = async (): Promise<boolean> => {
    if (
      pushState === "install-required" ||
      pushState === "denied" ||
      pushState === "unsupported"
    ) {
      setPushHelpOpen(true);
      return false;
    }
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPushState("unsupported");
      setPushHelpOpen(true);
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "off");
        if (permission === "denied") setPushHelpOpen(true);
        else notify("通知の許可が完了しませんでした");
        return false;
      }
      const keyResponse = await fetch("/api/push");
      const { publicKey } = await keyResponse.json();
      if (!publicKey) {
        notify("通知の公開設定を準備中です");
        return false;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodePushKey(publicKey),
      });
      const response = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) throw new Error("push");
      setPushState("on");
      notify("プッシュ通知をオンにしました");
      return true;
    } catch {
      setPushHelpOpen(true);
      return false;
    }
  };
  const copyNotificationLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/`);
      notify("YUNAMATCHのリンクをコピーしました");
    } catch {
      notify("ブラウザの共有ボタンからSafariで開いてください");
    }
  };
  const toggleRecruitAlerts = async () => {
    if (guestMode) {
      requestLogin({
        type: "recruit-alert",
        label: "新しい募集の通知を受け取る",
      });
      return;
    }
    if (recruitAlertUpdating) return;
    const enabled = !recruitAlertsEnabled;
    if (enabled && pushState !== "on" && !(await enablePush())) return;
    if (preview) {
      setRecruitAlertsEnabled(enabled);
      notify(enabled ? "新しい募集の通知をオンにしました" : "募集通知をオフにしました");
      return;
    }
    setRecruitAlertUpdating(true);
    try {
      const response = await fetch("/api/recruit-alerts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await response.json();
      if (!response.ok) {
        notify(data.error || "募集通知を変更できませんでした");
        return;
      }
      setRecruitAlertsEnabled(Boolean(data.enabled));
      notify(data.enabled ? "新しい募集の通知をオンにしました" : "募集通知をオフにしました");
    } finally {
      setRecruitAlertUpdating(false);
    }
  };
  const submitSafety = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!safetyTarget) return;
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/safety", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        ...safetyTarget,
        action: "report",
        alsoBlock: body.alsoBlock === "on",
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.error || "通報できませんでした");
      return;
    }
    setSafetyTarget(null);
    notify("通報を受け付けました");
    await Promise.all([loadRecruits(), loadConnections()]);
  };
  const blockTarget = async () => {
    if (!safetyTarget) return;
    const response = await fetch("/api/safety", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...safetyTarget, action: "block" }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.error || "ブロックできませんでした");
      return;
    }
    setSafetyTarget(null);
    setSelectedConnection(null);
    notify("このユーザーをブロックしました");
    await Promise.all([loadRecruits(), loadConnections(), loadDiscover()]);
  };
  const submitSupport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    setSending(false);
    if (!response.ok) {
      notify(data.error || "お問い合わせを送信できませんでした");
      return;
    }
    setSupportOpen(false);
    notify(
      supportMode === "feedback"
        ? "フィードバックを送信しました。ありがとうございます"
        : "お問い合わせを受け付けました。原則24時間以内に確認します",
    );
  };
  const deleteAccount = async () => {
    if (deletionText !== "退会する") return;
    setSending(true);
    const response = await fetch("/api/profile", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation: deletionText }),
    });
    const data = await response.json();
    if (!response.ok) {
      setSending(false);
      notify(data.error || "退会処理を完了できませんでした");
      return;
    }
    location.href = "/api/auth/signout?callbackUrl=%2F";
  };
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onboardingMissing.length) {
      notify(`未入力の項目：${onboardingMissing.join("・")}`);
      return;
    }
    if (preview) {
      setOnboardingOpen(false);
      notify("プロフィールを登録しました");
      return;
    }
    setSending(true);
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile),
    });
    const data = await response.json();
    setSending(false);
    if (!response.ok) {
      notify(data.error || "プロフィールを保存できませんでした");
      return;
    }
    setProfile(data.profile);
    setOnboardingOpen(false);
    notify("プロフィールを保存しました");
    await loadDiscover();
  };

  const shareTrainerCard = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 675;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const value = new Image();
        value.onload = () => resolve(value);
        value.onerror = reject;
        value.src = src;
      });
    const fitText = (
      text: string,
      maxWidth: number,
      startSize: number,
      minSize = 22,
    ) => {
      let size = startSize;
      while (size > minSize) {
        ctx.font = `900 ${size}px sans-serif`;
        if (ctx.measureText(text).width <= maxWidth) break;
        size -= 2;
      }
      return size;
    };
    const drawFitted = (
      text: string,
      x: number,
      y: number,
      maxWidth: number,
      startSize: number,
      minSize = 22,
    ) => {
      ctx.font = `900 ${fitText(text, maxWidth, startSize, minSize)}px sans-serif`;
      ctx.fillText(text, x, y);
    };
    const drawAvatar = async () => {
      const centerX = 1080,
        centerY = 80,
        radius = 44;
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.clip();
      if (profile.avatarUrl) {
        try {
          const image = await loadImage(profile.avatarUrl);
          const side = Math.min(image.naturalWidth, image.naturalHeight);
          ctx.drawImage(
            image,
            (image.naturalWidth - side) / 2,
            (image.naturalHeight - side) / 2,
            side,
            side,
            centerX - radius,
            centerY - radius,
            radius * 2,
            radius * 2,
          );
        } catch {
          ctx.fillStyle = "#ff77aa";
          ctx.fillRect(
            centerX - radius,
            centerY - radius,
            radius * 2,
            radius * 2,
          );
        }
      } else {
        ctx.fillStyle = "#ff77aa";
        ctx.fillRect(
          centerX - radius,
          centerY - radius,
          radius * 2,
          radius * 2,
        );
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 42px sans-serif";
        ctx.fillText(
          profile.trainerName.slice(0, 1).toUpperCase(),
          centerX,
          centerY + 2,
        );
      }
      ctx.restore();
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    };
    const gradient = ctx.createLinearGradient(0, 0, 1200, 675);
    gradient.addColorStop(0, "#35216f");
    gradient.addColorStop(0.55, "#6c4df6");
    gradient.addColorStop(1, "#ff4f91");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 675);
    ctx.globalAlpha = 0.14;
    for (let x = 40; x < 1200; x += 72)
      for (let y = 35; y < 675; y += 72) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.font = "900 42px sans-serif";
    ctx.fillText("YUNAMATCH", 70, 76);
    ctx.font = "700 20px sans-serif";
    ctx.fillText("MY TRAINER CARD", 72, 108);
    await drawAvatar();
    ctx.fillStyle = "#ffffff20";
    ctx.beginPath();
    ctx.roundRect(64, 142, 1072, 472, 34);
    ctx.fill();
    ctx.fillStyle = "#fff";
    drawFitted(profile.trainerName || "TRAINER", 110, 245, 610, 72, 42);
    ctx.font = "800 28px sans-serif";
    ctx.fillText(profile.highestRate, 112, 292);
    ctx.fillStyle = "#ffdfeb";
    ctx.font = "900 24px sans-serif";
    ctx.fillText("MAIN POKÉMON", 112, 372);
    ctx.fillStyle = "#fff";
    drawFitted(profile.mainPokemon.join(" / "), 110, 430, 620, 48, 28);
    ctx.fillStyle = "#ffffffdd";
    ctx.font = "700 22px sans-serif";
    drawFitted(profile.playTime.join(" / "), 112, 565, 650, 24, 18);
    ctx.save();
    ctx.translate(930, 370);
    ctx.fillStyle = "#ffffff20";
    ctx.beginPath();
    ctx.arc(0, 0, 178, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff50";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 118px sans-serif";
    ctx.fillText(
      primaryPokemon.replace(/^(?:アローラ|ガラル)/, "").slice(0, 2),
      0,
      -16,
    );
    ctx.font = "800 25px sans-serif";
    ctx.fillStyle = "#ffffffcc";
    ctx.fillText(primaryPokemon, 0, 92);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) return;
    const file = new File([blob], "yunamatch-trainer-card.png", {
      type: "image/png",
    });
    const text = `${profile.mainPokemon.join("・")}を使っています！相性のいいメイトを探しています。 #YUNAMATCH`;
    try {
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: "YUNAMATCH トレーナーカード",
          text,
          url: "https://yunamatch.vercel.app/",
          files: [file],
        });
        setShareOpen(false);
        return;
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
    }
    const download = document.createElement("a");
    download.href = URL.createObjectURL(blob);
    download.download = file.name;
    download.click();
    window.setTimeout(() => URL.revokeObjectURL(download.href), 1000);
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent("https://yunamatch.vercel.app/")}`,
      "_blank",
      "noopener,noreferrer",
    );
    notify("カード画像を保存しました。Xの投稿に添付してください");
    setShareOpen(false);
  };

  if (!profileReady)
    return (
      <main className="appStage">
        <section className="phoneShell profileLoading">
          <div className="loadingBall" />
          <h1>プロフィールを準備しています</h1>
        </section>
      </main>
    );
  if (suspended)
    return (
      <main className="appStage">
        <section className="phoneShell profileLoading">
          <div className="suspendedMark">!</div>
          <h1>現在このアカウントは利用できません</h1>
          <p>心当たりがない場合は、運営へお問い合わせください。</p>
          <a className="signOutLink" href="/api/auth/signout?callbackUrl=%2F">
            ログアウト
          </a>
        </section>
      </main>
    );

  return (
    <main className="appStage">
      <section className="phoneShell">
        <header className="appHeader">
          <button
            className={guestMode ? "guestHeaderLogin" : "miniAvatar"}
            onClick={() =>
              guestMode
                ? requestLogin({ type: "received", label: "マイページを使う" })
                : setTab("profile")
            }
            aria-label={guestMode ? "ログインする" : "マイページを開く"}
          >
            {guestMode ? (
              "ログイン"
            ) : (
              <UserAvatar
                name={profile.trainerName}
                src={profile.avatarUrl}
                className="miniAvatarImage"
              />
            )}
          </button>
          <div className="appBrand">
            <span>Y</span>
            <div>
              <strong>YUNAMATCH</strong>
              <small>PLAY TOGETHER</small>
            </div>
          </div>
          <button
            className="notificationButton"
            onClick={openNotifications}
            aria-label={`通知を開く${notificationCount ? `、${notificationCount}件` : ""}`}
          >
            <span className="bellGlyph" aria-hidden="true" />
            {notificationCount > 0 && <i>{notificationCount}</i>}
          </button>
        </header>

        <div className="appViewport">
          {guestMode && (
            <div className="guestBrowseBanner">
              <span>見るだけなら登録不要</span>
              <p>いいね・申請・募集はログイン後に使えます</p>
              <button
                onClick={() =>
                  requestLogin({ type: "received", label: "YUNAMATCHを使う" })
                }
              >
                ログイン
              </button>
            </div>
          )}
          {tab === "discover" && (
            <section className="discoverView fullDiscoverView">
              <div className="discoverModeBar">
                <div className="discoverModeTabs">
                  <button
                    className={discoverMode === "recommended" ? "active" : ""}
                    onClick={() => changeDiscoverMode("recommended")}
                  >
                    おすすめ
                  </button>
                  <button
                    className={discoverMode === "received" ? "active" : ""}
                    onClick={() => changeDiscoverMode("received")}
                  >
                    相手から
                    {profileLikes.length > 0 && <b>{profileLikes.length}</b>}
                  </button>
                </div>
                <button
                  className="discoverHelp"
                  onClick={() => setTutorialOpen(true)}
                  aria-label="使い方を見る"
                >
                  <span>?</span>使い方
                </button>
                <button
                  className={`discoverFilter ${activeFilterCount ? "active" : ""}`}
                  onClick={() => setFilterOpen(true)}
                  aria-label={`条件を絞る${activeFilterCount ? `、${activeFilterCount}件設定中` : ""}`}
                >
                  ☷
                  {activeFilterCount > 0 && <i>{activeFilterCount}</i>}
                </button>
              </div>
              {loading ? (
                <div className="stateCard fullDiscoverState">
                  <div className="loadingBall" />
                  <h2>メイトを探しています</h2>
                </div>
              ) : current ? (
                <article
                  className={`fullDiscoverCard ${animation}`}
                  onPointerDown={(event) => setDragStart(event.clientX)}
                  onPointerUp={handlePointerUp}
                >
                  <div className="fullCardBackdrop">
                    <div className="artDots" />
                    <div className="fullCardPokemon">
                      <PokemonImage name={currentPokemon} />
                    </div>
                    <div className="fullCardWatermark">{currentPokemon}</div>
                  </div>
                  <div className="fullCardTopline">
                    <span
                      className={
                        discoverMode === "recommended" &&
                        formatActivity(current.lastActiveAt) === "オンライン"
                          ? "active"
                          : ""
                      }
                    >
                      {discoverMode === "received"
                        ? "♥ あなたにいいね"
                        : `● ${formatActivity(current.lastActiveAt)}`}
                    </span>
                    {guestMode && <b>ログインでプロフィールをすべて表示</b>}
                  </div>
                  <button
                    className="cardTapZone previous"
                    onClick={() => moveCard(-1)}
                    aria-label="前のメイトを見る"
                  />
                  <button
                    className="cardTapZone next"
                    onClick={() => moveCard(1)}
                    aria-label="次のメイトを見る"
                  />
                  <button
                    className="fullCardInfo"
                    onClick={() => setCandidateDetail(current)}
                    aria-label={`${current.trainerName}さんのプロフィールを見る`}
                  >
                    <span className="fullCardIdentity">
                      <UserAvatar
                        name={current.trainerName}
                        src={current.avatarUrl}
                        className="mateAvatar"
                      />
                      <span>
                        <strong>{current.trainerName}</strong>
                        <small>
                          {current.highestRate} ・ {current.gender}
                          {current.age !== null && ` ・ ${current.age}歳`}
                        </small>
                      </span>
                      <b>ⓘ</b>
                    </span>
                    <span className="fullCardPokemonList">
                      {current.mainPokemon.slice(0, 3).map((name) => (
                        <PokemonLabel key={name} name={name} />
                      ))}
                    </span>
                    <span className="fullCardPopularity">
                      {current.popular && <b>人気のメイト</b>}
                      <small>♥ {current.likeCount}人からいいね</small>
                    </span>
                    <span className="fullCardTime">
                      ◷ {current.playTime.join("・")}
                    </span>
                    {current.bio && (
                      <span className="fullCardBio">{current.bio}</span>
                    )}
                    <span className="profileTapHint">
                      タップでプロフィールを見る
                    </span>
                  </button>
                  <div className="fullCardActions">
                    <button
                      className={`fullLikeAction ${likedProfileIds.includes(current.id) ? "liked" : ""}`}
                      onClick={sendProfileLike}
                      aria-pressed={likedProfileIds.includes(current.id)}
                    >
                      <span>
                        {likedProfileIds.includes(current.id) ? "♥" : "♡"}
                      </span>
                      <small>
                        {likedProfileIds.includes(current.id)
                          ? "いいね済み"
                          : "いいね"}
                      </small>
                    </button>
                    <button
                      className="fullRequestAction"
                      onClick={() => openProfileApplication(current)}
                    >
                      <span>⚡</span>
                      <small>メイト申請</small>
                    </button>
                  </div>
                </article>
              ) : (
                <div className="stateCard emptyState fullDiscoverState">
                  <div className="emptyOrb">
                    {discoverMode === "received" ? "♡" : "Y"}
                  </div>
                  <h2>
                    {discoverMode === "received"
                      ? "まだいいねは届いていません"
                      : "新しいメイトを待っています"}
                  </h2>
                  <p>
                    {discoverMode === "received"
                      ? "相手からいいねされると、ここでプロフィールを見られます。"
                      : "条件に合う登録者はまだいません。時間を決めて今すぐ遊ぶなら募集を使えます。"}
                  </p>
                  {discoverMode === "recommended" && (
                    <button onClick={openRecruitComposer}>
                      今遊ぶ人を募集
                    </button>
                  )}
                </div>
              )}
              {tutorialOpen && (
                <div
                  className="discoverTutorial"
                  role="dialog"
                  aria-modal="true"
                  aria-label="探す画面の使い方"
                >
                  <div className="tutorialTop">
                    <strong>カードの使い方</strong>
                    <button
                      onClick={closeTutorial}
                      aria-label="チュートリアルを閉じる"
                    >
                      ×
                    </button>
                  </div>
                  <div className="tutorialZones">
                    <div>
                      <span>☝</span>
                      <strong>左をタップ</strong>
                      <small>前のメイト</small>
                    </div>
                    <div>
                      <span>☝</span>
                      <strong>右をタップ</strong>
                      <small>次のメイト</small>
                    </div>
                    <div>
                      <span>☝</span>
                      <strong>下をタップ</strong>
                      <small>プロフィールを見る</small>
                    </div>
                  </div>
                  <div className="tutorialActionGuide">
                    <span>♡ いいね</span>
                    <span>⚡ メイト申請</span>
                  </div>
                  <button className="tutorialStart" onClick={closeTutorial}>
                    使ってみる
                  </button>
                </div>
              )}
            </section>
          )}

          {tab === "recruit" && (
            <section className="panelView recruitView">
              <div className="viewHeading">
                <div>
                  <small>LIVE RECRUITING</small>
                  <h1>募集中のメイト</h1>
                </div>
                <button onClick={openRecruitComposer}>＋ 条件を決めて募集</button>
              </div>
              <section className="recruitEntryHub">
                <div className="recruitEntryCopy">
                  <div>
                    <small>QUICK START</small>
                    <h2>{myRecruit ? "申請を待っています" : "どう遊ぶ？"}</h2>
                  </div>
                  <p>
                    {myRecruit
                      ? "募集は公開中です。申請が来たら通知とチャットで確認できます。"
                      : "細かい条件はマッチ後に相談。1タップで募集できます。"}
                  </p>
                </div>
                {!myRecruit && (
                  <div className="quickRecruitGrid">
                    <button
                      onClick={() => createQuickRecruit("now-duo")}
                      disabled={Boolean(quickRecruiting)}
                    >
                      <span>⚡</span>
                      <strong>今からデュオ</strong>
                      <small>1時間募集</small>
                    </button>
                    <button
                      onClick={() => createQuickRecruit("later-duo")}
                      disabled={Boolean(quickRecruiting)}
                    >
                      <span>◷</span>
                      <strong>時間は相談</strong>
                      <small>デュオ</small>
                    </button>
                    <button
                      onClick={() => createQuickRecruit("trio")}
                      disabled={Boolean(quickRecruiting)}
                    >
                      <span>◉</span>
                      <strong>トリオ募集</strong>
                      <small>時間は相談</small>
                    </button>
                  </div>
                )}
                <button
                  className={`recruitAlertToggle ${recruitAlertsEnabled ? "active" : ""}`}
                  onClick={toggleRecruitAlerts}
                  disabled={recruitAlertUpdating}
                >
                  <span>{recruitAlertsEnabled ? "✓" : "♢"}</span>
                  <strong>
                    {recruitAlertsEnabled
                      ? "新しい募集を通知中"
                      : "新しい募集が出たら通知"}
                  </strong>
                  <small>{recruitAlertsEnabled ? "タップでオフ" : "募集ゼロでも見逃しません"}</small>
                </button>
              </section>
              <div className="recruitSummary">
                <div>
                  <strong>{visibleRecruits.length}</strong>
                  <span>件の募集</span>
                </div>
                <p>参加したい募集へ、その場ですぐ申請できます</p>
              </div>
              {myRecruit && (
                <article className="myRecruitCard">
                  <div className={`pokemonTile ${roleTone(myRecruit.role)}`}>
                    <PokemonImage name={myRecruit.pokemon} />
                  </div>
                  <div>
                    <small>あなたの募集</small>
                    <strong>
                      {myRecruit.pokemon === "未定"
                        ? "ポケモン未定で募集中"
                        : `${myRecruit.pokemon}で募集中`}
                    </strong>
                    <span>
                      {myRecruit.role !== "指定なし"
                        ? myRecruit.role
                        : myRecruit.playTime}
                    </span>
                  </div>
                  <div className="myRecruitActions">
                    <button onClick={() => setRecruitShare(myRecruit)}>共有</button>
                    <button onClick={() => cancelRecruit(myRecruit)}>キャンセル</button>
                  </div>
                </article>
              )}
              <div className="recruitList">
                {visibleRecruits.length ? (
                  visibleRecruits.map((recruit) => (
                    <article key={recruit.id} className="recruitItem">
                      <header className="recruitCardHeader">
                        <div
                          className={`pokemonTile ${roleTone(recruit.role)}`}
                        >
                          <PokemonImage name={recruit.pokemon} />
                        </div>
                        <div>
                          <div className="recruitTop">
                            <h2>{recruit.trainerName}</h2>
                            <span>
                              ● {recruit.acceptedCount + 1}/{recruit.partySize}
                              人
                            </span>
                          </div>
                          <strong>
                            {recruit.pokemon === "未定"
                              ? "使用ポケモン未定"
                              : recruit.pokemon}
                          </strong>
                          <small>
                            {recruit.role !== "指定なし"
                              ? recruit.role
                              : "役割は相談"}
                          </small>
                        </div>
                      </header>
                      <div className="recruitBadges">
                        <span>{formatRecruitStart(recruit)}</span>
                        <span>
                          {recruit.desiredPokemon === "すべて"
                            ? "相方指定なし"
                            : `${recruit.desiredPokemon}希望`}
                        </span>
                        <span>{recruit.rank}</span>
                      </div>
                      {recruit.note && (
                        <p className="recruitNote">“{recruit.note}”</p>
                      )}
                      <div className="recruitFacts">
                        <div>
                          <span>◷</span>
                          <small>遊べる時間</small>
                          <strong>{recruit.playTime}</strong>
                        </div>
                        <div>
                          <small>本人の試合数</small>
                          <strong>
                            {recruit.matches > 0
                              ? `${recruit.matches.toLocaleString()}戦`
                              : "未設定"}
                          </strong>
                        </div>
                        <div>
                          <small>本人の勝率</small>
                          <strong>
                            {recruit.winRate > 0 ? `${recruit.winRate}%` : "未設定"}
                          </strong>
                        </div>
                      </div>
                      <div className="recruitCardActions">
                        <button
                          className="recruitApply"
                          onClick={() => quickApplyRecruit(recruit)}
                          disabled={
                            quickApplyingId === recruit.id ||
                            appliedRecruitIds.has(recruit.id)
                          }
                        >
                          {appliedRecruitIds.has(recruit.id)
                            ? "✓ 申請済み"
                            : quickApplyingId === recruit.id
                              ? "送信中…"
                              : "👋 すぐ参加申請"}
                        </button>
                        <button
                          className="recruitApply secondary"
                          onClick={() => openRecruitApplication(recruit)}
                        >
                          ひとこと添える
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="listEmpty">
                    <strong>今は公開中の募集がありません</strong>
                    <p>クイック募集を出すか、通知をオンにして待てます。</p>
                    <div className="recruitEmptyActions">
                      <button onClick={() => createQuickRecruit("later-duo")}>
                        募集を出す
                      </button>
                      <button onClick={toggleRecruitAlerts}>
                        {recruitAlertsEnabled ? "通知オン" : "新着を通知"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {tab === "chat" && (
            <section className="panelView chatView">
              {selectedPending ? (
                <>
                  <div className="chatHeader pendingChatHeader">
                    <button
                      onClick={() => setSelectedPending(null)}
                      aria-label="やりとり一覧へ戻る"
                    >
                      ←
                    </button>
                    <UserAvatar
                      name={
                        selectedPending.direction === "incoming"
                          ? selectedPending.notice.applicantName || "メイト"
                          : selectedPending.notice.trainerName || "メイト"
                      }
                      className="chatMateAvatar"
                    />
                    <div>
                      <h1>
                        {selectedPending.direction === "incoming"
                          ? selectedPending.notice.applicantName || "メイト"
                          : selectedPending.notice.trainerName || "メイト"}
                      </h1>
                      <p>承認前のあいさつ</p>
                    </div>
                    <span />
                  </div>
                  <div className="pendingChatNotice">
                    {selectedPending.direction === "incoming"
                      ? "申請を承認すると、自由にメッセージを送れます"
                      : "相手が承認すると、自由にメッセージを送れます"}
                  </div>
                  <div className="messageThread">
                    <div
                      className={`messageBubble ${
                        selectedPending.direction === "outgoing" ? "me" : "mate"
                      }`}
                    >
                      <p>
                        👋 {selectedPending.notice.message || "一緒に遊びたいです！"}
                      </p>
                      <small>
                        {selectedPending.notice.createdAt
                          ? new Date(
                              selectedPending.notice.createdAt,
                            ).toLocaleString("ja-JP", {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "申請を送信済み"}
                      </small>
                    </div>
                  </div>
                  {selectedPending.direction === "incoming" ? (
                    <div className="pendingChatActions">
                      <button
                        onClick={() =>
                          decide(selectedPending.notice.id, "decline")
                        }
                      >
                        見送る
                      </button>
                      <button
                        onClick={() =>
                          decide(selectedPending.notice.id, "accept")
                        }
                      >
                        承認してチャット
                      </button>
                    </div>
                  ) : (
                    <div className="pendingChatWaiting">
                      <span>◷</span>
                      相手の承認を待っています
                    </div>
                  )}
                </>
              ) : selectedConnection ? (
                <>
                  <div className="chatHeader">
                    <button
                      onClick={() => {
                        setChatActionsOpen(false);
                        setSelectedConnection(null);
                        setMessages([]);
                      }}
                      aria-label="チャット一覧へ戻る"
                    >
                      ←
                    </button>
                    <button
                      className="chatProfileButton"
                      onClick={() => setMatchedProfile(selectedConnection)}
                      aria-label={`${selectedConnection.mateName}さんのプロフィールを見る`}
                    >
                      <UserAvatar
                        name={selectedConnection.mateName}
                        src={selectedConnection.mateAvatarUrl}
                        className="chatMateAvatar"
                      />
                      <span>
                        <h1>{selectedConnection.mateName}</h1>
                        <p>
                        <span
                          className={
                            matePresence.online
                              ? "onlineDot active"
                              : "onlineDot"
                          }
                        />{" "}
                        {matePresence.typing
                          ? "入力中…"
                          : matePresence.online
                            ? "オンライン"
                            : `${selectedConnection.matePokemon} ・ マッチ済み`}
                        </p>
                        <small>プロフィールを見る</small>
                      </span>
                    </button>
                    <button
                      className="chatPlayInvite"
                      onClick={sendPlayInvite}
                      disabled={playInviteSending}
                    >
                      <span>🎮</span>
                      {playInviteSending ? "送信中" : "一緒にプレイ"}
                    </button>
                    <button
                      className="chatSafety"
                      onClick={() => setChatActionsOpen(true)}
                      aria-label="チャットのメニューを開く"
                    >
                      •••
                    </button>
                  </div>
                  {selectedConnection.againByMate && (
                    <div className="heartNotice">
                      ♡ {selectedConnection.mateName}
                      さんも、また遊びたいと思っています
                    </div>
                  )}
                  <div className="messageThread">
                    {messages.length ? (
                      messages.map((message) =>
                        message.kind === "play_invite" ? (
                          <div
                            key={message.id}
                            className={`playInviteMessage ${message.sender}`}
                          >
                            <div className="playInviteHeading">
                              <span>🎮</span>
                              <div>
                                <small>PLAY INVITE</small>
                                <strong>一緒にプレイしませんか？</strong>
                              </div>
                            </div>
                            {!message.response && message.canRespond && (
                              <div className="playInviteAnswers">
                                <button
                                  onClick={() =>
                                    respondPlayInvite(message.id, "declined")
                                  }
                                  disabled={respondingInviteId === message.id}
                                >
                                  いいえ
                                </button>
                                <button
                                  onClick={() =>
                                    respondPlayInvite(message.id, "accepted")
                                  }
                                  disabled={respondingInviteId === message.id}
                                >
                                  はい
                                </button>
                              </div>
                            )}
                            {!message.response && !message.canRespond && (
                              <p className="playInviteStatus">相手の返事を待っています</p>
                            )}
                            {message.response === "accepted" && (
                              <div className="playInviteAccepted">
                                <p>✓ 一緒にプレイすることになりました</p>
                                <button
                                  onClick={() =>
                                    createPrivateVoiceRoom(selectedConnection.id)
                                  }
                                  disabled={voiceRoomLoading}
                                >
                                  {voiceRoomLoading
                                    ? "VCを準備中…"
                                    : "二人だけのDiscord VCを作る"}
                                </button>
                              </div>
                            )}
                            {message.response === "declined" && (
                              <p className="playInviteStatus declined">
                                今回は見送りになりました
                              </p>
                            )}
                            <small className="playInviteTime">
                              {new Date(message.createdAt).toLocaleString(
                                "ja-JP",
                                {
                                  month: "numeric",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </small>
                          </div>
                        ) : (
                          <div
                            key={message.id}
                            className={`messageBubble ${message.sender}`}
                          >
                            <p>{message.body}</p>
                            <small>
                              {new Date(message.createdAt).toLocaleString(
                                "ja-JP",
                                {
                                  month: "numeric",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                              {message.sender === "me" && message.read
                                ? " ・ 既読"
                                : ""}
                            </small>
                          </div>
                        ),
                      )
                    ) : (
                      <div className="chatEmpty">
                        <span>👋</span>
                        <h2>チャットが開通しました</h2>
                        <p>プレイ時間や編成を相談してみよう。</p>
                      </div>
                    )}
                  </div>
                  <form className="messageComposer" onSubmit={sendMessage}>
                    <input
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      maxLength={300}
                      placeholder="メッセージを入力"
                      aria-label="メッセージ"
                    />
                    <button
                      disabled={!messageText.trim() || messageSending}
                      aria-label="送信"
                    >
                      {messageSending ? "…" : "➤"}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="chatOverviewHeader">
                    <span />
                    <h1>やりとり</h1>
                    <div>
                      <button
                        onClick={openChatTutorial}
                        aria-label="チャットの使い方"
                      >
                        ?
                      </button>
                      <button
                        onClick={() => {
                          setSupportMode("support");
                          setSupportOpen(true);
                        }}
                        aria-label="運営へ問い合わせ"
                      >
                        •••
                      </button>
                    </div>
                  </div>
                  {connections.length ||
                  incoming.some((notice) => notice.status === "pending") ||
                  outgoing.some((notice) => notice.status === "pending") ? (
                    <>
                      <p className="chatOverviewLead">
                        マッチしたメイトとのチャットです。承認待ちはまとめて確認できます。
                      </p>
                      <div className="chatList">
                        {pendingConversationCount > 0 && (
                          <section className="pendingConversationGroup">
                            <button
                              className="pendingGroupSummary"
                              onClick={() => setPendingGroupOpen((open) => !open)}
                              aria-expanded={pendingGroupOpen}
                            >
                              <span>◷</span>
                              <div>
                                <strong>承認待ち</strong>
                                <p>
                                  {pendingIncoming.length
                                    ? `届いた申請 ${pendingIncoming.length}件`
                                    : "届いた申請なし"}
                                  {pendingOutgoing.length
                                    ? ` ・ 送った申請 ${pendingOutgoing.length}件`
                                    : ""}
                                </p>
                              </div>
                              {pendingIncoming.length > 0 && (
                                <i>{pendingIncoming.length}</i>
                              )}
                              <b>{pendingGroupOpen ? "⌃" : "⌄"}</b>
                            </button>
                            {pendingGroupOpen && (
                              <div className="pendingGroupList">
                                {pendingIncoming.map((notice) => (
                                  <button
                                    key={`pending-incoming-${notice.id}`}
                                    className="chatListItem pending"
                                    onClick={() =>
                                      openPendingConversation(notice, "incoming")
                                    }
                                  >
                                    <UserAvatar
                                      name={notice.applicantName || "メイト"}
                                      className="chatMateAvatar"
                                    />
                                    <div>
                                      <strong>{notice.applicantName}</strong>
                                      <p>👋 あなたに手を振っています</p>
                                      <small>タップして確認</small>
                                    </div>
                                    <span className="unreadBadge">1</span>
                                    <b>›</b>
                                  </button>
                                ))}
                                {pendingOutgoing.map((notice) => (
                                  <button
                                    key={`pending-outgoing-${notice.id}`}
                                    className="chatListItem pending outgoing"
                                    onClick={() =>
                                      openPendingConversation(notice, "outgoing")
                                    }
                                  >
                                    <UserAvatar
                                      name={notice.trainerName || "メイト"}
                                      className="chatMateAvatar"
                                    />
                                    <div>
                                      <strong>{notice.trainerName}</strong>
                                      <p>👋 手を振りました</p>
                                      <small>相手の承認待ち</small>
                                    </div>
                                    <span className="pendingBadge">待ち</span>
                                    <b>›</b>
                                  </button>
                                ))}
                              </div>
                            )}
                          </section>
                        )}
                        {connections.map((connection) => (
                          <button
                            key={connection.id}
                            className="chatListItem"
                            onClick={() => openChat(connection)}
                          >
                            <UserAvatar
                              name={connection.mateName}
                              src={connection.mateAvatarUrl}
                              className="chatMateAvatar"
                            />
                            <div>
                              <strong>{connection.mateName}</strong>
                              <p>{connection.latestMessage}</p>
                              <small>{connection.matePokemon}</small>
                            </div>
                            {connection.unreadCount > 0 && (
                              <span className="unreadBadge">
                                {connection.unreadCount}
                              </span>
                            )}
                            {connection.againByMate && (
                              <span className="heartDot">♡</span>
                            )}
                            <b>›</b>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="chatOverviewEmpty">
                      <div className="chatEmptyIllustration">
                        <span>•••</span>
                      </div>
                      <h2>まだやりとりがありません</h2>
                      <p>
                        気になるメイトを見つけて
                        <br />
                        いいねやメイト申請を送りましょう
                      </p>
                      <button onClick={() => setTab("discover")}>
                        メイトをさがす
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {tab === "lobby" && (
            <section className="panelView lobbyView">
              <div className="viewHeading">
                <div>
                  <small>READY LOBBY</small>
                  <h1>集合ロビー</h1>
                </div>
                <button onClick={openRecruitComposer}>＋ 募集する</button>
              </div>
              <p className="viewLead">
                全員が準備OKになったら、そのままプレイを始められます。
              </p>
              <div className="lobbyList">
                {lobbies.length ? (
                  lobbies.map((lobby) => {
                    const me = lobby.members.find((member) => member.isMe);
                    const allReady =
                      lobby.members.length >= 2 &&
                      lobby.members.every((member) => member.ready);
                    return (
                      <article
                        className={`lobbyCard ${lobby.status}`}
                        key={lobby.id}
                      >
                        <header>
                          <div>
                            <small>
                              {lobby.startTimeUndecided
                                ? "時間は相談"
                                : `${formatStart(lobby.scheduledAt)} START`}
                            </small>
                            <h2>{lobby.pokemon}チーム</h2>
                            <p>
                              {lobby.members.length}/{lobby.partySize}人 ・{" "}
                              {lobby.status === "playing"
                                ? "プレイ中"
                                : allReady
                                  ? "全員準備OK"
                                  : "集合中"}
                            </p>
                          </div>
                          <span>
                            {lobby.status === "playing" ? "PLAY" : "LOBBY"}
                          </span>
                        </header>
                        <div className="lobbyMembers">
                          {lobby.members.map((member) => (
                            <div key={member.userId}>
                              <UserAvatar
                                name={member.trainerName}
                                src={member.avatarUrl}
                                className="lobbyAvatar"
                              />
                              <div>
                                <strong>
                                  {member.trainerName}
                                  {member.isMe && <small> YOU</small>}
                                </strong>
                                <span>{member.pokemon}</span>
                              </div>
                              <b className={member.ready ? "ready" : ""}>
                                {member.ready ? "準備OK" : "待機中"}
                              </b>
                            </div>
                          ))}
                          {Array.from({
                            length: Math.max(
                              0,
                              lobby.partySize - lobby.members.length,
                            ),
                          }).map((_, index) => (
                            <div className="emptyMember" key={`empty-${index}`}>
                              <span>＋</span>
                              <div>
                                <strong>参加者を募集中</strong>
                                <span>
                                  {lobby.desiredPokemon === "すべて"
                                    ? lobby.desiredRole
                                    : lobby.desiredPokemon}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {lobby.status !== "playing" && (
                          <button
                            className={`readyButton ${me?.ready ? "active" : ""}`}
                            onClick={() => lobbyAction(lobby, "ready")}
                          >
                            {me?.ready ? "✓ 準備OKを取り消す" : "準備OK"}
                          </button>
                        )}
                        {lobby.isOwner && lobby.status !== "playing" && (
                          <button
                            className="startPlayButton"
                            disabled={!allReady}
                            onClick={() => lobbyAction(lobby, "start")}
                          >
                            全員そろったらプレイ開始
                          </button>
                        )}
                        {lobby.status === "playing" && (
                          <button
                            className="finishPlayButton"
                            onClick={() => lobbyAction(lobby, "finish")}
                          >
                            ✓ プレイ完了
                          </button>
                        )}
                        <button className="lobbyVcButton" onClick={openDiscord}>
                          🎧 Discord VCで合流
                        </button>
                        {lobby.status !== "playing" && (
                          <button
                            className="cancelLobbyButton"
                            onClick={() => lobbyAction(lobby, "cancel")}
                          >
                            {lobby.isOwner
                              ? "ロビーを解散"
                              : "参加をキャンセル"}
                          </button>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <div className="noticeEmpty">
                    マッチが成立すると、ここに集合ロビーが作られます。
                    <br />
                    まずは募集またはプレイ申請をしてみましょう。
                  </div>
                )}
              </div>
              <div className="discordSafety">
                <span>🛡️</span>
                <div>
                  <strong>安心して遊ぶために</strong>
                  <p>
                    マッチした相手とだけ合流し、本名や住所などの個人情報は共有しないでください。
                  </p>
                </div>
              </div>
            </section>
          )}

          {tab === "profile" && (
            <section className="panelView profileView">
              <div className="profileDashboardTop">
                <button
                  onClick={() =>
                    document
                      .getElementById("profile-edit-form")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  aria-label="プロフィール設定"
                >
                  <span className="settingsGlyph" aria-hidden="true" />
                </button>
                <span>マイページ</span>
                <i aria-hidden="true" />
              </div>
              <div className="profileHero profileDashboardHero">
                <div className="profileAvatarFrame">
                  <UserAvatar
                    name={profile.trainerName}
                    src={profile.avatarUrl}
                    className="profileHeroAvatar"
                  />
                  <button
                    onClick={() =>
                      document
                        .getElementById("profile-edit-form")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    aria-label="プロフィールを編集"
                  >
                    ✎
                  </button>
                </div>
                <small>MY TRAINER PROFILE</small>
                <h1>{profile.trainerName}</h1>
                <p>
                  {profile.mainPokemon.join("・")} ・ {profile.highestRate}
                  {profile.age !== null && ` ・ ${profile.age}歳`}
                </p>
                {profile.bio && <p className="profileHeroBio">{profile.bio}</p>}
                <div className="profileCompletionInline">
                  <span>プロフィール {profileCompletion}%</span>
                  <progress value={profileCompletion} max={100}>
                    {profileCompletion}%
                  </progress>
                </div>
                <button
                  className="shareCardButton"
                  onClick={() => setShareOpen(true)}
                >
                  𝕏 トレーナーカードを共有
                </button>
              </div>
              <div className="profileQuickStats">
                <button
                  onClick={() => {
                    setDiscoverMode("received");
                    setIndex(0);
                    setTab("discover");
                  }}
                >
                  <span>♥</span>
                  <strong>{profileLikes.length}</strong>
                  <small>もらったいいね</small>
                </button>
                <button onClick={openNotifications}>
                  <span>⚡</span>
                  <strong>
                    {
                      outgoing.filter((notice) => notice.status === "pending")
                        .length
                    }
                  </strong>
                  <small>申請中</small>
                </button>
                <button onClick={() => setTab("chat")}>
                  <span>●</span>
                  <strong>{mateCount}</strong>
                  <small>メイト</small>
                </button>
                <button
                  onClick={() =>
                    document
                      .getElementById("profile-edit-form")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  <span className="smallSettingsGlyph" />
                  <strong>編集</strong>
                  <small>プロフィール</small>
                </button>
              </div>
              <form
                id="profile-edit-form"
                className="profileForm profileEditCard"
                onSubmit={saveProfile}
              >
                <div className="profileSectionHeading">
                  <small>PROFILE EDIT</small>
                  <h2>プロフィール編集</h2>
                  <p>登録内容と、マッチ後に任意で共有する連絡先を変更できます。</p>
                </div>
                {avatarEditor()}
                <label>
                  トレーナー名
                  <input
                    value={profile.trainerName}
                    maxLength={24}
                    onChange={(e) =>
                      setProfile({ ...profile, trainerName: e.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  自己紹介（任意）
                  <textarea
                    value={profile.bio}
                    maxLength={160}
                    rows={4}
                    onChange={(event) =>
                      setProfile({ ...profile, bio: event.target.value })
                    }
                    placeholder="好きなポケモンやプレイスタイル、VCについてひとこと"
                  />
                  <small className="fieldCounter">{profile.bio.length} / 160</small>
                </label>
                <PokemonPicker
                  selected={profile.mainPokemon}
                  onChange={(mainPokemon) =>
                    setProfile({ ...profile, mainPokemon })
                  }
                />
                <label>
                  最高レート
                  <select
                    value={profile.highestRate}
                    onChange={(e) =>
                      setProfile({ ...profile, highestRate: e.target.value })
                    }
                  >
                    {rankOptions.map((rate) => (
                      <option key={rate}>{rate}</option>
                    ))}
                  </select>
                </label>
                <PlayTimePicker
                  selected={profile.playTime}
                  onChange={(playTime) => setProfile({ ...profile, playTime })}
                />
                <label>
                  年齢
                  <select
                    value={profile.age ?? ""}
                    onChange={(event) => {
                      const age = event.target.value
                        ? Number(event.target.value)
                        : null;
                      setProfile({
                        ...profile,
                        age,
                        ageConfirmed: age !== null && age >= 18,
                      });
                    }}
                    required
                  >
                    <option value="" disabled>
                      年齢を選択
                    </option>
                    {ageOptions.map((age) => (
                      <option key={age} value={age}>
                        {age}歳
                      </option>
                    ))}
                  </select>
                </label>
                {profile.age !== null && profile.age < 18 && (
                  <label className="termsCheck">
                    <input
                      type="checkbox"
                      checked={profile.ageConfirmed}
                      onChange={(event) =>
                        setProfile({
                          ...profile,
                          ageConfirmed: event.target.checked,
                        })
                      }
                    />
                    <span>保護者の同意を得ています。</span>
                  </label>
                )}
                <fieldset className="genderChoice">
                  <legend>性別</legend>
                  <button
                    type="button"
                    className={profile.gender === "男性" ? "selected" : ""}
                    onClick={() => setProfile({ ...profile, gender: "男性" })}
                  >
                    男子
                  </button>
                  <button
                    type="button"
                    className={profile.gender === "女性" ? "selected" : ""}
                    onClick={() => setProfile({ ...profile, gender: "女性" })}
                  >
                    女子
                  </button>
                </fieldset>
                <label>
                  共有用の連絡先（任意）
                  <input
                    value={profile.contact}
                    maxLength={120}
                    onChange={(e) =>
                      setProfile({ ...profile, contact: e.target.value })
                    }
                    placeholder="Discord: username / X: @username"
                  />
                </label>
                <p className="privacyText">
                  連絡先は自動表示されません。マッチした相手ごとに「共有する」を選んだ場合だけ、その相手へ表示されます。
                </p>
                <label className="termsCheck">
                  <input
                    type="checkbox"
                    checked={profile.termsAccepted}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        termsAccepted: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <a href="/terms" target="_blank" rel="noreferrer">
                      利用規約
                    </a>
                    と
                    <a href="/privacy" target="_blank" rel="noreferrer">
                      プライバシーポリシー
                    </a>
                    に同意します。
                  </span>
                </label>
                <button
                  className="primaryButton"
                  disabled={sending || avatarProcessing}
                >
                  {sending ? "保存中…" : "変更内容を保存"}
                </button>
              </form>
              <section className="notificationSettings">
                <span>
                  <span className="bellGlyph" aria-hidden="true" />
                </span>
                <div>
                  <strong>プッシュ通知</strong>
                  <p>
                    申請・マッチ・チャットをサイトを閉じていても受け取れます。
                  </p>
                </div>
                <button
                  className={pushState === "on" ? "enabled" : ""}
                  onClick={enablePush}
                  disabled={pushState === "on"}
                >
                  {pushState === "on"
                    ? "通知オン"
                    : pushState === "off"
                      ? "オンにする"
                      : "設定方法"}
                </button>
              </section>
              <section className="linkedAccountSettings">
                <div className="profileSectionHeading">
                  <small>LOGIN SETTINGS</small>
                  <h2>ログイン・連携アカウント</h2>
                  <p>
                    別のアカウントを追加すると、次回からそのアカウントでも同じプロフィールに入れます。
                  </p>
                </div>
                <div className="linkedAccountList">
                  {loginProviders.map((provider) => {
                    const linked = linkedAccounts.find(
                      (account) => account.provider === provider.id,
                    );
                    return (
                      <article
                        key={provider.id}
                        className={linked ? "linked" : ""}
                      >
                        <span className={`providerMark ${provider.id}`}>
                          {provider.mark}
                        </span>
                        <div>
                          <strong>{provider.label}</strong>
                          <small>
                            {linked
                              ? linked.contactId ||
                                linked.displayName ||
                                "連携済み"
                              : "未連携"}
                          </small>
                        </div>
                        {linked ? (
                          <b>{linked.isCurrent ? "ログイン中" : "連携済み"}</b>
                        ) : (
                          <a href={`/api/link/${provider.id}`}>連携する</a>
                        )}
                      </article>
                    );
                  })}
                </div>
                <p className="accountChoiceNote">
                  連携時は各サービスのアカウント選択画面が開きます。
                </p>
              </section>
              {isAdmin && (
                <a className="adminDashboardLink" href="/admin">
                  <span>↗</span>
                  <div>
                    <strong>運営ダッシュボード</strong>
                    <small>訪問者数・登録者数・通報を確認</small>
                  </div>
                  <b>›</b>
                </a>
              )}
              <a
                className="signOutLink"
                href="/api/auth/signout?callbackUrl=%2F"
              >
                ログアウト
              </a>
              <p className="fanNote">
                非公式ファンメイドサービスです。ゲーム仲間探し以外の目的での利用は禁止です。ポケモンの画像・名称などの権利は各権利者に帰属します。
              </p>
            </section>
          )}
          {tab === "profile" && (
            <section className="profileOperations">
              <section className="discordCommunitySettings">
                <span className="discordCommunityMark">D</span>
                <div>
                  <small>YUNAMATCH COMMUNITY</small>
                  <strong>Discordで募集・VCに参加</strong>
                  <p>
                    参加時にランク・希望ロール・VC可否を選び、募集チャンネルでは{" "}
                    <b>/募集</b> が使えます。
                  </p>
                </div>
                <a href="/community">参加方法を見る</a>
              </section>
              <div className="accountOperations">
                <button onClick={() => {
                  setSupportMode("support");
                  setSupportOpen(true);
                }}>
                  <span>?</span>
                  <div>
                    <strong>運営へお問い合わせ</strong>
                    <small>不具合やアカウントの相談を送る</small>
                  </div>
                  <b>›</b>
                </button>
                <button onClick={() => {
                  setSupportMode("feedback");
                  setSupportOpen(true);
                }}>
                  <span>✦</span>
                  <div>
                    <strong>フィードバックを送る</strong>
                    <small>改善案・使いにくい点・良かった点を伝える</small>
                  </div>
                  <b>›</b>
                </button>
                <button
                  className="deleteAccountLink"
                  onClick={() => setDeletionOpen(true)}
                >
                  アカウントを削除して退会
                </button>
              </div>
            </section>
          )}
        </div>

        <nav className="bottomNav" aria-label="メインメニュー">
          <button
            className={tab === "discover" ? "active" : ""}
            onClick={() => setTab("discover")}
          >
            <span>⌕</span>さがす
          </button>
          <button
            className={tab === "recruit" ? "active" : ""}
            onClick={() => setTab("recruit")}
          >
            <span>＋</span>募集
          </button>
          <button
            className={tab === "chat" ? "active" : ""}
            onClick={() => {
              if (guestMode) {
                requestLogin({ type: "received", label: "やりとりを見る" });
                return;
              }
              setTab("chat");
              loadConnections();
            }}
          >
            <span>▢</span>やりとり
            {unreadCount + heartCount > 0 && <i>{unreadCount + heartCount}</i>}
          </button>
          <button
            className={tab === "lobby" ? "active" : ""}
            onClick={() => {
              if (guestMode) {
                requestLogin({ type: "received", label: "集合ロビーを使う" });
                return;
              }
              setTab("lobby");
              loadLobbies();
            }}
          >
            <span>⚡</span>ロビー
          </button>
          <button
            className={tab === "profile" ? "active" : ""}
            onClick={() =>
              guestMode
                ? requestLogin({ type: "received", label: "マイページを使う" })
                : setTab("profile")
            }
          >
            <span>
              <span className="navPersonIcon" aria-hidden="true" />
            </span>
            マイページ
          </button>
        </nav>
      </section>

      {guestMode && loginOpen && (
        <div className="guestLoginBackdrop" onClick={closeLogin}>
          <section
            className="guestLoginCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-login-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="guestLoginClose"
              onClick={closeLogin}
              aria-label="ログイン画面を閉じる"
            >
              ×
            </button>
            <div className="guestLoginMark">⚡</div>
            <small>YUNAMATCH</small>
            <h2 id="guest-login-title">ログインすると続けられます</h2>
            <p>
              <strong>{loginAction}</strong>
              は、無料ログイン後に利用できます。
            </p>
            <div className="guestLoginProviders">
              {loginProviders.map((provider) => (
                <a
                  key={provider.id}
                  className={`${provider.id}${loginProvider ? " isLoading" : ""}`}
                  href={`/api/login/${provider.id}?returnTo=${encodeURIComponent("/?resume=1")}`}
                  aria-disabled={Boolean(loginProvider)}
                  onClick={(event) => {
                    if (loginProvider) {
                      event.preventDefault();
                      return;
                    }
                    setLoginProvider(provider.id);
                  }}
                >
                  <span>{provider.mark}</span>
                  {loginProvider === provider.id
                    ? "開いています…"
                    : `${provider.label}で続ける`}
                </a>
              ))}
            </div>
            <p className="guestLoginNote">
              初回だけプロフィールを登録します。完了後、この操作へ自動で戻ります。
            </p>
            <nav aria-label="ログイン前の確認">
              <a href="/privacy">プライバシー</a>
              <a href="/terms">利用規約</a>
              <a href="/contact">お問い合わせ</a>
            </nav>
          </section>
        </div>
      )}

      {onboardingOpen && (
        <div className="onboardingBackdrop">
          <form className="onboardingCard" onSubmit={saveProfile}>
            <div className="onboardingBrand">
              <span>Y</span>
              <div>
                <strong>YUNAMATCH</strong>
                <small>WELCOME, TRAINER</small>
              </div>
            </div>
            <div className="onboardingProgress">
              <span>プロフィール登録</span>
              <b>1 / 1</b>
            </div>
            <h1>
              あなたのことを
              <br />
              教えてください
            </h1>
            <p className="onboardingLead">
              相性のいいユナイト仲間を探すための基本情報です。
            </p>
            {avatarEditor()}
            <label>
              トレーナー名
              <input
                value={profile.trainerName}
                maxLength={24}
                onChange={(event) =>
                  setProfile({ ...profile, trainerName: event.target.value })
                }
                placeholder="ゲーム内の名前"
                required
              />
            </label>
            <label>
              自己紹介（任意）
              <textarea
                value={profile.bio}
                maxLength={160}
                rows={4}
                onChange={(event) =>
                  setProfile({ ...profile, bio: event.target.value })
                }
                placeholder="好きなポケモンやプレイスタイル、VCについてひとこと"
              />
              <small className="fieldCounter">{profile.bio.length} / 160</small>
            </label>
            <PokemonPicker
              selected={profile.mainPokemon}
              onChange={(mainPokemon) =>
                setProfile({ ...profile, mainPokemon })
              }
            />
            <label>
              最高レート
              <select
                value={profile.highestRate}
                onChange={(event) =>
                  setProfile({ ...profile, highestRate: event.target.value })
                }
              >
                {rankOptions.map((rate) => (
                  <option key={rate}>{rate}</option>
                ))}
              </select>
            </label>
            <PlayTimePicker
              selected={profile.playTime}
              onChange={(playTime) => setProfile({ ...profile, playTime })}
            />
            <label>
              年齢
              <select
                value={profile.age ?? ""}
                onChange={(event) => {
                  const age = event.target.value
                    ? Number(event.target.value)
                    : null;
                  setProfile({
                    ...profile,
                    age,
                    ageConfirmed: age !== null && age >= 18,
                  });
                }}
                required
              >
                <option value="" disabled>
                  年齢を選択
                </option>
                {ageOptions.map((age) => (
                  <option key={age} value={age}>
                    {age}歳
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="genderChoice">
              <legend>性別</legend>
              <button
                type="button"
                className={profile.gender === "男性" ? "selected" : ""}
                onClick={() => setProfile({ ...profile, gender: "男性" })}
              >
                男子
              </button>
              <button
                type="button"
                className={profile.gender === "女性" ? "selected" : ""}
                onClick={() => setProfile({ ...profile, gender: "女性" })}
              >
                女子
              </button>
            </fieldset>
            <label>
              共有用の連絡先（任意）
              <input
                value={profile.contact}
                maxLength={120}
                onChange={(event) =>
                  setProfile({ ...profile, contact: event.target.value })
                }
              />
            </label>
            <p className="contactNote">
              <span>🔒</span>
              ログインアカウントのIDを初期値にしています。マッチ後も自動では表示されず、相手ごとに共有するか選べます。
            </p>
            {profile.age !== null && profile.age < 18 && (
              <label className="termsCheck">
                <input
                  type="checkbox"
                  checked={profile.ageConfirmed}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      ageConfirmed: event.target.checked,
                    })
                  }
                />
                <span>保護者の同意を得ています。</span>
              </label>
            )}
            <label className="termsCheck">
              <input
                type="checkbox"
                checked={profile.termsAccepted}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    termsAccepted: event.target.checked,
                  })
                }
              />
              <span>
                <a href="/terms" target="_blank">
                  利用規約
                </a>
                と
                <a href="/privacy" target="_blank">
                  プライバシーポリシー
                </a>
                に同意します。
              </span>
            </label>
            {onboardingMissing.length > 0 && (
              <p className="onboardingMissing">
                あと <strong>{onboardingMissing.join("・")}</strong>{" "}
                を入力してください
              </p>
            )}
            <button
              className="onboardingSubmit"
              disabled={sending || avatarProcessing}
            >
              {sending ? "登録しています…" : "登録してメイトを探す"}
            </button>
          </form>
        </div>
      )}

      {pushPromptOpen && (
        <div className="pushPromptBackdrop">
          <section
            className="pushPromptCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="push-prompt-title"
          >
            <div className="pushPromptIcon">
              <span className="bellGlyph" aria-hidden="true" />
            </div>
            <small>DON&apos;T MISS A MATCH</small>
            <h2 id="push-prompt-title">
              大事な通知を
              <br />
              見逃さないようにしますか？
            </h2>
            <p>
              いいね・メイト申請・マッチ成立・新着メッセージを、サイトを閉じていても確認できます。
            </p>
            <ul>
              <li>
                <span>♥</span>いいね・メイト申請
              </li>
              <li>
                <span>⚡</span>マッチ成立
              </li>
              <li>
                <span>●</span>新しいメッセージ
              </li>
            </ul>
            <button className="pushPromptEnable" onClick={confirmPushPrompt}>
              通知をオンにする
            </button>
            <button className="pushPromptLater" onClick={dismissPushPrompt}>
              あとで
            </button>
          </section>
        </div>
      )}

      {pushHelpOpen && (
        <div className="pushPromptBackdrop">
          <section
            className="pushPromptCard pushHelpCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="push-help-title"
          >
            <div className="pushPromptIcon">
              <span className="bellGlyph" aria-hidden="true" />
            </div>
            <small>NOTIFICATION SETUP</small>
            <h2 id="push-help-title">
              {pushState === "denied"
                ? "通知の許可をオンにしてください"
                : "ホーム画面から開くと通知できます"}
            </h2>
            {pushState === "denied" ? (
              <p>
                端末の「設定」→「通知」→「YUNAMATCH」から通知を許可し、アプリを開き直してください。
              </p>
            ) : (
              <>
                <p>
                  アプリ内ブラウザやiPhoneの通常タブでは、プッシュ通知を使えない場合があります。
                </p>
                <ol className="pushHelpSteps">
                  <li><b>1</b><span>Safariなどの通常ブラウザでYUNAMATCHを開く</span></li>
                  <li><b>2</b><span>共有ボタンから「ホーム画面に追加」を選ぶ</span></li>
                  <li><b>3</b><span>追加したYUNAMATCHを開き「通知をオン」にする</span></li>
                </ol>
                <button className="pushPromptEnable" onClick={copyNotificationLink}>
                  YUNAMATCHのリンクをコピー
                </button>
              </>
            )}
            <button className="pushPromptLater" onClick={() => setPushHelpOpen(false)}>
              閉じる
            </button>
          </section>
        </div>
      )}

      {chatTutorialOpen && (
        <div className="chatTutorialBackdrop">
          <button
            className="backdropDismiss"
            onClick={closeChatTutorial}
            aria-label="使い方を閉じる"
          />
          <section className="chatTutorialSheet">
            <div className="sheetHandle" />
            <button className="closeButton" onClick={closeChatTutorial}>
              ×
            </button>
            <small>使い方のヒント</small>
            {chatTutorialStep === 0 ? (
              <>
                <div className="chatTutorialVisual">
                  <div className="tutorialMateRow">
                    <span>M</span>
                    <div>
                      <strong>momo</strong>
                      <small>ハピナスで一緒に遊びましょう！</small>
                    </div>
                    <b>1</b>
                  </div>
                  <div className="tutorialTapFinger">☝</div>
                </div>
                <h2>
                  メイトをタップして
                  <br />
                  やりとりを始めよう
                </h2>
                <p>
                  未読メッセージは数字で表示。
                  <br />
                  マッチした相手だけと安全に話せます。
                </p>
              </>
            ) : (
              <>
                <div className="chatTutorialVisual actions">
                  <span>♡ また遊びたい</span>
                  <span>↻ 再マッチ</span>
                  <span>🎧 VCで合流</span>
                </div>
                <h2>
                  次のプレイまで
                  <br />
                  そのままつながる
                </h2>
                <p>
                  もう一度遊びたい気持ちを送り、
                  <br />
                  再募集やDiscord VCへすぐ移動できます。
                </p>
              </>
            )}
            <div className="chatTutorialDots">
              <i className={chatTutorialStep === 0 ? "active" : ""} />
              <i className={chatTutorialStep === 1 ? "active" : ""} />
            </div>
            <button
              className="chatTutorialNext"
              onClick={() =>
                chatTutorialStep === 0
                  ? setChatTutorialStep(1)
                  : closeChatTutorial()
              }
            >
              {chatTutorialStep === 0 ? "次へ" : "使ってみる"}
            </button>
          </section>
        </div>
      )}

      {notificationOpen && (
        <div className="modalBackdrop">
          <button
            className="backdropDismiss"
            onClick={() => setNotificationOpen(false)}
            aria-label="通知を閉じる"
          />
          <section className="notificationSheet">
            <div className="sheetHandle" />
            <button
              className="closeButton"
              onClick={() => setNotificationOpen(false)}
            >
              ×
            </button>
            <small className="modalKicker">NOTIFICATIONS</small>
            <h2>通知</h2>
            <div className="notificationList">
              {profileLikes.map((like) => (
                <button
                  key={`profile-like-${like.id}`}
                  className="notificationRow heart"
                  onClick={() => showLikedProfile(like.senderId)}
                >
                  <span>♥</span>
                  <div>
                    <strong>{like.senderName}さんからいいね</strong>
                    <p>{like.senderPokemon}を使うプレイヤーです</p>
                  </div>
                  <b>›</b>
                </button>
              ))}
              {heartCount > 0 &&
                connections
                  .filter((c) => c.againByMate && !c.againByMe)
                  .map((connection) => (
                    <button
                      key={`heart-${connection.id}`}
                      className="notificationRow heart"
                      onClick={() => openChat(connection)}
                    >
                      <span>♡</span>
                      <div>
                        <strong>{connection.mateName}さんからハート</strong>
                        <p>「また遊びたい」が届きました</p>
                      </div>
                      <b>›</b>
                    </button>
                  ))}
              {incoming
                .filter((n) => n.status === "pending")
                .map((notice) => (
                  <article
                    key={`request-${notice.id}`}
                    className="notificationRequest"
                  >
                    <div className="notificationRow">
                      <span>⚡</span>
                      <div>
                        <strong>{notice.applicantName}さんから申請</strong>
                        <p>{notice.pokemon}で一緒に遊びたいそうです</p>
                      </div>
                    </div>
                    <div>
                      <button onClick={() => decide(notice.id, "decline")}>
                        見送る
                      </button>
                      <button onClick={() => decide(notice.id, "accept")}>
                        承認する
                      </button>
                    </div>
                  </article>
                ))}
              {outgoing
                .filter((n) => n.status === "accepted")
                .map((notice) => (
                  <button
                    key={`accepted-${notice.id}`}
                    className="notificationRow accepted"
                    onClick={() => {
                      const connection = connections.find(
                        (c) => c.mateName === notice.trainerName,
                      );
                      if (connection) openChat(connection);
                    }}
                  >
                    <span>✓</span>
                    <div>
                      <strong>{notice.trainerName}さんとマッチ成立</strong>
                      <p>チャットからプレイ時間を相談できます</p>
                    </div>
                    <b>›</b>
                  </button>
                ))}
              {!profileLikes.length &&
                !heartCount &&
                !pendingCount &&
                !outgoing.some((n) => n.status === "accepted") && (
                  <div className="noticeEmpty">新しい通知はありません</div>
                )}
            </div>
          </section>
        </div>
      )}

      {filterOpen && (
        <div className="modalBackdrop">
          <button
            className="backdropDismiss"
            onClick={() => setFilterOpen(false)}
            aria-label="絞り込みを閉じる"
          />
          <section className="sheetModal discoverFilterSheet">
            <div className="sheetHandle" />
            <button
              className="closeButton"
              onClick={() => setFilterOpen(false)}
            >
              ×
            </button>
            <small className="modalKicker">SEARCH FILTER</small>
            <h2>希望のメイト</h2>
            <label>
              ポケモン名
              <input
                type="search"
                value={pokemonQuery}
                list="discover-pokemon-options"
                placeholder="例：ゲッコウガ"
                onChange={(e) => {
                  setPokemonQuery(e.target.value);
                  setIndex(0);
                }}
              />
              <datalist id="discover-pokemon-options">
                {pokemon.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <label>
              プレイヤーネーム
              <input
                type="search"
                value={trainerQuery}
                placeholder="名前の一部でも検索できます"
                onChange={(e) => {
                  setTrainerQuery(e.target.value);
                  setIndex(0);
                }}
              />
            </label>
            <fieldset className="genderChoice discoverGenderFilter">
              <legend>性別</legend>
              <button
                type="button"
                className={genderFilter === "" ? "selected" : ""}
                onClick={() => {
                  setGenderFilter("");
                  setIndex(0);
                }}
              >
                すべて
              </button>
              <button
                type="button"
                className={genderFilter === "男性" ? "selected" : ""}
                onClick={() => {
                  setGenderFilter("男性");
                  setIndex(0);
                }}
              >
                男性
              </button>
              <button
                type="button"
                className={genderFilter === "女性" ? "selected" : ""}
                onClick={() => {
                  setGenderFilter("女性");
                  setIndex(0);
                }}
              >
                女性
              </button>
            </fieldset>
            <label className="toggleRow">
              <input
                type="checkbox"
                checked={sharedTimeOnly}
                onChange={(e) => {
                  setSharedTimeOnly(e.target.checked);
                  setIndex(0);
                }}
              />
              <span>自分と遊べる時間帯が合う人だけ</span>
            </label>
            <div className="filterActionRow">
              <button
                className="filterResetButton"
                onClick={() => {
                  setPokemonQuery("");
                  setTrainerQuery("");
                  setGenderFilter("");
                  setSharedTimeOnly(false);
                  setIndex(0);
                }}
                disabled={!activeFilterCount}
              >
                条件をリセット
              </button>
              <button
                className="primaryButton"
                onClick={() => setFilterOpen(false)}
              >
                {cards.length}人から探す
              </button>
            </div>
          </section>
        </div>
      )}

      {candidateDetail && (
        <div className="modalBackdrop">
          <button
            className="backdropDismiss"
            onClick={() => setCandidateDetail(null)}
            aria-label="プロフィールを閉じる"
          />
          <section className="sheetModal candidateDetailSheet">
            <div className="sheetHandle" />
            <button
              className="closeButton"
              onClick={() => setCandidateDetail(null)}
            >
              ×
            </button>
            <div className="candidateDetailHero">
              <div className="candidateDetailPokemon">
                <PokemonImage
                  name={candidateDetail.mainPokemon[0] || "未設定"}
                />
              </div>
              <UserAvatar
                name={candidateDetail.trainerName}
                src={candidateDetail.avatarUrl}
                className="candidateDetailAvatar"
              />
            </div>
            <small className="modalKicker">MATE PROFILE</small>
            <h2>{candidateDetail.trainerName}</h2>
            <p className="candidateDetailRank">
              {candidateDetail.highestRate} ・ {candidateDetail.gender} ・{" "}
              {candidateDetail.age !== null && `${candidateDetail.age}歳 ・ `}
              {formatActivity(candidateDetail.lastActiveAt)}
            </p>
            <div className="candidatePopularity">
              {candidateDetail.popular && <b>人気のメイト</b>}
              <span>♥ {candidateDetail.likeCount}人からいいねされています</span>
            </div>
            {candidateDetail.bio && (
              <div className="candidateBio">
                <small>自己紹介</small>
                <p>{candidateDetail.bio}</p>
              </div>
            )}
            <div className="pairingLine">
              <div>
                <small>あなた</small>
                <PokemonLabel name={primaryPokemon} />
              </div>
              <b>×</b>
              <div>
                <small>相手</small>
                <PokemonLabel
                  name={candidateDetail.mainPokemon[0] || "未設定"}
                />
              </div>
            </div>
            <div className="profilePokemonList">
              <small>使うポケモン</small>
              <div>
                {candidateDetail.mainPokemon.map((name) => (
                  <PokemonLabel key={name} name={name} />
                ))}
              </div>
            </div>
            <div className="timeChip">
              <span>◷</span>
              <div>
                <small>遊べる時間帯</small>
                <strong>{candidateDetail.playTime.join("・")}</strong>
              </div>
            </div>
            <div className="candidateDetailActions">
              <button
                className={
                  likedProfileIds.includes(candidateDetail.id) ? "liked" : ""
                }
                onClick={() => {
                  if (current?.id === candidateDetail.id) sendProfileLike();
                }}
              >
                {likedProfileIds.includes(candidateDetail.id)
                  ? "♥ いいね済み"
                  : "♡ いいね"}
              </button>
              <button
                onClick={() => {
                  setCandidateDetail(null);
                  openProfileApplication(candidateDetail);
                }}
              >
                ⚡ メイト申請
              </button>
            </div>
          </section>
        </div>
      )}

      {matchedProfile && (
        <div className="modalBackdrop">
          <button
            className="backdropDismiss"
            onClick={() => setMatchedProfile(null)}
            aria-label="プロフィールを閉じる"
          />
          <section className="sheetModal candidateDetailSheet matchedProfileSheet">
            <div className="sheetHandle" />
            <button className="closeButton" onClick={() => setMatchedProfile(null)}>×</button>
            <div className="candidateDetailHero">
              <div className="candidateDetailPokemon">
                <PokemonImage name={matchedProfile.mateMainPokemon[0] || matchedProfile.matePokemon} />
              </div>
              <UserAvatar
                name={matchedProfile.mateName}
                src={matchedProfile.mateAvatarUrl}
                className="candidateDetailAvatar"
              />
            </div>
            <small className="modalKicker">MATCHED MATE PROFILE</small>
            <h2>{matchedProfile.mateName}</h2>
            <p className="candidateDetailRank">
              {matchedProfile.mateHighestRate} ・ {matchedProfile.mateGender}
              {matchedProfile.mateAge !== null && ` ・ ${matchedProfile.mateAge}歳`}
            </p>
            <div className="matchedProfileBadge">✓ マッチ済みのメイト</div>
            {matchedProfile.mateBio && (
              <div className="candidateBio">
                <small>自己紹介</small>
                <p>{matchedProfile.mateBio}</p>
              </div>
            )}
            <div className="profilePokemonList">
              <small>使うポケモン</small>
              <div>
                {matchedProfile.mateMainPokemon.map((name) => (
                  <PokemonLabel key={name} name={name} />
                ))}
              </div>
            </div>
            <div className="timeChip">
              <span>◷</span>
              <div>
                <small>遊べる時間帯</small>
                <strong>{matchedProfile.matePlayTime.join("・") || "未設定"}</strong>
              </div>
            </div>
            <button className="matchedProfileClose" onClick={() => setMatchedProfile(null)}>
              チャットに戻る
            </button>
          </section>
        </div>
      )}

      {ratingTarget && (
        <div className="modalBackdrop">
          <button
            className="backdropDismiss"
            onClick={() => setRatingTarget(null)}
            aria-label="評価を閉じる"
          />
          <form className="sheetModal ratingSheet" onSubmit={submitMateRating}>
            <button
              type="button"
              className="closeButton"
              onClick={() => setRatingTarget(null)}
              aria-label="評価を閉じる"
            >
              ×
            </button>
            <UserAvatar
              name={ratingTarget.mateName}
              src={ratingTarget.mateAvatarUrl}
              className="ratingAvatar"
            />
            <small className="modalKicker">AFTER PLAY</small>
            <h2>{ratingTarget.mateName}さんとのプレイは？</h2>
            <p className="ratingLead">
              評価者と点数は相手に表示されません。おすすめ順の改善に使います。
            </p>
            <div className="ratingStars" aria-label="5段階評価">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  type="button"
                  key={score}
                  className={ratingScore >= score ? "active" : ""}
                  onClick={() => setRatingScore(score)}
                  aria-label={`${score}点`}
                  aria-pressed={ratingScore === score}
                >
                  ★
                </button>
              ))}
            </div>
            <strong className="ratingLabel">
              {ratingScore
                ? mateRatingLabels[ratingScore]
                : "星を選んでください"}
            </strong>
            <fieldset className="ratingTags">
              <legend>良かったところ（任意）</legend>
              <div>
                {mateRatingTags.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    className={ratingTags.includes(tag) ? "active" : ""}
                    onClick={() => toggleRatingTag(tag)}
                    aria-pressed={ratingTags.includes(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              className="primaryButton"
              disabled={!ratingScore || ratingSending}
            >
              {ratingSending
                ? "保存しています…"
                : ratingTarget.myRatingScore
                  ? "評価を更新する"
                  : "評価を送る"}
            </button>
          </form>
        </div>
      )}

      {compose && (
        <div className="modalBackdrop">
          <form className="sheetModal formSheet" onSubmit={submitRecruit}>
            <button
              type="button"
              className="closeButton"
              onClick={() => setCompose(false)}
            >
              ×
            </button>
            <small className="modalKicker">CREATE RECRUIT</small>
            <h2>メイトを募集</h2>
            <label>
              使用ポケモン <small>任意</small>
              <select name="pokemon" defaultValue="未定">
                <option value="未定">未定（役割から募集）</option>
                {profile.mainPokemon.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <fieldset className="recruitRolePicker">
              <legend>
                自分の役割 <small>任意・複数選択できます</small>
              </legend>
              <div>
                {recruitRoleOptions.map((role) => (
                  <label key={role}>
                    <input type="checkbox" name="roles" value={role} />
                    <span>{role}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="threeFields">
              <label>
                開始時間 <small>任意</small>
                <select name="startsIn" defaultValue="undecided">
                  <option value="undecided">相談して決める</option>
                  <option value="0">今から</option>
                  <option value="30">30分後</option>
                  <option value="60">1時間後</option>
                  <option value="120">2時間後</option>
                </select>
              </label>
              <label>
                募集時間
                <select name="duration" defaultValue="2">
                  <option value="1">1時間</option>
                  <option value="2">2時間</option>
                  <option value="3">3時間</option>
                </select>
              </label>
              <label>
                人数
                <select name="partySize" defaultValue="2">
                  <option value="2">デュオ</option>
                  <option value="3">トリオ</option>
                  <option value="5">フルパ</option>
                </select>
              </label>
            </div>
            <div className="twoFields">
              <label>
                希望ポケモン
                <select name="desiredPokemon" defaultValue="すべて">
                  <option>すべて</option>
                  {pokemon.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                希望ロール
                <select name="desiredRole">
                  <option>指定なし</option>
                  {recruitRoleOptions.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="twoFields">
              <label>
                自分の試合数
                <input
                  name="matches"
                  type="number"
                  min="0"
                  max="99999"
                  defaultValue="1000"
                  required
                />
              </label>
              <label>
                自分の勝率
                <input
                  name="winRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue="50"
                  required
                />
              </label>
            </div>
            <label>
              ひとこと <small>任意</small>
              <textarea
                name="note"
                maxLength={180}
                placeholder="未入力でも募集できます"
              />
            </label>
            <p className="privacyText">
              ポケモンも役割も未定のまま募集できます。期限が来るか満員になると自動で受付を終了します。
            </p>
            <button className="primaryButton" disabled={sending}>
              {sending ? "公開中…" : "募集を公開する"}
            </button>
          </form>
        </div>
      )}

      {recruitNotifyPrompt && (
        <div className="modalBackdrop">
          <section className="recruitNotifyCard" role="dialog" aria-modal="true" aria-labelledby="recruit-notify-title">
            <div className="recruitNotifyIcon"><span className="bellGlyph" aria-hidden="true" /></div>
            <small>募集を公開しました</small>
            <h2 id="recruit-notify-title">参加申請を<br />見逃さないようにしよう</h2>
            <p>通知をオンにすると、サイトを閉じていても申請やマッチ成立がすぐ分かります。</p>
            <button className="pushPromptEnable" onClick={() => finishRecruitNotifyPrompt(true)}>通知をオンにして続ける</button>
            <button className="pushPromptLater" onClick={() => finishRecruitNotifyPrompt(false)}>今はしない</button>
          </section>
        </div>
      )}

      {recruitShare && (
        <div className="modalBackdrop">
          <section className="recruitShareModal">
            <button
              className="closeButton"
              onClick={() => setRecruitShare(null)}
            >
              ×
            </button>
            <small className="modalKicker">SHARE RECRUIT</small>
            <h2>募集を広めよう</h2>
            <div
              className={`recruitSharePreview ${roleTone(recruitShare.role)}`}
            >
              <div className="sharePokemon">
                <PokemonImage name={recruitShare.pokemon} />
              </div>
              <div>
                <small>POKÉMON UNITE</small>
                <strong>
                  {recruitShare.pokemon === "未定"
                    ? "役割から仲間を募集中"
                    : `${recruitShare.pokemon}で募集中`}
                </strong>
                <span>
                  {recruitShare.role !== "指定なし"
                    ? recruitShare.role
                    : recruitShare.rank}
                </span>
                <p>{formatRecruitStart(recruitShare)} ・ {recruitShare.playTime}</p>
              </div>
            </div>
            <div className="socialShareGrid">
              <button
                className="shareX"
                onClick={() => shareRecruitToX(recruitShare)}
              >
                <b>𝕏</b>
                <span>Xに投稿</span>
              </button>
              <button
                className="shareDiscord"
                onClick={() => shareRecruitToDiscord(recruitShare)}
              >
                <b>D</b>
                <span>Discord</span>
              </button>
              <button
                className="shareLine"
                onClick={() => shareRecruitToLine(recruitShare)}
              >
                <b>LINE</b>
                <span>LINE・オプチャ</span>
              </button>
            </div>
            <button
              className="nativeShareButton"
              onClick={() => shareRecruitNatively(recruitShare)}
            >
              共有メニューを開く / リンクをコピー
            </button>
            <p className="shareHelp">
              Discordは募集文をコピーして開きます。LINEでオープンチャットが共有先に出ない場合は、コピーした文を貼り付けてください。
            </p>
          </section>
        </div>
      )}

      {applyTo && (
        <div className="modalBackdrop">
          <form className="sheetModal formSheet" onSubmit={submitApplication}>
            <button
              type="button"
              className="closeButton"
              onClick={() => setApplyTo(null)}
            >
              ×
            </button>
            <div className={`applyPokemon ${roleTone(applyTo.role)}`}>
              <PokemonImage name={applyTo.pokemon} />
            </div>
            <small className="modalKicker">PLAY REQUEST</small>
            <h2>
              {applyTo.trainerName}さんと
              <br />
              一緒に遊ぶ
            </h2>
            <label>
              使用ポケモン
              <select name="pokemon" defaultValue={primaryPokemon}>
                {profile.mainPokemon.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label>
              メッセージ
              <textarea
                name="message"
                maxLength={180}
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                required
              />
            </label>
            <div className="requestMessagePresets" aria-label="定型メッセージ">
              {requestMessagePresets.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => addRequestPreset(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <p className="privacyText">
              申請時に連絡先は送信されません。マッチ後、相手ごとに共有するか選べます。
            </p>
            <button className="primaryButton" disabled={sending}>
              {sending ? "送信中…" : "プレイ申請を送る"}
            </button>
          </form>
        </div>
      )}

      {profileApplyTo && (
        <div className="modalBackdrop">
          <form
            className="sheetModal formSheet"
            onSubmit={submitProfileApplication}
          >
            <button
              type="button"
              className="closeButton"
              onClick={() => setProfileApplyTo(null)}
            >
              ×
            </button>
            <div className="applyPokemon profileMatchArtwork">
              <PokemonImage name={profileApplyTo.mainPokemon[0] || "メイト"} />
            </div>
            <small className="modalKicker">MATE REQUEST</small>
            <h2>
              {profileApplyTo.trainerName}さんに
              <br />
              メイト申請
            </h2>
            <label>
              自分が使うポケモン
              <select name="pokemon" defaultValue={primaryPokemon}>
                {profile.mainPokemon.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label>
              メッセージ
              <textarea
                name="message"
                maxLength={180}
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                required
              />
            </label>
            <div className="requestMessagePresets" aria-label="定型メッセージ">
              {requestMessagePresets.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => addRequestPreset(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <p className="privacyText">
              時間を今決めなくても申請できます。承認後にチャットで相談してください。連絡先はマッチ後に本人が共有した場合だけ表示されます。
            </p>
            <button className="primaryButton" disabled={sending}>
              {sending ? "送信中…" : "メイト申請を送る"}
            </button>
          </form>
        </div>
      )}

      {safetyTarget && (
        <div className="modalBackdrop">
          <form className="sheetModal safetySheet" onSubmit={submitSafety}>
            <button
              type="button"
              className="closeButton"
              onClick={() => setSafetyTarget(null)}
            >
              ×
            </button>
            <small className="modalKicker">SAFETY</small>
            <h2>{safetyTarget.name}さんを報告</h2>
            <p>
              内容は相手に通知されません。危険を感じた場合はブロックも利用してください。
            </p>
            <label>
              通報理由
              <select name="reason" required defaultValue="">
                <option value="" disabled>
                  選択してください
                </option>
                <option>出会い目的</option>
                <option>迷惑行為</option>
                <option>暴言・嫌がらせ</option>
                <option>なりすまし</option>
                <option>不正なプロフィール</option>
                <option>不適切なプロフィール画像</option>
                <option>その他</option>
              </select>
            </label>
            <label>
              詳細
              <textarea
                name="details"
                maxLength={500}
                placeholder="状況をできる範囲で教えてください"
              />
            </label>
            <label className="toggleRow">
              <input type="checkbox" name="alsoBlock" />
              <span>通報と同時にブロックする</span>
            </label>
            <button className="dangerButton">この内容で通報</button>
            <button type="button" className="blockButton" onClick={blockTarget}>
              通報せずブロックのみ
            </button>
          </form>
        </div>
      )}

      {chatActionsOpen && selectedConnection && (
        <div className="modalBackdrop">
          <button
            className="backdropDismiss"
            onClick={() => setChatActionsOpen(false)}
            aria-label="チャットメニューを閉じる"
          />
          <section className="sheetModal chatActionsSheet">
            <button
              type="button"
              className="closeButton"
              onClick={() => setChatActionsOpen(false)}
              aria-label="チャットメニューを閉じる"
            >
              ×
            </button>
            <small className="modalKicker">CHAT MENU</small>
            <h2>{selectedConnection.mateName}さんとのメニュー</h2>
            <div className="chatActionGrid">
              <button
                className={selectedConnection.playedByMe ? "active played" : ""}
                onClick={() => markPlayed(selectedConnection)}
                disabled={selectedConnection.playedByMe}
              >
                <b>✓</b>
                {selectedConnection.playedByMe ? "プレイ済み" : "一緒に遊んだ"}
              </button>
              {selectedConnection.playedByMe && (
                <button
                  className="rating"
                  onClick={() => {
                    setChatActionsOpen(false);
                    openMateRating(selectedConnection);
                  }}
                >
                  <b>☆</b>
                  {selectedConnection.myRatingScore ? "評価を編集" : "この人を評価"}
                </button>
              )}
              <button
                className={selectedConnection.againByMe ? "active again" : ""}
                onClick={() => toggleAgain(selectedConnection)}
              >
                <b>♡</b>
                {selectedConnection.againByMe ? "送信済み" : "また遊びたい"}
              </button>
              <button onClick={() => rematch(selectedConnection)}>
                <b>↻</b>
                再マッチ
              </button>
              <button
                onClick={() => createPrivateVoiceRoom(selectedConnection.id)}
                disabled={voiceRoomLoading}
              >
                <b>🎧</b>
                {voiceRoom?.connectionId === selectedConnection.id
                  ? `${voiceRoom.roomName}を開く`
                  : voiceRoomLoading
                    ? "VCを準備中"
                    : "二人だけのVCを作る"}
              </button>
              {voiceRoom?.connectionId === selectedConnection.id && (
                <button
                  className="voiceRoomCloseAction"
                  onClick={() => closePrivateVoiceRoom(selectedConnection.id)}
                  disabled={voiceRoomLoading}
                >
                  <b>×</b>
                  {voiceRoom.roomName}を閉じる
                </button>
              )}
              <button
                onClick={() => shareMatchToX(selectedConnection.matePokemon)}
              >
                <b>𝕏</b>
                マッチをシェア
              </button>
            </div>
            <div className="chatContactMenu">
              <div>
                <strong>
                  {selectedConnection.myContactShared
                    ? "あなたの連絡先を共有中"
                    : "あなたの連絡先は非公開"}
                </strong>
                <small>
                  {selectedConnection.mateContact
                    ? `相手の連絡先：${selectedConnection.mateContact}`
                    : "相手の連絡先はまだ共有されていません"}
                </small>
              </div>
              <button
                onClick={() => toggleContactSharing(selectedConnection.id)}
              >
                {selectedConnection.myContactShared ? "共有をやめる" : "連絡先を共有"}
              </button>
              {selectedConnection.mateContact && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(selectedConnection.mateContact || "");
                    notify("相手の連絡先をコピーしました");
                  }}
                >
                  コピー
                </button>
              )}
            </div>
            <button
              className="chatReportButton"
              onClick={() => {
                setChatActionsOpen(false);
                setSafetyTarget({
                  name: selectedConnection.mateName,
                  connectionId: selectedConnection.id,
                });
              }}
            >
              通報・ブロック
            </button>
          </section>
        </div>
      )}

      {shareOpen && (
        <div className="modalBackdrop">
          <section className="shareModal">
            <button className="closeButton" onClick={() => setShareOpen(false)}>
              ×
            </button>
            <small className="modalKicker">SHARE YOUR CARD</small>
            <h2>トレーナーカード</h2>
            <div className="trainerShareCard">
              <header className="shareCardTop">
                <div>
                  <strong>YUNAMATCH</strong>
                  <small>MY TRAINER CARD</small>
                </div>
                <UserAvatar
                  name={profile.trainerName}
                  src={profile.avatarUrl}
                  className="shareTrainerAvatar"
                />
              </header>
              <div className="shareCardIdentity">
                <h3>{profile.trainerName}</h3>
                <p>{profile.highestRate}</p>
              </div>
              <div className="shareCardMain">
                <span>MAIN POKÉMON</span>
                <strong>{profile.mainPokemon.join("・")}</strong>
              </div>
              <div className="shareCardPokemon">
                <PokemonImage name={primaryPokemon} />
              </div>
              <footer className="shareCardTime">
                ◷ {profile.playTime.join("・")}
              </footer>
            </div>
            <button className="xShareButton" onClick={shareTrainerCard}>
              𝕏 画像つきで共有する
            </button>
            <p>
              スマホでは共有先にXを選べます。PCでは画像を保存して投稿画面を開きます。
            </p>
          </section>
        </div>
      )}

      {matchResult && (
        <div className="modalBackdrop">
          <section className="matchModal">
            <div className="matchBurst">⚡</div>
            <small>MATCH!</small>
            <h2>マッチ成立！</h2>
            <strong className="matchMateName">
              {matchResult.mateName}さんとマッチしました
            </strong>
            <p>
              チャットが開通しました。この相手に連絡先を共有するか選べます。
            </p>
            {matchResult.mateContact ? (
              <div className="contactBox">{matchResult.mateContact}</div>
            ) : (
              <div className="contactPrivateBox">
                相手の連絡先はまだ共有されていません
              </div>
            )}
            <button
              className="matchShareButton"
              onClick={() => shareMatchToX(matchResult.matePokemon)}
            >
              𝕏 このマッチをシェア
            </button>
            <button
              className="primaryButton"
              onClick={async () => {
                if (await toggleContactSharing(matchResult.connectionId)) {
                  setMatchResult(null);
                  setTab("chat");
                  await loadConnections();
                }
              }}
            >
              自分の連絡先を共有してチャットへ
            </button>
            <button
              className="discordMatchButton"
              onClick={() => createPrivateVoiceRoom(matchResult.connectionId)}
              disabled={voiceRoomLoading}
            >
              🎧 {voiceRoomLoading ? "VCを準備中…" : "二人だけのDiscord VCを作る"}
            </button>
            <button
              className="textButton"
              onClick={() => {
                setMatchResult(null);
                setTab("chat");
              }}
            >
              共有せずチャットへ
            </button>
          </section>
        </div>
      )}
      {supportOpen && (
        <div className="modalBackdrop">
          <form className="sheetModal formSheet" onSubmit={submitSupport}>
            <button
              type="button"
              className="closeButton"
              onClick={() => setSupportOpen(false)}
            >
              ×
            </button>
            <small className="modalKicker">
              {supportMode === "feedback" ? "FEEDBACK" : "SUPPORT"}
            </small>
            <h2>
              {supportMode === "feedback"
                ? "フィードバックを送る"
                : "運営へお問い合わせ"}
            </h2>
            <p className="supportSla">
              {supportMode === "feedback"
                ? "YUNAMATCHをもっと使いやすくするための意見を送れます。送信先のメールアドレスは表示されません。"
                : "不具合・安全上の問題・アカウントの相談を送れます。原則24時間以内に運営が確認します。"}
            </p>
            <label>
              {supportMode === "feedback" ? "フィードバックの種類" : "お問い合わせの種類"}
              {supportMode === "feedback" ? (
                <select name="category" defaultValue="フィードバック・改善案">
                  <option>フィードバック・改善案</option>
                  <option>フィードバック・使いにくい</option>
                  <option>フィードバック・良かった</option>
                  <option>フィードバック・その他</option>
                </select>
              ) : (
                <select name="category" defaultValue="不具合">
                  <option>アカウント・ログイン</option>
                  <option>募集・マッチ</option>
                  <option>安全・通報</option>
                  <option>不具合</option>
                  <option>その他</option>
                </select>
              )}
            </label>
            <label>
              内容
              <textarea
                name="message"
                minLength={5}
                maxLength={1000}
                placeholder={supportMode === "feedback"
                  ? "こうなったら使いやすい、ここが良かった、など自由に入力してください"
                  : "困っていることをできるだけ具体的に入力してください"}
                required
              />
            </label>
            <button className="primaryButton" disabled={sending}>
              {sending
                ? "送信中…"
                : supportMode === "feedback"
                  ? "フィードバックを送信"
                  : "運営へ送信"}
            </button>
          </form>
        </div>
      )}
      {deletionOpen && (
        <div className="modalBackdrop">
          <section className="sheetModal deleteAccountModal">
            <button
              type="button"
              className="closeButton"
              onClick={() => {
                setDeletionOpen(false);
                setDeletionText("");
              }}
            >
              ×
            </button>
            <small className="modalKicker">DELETE ACCOUNT</small>
            <h2>アカウントを削除</h2>
            <p>
              プロフィール、いいね、募集、申請、マッチ、チャット、通報、連携情報とプロフィール画像を削除します。この操作は取り消せません。
            </p>
            <label>
              確認のため「退会する」と入力
              <input
                value={deletionText}
                onChange={(event) => setDeletionText(event.target.value)}
                autoComplete="off"
              />
            </label>
            <button
              className="dangerButton"
              disabled={deletionText !== "退会する" || sending}
              onClick={deleteAccount}
            >
              {sending ? "削除しています…" : "完全に削除して退会"}
            </button>
          </section>
        </div>
      )}
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}
