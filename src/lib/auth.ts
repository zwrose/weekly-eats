import GoogleProvider from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "./mongodb-adapter";
import { getMongoClient } from "./mongodb";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  adapter: MongoDBAdapter(clientPromise),
  callbacks: {
    async signIn() {
      // This callback runs when a user signs in
      // You can add custom logic here if needed
      return true;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      // Add user ID to the session
      if (session.user && token?.sub) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = token.sub;
      }
      
      // Fetch admin status and approval status from database
      if (session.user?.email) {
        try {
          const client = await getMongoClient();
          const db = client.db();
          const usersCollection = db.collection('users');
          
          const user = await usersCollection.findOne({ email: session.user.email });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (session.user as any).isAdmin = user?.isAdmin === true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (session.user as any).isApproved = user?.isApproved === true;
        } catch (error) {
          console.error('Error fetching user status:', error);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (session.user as any).isAdmin = false;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (session.user as any).isApproved = false;
        }
      }
      
      return session;
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  session: {
    strategy: "jwt" as const,
  },
}; 