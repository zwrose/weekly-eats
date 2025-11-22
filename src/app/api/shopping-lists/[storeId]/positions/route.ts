import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { AUTH_ERRORS, API_ERRORS } from '@/lib/errors';

function logError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}

type RouteParams = {
  params: Promise<{ storeId: string }>;
};

/**
 * GET /api/shopping-lists/[storeId]/positions
 * Retrieve positions for a store, optionally filtered by foodItemId
 */
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
      return NextResponse.json({ error: 'Invalid store ID' }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');
    const positionsCollection = db.collection('storeItemPositions');

    // Verify store exists and user has access (owner or accepted invitation)
    const store = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(storeId),
      $or: [
        { userId: session.user.id },
        { 'invitations.userId': session.user.id, 'invitations.status': 'accepted' }
      ]
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Check if querying for a specific food item
    const { searchParams } = new URL(request.url);
    const foodItemId = searchParams.get('foodItemId');

    if (foodItemId) {
      // Return position for specific food item
      if (!ObjectId.isValid(foodItemId)) {
        return NextResponse.json({ error: 'Invalid food item ID' }, { status: 400 });
      }

      const position = await positionsCollection.findOne({
        storeId,
        foodItemId
      });

      if (!position) {
        return NextResponse.json({ position: null });
      }

      return NextResponse.json({ position: position.position });
    } else {
      // Return all positions for the store
      const positions = await positionsCollection
        .find({ storeId })
        .sort({ position: 1 })
        .toArray();

      return NextResponse.json({
        positions: positions.map((p) => ({
          foodItemId: p.foodItemId,
          position: p.position,
          updatedAt: p.updatedAt
        }))
      });
    }
  } catch (error) {
    logError('Store Positions GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

/**
 * POST /api/shopping-lists/[storeId]/positions
 * Save positions for items in a store
 */
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
      return NextResponse.json({ error: 'Invalid store ID' }, { status: 400 });
    }

    const body = await request.json();
    const { positions } = body;

    if (!Array.isArray(positions)) {
      return NextResponse.json({ error: 'Positions must be an array' }, { status: 400 });
    }

    // Validate positions
    for (const pos of positions) {
      if (!pos.foodItemId || typeof pos.foodItemId !== 'string') {
        return NextResponse.json({ error: 'Invalid foodItemId in positions' }, { status: 400 });
      }
      if (typeof pos.position !== 'number' || pos.position < 0 || pos.position > 1) {
        return NextResponse.json({ error: 'Position must be a number between 0 and 1' }, { status: 400 });
      }
      if (!ObjectId.isValid(pos.foodItemId)) {
        return NextResponse.json({ error: 'Invalid food item ID format' }, { status: 400 });
      }
    }

    const client = await getMongoClient();
    const db = client.db();
    const storesCollection = db.collection('stores');
    const positionsCollection = db.collection('storeItemPositions');

    // Verify store exists and user has access (owner or accepted invitation)
    const store = await storesCollection.findOne({
      _id: ObjectId.createFromHexString(storeId),
      $or: [
        { userId: session.user.id },
        { 'invitations.userId': session.user.id, 'invitations.status': 'accepted' }
      ]
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Upsert positions
    const now = new Date();
    const operations = positions.map((pos: { foodItemId: string; position: number }) => ({
      updateOne: {
        filter: { storeId, foodItemId: pos.foodItemId },
        update: {
          $set: {
            storeId,
            foodItemId: pos.foodItemId,
            position: pos.position,
            updatedAt: now
          }
        },
        upsert: true
      }
    }));

    if (operations.length > 0) {
      await positionsCollection.bulkWrite(operations);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Store Positions POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

