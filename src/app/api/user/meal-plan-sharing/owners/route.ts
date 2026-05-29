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

    // Get all users who have accepted invitations FROM the current user (users whose meal plans you can access)
    const owners = await usersCollection
      .find({
        'settings.mealPlanSharing.invitations': {
          $elemMatch: {
            userId: session.user.id,
            status: 'accepted',
          },
        },
      })
      .toArray();

    // Return user info for each owner
    const sharedOwners = owners.map((owner) => ({
      userId: owner._id.toString(),
      email: owner.email,
      name: owner.name,
    }));

    return NextResponse.json(sharedOwners);
  } catch (error) {
    logError('Meal Plan Sharing Owners GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
