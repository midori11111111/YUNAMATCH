import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { applications, connections, lobbies, lobbyMembers, profiles, recruits } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { sendPush } from "../../../lib/push";

const signIn = "/login";

export async function GET(){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:"ログインが必要です",signIn},{status:401});
 const db=getDb();
 const incoming=await db.select({id:applications.id,applicantName:applications.applicantName,applicantContact:applications.applicantContact,pokemon:applications.pokemon,message:applications.message,status:applications.status,recruitPokemon:recruits.pokemon}).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(eq(recruits.ownerId,user.userId)).orderBy(desc(applications.createdAt)).limit(50);
 const outgoingRows=await db.select({id:applications.id,trainerName:recruits.trainerName,pokemon:recruits.pokemon,status:applications.status,ownerContact:recruits.contact}).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(eq(applications.applicantId,user.userId)).orderBy(desc(applications.createdAt)).limit(50);
 const outgoing=outgoingRows.map(row=>({...row,ownerContact:row.status==="accepted"?row.ownerContact:null}));
 return Response.json({incoming,outgoing});
}

export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です",signIn},{status:401});
 const p=await request.json() as {recruitId?:number;pokemon?:string;message?:string};
 if(!p.recruitId||!p.pokemon?.trim()||!p.message?.trim())return Response.json({error:"申請内容を入力してください"},{status:400});
 const db=getDb();const [[recruit],[profile]]=await Promise.all([db.select().from(recruits).where(and(eq(recruits.id,p.recruitId),eq(recruits.status,"open"),gt(recruits.expiresAt,new Date()))).limit(1),db.select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1)]);
 if(!recruit)return Response.json({error:"この募集は終了しています"},{status:404});
 if(!profile)return Response.json({error:"先にプロフィールを登録してください"},{status:409});
 if(profile.suspendedAt)return Response.json({error:"このアカウントは現在利用できません"},{status:403});
 if(recruit.acceptedCount>=recruit.partySize-1)return Response.json({error:"この募集は満員です"},{status:409});
 if(recruit.ownerId===user.userId)return Response.json({error:"自分の募集には申請できません"},{status:400});
 const exists=await db.select().from(applications).where(and(eq(applications.recruitId,p.recruitId),eq(applications.applicantId,user.userId))).limit(1);
 if(exists.length)return Response.json({error:"すでに申請済みです"},{status:409});
 await db.insert(applications).values({recruitId:p.recruitId,applicantId:user.userId,applicantName:profile.trainerName,applicantContact:profile.contact,pokemon:p.pokemon,message:p.message.slice(0,180),createdAt:new Date()});
 await sendPush(recruit.ownerId,"プレイ申請が届きました",`${profile.trainerName}さんが${p.pokemon}で参加を希望しています`,`/?recruit=${recruit.id}`);
 return Response.json({ok:true});
}

export async function PATCH(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です",signIn},{status:401});
 const p=await request.json() as {applicationId?:number;action?:"accept"|"decline"};
 if(!p.applicationId||!p.action)return Response.json({error:"操作を確認してください"},{status:400});
 const db=getDb();const [row]=await db.select({id:applications.id,recruitId:applications.recruitId,applicantId:applications.applicantId,applicantName:applications.applicantName,applicantContact:applications.applicantContact,applicantPokemon:applications.pokemon,ownerId:recruits.ownerId,ownerName:recruits.trainerName,ownerContact:recruits.contact,ownerPokemon:recruits.pokemon,partySize:recruits.partySize,acceptedCount:recruits.acceptedCount,startAt:recruits.startAt}).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(and(eq(applications.id,p.applicationId),eq(recruits.ownerId,user.userId),eq(applications.status,"pending"))).limit(1);
 if(!row)return Response.json({error:"申請が見つからないか、処理済みです"},{status:404});
 if(p.action==="accept"&&row.acceptedCount>=row.partySize-1)return Response.json({error:"すでに募集人数に達しています"},{status:409});
 const status=p.action==="accept"?"accepted":"declined";
 await db.update(applications).set({status}).where(eq(applications.id,row.id));
 if(status==="accepted"){
  const nextAccepted=row.acceptedCount+1;
  await db.update(recruits).set({acceptedCount:nextAccepted,status:nextAccepted>=row.partySize-1?"closed":"open"}).where(eq(recruits.id,row.recruitId));
  const now=new Date();
  const [connection]=await db.insert(connections).values({applicationId:row.id,recruitId:row.recruitId,userAId:row.ownerId,userBId:row.applicantId,userAName:row.ownerName,userBName:row.applicantName,userAPokemon:row.ownerPokemon,userBPokemon:row.applicantPokemon,userAContact:row.ownerContact,userBContact:row.applicantContact,createdAt:now}).onConflictDoNothing().returning();
  let [lobby]=await db.select().from(lobbies).where(eq(lobbies.recruitId,row.recruitId)).limit(1);
  if(!lobby){[lobby]=await db.insert(lobbies).values({recruitId:row.recruitId,ownerId:row.ownerId,status:"forming",scheduledAt:row.startAt,createdAt:now}).returning();await db.insert(lobbyMembers).values({lobbyId:lobby.id,userId:row.ownerId,trainerName:row.ownerName,pokemon:row.ownerPokemon,contact:row.ownerContact,joinedAt:now}).onConflictDoNothing()}
  await db.insert(lobbyMembers).values({lobbyId:lobby.id,userId:row.applicantId,applicationId:row.id,connectionId:connection?.id,trainerName:row.applicantName,pokemon:row.applicantPokemon,contact:row.applicantContact,joinedAt:now}).onConflictDoNothing();
  await sendPush(row.applicantId,"マッチ成立！",`${row.ownerName}さんの集合ロビーに参加しました`,`/?lobby=${lobby.id}`);
  return Response.json({ok:true,status,applicantContact:row.applicantContact,lobbyId:lobby.id});
 }
 return Response.json({ok:true,status,applicantContact:status==="accepted"?row.applicantContact:null});
}
