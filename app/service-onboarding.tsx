"use client";
import { FormEvent, useState } from "react";
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
            avatarUrl: initialProfile?.avatarUrl || "",
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
