import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { VALID_UNITS } from '@/lib/food-items-utils';
import { 
  AUTH_ERRORS, 
  FOOD_ITEM_ERRORS, 
  API_ERRORS,
  logError 
} from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const limit = parseInt(searchParams.get('limit') || '10');
    const userOnly = searchParams.get('userOnly') === 'true';
    const globalOnly = searchParams.get('globalOnly') === 'true';
    const excludeUserCreated = searchParams.get('excludeUserCreated') === 'true';

    const client = await getMongoClient();
    const db = client.db();
    const foodItemsCollection = db.collection('foodItems');

    // Build query based on filter parameters
    let filter: Record<string, unknown> = {};

    if (userOnly) {
      // Only user's personal items (including global items they created)
      filter = { 
        $or: [
          { createdBy: session.user.id },
          { isGlobal: true, createdBy: session.user.id }
        ]
      };
    } else if (globalOnly) {
      if (excludeUserCreated) {
        // Only global items NOT created by the current user
        filter = { isGlobal: true, createdBy: { $ne: session.user.id } };
      } else {
        // Only global items
        filter = { isGlobal: true };
      }
    } else {
      // Default: both global and user's personal items
      filter = {
        $or: [
          { isGlobal: true },
          { createdBy: session.user.id }
        ]
      };
    }

    // Add search filter if query is provided
    if (query.trim()) {
      filter.name = { $regex: query, $options: 'i' };
    }

    const foodItems = await foodItemsCollection
      .find(filter)
      .sort({ name: 1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(foodItems);
  } catch (error) {
    console.error('Error fetching food items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const body = await request.json();
    const { name, singularName, pluralName, unit, isGlobal } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: FOOD_ITEM_ERRORS.NAME_REQUIRED }, { status: 400 });
    }

    if (!singularName || typeof singularName !== 'string' || singularName.trim().length === 0) {
      return NextResponse.json({ error: FOOD_ITEM_ERRORS.SINGULAR_NAME_REQUIRED }, { status: 400 });
    }

    if (!pluralName || typeof pluralName !== 'string' || pluralName.trim().length === 0) {
      return NextResponse.json({ error: FOOD_ITEM_ERRORS.PLURAL_NAME_REQUIRED }, { status: 400 });
    }

    if (!unit || typeof unit !== 'string' || !VALID_UNITS.includes(unit)) {
      return NextResponse.json({ error: FOOD_ITEM_ERRORS.UNIT_REQUIRED }, { status: 400 });
    }

    if (typeof isGlobal !== 'boolean') {
      return NextResponse.json({ error: FOOD_ITEM_ERRORS.IS_GLOBAL_REQUIRED }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const foodItemsCollection = db.collection('foodItems');

    const trimmedName = name.trim();
    const trimmedSingularName = singularName.trim();
    const trimmedPluralName = pluralName.trim();

    // Escape regex special characters to prevent injection issues
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Check if food item already exists (case-insensitive, check both singular and plural forms)
    const existingItem = await foodItemsCollection.findOne({
      $and: [
        {
          $or: [
            { singularName: { $regex: `^${escapeRegex(trimmedSingularName)}$`, $options: 'i' } },
            { pluralName: { $regex: `^${escapeRegex(trimmedPluralName)}$`, $options: 'i' } },
            { singularName: { $regex: `^${escapeRegex(trimmedPluralName)}$`, $options: 'i' } },
            { pluralName: { $regex: `^${escapeRegex(trimmedSingularName)}$`, $options: 'i' } }
          ]
        },
        {
          $or: [
            { isGlobal: true },
            { isGlobal: false, createdBy: session.user.id }
          ]
        }
      ]
    });

        if (existingItem) {
      return NextResponse.json({ 
        error: FOOD_ITEM_ERRORS.FOOD_ITEM_ALREADY_EXISTS,
        details: `A food item with name "${existingItem.singularName}" or "${existingItem.pluralName}" already exists`
      }, { status: 409 });
    }

    const newFoodItem = {
      name: trimmedName,
      singularName: trimmedSingularName,
      pluralName: trimmedPluralName,
      unit,
      isGlobal,
      isApproved: true, // All items are auto-approved since there's no admin approval
      createdBy: session.user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await foodItemsCollection.insertOne(newFoodItem);
    const createdItem = await foodItemsCollection.findOne({ _id: result.insertedId });

    return NextResponse.json(createdItem, { status: 201 });
  } catch (error) {
    logError('FoodItems POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
} 