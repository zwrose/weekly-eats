import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { AUTH_ERRORS, API_ERRORS } from '@/lib/errors';

const INVITE_ERRORS = {
  INVALID_EMAIL: 'Valid email address is required',
  USER_NOT_FOUND: 'User not found. They need to register first.',
  SELF_INVITE: 'Cannot share meal plans with yourself',
};

function logError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
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
    const usersCollection = db.collection('users');

    // Find the user to invite
    const invitedUser = await usersCollection.findOne({ email: normalizedEmail });

    if (!invitedUser) {
      return NextResponse.json({ error: INVITE_ERRORS.USER_NOT_FOUND }, { status: 404 });
    }

    const invitedUserId = invitedUser._id.toString();

    // Get current user settings
    const currentUser = await usersCollection.findOne({ email: session.user.email });
    const settings = currentUser?.settings || {};
    const mealPlanSharing = settings.mealPlanSharing || { invitations: [] };

    // Remove any existing invitation for this user (replaces old one)
    const filteredInvitations = (mealPlanSharing.invitations || []).filter(
      (inv: { userId: string }) => inv.userId !== invitedUserId
    );

    // Add new invitation
    const newInvitation = {
      userId: invitedUserId,
      userEmail: normalizedEmail,
      userName: invitedUser.name,
      status: 'pending',
      invitedBy: session.user.id,
      invitedAt: new Date()
    };

    filteredInvitations.push(newInvitation);

    // Update user settings
    await usersCollection.updateOne(
      { email: session.user.email },
      {
        $set: {
          'settings.mealPlanSharing.invitations': filteredInvitations
        }
      }
    );

    return NextResponse.json({ success: true, invitation: newInvitation }, { status: 201 });
  } catch (error) {
    logError('Meal Plan Sharing Invite POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

