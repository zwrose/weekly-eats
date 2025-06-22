import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { getMongoClient } from '../../../../lib/mongodb';

export async function GET(request: NextRequest) {
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

    // Get search term from query params
    const searchParams = request.nextUrl.searchParams;
    const searchTerm = searchParams.get('search');

    if (!searchTerm) {
      return NextResponse.json({ error: 'Search term is required' }, { status: 400 });
    }

    // Search users by name or email (case-insensitive) - only approved users
    const users = await usersCollection.find({
      $and: [
        {
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } }
          ]
        },
        { isApproved: true } // Only search approved users
      ]
    }, {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        isAdmin: 1,
        isApproved: 1
      }
    }).limit(50).toArray();

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 