// Names only: no official character artwork is redistributed.
// Catalog checked 2026-09-12 against the official character pages and
// https://wikiwiki.jp/identity5ch/サバイバー一覧 / MenuBar.
export const shoenmateCharacterGroups = [
  { label: "サバイバー", names: [
    "幸運児", "医師", "弁護士", "泥棒", "庭師", "マジシャン", "冒険家", "傭兵",
    "空軍", "機械技師", "オフェンス", "心眼", "祭司", "調香師", "カウボーイ",
    "踊り子", "占い師", "納棺師", "探鉱者", "呪術師", "野人", "曲芸師",
    "一等航海士", "バーメイド", "ポストマン", "墓守", "「囚人」", "昆虫学者",
    "画家", "バッツマン", "玩具職人", "患者", "「心理学者」", "小説家", "「少女」",
    "泣きピエロ", "教授", "骨董商", "作曲家", "記者", "航空エンジニア", "応援団",
    "人形師", "火災調査員", "「レディ・ファウロ」", "「騎士」", "気象学者",
    "弓使い", "脱出マスター", "幻灯師", "闘牛士", "マイムアーティスト",
  ] },
  { label: "ハンター", names: [
    "復讐者", "道化師", "断罪狩人", "リッパー", "結魂者", "芸者", "白黒無常",
    "写真家", "狂眼", "黄衣の王", "夢の魔女", "泣き虫", "魔トカゲ", "血の女王",
    "ガードNo.26", "「使徒」", "ヴァイオリニスト", "彫刻師", "「アンデッド」",
    "破輪", "漁師", "蝋人形師", "「悪夢」", "書記官", "隠者", "夜の番人",
    "オペラ歌手", "「フールズ・ゴールド」", "時空の影", "「足萎えの羊」",
    "「フラバルー」", "雑貨商", "「ビリヤードプレイヤー」", "「女王蜂」", "「歯医者」", "「心の獣」",
  ] },
];
export const shoenmateCharacterSet = new Set(shoenmateCharacterGroups.flatMap(group => group.names));
export const shoenmateTiers = [
  "未設定",
  "サバイバー1段",
  "サバイバー2段",
  "サバイバー3段",
  "サバイバー4段",
  "サバイバー5段",
  "サバイバー6段",
  "サバイバー7段",
  "サバイバー最高峰7段",
  "ハンター1段",
  "ハンター2段",
  "ハンター3段",
  "ハンター4段",
  "ハンター5段",
  "ハンター6段",
  "ハンター7段",
  "ハンター最高峰7段",
] as const;
const shoenmateLegacyTierMap: Record<string, string> = {
  "サバイバー6段以上": "サバイバー6段",
  "ハンター6段以上": "ハンター6段",
};
export function normalizeShoenmateTier(tier: string) {
  return shoenmateLegacyTierMap[tier] ?? tier;
}
export function shoenmateTierDatabaseValues(tier: string) {
  const normalized = normalizeShoenmateTier(tier);
  return [
    normalized,
    ...Object.entries(shoenmateLegacyTierMap)
      .filter(([, value]) => value === normalized)
      .map(([legacy]) => legacy),
  ];
}
export function shoenmateUsername(displayName: string, gameIdentity: string) {
  return gameIdentity.trim() || displayName.trim();
}
export const shoenmateSurvivorRoles = ["救助", "牽制", "補助"];
// Retain 解読 and 指定なし so existing profiles remain editable without data loss.
export const shoenmateRoles = ["サバイバー", ...shoenmateSurvivorRoles, "解読", "ハンター", "指定なし"];
export function isSurvivorRole(role: string) {
  return role === "サバイバー" || role === "解読" || shoenmateSurvivorRoles.includes(role);
}
export function shoenmateRoleLabel(role: string) {
  return isSurvivorRole(role) && role !== "サバイバー" ? `サバイバー（${role}）` : role;
}
export function matchesShoenmateRole(roles: string[], role: string) {
  return !role || (role === "サバイバー" ? roles.some(isSurvivorRole) : roles.includes(role));
}
export function toggleShoenmateSide(roles: string[], side: "サバイバー" | "ハンター") {
  const selected = side === "サバイバー" ? roles.some(isSurvivorRole) : roles.includes(side);
  return selected
    ? roles.filter(role => side === "サバイバー" ? !isSurvivorRole(role) : role !== side)
    : [...roles.filter(role => role !== "指定なし"), side];
}
export function toggleShoenmateSurvivorRole(roles: string[], role: string) {
  const next = roles.includes(role) ? roles.filter(value => value !== role) : [...roles, role];
  const withoutGeneric = next.filter(value => value !== "サバイバー" && value !== "指定なし");
  return withoutGeneric.some(isSurvivorRole) ? withoutGeneric : [...withoutGeneric, "サバイバー"];
}
