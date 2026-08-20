import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import Line from "next-auth/providers/line";
import Twitter from "next-auth/providers/twitter";
import { cookies } from "next/headers";
import { linkCookieName, readLinkCookie } from "@/lib/link-cookie";

const accountLinkEndpoint=`${process.env.YUNAMATCH_UPSTREAM_URL||"https://unite-mate-jp.tomoki-ashizawa.chatgpt.site"}/api/account-links/internal`;

async function resolveIdentity(input:{provider:string;providerAccountId:string;canonicalUserId?:string;contactId:string;displayName:string|null;email:string|null}){
  const secret=process.env.AUTH_SECRET;
  if(!secret)throw new Error("AUTH_SECRET is required for account linking");
  const response=await fetch(accountLinkEndpoint,{method:"POST",headers:{"content-type":"application/json","x-yunamatch-auth-secret":secret},body:JSON.stringify(input),cache:"no-store"});
  if(!response.ok)throw new Error(`Account link failed: ${response.status}`);
  return await response.json() as {userId:string};
}

const xProvider = Twitter({
  authorization: {
    url: "https://x.com/i/oauth2/authorize",
    params: { scope: "tweet.read users.read" },
  },
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google, Line, Discord, xProvider],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider) {
        const source = profile as Record<string, unknown> | undefined;
        const nested = source?.data as Record<string, unknown> | undefined;
        const username =
          typeof source?.username === "string" ? source.username :
          typeof source?.preferred_username === "string" ? source.preferred_username :
          typeof nested?.username === "string" ? nested.username : null;
        const contactId = account.provider === "google"
          ? token.email
          : username ?? account.providerAccountId;
        const secret=process.env.AUTH_SECRET||"";
        let canonicalUserId:string|undefined;
        try{
          const cookieStore=await cookies();
          canonicalUserId=readLinkCookie(cookieStore.get(linkCookieName)?.value,secret)||undefined;
          if(canonicalUserId)cookieStore.delete(linkCookieName);
        }catch{/* Cookie is only present while adding another login account. */}
        try{
          const identity=await resolveIdentity({provider:account.provider,providerAccountId:account.providerAccountId,canonicalUserId,contactId:typeof contactId==="string"?contactId:account.providerAccountId,displayName:typeof token.name==="string"?token.name:null,email:typeof token.email==="string"?token.email:null});
          token.userId=identity.userId;
        }catch(error){
          if(canonicalUserId)throw error;
          token.userId=`oauth:${account.provider}:${account.providerAccountId}`;
        }
        token.provider=account.provider;
        token.providerAccountId=account.providerAccountId;
        token.contactId=contactId;
      }
      if(typeof token.userId!=="string"&&typeof token.sub==="string")token.userId=`oauth:${typeof token.provider==="string"?token.provider:"oauth"}:${typeof token.providerAccountId==="string"?token.providerAccountId:token.sub}`;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = typeof token.userId==="string"?token.userId:token.sub ?? token.email ?? "";
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
