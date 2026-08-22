import Link from "next/link";

export const metadata={title:"Discordコミュニティ｜YUNAMATCH",description:"YUNAMATCHの募集・VCコミュニティへの参加方法"};
const invite="https://discord.gg/sRxr8fD8Z6";

export default function CommunityPage(){return <main className="communityPage"><section><Link href="/">← YUNAMATCH</Link><div className="communityHero"><span>D</span><small>YUNAMATCH COMMUNITY</small><h1>募集からVC合流まで、<br/>Discordでスムーズに。</h1><p>ランク・希望ロール・VC可否を選んで、自分に合う募集だけを見つけられるコミュニティです。</p><a className="communityJoin" href={invite} target="_blank" rel="noreferrer">Discordサーバーに参加</a></div><div className="communitySteps"><article><b>1</b><div><h2>Discordを連携</h2><p>マイページのアカウント連携から、普段使うDiscordを追加します。</p></div></article><article><b>2</b><div><h2>募集を探す・作る</h2><p>募集チャンネルで <code>/募集</code> を入力すると、DiscordとYUNAMATCHへ同時に掲載できます。</p></div></article><article><b>3</b><div><h2>二人だけのVCを作成</h2><p>マッチ後のチャットからVCを作ると、VC1〜VC5の空き部屋が二人だけに表示されます。</p></div></article></div><div className="communityRules"><h2>安心して遊ぶためのルール</h2><ul><li>ゲーム仲間探し以外の出会い・勧誘は禁止</li><li>本名、住所、学校名、電話番号は共有しない</li><li>暴言・嫌がらせを見つけたらアプリ内から通報</li><li>マッチしていない相手をVCへ執拗に誘わない</li></ul></div></section></main>}
