import { NextResponse } from 'next/server';
import { authOptions } from '../../../../../lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '../../../../../lib/mongodb';

export async function GET() {
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

    // Get users pending approval (not approved and not admin)
    const users = await usersCollection.find({
      isApproved: { $ne: true },
      isAdmin: { $ne: true }
    }, {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        isAdmin: 1,
        isApproved: 1
      }
    }).sort({ _id: -1 }).limit(100).toArray();

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching pending users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 