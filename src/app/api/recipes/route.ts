import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '@/lib/mongodb';
import { CreateRecipeRequest } from '../../../types/recipe';
import { parsePaginationParams } from '@/lib/pagination-utils';
import {
  AUTH_ERRORS,
  RECIPE_ERRORS,
  API_ERRORS,
  logError
} from '@/lib/errors';

type AccessLevel = 'personal' | 'shared-by-you' | 'global';

function computeAccessLevel(recipe: { createdBy: string; isGlobal: boolean }, userId: string): AccessLevel {
  if (recipe.createdBy === userId && !recipe.isGlobal) return 'personal';
  if (recipe.createdBy === userId && recipe.isGlobal) return 'shared-by-you';
  return 'global';
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { page, limit, sortBy, sortOrder } = parsePaginationParams(searchParams);

    const query = searchParams.get('query');
    const accessLevel = searchParams.get('accessLevel');

    const client = await getMongoClient();
    const db = client.db();
    const recipesCollection = db.collection('recipes');

    // Build base filter based on accessLevel
    let filter: Record<string, unknown> = {};

    switch (accessLevel) {
      case 'personal':
        filter = { createdBy: session.user.id, isGlobal: false };
        break;
      case 'shared-by-you':
        filter = { createdBy: session.user.id, isGlobal: true };
        break;
      case 'global':
        filter = { isGlobal: true, createdBy: { $ne: session.user.id } };
        break;
      default:
        // All accessible recipes: global OR user's own
        filter = {
          $or: [
            { isGlobal: true },
            { createdBy: session.user.id },
          ],
        };
    }

    // Add text search filter
    if (query && query.trim()) {
      const searchFilter = {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { emoji: { $regex: query, $options: 'i' } },
        ],
      };
      filter = { $and: [filter, searchFilter] };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      recipesCollection
        .find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .toArray(),
      recipesCollection.countDocuments(filter),
    ]);

    const dataWithAccessLevel = data.map((recipe) => ({
      ...recipe,
      accessLevel: computeAccessLevel(
        recipe as unknown as { createdBy: string; isGlobal: boolean },
        session.user.id
      ),
    }));

    return NextResponse.json({
      data: dataWithAccessLevel,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    });
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
