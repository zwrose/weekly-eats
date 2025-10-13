import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { AUTH_ERRORS, API_ERRORS } from '@/lib/errors';

const STORE_ERRORS = {
  INVALID_STORE_ID: 'Invalid store ID',
  STORE_NOT_FOUND: 'Store not found',
  INVALID_NAME: 'Store name is required',
  DUPLICATE_STORE: 'A store with this name already exists',
};

function logError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}

type RouteParams = {
  params: Promise<{ id: string }>;
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

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: STORE_ERRORS.INVALID_STORE_ID }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');
    const shoppingListsCollection = db.collection('shoppingLists');

    const store = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(id),
      userId: session.user.id
    });

    if (!store) {
      return NextResponse.json({ error: STORE_ERRORS.STORE_NOT_FOUND }, { status: 404 });
    }

    // Get the shopping list for this store
    const shoppingList = await shoppingListsCollection.findOne({
      storeId: id
    });

    return NextResponse.json({
      ...store,
      shoppingList: shoppingList || {
        _id: null,
        storeId: id,
        userId: session.user.id,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  } catch (error) {
    logError('Stores GET [id]', error);
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

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: STORE_ERRORS.INVALID_STORE_ID }, { status: 400 });
    }

    const body = await request.json();
    const { name, emoji } = body;

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');

    const store = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(id),
      userId: session.user.id
    });

    if (!store) {
      return NextResponse.json({ error: STORE_ERRORS.STORE_NOT_FOUND }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date()
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: STORE_ERRORS.INVALID_NAME }, { status: 400 });
      }

      // Check for duplicate store name (excluding current store)
      const existingStore = await storesCollection.findOne({
        userId: session.user.id,
        name: name.trim(),
        _id: { $ne: ObjectId.createFromHexString(id) }
      });

      if (existingStore) {
        return NextResponse.json({ error: STORE_ERRORS.DUPLICATE_STORE }, { status: 400 });
      }

      updates.name = name.trim();
    }

    if (emoji !== undefined) {
      updates.emoji = emoji;
    }

    await storesCollection.updateOne(
      { _id: ObjectId.createFromHexString(id) },
      { $set: updates }
    );

    const updatedStore = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(id)
    });

    return NextResponse.json(updatedStore);
  } catch (error) {
    logError('Stores PUT [id]', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: STORE_ERRORS.INVALID_STORE_ID }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');
    const shoppingListsCollection = db.collection('shoppingLists');

    const store = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(id),
      userId: session.user.id
    });

    if (!store) {
      return NextResponse.json({ error: STORE_ERRORS.STORE_NOT_FOUND }, { status: 404 });
    }

    // Check if store has accepted users
    const acceptedInvitations = store.invitations?.filter(
      (inv: { status: string }) => inv.status === 'accepted'
    ) || [];
    
    // Return info about accepted users (frontend will show warning)
    const sharedUserCount = acceptedInvitations.length;

    // Delete the shopping list first
    await shoppingListsCollection.deleteOne({ storeId: id });

    // Delete the store
    await storesCollection.deleteOne({ _id: ObjectId.createFromHexString(id) });

    return NextResponse.json({ success: true, sharedUserCount });
  } catch (error) {
    logError('Stores DELETE [id]', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

