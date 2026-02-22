import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '../../../../../lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { AUTH_ERRORS, API_ERRORS, USER_ERRORS, logError } from '@/lib/errors';

export async function POST(request: NextRequest) {
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

    // Get request body
    const { userId, isAdmin } = await request.json();

    if (!userId || typeof isAdmin !== 'boolean') {
      return NextResponse.json({ error: API_ERRORS.BAD_REQUEST }, { status: 400 });
    }

    // Prevent user from revoking their own admin status
    const targetUser = await usersCollection.findOne({ _id: ObjectId.createFromHexString(userId) });
    if (!targetUser) {
      return NextResponse.json({ error: USER_ERRORS.USER_NOT_FOUND }, { status: 404 });
    }

    if (targetUser.email === session.user.email) {
      return NextResponse.json({ error: USER_ERRORS.CANNOT_MODIFY_OWN_ADMIN }, { status: 400 });
    }

    // Update user's admin status
    await usersCollection.updateOne(
      { _id: ObjectId.createFromHexString(userId) },
      { $set: { isAdmin } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('ToggleAdmin POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
