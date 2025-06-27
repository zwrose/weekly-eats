import { NextResponse } from 'next/server';
import { authOptions } from '../../../../lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '../../../../lib/mongodb';
import { 
  AUTH_ERRORS, 
  API_ERRORS,
  logError 
} from '@/lib/errors';

export async function GET() {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // Get current user's approval status
    const user = await usersCollection.findOne({ email: session.user.email });
    
    return NextResponse.json({ 
      isApproved: user?.isApproved === true,
      isAdmin: user?.isAdmin === true
    });
  } catch (error) {
    logError('User Approval Status GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
} 