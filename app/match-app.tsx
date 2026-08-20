"use client";

import { FormEvent, PointerEvent, useEffect, useMemo, useState } from "react";

type Recruit = { id:number; trainerName:string; gender:string; pokemon:string; role:string; matches:number; winRate:number; rank:string; playTime:string; note:string };
type Notice = { id:number; applicantName?:string; applicantContact?:string; trainerName?:string; pokemon:string; message?:string; status:string; recruitPokemon?:string; ownerContact?:string|null };
type Profile = { trainerName:string; mainPokemon:string[]; highestRate:string; playTime:string; gender:"男性"|"女性"|""; contact:string };
type Connection = { id:number; mateName:string; matePokemon:string; mateContact:string; myPokemon:string; againByMe:boolean; againByMate:boolean; mutualAgain:boolean; latestMessage:string; latestAt:string };
type ChatMessage = { id:number; body:string; sender:"me"|"mate"; createdAt:string };
type SafetyTarget = { name:string; recruitId?:number; connectionId?:number };
type AppTab = "discover" | "recruit" | "chat" | "profile";

const pokemon = [
  "アブソル","アマージョ","アローラキュウコン","アローラライチュウ","イワパレス","インテレオン","ウーラオス","ウッウ","エースバーン","エーフィ","エンペルト","オーロット","カイリキー","カイリュー","カビゴン","カメックス","ガブリアス","ガラルギャロップ","キュワワー","ギャラドス","ギルガルド","グレイシア","グレンアルマ","ゲッコウガ","ゲンガー","コダック","サーナイト","ザシアン","シャンデラ","ジュナイパー","ジュラルドン","シャワーズ","スイクン","ストライク","ゼラオラ","ソウブレイズ","ゾロアーク","タイレーツ","ダークライ","ダダリン","デカヌチャン","ドードリオ","ドラパルト","ニンフィア","ヌメルゴン","ハッサム","ハピナス","バシャーモ","バリヤード","バンギラス","パーモット","ピカチュウ","ピクシー","ファイアロー","フーパ","フシギバナ","ブラッキー","プクリン","ホウオウ","マスカーニャ","マッシブーン","マフォクシー","マホイップ","マリルリ","マンムー","ミミッキュ","ミュウ","ミュウツーX","ミュウツーY","ミライドン","メタグロス","ヤドラン","ヤミラミ","ヨクバリス","ラティアス","ラティオス","ラプラス","リーフィア","リザードン","ルカリオ","ワタシラガ"
];
const rateOptions=["エキスパート未満","エキスパート","マスター 1200〜1399","マスター 1400〜1599","マスター 1600〜1799","マスター 1800〜1999","マスター 2000〜"];
const playTimeOptions=["平日 朝（6〜12時）","平日 昼（12〜18時）","平日 夜（18〜22時）","平日 深夜（22〜翌2時）","土日 朝・昼","土日 夜・深夜","時間帯はいつでも"];

const previewRecruit: Recruit = { id:-1, trainerName:"momo", gender:"女性", pokemon:"ハピナス", role:"サポート型", matches:1842, winRate:58.7, rank:"マスター 1600〜", playTime:"平日 夜（18〜22時）", note:"中央キャリーを支えるのが好きです。楽しく連携しながら勝ちたい！" };
const roleClass: Record<string,string> = { "アタック型":"attack", "バランス型":"balance", "スピード型":"speed", "ディフェンス型":"defense", "サポート型":"support" };
const strongPairs: Record<string,{score:number;copy:string}> = {
  "ゲッコウガ|ハピナス":{score:96,copy:"中央キャリーを回復と強化で支える王道コンビ"},
  "カビゴン|ピカチュウ":{score:93,copy:"足止めから高火力を重ねやすい前後衛コンビ"},
  "キュワワー|ゾロアーク":{score:94,copy:"高機動アタッカーの継戦力を大きく伸ばせます"},
  "ブラッキー|ミュウツーY":{score:92,copy:"前線を作りながら後衛の火力を通しやすい構成"},
};

function getSynergy(own:string,mate:string,role:string){
  const known=strongPairs[[own,mate].sort((a,b)=>a.localeCompare(b,"ja")).join("|")];
  if(known)return known;
  if(role==="サポート型")return{score:91,copy:"サポートと連携して主力の動きを通しやすい組み合わせ"};
  if(role==="ディフェンス型")return{score:88,copy:"前線を任せて安全にダメージを出しやすい組み合わせ"};
  return{score:84,copy:"得意な時間帯を合わせると力を発揮しやすい組み合わせ"};
}

function PokemonPicker({selected,onChange}:{selected:string[];onChange:(names:string[])=>void}){
  const [query,setQuery]=useState("");
  const choices=pokemon.filter(name=>name.includes(query));
  const toggle=(name:string)=>{
    if(selected.includes(name)){onChange(selected.filter(value=>value!==name));return}
    if(selected.length<5)onChange([...selected,name]);
  };
  return <div className="pokemonPicker"><div className="pickerHeading"><span>メインポケモン</span><small>1〜5体・複数選択できます</small></div><div className="selectedPokemon">{selected.length?selected.map(name=><button type="button" key={name} onClick={()=>toggle(name)}>{name}<span>×</span></button>):<p>ポケモンを選んでください</p>}</div><input className="pokemonSearch" value={query} onChange={event=>setQuery(event.target.value)} placeholder="ポケモン名で検索" aria-label="ポケモン名で検索"/><div className="pokemonChoices">{choices.map(name=><button type="button" key={name} className={selected.includes(name)?"selected":""} aria-pressed={selected.includes(name)} onClick={()=>toggle(name)}>{name}</button>)}</div></div>;
}

export default function MatchApp({displayName,authProvider,authContact,preview=false}:{displayName:string;authProvider:string;authContact:string;preview?:boolean}){
  const shortName=displayName.includes("@")?displayName.split("@")[0]:displayName;
  const providerName=authProvider==="twitter"?"X":authProvider==="discord"?"Discord":authProvider==="line"?"LINE":authProvider==="google"?"Google":"ログインアカウント";
  const [tab,setTab]=useState<AppTab>("discover");
  const [recruits,setRecruits]=useState<Recruit[]>([]);
  const [loading,setLoading]=useState(true);
  const [index,setIndex]=useState(0);
  const [animation,setAnimation]=useState<""|"left"|"right">("");
  const [dragStart,setDragStart]=useState<number|null>(null);
  const [filterOpen,setFilterOpen]=useState(false);
  const [wanted,setWanted]=useState("すべて");
  const [minRate,setMinRate]=useState(0);
  const [minMatches,setMinMatches]=useState(0);
  const [womenOnly,setWomenOnly]=useState(false);
  const [compose,setCompose]=useState(false);
  const [applyTo,setApplyTo]=useState<Recruit|null>(null);
  const [sending,setSending]=useState(false);
  const [toast,setToast]=useState("");
  const [incoming,setIncoming]=useState<Notice[]>([]);
  const [outgoing,setOutgoing]=useState<Notice[]>([]);
  const [connections,setConnections]=useState<Connection[]>([]);
  const [selectedConnection,setSelectedConnection]=useState<Connection|null>(null);
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [messageText,setMessageText]=useState("");
  const [notificationOpen,setNotificationOpen]=useState(false);
  const [shareOpen,setShareOpen]=useState(false);
  const [safetyTarget,setSafetyTarget]=useState<SafetyTarget|null>(null);
  const [matchedContact,setMatchedContact]=useState<string|null>(null);
  const [profile,setProfile]=useState<Profile>({trainerName:shortName,mainPokemon:[],highestRate:"マスター 1400〜1599",playTime:"平日 夜（18〜22時）",gender:"",contact:`${providerName}: ${authContact}`});
  const [profileReady,setProfileReady]=useState(preview);
  const [onboardingOpen,setOnboardingOpen]=useState(preview);
  const primaryPokemon=profile.mainPokemon[0]||"ゲッコウガ";

  const notify=(message:string)=>{setToast(message);window.setTimeout(()=>setToast(""),2600)};

  const loadRecruits=async()=>{
    try{const response=await fetch("/api/recruits");const data=await response.json();setRecruits(data.recruits||[])}
    catch{notify("募集を読み込めませんでした")}finally{setLoading(false)}
  };
  const loadNotices=async()=>{
    try{const response=await fetch("/api/applications");if(!response.ok)return;const data=await response.json();setIncoming(data.incoming||[]);setOutgoing(data.outgoing||[])}catch{/* カード表示は続ける */}
  };
  const loadConnections=async()=>{
    try{const response=await fetch("/api/connections");if(!response.ok)return;const data=await response.json();setConnections(data.connections||[])}catch{/* 検索は続ける */}
  };
  const loadMessages=async(connection:Connection)=>{
    const response=await fetch(`/api/messages?connectionId=${connection.id}`);if(!response.ok)return;const data=await response.json();setMessages(data.messages||[]);
  };

  useEffect(()=>{
    let active=true;
    Promise.all([
      fetch("/api/recruits").then(r=>r.json()),
      fetch("/api/applications").then(r=>r.ok?r.json():null),
      fetch("/api/connections").then(r=>r.ok?r.json():null),
    ]).then(([recruitData,noticeData,connectionData])=>{
      if(!active)return;
      setRecruits(recruitData.recruits||[]);
      if(noticeData){setIncoming(noticeData.incoming||[]);setOutgoing(noticeData.outgoing||[])}
      if(connectionData)setConnections(connectionData.connections||[]);
    }).catch(()=>undefined).finally(()=>{if(active)setLoading(false)});
    if(preview)return()=>{active=false};
    fetch("/api/profile").then(async response=>({response,data:await response.json()})).then(({response,data})=>{
      if(!active)return;
      if(response.status===401){location.href=data.signIn||"/login";return}
      if(data.profile){setProfile(data.profile);setOnboardingOpen(false)}
      else{setProfile(value=>({...value,trainerName:data.suggested?.trainerName||value.trainerName,contact:data.suggested?.contact||value.contact}));setOnboardingOpen(true)}
    }).catch(()=>{if(active)notify("プロフィールを確認できませんでした")}).finally(()=>{if(active)setProfileReady(true)});
    return()=>{active=false};
  },[preview]);

  const visibleRecruits=useMemo(()=>recruits.length===0&&preview?[previewRecruit]:recruits,[recruits,preview]);
  const cards=useMemo(()=>{
    return visibleRecruits.filter(person=>(wanted==="すべて"||person.pokemon===wanted)&&person.winRate>=minRate&&person.matches>=minMatches&&(!womenOnly||person.gender==="女性"));
  },[visibleRecruits,wanted,minRate,minMatches,womenOnly]);
  const current=cards.length?cards[index%cards.length]:null;
  const synergy=current?getSynergy(primaryPokemon,current.pokemon,current.role):null;
  const pendingCount=incoming.filter(n=>n.status==="pending").length;
  const heartCount=connections.filter(c=>c.againByMate&&!c.againByMe).length;
  const notificationCount=pendingCount+heartCount;

  const moveNext=(direction:"left"|"right")=>{
    if(!current||animation)return;
    if(direction==="right"){
      if(current.id===-1){notify("公開版では実際の募集にプレイ申請できます");return}
      setApplyTo(current);return;
    }
    setAnimation(direction);window.setTimeout(()=>{setIndex(v=>v+1);setAnimation("")},260);
  };
  const handlePointerUp=(event:PointerEvent<HTMLElement>)=>{if(dragStart===null)return;const distance=event.clientX-dragStart;setDragStart(null);if(Math.abs(distance)>=65)moveNext(distance>0?"right":"left")};

  const submitApplication=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!applyTo)return;setSending(true);
    const body=Object.fromEntries(new FormData(event.currentTarget));
    const response=await fetch("/api/applications",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,recruitId:applyTo.id})});
    const data=await response.json();setSending(false);
    if(response.status===401){location.href=data.signIn;return}if(!response.ok){notify(data.error||"申請できませんでした");return}
    setApplyTo(null);notify("プレイ申請を送りました");setIndex(v=>v+1);loadNotices();
  };
  const submitRecruit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setSending(true);const body=Object.fromEntries(new FormData(event.currentTarget));
    const response=await fetch("/api/recruits",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const data=await response.json();setSending(false);
    if(response.status===401){location.href=data.signIn;return}if(!response.ok){notify(data.error||"募集を投稿できませんでした");return}
    setCompose(false);notify("募集を公開しました");await loadRecruits();setTab("discover");
  };
  const decide=async(applicationId:number,action:"accept"|"decline")=>{
    const response=await fetch("/api/applications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({applicationId,action})});const data=await response.json();
    if(!response.ok){notify(data.error||"処理できませんでした");return}if(action==="accept")setMatchedContact(data.applicantContact);
    notify(action==="accept"?"マッチ成立！チャットが開通しました":"今回は見送りました");await Promise.all([loadNotices(),loadConnections(),loadRecruits()]);
  };
  const openChat=async(connection:Connection)=>{setSelectedConnection(connection);setTab("chat");setNotificationOpen(false);await loadMessages(connection)};
  const sendMessage=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!selectedConnection||!messageText.trim())return;
    const response=await fetch("/api/messages",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({connectionId:selectedConnection.id,body:messageText})});const data=await response.json();
    if(!response.ok){notify(data.error||"送信できませんでした");return}setMessages(rows=>[...rows,data.message]);setMessageText("");loadConnections();
  };
  const toggleAgain=async(connection:Connection)=>{
    const response=await fetch("/api/connections",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({connectionId:connection.id,action:"again"})});const data=await response.json();
    if(!response.ok){notify(data.error||"操作できませんでした");return}
    setConnections(rows=>rows.map(row=>row.id===connection.id?{...row,...data}:row));
    setSelectedConnection(value=>value?.id===connection.id?{...value,...data}:value);
    notify(data.mutualAgain?"両想いです！再マッチできます":data.againByMe?"また遊びたいを送りました":"取り消しました");
  };
  const rematch=async(connection:Connection)=>{
    const response=await fetch("/api/connections",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({connectionId:connection.id,action:"rematch"})});const data=await response.json();
    if(!response.ok){notify(data.error||"再マッチできませんでした");return}notify("再マッチのお誘いを送りました");await openChat(connection);
  };
  const submitSafety=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!safetyTarget)return;const body=Object.fromEntries(new FormData(event.currentTarget));
    const response=await fetch("/api/safety",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,...safetyTarget,action:"report",alsoBlock:body.alsoBlock==="on"})});const data=await response.json();
    if(!response.ok){notify(data.error||"通報できませんでした");return}setSafetyTarget(null);notify("通報を受け付けました");await Promise.all([loadRecruits(),loadConnections()]);
  };
  const blockTarget=async()=>{
    if(!safetyTarget)return;const response=await fetch("/api/safety",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...safetyTarget,action:"block"})});const data=await response.json();
    if(!response.ok){notify(data.error||"ブロックできませんでした");return}setSafetyTarget(null);setSelectedConnection(null);notify("このユーザーをブロックしました");await Promise.all([loadRecruits(),loadConnections()]);
  };
  const saveProfile=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(!profile.trainerName.trim()||profile.mainPokemon.length===0||!profile.gender){notify("必須項目を入力してください");return}
    if(preview){setOnboardingOpen(false);notify("プロフィールを登録しました");return}
    setSending(true);const response=await fetch("/api/profile",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(profile)});const data=await response.json();setSending(false);
    if(!response.ok){notify(data.error||"プロフィールを保存できませんでした");return}setProfile(data.profile);setOnboardingOpen(false);notify("プロフィールを保存しました");
  };

  const shareTrainerCard=async()=>{
    const canvas=document.createElement("canvas");canvas.width=1200;canvas.height=675;const ctx=canvas.getContext("2d");if(!ctx)return;
    const gradient=ctx.createLinearGradient(0,0,1200,675);gradient.addColorStop(0,"#35216f");gradient.addColorStop(.55,"#6c4df6");gradient.addColorStop(1,"#ff4f91");ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,675);
    ctx.globalAlpha=.14;for(let x=40;x<1200;x+=72)for(let y=35;y<675;y+=72){ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill()}ctx.globalAlpha=1;
    ctx.fillStyle="#fff";ctx.font="900 42px sans-serif";ctx.fillText("YUNAMATCH",70,82);ctx.font="700 20px sans-serif";ctx.fillText("MY TRAINER CARD",72,118);
    ctx.fillStyle="#ffffff22";ctx.beginPath();ctx.roundRect(64,160,1072,430,34);ctx.fill();
    ctx.fillStyle="#fff";ctx.font="900 76px sans-serif";ctx.fillText(profile.trainerName||"TRAINER",110,270);ctx.font="800 30px sans-serif";ctx.fillText(profile.highestRate,112,322);
    ctx.fillStyle="#ffdfeb";ctx.font="900 28px sans-serif";ctx.fillText("MAIN POKÉMON",112,405);ctx.fillStyle="#fff";ctx.font="900 56px sans-serif";ctx.fillText(profile.mainPokemon.join(" / "),110,485);
    ctx.font="700 25px sans-serif";ctx.fillText(profile.playTime,112,545);ctx.textAlign="right";ctx.font="900 172px sans-serif";ctx.fillText(primaryPokemon.slice(0,1),1065,465);ctx.textAlign="left";
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));if(!blob)return;const file=new File([blob],"yunamatch-trainer-card.png",{type:"image/png"});
    const text=`${profile.mainPokemon.join("・")}を使っています！相性のいいメイトを探しています。 #YUNAMATCH`;
    try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:"YUNAMATCH トレーナーカード",text,url:"https://yunamatch.vercel.app/",files:[file]});setShareOpen(false);return}}catch(error){if((error as Error).name==="AbortError")return}
    const download=document.createElement("a");download.href=URL.createObjectURL(blob);download.download=file.name;download.click();window.setTimeout(()=>URL.revokeObjectURL(download.href),1000);
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent("https://yunamatch.vercel.app/")}`,"_blank","noopener,noreferrer");notify("カード画像を保存しました。Xの投稿に添付してください");setShareOpen(false);
  };

  if(!profileReady)return <main className="appStage"><section className="phoneShell profileLoading"><div className="loadingBall"/><h1>プロフィールを準備しています</h1></section></main>;

  return <main className="appStage"><section className="phoneShell">
    <header className="appHeader">
      <button className="miniAvatar" onClick={()=>setTab("profile")} aria-label="マイページを開く">{profile.trainerName.slice(0,1).toUpperCase()}</button>
      <div className="appBrand"><span>Y</span><div><strong>YUNAMATCH</strong><small>PLAY TOGETHER</small></div></div>
      <button className="notificationButton" onClick={()=>setNotificationOpen(true)} aria-label={`通知を開く${notificationCount?`、${notificationCount}件`:""}`}><span aria-hidden="true">🔔</span>{notificationCount>0&&<i>{notificationCount}</i>}</button>
    </header>

    <div className="appViewport">
      {tab==="discover"&&<section className="discoverView instantCards">
        <div className="searchStrip"><div><strong>相性でメイトを探す</strong><small>{cards.length}人が募集中</small></div><button onClick={()=>setFilterOpen(true)}><span>☷</span>{wanted==="すべて"?"条件を絞る":wanted}</button></div>
        {loading?<div className="stateCard"><div className="loadingBall"/><h2>メイトを探しています</h2></div>:current?<>
          <article className={`discoverCard ${animation}`} onPointerDown={event=>setDragStart(event.clientX)} onPointerUp={handlePointerUp}>
            <div className={`cardArtwork ${roleClass[current.role]||"support"}`}>
              <div className="artDots"/><div className="artWatermark">{current.pokemon}</div>
              <div className="cardTopline"><span>● 募集中</span><strong>相性 {synergy?.score}<small>%</small></strong></div>
              {current.id!==-1&&<button className="cardSafetyButton" onClick={()=>setSafetyTarget({name:current.trainerName,recruitId:current.id})} aria-label={`${current.trainerName}さんを通報またはブロック`}>•••</button>}
              <div className="pokemonMonogram"><span>{current.pokemon.slice(0,1)}</span></div><div className="pokemonTitle"><small>{current.role}</small><strong>{current.pokemon}</strong></div>
            </div>
            <div className="cardDetails">
              <div className="identityLine"><div className="mateAvatar">{current.trainerName.slice(0,1).toUpperCase()}</div><div><h1>{current.trainerName}</h1><p className="rankText">{current.rank} ・ {current.gender}</p></div><span>ONLINE</span></div>
              <div className="pairingLine"><span>{primaryPokemon}</span><b>×</b><span>{current.pokemon}</span></div>
              <p className="synergyCopy"><strong>おすすめ理由</strong>{synergy?.copy}</p>
              <div className="statGrid"><div><strong>{current.matches.toLocaleString()}</strong><span>試合数</span></div><div><strong>{current.winRate}<small>%</small></strong><span>勝率</span></div><div><strong>{current.role.replace("型","")}</strong><span>得意ロール</span></div></div>
              <div className="timeChip"><span>◷</span><div><small>PLAY TIME</small><strong>{current.playTime}</strong></div></div><p className="profileNote">“{current.note}”</p>
            </div>
          </article>
          <div className="choiceArea"><button className="passButton" onClick={()=>moveNext("left")}><span>×</span><small>次を見る</small></button><p>左右にスワイプ</p><button className="likeButton" onClick={()=>moveNext("right")}><span>⚡</span><small>一緒に遊ぶ</small></button></div>
        </>:<div className="stateCard emptyState"><div className="emptyOrb">Y</div><h2>新しいメイトを待っています</h2><p>今は条件に合う募集がありません。あなたの募集から始めてみませんか？</p><button onClick={()=>setCompose(true)}>募集を作る</button></div>}
      </section>}

      {tab==="recruit"&&<section className="panelView recruitView"><div className="viewHeading"><div><small>LIVE RECRUITING</small><h1>募集中のメイト</h1></div><button onClick={()=>setCompose(true)}>＋ 募集する</button></div><div className="recruitSummary"><div><strong>{visibleRecruits.length}</strong><span>人が募集中</span></div><p>ポケモン・実力・時間帯を見比べて選べます</p></div><div className="recruitList">{visibleRecruits.length?visibleRecruits.map(recruit=><article key={recruit.id} className="recruitItem"><header className="recruitCardHeader"><div className={`pokemonTile ${roleClass[recruit.role]||"support"}`}>{recruit.pokemon.slice(0,1)}</div><div><div className="recruitTop"><h2>{recruit.trainerName}</h2><span>● 募集中</span></div><strong>{recruit.pokemon}</strong><small>{recruit.role}</small></div></header><div className="recruitBadges"><span>{recruit.rank}</span><span>{recruit.gender}</span></div><p className="recruitNote">“{recruit.note}”</p><div className="recruitFacts"><div><span>◷</span><small>遊べる時間</small><strong>{recruit.playTime}</strong></div><div><small>試合数</small><strong>{recruit.matches.toLocaleString()}戦</strong></div><div><small>勝率</small><strong>{recruit.winRate}%</strong></div></div><button className="recruitApply" onClick={()=>setApplyTo(recruit)}>この人にプレイ申請 <span>›</span></button></article>):<div className="listEmpty">まだ公開中の募集はありません。<br/>あなたの募集から始めてみませんか？</div>}</div></section>}

      {tab==="chat"&&<section className="panelView chatView">{selectedConnection?<>
        <div className="chatHeader"><button onClick={()=>{setSelectedConnection(null);setMessages([])}} aria-label="チャット一覧へ戻る">←</button><div className="chatMateAvatar">{selectedConnection.mateName.slice(0,1)}</div><div><h1>{selectedConnection.mateName}</h1><p>{selectedConnection.matePokemon} ・ マッチ済み</p></div><button className="chatSafety" onClick={()=>setSafetyTarget({name:selectedConnection.mateName,connectionId:selectedConnection.id})}>•••</button></div>
        <div className="reconnectBar"><button className={selectedConnection.againByMe?"active":""} onClick={()=>toggleAgain(selectedConnection)}>♡ {selectedConnection.againByMe?"送信済み":"また遊びたい"}</button><button className="rematchButton" onClick={()=>rematch(selectedConnection)}>↻ 再マッチ</button></div>
        {selectedConnection.againByMate&&<div className="heartNotice">♡ {selectedConnection.mateName}さんも、また遊びたいと思っています</div>}
        <div className="messageThread">{messages.length?messages.map(message=><div key={message.id} className={`messageBubble ${message.sender}`}><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</small></div>):<div className="chatEmpty"><span>👋</span><h2>チャットが開通しました</h2><p>プレイ時間や編成を相談してみよう。</p></div>}</div>
        <form className="messageComposer" onSubmit={sendMessage}><input value={messageText} onChange={event=>setMessageText(event.target.value)} maxLength={300} placeholder="メッセージを入力" aria-label="メッセージ"/><button disabled={!messageText.trim()} aria-label="送信">➤</button></form>
      </>:<><div className="viewHeading"><div><small>YOUR MATES</small><h1>チャット</h1></div></div><p className="viewLead">マッチした相手と次のプレイを相談できます。</p><div className="chatList">{connections.length?connections.map(connection=><button key={connection.id} className="chatListItem" onClick={()=>openChat(connection)}><div className="chatMateAvatar">{connection.mateName.slice(0,1)}</div><div><strong>{connection.mateName}</strong><p>{connection.latestMessage}</p><small>{connection.matePokemon}</small></div>{connection.againByMate&&<span className="heartDot">♡</span>}<b>›</b></button>):<div className="noticeEmpty">マッチすると、ここからチャットできます。<br/>まずはカードからプレイ申請を送りましょう。</div>}</div></>}</section>}

      {tab==="profile"&&<section className="panelView profileView"><div className="profileHero"><div>{profile.trainerName.slice(0,1).toUpperCase()}</div><small>MY PROFILE</small><h1>{profile.trainerName}</h1><p>{profile.mainPokemon.join("・")} ・ {profile.highestRate}</p><button className="shareCardButton" onClick={()=>setShareOpen(true)}>𝕏 トレーナーカードを共有</button></div><form className="profileForm" onSubmit={saveProfile}><label>トレーナー名<input value={profile.trainerName} maxLength={24} onChange={e=>setProfile({...profile,trainerName:e.target.value})} required/></label><PokemonPicker selected={profile.mainPokemon} onChange={mainPokemon=>setProfile({...profile,mainPokemon})}/><label>最高レート<select value={profile.highestRate} onChange={e=>setProfile({...profile,highestRate:e.target.value})}>{rateOptions.map(rate=><option key={rate}>{rate}</option>)}</select></label><label>遊べる時間帯<select value={profile.playTime} onChange={e=>setProfile({...profile,playTime:e.target.value})}>{playTimeOptions.map(time=><option key={time}>{time}</option>)}</select></label><fieldset className="genderChoice"><legend>性別</legend><button type="button" className={profile.gender==="男性"?"selected":""} onClick={()=>setProfile({...profile,gender:"男性"})}>男子</button><button type="button" className={profile.gender==="女性"?"selected":""} onClick={()=>setProfile({...profile,gender:"女性"})}>女子</button></fieldset><label>マッチ後に伝える連絡先<input value={profile.contact} readOnly aria-readonly="true"/></label><p className="privacyText">ログインに使った{providerName}アカウントのIDです。マッチ成立後だけ相手に表示されます。</p><button className="primaryButton" disabled={sending}>{sending?"保存中…":"プロフィールを保存"}</button></form><a className="signOutLink" href="/api/auth/signout?callbackUrl=%2F">ログアウト</a><p className="fanNote">非公式ファンメイドサービスです。ゲーム仲間探し以外の目的での利用は禁止です。</p></section>}
    </div>

    <nav className="bottomNav" aria-label="メインメニュー"><button className={tab==="discover"?"active":""} onClick={()=>setTab("discover")}><span>⌕</span>さがす</button><button className={tab==="recruit"?"active":""} onClick={()=>setTab("recruit")}><span>＋</span>募集</button><button className={tab==="chat"?"active":""} onClick={()=>{setTab("chat");loadConnections()}}><span>▢</span>チャット{heartCount>0&&<i>{heartCount}</i>}</button><button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}><span>○</span>マイページ</button></nav>
  </section>

  {onboardingOpen&&<div className="onboardingBackdrop"><form className="onboardingCard" onSubmit={saveProfile}><div className="onboardingBrand"><span>Y</span><div><strong>YUNAMATCH</strong><small>WELCOME, TRAINER</small></div></div><div className="onboardingProgress"><span>プロフィール登録</span><b>1 / 1</b></div><h1>あなたのことを<br/>教えてください</h1><p className="onboardingLead">相性のいいユナイト仲間を探すための基本情報です。</p><label>トレーナー名<input value={profile.trainerName} maxLength={24} onChange={event=>setProfile({...profile,trainerName:event.target.value})} placeholder="ゲーム内の名前" required/></label><PokemonPicker selected={profile.mainPokemon} onChange={mainPokemon=>setProfile({...profile,mainPokemon})}/><div className="twoFields"><label>最高レート<select value={profile.highestRate} onChange={event=>setProfile({...profile,highestRate:event.target.value})}>{rateOptions.map(rate=><option key={rate}>{rate}</option>)}</select></label><label>遊べる時間帯<select value={profile.playTime} onChange={event=>setProfile({...profile,playTime:event.target.value})}>{playTimeOptions.map(time=><option key={time}>{time}</option>)}</select></label></div><fieldset className="genderChoice"><legend>性別</legend><button type="button" className={profile.gender==="男性"?"selected":""} onClick={()=>setProfile({...profile,gender:"男性"})}>男子</button><button type="button" className={profile.gender==="女性"?"selected":""} onClick={()=>setProfile({...profile,gender:"女性"})}>女子</button></fieldset><label>マッチ後に伝える連絡先<input value={profile.contact} readOnly aria-readonly="true"/></label><p className="contactNote"><span>🔒</span>ログインに使った{providerName}のIDを自動設定しています。マッチ成立後の相手にだけ表示されます。</p><button className="onboardingSubmit" disabled={sending||!profile.trainerName.trim()||profile.mainPokemon.length===0||!profile.gender}>{sending?"登録しています…":"登録してメイトを探す"}</button></form></div>}

  {notificationOpen&&<div className="modalBackdrop"><button className="backdropDismiss" onClick={()=>setNotificationOpen(false)} aria-label="通知を閉じる"/><section className="notificationSheet"><div className="sheetHandle"/><button className="closeButton" onClick={()=>setNotificationOpen(false)}>×</button><small className="modalKicker">NOTIFICATIONS</small><h2>通知</h2><div className="notificationList">
    {heartCount>0&&connections.filter(c=>c.againByMate&&!c.againByMe).map(connection=><button key={`heart-${connection.id}`} className="notificationRow heart" onClick={()=>openChat(connection)}><span>♡</span><div><strong>{connection.mateName}さんからハート</strong><p>「また遊びたい」が届きました</p></div><b>›</b></button>)}
    {incoming.filter(n=>n.status==="pending").map(notice=><article key={`request-${notice.id}`} className="notificationRequest"><div className="notificationRow"><span>⚡</span><div><strong>{notice.applicantName}さんから申請</strong><p>{notice.pokemon}で一緒に遊びたいそうです</p></div></div><div><button onClick={()=>decide(notice.id,"decline")}>見送る</button><button onClick={()=>decide(notice.id,"accept")}>承認する</button></div></article>)}
    {outgoing.filter(n=>n.status==="accepted").map(notice=><button key={`accepted-${notice.id}`} className="notificationRow accepted" onClick={()=>{const connection=connections.find(c=>c.mateName===notice.trainerName);if(connection)openChat(connection)}}><span>✓</span><div><strong>{notice.trainerName}さんとマッチ成立</strong><p>チャットからプレイ時間を相談できます</p></div><b>›</b></button>)}
    {!heartCount&&!pendingCount&&!outgoing.some(n=>n.status==="accepted")&&<div className="noticeEmpty">新しい通知はありません</div>}
  </div></section></div>}

  {filterOpen&&<div className="modalBackdrop"><button className="backdropDismiss" onClick={()=>setFilterOpen(false)} aria-label="絞り込みを閉じる"/><section className="sheetModal"><div className="sheetHandle"/><button className="closeButton" onClick={()=>setFilterOpen(false)}>×</button><small className="modalKicker">SEARCH FILTER</small><h2>希望のメイト</h2><label>使ってほしいポケモン<select value={wanted} onChange={e=>{setWanted(e.target.value);setIndex(0)}}><option>すべて</option>{pokemon.map(name=><option key={name}>{name}</option>)}</select></label><div className="twoFields"><label>最低勝率<select value={minRate} onChange={e=>{setMinRate(Number(e.target.value));setIndex(0)}}><option value="0">指定なし</option><option value="50">50%以上</option><option value="55">55%以上</option><option value="60">60%以上</option></select></label><label>最低試合数<select value={minMatches} onChange={e=>{setMinMatches(Number(e.target.value));setIndex(0)}}><option value="0">指定なし</option><option value="500">500試合〜</option><option value="1000">1,000試合〜</option><option value="1500">1,500試合〜</option></select></label></div><label className="toggleRow"><input type="checkbox" checked={womenOnly} onChange={e=>{setWomenOnly(e.target.checked);setIndex(0)}}/><span>女性プレイヤーのみ</span></label><button className="primaryButton" onClick={()=>setFilterOpen(false)}>この条件で探す</button></section></div>}

  {compose&&<div className="modalBackdrop"><form className="sheetModal formSheet" onSubmit={submitRecruit}><button type="button" className="closeButton" onClick={()=>setCompose(false)}>×</button><small className="modalKicker">CREATE RECRUIT</small><h2>メイトを募集</h2><div className="twoFields"><label>使用ポケモン<select name="pokemon" defaultValue={primaryPokemon}>{profile.mainPokemon.map(name=><option key={name}>{name}</option>)}</select></label><label>型<select name="role"><option>アタック型</option><option>バランス型</option><option>スピード型</option><option>ディフェンス型</option><option>サポート型</option></select></label></div><div className="twoFields"><label>試合数<input name="matches" type="number" min="0" max="99999" defaultValue="1000" required/></label><label>勝率<input name="winRate" type="number" min="0" max="100" step="0.1" defaultValue="50" required/></label></div><label>ひとこと<textarea name="note" maxLength={180} placeholder="楽しくランクを回したいです！" required/></label><p className="privacyText">{profile.trainerName}・{profile.highestRate}・{profile.playTime}で募集します。連絡先は承認した相手にだけ表示されます。</p><button className="primaryButton" disabled={sending}>{sending?"公開中…":"募集を公開する"}</button></form></div>}

  {applyTo&&<div className="modalBackdrop"><form className="sheetModal formSheet" onSubmit={submitApplication}><button type="button" className="closeButton" onClick={()=>setApplyTo(null)}>×</button><div className={`applyPokemon ${roleClass[applyTo.role]||"support"}`}>{applyTo.pokemon.slice(0,1)}</div><small className="modalKicker">PLAY REQUEST</small><h2>{applyTo.trainerName}さんと<br/>一緒に遊ぶ</h2><label>使用ポケモン<select name="pokemon" defaultValue={primaryPokemon}>{profile.mainPokemon.map(name=><option key={name}>{name}</option>)}</select></label><label>メッセージ<textarea name="message" maxLength={180} defaultValue={`${applyTo.pokemon}と一緒にランクへ行きたいです！`} required/></label><p className="privacyText">申請時はトレーナー名だけを送り、連絡先は承認後に表示します。</p><button className="primaryButton" disabled={sending}>{sending?"送信中…":"プレイ申請を送る"}</button></form></div>}

  {safetyTarget&&<div className="modalBackdrop"><form className="sheetModal safetySheet" onSubmit={submitSafety}><button type="button" className="closeButton" onClick={()=>setSafetyTarget(null)}>×</button><small className="modalKicker">SAFETY</small><h2>{safetyTarget.name}さんを報告</h2><p>内容は相手に通知されません。危険を感じた場合はブロックも利用してください。</p><label>通報理由<select name="reason" required defaultValue=""><option value="" disabled>選択してください</option><option>出会い目的</option><option>迷惑行為</option><option>暴言・嫌がらせ</option><option>なりすまし</option><option>不正なプロフィール</option><option>その他</option></select></label><label>詳細<textarea name="details" maxLength={500} placeholder="状況をできる範囲で教えてください"/></label><label className="toggleRow"><input type="checkbox" name="alsoBlock"/><span>通報と同時にブロックする</span></label><button className="dangerButton">この内容で通報</button><button type="button" className="blockButton" onClick={blockTarget}>通報せずブロックのみ</button></form></div>}

  {shareOpen&&<div className="modalBackdrop"><section className="shareModal"><button className="closeButton" onClick={()=>setShareOpen(false)}>×</button><small className="modalKicker">SHARE YOUR CARD</small><h2>トレーナーカード</h2><div className="trainerShareCard"><div className="shareBrand">YUNAMATCH</div><small>MY TRAINER CARD</small><h3>{profile.trainerName}</h3><p>{profile.highestRate}</p><div><span>MAIN</span><strong>{profile.mainPokemon.join("・")}</strong></div><b>{primaryPokemon.slice(0,1)}</b><footer>{profile.playTime}</footer></div><button className="xShareButton" onClick={shareTrainerCard}>𝕏 画像つきで共有する</button><p>スマホでは共有先にXを選べます。PCでは画像を保存して投稿画面を開きます。</p></section></div>}

  {matchedContact&&<div className="modalBackdrop"><section className="matchModal"><div className="matchBurst">⚡</div><small>MATCH!</small><h2>マッチ成立！</h2><p>チャットが開通しました。外部で合流するときだけ連絡先を使えます。</p><div className="contactBox">{matchedContact}</div><button className="primaryButton" onClick={()=>{navigator.clipboard?.writeText(matchedContact);notify("連絡先をコピーしました")}}>連絡先をコピー</button><button className="textButton" onClick={()=>{setMatchedContact(null);setTab("chat")}}>チャットを見る</button></section></div>}
  {toast&&<div className="toast">✓ {toast}</div>}
  </main>;
}
