import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accountLinks, profiles } from "../../../../db/schema";

function secretsMatch(received:string,expected:string){
  if(!received||received.length!==expected.length)return false;
  let difference=0;
  for(let index=0;index<expected.length;index++)difference|=received.charCodeAt(index)^expected.charCodeAt(index);
  return difference===0;
}

async function findUniqueProfileByEmail(email:string){
  const normalized=email.trim().toLowerCase();
  if(!normalized)return null;
  const db=getDb();
  const rows=await db
    .select({canonicalUserId:accountLinks.canonicalUserId})
    .from(accountLinks)
    .innerJoin(profiles,eq(accountLinks.canonicalUserId,profiles.userId))
    .where(sql`lower(${accountLinks.email}) = ${normalized}`)
    .limit(3);
  const ids=[...new Set(rows.map(row=>row.canonicalUserId))];
  return ids.length===1?ids[0]:null;
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
  if(existing){
    const [linkedProfile]=await db.select({userId:profiles.userId}).from(profiles).where(eq(profiles.userId,existing.canonicalUserId)).limit(1);
    if(linkedProfile)return Response.json({userId:existing.canonicalUserId,linked:true});

    // OAuth設定の切替などで同じ本人が別IDとして記録された場合、
    // 同一メールに結び付く保存済みプロフィールが一意なら安全に復元する。
    const recoveredUserId=!requestedCanonicalId&&email&&["google","discord"].includes(provider)
      ?await findUniqueProfileByEmail(email)
      :null;
    if(recoveredUserId&&recoveredUserId!==existing.canonicalUserId){
      await db.update(accountLinks).set({canonicalUserId:recoveredUserId,contactId,displayName,email}).where(eq(accountLinks.id,existing.id));
      return Response.json({userId:recoveredUserId,linked:true,recovered:true});
    }
    return Response.json({userId:existing.canonicalUserId,linked:true});
  }

  const directUserId=`oauth:${provider}:${providerAccountId}`;
  const [directProfile]=await db.select({userId:profiles.userId}).from(profiles).where(eq(profiles.userId,directUserId)).limit(1);
  const recoveredUserId=!requestedCanonicalId&&!directProfile&&email&&["google","discord"].includes(provider)
    ?await findUniqueProfileByEmail(email)
    :null;
  const canonicalUserId=requestedCanonicalId||directProfile?.userId||recoveredUserId||directUserId;
  await db.insert(accountLinks).values({canonicalUserId,provider,providerAccountId,contactId,displayName,email,createdAt:new Date()}).onConflictDoNothing();
  return Response.json({userId:canonicalUserId,linked:true,recovered:Boolean(recoveredUserId)},{status:201});
}
