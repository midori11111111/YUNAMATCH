import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { applications, recruits } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

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
 const p=await request.json() as {recruitId?:number;applicantName?:string;applicantContact?:string;pokemon?:string;message?:string};
 if(!p.recruitId||!p.applicantName?.trim()||!p.applicantContact?.trim()||!p.pokemon?.trim()||!p.message?.trim())return Response.json({error:"申請内容を入力してください"},{status:400});
 const db=getDb();const [recruit]=await db.select().from(recruits).where(and(eq(recruits.id,p.recruitId),eq(recruits.status,"open"))).limit(1);
 if(!recruit)return Response.json({error:"この募集は終了しています"},{status:404});
 if(recruit.ownerId===user.userId)return Response.json({error:"自分の募集には申請できません"},{status:400});
 const exists=await db.select().from(applications).where(and(eq(applications.recruitId,p.recruitId),eq(applications.applicantId,user.userId))).limit(1);
 if(exists.length)return Response.json({error:"すでに申請済みです"},{status:409});
 await db.insert(applications).values({recruitId:p.recruitId,applicantId:user.userId,applicantName:p.applicantName.slice(0,24),applicantContact:p.applicantContact.slice(0,100),pokemon:p.pokemon,message:p.message.slice(0,180),createdAt:new Date()});
 return Response.json({ok:true});
}

export async function PATCH(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です",signIn},{status:401});
 const p=await request.json() as {applicationId?:number;action?:"accept"|"decline"};
 if(!p.applicationId||!p.action)return Response.json({error:"操作を確認してください"},{status:400});
 const db=getDb();const [row]=await db.select({id:applications.id,recruitId:applications.recruitId,applicantContact:applications.applicantContact}).from(applications).innerJoin(recruits,eq(applications.recruitId,recruits.id)).where(and(eq(applications.id,p.applicationId),eq(recruits.ownerId,user.userId),eq(applications.status,"pending"))).limit(1);
 if(!row)return Response.json({error:"申請が見つからないか、処理済みです"},{status:404});
 const status=p.action==="accept"?"accepted":"declined";
 await db.update(applications).set({status}).where(eq(applications.id,row.id));
 if(status==="accepted")await db.update(recruits).set({status:"closed"}).where(eq(recruits.id,row.recruitId));
 return Response.json({ok:true,status,applicantContact:status==="accepted"?row.applicantContact:null});
}
