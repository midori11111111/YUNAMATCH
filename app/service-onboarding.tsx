"use client";
import { ChangeEvent, FormEvent, useState } from "react";
import styles from "./service-onboarding.module.css";
import ShoenmateProfileFields from "./shoenmate-profile-fields";

type Props = {
  service: string;
  name: string;
  suggestedName?: string;
  identityLabel: string;
  tiers: string[];
  roles: string[];
  selectionLabel?: string;
  selectionPicker?: boolean;
  selectionPlaceholder?: string;
  profileHeading?: string;
  tierLabel?: string;
  timeLabel?: string;
  timeOptions?: string[];
  returnPath: string;
  onComplete: (profile: unknown) => void;
  onCancel?: () => void;
  initialProfile?: {
    displayName?: string;
    gameIdentity?: string;
    skillTier?: string;
    roles?: string[];
    characters?: string[];
    playTimes?: string[];
    age?: number;
    gender?: string;
    showGender?: boolean;
    bio?: string;
    avatarUrl?: string;
    headerUrl?: string;
  } | null;
};
const playTimes = [
  "平日 朝",
  "平日 昼",
  "平日 夜",
  "平日 深夜",
  "土日 朝・昼",
  "土日 夜・深夜",
  "時間帯はいつでも",
];

async function cropImage(file: File, width: number, height: number) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPEG・PNG・WebP画像を選んでください");
  if (file.size > 8 * 1024 * 1024) throw new Error("画像は8MB以下にしてください");
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(), url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("画像を読み込めませんでした")); };
    image.src = url;
  });
  const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
  if (!context) throw new Error("画像を加工できませんでした");
  canvas.width = width;
  canvas.height = height;
  const sourceRatio = source.naturalWidth / source.naturalHeight,
    targetRatio = width / height,
    cropWidth = sourceRatio > targetRatio ? source.naturalHeight * targetRatio : source.naturalWidth,
    cropHeight = sourceRatio > targetRatio ? source.naturalHeight : source.naturalWidth / targetRatio;
  context.fillStyle = "#f4eff0";
  context.fillRect(0, 0, width, height);
  context.drawImage(source, (source.naturalWidth - cropWidth) / 2, (source.naturalHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, width, height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", .82));
  if (!blob) throw new Error("画像を加工できませんでした");
  return blob;
}

export default function ServiceOnboarding({
  service,
  name,
  suggestedName = "",
  identityLabel,
  tiers,
  roles,
  selectionLabel = "得意な役割（複数可）",
  selectionPicker = false,
  selectionPlaceholder = "選択してください",
  profileHeading = "プレイヤー情報を登録",
  tierLabel = "現在のランク",
  timeLabel = "遊べる時間（複数可）",
  timeOptions = playTimes,
  returnPath,
  onComplete,
  onCancel,
  initialProfile,
}: Props) {
  const [displayName, setDisplayName] = useState(
      initialProfile?.displayName || suggestedName,
    ),
    [gameIdentity, setGameIdentity] = useState(
      initialProfile?.gameIdentity ||
        (service === "shoenmate"
          ? initialProfile?.displayName || suggestedName
          : ""),
    ),
    [skillTier, setSkillTier] = useState(
      initialProfile?.skillTier || tiers[0] || "未設定",
    ),
    [selectedRoles, setSelectedRoles] = useState<string[]>(
      (initialProfile?.roles || []).filter((value) => roles.includes(value)),
    ),
    [pendingRole, setPendingRole] = useState(""),
    [characters, setCharacters] = useState<string[]>(initialProfile?.characters || []),
    [selectedTimes, setSelectedTimes] = useState<string[]>(
      initialProfile?.playTimes || [],
    ),
    [ageInput, setAgeInput] = useState(String(initialProfile?.age || 18)),
    [gender, setGender] = useState(initialProfile?.gender || ""),
    [showGender, setShowGender] = useState(
      initialProfile?.showGender || false,
    ),
    [bio, setBio] = useState(initialProfile?.bio || ""),
    [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatarUrl || ""),
    [headerUrl, setHeaderUrl] = useState(initialProfile?.headerUrl || ""),
    [mediaBusy, setMediaBusy] = useState<"avatar" | "header" | "">(""),
    [terms, setTerms] = useState(Boolean(initialProfile)),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const age = Number(ageInput),
    validAge = Number.isInteger(age) && age >= 13 && age <= 99;
  const toggle = (
    list: string[],
    value: string,
    setter: (next: string[]) => void,
  ) =>
    setter(
      list.includes(value) ? list.filter((x) => x !== value) : [...list, value],
    );
  async function selectMedia(event: ChangeEvent<HTMLInputElement>, kind: "avatar" | "header") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMediaBusy(kind);
    setError("");
    try {
      const blob = await cropImage(file, kind === "avatar" ? 512 : 1200, kind === "avatar" ? 512 : 400),
        endpoint = `/api/media/${kind === "avatar" ? "avatar" : "header"}?service=${encodeURIComponent(service)}`,
        response = await fetch(endpoint, { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob }),
        data = await response.json();
      if (!response.ok) throw new Error(data.error || "画像をアップロードできませんでした");
      if (kind === "avatar") setAvatarUrl(data.avatarUrl);
      else setHeaderUrl(data.headerUrl);
    } catch (value) {
      setError(value instanceof Error ? value.message : "画像をアップロードできませんでした");
    } finally {
      setMediaBusy("");
    }
  }
  async function removeMedia(kind: "avatar" | "header") {
    setMediaBusy(kind);
    setError("");
    try {
      const endpoint = `/api/media/${kind === "avatar" ? "avatar" : "header"}?service=${encodeURIComponent(service)}`,
        response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "画像を削除できませんでした");
      }
      if (kind === "avatar") setAvatarUrl("");
      else setHeaderUrl("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "画像を削除できませんでした");
    } finally {
      setMediaBusy("");
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validAge) {
      setError("年齢は13〜99歳で入力してください");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/services/${service}/profile`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            displayName: service === "shoenmate" ? gameIdentity : displayName,
            gameIdentity,
            skillTier,
            roles: selectedRoles,
            ...(service === "shoenmate" ? { characters } : {}),
            playTimes: selectedTimes,
            age,
            gender,
            showGender,
            bio,
            avatarUrl,
            headerUrl,
            termsAccepted: terms,
          }),
        }),
        data = await response.json();
      if (!response.ok) throw new Error(data.error || "登録できませんでした");
      onComplete(data.profile);
    } catch (value) {
      setError(value instanceof Error ? value.message : "登録できませんでした");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className={`${styles.backdrop} ${service === "shoenmate" ? styles.manor : ""}`}>
      <section className={styles.panel}>
        {onCancel && (
          <button type="button" className={styles.cancel} onClick={onCancel}>
            ← サイトを見る
          </button>
        )}
        <small className={styles.brand}>
          {name.toUpperCase()} · FIRST SETUP
        </small>
        <h1>{initialProfile ? "プロフィールを編集" : profileHeading}</h1>
        <p className={styles.lead}>
          {initialProfile
            ? "現在の情報を確認し、変更したい項目だけ編集してください。"
            : "初回だけ入力します。同じSNSアカウントでログインすれば、別の端末でも引き継がれます。"}
        </p>
        <form className={styles.form} onSubmit={submit}>
          <section className={styles.mediaEditor} aria-label="プロフィール画像の設定">
            <div className={styles.headerEditor}>
              <div className={styles.headerPreview} style={headerUrl ? { backgroundImage: `url(${headerUrl})` } : undefined}>
                {!headerUrl && <span>PROFILE HEADER</span>}
              </div>
              <div className={styles.mediaCopy}>
                <strong>ヘッダー画像 <small>任意</small></strong>
                <p>プロフィール上部と探すカードの背景に表示します。</p>
                <span className={styles.mediaActions}>
                  <label className={styles.mediaSelect}>{mediaBusy === "header" ? "処理中…" : "画像を選ぶ"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(mediaBusy)} onChange={event => void selectMedia(event, "header")} /></label>
                  {headerUrl && <button type="button" disabled={Boolean(mediaBusy)} onClick={() => void removeMedia("header")}>削除</button>}
                </span>
              </div>
            </div>
            <div className={styles.avatarEditor}>
              <div className={styles.avatarPreview}>{avatarUrl ? <img src={avatarUrl} alt="現在のプロフィールアイコン" /> : <span>{gameIdentity.slice(0, 1) || "人"}</span>}</div>
              <div className={styles.mediaCopy}>
                <strong>プロフィールアイコン <small>任意</small></strong>
                <p>正方形に切り抜いて表示します。</p>
                <span className={styles.mediaActions}>
                  <label className={styles.mediaSelect}>{mediaBusy === "avatar" ? "処理中…" : "写真を選ぶ"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(mediaBusy)} onChange={event => void selectMedia(event, "avatar")} /></label>
                  {avatarUrl && <button type="button" disabled={Boolean(mediaBusy)} onClick={() => void removeMedia("avatar")}>削除</button>}
                </span>
              </div>
            </div>
            <p className={styles.mediaNotice}>自分が権利を持つ画像を設定してください。</p>
          </section>
          {service !== "shoenmate" && (
            <label>
              表示名
              <input
                value={displayName}
                maxLength={24}
                required
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
          )}
          <label>
            {identityLabel}
            <input
              value={gameIdentity}
              maxLength={service === "shoenmate" ? 24 : 60}
              required
              onChange={(e) => setGameIdentity(e.target.value)}
            />
          </label>
          <label>
            {tierLabel}
            <select
              value={skillTier}
              onChange={(e) => setSkillTier(e.target.value)}
            >
              {tiers.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          {service === "shoenmate" ? (
            <ShoenmateProfileFields roles={selectedRoles} onRolesChange={setSelectedRoles} characters={characters} onCharactersChange={setCharacters} />
          ) : <label>
            {selectionLabel}
            {selectionPicker ? (
              <>
                <span className={styles.optionPicker}>
                  <select
                    value={pendingRole}
                    onChange={(event) => setPendingRole(event.target.value)}
                  >
                    <option value="">{selectionPlaceholder}</option>
                    {roles
                      .filter((value) => !selectedRoles.includes(value))
                      .map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!pendingRole || selectedRoles.length >= 5}
                    onClick={() => {
                      if (!pendingRole || selectedRoles.includes(pendingRole))
                        return;
                      setSelectedRoles((values) => [...values, pendingRole]);
                      setPendingRole("");
                    }}
                  >
                    追加
                  </button>
                </span>
                <span className={styles.selectionCount}>
                  最大5体・現在{selectedRoles.length}体
                </span>
                <span className={styles.choice}>
                  {selectedRoles.map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={styles.active}
                      onClick={() =>
                        setSelectedRoles((values) =>
                          values.filter((item) => item !== value),
                        )
                      }
                    >
                      {value} ×
                    </button>
                  ))}
                </span>
              </>
            ) : (
              <span className={styles.choice}>
                {roles.map((x) => (
                  <button
                    type="button"
                    key={x}
                    className={selectedRoles.includes(x) ? styles.active : ""}
                    onClick={() => toggle(selectedRoles, x, setSelectedRoles)}
                  >
                    {x}
                  </button>
                ))}
              </span>
            )}
          </label>}
          <label>
            {timeLabel}
            <span className={styles.choice}>
              {timeOptions.map((x) => (
                <button
                  type="button"
                  key={x}
                  className={selectedTimes.includes(x) ? styles.active : ""}
                  onClick={() => toggle(selectedTimes, x, setSelectedTimes)}
                >
                  {x}
                </button>
              ))}
            </span>
          </label>
          <label>
            年齢
            <input
              type="number"
              inputMode="numeric"
              min={13}
              max={99}
              step={1}
              required
              value={ageInput}
              onChange={(e) =>
                setAgeInput(e.target.value.replace(/^0+(?=\d)/, ""))
              }
            />
          </label>
          <label>
            性別（任意・18歳以上のみ表示）
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">表示しない</option>
              <option>男性</option>
              <option>女性</option>
              <option>その他</option>
            </select>
          </label>
          {age >= 18 && gender && (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={showGender}
                onChange={(e) => setShowGender(e.target.checked)}
              />
              <span>プロフィールに性別を表示する</span>
            </label>
          )}
          <label>
            自己紹介（任意）
            <textarea
              value={bio}
              maxLength={200}
              onChange={(e) => setBio(e.target.value)}
            />
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
            />
            <span>
              <a
                href={`/legal?service=${service}`}
                target="_blank"
                rel="noreferrer"
              >
                利用条件・安全方針
              </a>
              と
              <a href="/privacy" target="_blank" rel="noreferrer">
                プライバシーポリシー
              </a>
              に同意します
            </span>
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button
            className={styles.submit}
            disabled={
              saving ||
              (service !== "shoenmate" && !displayName) ||
              !gameIdentity ||
              !validAge ||
              !selectedRoles.length ||
              !selectedTimes.length ||
              !terms
            }
          >
            {saving
              ? "保存しています…"
              : initialProfile
                ? "変更内容を保存"
                : "登録して仲間を探す"}
          </button>
          <a
            className={styles.signout}
            href={`/api/auth/signout?callbackUrl=${encodeURIComponent(returnPath)}`}
          >
            別のアカウントでログイン
          </a>
        </form>
      </section>
    </main>
  );
}
