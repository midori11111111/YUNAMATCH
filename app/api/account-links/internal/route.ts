import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accountLinks } from "../../../../db/schema";

function secretsMatch(received:string,expected:string){
  if(!received||received.length!==expected.length)return false;
  let difference=0;
  for(let index=0;index<expected.length;index++)difference|=received.charCodeAt(index)^expected.charCodeAt(index);
  return difference===0;
}

export async function POST(request:Request){
  const secret=process.env.AUTH_SECRET||"";
  if(!secret||!secretsMatch(request.headers.get("x-yunamatch-auth-secret")||"",secret))return Response.json({error:"unauthorized"},{status:401});
  const body=await request.json() as Record<string,unknown>;
  const provider=typeof body.provider==="string"?body.provider:"";
  const providerAccountId=typeof body.providerAccountId==="string"?body.providerAccountId:"";
  const requestedCanonicalId=typeof body.canonicalUserId==="string"?body.canonicalUserId:"";
  const contactId=typeof body.contactId==="string"?body.contactId.slice(0,120):providerAccountId;
  const displayName=typeof body.displayName==="string"?body.displayName.slice(0,120):null;
  const email=typeof body.email==="string"?body.email.slice(0,254):null;
  if(!provider||!providerAccountId)return Response.json({error:"invalid account"},{status:400});
  const db=getDb();
  const [existing]=await db.select().from(accountLinks).where(and(eq(accountLinks.provider,provider),eq(accountLinks.providerAccountId,providerAccountId))).limit(1);
  if(existing&&requestedCanonicalId&&existing.canonicalUserId!==requestedCanonicalId)return Response.json({error:"このアカウントは別のプロフィールに連携されています"},{status:409});
  if(existing)return Response.json({userId:existing.canonicalUserId,linked:true});
  const canonicalUserId=requestedCanonicalId||`oauth:${provider}:${providerAccountId}`;
  await db.insert(accountLinks).values({canonicalUserId,provider,providerAccountId,contactId,displayName,email,createdAt:new Date()}).onConflictDoNothing();
  return Response.json({userId:canonicalUserId,linked:true},{status:201});
}
