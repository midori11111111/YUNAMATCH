import { and, eq, notLike } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accountLinks, profiles } from "../../../../db/schema";

function secretsMatch(received:string,expected:string){
  if(!received||received.length!==expected.length)return false;
  let difference=0;
  for(let index=0;index<expected.length;index++)difference|=received.charCodeAt(index)^expected.charCodeAt(index);
  return difference===0;
}

async function findOldestProfileByEmail(email:string){
  const normalized=email.trim().toLowerCase();
  if(!normalized)return null;
  const db=getDb();
  const rows=await db
    .select({canonicalUserId:accountLinks.canonicalUserId,createdAt:profiles.createdAt})
    .from(accountLinks)
    .innerJoin(profiles,eq(accountLinks.canonicalUserId,profiles.userId))
    .where(and(eq(accountLinks.email,normalized),notLike(accountLinks.canonicalUserId,"detached:%")))
    .limit(20);
  const profilesById=new Map<string,number>();
  for(const row of rows){
    const createdAt=row.createdAt instanceof Date?row.createdAt.getTime():Number(row.createdAt);
    const previous=profilesById.get(row.canonicalUserId);
    if(previous===undefined||createdAt<previous)profilesById.set(row.canonicalUserId,createdAt);
  }
  return [...profilesById.entries()]
    .sort((left,right)=>left[1]-right[1]||left[0].localeCompare(right[0]))[0]?.[0]||null;
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
  const email=typeof body.email==="string"?body.email.slice(0,254).trim().toLowerCase():null;
  if(!provider||!providerAccountId)return Response.json({error:"invalid account"},{status:400});
  const db=getDb();
  const [existing]=await db.select().from(accountLinks).where(and(eq(accountLinks.provider,provider),eq(accountLinks.providerAccountId,providerAccountId))).limit(1);
  if(existing?.canonicalUserId.startsWith("detached:")){
    const userId=requestedCanonicalId||`oauth:${provider}:${providerAccountId}`;
    if(requestedCanonicalId){
      await db.update(accountLinks).set({canonicalUserId:requestedCanonicalId,contactId,displayName,email}).where(eq(accountLinks.id,existing.id));
    }
    return Response.json({userId,linked:Boolean(requestedCanonicalId),relinked:Boolean(requestedCanonicalId)});
  }
  if(existing&&requestedCanonicalId&&existing.canonicalUserId!==requestedCanonicalId)return Response.json({error:"このアカウントは別のプロフィールに連携されています"},{status:409});
  if(existing){
    const recoveredUserId=!requestedCanonicalId&&email&&["google","discord"].includes(provider)
      ?await findOldestProfileByEmail(email)
      :null;
    if(recoveredUserId&&recoveredUserId!==existing.canonicalUserId){
      // 障害中に同じ本人の新規プロフィールが作られていても削除せず保全し、
      // 通常ログインでは作成日の古いプロフィールへ戻す。
      await db.update(accountLinks).set({canonicalUserId:recoveredUserId,contactId,displayName,email}).where(eq(accountLinks.id,existing.id));
      return Response.json({userId:recoveredUserId,linked:true,recovered:true});
    }
    const [linkedProfile]=await db.select({userId:profiles.userId}).from(profiles).where(eq(profiles.userId,existing.canonicalUserId)).limit(1);
    if(linkedProfile)return Response.json({userId:existing.canonicalUserId,linked:true});

    return Response.json({userId:existing.canonicalUserId,linked:true});
  }

  const directUserId=`oauth:${provider}:${providerAccountId}`;
  const [directProfile]=await db.select({userId:profiles.userId}).from(profiles).where(eq(profiles.userId,directUserId)).limit(1);
  const recoveredUserId=!requestedCanonicalId&&email&&["google","discord"].includes(provider)
    ?await findOldestProfileByEmail(email)
    :null;
  const canonicalUserId=requestedCanonicalId||directProfile?.userId||recoveredUserId||directUserId;
  await db.insert(accountLinks).values({canonicalUserId,provider,providerAccountId,contactId,displayName,email,createdAt:new Date()}).onConflictDoNothing();
  return Response.json({userId:canonicalUserId,linked:true,recovered:Boolean(recoveredUserId)},{status:201});
}
