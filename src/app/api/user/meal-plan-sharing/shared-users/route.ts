import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { AUTH_ERRORS, API_ERRORS, logError } from '@/lib/errors';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Get the current user's document to find who THEY have invited
    const currentUser = await usersCollection.findOne({
      _id: ObjectId.createFromHexString(session.user.id),
    });

    // Include both accepted invitees and those still pending, so the share UI can show a
    // "pending" state for people you've invited who haven't accepted yet.
    const relevantInvitations: { userId: string; status: 'pending' | 'accepted' }[] =
      currentUser?.settings?.mealPlanSharing?.invitations?.filter(
        (inv: { status: string }) => inv.status === 'accepted' || inv.status === 'pending'
      ) || [];

    const sharedUserIds = relevantInvitations.map((inv) => inv.userId);

    if (sharedUserIds.length === 0) {
      return NextResponse.json([]);
    }

    const statusByUserId = new Map(relevantInvitations.map((inv) => [inv.userId, inv.status]));

    const sharedUsersData = await usersCollection
      .find({ _id: { $in: sharedUserIds.map((id: string) => ObjectId.createFromHexString(id)) } })
      .toArray();

    // Return user info + sharing status for each shared user.
    const sharedUsers = sharedUsersData.map((user) => ({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      status: statusByUserId.get(user._id.toString()),
    }));

    return NextResponse.json(sharedUsers);
  } catch (error) {
    logError('Meal Plan Sharing Shared Users GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
