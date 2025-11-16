import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { AUTH_ERRORS, API_ERRORS } from '@/lib/errors';
import { publishShoppingEvent } from '@/lib/realtime/ably-server';

const SHOPPING_LIST_ERRORS = {
  INVALID_STORE_ID: 'Invalid store ID',
  STORE_NOT_FOUND: 'Store not found',
  ITEM_NOT_FOUND: 'Item not found in shopping list',
};

function logError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}

type RouteParams = {
  params: Promise<{ storeId: string; foodItemId: string }>;
};

/**
 * Toggle the checked status of a shopping list item
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { storeId, foodItemId } = await params;
    
    if (!ObjectId.isValid(storeId)) {
      return NextResponse.json({ error: SHOPPING_LIST_ERRORS.INVALID_STORE_ID }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');
    const shoppingListsCollection = db.collection('shoppingLists');

    // Verify store exists and user has access
    const store = await storesCollection.findOne({
      $or: [
        { _id: ObjectId.createFromHexString(storeId), userId: session.user.id },
        { _id: ObjectId.createFromHexString(storeId), 'invitations.userId': session.user.id, 'invitations.status': 'accepted' }
      ]
    });

    if (!store) {
      return NextResponse.json({ error: SHOPPING_LIST_ERRORS.STORE_NOT_FOUND }, { status: 404 });
    }

    // Get the shopping list
    const shoppingList = await shoppingListsCollection.findOne({ storeId });

    if (!shoppingList) {
      return NextResponse.json({ error: SHOPPING_LIST_ERRORS.STORE_NOT_FOUND }, { status: 404 });
    }

    // Find the item and toggle its checked status
    const itemIndex = shoppingList.items.findIndex(
      (item: { foodItemId: string }) => item.foodItemId === foodItemId
    );

    if (itemIndex === -1) {
      return NextResponse.json({ error: SHOPPING_LIST_ERRORS.ITEM_NOT_FOUND }, { status: 404 });
    }

    const currentChecked = shoppingList.items[itemIndex].checked || false;
    const newChecked = !currentChecked;

    // Update the item
    await shoppingListsCollection.updateOne(
      { storeId },
      {
        $set: {
          [`items.${itemIndex}.checked`]: newChecked,
          updatedAt: new Date()
        }
      }
    );

    // Get the updated shopping list
    const updatedList = await shoppingListsCollection.findOne({ storeId });

    // Broadcast the change to other users via Ably
    await publishShoppingEvent(storeId, 'item_checked', {
      foodItemId,
      checked: newChecked,
      updatedBy: session.user.email,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      foodItemId,
      checked: newChecked,
      items: updatedList?.items || []
    });
  } catch (error) {
    logError('Shopping List Item Toggle PATCH', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

