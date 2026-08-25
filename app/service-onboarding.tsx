"use client";
import { FormEvent, useState } from "react";
import styles from "./service-onboarding.module.css";

type Props = {
  service: string;
  name: string;
  suggestedName?: string;
  identityLabel: string;
  tiers: string[];
  roles: string[];
  returnPath: string;
  onComplete: (profile: unknown) => void;
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
  returnPath,
  onComplete,
}: Props) {
  const [displayName, setDisplayName] = useState(suggestedName),
    [gameIdentity, setGameIdentity] = useState(""),
    [skillTier, setSkillTier] = useState(tiers[0] || "未設定"),
    [selectedRoles, setSelectedRoles] = useState<string[]>([]),
    [selectedTimes, setSelectedTimes] = useState<string[]>([]),
    [age, setAge] = useState(18),
    [gender, setGender] = useState(""),
    [showGender, setShowGender] = useState(false),
    [bio, setBio] = useState(""),
    [terms, setTerms] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
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
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/services/${service}/profile`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            displayName,
            gameIdentity,
            skillTier,
            roles: selectedRoles,
            playTimes: selectedTimes,
            age,
            gender,
            showGender,
            bio,
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
    <main className={styles.backdrop}>
      <section className={styles.panel}>
        <small className={styles.brand}>
          {name.toUpperCase()} · FIRST SETUP
        </small>
        <h1>プレイヤー情報を登録</h1>
        <p className={styles.lead}>
          初回だけ入力します。同じSNSアカウントでログインすれば、別の端末でも引き継がれます。
        </p>
        <form className={styles.form} onSubmit={submit}>
          <label>
            表示名
            <input
              value={displayName}
              maxLength={24}
              required
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label>
            {identityLabel}
            <input
              value={gameIdentity}
              maxLength={60}
              required
              onChange={(e) => setGameIdentity(e.target.value)}
            />
          </label>
          <label>
            現在のランク
            <select
              value={skillTier}
              onChange={(e) => setSkillTier(e.target.value)}
            >
              {tiers.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            得意な役割（複数可）
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
          </label>
          <label>
            遊べる時間（複数可）
            <span className={styles.choice}>
              {playTimes.map((x) => (
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
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
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
              !displayName ||
              !gameIdentity ||
              !selectedRoles.length ||
              !selectedTimes.length ||
              !terms
            }
          >
            {saving ? "登録しています…" : "登録して仲間を探す"}
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
