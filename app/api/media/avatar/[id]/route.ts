import { env } from "cloudflare:workers";

type MediaEnv = { MEDIA?: R2Bucket };

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!/^[a-f0-9]{64}$/.test(id))return new Response("Not found",{status:404});
  const media=(env as unknown as MediaEnv).MEDIA;
  const object=media?await media.get(`avatars/${id}`):null;
  if(!object)return new Response("Not found",{status:404});
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set("etag",object.httpEtag);headers.set("cache-control","public, max-age=31536000, immutable");headers.set("x-content-type-options","nosniff");
  return new Response(object.body,{headers});
}
