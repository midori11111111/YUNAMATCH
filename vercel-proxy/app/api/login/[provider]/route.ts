import { signIn } from "@/auth";

const providers=new Set(["google","line","discord","twitter"]);

export async function GET(request:Request,{params}:{params:Promise<{provider:string}>}){
  const {provider}=await params;
  if(!providers.has(provider))return new Response("Unknown provider",{status:404});
  const requested=new URL(request.url).searchParams.get("returnTo")||"/";
  const redirectTo=requested.startsWith("/")&&!requested.startsWith("//")?requested:"/";
  await signIn(provider,{redirectTo});
  return Response.redirect(new URL(redirectTo,request.url));
}
