"use client";

import type { ServiceId } from "@/lib/service-config";

const defaultInviteUrls: Record<ServiceId, string> = {
  valomatch: "https://discord.gg/yrqnQNEYc",
  stamate: "https://discord.gg/eUX4kHBef",
  shoenmate: "https://discord.gg/qWR5tTyPH",
};

const inviteUrls: Record<ServiceId, string> = {
  valomatch:
    process.env.NEXT_PUBLIC_VALOMATCH_DISCORD_URL || defaultInviteUrls.valomatch,
  stamate:
    process.env.NEXT_PUBLIC_STAMATE_DISCORD_URL || defaultInviteUrls.stamate,
  shoenmate:
    process.env.NEXT_PUBLIC_SHOENMATE_DISCORD_URL || defaultInviteUrls.shoenmate,
};

export function isDiscordInviteUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "discord.gg" || url.hostname === "discord.com") &&
      (url.hostname === "discord.gg" || url.pathname.startsWith("/invite/"))
    );
  } catch {
    return false;
  }
}

export default function ServiceDiscordLink({ service }: { service: ServiceId }) {
  const url = inviteUrls[service];
  if (!isDiscordInviteUrl(url)) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        width: "100%",
        boxSizing: "border-box",
        marginTop: 14,
        padding: "14px 16px",
        borderRadius: 14,
        background: "#5865f2",
        color: "#fff",
        textDecoration: "none",
        fontWeight: 900,
        fontSize: 13,
      }}
    >
      <span aria-hidden="true">D</span> 公式Discordに参加
    </a>
  );
}
