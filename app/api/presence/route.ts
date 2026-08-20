import { and, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { connections, presence } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

async function connectionFor(connectionId:number,userId:string){const [row]=await getDb().select().from(connections).where(and(eq(connections.id,connectionId),or(eq(connections.userAId,userId),eq(connections.userBId,userId)))).limit(1);return row}

export async function GET(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です"},{status:401});const connectionId=Number(new URL(request.url).searchParams.get("connectionId"));if(!connectionId)return Response.json({online:false,typing:false});
  const connection=await connectionFor(connectionId,user.userId);if(!connection)return Response.json({online:false,typing:false});const mateId=connection.userAId===user.userId?connection.userBId:connection.userAId;const [row]=await getDb().select().from(presence).where(eq(presence.userId,mateId)).limit(1);const age=row?Date.now()-row.lastSeenAt.getTime():Infinity;return Response.json({online:age<30_000,typing:Boolean(row?.typing&&row.connectionId===connectionId&&age<8_000)});
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"ログインが必要です"},{status:401});const payload=await request.json() as {connectionId?:number;typing?:boolean};if(payload.connectionId&&!await connectionFor(payload.connectionId,user.userId))return Response.json({error:"チャットが見つかりません"},{status:404});const now=new Date();await getDb().insert(presence).values({userId:user.userId,connectionId:payload.connectionId||null,typing:Boolean(payload.typing),lastSeenAt:now}).onConflictDoUpdate({target:presence.userId,set:{connectionId:payload.connectionId||null,typing:Boolean(payload.typing),lastSeenAt:now}});return Response.json({ok:true});
}
