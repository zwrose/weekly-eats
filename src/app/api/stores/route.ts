import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { AUTH_ERRORS, API_ERRORS } from '@/lib/errors';

const STORE_ERRORS = {
  INVALID_NAME: 'Store name is required',
  STORE_NOT_FOUND: 'Store not found',
  DUPLICATE_STORE: 'A store with this name already exists',
};

function logError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');
    const shoppingListsCollection = db.collection('shoppingLists');

    // Get stores owned by user OR where user has accepted invitation
    const stores = await storesCollection
      .find({
        $or: [
          { userId: session.user.id },
          { 'invitations.userId': session.user.id, 'invitations.status': 'accepted' }
        ]
      })
      .toArray();

    // Get shopping lists for all stores
    const storeIds = stores.map(store => store._id);
    const shoppingLists = await shoppingListsCollection
      .find({ storeId: { $in: storeIds.map(id => id.toString()) } })
      .toArray();

    // Create a map of storeId -> shoppingList
    const shoppingListMap = new Map(
      shoppingLists.map(list => [list.storeId, list])
    );

    // Combine stores with their shopping lists
    const storesWithLists = stores.map(store => ({
      ...store,
      shoppingList: shoppingListMap.get(store._id.toString()) || {
        _id: null,
        storeId: store._id.toString(),
        userId: session.user.id,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }));

    // Sort by shopping list updatedAt (most recently edited first)
    storesWithLists.sort((a, b) => {
      const aUpdated = a.shoppingList?.updatedAt ? new Date(a.shoppingList.updatedAt).getTime() : 0;
      const bUpdated = b.shoppingList?.updatedAt ? new Date(b.shoppingList.updatedAt).getTime() : 0;
      return bUpdated - aUpdated;
    });

    return NextResponse.json(storesWithLists);
  } catch (error) {
    logError('Stores GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const body = await request.json();
    const { name, emoji } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: STORE_ERRORS.INVALID_NAME }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');

    // Check for duplicate store name for this user
    const existingStore = await storesCollection.findOne({
      userId: session.user.id,
      name: name.trim()
    });

    if (existingStore) {
      return NextResponse.json({ error: STORE_ERRORS.DUPLICATE_STORE }, { status: 400 });
    }

    const newStore = {
      userId: session.user.id,
      name: name.trim(),
      emoji: emoji || '🏪',
      invitations: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await storesCollection.insertOne(newStore);

    // Create an empty shopping list for this store
    const shoppingListsCollection = db.collection('shoppingLists');
    const newShoppingList = {
      storeId: result.insertedId.toString(),
      userId: session.user.id,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await shoppingListsCollection.insertOne(newShoppingList);

    return NextResponse.json({ 
      ...newStore, 
      _id: result.insertedId,
      shoppingList: newShoppingList
    }, { status: 201 });
  } catch (error) {
    logError('Stores POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

