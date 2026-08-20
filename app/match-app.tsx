"use client";

import { FormEvent, PointerEvent, useEffect, useMemo, useState } from "react";

type Recruit = {
  id: number;
  trainerName: string;
  gender: string;
  pokemon: string;
  role: string;
  matches: number;
  winRate: number;
  rank: string;
  playTime: string;
  note: string;
};

type Notice = {
  id: number;
  applicantName?: string;
  applicantContact?: string;
  trainerName?: string;
  pokemon: string;
  message?: string;
  status: string;
  recruitPokemon?: string;
  ownerContact?: string | null;
};

type Profile = {
  trainerName: string;
  pokemon: string;
  rank: string;
  playTime: string;
  gender: string;
  contact: string;
};

type AppTab = "discover" | "recruit" | "matches" | "profile";

const pokemon = [
  "アブソル","アマージョ","アローラキュウコン","アローラライチュウ","イワパレス","インテレオン","ウーラオス","ウッウ","エースバーン","エーフィ","エンペルト","オーロット","カイリキー","カイリュー","カビゴン","カメックス","ガブリアス","ガラルギャロップ","キュワワー","ギャラドス","ギルガルド","グレイシア","グレンアルマ","ゲッコウガ","ゲンガー","コダック","サーナイト","ザシアン","シャンデラ","ジュナイパー","ジュラルドン","シャワーズ","スイクン","ストライク","ゼラオラ","ソウブレイズ","ゾロアーク","タイレーツ","ダークライ","ダダリン","デカヌチャン","ドードリオ","ドラパルト","ニンフィア","ヌメルゴン","ハッサム","ハピナス","バシャーモ","バリヤード","バンギラス","パーモット","ピカチュウ","ピクシー","ファイアロー","フーパ","フシギバナ","ブラッキー","プクリン","ホウオウ","マスカーニャ","マッシブーン","マフォクシー","マホイップ","マリルリ","マンムー","ミミッキュ","ミュウ","ミュウツーX","ミュウツーY","ミライドン","メタグロス","ヤドラン","ヤミラミ","ヨクバリス","ラティアス","ラティオス","ラプラス","リーフィア","リザードン","ルカリオ","ワタシラガ"
];

const previewRecruit: Recruit = {
  id: -1,
  trainerName: "momo",
  gender: "女性",
  pokemon: "ハピナス",
  role: "サポート型",
  matches: 1842,
  winRate: 58.7,
  rank: "マスター 1600〜",
  playTime: "平日 夜（18〜22時）",
  note: "中央キャリーを支えるのが好きです。楽しく連携しながら勝ちたい！",
};

const roleClass: Record<string, string> = {
  "アタック型": "attack",
  "バランス型": "balance",
  "スピード型": "speed",
  "ディフェンス型": "defense",
  "サポート型": "support",
};

export default function MatchApp({
  displayName,
  preview = false,
}: {
  displayName: string;
  preview?: boolean;
}) {
  const shortName = displayName.includes("@") ? displayName.split("@")[0] : displayName;
  const [tab, setTab] = useState<AppTab>("discover");
  const [feed, setFeed] = useState<"recommend" | "incoming">("recommend");
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [animation, setAnimation] = useState<"" | "left" | "right">("");
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [wanted, setWanted] = useState("すべて");
  const [minRate, setMinRate] = useState(0);
  const [minMatches, setMinMatches] = useState(0);
  const [womenOnly, setWomenOnly] = useState(false);
  const [compose, setCompose] = useState(false);
  const [applyTo, setApplyTo] = useState<Recruit | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const [incoming, setIncoming] = useState<Notice[]>([]);
  const [outgoing, setOutgoing] = useState<Notice[]>([]);
  const [matchedContact, setMatchedContact] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({
    trainerName: shortName,
    pokemon: "ゲッコウガ",
    rank: "マスター 1400〜1599",
    playTime: "平日 夜（18〜22時）",
    gender: "回答しない",
    contact: "",
  });

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const loadRecruits = async () => {
    try {
      const response = await fetch("/api/recruits");
      const data = await response.json();
      setRecruits(data.recruits || []);
    } catch {
      notify("募集を読み込めませんでした");
    } finally {
      setLoading(false);
    }
  };

  const loadNotices = async () => {
    try {
      const response = await fetch("/api/applications");
      if (!response.ok) return;
      const data = await response.json();
      setIncoming(data.incoming || []);
      setOutgoing(data.outgoing || []);
    } catch {
      // 通知が取得できなくても、メイト探しは続けられる。
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/recruits")
      .then((response) => response.json())
      .then((data) => { if (active) setRecruits(data.recruits || []); })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });
    fetch("/api/applications")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (active && data) { setIncoming(data.incoming || []); setOutgoing(data.outgoing || []); } })
      .catch(() => undefined);
    const stored = window.localStorage.getItem("yunamatch-profile");
    if (stored) {
      try {
        const savedProfile = JSON.parse(stored);
        window.setTimeout(() => { if (active) setProfile(savedProfile); }, 0);
      } catch { /* 古い端末データは無視 */ }
    }
    return () => { active = false; };
  }, []);

  const cards = useMemo(() => {
    const source = recruits.length === 0 && preview ? [previewRecruit] : recruits;
    return source.filter((person) =>
      (wanted === "すべて" || person.pokemon === wanted) &&
      person.winRate >= minRate &&
      person.matches >= minMatches &&
      (!womenOnly || person.gender === "女性")
    );
  }, [recruits, preview, wanted, minRate, minMatches, womenOnly]);

  const current = cards.length ? cards[index % cards.length] : null;
  const pendingCount = incoming.filter((notice) => notice.status === "pending").length;

  const moveNext = (direction: "left" | "right") => {
    if (!current || animation) return;
    if (direction === "right") {
      if (current.id === -1) {
        notify("公開版では実際の募集にプレイ申請できます");
      } else {
        setApplyTo(current);
        return;
      }
    }
    setAnimation(direction);
    window.setTimeout(() => {
      setIndex((value) => value + 1);
      setAnimation("");
    }, 260);
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (dragStart === null) return;
    const distance = event.clientX - dragStart;
    setDragStart(null);
    if (Math.abs(distance) < 65) return;
    moveNext(distance > 0 ? "right" : "left");
  };

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!applyTo) return;
    setSending(true);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, recruitId: applyTo.id }),
    });
    const data = await response.json();
    setSending(false);
    if (response.status === 401) { location.href = data.signIn; return; }
    if (!response.ok) { notify(data.error || "申請できませんでした"); return; }
    setApplyTo(null);
    notify("プレイ申請を送りました");
    setIndex((value) => value + 1);
    loadNotices();
  };

  const submitRecruit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/recruits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    setSending(false);
    if (response.status === 401) { location.href = data.signIn; return; }
    if (!response.ok) { notify(data.error || "募集を投稿できませんでした"); return; }
    setCompose(false);
    notify("募集を公開しました");
    loadRecruits();
    setTab("recruit");
  };

  const decide = async (applicationId: number, action: "accept" | "decline") => {
    const response = await fetch("/api/applications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId, action }),
    });
    const data = await response.json();
    if (!response.ok) { notify(data.error || "処理できませんでした"); return; }
    if (action === "accept") setMatchedContact(data.applicantContact);
    notify(action === "accept" ? "マッチ成立！" : "今回は見送りました");
    loadNotices();
    loadRecruits();
  };

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.localStorage.setItem("yunamatch-profile", JSON.stringify(profile));
    notify("プロフィールを保存しました");
  };

  const switchTab = (next: AppTab) => {
    setTab(next);
    if (next === "matches") loadNotices();
  };

  return (
    <main className="appStage">
      <section className="phoneShell">
        <header className="appHeader">
          <button className="miniAvatar" onClick={() => switchTab("profile")} aria-label="マイページを開く">{profile.trainerName.slice(0, 1).toUpperCase()}</button>
          <div className="appBrand"><span>Y</span>YUNAMATCH</div>
          <button className="headerIcon" onClick={() => tab === "discover" ? setFilterOpen(true) : switchTab("matches")} aria-label={tab === "discover" ? "絞り込み" : "通知"}>{tab === "discover" ? "☷" : "♢"}{pendingCount > 0 && <i>{pendingCount}</i>}</button>
        </header>

        <div className="appViewport">
          {tab === "discover" && (
            <section className="discoverView">
              <div className="feedTabs">
                <button className={feed === "recommend" ? "active" : ""} onClick={() => setFeed("recommend")}>おすすめ</button>
                <button className={feed === "incoming" ? "active" : ""} onClick={() => { setFeed("incoming"); loadNotices(); }}>相手から{pendingCount > 0 && <b>{pendingCount}</b>}</button>
              </div>

              {feed === "recommend" ? (
                <>
                  <div className="recommendMeta"><span>あなたに合いそうなメイト</span><button onClick={() => setFilterOpen(true)}>{wanted === "すべて" ? "条件なし" : wanted} ▾</button></div>
                  {loading ? (
                    <div className="stateCard"><div className="loadingBall" /><h2>メイトを探しています</h2></div>
                  ) : current ? (
                    <article
                      className={`discoverCard ${animation}`}
                      onPointerDown={(event) => setDragStart(event.clientX)}
                      onPointerUp={handlePointerUp}
                    >
                      <div className={`cardArtwork ${roleClass[current.role] || "support"}`}>
                        <div className="artDots" />
                        <span>{current.pokemon.slice(0, 1)}</span>
                        <small>{current.pokemon}</small>
                        <div className="roleBadge">{current.role}</div>
                      </div>
                      <div className="cardDetails">
                        <div className="identityLine"><h1>{current.trainerName}</h1><span>● 募集中</span></div>
                        <p className="rankText">{current.rank} ・ {current.gender}</p>
                        <p className="profileNote">“{current.note}”</p>
                        <div className="statGrid">
                          <div><strong>{current.matches.toLocaleString()}</strong><span>試合数</span></div>
                          <div><strong>{current.winRate}<small>%</small></strong><span>勝率</span></div>
                        </div>
                        <div className="timeChip">◷ {current.playTime}</div>
                      </div>
                    </article>
                  ) : (
                    <div className="stateCard emptyState"><div className="emptyOrb">Y</div><h2>新しいメイトを待っています</h2><p>最初の募集を出すと、ほかのトレーナーからプレイ申請が届きます。</p><button onClick={() => setCompose(true)}>募集を作る</button></div>
                  )}
                  {current && <div className="choiceArea"><button className="passButton" onClick={() => moveNext("left")} aria-label="次のメイトを見る">×<small>次へ</small></button><p>左右にスワイプ</p><button className="likeButton" onClick={() => moveNext("right")} aria-label="この人とプレイしたい">⚡<small>組みたい</small></button></div>}
                </>
              ) : (
                <IncomingList incoming={incoming} decide={decide} />
              )}
            </section>
          )}

          {tab === "recruit" && (
            <section className="panelView">
              <div className="viewHeading"><div><small>LIVE RECRUITING</small><h1>今夜の募集</h1></div><button onClick={() => setCompose(true)}>＋ 募集する</button></div>
              <p className="viewLead">条件の合う募集にプレイ申請を送れます。</p>
              <div className="recruitList">
                {recruits.length ? recruits.map((recruit) => (
                  <article key={recruit.id} className="recruitItem">
                    <div className={`pokemonTile ${roleClass[recruit.role] || "support"}`}>{recruit.pokemon.slice(0, 1)}</div>
                    <div><div className="recruitTop"><h2>{recruit.trainerName}</h2><span>募集中</span></div><p>{recruit.pokemon} ・ {recruit.rank}</p><small>{recruit.playTime} ・ 勝率 {recruit.winRate}%</small></div>
                    <button onClick={() => setApplyTo(recruit)}>見る</button>
                  </article>
                )) : <div className="listEmpty">まだ公開中の募集はありません。<br />あなたの募集から始めてみませんか？</div>}
              </div>
            </section>
          )}

          {tab === "matches" && (
            <section className="panelView">
              <div className="viewHeading"><div><small>CONNECTIONS</small><h1>マッチ・通知</h1></div></div>
              <h2 className="subHeading">届いた申請</h2>
              <IncomingList incoming={incoming} decide={decide} compact />
              <h2 className="subHeading">送った申請</h2>
              <div className="noticeList">
                {outgoing.length ? outgoing.map((notice) => (
                  <article className="noticeItem" key={notice.id}>
                    <div className="noticeAvatar">{notice.trainerName?.slice(0, 1)}</div>
                    <div><h3>{notice.trainerName}</h3><p>{notice.pokemon}の募集</p></div>
                    <StatusPill status={notice.status} />
                    {notice.ownerContact && <button className="contactLink" onClick={() => setMatchedContact(notice.ownerContact || null)}>連絡先</button>}
                  </article>
                )) : <p className="noticeEmpty">送信した申請はありません</p>}
              </div>
            </section>
          )}

          {tab === "profile" && (
            <section className="panelView profileView">
              <div className="profileHero"><div>{profile.trainerName.slice(0, 1).toUpperCase()}</div><small>MY PROFILE</small><h1>{profile.trainerName}</h1><p>{profile.pokemon} ・ {profile.rank}</p></div>
              <form className="profileForm" onSubmit={saveProfile}>
                <label>トレーナー名<input value={profile.trainerName} maxLength={24} onChange={(event) => setProfile({ ...profile, trainerName: event.target.value })} required /></label>
                <label>メインポケモン<select value={profile.pokemon} onChange={(event) => setProfile({ ...profile, pokemon: event.target.value })}>{pokemon.map((name) => <option key={name}>{name}</option>)}</select></label>
                <label>現在のレート<select value={profile.rank} onChange={(event) => setProfile({ ...profile, rank: event.target.value })}><option>エキスパート</option><option>マスター 1200〜1399</option><option>マスター 1400〜1599</option><option>マスター 1600〜1799</option><option>マスター 1800〜</option></select></label>
                <label>遊べる時間<select value={profile.playTime} onChange={(event) => setProfile({ ...profile, playTime: event.target.value })}><option>平日 朝（6〜12時）</option><option>平日 昼（12〜18時）</option><option>平日 夜（18〜22時）</option><option>平日 深夜（22〜翌2時）</option><option>土日 朝・昼</option><option>土日 夜・深夜</option><option>時間帯はいつでも</option></select></label>
                <label>性別<select value={profile.gender} onChange={(event) => setProfile({ ...profile, gender: event.target.value })}><option>回答しない</option><option>女性</option><option>男性</option><option>その他</option></select></label>
                <label>承認後に伝える連絡先<input value={profile.contact} placeholder="Discord ID / トレーナーID" onChange={(event) => setProfile({ ...profile, contact: event.target.value })} /></label>
                <button className="primaryButton">プロフィールを保存</button>
              </form>
              <a className="signOutLink" href="/signout-with-chatgpt?return_to=%2F">ログアウト</a>
              <p className="fanNote">非公式ファンメイドサービスです。ゲーム運営会社とは関係ありません。</p>
            </section>
          )}
        </div>

        <nav className="bottomNav" aria-label="メインメニュー">
          <button className={tab === "discover" ? "active" : ""} onClick={() => switchTab("discover")}><span>◇</span>さがす</button>
          <button className={tab === "recruit" ? "active" : ""} onClick={() => switchTab("recruit")}><span>◫</span>募集</button>
          <button className={tab === "matches" ? "active" : ""} onClick={() => switchTab("matches")}><span>♡</span>マッチ{pendingCount > 0 && <i>{pendingCount}</i>}</button>
          <button className={tab === "profile" ? "active" : ""} onClick={() => switchTab("profile")}><span>○</span>マイページ</button>
        </nav>
      </section>

      {filterOpen && (
        <div className="modalBackdrop"><button className="backdropDismiss" onClick={() => setFilterOpen(false)} aria-label="絞り込みを閉じる" /><section className="sheetModal"><div className="sheetHandle" /><button className="closeButton" onClick={() => setFilterOpen(false)}>×</button><small className="modalKicker">SEARCH FILTER</small><h2>希望のメイト</h2><label>使ってほしいポケモン<select value={wanted} onChange={(event) => { setWanted(event.target.value); setIndex(0); }}><option>すべて</option>{pokemon.map((name) => <option key={name}>{name}</option>)}</select></label><div className="twoFields"><label>最低勝率<select value={minRate} onChange={(event) => { setMinRate(Number(event.target.value)); setIndex(0); }}><option value="0">指定なし</option><option value="50">50%以上</option><option value="55">55%以上</option><option value="60">60%以上</option></select></label><label>最低試合数<select value={minMatches} onChange={(event) => { setMinMatches(Number(event.target.value)); setIndex(0); }}><option value="0">指定なし</option><option value="500">500試合〜</option><option value="1000">1,000試合〜</option><option value="1500">1,500試合〜</option></select></label></div><label className="toggleRow"><input type="checkbox" checked={womenOnly} onChange={(event) => { setWomenOnly(event.target.checked); setIndex(0); }} /><span>女性プレイヤーのみ</span></label><button className="primaryButton" onClick={() => setFilterOpen(false)}>この条件で探す</button></section></div>
      )}

      {compose && (
        <div className="modalBackdrop"><form className="sheetModal formSheet" onSubmit={submitRecruit}><button type="button" className="closeButton" onClick={() => setCompose(false)}>×</button><small className="modalKicker">CREATE RECRUIT</small><h2>今夜のメイトを募集</h2><div className="twoFields"><label>トレーナー名<input name="trainerName" defaultValue={profile.trainerName} required /></label><label>性別<select name="gender" defaultValue={profile.gender}><option>回答しない</option><option>女性</option><option>男性</option><option>その他</option></select></label></div><div className="twoFields"><label>使用ポケモン<select name="pokemon" defaultValue={profile.pokemon}>{pokemon.map((name) => <option key={name}>{name}</option>)}</select></label><label>型<select name="role"><option>アタック型</option><option>バランス型</option><option>スピード型</option><option>ディフェンス型</option><option>サポート型</option></select></label></div><div className="twoFields"><label>試合数<input name="matches" type="number" min="0" max="99999" defaultValue="1000" required /></label><label>勝率<input name="winRate" type="number" min="0" max="100" step="0.1" defaultValue="50" required /></label></div><label>現在のレート<select name="rank" defaultValue={profile.rank}><option>エキスパート</option><option>マスター 1200〜1399</option><option>マスター 1400〜1599</option><option>マスター 1600〜1799</option><option>マスター 1800〜</option></select></label><label>遊べる時間<select name="playTime" defaultValue={profile.playTime}><option>平日 朝（6〜12時）</option><option>平日 昼（12〜18時）</option><option>平日 夜（18〜22時）</option><option>平日 深夜（22〜翌2時）</option><option>土日 朝・昼</option><option>土日 夜・深夜</option><option>時間帯はいつでも</option></select></label><label>ひとこと<textarea name="note" maxLength={180} placeholder="楽しくランクを回したいです！" required /></label><label>承認後に伝える連絡先<input name="contact" defaultValue={profile.contact} placeholder="Discord ID / トレーナーID" required /></label><p className="privacyText">連絡先は承認した相手にだけ表示されます。</p><button className="primaryButton" disabled={sending}>{sending ? "公開中…" : "募集を公開する"}</button></form></div>
      )}

      {applyTo && (
        <div className="modalBackdrop"><form className="sheetModal formSheet" onSubmit={submitApplication}><button type="button" className="closeButton" onClick={() => setApplyTo(null)}>×</button><div className={`applyPokemon ${roleClass[applyTo.role] || "support"}`}>{applyTo.pokemon.slice(0, 1)}</div><small className="modalKicker">PLAY REQUEST</small><h2>{applyTo.trainerName}さんと<br />ユナイトする</h2><label>あなたのトレーナー名<input name="applicantName" defaultValue={profile.trainerName} required /></label><label>使用ポケモン<select name="pokemon" defaultValue={profile.pokemon}>{pokemon.map((name) => <option key={name}>{name}</option>)}</select></label><label>承認後に伝える連絡先<input name="applicantContact" defaultValue={profile.contact} placeholder="Discord ID / トレーナーID" required /></label><label>メッセージ<textarea name="message" maxLength={180} defaultValue={`${applyTo.pokemon}と一緒にランクへ行きたいです！`} required /></label><button className="primaryButton" disabled={sending}>{sending ? "送信中…" : "プレイ申請を送る"}</button></form></div>
      )}

      {matchedContact && (
        <div className="modalBackdrop"><section className="matchModal"><div className="matchBurst">⚡</div><small>MATCH!</small><h2>マッチ成立！</h2><p>相手の連絡先から、プレイ時間を相談しましょう。</p><div className="contactBox">{matchedContact}</div><button className="primaryButton" onClick={() => { navigator.clipboard?.writeText(matchedContact); notify("連絡先をコピーしました"); }}>連絡先をコピー</button><button className="textButton" onClick={() => setMatchedContact(null)}>閉じる</button></section></div>
      )}

      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}

function IncomingList({ incoming, decide, compact = false }: { incoming: Notice[]; decide: (id: number, action: "accept" | "decline") => void; compact?: boolean }) {
  if (!incoming.length) return <div className={compact ? "noticeEmpty" : "stateCard miniState"}><div className="emptyOrb">♡</div><h2>届いた申請はありません</h2><p>あなたの募集に申請が届くと、ここから承認できます。</p></div>;
  return <div className={`incomingList ${compact ? "compact" : ""}`}>{incoming.map((notice) => <article className="incomingCard" key={notice.id}><div className="requestAvatar">{notice.applicantName?.slice(0, 1)}</div><div className="requestCopy"><div><h2>{notice.applicantName}</h2><StatusPill status={notice.status} /></div><p>{notice.pokemon}で、{notice.recruitPokemon}の募集に申請</p>{notice.message && <blockquote>{notice.message}</blockquote>}</div>{notice.status === "pending" && <div className="requestActions"><button onClick={() => decide(notice.id, "decline")}>見送る</button><button onClick={() => decide(notice.id, "accept")}>承認する</button></div>}</article>)}</div>;
}

function StatusPill({ status }: { status: string }) {
  const label = status === "accepted" ? "マッチ成立" : status === "declined" ? "見送り" : "承認待ち";
  return <span className={`statusPill ${status}`}>{label}</span>;
}
