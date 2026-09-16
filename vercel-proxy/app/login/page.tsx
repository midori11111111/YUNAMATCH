import { signIn } from "@/auth";
import { headers } from "next/headers";
import { gatewayBrandForHost } from "@/lib/gateway-brand";
import LoginButton from "./login-button";

export default async function LoginPage() {
  const requestHeaders = await headers();
  const brand = gatewayBrandForHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );
  const returnTo = process.env.SERVICE_HOME_PATH || "/";
  return (
    <main className={`loginPage loginPage--${brand.service}`}>
      <section className="loginCard">
        <div className="loginLogo" aria-hidden="true">{brand.logo}</div>
        <div className="loginWordmark">{brand.wordmark}</div>
        <p className="loginEyebrow">{brand.eyebrow}</p>
        <h1>{brand.heading}<br /><span>{brand.accent}</span></h1>
        <p className="loginLead">
          {brand.lead.split("\n").map((line, index) => (
            <span key={line}>{index > 0 && <br />}{line}</span>
          ))}
        </p>
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
