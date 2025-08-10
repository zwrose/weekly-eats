import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '@/lib/mongodb';
import { CreateRecipeRequest } from '../../../types/recipe';
import { 
  AUTH_ERRORS, 
  RECIPE_ERRORS, 
  API_ERRORS,
  logError 
} from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userOnly = searchParams.get('userOnly') === 'true';
    const globalOnly = searchParams.get('globalOnly') === 'true';
    const excludeUserCreated = searchParams.get('excludeUserCreated') === 'true';
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '100');

    const client = await getMongoClient();
    const db = client.db();
    const recipesCollection = db.collection('recipes');

    // Build query based on filter parameters
    let filter: Record<string, unknown> = {};

    if (userOnly) {
      // Only user's personal recipes (including global recipes they created)
      filter = { 
        $or: [
          { createdBy: session.user.id },
          { isGlobal: true, createdBy: session.user.id }
        ]
      };
    } else if (globalOnly) {
      if (excludeUserCreated) {
        // Only global recipes NOT created by the current user
        filter = { isGlobal: true, createdBy: { $ne: session.user.id } };
      } else {
        // Only global recipes
        filter = { isGlobal: true };
      }
    } else {
      // Default: both global and user's personal recipes
      filter = {
        $or: [
          { isGlobal: true },
          { createdBy: session.user.id }
        ]
      };
    }

    // Add search filter if query is provided
    if (query && query.trim()) {
      const searchFilter = {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { emoji: { $regex: query, $options: 'i' } }
        ]
      };
      
      // Combine with existing filter
      if (Object.keys(filter).length > 0) {
        filter = { $and: [filter, searchFilter] };
      } else {
        filter = searchFilter;
      }
    }

    const recipes = await recipesCollection
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(recipes);
  } catch (error) {
    logError('Recipes GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const body: CreateRecipeRequest = await request.json();
    
    // Validate required fields
    if (!body.title || !body.instructions || !body.ingredients || body.ingredients.length === 0) {
      return NextResponse.json({ error: RECIPE_ERRORS.TITLE_REQUIRED }, { status: 400 });
    }

    // Validate ingredients structure
    let totalIngredients = 0;
    for (const ingredientList of body.ingredients) {
      if (!ingredientList.ingredients) {
        return NextResponse.json({ error: RECIPE_ERRORS.INGREDIENT_LIST_REQUIRED }, { status: 400 });
      }
      
      totalIngredients += ingredientList.ingredients.length;
      
      // Check that non-standalone groups have titles
      if (!ingredientList.isStandalone && (!ingredientList.title || ingredientList.title.trim() === '')) {
        return NextResponse.json({ error: 'Group titles are required for non-standalone ingredient groups' }, { status: 400 });
      }
      
      for (const ingredient of ingredientList.ingredients) {
        if (!ingredient.id || ingredient.quantity <= 0 || (ingredient.type === 'foodItem' && !ingredient.unit)) {
          return NextResponse.json({ error: RECIPE_ERRORS.INVALID_INGREDIENT_DATA }, { status: 400 });
        }
      }
    }
    
    // Ensure there's at least one ingredient across all groups
    if (totalIngredients === 0) {
      return NextResponse.json({ error: RECIPE_ERRORS.INGREDIENT_LIST_REQUIRED }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const recipesCollection = db.collection('recipes');

    const now = new Date();
    const recipe = {
      ...body,
      createdBy: session.user.id,
      createdAt: now,
      updatedAt: now,
    };

    const result = await recipesCollection.insertOne(recipe);
    
    return NextResponse.json({ 
      ...recipe, 
      _id: result.insertedId 
    }, { status: 201 });
  } catch (error) {
    logError('Recipes POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
} 