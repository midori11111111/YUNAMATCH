import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Line from "next-auth/providers/line";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google, Line],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    jwt({ token, account }) {
      if (account?.provider) token.provider = account.provider;
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
