export type GatewayBrand = {
  service: "yunamatch" | "daigomatch";
  title: string;
  description: string;
  logo: string;
  wordmark: string;
  eyebrow: string;
  heading: string;
  accent: string;
  lead: string;
};

const daigomatchHosts = new Set(["daigomatch.com", "www.daigomatch.com"]);

export function gatewayBrandForHost(rawHost: string | null): GatewayBrand {
  const host = (rawHost ?? "").split(":", 1)[0].toLowerCase();
  if (daigomatchHosts.has(host)) {
    return {
      service: "daigomatch",
      title: "ログイン | 第五マッチ",
      description: "第五マッチへログイン",
      logo: "V",
      wordmark: "第五マッチ",
      eyebrow: "DAIGO MATCH",
      heading: "荘園で遊ぶ仲間と、",
      accent: "ここでつながる。",
      lead: "陣営・得意な役割・遊べる時間から、\n一緒に遊ぶ仲間を見つけよう。",
    };
  }

  return {
    service: "yunamatch",
    title: "ログイン | YUNAMATCH",
    description: "YUNAMATCHへログイン",
    logo: "Y",
    wordmark: "YUNAMATCH",
    eyebrow: "POKÉMON UNITE MATCHING",
    heading: "相性でつながる、",
    accent: "ユナマッチ。",
    lead: "使用ポケモンとプレイスタイルから、\n今夜一緒に戦うメイトを見つけよう。",
  };
}
