import { and, desc, eq, gt, inArray, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { applications, lobbies, lobbyMembers, profiles, recruits } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isSuspended } from "../../../lib/safety";

const activeLobbyStatuses=["forming","ready","playing"];
const endedLobbyRetentionMs=10*60*1000;

export async function GET(){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です"},{status:401});
  const db=getDb();
  const visibleEndedAfter=new Date(Date.now()-endedLobbyRetentionMs);
  const lobbyRows=await db.select({id:lobbies.id,recruitId:lobbies.recruitId,ownerId:lobbies.ownerId,status:lobbies.status,scheduledAt:lobbies.scheduledAt,createdAt:lobbies.createdAt,finishedAt:lobbies.finishedAt,partySize:recruits.partySize,pokemon:recruits.pokemon,desiredPokemon:recruits.desiredPokemon,desiredRole:recruits.desiredRole,startTimeUndecided:recruits.startTimeUndecided}).from(lobbies).innerJoin(recruits,eq(lobbies.recruitId,recruits.id)).innerJoin(lobbyMembers,and(eq(lobbyMembers.lobbyId,lobbies.id),eq(lobbyMembers.userId,user.userId),eq(lobbyMembers.status,"active"))).where(or(inArray(lobbies.status,activeLobbyStatuses),gt(lobbies.finishedAt,visibleEndedAfter))).orderBy(desc(lobbies.createdAt)).limit(20);
  const result=[];
  for(const lobby of lobbyRows){
    const members=await db.select({userId:lobbyMembers.userId,trainerName:lobbyMembers.trainerName,pokemon:lobbyMembers.pokemon,ready:lobbyMembers.ready,status:lobbyMembers.status,avatarUrl:profiles.avatarUrl}).from(lobbyMembers).leftJoin(profiles,eq(lobbyMembers.userId,profiles.userId)).where(and(eq(lobbyMembers.lobbyId,lobby.id),eq(lobbyMembers.status,"active")));
    result.push({...lobby,isOwner:lobby.ownerId===user.userId,members:members.map(member=>({...member,avatarUrl:member.avatarUrl||"",isMe:member.userId===user.userId})),active:activeLobbyStatuses.includes(lobby.status)});
  }
  return Response.json({lobbies:result});
}

export async function PATCH(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です"},{status:401});
  if(await isSuspended(user.userId))return Response.json({error:"このアカウントは現在利用できません"},{status:403});
  const payload=await request.json() as {lobbyId?:number;action?:"ready"|"start"|"finish"|"cancel"};
  if(!payload.lobbyId||!payload.action)return Response.json({error:"操作を確認してください"},{status:400});
  const db=getDb();
  const [membership]=await db.select().from(lobbyMembers).where(and(eq(lobbyMembers.lobbyId,payload.lobbyId),eq(lobbyMembers.userId,user.userId),eq(lobbyMembers.status,"active"))).limit(1);
  const [lobby]=await db.select().from(lobbies).where(eq(lobbies.id,payload.lobbyId)).limit(1);
  if(!membership||!lobby)return Response.json({error:"ロビーが見つかりません"},{status:404});
  if(!activeLobbyStatuses.includes(lobby.status))return Response.json({error:"このロビーは終了しています"},{status:409});
  if(payload.action==="ready"){
    const ready=!membership.ready;await db.update(lobbyMembers).set({ready}).where(eq(lobbyMembers.id,membership.id));
    const members=await db.select({ready:lobbyMembers.ready}).from(lobbyMembers).where(and(eq(lobbyMembers.lobbyId,lobby.id),eq(lobbyMembers.status,"active")));
    await db.update(lobbies).set({status:members.length>=2&&members.every(member=>member.ready)?"ready":"forming"}).where(eq(lobbies.id,lobby.id));
    return Response.json({ok:true,ready});
  }
  if(payload.action==="start"){
    if(lobby.ownerId!==user.userId)return Response.json({error:"募集した人だけが開始できます"},{status:403});
    const members=await db.select({ready:lobbyMembers.ready}).from(lobbyMembers).where(and(eq(lobbyMembers.lobbyId,lobby.id),eq(lobbyMembers.status,"active")));
    if(members.length<2||members.some(member=>!member.ready))return Response.json({error:"全員が準備OKになるまで開始できません"},{status:409});
    await db.update(lobbies).set({status:"playing"}).where(eq(lobbies.id,lobby.id));return Response.json({ok:true});
  }
  if(payload.action==="finish"){
    if(lobby.ownerId!==user.userId)return Response.json({error:"募集した人だけが終了できます"},{status:403});
    await db.update(lobbies).set({status:"finished",finishedAt:new Date()}).where(eq(lobbies.id,lobby.id));await db.update(recruits).set({status:"closed"}).where(eq(recruits.id,lobby.recruitId));return Response.json({ok:true});
  }
  if(lobby.ownerId===user.userId){await db.update(lobbies).set({status:"cancelled",finishedAt:new Date()}).where(eq(lobbies.id,lobby.id));await db.update(recruits).set({status:"closed"}).where(eq(recruits.id,lobby.recruitId));return Response.json({ok:true});}
  await db.update(lobbyMembers).set({status:"left",ready:false}).where(eq(lobbyMembers.id,membership.id));
  if(membership.applicationId)await db.update(applications).set({status:"cancelled"}).where(eq(applications.id,membership.applicationId));
  const [recruit]=await db.select().from(recruits).where(eq(recruits.id,lobby.recruitId)).limit(1);
  if(recruit)await db.update(recruits).set({acceptedCount:Math.max(0,recruit.acceptedCount-1),status:recruit.expiresAt>new Date()?"open":"expired"}).where(eq(recruits.id,recruit.id));
  return Response.json({ok:true});
}
