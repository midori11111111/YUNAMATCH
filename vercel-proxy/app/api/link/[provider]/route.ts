import { auth, signIn } from "@/auth";
import { createLinkCookie, linkCookieName } from "@/lib/link-cookie";
import { cookies } from "next/headers";

const providers=new Set(["google","line","discord","twitter"]);
const accountChoiceParams:Record<string,Record<string,string>>={
  google:{prompt:"select_account"},
  line:{prompt:"consent"},
  discord:{prompt:"consent"},
  twitter:{force_login:"true"},
};
const serviceHomePath=process.env.SERVICE_HOME_PATH||"/";

export async function GET(_request:Request,{params}:{params:Promise<{provider:string}>}){
  const {provider}=await params;
  if(!providers.has(provider))return new Response("Unknown provider",{status:404});
  const session=await auth();
  if(!session?.user?.id)return Response.redirect(new URL("/login",_request.url));
  const secret=process.env.AUTH_SECRET;
  if(!secret)return new Response("Account linking is unavailable",{status:503});
  const cookieStore=await cookies();
  cookieStore.set(linkCookieName,createLinkCookie(session.user.id,secret),{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:10*60});
  const source=new URL(_request.url);
  const joinDiscord=provider==="discord"&&source.searchParams.get("joinDiscord")==="1";
  const redirectTo=joinDiscord
    ? `${serviceHomePath}?linked=discord&joinDiscord=1`
    : `${serviceHomePath}?linked=${provider}`;
  await signIn(provider,{redirectTo},accountChoiceParams[provider]);
}
