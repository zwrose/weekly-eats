import type { JWT } from 'next-auth/jwt';
import NextAuth from 'next-auth';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import authConfig from './auth.config';
import clientPromise from './mongodb-adapter';
import { getMongoClient } from './mongodb';
import { logError } from './errors';

export async function jwtCallback({
  token,
  trigger,
}: {
  token: JWT;
  trigger?: 'signIn' | 'signUp' | 'update';
}) {
  // On sign-in/up/update (or first hydration), fetch user status from the DB
  // and cache it in the token. Runs only in the Node-runtime route handler.
  if (
    trigger === 'signIn' ||
    trigger === 'signUp' ||
    trigger === 'update' ||
    token.isAdmin === undefined
  ) {
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
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise),
  callbacks: { ...authConfig.callbacks, jwt: jwtCallback },
});
