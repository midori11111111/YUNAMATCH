const required = [
  "AUTH_SECRET",
  "ADMIN_PASSWORD",
  "DISCORD_PUBLIC_KEY",
  "DISCORD_APP_ID",
  "DISCORD_BOT_TOKEN",
  "DISCORD_GUILD_ID",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "FEEDBACK_TO_EMAIL",
  "FEEDBACK_FROM_EMAIL",
  "RESEND_API_KEY",
];

const weakValues = new Set([
  "unimatch",
  "password",
  "changeme",
  "example",
  "test",
]);
const missing = required.filter((key) => !process.env[key]?.trim());
const weak = ["AUTH_SECRET", "ADMIN_PASSWORD"].filter((key) => {
  const value = process.env[key]?.trim() || "";
  return value.length < 24 || weakValues.has(value.toLowerCase());
});

if (missing.length || weak.length) {
  if (missing.length) console.error(`未設定: ${missing.join(", ")}`);
  if (weak.length)
    console.error(`短い、または推測されやすい値: ${weak.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("本番用の必須環境変数と秘密情報の最低要件を確認しました。");
}
