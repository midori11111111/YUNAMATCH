export const pokemonRoleOptions = [
  { value: "attack", label: "アタック型" },
  { value: "balance", label: "バランス型" },
  { value: "speed", label: "スピード型" },
  { value: "defense", label: "ディフェンス型" },
  { value: "support", label: "サポート型" },
] as const;

export type PokemonRole = (typeof pokemonRoleOptions)[number]["value"];

const pokemonRoles: Record<string, PokemonRole> = {
  ピカチュウ: "attack", リザードン: "balance", カビゴン: "defense",
  イワパレス: "defense", ゲッコウガ: "attack", ルカリオ: "balance",
  フシギバナ: "attack", ファイアロー: "speed", ワタシラガ: "support",
  バリヤード: "support", ゼラオラ: "speed", エースバーン: "attack",
  ゲンガー: "speed", アローラキュウコン: "attack", カイリキー: "balance",
  ウッウ: "attack", プクリン: "support", ヤドラン: "defense",
  アブソル: "speed", ガブリアス: "balance", サーナイト: "attack",
  ハピナス: "support", カメックス: "defense", マンムー: "defense",
  ニンフィア: "attack", ヨクバリス: "defense", ジュナイパー: "attack",
  アマージョ: "balance", カイリュー: "balance", オーロット: "defense",
  ギルガルド: "balance", フーパ: "support", ジュラルドン: "attack",
  マリルリ: "balance", エーフィ: "attack", マフォクシー: "attack",
  グレイシア: "attack", マッシブーン: "balance", バンギラス: "balance",
  ミュウ: "attack", ドードリオ: "speed", ハッサム: "balance",
  ストライク: "speed", ピクシー: "support", ゾロアーク: "speed",
  ヤミラミ: "support", ウーラオス: "balance", ドラパルト: "attack",
  キュワワー: "support", ザシアン: "balance", ヌメルゴン: "defense",
  ラプラス: "defense", シャンデラ: "attack", ブラッキー: "defense",
  リーフィア: "speed", インテレオン: "attack", ミュウツーX: "balance",
  ミュウツーY: "attack", バシャーモ: "balance", ミミッキュ: "balance",
  マスカーニャ: "speed", メタグロス: "balance", ギャラドス: "balance",
  ミライドン: "attack", タイレーツ: "balance", ソウブレイズ: "balance",
  ホウオウ: "defense", グレンアルマ: "attack", ダークライ: "speed",
  コダック: "support", デカヌチャン: "balance", ガラルギャロップ: "speed",
  スイクン: "balance", アローラライチュウ: "attack", マホイップ: "support",
  ラティオス: "attack", ラティアス: "support", パーモット: "balance",
  エンペルト: "balance", メガルカリオ: "balance", メガリザードンX: "balance",
  ダダリン: "balance", シャワーズ: "defense", メガギャラドス: "balance",
  メガリザードンY: "balance", ニャース: "speed", ネギガナイト: "balance",
  サンダー: "attack", ファイヤー: "balance", フリーザー: "defense",
  バクフーン: "attack", オーダイル: "balance", メガニウム: "support",
  ラウドボーン: "attack", ウェーニバル: "balance", イベルタル: "attack",
  パルキア: "balance", レシラム: "attack", ソルガレオ: "balance",
};

export function pokemonRole(name: string): PokemonRole {
  return pokemonRoles[name] || "balance";
}

export function pokemonRoleLabel(name: string) {
  const role = pokemonRole(name);
  return pokemonRoleOptions.find((option) => option.value === role)?.label || "バランス型";
}
