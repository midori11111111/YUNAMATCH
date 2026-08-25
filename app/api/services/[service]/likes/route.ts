import {and,desc,eq,inArray} from "drizzle-orm";
import {getDb} from "../../../../../db";
import {serviceConnections,serviceLikes,serviceProfiles} from "../../../../../db/schema";
import {getChatGPTUser} from "../../../../chatgpt-auth";
import {checkRateLimit,rateLimitResponse} from "../../../../../lib/rate-limit";
import {isServiceId} from "../../../../../lib/service-config";

async function context(params:Promise<{service:string}>){
  const {service}=await params;
  if(!isServiceId(service))return null;
  const user=await getChatGPTUser();
  if(!user)return null;
  const [profile]=await getDb().select().from(serviceProfiles).where(and(eq(serviceProfiles.serviceId,service),eq(serviceProfiles.userId,user.userId),eq(serviceProfiles.status,"active"))).limit(1);
  return profile&&!profile.suspendedAt?{service,user,profile}:null;
}

export async function GET(_request:Request,{params}:{params:Promise<{service:string}>}){
  const ctx=await context(params);
  if(!ctx)return Response.json({error:"プロフィール登録またはログインが必要です"},{status:401});
  const db=getDb();
  const [received,sent]=await Promise.all([
    db.select().from(serviceLikes).where(and(eq(serviceLikes.serviceId,ctx.service),eq(serviceLikes.recipientProfileId,ctx.profile.id),eq(serviceLikes.status,"active"))).orderBy(desc(serviceLikes.createdAt)).limit(201),
    db.select({recipientProfileId:serviceLikes.recipientProfileId}).from(serviceLikes).where(and(eq(serviceLikes.serviceId,ctx.service),eq(serviceLikes.senderProfileId,ctx.profile.id),eq(serviceLikes.status,"active"))).limit(1000),
  ]);
  const page=received.slice(0,200),profileIds=[...new Set(page.map(row=>row.senderProfileId))];
  const profiles=profileIds.length?await db.select().from(serviceProfiles).where(and(eq(serviceProfiles.serviceId,ctx.service),inArray(serviceProfiles.id,profileIds))):[];
  const byId=new Map(profiles.map(row=>[row.id,row]));
  return Response.json({
    received:page.flatMap(row=>{const profile=byId.get(row.senderProfileId);return profile?[{id:row.id,createdAt:row.createdAt,profile:{id:profile.id,displayName:profile.displayName,skillTier:profile.skillTier,roles:JSON.parse(profile.roles),avatarUrl:profile.avatarUrl}}]:[]}),
    sentProfileIds:sent.map(row=>row.recipientProfileId),
    hasMore:received.length>200,
  });
}

export async function POST(request:Request,{params}:{params:Promise<{service:string}>}){
  const ctx=await context(params);
  if(!ctx)return Response.json({error:"プロフィール登録またはログインが必要です"},{status:401});
  const limit=await checkRateLimit(`${ctx.service}:${ctx.user.userId}`,{action:"service-like",limit:200,windowMs:24*60*60_000});
  if(!limit.allowed)return rateLimitResponse(limit.retryAfter);
  const body=await request.json().catch(()=>({})) as {targetProfileId?:unknown};
  const targetProfileId=typeof body.targetProfileId==="number"&&Number.isInteger(body.targetProfileId)?body.targetProfileId:0;
  if(!targetProfileId||targetProfileId===ctx.profile.id)return Response.json({error:"相手を確認してください"},{status:400});
  const db=getDb(),[target]=await db.select().from(serviceProfiles).where(and(eq(serviceProfiles.id,targetProfileId),eq(serviceProfiles.serviceId,ctx.service),eq(serviceProfiles.status,"active"))).limit(1);
  if(!target||target.suspendedAt)return Response.json({error:"このプロフィールは利用できません"},{status:404});
  const now=new Date();
  await db.insert(serviceLikes).values({serviceId:ctx.service,senderProfileId:ctx.profile.id,recipientProfileId:target.id,status:"active",createdAt:now}).onConflictDoUpdate({
    target:[serviceLikes.serviceId,serviceLikes.senderProfileId,serviceLikes.recipientProfileId],
    set:{status:"active",createdAt:now},
  });
  const [reciprocal]=await db.select().from(serviceLikes).where(and(eq(serviceLikes.serviceId,ctx.service),eq(serviceLikes.senderProfileId,target.id),eq(serviceLikes.recipientProfileId,ctx.profile.id),eq(serviceLikes.status,"active"))).limit(1);
  if(!reciprocal)return Response.json({matched:false},{status:201});
  const low=Math.min(ctx.profile.id,target.id),high=Math.max(ctx.profile.id,target.id),pairKey=`${low}:${high}`;
  await db.insert(serviceConnections).values({serviceId:ctx.service,pairKey,requesterProfileId:ctx.profile.id,userAProfileId:low,userBProfileId:high,status:"active",createdAt:now}).onConflictDoUpdate({
    target:[serviceConnections.serviceId,serviceConnections.pairKey],
    set:{status:"active",endedAt:null},
  });
  const [connection]=await db.select().from(serviceConnections).where(and(eq(serviceConnections.serviceId,ctx.service),eq(serviceConnections.pairKey,pairKey))).limit(1);
  return Response.json({matched:true,connection},{status:201});
}

export async function PATCH(request:Request,{params}:{params:Promise<{service:string}>}){
  const ctx=await context(params);
  if(!ctx)return Response.json({error:"プロフィール登録またはログインが必要です"},{status:401});
  const body=await request.json().catch(()=>({})) as {likeId?:unknown;action?:unknown};
  const likeId=typeof body.likeId==="number"&&Number.isInteger(body.likeId)?body.likeId:0;
  if(body.action!=="dismiss")return Response.json({error:"操作を確認してください"},{status:400});
  const [updated]=await getDb().update(serviceLikes).set({status:"dismissed"}).where(and(eq(serviceLikes.id,likeId),eq(serviceLikes.serviceId,ctx.service),eq(serviceLikes.recipientProfileId,ctx.profile.id),eq(serviceLikes.status,"active"))).returning();
  if(!updated)return Response.json({error:"いいねが見つかりません"},{status:404});
  return Response.json({ok:true});
}
