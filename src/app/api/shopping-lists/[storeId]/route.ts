import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
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

    // Verify store exists and belongs to user
    const store = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(storeId),
      userId: session.user.id
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
      await shoppingListsCollection.insertOne(newList);
      shoppingList = newList;
    }

    // Populate food item names
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

      shoppingList.items = shoppingList.items.map((item: { foodItemId: string; quantity: number }) => {
        const foodItem = foodItemMap.get(item.foodItemId);
        return {
          ...item,
          name: foodItem ? (item.quantity === 1 ? foodItem.singularName : foodItem.pluralName) : 'Unknown',
          unit: foodItem?.unit || 'piece'
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

    // Verify store exists and belongs to user
    const store = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(storeId),
      userId: session.user.id
    });

    if (!store) {
      return NextResponse.json({ error: SHOPPING_LIST_ERRORS.STORE_NOT_FOUND }, { status: 404 });
    }

    // Update or create the shopping list
    const result = await shoppingListsCollection.updateOne(
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
    let shoppingList = await shoppingListsCollection.findOne({ storeId });

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

      shoppingList.items = shoppingList.items.map((item: { foodItemId: string; quantity: number }) => {
        const foodItem = foodItemMap.get(item.foodItemId);
        return {
          ...item,
          name: foodItem ? (item.quantity === 1 ? foodItem.singularName : foodItem.pluralName) : 'Unknown',
          unit: foodItem?.unit || 'piece'
        };
      });
    }

    return NextResponse.json(shoppingList);
  } catch (error) {
    logError('Shopping Lists PUT [storeId]', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

