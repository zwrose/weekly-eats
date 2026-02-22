import { NextResponse } from 'next/server';
import { authOptions } from '../../../../../lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '../../../../../lib/mongodb';
import { AUTH_ERRORS, API_ERRORS, logError } from '@/lib/errors';

export async function GET() {
  try {
    // Check if user is admin
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Get current user to check admin status
    const currentUser = await usersCollection.findOne({ email: session.user.email });
    if (!currentUser?.isAdmin) {
      return NextResponse.json({ error: AUTH_ERRORS.FORBIDDEN }, { status: 403 });
    }

    // Get users pending approval (not approved and not admin)
    const users = await usersCollection
      .find(
        {
          isApproved: { $ne: true },
          isAdmin: { $ne: true },
        },
        {
          projection: {
            _id: 1,
            name: 1,
            email: 1,
            isAdmin: 1,
            isApproved: 1,
          },
        }
      )
      .sort({ _id: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({ users });
  } catch (error) {
    logError('PendingUsers GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
