import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { publishShoppingEvent } from '@/lib/realtime/ably-server';
import { ObjectId } from 'mongodb';
import { AUTH_ERRORS, API_ERRORS } from '@/lib/errors';

const SHOPPING_LIST_ERRORS = {
  INVALID_STORE_ID: 'Invalid store ID',
  STORE_NOT_FOUND: 'Store not found',
  SHOPPING_LIST_NOT_FOUND: 'Shopping list not found',
  INVALID_ITEMS: 'Invalid items array',
  DUPLICATE_FOOD_ITEM: 'Food item already exists in the shopping list',
};

function logError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}

type RouteParams = {
  params: Promise<{ storeId: string }>;
};

export async function GET(
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

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');
    const shoppingListsCollection = db.collection('shoppingLists');
    const foodItemsCollection = db.collection('foodItems');

    // Verify store exists and user has access (owner or accepted invitation)
    const store = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(storeId),
      $or: [
        { userId: session.user.id },
        { 'invitations.userId': session.user.id, 'invitations.status': 'accepted' }
      ]
    });

    if (!store) {
      return NextResponse.json({ error: SHOPPING_LIST_ERRORS.STORE_NOT_FOUND }, { status: 404 });
    }

    // Get the shopping list
    let shoppingList = await shoppingListsCollection.findOne({ storeId });

    // If no shopping list exists, create an empty one
    if (!shoppingList) {
      const newList = {
        storeId,
        userId: session.user.id,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const insertResult = await shoppingListsCollection.insertOne(newList);
      shoppingList = await shoppingListsCollection.findOne({ _id: insertResult.insertedId });
      if (!shoppingList) {
        return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
      }
    }

    // Populate food item names, but preserve per-list units and quantities
    if (shoppingList.items && shoppingList.items.length > 0) {
      const foodItemIds = shoppingList.items.map((item: { foodItemId: string }) => 
        ObjectId.createFromHexString(item.foodItemId)
      );
      const foodItems = await foodItemsCollection.find({
        _id: { $in: foodItemIds }
      }).toArray();

      const foodItemMap = new Map(
        foodItems.map(item => [item._id.toString(), item])
      );

      shoppingList.items = shoppingList.items.map((item: { foodItemId: string; quantity: number; unit?: string }) => {
        const foodItem = foodItemMap.get(item.foodItemId);
        return {
          ...item,
          name: foodItem ? (item.quantity === 1 ? foodItem.singularName : foodItem.pluralName) : 'Unknown',
          // Preserve per-list unit if present; fall back to foodItem unit, then 'piece'
          unit: item.unit ?? foodItem?.unit ?? 'piece'
        };
      });
    }

    return NextResponse.json(shoppingList);
  } catch (error) {
    logError('Shopping Lists GET [storeId]', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function PUT(
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
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: SHOPPING_LIST_ERRORS.INVALID_ITEMS }, { status: 400 });
    }

    // Check for duplicate food items
    const foodItemIds = items.map(item => item.foodItemId);
    const uniqueFoodItemIds = new Set(foodItemIds);
    if (foodItemIds.length !== uniqueFoodItemIds.size) {
      return NextResponse.json({ error: SHOPPING_LIST_ERRORS.DUPLICATE_FOOD_ITEM }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');
    const shoppingListsCollection = db.collection('shoppingLists');
    const foodItemsCollection = db.collection('foodItems');

    // Verify store exists and user has access (owner or accepted invitation)
    const store = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(storeId),
      $or: [
        { userId: session.user.id },
        { 'invitations.userId': session.user.id, 'invitations.status': 'accepted' }
      ]
    });

    if (!store) {
      return NextResponse.json({ error: SHOPPING_LIST_ERRORS.STORE_NOT_FOUND }, { status: 404 });
    }

    // Capture previous items to detect deletions
    const previousList = await shoppingListsCollection.findOne({ storeId });
    const previousItems: { foodItemId: string }[] = Array.isArray(previousList?.items)
      ? previousList!.items
      : [];

    // Update or create the shopping list
    await shoppingListsCollection.updateOne(
      { storeId },
      {
        $set: {
          items,
          updatedAt: new Date()
        },
        $setOnInsert: {
          userId: session.user.id,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    // Get the updated shopping list with populated names
    const shoppingList = await shoppingListsCollection.findOne({ storeId });

    if (shoppingList && shoppingList.items && shoppingList.items.length > 0) {
      const foodItemIds = shoppingList.items.map((item: { foodItemId: string }) => 
        ObjectId.createFromHexString(item.foodItemId)
      );
      const foodItems = await foodItemsCollection.find({
        _id: { $in: foodItemIds }
      }).toArray();

      const foodItemMap = new Map(
        foodItems.map(item => [item._id.toString(), item])
      );

      shoppingList.items = shoppingList.items.map((item: { foodItemId: string; quantity: number; unit?: string }) => {
        const foodItem = foodItemMap.get(item.foodItemId);
        return {
          ...item,
          name: foodItem ? (item.quantity === 1 ? foodItem.singularName : foodItem.pluralName) : 'Unknown',
          // Preserve per-list unit if present; fall back to foodItem unit, then 'piece'
          unit: item.unit ?? foodItem?.unit ?? 'piece'
        };
      });
    }

    const timestamp = new Date().toISOString();

    // Detect deleted items and broadcast item_deleted events
    if (previousItems.length > 0) {
      const newItemIds = new Set(
        (shoppingList?.items || []).map(
          (item: { foodItemId: string }) => item.foodItemId
        )
      );

      const deletedItemIds = previousItems
        .map(item => item.foodItemId)
        .filter(foodItemId => !newItemIds.has(foodItemId));

      await Promise.all(
        deletedItemIds.map((foodItemId) =>
          publishShoppingEvent(storeId, 'item_deleted', {
            foodItemId,
            updatedBy: session.user.email,
            timestamp,
          })
        )
      );
    }

    // Broadcast the updated list
    await publishShoppingEvent(storeId, 'list_updated', {
      items: shoppingList?.items || [],
      updatedBy: session.user.email,
      timestamp,
    });

    return NextResponse.json(shoppingList);
  } catch (error) {
    logError('Shopping Lists PUT [storeId]', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

