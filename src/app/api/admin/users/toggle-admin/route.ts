import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '../../../../../lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // Get current user to check admin status
    const currentUser = await usersCollection.findOne({ email: session.user.email });
    if (!currentUser?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get request body
    const { userId, isAdmin } = await request.json();

    if (!userId || typeof isAdmin !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Prevent user from revoking their own admin status
    const targetUser = await usersCollection.findOne({ _id: ObjectId.createFromHexString(userId) });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.email === session.user.email) {
      return NextResponse.json({ error: 'Cannot modify your own admin status' }, { status: 400 });
    }

    // Update user's admin status
    await usersCollection.updateOne(
      { _id: ObjectId.createFromHexString(userId) },
      { $set: { isAdmin } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error toggling admin status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 