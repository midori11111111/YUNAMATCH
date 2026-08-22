import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { blocks, profileLikes, profiles } from "../../../db/schema";
import { getDb } from "../../../db";
import { getChatGPTUser } from "../../chatgpt-auth";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { profilePublicId } from "../../../lib/profile-id";
import { sendPush } from "../../../lib/push";
import { normalizeRank } from "../../../lib/ranks";

function parseList(value:string){
  try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed.filter((item):item is string=>typeof item==="string"&&Boolean(item.trim()))}
  catch{/* 旧形式はそのまま表示 */}
  return value.trim()?[value.trim()]:[];
}

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const db=getDb();
  const [received,sent,blockedByMe,blockedMe,likeCounts]=await Promise.all([
    db.select({
      id:profileLikes.id,
      senderId:profileLikes.senderId,
      senderName:profiles.trainerName,
      senderPokemon:profiles.mainPokemon,
      senderHighestRate:profiles.highestRate,
      senderPlayTime:profiles.playTime,
      senderGender:profiles.gender,
      senderAge:profiles.age,
      senderAvatarUrl:profiles.avatarUrl,
      senderRegisteredAt:profiles.createdAt,
      senderLastActiveAt:profiles.updatedAt,
      senderSuspendedAt:profiles.suspendedAt,
      senderAgeConfirmed:profiles.ageConfirmed,
      senderTermsAcceptedAt:profiles.termsAcceptedAt,
      readAt:profileLikes.readAt,
      createdAt:profileLikes.createdAt,
    }).from(profileLikes).innerJoin(profiles,eq(profileLikes.senderId,profiles.userId)).where(eq(profileLikes.recipientId,user.userId)).orderBy(desc(profileLikes.createdAt)).limit(50),
    db.select({recipientId:profileLikes.recipientId}).from(profileLikes).where(eq(profileLikes.senderId,user.userId)).limit(300),
    db.select({id:blocks.blockedId}).from(blocks).where(eq(blocks.blockerId,user.userId)),
    db.select({id:blocks.blockerId}).from(blocks).where(eq(blocks.blockedId,user.userId)),
    db.select({userId:profileLikes.recipientId,count:sql<number>`count(*)`}).from(profileLikes).groupBy(profileLikes.recipientId),
  ]);
  const hidden=new Set([...blockedByMe.map(row=>row.id),...blockedMe.map(row=>row.id)]);
  const visibleReceived=received.filter(row=>
    !hidden.has(row.senderId)&&
    !row.senderSuspendedAt&&
    row.senderAgeConfirmed&&
    Boolean(row.senderTermsAcceptedAt)
  );
  const incoming=await Promise.all(visibleReceived.map(async row=>({
    id:row.id,
    senderId:await profilePublicId(row.senderId),
    senderName:row.senderName,
    senderPokemon:parseList(row.senderPokemon)[0]||"未設定",
    senderAvatarUrl:row.senderAvatarUrl||"",
    read:Boolean(row.readAt),
    createdAt:row.createdAt,
  })));
  const likeCountByUser=new Map(likeCounts.map(row=>[row.userId,Number(row.count)||0]));
  const receivedProfiles=await Promise.all(visibleReceived.map(async row=>{
    const likeCount=likeCountByUser.get(row.senderId)||0;
    return {
      id:await profilePublicId(row.senderId),
      trainerName:row.senderName,
      mainPokemon:parseList(row.senderPokemon).slice(0,5),
      highestRate:normalizeRank(row.senderHighestRate),
      playTime:parseList(row.senderPlayTime).slice(0,7),
      gender:row.senderGender,
      age:row.senderAge,
      avatarUrl:row.senderAvatarUrl||"",
      likeCount,
      popular:likeCount>=3,
      registeredAt:row.senderRegisteredAt,
      lastActiveAt:row.senderLastActiveAt,
    };
  }));
  const likedProfileIds=await Promise.all(sent.map(row=>profilePublicId(row.recipientId)));
  return Response.json({incoming,profiles:receivedProfiles,likedProfileIds});
}

export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const rateLimit=await checkRateLimit(user.userId,{action:"profile-like",limit:40,windowMs:60*60_000});
  if(!rateLimit.allowed)return rateLimitResponse(rateLimit.retryAfter);
  const body=await request.json() as {targetId?:string};
  const targetId=typeof body.targetId==="string"?body.targetId:"";
  if(!/^[a-f0-9]{32}$/.test(targetId))return Response.json({error:"プロフィールを確認してください"},{status:400});
  const db=getDb();
  const [profileRows,[sender]]=await Promise.all([db.select().from(profiles).limit(300),db.select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1)]);
  if(!sender)return Response.json({error:"先にプロフィールを登録してください"},{status:409});
  const pairs=await Promise.all(profileRows.map(async row=>({row,id:await profilePublicId(row.userId)})));
  const target=pairs.find(item=>item.id===targetId)?.row;
  if(!target||target.suspendedAt||!target.ageConfirmed||!target.termsAcceptedAt||target.userId===user.userId)return Response.json({error:"このプロフィールにはいいねできません"},{status:404});
  const blocked=await db.select({id:blocks.id}).from(blocks).where(or(and(eq(blocks.blockerId,user.userId),eq(blocks.blockedId,target.userId)),and(eq(blocks.blockerId,target.userId),eq(blocks.blockedId,user.userId)))).limit(1);
  if(blocked.length)return Response.json({error:"このプロフィールにはいいねできません"},{status:403});
  const inserted=await db.insert(profileLikes).values({senderId:user.userId,recipientId:target.userId,createdAt:new Date()}).onConflictDoNothing().returning({id:profileLikes.id});
  if(inserted.length)await sendPush(target.userId,"いいねが届きました",`${sender.trainerName}さんがあなたのプロフィールにいいねしました`,"/");
  return Response.json({ok:true,created:Boolean(inserted.length)});
}

export async function PATCH(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const db=getDb();
  await db.update(profileLikes).set({readAt:new Date()}).where(and(eq(profileLikes.recipientId,user.userId),isNull(profileLikes.readAt)));
  return Response.json({ok:true});
}
