import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import Line from "next-auth/providers/line";
import Twitter from "next-auth/providers/twitter";

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
    jwt({ token, account, profile }) {
      if (account?.provider) token.provider = account.provider;
      if (account?.provider) {
        const source = profile as Record<string, unknown> | undefined;
        const nested = source?.data as Record<string, unknown> | undefined;
        const username =
          typeof source?.username === "string" ? source.username :
          typeof source?.preferred_username === "string" ? source.preferred_username :
          typeof nested?.username === "string" ? nested.username : null;
        token.contactId = account.provider === "google"
          ? token.email
          : username ?? account.providerAccountId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.sub ?? token.email ?? "";
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
