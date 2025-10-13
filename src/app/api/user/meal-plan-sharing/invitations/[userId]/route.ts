import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { AUTH_ERRORS, API_ERRORS } from '@/lib/errors';

const INVITATION_ERRORS = {
  INVITATION_NOT_FOUND: 'Invitation not found',
  INVALID_ACTION: 'Invalid action',
  NOT_AUTHORIZED: 'Not authorized to perform this action',
};

function logError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}

type RouteParams = {
  params: Promise<{ userId: string }>;
};

// Accept or reject invitation
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { userId } = await params;
    const body = await request.json();
    const { action } = body; // 'accept' or 'reject'

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json({ error: INVITATION_ERRORS.INVALID_ACTION }, { status: 400 });
    }

    // Only the invited user can accept/reject their invitation
    if (userId !== session.user.id) {
      return NextResponse.json({ error: INVITATION_ERRORS.NOT_AUTHORIZED }, { status: 403 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Find the owner who sent the invitation
    const owner = await usersCollection.findOne({
      'settings.mealPlanSharing.invitations': {
        $elemMatch: {
          userId: userId,
          status: 'pending'
        }
      }
    });

    if (!owner) {
      return NextResponse.json({ error: INVITATION_ERRORS.INVITATION_NOT_FOUND }, { status: 404 });
    }

    // Update invitation status
    await usersCollection.updateOne(
      {
        _id: owner._id,
        'settings.mealPlanSharing.invitations.userId': userId
      },
      {
        $set: {
          'settings.mealPlanSharing.invitations.$.status': action === 'accept' ? 'accepted' : 'rejected'
        }
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Meal Plan Sharing Invitation PUT', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

// Remove user from sharing (owner removes user OR user leaves)
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { userId } = await params;

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Check if current user is the owner (removing someone) or the invited user (leaving)
    const isOwner = await usersCollection.findOne({
      email: session.user.email,
      'settings.mealPlanSharing.invitations.userId': userId
    });

    const isSelf = userId === session.user.id;

    if (!isOwner && !isSelf) {
      return NextResponse.json({ error: INVITATION_ERRORS.NOT_AUTHORIZED }, { status: 403 });
    }

    // Remove the invitation
    if (isOwner) {
      // Owner removing someone
      await usersCollection.updateOne(
        { email: session.user.email },
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          $pull: { 'settings.mealPlanSharing.invitations': { userId } } as any
        }
      );
    } else {
      // User leaving - find and remove from all owners
      await usersCollection.updateMany(
        { 'settings.mealPlanSharing.invitations.userId': userId },
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          $pull: { 'settings.mealPlanSharing.invitations': { userId } } as any
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Meal Plan Sharing Invitation DELETE', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

