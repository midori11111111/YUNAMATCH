import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { accountLinks } from "../../../db/schema";
import { invalidateIdentityAliases } from "../../../lib/account-aliases";
import { getChatGPTUser, invalidateCanonicalUser } from "../../chatgpt-auth";

const providerLabels:Record<string,string>={google:"Google",line:"LINE",discord:"Discord",twitter:"X",chatgpt:"ChatGPT"};

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const db=getDb();
  const [current]=await db.select().from(accountLinks).where(and(eq(accountLinks.provider,user.provider),eq(accountLinks.providerAccountId,user.providerAccountId))).limit(1);
  if(!current){
    await db.insert(accountLinks).values({canonicalUserId:user.userId,provider:user.provider,providerAccountId:user.providerAccountId,contactId:user.contactId,displayName:user.displayName,email:user.email.trim().toLowerCase(),createdAt:new Date()}).onConflictDoNothing();
  }
  const rows=await db.select().from(accountLinks).where(eq(accountLinks.canonicalUserId,user.userId));
  return Response.json({accounts:rows.map(row=>({id:row.id,provider:row.provider,label:providerLabels[row.provider]||row.provider,contactId:row.contactId,displayName:row.displayName,isCurrent:row.provider===user.provider&&row.providerAccountId===user.providerAccountId}))});
}

export async function DELETE(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"ログインが必要です",signIn:"/login"},{status:401});
  const body=await request.json().catch(()=>({})) as {accountId?:unknown};
  const accountId=Number(body.accountId);
  if(!Number.isInteger(accountId)||accountId<=0)return Response.json({error:"解除するアカウントを確認してください"},{status:400});
  const db=getDb();
  const rows=await db.select().from(accountLinks).where(eq(accountLinks.canonicalUserId,user.userId));
  const target=rows.find(row=>row.id===accountId);
  if(!target)return Response.json({error:"連携アカウントが見つかりません"},{status:404});
  if(target.provider===user.provider&&target.providerAccountId===user.providerAccountId){
    return Response.json({error:"ログイン中のアカウントは解除できません。別の連携アカウントでログインし直してください"},{status:409});
  }
  if(rows.length<=1)return Response.json({error:"ログインできなくなるため、最後のアカウントは解除できません"},{status:409});
  await db.update(accountLinks).set({canonicalUserId:`detached:${target.provider}:${target.providerAccountId}`}).where(and(eq(accountLinks.id,target.id),eq(accountLinks.canonicalUserId,user.userId)));
  invalidateCanonicalUser(target.provider,target.providerAccountId);
  invalidateIdentityAliases(user.userId);
  const remaining=rows.filter(row=>row.id!==target.id);
  return Response.json({accounts:remaining.map(row=>({id:row.id,provider:row.provider,label:providerLabels[row.provider]||row.provider,contactId:row.contactId,displayName:row.displayName,isCurrent:row.provider===user.provider&&row.providerAccountId===user.providerAccountId}))});
}
