import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { AUTH_ERRORS, PANTRY_ERRORS, FOOD_ITEM_ERRORS, API_ERRORS, logError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') || '10', 10);
    const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 100);

    const client = await getMongoClient();
    const db = client.db();
    const pantryCollection = db.collection('pantry');

    // Build aggregation pipeline: match user, join food items, filter by search, sort, paginate
    const pipeline: Record<string, unknown>[] = [
      { $match: { userId: session.user.id } },
      {
        $lookup: {
          from: 'foodItems',
          let: { fid: { $toObjectId: '$foodItemId' } },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$fid'] } } }],
          as: 'foodItemArr',
        },
      },
      { $unwind: '$foodItemArr' },
      {
        $addFields: {
          foodItem: {
            _id: '$foodItemArr._id',
            name: '$foodItemArr.name',
            singularName: '$foodItemArr.singularName',
            pluralName: '$foodItemArr.pluralName',
            unit: '$foodItemArr.unit',
          },
        },
      },
      { $unset: 'foodItemArr' },
    ];

    // Search filter on food item names
    if (query.trim()) {
      pipeline.push({
        $match: {
          $or: [
            { 'foodItem.name': { $regex: query, $options: 'i' } },
            { 'foodItem.singularName': { $regex: query, $options: 'i' } },
            { 'foodItem.pluralName': { $regex: query, $options: 'i' } },
          ],
        },
      });
    }

    // Sort by food item name ascending
    pipeline.push({ $sort: { 'foodItem.name': 1 } });

    // Get total count for pagination (before skip/limit)
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await pantryCollection.aggregate(countPipeline).toArray();
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Skip and limit for pagination
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: limit });

    const data = await pantryCollection.aggregate(pipeline).toArray();

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    });
  } catch (error) {
    logError('Pantry GET', error);
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
    const { foodItemId } = body;

    // Validation
    if (!foodItemId || typeof foodItemId !== 'string') {
      return NextResponse.json({ error: PANTRY_ERRORS.FOOD_ITEM_ID_REQUIRED }, { status: 400 });
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(foodItemId)) {
      return NextResponse.json({ error: FOOD_ITEM_ERRORS.INVALID_FOOD_ITEM_ID }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const pantryCollection = db.collection('pantry');
    const foodItemsCollection = db.collection('foodItems');

    // Verify food item exists
    const foodItem = await foodItemsCollection.findOne({
      _id: new ObjectId(foodItemId),
    });
    if (!foodItem) {
      return NextResponse.json({ error: PANTRY_ERRORS.FOOD_ITEM_NOT_FOUND }, { status: 404 });
    }

    // Check if item already exists in user's pantry
    const existingItem = await pantryCollection.findOne({
      userId: session.user.id,
      foodItemId: foodItemId,
    });

    if (existingItem) {
      return NextResponse.json({ error: PANTRY_ERRORS.ITEM_ALREADY_EXISTS }, { status: 409 });
    }

    const newPantryItem = {
      userId: session.user.id,
      foodItemId: foodItemId,
      addedAt: new Date(),
    };

    const result = await pantryCollection.insertOne(newPantryItem);
    const createdItem = await pantryCollection.findOne({
      _id: result.insertedId,
    });

    if (!createdItem) {
      return NextResponse.json(
        { error: PANTRY_ERRORS.PANTRY_ITEM_CREATION_FAILED },
        { status: 500 }
      );
    }

    // Transform the data to include food item details
    const transformedItem = {
      ...createdItem,
      foodItem: {
        _id: foodItem._id,
        name: foodItem.name,
        singularName: foodItem.singularName,
        pluralName: foodItem.pluralName,
        unit: foodItem.unit,
      },
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
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const foodItemId = searchParams.get('foodItemId');

    if (!foodItemId) {
      return NextResponse.json({ error: PANTRY_ERRORS.FOOD_ITEM_ID_REQUIRED }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const pantryCollection = db.collection('pantry');

    const result = await pantryCollection.deleteOne({
      userId: session.user.id,
      foodItemId: foodItemId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: PANTRY_ERRORS.PANTRY_ITEM_NOT_FOUND }, { status: 404 });
    }

    return NextResponse.json({ message: 'Item removed from pantry' });
  } catch (error) {
    logError('Pantry DELETE', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
