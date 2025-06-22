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
    const { userId, approved } = await request.json();

    if (!userId || typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Find the user to approve/deny
    const targetUser = await usersCollection.findOne({ _id: ObjectId.createFromHexString(userId) });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user's approval status
    await usersCollection.updateOne(
      { _id: ObjectId.createFromHexString(userId) },
      { $set: { isApproved: approved } }
    );

    console.log(`User ${targetUser.email} approval status updated to: ${approved}`);

    // Invalidate user's session by updating their session token
    // This will force them to re-authenticate and get fresh session data
    const sessionsCollection = db.collection('sessions');
    await sessionsCollection.updateMany(
      { 'session.user.email': targetUser.email },
      { $set: { updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating approval status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 