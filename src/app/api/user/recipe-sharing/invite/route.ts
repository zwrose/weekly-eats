import { NextRequest, NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { API_ERRORS, RECIPE_SHARING_ERRORS, logError } from '@/lib/errors';
import { requireApprovedSession } from '@/lib/user-utils';

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const body = await request.json();
    const { email, sharingTypes } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: RECIPE_SHARING_ERRORS.INVALID_EMAIL }, { status: 400 });
    }

    // Validate sharingTypes
    if (!Array.isArray(sharingTypes) || sharingTypes.length === 0) {
      return NextResponse.json(
        { error: RECIPE_SHARING_ERRORS.INVALID_SHARING_TYPES },
        { status: 400 }
      );
    }

    const validTypes = ['tags', 'ratings'];
    if (!sharingTypes.every((type: string) => validTypes.includes(type))) {
      return NextResponse.json(
        { error: RECIPE_SHARING_ERRORS.INVALID_SHARING_TYPES },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check for self-invitation
    if (normalizedEmail === session.user.email?.toLowerCase()) {
      return NextResponse.json({ error: RECIPE_SHARING_ERRORS.SELF_INVITE }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Find the user to invite
    const invitedUser = await usersCollection.findOne({ email: normalizedEmail });

    if (!invitedUser) {
      return NextResponse.json({ error: RECIPE_SHARING_ERRORS.USER_NOT_FOUND }, { status: 404 });
    }

    const invitedUserId = invitedUser._id.toString();

    // Get current user settings
    const currentUser = await usersCollection.findOne({ email: session.user.email });
    const settings = currentUser?.settings || {};
    const recipeSharing = settings.recipeSharing || { invitations: [] };

    // Remove any existing invitation for this user (replaces old one)
    const filteredInvitations = (recipeSharing.invitations || []).filter(
      (inv: { userId: string }) => inv.userId !== invitedUserId
    );

    // Add new invitation
    const newInvitation = {
      userId: invitedUserId,
      userEmail: normalizedEmail,
      userName: invitedUser.name,
      status: 'pending',
      invitedBy: session.user.id,
      invitedAt: new Date(),
      sharingTypes: sharingTypes as ('tags' | 'ratings')[],
    };

    filteredInvitations.push(newInvitation);

    // Update user settings
    await usersCollection.updateOne(
      { email: session.user.email },
      {
        $set: {
          'settings.recipeSharing.invitations': filteredInvitations,
        },
      }
    );

    return NextResponse.json({ success: true, invitation: newInvitation }, { status: 201 });
  } catch (error) {
    logError('Recipe Sharing Invite POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
