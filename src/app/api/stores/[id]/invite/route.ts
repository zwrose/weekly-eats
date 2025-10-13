import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { AUTH_ERRORS, API_ERRORS } from '@/lib/errors';

const INVITE_ERRORS = {
  INVALID_STORE_ID: 'Invalid store ID',
  STORE_NOT_FOUND: 'Store not found',
  NOT_OWNER: 'Only the store owner can send invitations',
  INVALID_EMAIL: 'Valid email address is required',
  USER_NOT_FOUND: 'User not found. They need to register first.',
  SELF_INVITE: 'Cannot invite yourself',
  ALREADY_INVITED: 'User already has a pending invitation',
};

function logError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: INVITE_ERRORS.INVALID_STORE_ID }, { status: 400 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: INVITE_ERRORS.INVALID_EMAIL }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check for self-invitation
    if (normalizedEmail === session.user.email?.toLowerCase()) {
      return NextResponse.json({ error: INVITE_ERRORS.SELF_INVITE }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');
    const usersCollection = db.collection('users');

    // Verify store exists and user is owner
    const store = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(id),
      userId: session.user.id
    });

    if (!store) {
      return NextResponse.json({ error: INVITE_ERRORS.STORE_NOT_FOUND }, { status: 404 });
    }

    // Find the user to invite
    const invitedUser = await usersCollection.findOne({ email: normalizedEmail });

    if (!invitedUser) {
      return NextResponse.json({ error: INVITE_ERRORS.USER_NOT_FOUND }, { status: 404 });
    }

    const invitedUserId = invitedUser._id.toString();

    // Remove any existing invitations for this user (replaces old one)
    await storesCollection.updateOne(
      { _id: ObjectId.createFromHexString(id) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { $pull: { invitations: { userId: invitedUserId } } as any }
    );

    // Add new invitation
    const newInvitation = {
      userId: invitedUserId,
      userEmail: normalizedEmail,
      status: 'pending',
      invitedBy: session.user.id,
      invitedAt: new Date()
    };

    await storesCollection.updateOne(
      { _id: ObjectId.createFromHexString(id) },
      { 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        $push: { invitations: newInvitation } as any,
        $set: { updatedAt: new Date() }
      }
    );

    return NextResponse.json({ success: true, invitation: newInvitation }, { status: 201 });
  } catch (error) {
    logError('Store Invite POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

