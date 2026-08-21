const prohibitedPatterns = [
  /セフレ/u,
  /援(?:助)?交際/u,
  /パパ活/u,
  /ママ活/u,
  /ホテル(?:行|い)こ/u,
  /(?:直接|リアルで)?会おう/u,
  /住所(?:を)?教えて/u,
  /学校(?:名)?(?:を)?教えて/u,
  /電話番号(?:を)?教えて/u,
  /死ね/u,
  /殺す/u,
  /消えろ/u,
];

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s\u3000._・ー~〜!！?？,，、]/gu, "");
}

export function containsProhibitedContent(...values: Array<string | null | undefined>) {
  const text = normalize(values.filter(Boolean).join(" "));
  return prohibitedPatterns.some((pattern) => pattern.test(text));
}

export const prohibitedContentMessage = "安全のため、この内容は投稿できません。ゲーム仲間探しに適した表現へ変更してください";
