import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { profiles, supportTickets } from "../../../db/schema";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { getChatGPTUser } from "../../chatgpt-auth";

const categories=new Set(["アカウント・ログイン","募集・マッチ","安全・通報","不具合","その他","フィードバック・改善案","フィードバック・使いにくい","フィードバック・良かった","フィードバック・その他"]);

async function notifyFeedback(category:string,message:string,trainerName:string){
  const apiKey=process.env.RESEND_API_KEY;
  const to=process.env.FEEDBACK_TO_EMAIL;
  if(!apiKey||!to)return false;
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{authorization:`Bearer ${apiKey}`,"content-type":"application/json"},
    body:JSON.stringify({
      from:process.env.FEEDBACK_FROM_EMAIL||"YUNAMATCH <onboarding@resend.dev>",
      to:[to],
      subject:`【YUNAMATCH】${category}`,
      text:`トレーナー: ${trainerName}\n種類: ${category}\n\n${message}`,
    }),
  });
  return response.ok;
}

export async function GET(){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です"},{status:401});
  const tickets=await getDb().select({id:supportTickets.id,category:supportTickets.category,message:supportTickets.message,status:supportTickets.status,createdAt:supportTickets.createdAt,resolvedAt:supportTickets.resolvedAt}).from(supportTickets).where(eq(supportTickets.userId,user.userId)).orderBy(desc(supportTickets.createdAt)).limit(20);
  return Response.json({tickets});
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です"},{status:401});
  const rateLimit=await checkRateLimit(user.userId,{action:"support",limit:5,windowMs:24*60*60_000});if(!rateLimit.allowed)return rateLimitResponse(rateLimit.retryAfter);
  const payload=await request.json() as {category?:string;message?:string};const category=payload.category||"",message=payload.message?.trim()||"";
  if(!categories.has(category)||message.length<5||message.length>1000)return Response.json({error:"種類を選び、内容を5〜1000文字で入力してください"},{status:400});
  const [profile]=await getDb().select({trainerName:profiles.trainerName,suspendedAt:profiles.suspendedAt}).from(profiles).where(eq(profiles.userId,user.userId)).limit(1);
  if(!profile)return Response.json({error:"プロフィールが見つかりません"},{status:404});
  const now=new Date();const [ticket]=await getDb().insert(supportTickets).values({userId:user.userId,trainerName:profile.trainerName,category,message,createdAt:now,updatedAt:now}).returning({id:supportTickets.id});
  if(category.startsWith("フィードバック・")){
    try{await notifyFeedback(category,message,profile.trainerName)}catch(error){console.error("feedback email notification failed",error)}
  }
  return Response.json({ok:true,ticketId:ticket.id},{status:201});
}
