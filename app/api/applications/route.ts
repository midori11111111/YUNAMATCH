import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { applications, recruits } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です",signIn:"/signin-with-chatgpt?return_to=%2F"},{status:401});
 const p=await request.json() as {recruitId?:number;applicantName?:string;pokemon?:string;message?:string};
 if(!p.recruitId||!p.applicantName?.trim()||!p.pokemon?.trim()||!p.message?.trim())return Response.json({error:"申請内容を入力してください"},{status:400});
 const db=getDb();const [recruit]=await db.select().from(recruits).where(and(eq(recruits.id,p.recruitId),eq(recruits.status,"open"))).limit(1);
 if(!recruit)return Response.json({error:"この募集は終了しています"},{status:404});
 if(recruit.ownerId===user.userId)return Response.json({error:"自分の募集には申請できません"},{status:400});
 const exists=await db.select().from(applications).where(and(eq(applications.recruitId,p.recruitId),eq(applications.applicantId,user.userId))).limit(1);
 if(exists.length)return Response.json({error:"すでに申請済みです"},{status:409});
 await db.insert(applications).values({recruitId:p.recruitId,applicantId:user.userId,applicantName:p.applicantName.slice(0,24),pokemon:p.pokemon,message:p.message.slice(0,180),createdAt:new Date()});
 return Response.json({ok:true});
}
