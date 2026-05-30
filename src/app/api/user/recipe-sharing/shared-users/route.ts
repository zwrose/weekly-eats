import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { API_ERRORS, logError } from '@/lib/errors';
import { ObjectId } from 'mongodb';
import { RecipeSharingInvitation } from '@/lib/user-settings';
import { requireApprovedSession } from '@/lib/user-utils';

export async function GET() {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Get the current user's document to find who THEY have invited
    const currentUser = await usersCollection.findOne({
      _id: ObjectId.createFromHexString(session.user.id),
    });

    const acceptedInvitations = (currentUser?.settings?.recipeSharing?.invitations?.filter(
      (inv: RecipeSharingInvitation) => inv.status === 'accepted'
    ) || []) as RecipeSharingInvitation[];

    // Get user info for each accepted invitation
    const sharedUserIds = acceptedInvitations.map((inv: RecipeSharingInvitation) => inv.userId);

    if (sharedUserIds.length === 0) {
      return NextResponse.json([]);
    }

    const sharedUsersData = await usersCollection
      .find({ _id: { $in: sharedUserIds.map((id: string) => ObjectId.createFromHexString(id)) } })
      .toArray();

    // Return user info for each shared user with their sharing types
    const sharedUsers = sharedUsersData.map((user) => {
      const invitation = acceptedInvitations.find(
        (inv: RecipeSharingInvitation) => inv.userId === user._id.toString()
      );
      return {
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        sharingTypes: invitation?.sharingTypes || [],
      };
    });

    return NextResponse.json(sharedUsers);
  } catch (error) {
    logError('Recipe Sharing Shared Users GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
