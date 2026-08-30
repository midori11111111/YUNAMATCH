import type { Metadata } from "next";
import RateCalculator from "./rate-calculator";

export const metadata: Metadata = {
  title: "ユナイト 内部レート推定｜ユナマッチ",
  description:
    "現在のマスターレートと直近の戦績から、ポケモンユナイトの内部レート帯を非公式に推定します。",
};

export default function RatePage() {
  return <RateCalculator />;
}
