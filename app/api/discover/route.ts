import { and, desc, eq, or } from "drizzle-orm";
import { applications, blocks, connections, profiles, recruits } from "../../../db/schema";
import { getDb } from "../../../db";
import { getChatGPTUser } from "../../chatgpt-auth";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { containsProhibitedContent, prohibitedContentMessage } from "../../../lib/content-policy";
import { sendPush } from "../../../lib/push";
import { profilePublicId } from "../../../lib/profile-id";

function parseList(value:string){
  try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed.filter((item):item is string=>typeof item==="string"&&Boolean(item.trim()))}
  catch{/* 旧形式は1件として扱う */}
  return value.trim()?[value.trim()]:[];
}

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const db=getDb();
  const [me]=await db.select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1);
  if(!me)return Response.json({profiles:[]});
  const [profileRows,blockedByMe,blockedMe,connectionRows,pendingRows]=await Promise.all([
    db.select().from(profiles).orderBy(desc(profiles.updatedAt)).limit(150),
    db.select({id:blocks.blockedId}).from(blocks).where(eq(blocks.blockerId,user.userId)),
    db.select({id:blocks.blockerId}).from(blocks).where(eq(blocks.blockedId,user.userId)),
    db.select({userAId:connections.userAId,userBId:connections.userBId}).from(connections).where(or(eq(connections.userAId,user.userId),eq(connections.userBId,user.userId))),
    db.select({ownerId:recruits.ownerId}).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(and(eq(applications.applicantId,user.userId),eq(applications.status,"pending"),eq(recruits.kind,"profile"))),
  ]);
  const hidden=new Set<string>([user.userId,...blockedByMe.map(row=>row.id),...blockedMe.map(row=>row.id),...pendingRows.map(row=>row.ownerId)]);
  for(const row of connectionRows)hidden.add(row.userAId===user.userId?row.userBId:row.userAId);
  const visible=profileRows.filter(row=>!row.suspendedAt&&!hidden.has(row.userId)&&row.ageConfirmed&&row.termsAcceptedAt);
  const prioritized=me.gender==="男性"
    ? [...visible].sort((a,b)=>Number(b.gender==="女性")-Number(a.gender==="女性"))
    : visible;
  const result=await Promise.all(prioritized.map(async row=>({
    id:await profilePublicId(row.userId),
    trainerName:row.trainerName,
    mainPokemon:parseList(row.mainPokemon).slice(0,5),
    highestRate:row.highestRate,
    playTime:parseList(row.playTime).slice(0,7),
    gender:row.gender,
    avatarUrl:row.avatarUrl||"",
    registeredAt:row.createdAt,
  })));
  return Response.json({profiles:result});
}

export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const rateLimit=await checkRateLimit(user.userId,{action:"profile-match",limit:15,windowMs:10*60_000});
  if(!rateLimit.allowed)return rateLimitResponse(rateLimit.retryAfter);
  const body=await request.json() as {targetId?:string;pokemon?:string;message?:string};
  const targetId=typeof body.targetId==="string"?body.targetId:"";
  const pokemon=typeof body.pokemon==="string"?body.pokemon.trim():"";
  const message=typeof body.message==="string"?body.message.trim():"";
  if(!/^[a-f0-9]{32}$/.test(targetId)||!pokemon||!message)return Response.json({error:"申請内容を確認してください"},{status:400});
  if(message.length>180||containsProhibitedContent(message))return Response.json({error:containsProhibitedContent(message)?prohibitedContentMessage:"メッセージは180文字以内にしてください"},{status:400});
  const db=getDb();
  const [profileRows,[applicant]]=await Promise.all([db.select().from(profiles).limit(300),db.select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1)]);
  if(!applicant)return Response.json({error:"先にプロフィールを登録してください"},{status:409});
  const pairs=await Promise.all(profileRows.map(async row=>({row,id:await profilePublicId(row.userId)})));
  const target=pairs.find(item=>item.id===targetId)?.row;
  if(!target||target.suspendedAt||target.userId===user.userId)return Response.json({error:"このプロフィールは現在表示できません"},{status:404});
  const [blocked,connected,pending]=await Promise.all([
    db.select().from(blocks).where(or(and(eq(blocks.blockerId,user.userId),eq(blocks.blockedId,target.userId)),and(eq(blocks.blockerId,target.userId),eq(blocks.blockedId,user.userId)))).limit(1),
    db.select().from(connections).where(or(and(eq(connections.userAId,user.userId),eq(connections.userBId,target.userId)),and(eq(connections.userAId,target.userId),eq(connections.userBId,user.userId)))).limit(1),
    db.select({id:applications.id}).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(and(eq(applications.applicantId,user.userId),eq(recruits.ownerId,target.userId),eq(recruits.kind,"profile"),eq(applications.status,"pending"))).limit(1),
  ]);
  if(blocked.length)return Response.json({error:"このプロフィールには申請できません"},{status:403});
  if(connected.length)return Response.json({error:"すでにマッチしています"},{status:409});
  if(pending.length)return Response.json({error:"すでに申請済みです"},{status:409});
  const targetPokemon=parseList(target.mainPokemon)[0]||"未設定";
  const now=new Date();
  const expiresAt=new Date(now.getTime()+7*24*60*60_000);
  const [recruit]=await db.insert(recruits).values({kind:"profile",ownerId:target.userId,trainerName:target.trainerName,gender:target.gender,pokemon:targetPokemon,role:"プロフィール",matches:0,winRate:0,rank:target.highestRate,playTime:parseList(target.playTime).join("・"),note:"",contact:target.contact,startAt:now,expiresAt,partySize:2,desiredPokemon:pokemon,desiredRole:"プロフィールマッチ",createdAt:now}).returning();
  await db.insert(applications).values({recruitId:recruit.id,applicantId:user.userId,applicantName:applicant.trainerName,applicantContact:applicant.contact,pokemon,message,createdAt:now});
  await sendPush(target.userId,"メイト申請が届きました",`${applicant.trainerName}さんがプロフィールから一緒に遊びたいと送っています`,"/");
  return Response.json({ok:true},{status:201});
}
