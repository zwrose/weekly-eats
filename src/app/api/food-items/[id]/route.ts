import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { 
  AUTH_ERRORS, 
  FOOD_ITEM_ERRORS, 
  API_ERRORS,
  logError 
} from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
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
    const body = await request.json();
    const { name, singularName, pluralName, unit, isGlobal } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: FOOD_ITEM_ERRORS.NAME_REQUIRED }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const foodItemsCollection = db.collection('foodItems');

    // Check if food item exists and user has permission to edit
    const existingItem = await foodItemsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingItem) {
      return NextResponse.json({ error: FOOD_ITEM_ERRORS.FOOD_ITEM_NOT_FOUND }, { status: 404 });
    }

    const isAdmin = (session.user as { isAdmin?: boolean })?.isAdmin;
    const isOwner = existingItem.createdBy === session.user.id;

    // Check permissions
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: AUTH_ERRORS.FORBIDDEN }, { status: 403 });
    }

    // Non-admins can only edit their own personal items
    if (!isAdmin && existingItem.isGlobal) {
      return NextResponse.json({ error: FOOD_ITEM_ERRORS.ONLY_ADMINS_CAN_EDIT_GLOBAL }, { status: 403 });
    }

    // Validate isGlobal changes
    if (isGlobal !== undefined && typeof isGlobal === 'boolean') {
      // Prevent making global items personal
      if (existingItem.isGlobal && !isGlobal) {
        return NextResponse.json({ error: FOOD_ITEM_ERRORS.CANNOT_MAKE_GLOBAL_PERSONAL }, { status: 400 });
      }
      
      // Only admins can make items global
      if (!existingItem.isGlobal && isGlobal && !isAdmin) {
        return NextResponse.json({ error: FOOD_ITEM_ERRORS.ONLY_ADMINS_CAN_MAKE_GLOBAL }, { status: 403 });
      }
    }

    const updateData: {
      name: string;
      singularName: string;
      pluralName: string;
      unit: string | null;
      updatedAt: Date;
      isGlobal?: boolean;
    } = {
      name: name.trim(),
      singularName: singularName?.trim() || name.trim(),
      pluralName: pluralName?.trim() || name.trim(),
      unit: unit?.trim() || null,
      updatedAt: new Date()
    };

    // Only include isGlobal in update if it's being changed and the change is valid
    if (isGlobal !== undefined && typeof isGlobal === 'boolean' && isGlobal !== existingItem.isGlobal) {
      updateData.isGlobal = isGlobal;
    }

    const result = await foodItemsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: FOOD_ITEM_ERRORS.FOOD_ITEM_NOT_FOUND }, { status: 404 });
    }

    const updatedItem = await foodItemsCollection.findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updatedItem);
  } catch (error) {
    logError('FoodItems PUT', error);
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const client = await getMongoClient();
    const db = client.db();
    const foodItemsCollection = db.collection('foodItems');

    // Check if food item exists
    const existingItem = await foodItemsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingItem) {
      return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
    }

    const isAdmin = (session.user as { isAdmin?: boolean })?.isAdmin;
    const isOwner = existingItem.createdBy === session.user.id;

    // Check permissions
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Non-admins can only delete their own personal items
    if (!isAdmin && existingItem.isGlobal) {
      return NextResponse.json({ error: 'Only admins can delete global items' }, { status: 403 });
    }

    const result = await foodItemsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Food item deleted successfully' });
  } catch (error) {
    console.error('Error deleting food item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 