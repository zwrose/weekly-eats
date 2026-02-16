import type { AuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "./mongodb-adapter";
import { getMongoClient } from "./mongodb";
import { logError } from "./errors";

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  adapter: MongoDBAdapter(clientPromise),
  callbacks: {
    async jwt({ token, trigger }: { token: JWT; trigger?: "signIn" | "signUp" | "update" }) {
      // On sign-in or sign-up, fetch user status from the database and cache in the token
      if (trigger === "signIn" || trigger === "signUp" || token.isAdmin === undefined) {
        if (token.email) {
          try {
            const client = await getMongoClient();
            const db = client.db();
            const user = await db.collection('users').findOne({ email: token.email });
            token.isAdmin = user?.isAdmin === true;
            token.isApproved = user?.isApproved === true;
          } catch (error) {
            logError('AuthJWT', error);
            token.isAdmin = false;
            token.isApproved = false;
          }
        }
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      // Forward cached token data to the session — no database query needed
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      session.user.isAdmin = token.isAdmin === true;
      session.user.isApproved = token.isApproved === true;
      return session;
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  session: {
    strategy: "jwt",
  },
};
