import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  accountLinks,
  lobbies,
  lobbyMembers,
  profiles,
  recruits,
} from "../../../../db/schema";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { normalizeRank } from "../../../../lib/ranks";

const json = (data: unknown, status = 200) => Response.json(data, { status });
const bytes = (hex: string) =>
  Uint8Array.from(
    hex.match(/.{2}/g)?.map((value) => Number.parseInt(value, 16)) || [],
  );
const matchTypes = new Set(["ランクマッチ", "カジュアル"]);

async function verify(request: Request, body: string) {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!signature || !timestamp || !publicKey) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      bytes(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "Ed25519",
      key,
      bytes(signature),
      new TextEncoder().encode(timestamp + body),
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!(await verify(request, raw)))
    return new Response("invalid request signature", { status: 401 });
  const interaction = JSON.parse(raw) as {
    type: number;
    member?: { user?: { id?: string } };
    user?: { id?: string };
    data?: {
      name?: string;
      options?: Array<{ name: string; value: string | number }>;
    };
  };
  if (interaction.type === 1) return json({ type: 1 });
  if (interaction.type !== 2)
    return json({
      type: 4,
      data: { content: "対応していない操作です", flags: 64 },
    });
  if (interaction.data?.name === "はじめ方")
    return json({
      type: 4,
      data: {
        content:
          "⚡ **YUNAMATCHの使い方**\n1. プロフィールでDiscordアカウントを連携\n2. このサーバーで `/募集` を入力\n3. カジュアルかランクマッチを選択\n4. 届いた申請をYUNAMATCHで承認\n5. チャットから二人だけのVC1〜VC5を作成\n\n詳しくはこちら：https://yunamatch.vercel.app/community",
        flags: 64,
      },
    });
  if (interaction.data?.name !== "募集")
    return json({
      type: 4,
      data: { content: "対応していないコマンドです", flags: 64 },
    });

  const discordId = interaction.member?.user?.id || interaction.user?.id;
  if (!discordId)
    return json({
      type: 4,
      data: {
        content: "Discordアカウントを確認できませんでした",
        flags: 64,
      },
    });
  const db = getDb();
  const [linked] = await db
    .select()
    .from(accountLinks)
    .where(
      and(
        eq(accountLinks.provider, "discord"),
        eq(accountLinks.providerAccountId, discordId),
      ),
    )
    .limit(1);
  if (!linked)
    return json({
      type: 4,
      data: {
        content:
          "先にYUNAMATCHのマイページで、このDiscordアカウントを連携してください。",
        flags: 64,
      },
    });
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, linked.canonicalUserId))
    .limit(1);
  if (!profile || profile.suspendedAt)
    return json({
      type: 4,
      data: {
        content: "利用できるYUNAMATCHプロフィールが見つかりません。",
        flags: 64,
      },
    });
  const rateLimit = await checkRateLimit(profile.userId, {
    action: "discord-recruit",
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed)
    return json({
      type: 4,
      data: {
        content:
          "短時間の募集回数が多すぎます。少し待ってからもう一度お試しください。",
        flags: 64,
      },
    });

  const options = Object.fromEntries(
    (interaction.data?.options || []).map((option) => [
      option.name,
      option.value,
    ]),
  );
  const pokemon = "未定";
  const selectedRole = [options.lane, options.play_style]
    .filter((value) => typeof value === "string" && value)
    .join("・");
  const role = selectedRole || String(options.role || "指定なし");
  const matchType = String(options.match_type || "ランクマッチ");
  const currentRank = normalizeRank(
    String(options.current_rank || "").trim(),
  );
  const partyChoice = String(options.party_size || "up_to_3");
  const partySize = partyChoice === "up_to_3" ? 3 : Number(partyChoice);
  const partyLabel =
    partyChoice === "up_to_3" ? "3人以下" : `${partySize}人`;
  const startsIn = Number(options.starts_in || 0);
  const duration = Number(options.duration || 2);
  const matches = Number(options.matches || 0);
  const winRate = Number(options.win_rate || 50);
  if (
    !matchTypes.has(matchType) ||
    !currentRank ||
    ![2, 3, 5].includes(partySize) ||
    !["up_to_3", "2", "3", "5"].includes(partyChoice) ||
    ![0, 30, 60, 120].includes(startsIn) ||
    ![1, 2, 3].includes(duration)
  )
    return json({
      type: 4,
      data: { content: "募集条件を確認してください。", flags: 64 },
    });

  const now = new Date();
  const startAt = new Date(now.getTime() + startsIn * 60_000);
  const expiresAt = new Date(startAt.getTime() + duration * 3_600_000);
  let playTime = "";
  try {
    playTime = (JSON.parse(profile.playTime) as string[]).join("・");
  } catch {
    playTime = profile.playTime;
  }
  await db
    .update(recruits)
    .set({ status: "closed" })
    .where(
      and(
        eq(recruits.ownerId, profile.userId),
        eq(recruits.status, "open"),
      ),
    );
  const [recruit] = await db
    .insert(recruits)
    .values({
      ownerId: profile.userId,
      trainerName: profile.trainerName,
      gender: profile.gender,
      pokemon,
      role,
      matches: Math.max(0, Math.round(matches)),
      winRate: Math.min(100, Math.max(0, winRate)),
      rank: currentRank,
      playTime,
      note:
        partyChoice === "up_to_3"
          ? `${matchType}・Discordから募集中（3人以下）`
          : `${matchType}・Discordから募集中`,
      contact: profile.contact,
      startAt,
      expiresAt,
      partySize,
      desiredPokemon: "すべて",
      desiredRole: "指定なし",
      matchType,
      createdAt: now,
    })
    .returning();
  const [lobby] = await db
    .insert(lobbies)
    .values({
      recruitId: recruit.id,
      ownerId: profile.userId,
      status: "forming",
      scheduledAt: startAt,
      createdAt: now,
    })
    .returning();
  await db.insert(lobbyMembers).values({
    lobbyId: lobby.id,
    userId: profile.userId,
    trainerName: profile.trainerName,
    pokemon,
    contact: profile.contact,
    joinedAt: now,
  });
  const url = `https://yunamatch.vercel.app/?recruit=${recruit.id}`;
  const startLabel = startsIn === 0 ? "今から" : `${startsIn}分後`;
  return json({
    type: 4,
    data: {
      content: `⚡ **${profile.trainerName}さんがユナイト仲間を募集！**\n🎮 ${matchType}\n${role} / ${currentRank}\n${startLabel}開始・${partyLabel}・${duration}時間募集\n使用ポケモンは未定です。役割を相談して決められます\n参加申請は下のボタンから`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "YUNAMATCHで参加申請",
              url,
            },
          ],
        },
      ],
    },
  });
}
