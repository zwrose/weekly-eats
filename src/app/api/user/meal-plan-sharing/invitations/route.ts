import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { AUTH_ERRORS, API_ERRORS } from '@/lib/errors';

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

    // Get all users who have invited the current user
    const owners = await usersCollection
      .find({
        'settings.mealPlanSharing.invitations': {
          $elemMatch: {
            userId: session.user.id,
            status: 'pending'
          }
        }
      })
      .toArray();

    // Extract only the relevant invitation for this user from each owner
    const pendingInvitations = owners.map(owner => {
      const userInvitation = owner.settings?.mealPlanSharing?.invitations?.find(
        (inv: { userId: string; status: string }) =>
          inv.userId === session.user.id && inv.status === 'pending'
      );

      return {
        ownerId: owner._id.toString(),
        ownerEmail: owner.email,
        ownerName: owner.name,
        invitation: userInvitation
      };
    }).filter(item => item.invitation);

    return NextResponse.json(pendingInvitations);
  } catch (error) {
    logError('Meal Plan Sharing Invitations GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

