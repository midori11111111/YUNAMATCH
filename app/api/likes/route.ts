import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { applications, blocks, connections, notificationDismissals, profileLikes, profiles, recruits } from "../../../db/schema";
import { getDb } from "../../../db";
import { getChatGPTUser } from "../../chatgpt-auth";
import { profilePublicId, resolveProfilePublicId } from "../../../lib/profile-id";
import { sendPush } from "../../../lib/push";
import { normalizeRank } from "../../../lib/ranks";
import { identityAliases } from "../../../lib/account-aliases";

function parseList(value:string){
  try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed.filter((item):item is string=>typeof item==="string"&&Boolean(item.trim()))}
  catch{/* 旧形式はそのまま表示 */}
  return value.trim()?[value.trim()]:[];
}

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const db=getDb();
  const aliases=await identityAliases(user.userId,user.email);
  const aliasSet=new Set(aliases);
  const [received,sent,blockedByMe,blockedMe,likeCounts,skippedRows,matchedRows,pendingProfileRequests,[receivedLikeCountRow]]=await Promise.all([
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
      senderBio:profiles.bio,
      senderRegisteredAt:profiles.createdAt,
      senderLastActiveAt:profiles.updatedAt,
      senderSuspendedAt:profiles.suspendedAt,
      senderAgeConfirmed:profiles.ageConfirmed,
      senderTermsAcceptedAt:profiles.termsAcceptedAt,
      readAt:profileLikes.readAt,
      createdAt:profileLikes.createdAt,
    }).from(profileLikes).innerJoin(profiles,eq(profileLikes.senderId,profiles.userId)).where(eq(profileLikes.recipientId,user.userId)).orderBy(desc(profileLikes.createdAt)),
    db.select({recipientId:profileLikes.recipientId}).from(profileLikes).where(eq(profileLikes.senderId,user.userId)),
    db.select({id:blocks.blockedId}).from(blocks).where(eq(blocks.blockerId,user.userId)),
    db.select({id:blocks.blockerId}).from(blocks).where(eq(blocks.blockedId,user.userId)),
    db.select({userId:profileLikes.recipientId,count:sql<number>`count(*)`}).from(profileLikes).groupBy(profileLikes.recipientId),
    db.select({key:notificationDismissals.notificationKey}).from(notificationDismissals).where(eq(notificationDismissals.userId,user.userId)),
    db.select({userAId:connections.userAId,userBId:connections.userBId}).from(connections).where(or(inArray(connections.userAId,aliases),inArray(connections.userBId,aliases))),
    db.select({ownerId:recruits.ownerId}).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(and(inArray(applications.applicantId,aliases),eq(recruits.kind,"profile"),eq(applications.status,"pending"))),
    db.select({count:sql<number>`count(*)`}).from(profileLikes).where(eq(profileLikes.recipientId,user.userId)),
  ]);
  const skippedLikeIds=new Set(skippedRows.flatMap(row=>{
    const match=/^received-like:(\d+)$/.exec(row.key);
    return match?[Number(match[1])]:[];
  }));
  const hidden=new Set([...blockedByMe.map(row=>row.id),...blockedMe.map(row=>row.id)]);
  const matchedUserIds=new Set(matchedRows.flatMap(row=>{
    if(aliasSet.has(row.userAId))return [row.userBId];
    if(aliasSet.has(row.userBId))return [row.userAId];
    return [];
  }));
  const pendingTargetIds=new Set(pendingProfileRequests.map(row=>row.ownerId));
  const visibleReceived=received.filter(row=>
    !skippedLikeIds.has(row.id)&&
    !matchedUserIds.has(row.senderId)&&
    !pendingTargetIds.has(row.senderId)&&
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
      bio:row.senderBio||"",
      likeCount,
      popular:likeCount>=3,
      registeredAt:row.senderRegisteredAt,
      lastActiveAt:row.senderLastActiveAt,
    };
  }));
  const likedProfileIds=await Promise.all(sent.map(row=>profilePublicId(row.recipientId)));
  return Response.json({
    incoming,
    profiles:receivedProfiles,
    likedProfileIds,
    receivedLikeCount:Number(receivedLikeCountRow?.count)||0,
  });
}

export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const body=await request.json() as {targetId?:string};
  const targetId=typeof body.targetId==="string"?body.targetId:"";
  if(!/^[a-f0-9]{32}$/.test(targetId))return Response.json({error:"プロフィールを確認してください"},{status:400});
  const db=getDb();
  const [profileIdRows,[sender]]=await Promise.all([
    db.select({userId:profiles.userId}).from(profiles),
    db.select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1),
  ]);
  if(!sender)return Response.json({error:"先にプロフィールを登録してください"},{status:409});
  const targetUserId=await resolveProfilePublicId(profileIdRows.map(row=>row.userId),targetId);
  const [target]=targetUserId
    ? await db.select().from(profiles).where(eq(profiles.userId,targetUserId)).limit(1)
    : [];
  if(!target||target.suspendedAt||!target.ageConfirmed||!target.termsAcceptedAt||target.userId===user.userId)return Response.json({error:"このプロフィールにはいいねできません"},{status:404});
  const blocked=await db.select({id:blocks.id}).from(blocks).where(or(and(eq(blocks.blockerId,user.userId),eq(blocks.blockedId,target.userId)),and(eq(blocks.blockerId,target.userId),eq(blocks.blockedId,user.userId)))).limit(1);
  if(blocked.length)return Response.json({error:"このプロフィールにはいいねできません"},{status:403});
  const inserted=await db.insert(profileLikes).values({senderId:user.userId,recipientId:target.userId,createdAt:new Date()}).onConflictDoNothing().returning({id:profileLikes.id});
  if(inserted.length)await sendPush(target.userId,"いいねが届きました",`${sender.trainerName}さんがあなたのプロフィールにいいねしました`,"/");
  return Response.json({ok:true,created:Boolean(inserted.length)});
}

export async function PATCH(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const db=getDb();
  const body=await request.json().catch(()=>({})) as {action?:string;likeId?:number};
  if(body.action==="skip"){
    const likeId=Number(body.likeId);
    if(!Number.isInteger(likeId)||likeId<=0)return Response.json({error:"いいねを確認してください"},{status:400});
    const [receivedLike]=await db.select({id:profileLikes.id}).from(profileLikes).where(and(eq(profileLikes.id,likeId),eq(profileLikes.recipientId,user.userId))).limit(1);
    if(!receivedLike)return Response.json({error:"このいいねは見つかりません"},{status:404});
    await db.insert(notificationDismissals).values({userId:user.userId,notificationKey:`received-like:${likeId}`,createdAt:new Date()}).onConflictDoNothing();
    return Response.json({ok:true,skipped:true});
  }
  await db.update(profileLikes).set({readAt:new Date()}).where(and(eq(profileLikes.recipientId,user.userId),isNull(profileLikes.readAt)));
  return Response.json({ok:true});
}
