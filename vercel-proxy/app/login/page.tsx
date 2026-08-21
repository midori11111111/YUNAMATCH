import { signIn } from "@/auth";

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
            <button className="googleButton" type="submit">
              <span className="googleMark" aria-hidden="true">G</span>
              Googleでログイン
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("line", { redirectTo: "/" });
            }}
          >
            <button className="lineButton" type="submit">
              <span className="lineMark" aria-hidden="true">LINE</span>
              LINEでログイン
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("discord", { redirectTo: "/" });
            }}
          >
            <button className="discordButton" type="submit">
              <span className="discordMark" aria-hidden="true">D</span>
              Discordでログイン
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("twitter", { redirectTo: "/" });
            }}
          >
            <button className="xButton" type="submit">
              <span className="xMark" aria-hidden="true">X</span>
              Xでログイン
            </button>
          </form>
        </div>
        <p className="loginNote">ログイン後すぐにメイト探しを始められます</p>
      </section>
    </main>
  );
}
