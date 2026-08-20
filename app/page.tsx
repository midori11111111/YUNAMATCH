import MatchApp from "./match-app";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";

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
          <a className="loginButton" href={chatGPTSignInPath("/")}>ChatGPTでログイン</a>
          <small>ログイン後すぐにメイト探しを始められます</small>
        </section>
      </main>
    );
  }

  return <MatchApp displayName={user?.displayName ?? "preview_trainer"} preview={preview} />;
}
