import { getMongoClient } from './mongodb';
import { ObjectId } from 'mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { AUTH_ERRORS } from './errors';

export const getUserObjectId = async (email: string): Promise<ObjectId | null> => {
  const client = await getMongoClient();
  const db = client.db();
  const usersCollection = db.collection('users');

  const user = await usersCollection.findOne({ email });
  return user?._id || null;
};

/**
 * Get admin status for the current user (server-side)
 * @returns Promise<boolean> indicating if the current user is an admin
 */
export const getCurrentUserAdminStatus = async (): Promise<boolean> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;

  const client = await getMongoClient();
  const db = client.db();
  const usersCollection = db.collection('users');

  const user = await usersCollection.findOne({ email: session.user.email });
  return user?.isAdmin === true;
};

type RequireApprovedSessionResult =
  | { session: Session; error?: never }
  | { session?: never; error: NextResponse };

/**
 * Server-side gate for user-data API routes. Returns the session for a
 * signed-in user who is approved OR an admin (admins bypass approval, matching
 * the client behavior in use-approval-status.ts), or an `error` NextResponse to
 * return directly: 401 when unauthenticated, 403 when signed in but neither
 * approved nor admin.
 *
 * Usage:
 *   const { session, error } = await requireApprovedSession();
 *   if (error) return error;
 */
export const requireApprovedSession = async (): Promise<RequireApprovedSessionResult> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 }) };
  }
  // Admins bypass approval (isAdmin and isApproved are independent flags; an
  // unapproved admin must still reach admin tooling to approve users).
  if (session.user.isApproved !== true && session.user.isAdmin !== true) {
    return { error: NextResponse.json({ error: AUTH_ERRORS.FORBIDDEN }, { status: 403 }) };
  }
  return { session };
};
