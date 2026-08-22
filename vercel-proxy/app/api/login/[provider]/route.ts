import { signIn } from "@/auth";

const providers=new Set(["google","line","discord","twitter"]);
const accountChoiceParams:Record<string,Record<string,string>>={
  google:{prompt:"select_account"},
  line:{prompt:"consent"},
  discord:{prompt:"consent"},
  twitter:{force_login:"true"},
};

export async function GET(request:Request,{params}:{params:Promise<{provider:string}>}){
  const {provider}=await params;
  if(!providers.has(provider))return new Response("Unknown provider",{status:404});
  const requested=new URL(request.url).searchParams.get("returnTo")||"/";
  const redirectTo=requested.startsWith("/")&&!requested.startsWith("//")?requested:"/";
  await signIn(provider,{redirectTo},accountChoiceParams[provider]);
  return Response.redirect(new URL(redirectTo,request.url));
}
