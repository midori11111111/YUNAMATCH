import MatchApp, { type Profile } from "./match-app";
import { getChatGPTUser } from "./chatgpt-auth";
import { isAdminUser } from "../lib/admin";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const user = await getChatGPTUser();
  const preview = process.env.NODE_ENV !== "production" && (await searchParams).preview === "1";

  if (!user && !preview) {
    return (
      <main className="loginPage">
        <section className="loginCard">
          <div className="loginLogo">Y</div>
          <div className="loginWordmark">YUNA<span>MATCH</span></div>
          <p className="loginEyebrow">POKÉMON UNITE MATCHING</p>
          <h1>相性でつながる、<br /><span>ユナマッチ。</span></h1>
          <p>使用ポケモンとプレイスタイルから、<br />今夜一緒に戦うメイトを見つけよう。</p>
          <div className="directLoginHeading"><strong>ログイン / 新規登録</strong><span>使うアカウントをここで選べます</span></div>
          <div className="directLoginGrid">
            <a className="directLoginButton google" href="/api/login/google"><span>G</span>Google</a>
            <a className="directLoginButton line" href="/api/login/line"><span>LINE</span>LINE</a>
            <a className="directLoginButton discord" href="/api/login/discord"><span>D</span>Discord</a>
            <a className="directLoginButton twitter" href="/api/login/twitter"><span>𝕏</span>X</a>
          </div>
          <small>選んだサービスの認証画面へ直接進みます</small>
        </section>
      </main>
    );
  }

  let initialProfile: Profile | null | undefined;
  let initialSuspended = false;
  if (user) {
    const [{ eq }, { getDb }, { profiles }] = await Promise.all([
      import("drizzle-orm"),
      import("../db"),
      import("../db/schema"),
    ]);
    const [row] = await getDb().select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1);
    initialSuspended = Boolean(row?.suspendedAt);
    if (!row) initialProfile = null;
    else {
      let mainPokemon:string[]=[];
      let playTime:string[]=[];
      try{const values=JSON.parse(row.mainPokemon);if(Array.isArray(values))mainPokemon=values.filter((value):value is string=>typeof value==="string").slice(0,5)}catch{if(row.mainPokemon)mainPokemon=[row.mainPokemon]}
      try{const values=JSON.parse(row.playTime);if(Array.isArray(values))playTime=values.filter((value):value is string=>typeof value==="string").slice(0,7)}catch{if(row.playTime)playTime=[row.playTime]}
      initialProfile={trainerName:row.trainerName,mainPokemon,highestRate:row.highestRate,playTime,gender:row.gender==="男性"||row.gender==="女性"?row.gender:"",contact:row.contact,avatarUrl:row.avatarUrl||"",ageConfirmed:Boolean(row.ageConfirmed),termsAccepted:Boolean(row.termsAcceptedAt)};
    }
  }

  return <MatchApp displayName={user?.displayName ?? "preview_trainer"} authProvider={user?.provider ?? "discord"} authContact={user?.contactId ?? "preview_trainer"} preview={preview} initialProfile={initialProfile} initialSuspended={initialSuspended} isAdmin={Boolean(user&&isAdminUser(user))} />;
}
