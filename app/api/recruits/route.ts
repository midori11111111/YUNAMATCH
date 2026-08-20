import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { blocks, recruits } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const db = getDb();
  const user = await getChatGPTUser();
  const rows = await db.select({ id:recruits.id, ownerId:recruits.ownerId, trainerName:recruits.trainerName, gender:recruits.gender, pokemon:recruits.pokemon, role:recruits.role, matches:recruits.matches, winRate:recruits.winRate, rank:recruits.rank, playTime:recruits.playTime, note:recruits.note, createdAt:recruits.createdAt }).from(recruits).where(eq(recruits.status,"open")).orderBy(desc(recruits.createdAt)).limit(100);
  if (!user) return Response.json({ recruits: rows.map(({ ownerId: _ownerId, ...row }) => row) });
  const [blockedByMe, blockedMe] = await Promise.all([
    db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, user.userId)),
    db.select({ id: blocks.blockerId }).from(blocks).where(eq(blocks.blockedId, user.userId)),
  ]);
  const hidden = new Set([...blockedByMe, ...blockedMe].map((row) => row.id));
  return Response.json({ recruits: rows.filter((row) => row.ownerId !== user.userId && !hidden.has(row.ownerId)).map(({ ownerId: _ownerId, ...row }) => row) });
}

export async function POST(request:Request) {
  const user=await getChatGPTUser();
  if(!user) return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const p=await request.json() as Record<string,unknown>;
  const required=["trainerName","gender","pokemon","role","rank","playTime","note","contact"];
  if(required.some(k=>typeof p[k]!=="string"||!(p[k] as string).trim())) return Response.json({error:"すべての項目を入力してください"},{status:400});
  const matches=Number(p.matches),winRate=Number(p.winRate);
  if(!Number.isFinite(matches)||matches<0||!Number.isFinite(winRate)||winRate<0||winRate>100) return Response.json({error:"試合数・勝率を確認してください"},{status:400});
  const db=getDb();
  await db.update(recruits).set({status:"closed"}).where(and(eq(recruits.ownerId,user.userId),eq(recruits.status,"open")));
  const [row]=await db.insert(recruits).values({ownerId:user.userId,trainerName:String(p.trainerName).slice(0,24),gender:String(p.gender),pokemon:String(p.pokemon),role:String(p.role),matches:Math.round(matches),winRate,rank:String(p.rank).slice(0,30),playTime:String(p.playTime).slice(0,40),note:String(p.note).slice(0,180),contact:String(p.contact).slice(0,100),createdAt:new Date()}).returning();
  return Response.json({recruit:row},{status:201});
}
