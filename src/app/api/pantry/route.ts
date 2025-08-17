import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { 
  AUTH_ERRORS, 
  PANTRY_ERRORS, 
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

    const client = await getMongoClient();
    const db = client.db();
    const pantryCollection = db.collection('pantry');

    // Build query
    const filter: Record<string, unknown> = { userId: session.user.id };

    // Add search filter if query is provided
    if (query.trim()) {
      // We'll filter by food item name after the join
    }

    const pantryItems = await pantryCollection
      .find(filter)
      .sort({ addedAt: -1 })
      .limit(limit)
      .toArray();

    // Join with food items to get the names
    const foodItemsCollection = db.collection('foodItems');
    const foodItemIds = pantryItems.map(item => new ObjectId(item.foodItemId));
    const foodItems = await foodItemsCollection
      .find({ _id: { $in: foodItemIds } })
      .toArray();
    
    const foodItemsMap = new Map(foodItems.map(item => [item._id.toString(), item]));

    // Transform the data to include food item details and filter by search term
    let transformedItems = pantryItems.map(item => {
      const foodItem = foodItemsMap.get(item.foodItemId);
      if (!foodItem) return null; // Skip items with missing food items
      
      return {
        ...item,
        foodItem: {
          _id: foodItem._id,
          name: foodItem.name,
          singularName: foodItem.singularName,
          pluralName: foodItem.pluralName,
          unit: foodItem.unit
        }
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null); // Remove null items

    // Apply search filter if query is provided
    if (query.trim()) {
      transformedItems = transformedItems.filter(item => 
        item.foodItem.name.toLowerCase().includes(query.toLowerCase()) ||
        item.foodItem.singularName.toLowerCase().includes(query.toLowerCase()) ||
        item.foodItem.pluralName.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Sort by food item name
    transformedItems.sort((a, b) => a.foodItem.name.localeCompare(b.foodItem.name));

    return NextResponse.json(transformedItems);
  } catch (error) {
    console.error('Error fetching pantry items:', error);
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
    const { foodItemId } = body;

    // Validation
    if (!foodItemId || typeof foodItemId !== 'string') {
      return NextResponse.json({ error: PANTRY_ERRORS.FOOD_ITEM_ID_REQUIRED }, { status: 400 });
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(foodItemId)) {
      return NextResponse.json({ error: 'Invalid food item ID format' }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const pantryCollection = db.collection('pantry');
    const foodItemsCollection = db.collection('foodItems');

    // Verify food item exists
    const foodItem = await foodItemsCollection.findOne({ _id: new ObjectId(foodItemId) });
    if (!foodItem) {
      return NextResponse.json({ error: PANTRY_ERRORS.FOOD_ITEM_NOT_FOUND }, { status: 404 });
    }

    // Check if item already exists in user's pantry
    const existingItem = await pantryCollection.findOne({
      userId: session.user.id,
      foodItemId: foodItemId
    });

    if (existingItem) {
      return NextResponse.json({ error: PANTRY_ERRORS.ITEM_ALREADY_EXISTS }, { status: 409 });
    }

    const newPantryItem = {
      userId: session.user.id,
      foodItemId: foodItemId,
      addedAt: new Date()
    };

    const result = await pantryCollection.insertOne(newPantryItem);
    const createdItem = await pantryCollection.findOne({ _id: result.insertedId });

    if (!createdItem) {
      return NextResponse.json({ error: PANTRY_ERRORS.PANTRY_ITEM_CREATION_FAILED }, { status: 500 });
    }

    // Transform the data to include food item details
    const transformedItem = {
      ...createdItem,
      foodItem: {
        _id: foodItem._id,
        name: foodItem.name,
        singularName: foodItem.singularName,
        pluralName: foodItem.pluralName,
        unit: foodItem.unit
      }
    };

    return NextResponse.json(transformedItem, { status: 201 });
  } catch (error) {
    logError('Pantry POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const foodItemId = searchParams.get('foodItemId');

    if (!foodItemId) {
      return NextResponse.json({ error: 'Food item ID is required' }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const pantryCollection = db.collection('pantry');

    const result = await pantryCollection.deleteOne({
      userId: session.user.id,
      foodItemId: foodItemId
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Item not found in pantry' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Item removed from pantry' });
  } catch (error) {
    console.error('Error removing pantry item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 