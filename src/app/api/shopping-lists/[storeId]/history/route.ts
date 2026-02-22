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

    // Re-resolve food item names from the foodItems collection
    if (history.length > 0) {
      const foodItemIds = history
        .map((h) => h.foodItemId)
        .filter((id): id is string => typeof id === 'string' && ObjectId.isValid(id));
      if (foodItemIds.length > 0) {
        const foodItems = await db
          .collection('foodItems')
          .find({ _id: { $in: foodItemIds.map((id) => new ObjectId(id)) } })
          .toArray();
        const foodItemMap = new Map(foodItems.map((fi) => [fi._id.toString(), fi]));
        for (const record of history) {
          const foodItem = foodItemMap.get(String(record.foodItemId));
          if (foodItem) {
            record.name = record.quantity === 1 ? foodItem.singularName : foodItem.pluralName;
          }
        }
      }
    }

    return NextResponse.json(history);
  } catch (error) {
    logError('Purchase History GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
