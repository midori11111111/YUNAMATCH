import { signIn } from "@/auth";

const providers=new Set(["google","line","discord","twitter"]);
const fifthMatchHosts=new Set(["daigomatch.com","www.daigomatch.com"]);
const accountChoiceParams:Record<string,Record<string,string>>={
  google:{prompt:"select_account"},
  line:{prompt:"consent"},
  discord:{prompt:"consent"},
  twitter:{force_login:"true"},
};

export async function GET(request:Request,{params}:{params:Promise<{provider:string}>}){
  const {provider}=await params;
  if(!providers.has(provider))return new Response("Unknown provider",{status:404});
  const source=new URL(request.url);
  const requested=source.searchParams.get("returnTo")||"/";
  const redirectTo=requested.startsWith("/")&&!requested.startsWith("//")?requested:"/";
  const hostCandidates=[
    request.headers.get("host"),
    source.host,
    request.headers.get("x-forwarded-host")?.split(",",1)[0]?.trim(),
  ].filter((host):host is string=>Boolean(host)).map((host)=>host.toLowerCase().split(":",1)[0]);
  const currentHost=hostCandidates.find((host)=>fifthMatchHosts.has(host));
  if(currentHost){
    const bridgeReturnTo=new URL("/api/domain-auth-bridge","https://yunamatch.com");
    bridgeReturnTo.searchParams.set("target",currentHost);
    bridgeReturnTo.searchParams.set("returnTo",redirectTo);
    const gateway=new URL(`/api/login/${encodeURIComponent(provider)}`,"https://yunamatch.com");
    gateway.searchParams.set("returnTo",`${bridgeReturnTo.pathname}${bridgeReturnTo.search}`);
    return Response.redirect(gateway,307);
  }
  await signIn(provider,{redirectTo},accountChoiceParams[provider]);
  return Response.redirect(new URL(redirectTo,request.url));
}
