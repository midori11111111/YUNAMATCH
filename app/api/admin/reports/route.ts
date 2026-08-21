import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { profiles, recruits, reports } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin";

export async function GET(){
  if(!await requireAdmin())return Response.json({error:"管理者権限が必要です"},{status:403});
  const rows=await getDb().select({id:reports.id,targetId:reports.targetId,reason:reports.reason,details:reports.details,status:reports.status,createdAt:reports.createdAt,resolvedAt:reports.resolvedAt,targetName:profiles.trainerName,avatarUrl:profiles.avatarUrl,suspendedAt:profiles.suspendedAt}).from(reports).leftJoin(profiles,eq(reports.targetId,profiles.userId)).orderBy(desc(reports.createdAt)).limit(200);
  return Response.json({reports:rows});
}

export async function PATCH(request:Request){
  if(!await requireAdmin())return Response.json({error:"管理者権限が必要です"},{status:403});
  const payload=await request.json() as {reportId?:number;targetId?:string;action?:"resolve"|"suspend"|"restore"|"removeImage"};if(!payload.action)return Response.json({error:"操作を確認してください"},{status:400});const db=getDb();
  if(payload.action==="resolve"&&payload.reportId){const now=new Date();await db.update(reports).set({status:"resolved",resolvedAt:now,updatedAt:now}).where(eq(reports.id,payload.reportId));}
  if(payload.targetId&&payload.action==="suspend"){await db.update(profiles).set({suspendedAt:new Date()}).where(eq(profiles.userId,payload.targetId));await db.update(recruits).set({status:"closed"}).where(eq(recruits.ownerId,payload.targetId))}
  if(payload.targetId&&payload.action==="restore")await db.update(profiles).set({suspendedAt:null}).where(eq(profiles.userId,payload.targetId));
  if(payload.targetId&&payload.action==="removeImage")await db.update(profiles).set({avatarUrl:""}).where(eq(profiles.userId,payload.targetId));
  return Response.json({ok:true});
}
