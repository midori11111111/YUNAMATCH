import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accountLinks, lobbies, lobbyMembers, profiles, recruits } from "../../../../db/schema";

const json=(data:unknown,status=200)=>Response.json(data,{status});
const bytes=(hex:string)=>Uint8Array.from(hex.match(/.{2}/g)?.map(value=>parseInt(value,16))||[]);

async function verify(request:Request,body:string){
  const signature=request.headers.get("x-signature-ed25519"),timestamp=request.headers.get("x-signature-timestamp"),publicKey=process.env.DISCORD_PUBLIC_KEY;
  if(!signature||!timestamp||!publicKey)return false;
  try{const key=await crypto.subtle.importKey("raw",bytes(publicKey),{name:"Ed25519"},false,["verify"]);return crypto.subtle.verify("Ed25519",key,bytes(signature),new TextEncoder().encode(timestamp+body))}catch{return false}
}

export async function POST(request:Request){
  const raw=await request.text();if(!await verify(request,raw))return new Response("invalid request signature",{status:401});
  const interaction=JSON.parse(raw) as {type:number;member?:{user?:{id?:string}};user?:{id?:string};data?:{options?:Array<{name:string;value:string|number}>}};
  if(interaction.type===1)return json({type:1});
  if(interaction.type!==2)return json({type:4,data:{content:"対応していない操作です",flags:64}});
  const discordId=interaction.member?.user?.id||interaction.user?.id;if(!discordId)return json({type:4,data:{content:"Discordアカウントを確認できませんでした",flags:64}});
  const db=getDb();const [linked]=await db.select().from(accountLinks).where(and(eq(accountLinks.provider,"discord"),eq(accountLinks.providerAccountId,discordId))).limit(1);
  if(!linked)return json({type:4,data:{content:"先にYUNAMATCHのマイページで、このDiscordアカウントを連携してください。",flags:64}});
  const [profile]=await db.select().from(profiles).where(eq(profiles.userId,linked.canonicalUserId)).limit(1);if(!profile||profile.suspendedAt)return json({type:4,data:{content:"利用できるYUNAMATCHプロフィールが見つかりません。",flags:64}});
  const options=Object.fromEntries((interaction.data?.options||[]).map(option=>[option.name,option.value]));
  const pokemon=String(options.pokemon||"").trim(),role=String(options.role||"指定なし"),partySize=Number(options.party_size||2),startsIn=Number(options.starts_in||0),duration=Number(options.duration||2),matches=Number(options.matches||0),winRate=Number(options.win_rate||50);
  if(!pokemon||![2,3,5].includes(partySize)||![0,30,60,120].includes(startsIn)||![1,2,3].includes(duration))return json({type:4,data:{content:"募集条件を確認してください。",flags:64}});
  const now=new Date(),startAt=new Date(now.getTime()+startsIn*60_000),expiresAt=new Date(startAt.getTime()+duration*3_600_000);let playTime="";try{playTime=(JSON.parse(profile.playTime) as string[]).join("・")}catch{playTime=profile.playTime}
  await db.update(recruits).set({status:"closed"}).where(and(eq(recruits.ownerId,profile.userId),eq(recruits.status,"open")));
  const [recruit]=await db.insert(recruits).values({ownerId:profile.userId,trainerName:profile.trainerName,gender:profile.gender,pokemon,role,matches:Math.max(0,Math.round(matches)),winRate:Math.min(100,Math.max(0,winRate)),rank:profile.highestRate,playTime,note:"Discordから募集中",contact:profile.contact,startAt,expiresAt,partySize,desiredPokemon:"すべて",desiredRole:"指定なし",createdAt:now}).returning();
  const [lobby]=await db.insert(lobbies).values({recruitId:recruit.id,ownerId:profile.userId,status:"forming",scheduledAt:startAt,createdAt:now}).returning();await db.insert(lobbyMembers).values({lobbyId:lobby.id,userId:profile.userId,trainerName:profile.trainerName,pokemon,contact:profile.contact,joinedAt:now});
  const url=`https://yunamatch.vercel.app/?recruit=${recruit.id}`;const startLabel=startsIn===0?"今から":`${startsIn}分後`;
  return json({type:4,data:{content:`⚡ **${profile.trainerName}さんがユナイト仲間を募集！**\n${pokemon} / ${role}\n${startLabel}開始・${partySize}人・${duration}時間募集\n参加申請は下のボタンから`,components:[{type:1,components:[{type:2,style:5,label:"YUNAMATCHで参加申請",url}]}]}});
}
