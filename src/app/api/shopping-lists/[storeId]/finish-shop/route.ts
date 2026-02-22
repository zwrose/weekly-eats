import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { publishShoppingEvent } from '@/lib/realtime/ably-server';
import { ObjectId } from 'mongodb';
import {
  AUTH_ERRORS,
  API_ERRORS,
  SHOPPING_LIST_ERRORS,
  PURCHASE_HISTORY_ERRORS,
  logError,
} from '@/lib/errors';

type RouteParams = {
  params: Promise<{ storeId: string }>;
};

interface CheckedItem {
  foodItemId: string;
  name: string;
  quantity: number;
  unit: string;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { storeId } = await params;
    if (!ObjectId.isValid(storeId)) {
      return NextResponse.json({ error: SHOPPING_LIST_ERRORS.INVALID_STORE_ID }, { status: 400 });
    }

    const body = await request.json();
    const { checkedItems } = body as { checkedItems: CheckedItem[] };

    const client = await getMongoClient();
    const db = client.db();

    // Verify store exists and user has access
    const store = await db.collection('stores').findOne({
      _id: ObjectId.createFromHexString(storeId),
      $or: [
        { userId: session.user.id },
        { 'invitations.userId': session.user.id, 'invitations.status': 'accepted' }
      ]
    });

    if (!store) {
      return NextResponse.json({ error: SHOPPING_LIST_ERRORS.STORE_NOT_FOUND }, { status: 404 });
    }

    if (!Array.isArray(checkedItems) || checkedItems.length === 0) {
      return NextResponse.json({ error: PURCHASE_HISTORY_ERRORS.NO_CHECKED_ITEMS }, { status: 400 });
    }

    // Get current shopping list
    const shoppingList = await db.collection('shoppingLists').findOne({ storeId });
    const currentItems = shoppingList?.items || [];

    // Re-resolve food item names from the database before persisting
    const now = new Date();
    const checkedFoodItemIds = new Set(checkedItems.map(i => i.foodItemId));
    const validFoodItemIds = checkedItems
      .map(i => i.foodItemId)
      .filter(id => ObjectId.isValid(id));
    const foodItems = validFoodItemIds.length > 0
      ? await db.collection('foodItems')
          .find({ _id: { $in: validFoodItemIds.map(id => new ObjectId(id)) } })
          .toArray()
      : [];
    const foodItemMap = new Map(
      foodItems.map(fi => [fi._id.toString(), fi])
    );

    // Build upsert operations for purchase history
    const bulkOps = checkedItems.map((item: CheckedItem) => {
      const foodItem = foodItemMap.get(item.foodItemId);
      const resolvedName = foodItem
        ? (item.quantity === 1 ? foodItem.singularName : foodItem.pluralName)
        : item.name;
      return {
      updateOne: {
        filter: { storeId, foodItemId: item.foodItemId },
        update: {
          $set: {
            name: resolvedName,
            quantity: item.quantity,
            unit: item.unit,
            lastPurchasedAt: now,
          },
          $setOnInsert: {
            storeId,
            foodItemId: item.foodItemId,
          },
        },
        upsert: true,
      },
    };
    });

    await db.collection('purchaseHistory').bulkWrite(bulkOps);

    // Remove checked items from shopping list
    const remainingItems = currentItems.filter(
      (item: { foodItemId: string }) => !checkedFoodItemIds.has(item.foodItemId)
    );

    await db.collection('shoppingLists').updateOne(
      { storeId },
      { $set: { items: remainingItems, updatedAt: now } }
    );

    // Broadcast update via Ably
    await publishShoppingEvent(storeId, 'list_updated', {
      items: remainingItems,
      updatedBy: session.user.email,
      timestamp: now.toISOString(),
    });

    return NextResponse.json({ success: true, remainingItems });
  } catch (error) {
    logError('Finish Shop POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
