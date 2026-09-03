import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { pushSubscriptions } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET(){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です"},{status:401});
  return Response.json({publicKey:process.env.VAPID_PUBLIC_KEY||""});
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です"},{status:401});
  const subscription=await request.json() as {endpoint?:string};if(!subscription.endpoint)return Response.json({error:"通知情報を確認してください"},{status:400});
  const now=new Date();await getDb().insert(pushSubscriptions).values({userId:user.userId,endpoint:subscription.endpoint,subscription:JSON.stringify(subscription),createdAt:now,updatedAt:now}).onConflictDoUpdate({target:pushSubscriptions.endpoint,set:{userId:user.userId,subscription:JSON.stringify(subscription),updatedAt:now}});
  return Response.json({ok:true});
}

export async function DELETE(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です"},{status:401});
  const {endpoint}=await request.json() as {endpoint?:string};if(endpoint)await getDb().delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint,endpoint),eq(pushSubscriptions.userId,user.userId)));return Response.json({ok:true});
}
