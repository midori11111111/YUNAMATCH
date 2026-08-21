import { and, desc, eq, lt } from "drizzle-orm";
import { getDb } from "../../../db";
import { applications, blocks, lobbies, lobbyMembers, profiles, recruits } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { containsProhibitedContent, prohibitedContentMessage } from "../../../lib/content-policy";

const recruitRoles=new Set(["上レーン","下レーン","中央","キャリー","タンク","サポート","アタック型","バランス型","スピード型","ディフェンス型","サポート型"]);

export async function GET() {
  const db = getDb();
  const user = await getChatGPTUser();
  await db.update(recruits).set({status:"expired"}).where(and(eq(recruits.status,"open"),lt(recruits.expiresAt,new Date())));
  const rows = await db.select({ id:recruits.id, ownerId:recruits.ownerId, trainerName:recruits.trainerName, gender:recruits.gender, pokemon:recruits.pokemon, role:recruits.role, matches:recruits.matches, winRate:recruits.winRate, rank:recruits.rank, playTime:recruits.playTime, note:recruits.note, createdAt:recruits.createdAt, avatarUrl:profiles.avatarUrl, startAt:recruits.startAt, startTimeUndecided:recruits.startTimeUndecided, expiresAt:recruits.expiresAt, partySize:recruits.partySize, desiredPokemon:recruits.desiredPokemon, desiredRole:recruits.desiredRole, acceptedCount:recruits.acceptedCount }).from(recruits).leftJoin(profiles,eq(recruits.ownerId,profiles.userId)).where(and(eq(recruits.status,"open"),eq(recruits.kind,"timed"))).orderBy(desc(recruits.createdAt)).limit(100);
  const visibleRecruit=(row:typeof rows[number])=>({id:row.id,trainerName:row.trainerName,gender:row.gender,pokemon:row.pokemon,role:row.role,matches:row.matches,winRate:row.winRate,rank:row.rank,playTime:row.playTime,note:row.note,createdAt:row.createdAt,avatarUrl:row.avatarUrl||"",startAt:row.startAt,startTimeUndecided:row.startTimeUndecided,expiresAt:row.expiresAt,partySize:row.partySize,desiredPokemon:row.desiredPokemon,desiredRole:row.desiredRole,acceptedCount:row.acceptedCount});
  if (!user) return Response.json({ recruits: rows.map(visibleRecruit), myRecruit:null });
  const [blockedByMe, blockedMe] = await Promise.all([
    db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, user.userId)),
    db.select({ id: blocks.blockerId }).from(blocks).where(eq(blocks.blockedId, user.userId)),
  ]);
  const hidden = new Set([...blockedByMe, ...blockedMe].map((row) => row.id));
  const myRecruit=rows.find((row)=>row.ownerId===user.userId);
  return Response.json({ recruits: rows.filter((row) => row.ownerId !== user.userId && !hidden.has(row.ownerId)).map(visibleRecruit), myRecruit:myRecruit?visibleRecruit(myRecruit):null });
}

export async function POST(request:Request) {
  const user=await getChatGPTUser();
  if(!user) return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const rateLimit=await checkRateLimit(user.userId,{action:"recruit",limit:5,windowMs:60*60_000});
  if(!rateLimit.allowed)return rateLimitResponse(rateLimit.retryAfter);
  const p=await request.json() as Record<string,unknown>;
  const pokemon=typeof p.pokemon==="string"&&p.pokemon.trim()?p.pokemon.trim().slice(0,30):"未定";
  const submittedRoles=Array.isArray(p.roles)?p.roles:typeof p.role==="string"?[p.role]:[];
  const roles=[...new Set(submittedRoles.filter((value):value is string=>typeof value==="string"&&recruitRoles.has(value)))].slice(0,6);
  const role=roles.join("・")||"指定なし";
  const matches=Number(p.matches),winRate=Number(p.winRate);
  if(!Number.isFinite(matches)||matches<0||!Number.isFinite(winRate)||winRate<0||winRate>100) return Response.json({error:"試合数・勝率を確認してください"},{status:400});
  const startTimeUndecided=p.startsIn==="undecided";
  const startsIn=startTimeUndecided?0:Number(p.startsIn),duration=Number(p.duration),partySize=Number(p.partySize);
  if((!startTimeUndecided&&![0,30,60,120].includes(startsIn))||![1,2,3].includes(duration)||![2,3,5].includes(partySize))return Response.json({error:"開始時間・募集時間・人数を確認してください"},{status:400});
  const db=getDb();
  const [profile]=await db.select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1);
  if(!profile)return Response.json({error:"先にプロフィールを登録してください"},{status:409});
  if(profile.suspendedAt)return Response.json({error:"このアカウントは現在利用できません"},{status:403});
  if(!profile.ageConfirmed||!profile.termsAcceptedAt||!profile.contact.trim()||!["男性","女性"].includes(profile.gender))return Response.json({error:"プロフィールの未入力項目を登録してください"},{status:409});
  let profilePlayTimes:string[]=[];
  try{const parsed=JSON.parse(profile.playTime);if(Array.isArray(parsed))profilePlayTimes=parsed.filter(value=>typeof value==="string")}catch{profilePlayTimes=[profile.playTime]}
  await db.update(recruits).set({status:"closed"}).where(and(eq(recruits.ownerId,user.userId),eq(recruits.status,"open")));
  const note=typeof p.note==="string"?p.note.trim().slice(0,180):"";
  if(containsProhibitedContent(note))return Response.json({error:prohibitedContentMessage},{status:400});
  const now=new Date(),startAt=new Date(now.getTime()+startsIn*60_000),expiresAt=new Date((startTimeUndecided?now:startAt).getTime()+duration*3_600_000);
  const desiredPokemon=typeof p.desiredPokemon==="string"&&p.desiredPokemon.trim()?p.desiredPokemon.trim().slice(0,30):"すべて";
  const desiredRole=typeof p.desiredRole==="string"&&p.desiredRole.trim()?p.desiredRole.trim().slice(0,30):"指定なし";
  const [row]=await db.insert(recruits).values({ownerId:user.userId,trainerName:profile.trainerName,gender:profile.gender,pokemon,role,matches:Math.round(matches),winRate,rank:profile.highestRate,playTime:profilePlayTimes.filter(Boolean).join("・")||profile.playTime,note,contact:profile.contact,startAt,startTimeUndecided,expiresAt,partySize,desiredPokemon,desiredRole,createdAt:now}).returning();
  const [lobby]=await db.insert(lobbies).values({recruitId:row.id,ownerId:user.userId,status:"forming",scheduledAt:startAt,createdAt:now}).returning();
  await db.insert(lobbyMembers).values({lobbyId:lobby.id,userId:user.userId,trainerName:profile.trainerName,pokemon:row.pokemon,contact:profile.contact,joinedAt:now});
  return Response.json({recruit:{...row,avatarUrl:profile.avatarUrl}},{status:201});
}

export async function PATCH(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const payload=await request.json() as {recruitId?:number;action?:"cancel"};
  if(!payload.recruitId||payload.action!=="cancel")return Response.json({error:"操作を確認してください"},{status:400});
  const db=getDb();
  const [recruit]=await db.select().from(recruits).where(and(eq(recruits.id,payload.recruitId),eq(recruits.ownerId,user.userId),eq(recruits.status,"open"))).limit(1);
  if(!recruit)return Response.json({error:"公開中の募集が見つかりません"},{status:404});
  const now=new Date();
  await db.update(recruits).set({status:"cancelled"}).where(eq(recruits.id,recruit.id));
  await db.update(applications).set({status:"cancelled"}).where(and(eq(applications.recruitId,recruit.id),eq(applications.status,"pending")));
  await db.update(lobbies).set({status:"cancelled",finishedAt:now}).where(eq(lobbies.recruitId,recruit.id));
  return Response.json({ok:true});
}
