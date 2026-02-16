import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '../../../../lib/mongodb';
import { DEFAULT_USER_SETTINGS } from '../../../../lib/user-settings';
import { getUserObjectId } from '../../../../lib/user-utils';
import {
  AUTH_ERRORS,
  API_ERRORS,
  USER_ERRORS,
  SETTINGS_ERRORS,
  logError
} from '@/lib/errors';

export async function GET() {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const userId = await getUserObjectId(session.user.email);
    if (!userId) {
      return NextResponse.json({ settings: DEFAULT_USER_SETTINGS });
    }

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Find user by ObjectId
    const user = await usersCollection.findOne({ _id: userId });
    
    if (!user) {
      return NextResponse.json({ settings: DEFAULT_USER_SETTINGS });
    }

    return NextResponse.json({ 
      settings: user.settings || DEFAULT_USER_SETTINGS 
    });

  } catch (error) {
    logError('User Settings GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const userId = await getUserObjectId(session.user.email);
    if (!userId) {
      return NextResponse.json({ error: USER_ERRORS.USER_NOT_FOUND }, { status: 404 });
    }

    const { settings } = await request.json();
    
    if (!settings || typeof settings.themeMode !== 'string') {
      return NextResponse.json({ error: API_ERRORS.BAD_REQUEST }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Update user settings using ObjectId
    const result = await usersCollection.updateOne(
      { _id: userId },
      { 
        $set: { 
          settings,
          updatedAt: new Date()
        },
        $setOnInsert: { 
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    if (result.acknowledged) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: SETTINGS_ERRORS.SETTINGS_UPDATE_FAILED }, { status: 500 });
    }

  } catch (error) {
    logError('User Settings POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
} 