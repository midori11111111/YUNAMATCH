import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { blocks, profiles, recruits } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const db = getDb();
  const user = await getChatGPTUser();
  const rows = await db.select({ id:recruits.id, ownerId:recruits.ownerId, trainerName:recruits.trainerName, gender:recruits.gender, pokemon:recruits.pokemon, role:recruits.role, matches:recruits.matches, winRate:recruits.winRate, rank:recruits.rank, playTime:recruits.playTime, note:recruits.note, createdAt:recruits.createdAt }).from(recruits).where(eq(recruits.status,"open")).orderBy(desc(recruits.createdAt)).limit(100);
  const visibleRecruit=(row:typeof rows[number])=>({id:row.id,trainerName:row.trainerName,gender:row.gender,pokemon:row.pokemon,role:row.role,matches:row.matches,winRate:row.winRate,rank:row.rank,playTime:row.playTime,note:row.note,createdAt:row.createdAt});
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
  const p=await request.json() as Record<string,unknown>;
  const required=["pokemon","role"];
  if(required.some(k=>typeof p[k]!=="string"||!(p[k] as string).trim())) return Response.json({error:"すべての項目を入力してください"},{status:400});
  const matches=Number(p.matches),winRate=Number(p.winRate);
  if(!Number.isFinite(matches)||matches<0||!Number.isFinite(winRate)||winRate<0||winRate>100) return Response.json({error:"試合数・勝率を確認してください"},{status:400});
  const db=getDb();
  const [profile]=await db.select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1);
  if(!profile)return Response.json({error:"先にプロフィールを登録してください"},{status:409});
  let profilePlayTimes:string[]=[];
  try{const parsed=JSON.parse(profile.playTime);if(Array.isArray(parsed))profilePlayTimes=parsed.filter(value=>typeof value==="string")}catch{profilePlayTimes=[profile.playTime]}
  await db.update(recruits).set({status:"closed"}).where(and(eq(recruits.ownerId,user.userId),eq(recruits.status,"open")));
  const note=typeof p.note==="string"?p.note.trim().slice(0,180):"";
  const [row]=await db.insert(recruits).values({ownerId:user.userId,trainerName:profile.trainerName,gender:profile.gender,pokemon:String(p.pokemon),role:String(p.role),matches:Math.round(matches),winRate,rank:profile.highestRate,playTime:profilePlayTimes.filter(Boolean).join("・")||profile.playTime,note,contact:profile.contact,createdAt:new Date()}).returning();
  return Response.json({recruit:row},{status:201});
}
