import {count,eq,sql} from "drizzle-orm";
import {getDb} from "../../../../db";
import {serviceConnections,serviceMessages,serviceProfiles,serviceRecruits,serviceReports} from "../../../../db/schema";
import {requireAdmin} from "../../../../lib/admin";

const SERVICES=[
 {id:"valomatch",name:"バロマッチ",stage:"review"},
 {id:"stamate",name:"スタメイト",stage:"beta"},
 {id:"shoenmate",name:"荘園メイト",stage:"hold"},
 {id:"roninmatch",name:"浪マッチ",stage:"preview"},
] as const;

export async function GET(){
 if(!await requireAdmin())return Response.json({error:"管理者権限が必要です"},{status:403});
 try{
  const db=getDb();
  const rows=await Promise.all(SERVICES.map(async service=>{
   const [profiles,recruits,connections,messages,reports,openReports]=await Promise.all([
    db.select({value:count()}).from(serviceProfiles).where(eq(serviceProfiles.serviceId,service.id)),
    db.select({value:count()}).from(serviceRecruits).where(eq(serviceRecruits.serviceId,service.id)),
    db.select({value:count()}).from(serviceConnections).where(eq(serviceConnections.serviceId,service.id)),
    db.select({value:count()}).from(serviceMessages).where(eq(serviceMessages.serviceId,service.id)),
    db.select({value:count()}).from(serviceReports).where(eq(serviceReports.serviceId,service.id)),
    db.select({value:count()}).from(serviceReports).where(sql`${serviceReports.serviceId}=${service.id} and ${serviceReports.status}<>'resolved'`),
   ]);
   return {...service,profiles:profiles[0]?.value??0,recruits:recruits[0]?.value??0,connections:connections[0]?.value??0,messages:messages[0]?.value??0,reports:reports[0]?.value??0,openReports:openReports[0]?.value??0};
  }));
  return Response.json({schemaReady:true,services:rows});
 }catch(error){
  console.error("multi-service admin stats unavailable",error);
  return Response.json({schemaReady:false,services:SERVICES.map(service=>({...service,profiles:0,recruits:0,connections:0,messages:0,reports:0,openReports:0}))});
 }
}
