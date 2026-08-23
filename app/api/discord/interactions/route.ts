import { and, eq } from "drizzle-orm";
import { getRequestExecutionContext } from "vinext/shims/request-context";
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
import { createRecruitVoiceRoom } from "../../../../lib/discord-recruit-voice";

const json = (data: unknown, status = 200) => Response.json(data, { status });
const bytes = (hex: string) =>
  Uint8Array.from(
    hex.match(/.{2}/g)?.map((value) => Number.parseInt(value, 16)) || [],
  );
const matchTypes = new Set(["ランクマッチ", "カジュアル"]);
const discordRecruitRanks = new Set([
  "エキスパート未満",
  "エキスパート",
  "マスター0〜249",
  "マスター250〜499",
  "マスター500〜749",
  "マスター750〜999",
  "レジェンド1000〜1249",
  "レジェンド1250〜1499",
  "レジェンド1500以上",
]);

type DiscordInteraction = {
  application_id?: string;
  guild_id?: string;
  token?: string;
  type: number;
  member?: { user?: { id?: string } };
  user?: { id?: string };
  data?: {
    name?: string;
    options?: Array<{ name: string; value: string | number }>;
  };
};

type DiscordMessage = {
  content: string;
  allowed_mentions?: { parse: Array<"everyone" | "roles" | "users"> };
  components?: Array<{
    type: number;
    components: Array<{
      type: number;
      style: number;
      label: string;
      url: string;
    }>;
  }>;
};

const errorMessage = (content: string): DiscordMessage => ({ content });
const discordLinkMessage = (): DiscordMessage => ({
  content:
    "YUNAMATCHでこのDiscordアカウントを連携してから、もう一度 `/募集` を実行してください。",
  components: [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 5,
          label: "Discord連携はこちら",
          url: "https://yunamatch.com/?joinDiscord=1",
        },
      ],
    },
  ],
});

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

async function createRecruitMessage(
  interaction: DiscordInteraction,
  discordId: string,
): Promise<DiscordMessage> {
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
  if (!linked) return discordLinkMessage();
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, linked.canonicalUserId))
    .limit(1);
  if (!profile || profile.suspendedAt)
    return errorMessage("利用できるYUNAMATCHプロフィールが見つかりません。");
  const rateLimit = await checkRateLimit(profile.userId, {
    action: "discord-recruit",
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed)
    return errorMessage(
      "短時間の募集回数が多すぎます。少し待ってからもう一度お試しください。",
    );

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
  // Commands registered before this option existed keep their current behavior.
  const createVoice = String(options.create_vc || "yes") === "yes";
  const startsIn = Number(options.starts_in || 0);
  const duration = Number(options.duration || 2);
  const matches = Number(options.matches || 0);
  const winRate = Number(options.win_rate || 50);
  const requestedVoiceLimit = Number(options.voice_limit);
  const voiceLimit = Number.isFinite(requestedVoiceLimit)
    ? requestedVoiceLimit
    : partySize;
  if (
    !matchTypes.has(matchType) ||
    !discordRecruitRanks.has(currentRank) ||
    ![2, 3, 5].includes(partySize) ||
    !["up_to_3", "2", "3", "5"].includes(partyChoice) ||
    ![0, 30, 60, 120].includes(startsIn) ||
    ![1, 2, 3].includes(duration) ||
    !["yes", "no"].includes(String(options.create_vc || "yes")) ||
    (createVoice && ![2, 3, 4, 5].includes(voiceLimit))
  )
    return errorMessage("募集条件を確認してください。");

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
  const url = `https://yunamatch.com/?recruit=${recruit.id}`;
  const startLabel = startsIn === 0 ? "今から" : `${startsIn}分後`;
  const partyDisplay = partyChoice === "up_to_3" ? "3人以下" : `${partySize}人`;
  const optionalDetails = [
    options.lane ? `担当レーンは${String(options.lane)}` : "",
    options.play_style ? `役割は${String(options.play_style)}` : "",
    options.starts_in !== undefined ? `開始時間は${startLabel}` : "",
    options.duration !== undefined ? `募集時間は${duration}時間` : "",
    options.matches !== undefined ? `試合数は${matches.toLocaleString("ja-JP")}戦` : "",
    options.win_rate !== undefined ? `勝率は${winRate}%` : "",
  ].filter(Boolean);
  let voiceRoom: { name: string; url: string } | null = null;
  if (createVoice) {
    try {
      voiceRoom = await createRecruitVoiceRoom({
        discordId,
        trainerName: profile.trainerName,
        userLimit: voiceLimit,
      });
    } catch {
      await Promise.all([
        db
          .update(recruits)
          .set({ status: "closed" })
          .where(eq(recruits.id, recruit.id)),
        db
          .update(lobbies)
          .set({ status: "cancelled", finishedAt: new Date() })
          .where(eq(lobbies.id, lobby.id)),
      ]);
      return errorMessage(
        "VCを作成できなかったため、募集は公開しませんでした。Botの権限を確認してもう一度お試しください。",
      );
    }
  }
  return {
    content: [
      `@here **${matchType}の${partyDisplay}パーティ募集中です**`,
      `募集者のレートは${currentRank}`,
      ...optionalDetails,
      createVoice
        ? `専用VCは${voiceLimit}人用・24時間で自動削除されます`
        : "専用VCは作成しません",
      "参加申請は下のボタンから",
    ].filter(Boolean).join("\n"),
    allowed_mentions: { parse: ["everyone"] },
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
          ...(voiceRoom
            ? [
                {
                  type: 2,
                  style: 5,
                  label: `${voiceLimit}人用VCに入る`,
                  url: voiceRoom.url,
                },
              ]
            : []),
        ],
      },
    ],
  };
}

async function editOriginalResponse(
  applicationId: string,
  interactionToken: string,
  message: DiscordMessage,
) {
  const response = await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
    },
  );
  if (!response.ok)
    throw new Error(`Discord interaction update failed: ${response.status}`);
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!(await verify(request, raw)))
    return new Response("invalid request signature", { status: 401 });
  const interaction = JSON.parse(raw) as DiscordInteraction;
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
          "⚡ **YUNAMATCHの使い方**\n1. プロフィールでDiscordアカウントを連携\n2. このサーバーで `/募集` を入力\n3. カジュアルかランクマッチを選択\n4. 届いた申請をYUNAMATCHで承認\n5. チャットで人数を選び、Botに専用VCを作ってもらう\n\n詳しくはこちら：https://yunamatch.com/community",
        flags: 64,
      },
    });
  if (interaction.data?.name !== "募集")
    return json({
      type: 4,
      data: { content: "対応していないコマンドです", flags: 64 },
    });

  const discordId = interaction.member?.user?.id || interaction.user?.id;
  const applicationId = interaction.application_id;
  const interactionToken = interaction.token;
  if (!discordId || !applicationId || !interactionToken)
    return json({
      type: 4,
      data: {
        content: "Discordアカウントを確認できませんでした",
        flags: 64,
      },
    });

  const task = createRecruitMessage(interaction, discordId)
    .then((message) =>
      editOriginalResponse(applicationId, interactionToken, message),
    )
    .catch(() =>
      editOriginalResponse(
        applicationId,
        interactionToken,
        errorMessage("募集を作成できませんでした。もう一度お試しください。"),
      ).catch(() => undefined),
    );
  const executionContext = getRequestExecutionContext();
  if (executionContext) executionContext.waitUntil(task);
  else void task;

  // Discord requires an acknowledgement within three seconds. This deferred
  // response must be public because its visibility cannot be changed later.
  return json({ type: 5 });
}
