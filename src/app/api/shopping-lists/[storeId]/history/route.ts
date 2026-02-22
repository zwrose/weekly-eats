import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { AUTH_ERRORS, API_ERRORS, SHOPPING_LIST_ERRORS, logError } from '@/lib/errors';

type RouteParams = {
  params: Promise<{ storeId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { storeId } = await params;
    if (!ObjectId.isValid(storeId)) {
      return NextResponse.json({ error: SHOPPING_LIST_ERRORS.INVALID_STORE_ID }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();

    // Verify store exists and user has access (owner or accepted invitation)
    const store = await db.collection('stores').findOne({
      _id: ObjectId.createFromHexString(storeId),
      $or: [
        { userId: session.user.id },
        { 'invitations.userId': session.user.id, 'invitations.status': 'accepted' },
      ],
    });

    if (!store) {
      return NextResponse.json({ error: SHOPPING_LIST_ERRORS.STORE_NOT_FOUND }, { status: 404 });
    }

    const history = await db
      .collection('purchaseHistory')
      .find({ storeId })
      .sort({ lastPurchasedAt: -1 })
      .toArray();

    return NextResponse.json(history);
  } catch (error) {
    logError('Purchase History GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
