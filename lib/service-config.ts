export const serviceIds=["valomatch","stamate","shoenmate"] as const;
export type ServiceId=(typeof serviceIds)[number];

export const serviceConfig:Record<ServiceId,{name:string;termsVersion:string;roles:Set<string>;modes:Set<string>;tiers:Set<string>}>= {
 valomatch:{name:"バロマッチ",termsVersion:"2026-08-26-v2",roles:new Set(["デュエリスト","イニシエーター","コントローラー","センチネル","指定なし"]),modes:new Set(["コンペティティブ","アンレート","スイフトプレイ","その他"]),tiers:new Set(["アイアン","ブロンズ","シルバー","ゴールド","プラチナ","ダイヤモンド","アセンダント","イモータル","レディアント","未設定"])},
 stamate:{name:"スタメイト",termsVersion:"2026-08-26-v2",roles:new Set(["アタッカー","アサシン","スナイパー","グレネーディア","タンク","サポート","コントローラー","指定なし"]),modes:new Set(["トロフィー","ガチバトル","フリープレイ","マップメーカー","スペシャルイベント","フレンドバトル","その他"]),tiers:new Set(["ブロンズ","シルバー","ゴールド","ダイヤモンド","ミシック","レジェンド","マスター","プロ","未設定"])},
 shoenmate:{name:"荘園メイト",termsVersion:"2026-08-26-v2",roles:new Set(["救助","牽制","補助","解読","ハンター","指定なし"]),modes:new Set(["ランク戦","マルチ戦","協力狩り","カスタム","その他"]),tiers:new Set(["未設定","サバイバー1段","サバイバー2段","サバイバー3段","サバイバー4段","サバイバー5段","サバイバー6段以上","ハンター1段","ハンター2段","ハンター3段","ハンター4段","ハンター5段","ハンター6段以上"])},
};

export function isServiceId(value:string):value is ServiceId{return serviceIds.includes(value as ServiceId)}
export function cleanText(value:unknown,max:number){return typeof value==="string"?value.trim().replace(/\r\n?/g,"\n").replace(/\n{3,}/g,"\n\n").slice(0,max):""}
export function stringList(value:unknown,max:number){return Array.isArray(value)?[...new Set(value.filter((item):item is string=>typeof item==="string").map(item=>item.trim()).filter(Boolean))].slice(0,max):[]}
