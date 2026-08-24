import { eq } from "drizzle-orm";
import webpush from "web-push";
import { getDb } from "../db";
import { pushSubscriptions } from "../db/schema";

let configured=false;

export type RealtimePushEvent =
  | { type: "chat-message"; connectionId: number }
  | { type: "chat-refresh"; connectionId: number }
  | { type: "application-message"; applicationId: number }
  | { type: "summary-refresh" };

export async function sendPush(
  userId:string,
  title:string,
  body:string,
  url="/",
  realtime?:RealtimePushEvent,
){
  const publicKey=process.env.VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY;
  if(!publicKey||!privateKey)return;
  if(!configured){webpush.setVapidDetails(process.env.VAPID_SUBJECT||"mailto:support@yunamatch.app",publicKey,privateKey);configured=true}
  const db=getDb();const rows=await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId,userId));
  await Promise.all(rows.map(async row=>{try{await webpush.sendNotification(JSON.parse(row.subscription),JSON.stringify({title,body,url,realtime}),{TTL:3600})}catch(error){const status=(error as {statusCode?:number}).statusCode;if(status===404||status===410)await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id,row.id))}}));
}
