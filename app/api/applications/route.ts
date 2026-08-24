import { and, desc, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import { applicationMessages, applications, connections, messages, profiles, recruits } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { sendPush } from "../../../lib/push";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { containsProhibitedContent, prohibitedContentMessage } from "../../../lib/content-policy";
import { runInBackground } from "../../../lib/background";

const signIn = "/login";
const historyPageSize = 50;

function cursor(value: string | null) {
 const parsed=Number(value);
 return Number.isInteger(parsed)&&parsed>0?parsed:null;
}

function parseList(value: string) {
 try {
  const parsed=JSON.parse(value);
  return Array.isArray(parsed)?parsed.filter((item):item is string=>typeof item==="string"):[];
 } catch {
  return value?[value]:[];
 }
}

function publicProfile(row: typeof profiles.$inferSelect | undefined, fallbackName: string) {
 return {
  trainerName:row?.trainerName||fallbackName,
  avatarUrl:row?.avatarUrl||"",
  headerUrl:row?.headerUrl||"",
  bio:row?.bio||"",
  mainPokemon:row?parseList(row.mainPokemon):[],
  highestRate:row?.highestRate||"未設定",
  playTime:row?parseList(row.playTime):[],
  gender:row?.gender||"",
  age:row?.age??null,
 };
}

export async function GET(request:Request){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:"ログインが必要です",signIn},{status:401});
 const db=getDb();
 const params=new URL(request.url).searchParams;
 const beforeIncoming=cursor(params.get("beforeIncoming"));
 const beforeOutgoing=cursor(params.get("beforeOutgoing"));
 const incomingFields={id:applications.id,recruitId:applications.recruitId,applicantId:applications.applicantId,applicantName:applications.applicantName,pokemon:applications.pokemon,message:applications.message,status:applications.status,decisionMessage:applications.decisionMessage,recruitPokemon:recruits.pokemon,createdAt:applications.createdAt};
 const outgoingFields={id:applications.id,recruitId:applications.recruitId,ownerId:recruits.ownerId,trainerName:recruits.trainerName,pokemon:applications.pokemon,message:applications.message,status:applications.status,decisionMessage:applications.decisionMessage,recruitPokemon:recruits.pokemon,createdAt:applications.createdAt};
 const [pendingIncoming,pendingOutgoing,incomingHistoryRows,outgoingHistoryRows]=await Promise.all([
  db.select(incomingFields).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(and(eq(recruits.ownerId,user.userId),eq(applications.status,"pending"))).orderBy(desc(applications.createdAt),desc(applications.id)),
  db.select(outgoingFields).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(and(eq(applications.applicantId,user.userId),eq(applications.status,"pending"))).orderBy(desc(applications.createdAt),desc(applications.id)),
  db.select(incomingFields).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(and(eq(recruits.ownerId,user.userId),ne(applications.status,"pending"),beforeIncoming?lt(applications.id,beforeIncoming):undefined)).orderBy(desc(applications.createdAt),desc(applications.id)).limit(historyPageSize+1),
  db.select(outgoingFields).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(and(eq(applications.applicantId,user.userId),ne(applications.status,"pending"),beforeOutgoing?lt(applications.id,beforeOutgoing):undefined)).orderBy(desc(applications.createdAt),desc(applications.id)).limit(historyPageSize+1),
 ]);
 const incomingHistory=incomingHistoryRows.slice(0,historyPageSize);
 const outgoingHistory=outgoingHistoryRows.slice(0,historyPageSize);
 const mateIds=[...new Set([
  ...pendingIncoming.map((row)=>row.applicantId),
  ...pendingOutgoing.map((row)=>row.ownerId),
 ])];
 const mateProfiles=mateIds.length?await db.select().from(profiles).where(inArray(profiles.userId,mateIds)):[];
 const profileByUserId=new Map(mateProfiles.map((row)=>[row.userId,row]));
 return Response.json({
  incoming:[
   ...pendingIncoming.map((row)=>({...row,mateProfile:publicProfile(profileByUserId.get(row.applicantId),row.applicantName)})),
   ...incomingHistory,
  ],
  outgoing:[
   ...pendingOutgoing.map((row)=>({...row,mateProfile:publicProfile(profileByUserId.get(row.ownerId),row.trainerName)})),
   ...outgoingHistory,
  ],
  hasMoreIncoming:incomingHistoryRows.length>historyPageSize,
  hasMoreOutgoing:outgoingHistoryRows.length>historyPageSize,
  nextIncomingCursor:incomingHistory.at(-1)?.id??null,
  nextOutgoingCursor:outgoingHistory.at(-1)?.id??null,
 });
}

export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です",signIn},{status:401});
 const rateLimit=await checkRateLimit(user.userId,{action:"application",limit:15,windowMs:10*60_000});if(!rateLimit.allowed)return rateLimitResponse(rateLimit.retryAfter);
 const p=await request.json() as {recruitId?:number;pokemon?:string;message?:string};
 if(!p.recruitId||!p.pokemon?.trim()||!p.message?.trim())return Response.json({error:"申請内容を入力してください"},{status:400});
 if(containsProhibitedContent(p.message))return Response.json({error:prohibitedContentMessage},{status:400});
 const db=getDb();const [[recruit],[profile]]=await Promise.all([db.select().from(recruits).where(and(eq(recruits.id,p.recruitId),eq(recruits.status,"open"),gt(recruits.expiresAt,new Date()))).limit(1),db.select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1)]);
 if(!recruit)return Response.json({error:"この募集は終了しています"},{status:404});
 if(!profile)return Response.json({error:"先にプロフィールを登録してください"},{status:409});
 if(profile.suspendedAt)return Response.json({error:"このアカウントは現在利用できません"},{status:403});
 if(!profile.ageConfirmed||!profile.termsAcceptedAt||!["男性","女性"].includes(profile.gender))return Response.json({error:"プロフィールの未入力項目を登録してください"},{status:409});
 if(recruit.acceptedCount>=recruit.partySize-1)return Response.json({error:"この募集は満員です"},{status:409});
 if(recruit.ownerId===user.userId)return Response.json({error:"自分の募集には申請できません"},{status:400});
 const exists=await db.select().from(applications).where(and(eq(applications.recruitId,p.recruitId),eq(applications.applicantId,user.userId))).limit(1);
 if(exists.length)return Response.json({error:"すでに申請済みです"},{status:409});
 const [application]=await db.insert(applications).values({recruitId:p.recruitId,applicantId:user.userId,applicantName:profile.trainerName,applicantContact:"",pokemon:p.pokemon,message:p.message.slice(0,180),createdAt:new Date()}).returning();
 const pokemonText=p.pokemon==="指定なし"?"使うポケモンを相談して一緒に遊びたい":`${p.pokemon}で一緒に遊びたい`;
 runInBackground(sendPush(recruit.ownerId,"👋 手を振っています",`${profile.trainerName}さんが${pokemonText}と送っています`,"/"),"Application push");
 return Response.json({ok:true,application:{id:application.id,recruitId:application.recruitId,trainerName:recruit.trainerName,pokemon:application.pokemon,message:application.message,status:application.status,createdAt:application.createdAt}});
}

export async function PATCH(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です",signIn},{status:401});
 const p=await request.json() as {applicationId?:number;action?:"accept"|"decline"|"cancel";decisionMessage?:string};
 if(!p.applicationId||!p.action||!["accept","decline","cancel"].includes(p.action))return Response.json({error:"操作を確認してください"},{status:400});
 const decisionMessage=typeof p.decisionMessage==="string"?p.decisionMessage.trim().slice(0,180):"";
 if(p.action==="decline"&&containsProhibitedContent(decisionMessage))return Response.json({error:prohibitedContentMessage},{status:400});
 const db=getDb();
 if(p.action==="cancel"){
  const [row]=await db.select({id:applications.id,applicantName:applications.applicantName,ownerId:recruits.ownerId,ownerName:recruits.trainerName}).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(and(eq(applications.id,p.applicationId),eq(applications.applicantId,user.userId),eq(applications.status,"pending"))).limit(1);
  if(!row)return Response.json({error:"申請が見つからないか、すでに処理されています"},{status:404});
  const cancelled=await db.update(applications).set({status:"cancelled",decisionMessage:"申請者が取り消しました"}).where(and(eq(applications.id,row.id),eq(applications.applicantId,user.userId),eq(applications.status,"pending"))).returning({id:applications.id});
  if(!cancelled.length)return Response.json({error:"この申請はすでに処理されています"},{status:409});
  runInBackground(sendPush(row.ownerId,"申請が取り消されました",`${row.applicantName}さんがメイト申請を取り消しました`,"/"),"Application cancelled push");
  return Response.json({ok:true,status:"cancelled"});
 }
 const [row]=await db.select({id:applications.id,recruitId:applications.recruitId,applicantId:applications.applicantId,applicantName:applications.applicantName,applicantPokemon:applications.pokemon,applicationMessage:applications.message,applicationCreatedAt:applications.createdAt,ownerId:recruits.ownerId,ownerName:recruits.trainerName,ownerPokemon:recruits.pokemon,partySize:recruits.partySize,acceptedCount:recruits.acceptedCount,startAt:recruits.startAt}).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(and(eq(applications.id,p.applicationId),eq(recruits.ownerId,user.userId),eq(applications.status,"pending"))).limit(1);
 if(!row)return Response.json({error:"申請が見つからないか、処理済みです"},{status:404});
 if(p.action==="accept"&&row.acceptedCount>=row.partySize-1)return Response.json({error:"すでに募集人数に達しています"},{status:409});
 const status=p.action==="accept"?"accepted":"declined";
 const finalDecisionMessage=decisionMessage||"今回は募集条件が合わなかったため、見送ります。また機会があればお願いします！";
 await db.update(applications).set({status,decisionMessage:status==="declined"?finalDecisionMessage:""}).where(eq(applications.id,row.id));
 if(status==="accepted"){
  const nextAccepted=row.acceptedCount+1;
  await db.update(recruits).set({acceptedCount:nextAccepted,status:nextAccepted>=row.partySize-1?"closed":"open"}).where(eq(recruits.id,row.recruitId));
  const now=new Date();
  const [connection]=await db.insert(connections).values({applicationId:row.id,recruitId:row.recruitId,userAId:row.ownerId,userBId:row.applicantId,userAName:row.ownerName,userBName:row.applicantName,userAPokemon:row.ownerPokemon,userBPokemon:row.applicantPokemon,userAContact:"",userBContact:"",createdAt:now}).onConflictDoNothing().returning();
  const [savedConnection]=connection?[connection]:await db.select().from(connections).where(eq(connections.applicationId,row.id)).limit(1);
  if(savedConnection){
   await db.insert(messages).values({connectionId:savedConnection.id,senderId:row.applicantId,clientId:`match-wave-${row.id}`,body:`👋 ${row.applicationMessage}`,createdAt:row.applicationCreatedAt}).onConflictDoNothing();
   const preChat=(await db.select().from(applicationMessages).where(eq(applicationMessages.applicationId,row.id)).orderBy(desc(applicationMessages.createdAt),desc(applicationMessages.id)).limit(100)).reverse();
   for(const item of preChat)await db.insert(messages).values({connectionId:savedConnection.id,senderId:item.senderId,clientId:`application-chat-${item.id}`,body:item.body,createdAt:item.createdAt}).onConflictDoNothing();
  }
  runInBackground(sendPush(row.applicantId,"マッチ成立！",`${row.ownerName}さんとのチャットが開通しました`,`/?chat=${savedConnection?.id}`),"Application accepted push");
  return Response.json({ok:true,status,applicantContact:null,connectionId:savedConnection?.id,mateName:row.applicantName,matePokemon:row.applicantPokemon});
 }
 runInBackground(sendPush(row.applicantId,"申請についてお知らせ",finalDecisionMessage,"/"),"Application declined push");
 return Response.json({ok:true,status,decisionMessage:finalDecisionMessage,applicantContact:null});
}
