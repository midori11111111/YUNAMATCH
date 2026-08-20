import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { profiles } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const genders = new Set(["男性", "女性"]);
const rates = new Set([
  "エキスパート未満",
  "エキスパート",
  "マスター 1200〜1399",
  "マスター 1400〜1599",
  "マスター 1600〜1799",
  "マスター 1800〜1999",
  "マスター 2000〜",
]);
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

function publicProfile(row:typeof profiles.$inferSelect){
  let mainPokemon:string[]=[];
  try{const parsed=JSON.parse(row.mainPokemon);if(Array.isArray(parsed))mainPokemon=parsed.filter(value=>typeof value==="string").slice(0,5)}catch{/* 不正な旧データは空として扱う */}
  return {trainerName:row.trainerName,mainPokemon,highestRate:row.highestRate,playTime:row.playTime,gender:row.gender,contact:row.contact};
}

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const db=getDb();
  const [row]=await db.select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1);
  return Response.json({profile:row?publicProfile(row):null,suggested:{trainerName:user.displayName.includes("@")?user.displayName.split("@")[0]:user.displayName,contact:contactFor(user.provider,user.contactId)}});
}

export async function PUT(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const body=await request.json() as Record<string,unknown>;
  const trainerName=typeof body.trainerName==="string"?body.trainerName.trim():"";
  const mainPokemon=Array.isArray(body.mainPokemon)?[...new Set(body.mainPokemon.filter((value):value is string=>typeof value==="string"&&Boolean(value.trim())).map(value=>value.trim()))].slice(0,5):[];
  const highestRate=typeof body.highestRate==="string"?body.highestRate:"";
  const playTime=typeof body.playTime==="string"?body.playTime:"";
  const gender=typeof body.gender==="string"?body.gender:"";
  const contact=typeof body.contact==="string"?body.contact.trim().replace(/\s+/g," "):"";
  if(!trainerName||trainerName.length>24||mainPokemon.length===0||!rates.has(highestRate)||!playTimes.has(playTime)||!genders.has(gender)||!contact||contact.length>120)return Response.json({error:"入力内容を確認してください"},{status:400});
  const now=new Date();
  const values={userId:user.userId,trainerName,mainPokemon:JSON.stringify(mainPokemon),highestRate,playTime,gender,contact,authProvider:user.provider,createdAt:now,updatedAt:now};
  const db=getDb();
  await db.insert(profiles).values(values).onConflictDoUpdate({target:profiles.userId,set:{trainerName:values.trainerName,mainPokemon:values.mainPokemon,highestRate:values.highestRate,playTime:values.playTime,gender:values.gender,contact:values.contact,authProvider:values.authProvider,updatedAt:now}});
  const [row]=await db.select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1);
  return Response.json({profile:publicProfile(row)});
}
