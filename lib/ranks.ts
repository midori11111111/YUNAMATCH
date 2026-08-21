export const rankOptions = [
  "エキスパート未満",
  "エキスパート",
  "マスター 1200〜1399",
  "マスター 1400〜1599",
  "レジェンド 1000〜1199",
  "レジェンド 1200〜1399",
  "レジェンド 1400〜",
] as const;

const legacyRankMap: Record<string, string> = {
  "マスター 1600〜1799": "レジェンド 1000〜1199",
  "マスター 1800〜1999": "レジェンド 1200〜1399",
  "マスター 2000〜": "レジェンド 1400〜",
  "マスター 1600〜": "レジェンド 1000〜",
};

/**
 * 旧マスター1600をレジェンド1000として、以降は600を引いた表記へ移す。
 */
export function normalizeRank(rank: string) {
  return legacyRankMap[rank] ?? rank;
}

export const rankOptionSet = new Set<string>(rankOptions);
