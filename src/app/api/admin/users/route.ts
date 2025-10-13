import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { getMongoClient } from '../../../../lib/mongodb';
import { 
  AUTH_ERRORS, 
  API_ERRORS,
  logError 
} from '@/lib/errors';

export async function GET(request: NextRequest) {
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

    // Get search term from query params
    const searchParams = request.nextUrl.searchParams;
    const searchTerm = searchParams.get('search');

    // Build query for approved users
    let query: { isApproved: boolean } | { $and: Array<{ $or?: Array<{ name?: { $regex: string; $options: string }; email?: { $regex: string; $options: string } }>; isApproved?: boolean }> } = { isApproved: true };

    // Add search filter if search term is provided
    if (searchTerm && searchTerm.trim()) {
      query = {
        $and: [
          {
            $or: [
              { name: { $regex: searchTerm, $options: 'i' } },
              { email: { $regex: searchTerm, $options: 'i' } }
            ]
          },
          { isApproved: true }
        ]
      };
    }

    // Search users by name or email (case-insensitive) - only approved users
    const users = await usersCollection.find(query, {
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
    logError('Admin Users GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
} 