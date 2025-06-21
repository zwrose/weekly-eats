import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { 
  createFoodItem, 
  getAllFoodItems, 
  searchFoodItems,
  getUserFoodItems,
  getGlobalFoodItems,
  CreateFoodItemData 
} from '../../../lib/food-items';
import { getUserObjectId } from '../../../lib/user-utils';
import { normalizeUnit } from '../../../lib/food-items-utils';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await getUserObjectId(session.user.email);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');
    const scope = searchParams.get('scope'); // 'all', 'user', 'global'

    let foodItems;
    
    if (query) {
      foodItems = await searchFoodItems(query, userId, limit);
    } else if (scope === 'user') {
      foodItems = await getUserFoodItems(userId);
    } else if (scope === 'global') {
      foodItems = await getGlobalFoodItems();
    } else {
      // Default: get all items user has access to (global + user's)
      foodItems = await getAllFoodItems(userId);
    }

    return NextResponse.json(foodItems);
  } catch (error) {
    console.error('Error fetching food items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch food items' }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await getUserObjectId(session.user.email);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body: CreateFoodItemData = await request.json();
    
    // Validate required fields
    if (!body.name || typeof body.isGlobal !== 'boolean') {
      return NextResponse.json(
        { error: 'Name and isGlobal are required' }, 
        { status: 400 }
      );
    }

    // Validate and normalize unit if provided
    if (body.unit) {
      const normalizedUnit = normalizeUnit(body.unit);
      if (!normalizedUnit) {
        return NextResponse.json(
          { error: 'Invalid unit provided' }, 
          { status: 400 }
        );
      }
      body.unit = normalizedUnit;
    }

    const foodItem = await createFoodItem(body, userId);
    
    return NextResponse.json(foodItem, { status: 201 });
  } catch (error) {
    console.error('Error creating food item:', error);
    return NextResponse.json(
      { error: 'Failed to create food item' }, 
      { status: 500 }
    );
  }
} 