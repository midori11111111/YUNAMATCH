import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { accountLinks } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const providerLabels:Record<string,string>={google:"Google",line:"LINE",discord:"Discord",twitter:"X",chatgpt:"ChatGPT"};

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const db=getDb();
  const [current]=await db.select().from(accountLinks).where(and(eq(accountLinks.provider,user.provider),eq(accountLinks.providerAccountId,user.providerAccountId))).limit(1);
  if(!current){
    await db.insert(accountLinks).values({canonicalUserId:user.userId,provider:user.provider,providerAccountId:user.providerAccountId,contactId:user.contactId,displayName:user.displayName,email:user.email,createdAt:new Date()}).onConflictDoNothing();
  }
  const rows=await db.select().from(accountLinks).where(eq(accountLinks.canonicalUserId,user.userId));
  return Response.json({accounts:rows.map(row=>({provider:row.provider,label:providerLabels[row.provider]||row.provider,contactId:row.contactId,displayName:row.displayName,isCurrent:row.provider===user.provider}))});
}
