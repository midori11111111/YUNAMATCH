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
        <p className="loginNote">ログイン後すぐにメイト探しを始められます</p>
      </section>
    </main>
  );
}
