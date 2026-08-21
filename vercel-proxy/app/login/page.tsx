import { signIn } from "@/auth";
import LoginButton from "./login-button";

export default function LoginPage() {
  return (
    <main className="loginPage">
      <section className="loginCard">
        <div className="loginLogo" aria-hidden="true">Y</div>
        <div className="loginWordmark">YUNA<span>MATCH</span></div>
        <p className="loginEyebrow">POKÉMON UNITE MATCHING</p>
        <h1>相性でつながる、<br /><span>ユナマッチ。</span></h1>
        <p className="loginLead">使用ポケモンとプレイスタイルから、<br />今夜一緒に戦うメイトを見つけよう。</p>
        <div className="accountChoiceTitle"><strong>ログインするアカウントを選択</strong><span>あとから設定で追加連携できます</span></div>
        <div className="loginActions">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <LoginButton className="googleButton" markClassName="googleMark" mark="G" label="Googleでログイン" />
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("line", { redirectTo: "/" });
            }}
          >
            <LoginButton className="lineButton" markClassName="lineMark" mark="LINE" label="LINEでログイン" />
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("discord", { redirectTo: "/" });
            }}
          >
            <LoginButton className="discordButton" markClassName="discordMark" mark="D" label="Discordでログイン" />
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("twitter", { redirectTo: "/" });
            }}
          >
            <LoginButton className="xButton" markClassName="xMark" mark="X" label="Xでログイン" />
          </form>
        </div>
        <p className="loginNote">ログイン後すぐにメイト探しを始められます</p>
      </section>
    </main>
  );
}
