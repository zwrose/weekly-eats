import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { requireApprovedSession } from '@/lib/user-utils';
import { API_ERRORS, logError } from '@/lib/errors';

export async function GET() {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');

    // Get all stores where user has pending invitation
    const stores = await storesCollection
      .find({
        'invitations.userId': session.user.id,
        'invitations.status': 'pending',
      })
      .toArray();

    // Extract only the relevant invitation for this user from each store
    const pendingInvitations = stores
      .map((store) => {
        const userInvitation = store.invitations?.find(
          (inv: { userId: string; status: string }) =>
            inv.userId === session.user.id && inv.status === 'pending'
        );

        return {
          storeId: store._id.toString(),
          storeName: store.name,
          storeEmoji: store.emoji,
          invitation: userInvitation,
        };
      })
      .filter((item) => item.invitation); // Filter out any that didn't have matching invitation

    return NextResponse.json(pendingInvitations);
  } catch (error) {
    logError('Store Invitations GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
