import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/auth';
import { getMongoClient } from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { 
  AUTH_ERRORS, 
  USER_ERRORS, 
  API_ERRORS,
  logError 
} from '@/lib/errors';

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
    const { userId, isApproved } = await request.json();

    if (!userId || typeof isApproved !== 'boolean') {
      return NextResponse.json({ error: API_ERRORS.BAD_REQUEST }, { status: 400 });
    }

    // Update user's approval status
    const result = await usersCollection.updateOne(
      { _id: ObjectId.createFromHexString(userId) },
      { $set: { isApproved } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: USER_ERRORS.USER_NOT_FOUND }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Admin Users Approve POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
} 