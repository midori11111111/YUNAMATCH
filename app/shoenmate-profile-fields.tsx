"use client";
import { useState } from "react";
import { isSurvivorRole, shoenmateCharacterGroups, shoenmateSurvivorRoles, toggleShoenmateSide, toggleShoenmateSurvivorRole } from "../lib/shoenmate-profile";
import styles from "./service-onboarding.module.css";

export default function ShoenmateProfileFields({ roles, onRolesChange, characters, onCharactersChange }: {
  roles: string[]; onRolesChange: (roles: string[]) => void;
  characters: string[]; onCharactersChange: (characters: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [side, setSide] = useState("サバイバー");
  const survivor = roles.some(isSurvivorRole);
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[ぁ-ゖ]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  const options = shoenmateCharacterGroups.find(group => group.label === side)!.names.filter(name => normalize(name).includes(normalize(query.trim())));
  return <>
    <fieldset className={styles.manorFieldset}>
      <legend>役割（複数可）</legend>
      <div className={styles.choice}>{(["サバイバー", "ハンター"] as const).map(value => {
        const selected = value === "サバイバー" ? survivor : roles.includes(value);
        return <button type="button" key={value} aria-pressed={selected} className={selected ? styles.active : ""} onClick={() => onRolesChange(toggleShoenmateSide(roles, value))}>{value}</button>;
      })}</div>
      {survivor && <div className={styles.survivorOptions}>
        <p>サバイバーで得意な役割（複数可）</p>
        <div className={styles.choice}>{[...shoenmateSurvivorRoles, ...(roles.includes("解読") ? ["解読"] : [])].map(value => <button type="button" key={value} aria-pressed={roles.includes(value)} className={roles.includes(value) ? styles.active : ""} onClick={() => onRolesChange(toggleShoenmateSurvivorRole(roles, value))}>{value}</button>)}</div>
      </div>}
      {roles.includes("指定なし") && <p className={styles.manorHint}>現在は「指定なし」です。役割を選ぶと変更できます。</p>}
    </fieldset>
    <fieldset className={styles.manorFieldset}>
      <legend>よく使うキャラ（任意・最大5体）</legend>
      <div className={styles.choice}>{characters.map(value => <button type="button" key={value} className={styles.active} aria-label={`${value}の選択を解除`} onClick={() => onCharactersChange(characters.filter(item => item !== value))}>{value} ×</button>)}</div>
      <p className={styles.manorHint} aria-live="polite">{characters.length} / 5体 選択中</p>
      <div className={styles.choice} aria-label="キャラの陣営">{shoenmateCharacterGroups.map(group => <button type="button" key={group.label} className={side === group.label ? styles.active : ""} aria-pressed={side === group.label} onClick={() => setSide(group.label)}>{group.label}</button>)}</div>
      <label>キャラ名で探す<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="例：傭兵、占い師" /></label>
      <div className={`${styles.choice} ${styles.characterChoices}`}>
        {options.map(value => <button type="button" key={value} aria-pressed={characters.includes(value)} className={characters.includes(value) ? styles.active : ""} disabled={characters.length >= 5 && !characters.includes(value)} onClick={() => onCharactersChange(characters.includes(value) ? characters.filter(item => item !== value) : [...characters, value])}>{value}</button>)}
        {!options.length && <p className={styles.manorHint}>見つかりませんでした。陣営やキャラ名を確認してください。</p>}
      </div>
    </fieldset>
  </>;
}
