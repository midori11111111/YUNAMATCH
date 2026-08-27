import { signIn } from "@/auth";
import LoginButton from "./login-button";

export default function LoginPage() {
  const isStamate = process.env.SITE_VARIANT === "stamate";
  const returnTo = isStamate ? "/stamate" : "/";
  return (
    <main className="loginPage">
      <section className="loginCard">
        {isStamate ? (
          <img className="loginBrandMark" src="/brand/stamate-mark.svg" alt="" />
        ) : (
          <div className="loginLogo" aria-hidden="true">Y</div>
        )}
        <div className="loginWordmark">{isStamate ? "スタ" : "YUNA"}<span>{isStamate ? "メイト" : "MATCH"}</span></div>
        <p className="loginEyebrow">{isStamate ? "BRAWL TEAM MATCHING" : "POKÉMON UNITE MATCHING"}</p>
        <h1>相性でつながる、<br /><span>{isStamate ? "スタメイト。" : "ユナマッチ。"}</span></h1>
        <p className="loginLead">{isStamate ? <>ランクとプレイスタイルから、<br />一緒に戦うゲーム仲間を見つけよう。</> : <>使用ポケモンとプレイスタイルから、<br />今夜一緒に戦うメイトを見つけよう。</>}</p>
        <div className="returningUserGuide">
          <strong>すでに登録済みの方</strong>
          <p>登録時と同じSNS・同じアカウントを選ぶと、別のスマホでもプロフィールやチャットを引き継げます。</p>
        </div>
        <div className="accountChoiceTitle"><strong>ログインするアカウントを選択</strong><span>アカウント選択画面で、登録時のアカウントを選んでください</span></div>
        <div className="loginActions">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: returnTo }, { prompt: "select_account" });
            }}
          >
            <LoginButton className="googleButton" markClassName="googleMark" mark="G" label="Googleでログイン" />
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("line", { redirectTo: returnTo }, { prompt: "consent" });
            }}
          >
            <LoginButton className="lineButton" markClassName="lineMark" mark="LINE" label="LINEでログイン" />
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("discord", { redirectTo: returnTo }, { prompt: "consent" });
            }}
          >
            <LoginButton className="discordButton" markClassName="discordMark" mark="D" label="Discordでログイン" />
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("twitter", { redirectTo: returnTo }, { force_login: "true" });
            }}
          >
            <LoginButton className="xButton" markClassName="xMark" mark="X" label="Xでログイン" />
          </form>
        </div>
        <div className="newUserGuide">
          <strong>初めての方</strong>
          <span>上のいずれかを選ぶだけで、そのまま無料登録できます。</span>
        </div>
      </section>
    </main>
  );
}
