import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '../../../../lib/mongodb';
import { DEFAULT_USER_SETTINGS } from '../../../../lib/user-settings';

export async function GET() {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Find user by email
    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ settings: DEFAULT_USER_SETTINGS });
    }

    return NextResponse.json({ 
      settings: user.settings || DEFAULT_USER_SETTINGS 
    });

  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { settings } = await request.json();
    
    if (!settings || typeof settings.themeMode !== 'string') {
      return NextResponse.json({ error: 'Invalid settings data' }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Update user settings
    const result = await usersCollection.updateOne(
      { email: session.user.email },
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
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error saving user settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 