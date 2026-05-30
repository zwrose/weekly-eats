import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { API_ERRORS, logError } from '@/lib/errors';
import { requireApprovedSession } from '@/lib/user-utils';

export async function GET() {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Get all users who have invited the current user
    const owners = await usersCollection
      .find({
        'settings.recipeSharing.invitations': {
          $elemMatch: {
            userId: session.user.id,
            status: 'pending',
          },
        },
      })
      .toArray();

    // Extract only the relevant invitation for this user from each owner
    const pendingInvitations = owners
      .map((owner) => {
        const userInvitation = owner.settings?.recipeSharing?.invitations?.find(
          (inv: { userId: string; status: string }) =>
            inv.userId === session.user.id && inv.status === 'pending'
        );

        return {
          ownerId: owner._id.toString(),
          ownerEmail: owner.email,
          ownerName: owner.name,
          invitation: userInvitation,
        };
      })
      .filter((item) => item.invitation);

    return NextResponse.json(pendingInvitations);
  } catch (error) {
    logError('Recipe Sharing Invitations GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
