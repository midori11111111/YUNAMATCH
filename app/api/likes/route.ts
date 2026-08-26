import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { applicationMessages, applications, blocks, connections, messages, mutualLikeMatches, notificationDismissals, profileLikes, profiles, recruits } from "../../../db/schema";
import { getDb } from "../../../db";
import { getChatGPTUser } from "../../chatgpt-auth";
import { profilePublicId, resolveProfilePublicId } from "../../../lib/profile-id";
import { sendPush } from "../../../lib/push";
import { normalizeRank } from "../../../lib/ranks";
import { identityAliases } from "../../../lib/account-aliases";
import { runInBackground } from "../../../lib/background";

function parseList(value:string){
  try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed.filter((item):item is string=>typeof item==="string"&&Boolean(item.trim()))}
  catch{/* 旧形式はそのまま表示 */}
  return value.trim()?[value.trim()]:[];
}

function mutualPair(userAId:string,userBId:string){
  const [userLowId,userHighId]=[userAId,userBId].sort((a,b)=>a.localeCompare(b));
  return {userLowId,userHighId,pairKey:`${userLowId.length}:${userLowId}${userHighId}`};
}

async function createMutualLikeMatch({
  sender,
  target,
  aliases,
}:{
  sender:typeof profiles.$inferSelect;
  target:typeof profiles.$inferSelect;
  aliases:string[];
}){
  const db=getDb();
  const pair=mutualPair(sender.userId,target.userId);
  const connectionPredicate=or(
    and(inArray(connections.userAId,aliases),eq(connections.userBId,target.userId)),
    and(eq(connections.userAId,target.userId),inArray(connections.userBId,aliases)),
  );
  const [existingConnection]=await db.select().from(connections).where(connectionPredicate).limit(1);
  if(existingConnection)return {matched:true,connectionId:existingConnection.id,createdMatch:false};

  const claimed=await db.insert(mutualLikeMatches).values({
    ...pair,
    createdAt:new Date(),
  }).onConflictDoNothing().returning();
  if(!claimed.length){
    for(let attempt=0;attempt<4;attempt+=1){
      const [existingMatch]=await db.select().from(mutualLikeMatches).where(eq(mutualLikeMatches.pairKey,pair.pairKey)).limit(1);
      if(existingMatch?.connectionId)return {matched:true,connectionId:existingMatch.connectionId,createdMatch:false};
      const [connectionAfterClaim]=await db.select().from(connections).where(connectionPredicate).limit(1);
      if(connectionAfterClaim)return {matched:true,connectionId:connectionAfterClaim.id,createdMatch:false};
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    return {matched:true,connectionId:null,createdMatch:false,matching:true};
  }

  try{
    const now=new Date();
    const [pending]=await db.select({
      applicationId:applications.id,
      recruitId:recruits.id,
      ownerId:recruits.ownerId,
      ownerName:recruits.trainerName,
      ownerPokemon:recruits.pokemon,
      applicantId:applications.applicantId,
      applicantName:applications.applicantName,
      applicantPokemon:applications.pokemon,
      applicationMessage:applications.message,
      applicationCreatedAt:applications.createdAt,
    }).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(and(
      eq(recruits.kind,"profile"),
      eq(applications.status,"pending"),
      or(
        and(eq(recruits.ownerId,target.userId),inArray(applications.applicantId,aliases)),
        and(inArray(recruits.ownerId,aliases),eq(applications.applicantId,target.userId)),
      ),
    )).limit(1);

    let matchApplication=pending;
    if(matchApplication){
      await Promise.all([
        db.update(applications).set({status:"accepted",decisionMessage:""}).where(eq(applications.id,matchApplication.applicationId)),
        db.update(recruits).set({status:"closed",acceptedCount:1}).where(eq(recruits.id,matchApplication.recruitId)),
      ]);
    }else{
      const owner=pair.userLowId===sender.userId?sender:target;
      const applicant=owner.userId===sender.userId?target:sender;
      const ownerPokemon=parseList(owner.mainPokemon)[0]||"未設定";
      const applicantPokemon=parseList(applicant.mainPokemon)[0]||"指定なし";
      const expiresAt=new Date(now.getTime()+7*24*60*60_000);
      const [recruit]=await db.insert(recruits).values({
        kind:"profile",
        ownerId:owner.userId,
        trainerName:owner.trainerName,
        gender:owner.gender,
        pokemon:ownerPokemon,
        role:"プロフィール",
        matches:0,
        winRate:0,
        rank:normalizeRank(owner.highestRate),
        playTime:parseList(owner.playTime).join("・"),
        note:"相互いいねによるマッチ",
        contact:"",
        status:"closed",
        startAt:now,
        expiresAt,
        partySize:2,
        desiredPokemon:applicantPokemon,
        desiredRole:"プロフィールマッチ",
        acceptedCount:1,
        createdAt:now,
      }).returning();
      const [application]=await db.insert(applications).values({
        recruitId:recruit.id,
        applicantId:applicant.userId,
        applicantName:applicant.trainerName,
        applicantContact:"",
        pokemon:applicantPokemon,
        message:"お互いにいいねしました",
        status:"accepted",
        createdAt:now,
      }).returning();
      matchApplication={
        applicationId:application.id,
        recruitId:recruit.id,
        ownerId:owner.userId,
        ownerName:owner.trainerName,
        ownerPokemon,
        applicantId:applicant.userId,
        applicantName:applicant.trainerName,
        applicantPokemon,
        applicationMessage:application.message,
        applicationCreatedAt:application.createdAt,
      };
    }

    const [createdConnection]=await db.insert(connections).values({
      applicationId:matchApplication.applicationId,
      recruitId:matchApplication.recruitId,
      userAId:matchApplication.ownerId,
      userBId:matchApplication.applicantId,
      userAName:matchApplication.ownerName,
      userBName:matchApplication.applicantName,
      userAPokemon:matchApplication.ownerPokemon,
      userBPokemon:matchApplication.applicantPokemon,
      userAContact:"",
      userBContact:"",
      createdAt:now,
    }).onConflictDoNothing().returning();
    const [connection]=createdConnection
      ?[createdConnection]
      :await db.select().from(connections).where(eq(connections.applicationId,matchApplication.applicationId)).limit(1);
    if(!connection)throw new Error("Mutual-like connection was not created");

    if(createdConnection){
      if(pending){
        await db.insert(messages).values({
          connectionId:connection.id,
          senderId:matchApplication.applicantId,
          clientId:`match-wave-${matchApplication.applicationId}`,
          body:`👋 ${matchApplication.applicationMessage}`,
          createdAt:matchApplication.applicationCreatedAt,
        }).onConflictDoNothing();
        const preChat=(await db.select().from(applicationMessages).where(eq(applicationMessages.applicationId,matchApplication.applicationId)).orderBy(desc(applicationMessages.createdAt),desc(applicationMessages.id)).limit(100)).reverse();
        for(const item of preChat)await db.insert(messages).values({
          connectionId:connection.id,
          senderId:item.senderId,
          clientId:`application-chat-${item.id}`,
          body:item.body,
          createdAt:item.createdAt,
        }).onConflictDoNothing();
      }
      await db.insert(messages).values({
        connectionId:connection.id,
        senderId:sender.userId,
        clientId:`mutual-like-${matchApplication.applicationId}`,
        body:"💞 お互いにいいねしました。チャットが開通しました！",
        createdAt:now,
      }).onConflictDoNothing();
    }
    await db.update(mutualLikeMatches).set({connectionId:connection.id}).where(eq(mutualLikeMatches.pairKey,pair.pairKey));
    runInBackground(sendPush(target.userId,"お互いにいいね！",`${sender.trainerName}さんとマッチしました`,`/?chat=${connection.id}`),"Mutual like match push");
    return {matched:true,connectionId:connection.id,createdMatch:Boolean(createdConnection)};
  }catch(error){
    await db.delete(mutualLikeMatches).where(and(eq(mutualLikeMatches.pairKey,pair.pairKey),isNull(mutualLikeMatches.connectionId)));
    throw error;
  }
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
      senderHeaderUrl:profiles.headerUrl,
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
  const eligibleReceived=received.filter(row=>
    !matchedUserIds.has(row.senderId)&&
    !pendingTargetIds.has(row.senderId)&&
    !hidden.has(row.senderId)&&
    !row.senderSuspendedAt&&
    row.senderAgeConfirmed&&
    Boolean(row.senderTermsAcceptedAt)
  );
  const visibleReceived=eligibleReceived.filter(row=>!skippedLikeIds.has(row.id));
  const skippedReceived=eligibleReceived.filter(row=>skippedLikeIds.has(row.id));
  const incomingFromRows=(rows:typeof eligibleReceived)=>Promise.all(rows.map(async row=>({
    id:row.id,
    senderId:await profilePublicId(row.senderId),
    senderName:row.senderName,
    senderPokemon:parseList(row.senderPokemon)[0]||"未設定",
    senderAvatarUrl:row.senderAvatarUrl||"",
    read:Boolean(row.readAt),
    createdAt:row.createdAt,
  })));
  const incoming=await incomingFromRows(visibleReceived);
  const skippedIncoming=await incomingFromRows(skippedReceived);
  const likeCountByUser=new Map(likeCounts.map(row=>[row.userId,Number(row.count)||0]));
  const profilesFromRows=(rows:typeof eligibleReceived)=>Promise.all(rows.map(async row=>{
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
      headerUrl:row.senderHeaderUrl||"",
      bio:row.senderBio||"",
      likeCount,
      popular:likeCount>=3,
      registeredAt:row.senderRegisteredAt,
      lastActiveAt:row.senderLastActiveAt,
    };
  }));
  const receivedProfiles=await profilesFromRows(visibleReceived);
  const skippedProfiles=await profilesFromRows(skippedReceived);
  const likedProfileIds=await Promise.all(sent.map(row=>profilePublicId(row.recipientId)));
  return Response.json({
    incoming,
    profiles:receivedProfiles,
    skippedIncoming,
    skippedProfiles,
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
  const aliases=await identityAliases(user.userId,user.email);
  const [reciprocalLike]=await db.select({id:profileLikes.id}).from(profileLikes).where(and(
    eq(profileLikes.senderId,target.userId),
    inArray(profileLikes.recipientId,aliases),
  )).limit(1);
  if(reciprocalLike){
    const match=await createMutualLikeMatch({sender,target,aliases});
    return Response.json({ok:true,created:Boolean(inserted.length),...match,mateName:target.trainerName,matePokemon:parseList(target.mainPokemon)[0]||"ポケモン"});
  }
  if(inserted.length)await sendPush(target.userId,"いいねが届きました",`${sender.trainerName}さんがあなたのプロフィールにいいねしました`,"/");
  return Response.json({ok:true,created:Boolean(inserted.length),matched:false});
}

export async function PATCH(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const db=getDb();
  const body=await request.json().catch(()=>({})) as {action?:string;likeId?:number};
  if(body.action==="skip"||body.action==="restore"){
    const likeId=Number(body.likeId);
    if(!Number.isInteger(likeId)||likeId<=0)return Response.json({error:"いいねを確認してください"},{status:400});
    const [receivedLike]=await db.select({id:profileLikes.id}).from(profileLikes).where(and(eq(profileLikes.id,likeId),eq(profileLikes.recipientId,user.userId))).limit(1);
    if(!receivedLike)return Response.json({error:"このいいねは見つかりません"},{status:404});
    const notificationKey=`received-like:${likeId}`;
    if(body.action==="restore"){
      await db.delete(notificationDismissals).where(and(eq(notificationDismissals.userId,user.userId),eq(notificationDismissals.notificationKey,notificationKey)));
      return Response.json({ok:true,restored:true});
    }
    await db.insert(notificationDismissals).values({userId:user.userId,notificationKey,createdAt:new Date()}).onConflictDoNothing();
    return Response.json({ok:true,skipped:true});
  }
  await db.update(profileLikes).set({readAt:new Date()}).where(and(eq(profileLikes.recipientId,user.userId),isNull(profileLikes.readAt)));
  return Response.json({ok:true});
}
