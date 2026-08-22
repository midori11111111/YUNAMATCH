import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { profiles } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { containsProhibitedContent, prohibitedContentMessage } from "../../../lib/content-policy";
import { normalizeRank, rankOptionSet } from "../../../lib/ranks";

const genders = new Set(["男性", "女性"]);
const playTimes = new Set([
  "平日 朝（6〜12時）",
  "平日 昼（12〜18時）",
  "平日 夜（18〜22時）",
  "平日 深夜（22〜翌2時）",
  "土日 朝・昼",
  "土日 夜・深夜",
  "時間帯はいつでも",
]);

function providerLabel(provider:string){
  return provider === "twitter" ? "X" : provider === "discord" ? "Discord" : provider === "line" ? "LINE" : provider === "google" ? "Google" : "ログインアカウント";
}

function contactFor(provider:string, contactId:string){
  return `${providerLabel(provider)}: ${contactId}`.slice(0, 120);
}

function normalizeBio(value:unknown){
  return typeof value==="string"?value.trim().replace(/\r\n?/g,"\n").replace(/\n{3,}/g,"\n\n"):"";
}

function publicProfile(row:typeof profiles.$inferSelect){
  let mainPokemon:string[]=[];
  let playTime:string[]=[];
  try{const parsed=JSON.parse(row.mainPokemon);if(Array.isArray(parsed))mainPokemon=parsed.filter(value=>typeof value==="string").slice(0,5)}catch{if(row.mainPokemon)mainPokemon=[row.mainPokemon]}
  try{const parsed=JSON.parse(row.playTime);if(Array.isArray(parsed))playTime=parsed.filter(value=>typeof value==="string"&&playTimes.has(value)).slice(0,7)}catch{if(playTimes.has(row.playTime))playTime=[row.playTime]}
  return {trainerName:row.trainerName,mainPokemon,highestRate:normalizeRank(row.highestRate),playTime,gender:row.gender,contact:row.contact,bio:row.bio||"",avatarUrl:row.avatarUrl,headerUrl:row.headerUrl||"",age:row.age,ageConfirmed:row.ageConfirmed,termsAccepted:Boolean(row.termsAcceptedAt)};
}

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const db=getDb();
  const [row]=await db.select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1);
  if(row?.suspendedAt)return Response.json({error:"このアカウントは現在利用できません",suspended:true},{status:403});
  return Response.json({profile:row?publicProfile(row):null,suggested:{trainerName:user.displayName.includes("@")?user.displayName.split("@")[0]:user.displayName,contact:contactFor(user.provider,user.contactId)}});
}

export async function PUT(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const rateLimit=await checkRateLimit(user.userId,{action:"profile",limit:10,windowMs:10*60_000});
  if(!rateLimit.allowed)return rateLimitResponse(rateLimit.retryAfter);
  const body=await request.json() as Record<string,unknown>;
  const trainerName=typeof body.trainerName==="string"?body.trainerName.trim():"";
  const mainPokemon=Array.isArray(body.mainPokemon)?[...new Set(body.mainPokemon.filter((value):value is string=>typeof value==="string"&&Boolean(value.trim())).map(value=>value.trim()))].slice(0,5):[];
  const highestRate=typeof body.highestRate==="string"?normalizeRank(body.highestRate):"";
  const playTime=Array.isArray(body.playTime)?[...new Set(body.playTime.filter((value):value is string=>typeof value==="string"&&playTimes.has(value)))].slice(0,7):typeof body.playTime==="string"&&playTimes.has(body.playTime)?[body.playTime]:[];
  const gender=typeof body.gender==="string"?body.gender:"";
  const contact=typeof body.contact==="string"?body.contact.trim().replace(/\s+/g," "):"";
  const bio=normalizeBio(body.bio);
  const avatarUrl=typeof body.avatarUrl==="string"?body.avatarUrl:"";
  const headerUrl=typeof body.headerUrl==="string"?body.headerUrl:"";
  const validAvatar=!avatarUrl||/^\/api\/media\/avatar\/[a-f0-9]{64}\?v=\d+$/.test(avatarUrl)||(avatarUrl.length<=500_000&&/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(avatarUrl));
  const validHeader=!headerUrl||/^\/api\/media\/header\/[a-f0-9]{64}\?v=\d+$/.test(headerUrl)||(headerUrl.length<=700_000&&/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(headerUrl));
  const age=typeof body.age==="number"&&Number.isInteger(body.age)?body.age:null;
  const ageConfirmed=age!==null&&age>=18?true:body.ageConfirmed===true;
  const termsAccepted=body.termsAccepted===true;
  if(containsProhibitedContent(trainerName)||containsProhibitedContent(bio))return Response.json({error:prohibitedContentMessage},{status:400});
  if(!trainerName||trainerName.length>24||mainPokemon.length===0||!rankOptionSet.has(highestRate)||playTime.length===0||!genders.has(gender)||contact.length>120||bio.length>160||!validAvatar||!validHeader||age===null||age<13||age>99||!ageConfirmed||!termsAccepted)return Response.json({error:"年齢を含む入力内容と利用条件への同意を確認してください"},{status:400});
  const now=new Date();
  const values={userId:user.userId,trainerName,mainPokemon:JSON.stringify(mainPokemon),highestRate,playTime:JSON.stringify(playTime),gender,contact,bio,avatarUrl,headerUrl,age,ageConfirmed,termsAcceptedAt:now,authProvider:user.provider,createdAt:now,updatedAt:now};
  const db=getDb();
  await db.insert(profiles).values(values).onConflictDoUpdate({target:profiles.userId,set:{trainerName:values.trainerName,mainPokemon:values.mainPokemon,highestRate:values.highestRate,playTime:values.playTime,gender:values.gender,contact:values.contact,bio:values.bio,avatarUrl:values.avatarUrl,headerUrl:values.headerUrl,age:values.age,ageConfirmed:values.ageConfirmed,termsAcceptedAt:now,authProvider:values.authProvider,updatedAt:now}});
  const [row]=await db.select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1);
  return Response.json({profile:publicProfile(row)});
}

async function avatarId(userId:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(userId));
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,"0")).join("");
}

export async function DELETE(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const payload=await request.json().catch(()=>({})) as {confirmation?:string};
  if(payload.confirmation!=="退会する")return Response.json({error:"確認欄に「退会する」と入力してください"},{status:400});
  const d1=env.DB;
  const id=user.userId;
  await d1.batch([
    d1.prepare("DELETE FROM connection_ratings WHERE rater_id = ? OR rated_user_id = ?").bind(id,id),
    d1.prepare("DELETE FROM message_favorites WHERE user_id = ? OR connection_id IN (SELECT id FROM connections WHERE user_a_id = ? OR user_b_id = ?)").bind(id,id,id),
    d1.prepare("DELETE FROM messages WHERE connection_id IN (SELECT id FROM connections WHERE user_a_id = ? OR user_b_id = ?)").bind(id,id),
    d1.prepare("DELETE FROM presence WHERE user_id = ?").bind(id),
    d1.prepare("DELETE FROM lobby_members WHERE user_id = ? OR lobby_id IN (SELECT id FROM lobbies WHERE owner_id = ?)").bind(id,id),
    d1.prepare("DELETE FROM lobbies WHERE owner_id = ?").bind(id),
    d1.prepare("DELETE FROM connections WHERE user_a_id = ? OR user_b_id = ?").bind(id,id),
    d1.prepare("DELETE FROM application_messages WHERE sender_id = ? OR application_id IN (SELECT applications.id FROM applications INNER JOIN recruits ON applications.recruit_id = recruits.id WHERE applications.applicant_id = ? OR recruits.owner_id = ?)").bind(id,id,id),
    d1.prepare("DELETE FROM applications WHERE applicant_id = ? OR recruit_id IN (SELECT id FROM recruits WHERE owner_id = ?)").bind(id,id),
    d1.prepare("DELETE FROM reports WHERE reporter_id = ? OR target_id = ?").bind(id,id),
    d1.prepare("DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?").bind(id,id),
    d1.prepare("DELETE FROM profile_likes WHERE sender_id = ? OR recipient_id = ?").bind(id,id),
    d1.prepare("DELETE FROM notification_dismissals WHERE user_id = ?").bind(id),
    d1.prepare("DELETE FROM support_tickets WHERE user_id = ?").bind(id),
    d1.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").bind(id),
    d1.prepare("DELETE FROM recruits WHERE owner_id = ?").bind(id),
    d1.prepare("DELETE FROM account_links WHERE canonical_user_id = ?").bind(id),
    d1.prepare("UPDATE site_visitors SET user_id = NULL WHERE user_id = ?").bind(id),
    d1.prepare("DELETE FROM rate_limit_buckets WHERE substr(key, -length(?)) = ?").bind(id,id),
    d1.prepare("DELETE FROM profiles WHERE user_id = ?").bind(id),
  ]);
  const media=(env as unknown as {MEDIA?:R2Bucket}).MEDIA;
  if(media)await Promise.all([media.delete(`avatars/${await avatarId(id)}`),media.delete(`headers/${await avatarId(id)}`)]);
  return Response.json({ok:true});
}
