import { requireAdmin } from "../../../../lib/admin";

const services = [
  {
    id: "valomatch",
    name: "バロマッチ",
    site: "VALOMATCH_SITE_URL",
    x: "VALOMATCH_X_URL",
    discord: "NEXT_PUBLIC_VALOMATCH_DISCORD_URL",
    approval: "VALOMATCH_PUBLIC_RELEASE_APPROVED",
    approvalLabel: "Riot公開範囲の確認",
  },
  {
    id: "stamate",
    name: "スタメイト",
    site: "STAMATE_SITE_URL",
    x: "STAMATE_X_URL",
    discord: "NEXT_PUBLIC_STAMATE_DISCORD_URL",
    approval: "STAMATE_PUBLIC_RELEASE_APPROVED",
    approvalLabel: "Supercellファンコンテンツ方針の最終確認",
  },
  {
    id: "shoenmate",
    name: "荘園メイト",
    site: "SHOENMATE_SITE_URL",
    x: "SHOENMATE_X_URL",
    discord: "NEXT_PUBLIC_SHOENMATE_DISCORD_URL",
    approval: "SHOENMATE_PUBLIC_RELEASE_APPROVED",
    approvalLabel: "NetEase回答・公開範囲の確認",
  },
] as const;

const isHttpsUrl = (value: string | undefined) => {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export async function GET() {
  if (!(await requireAdmin()))
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });

  const common = [
    ["認証シークレット", Boolean(process.env.AUTH_SECRET)],
    ["管理者パスワード", Boolean(process.env.ADMIN_PASSWORD)],
    ["問い合わせメール送信", Boolean(process.env.RESEND_API_KEY && process.env.FEEDBACK_FROM_EMAIL)],
    ["電気通信事業の追加サービス確認", process.env.TELECOM_SERVICES_CONFIRMED === "true"],
  ].map(([label, ready]) => ({ label: String(label), ready: Boolean(ready) }));

  return Response.json({
    common,
    services: services.map((service) => {
      const checks = [
        { label: "本番URL", ready: isHttpsUrl(process.env[service.site]) },
        { label: "公式X", ready: isHttpsUrl(process.env[service.x]) },
        { label: "公式Discord", ready: isHttpsUrl(process.env[service.discord]) },
        {
          label: service.approvalLabel,
          ready: process.env[service.approval] === "true",
        },
      ];
      return {
        id: service.id,
        name: service.name,
        ready: checks.every((check) => check.ready),
        checks,
      };
    }),
  });
}
