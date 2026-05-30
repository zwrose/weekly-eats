import { NextRequest, NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { API_ERRORS, RECIPE_SHARING_ERRORS, logError } from '@/lib/errors';
import { requireApprovedSession } from '@/lib/user-utils';

type RouteParams = {
  params: Promise<{ userId: string }>;
};

// Accept or reject invitation
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const { userId } = await params;
    const body = await request.json();
    const { action } = body; // 'accept' or 'reject'

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json({ error: RECIPE_SHARING_ERRORS.INVALID_ACTION }, { status: 400 });
    }

    // Only the invited user can accept/reject their invitation
    if (userId !== session.user.id) {
      return NextResponse.json({ error: RECIPE_SHARING_ERRORS.NOT_AUTHORIZED }, { status: 403 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Find the owner who sent the invitation
    const owner = await usersCollection.findOne({
      'settings.recipeSharing.invitations': {
        $elemMatch: {
          userId: userId,
          status: 'pending',
        },
      },
    });

    if (!owner) {
      return NextResponse.json(
        { error: RECIPE_SHARING_ERRORS.INVITATION_NOT_FOUND },
        { status: 404 }
      );
    }

    // Update invitation status
    await usersCollection.updateOne(
      {
        _id: owner._id,
        'settings.recipeSharing.invitations.userId': userId,
      },
      {
        $set: {
          'settings.recipeSharing.invitations.$.status':
            action === 'accept' ? 'accepted' : 'rejected',
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Recipe Sharing Invitation PUT', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

// Remove user from sharing (owner removes user OR user leaves)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const { userId } = await params;

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Check if current user is the owner (removing someone) or the invited user (leaving)
    const isOwner = await usersCollection.findOne({
      email: session.user.email,
      'settings.recipeSharing.invitations.userId': userId,
    });

    const isSelf = userId === session.user.id;

    if (!isOwner && !isSelf) {
      return NextResponse.json({ error: RECIPE_SHARING_ERRORS.NOT_AUTHORIZED }, { status: 403 });
    }

    // Remove the invitation
    if (isOwner) {
      // Owner removing someone
      await usersCollection.updateOne(
        { email: session.user.email },
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          $pull: { 'settings.recipeSharing.invitations': { userId } } as any,
        }
      );
    } else {
      // User leaving - find and remove from all owners
      await usersCollection.updateMany(
        { 'settings.recipeSharing.invitations.userId': userId },
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          $pull: { 'settings.recipeSharing.invitations': { userId } } as any,
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Recipe Sharing Invitation DELETE', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
