import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { AUTH_ERRORS, API_ERRORS } from '@/lib/errors';
import { RecipeSharingInvitation } from '@/lib/user-settings';

function logError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Get all users who have accepted invitations FROM the current user (users whose recipe data you can access)
    const owners = await usersCollection
      .find({
        'settings.recipeSharing.invitations': {
          $elemMatch: {
            userId: session.user.id,
            status: 'accepted'
          }
        }
      })
      .toArray();

    // Return user info for each owner with their sharing types
    const sharedOwners = owners.map(owner => {
      const invitation = (owner.settings?.recipeSharing?.invitations || []).find(
        (inv: RecipeSharingInvitation) => inv.userId === session.user.id && inv.status === 'accepted'
      ) as RecipeSharingInvitation | undefined;

      return {
        userId: owner._id.toString(),
        email: owner.email,
        name: owner.name,
        sharingTypes: invitation?.sharingTypes || []
      };
    });

    return NextResponse.json(sharedOwners);
  } catch (error) {
    logError('Recipe Sharing Owners GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}


