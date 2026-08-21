import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { supportTickets } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin";

export async function GET(){
  if(!await requireAdmin())return Response.json({error:"管理者権限が必要です"},{status:403});
  const tickets=await getDb().select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(200);
  return Response.json({tickets});
}

export async function PATCH(request:Request){
  if(!await requireAdmin())return Response.json({error:"管理者権限が必要です"},{status:403});
  const payload=await request.json() as {ticketId?:number;action?:"resolve"|"reopen"};
  if(!payload.ticketId||!payload.action)return Response.json({error:"操作を確認してください"},{status:400});
  const now=new Date();await getDb().update(supportTickets).set(payload.action==="resolve"?{status:"resolved",resolvedAt:now,updatedAt:now}:{status:"open",resolvedAt:null,updatedAt:now}).where(eq(supportTickets.id,payload.ticketId));
  return Response.json({ok:true});
}
