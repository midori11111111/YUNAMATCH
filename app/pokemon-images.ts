const pokemonImageSlugs: Record<string, string> = {
  "アブソル":"absol","アマージョ":"tsareena","アローラキュウコン":"alolan-ninetales","アローラライチュウ":"alolan-raichu",
  "イワパレス":"crustle","インテレオン":"inteleon","ウーラオス":"urshifu","ウッウ":"cramorant","エースバーン":"cinderace",
  "エーフィ":"espeon","エンペルト":"empoleon","オーロット":"trevenant","カイリキー":"machamp","カイリュー":"dragonite",
  "カビゴン":"snorlax","カメックス":"blastoise","ガブリアス":"garchomp","ガラルギャロップ":"galarian-rapidash","キュワワー":"comfey",
  "ギャラドス":"gyarados","ギルガルド":"aegislash","グレイシア":"glaceon","グレンアルマ":"armarouge","ゲッコウガ":"greninja",
  "ゲンガー":"gengar","コダック":"psyduck","サーナイト":"gardevoir","ザシアン":"zacian","シャンデラ":"chandelure",
  "ジュナイパー":"decidueye","ジュラルドン":"duraludon","シャワーズ":"vaporeon","スイクン":"suicune","ストライク":"scyther",
  "ゼラオラ":"zeraora","ソウブレイズ":"ceruledge","ゾロアーク":"zoroark","タイレーツ":"falinks","ダークライ":"darkrai",
  "ダダリン":"dhelmise","デカヌチャン":"tinkaton","ドードリオ":"dodrio","ドラパルト":"dragapult","ニンフィア":"sylveon",
  "ヌメルゴン":"goodra","ハッサム":"scizor","ハピナス":"blissey","バシャーモ":"blaziken","バリヤード":"mr-mime",
  "バンギラス":"tyranitar","パーモット":"pawmot","ピカチュウ":"pikachu","ピクシー":"clefable","ファイアロー":"talonflame",
  "フーパ":"hoopa","フシギバナ":"venusaur","ブラッキー":"umbreon","プクリン":"wigglytuff","ホウオウ":"ho-oh",
  "マスカーニャ":"meowscarada","マッシブーン":"buzzwole","マフォクシー":"delphox","マホイップ":"alcremie","マリルリ":"azumarill",
  "マンムー":"mamoswine","ミミッキュ":"mimikyu","ミュウ":"mew","ミュウツーX":"mewtwo-x","ミュウツーY":"mewtwo-y",
  "ミライドン":"miraidon","メタグロス":"metagross","ヤドラン":"slowbro","ヤミラミ":"sableye","ヨクバリス":"greedent",
  "ラティアス":"latias","ラティオス":"latios","ラプラス":"lapras","リーフィア":"leafeon","リザードン":"charizard",
  "ルカリオ":"lucario","ワタシラガ":"eldegoss",
};

export function getPokemonImagePath(name: string) {
  const slug = pokemonImageSlugs[name];
  return slug ? `/pokemon/${slug}.png` : null;
}
