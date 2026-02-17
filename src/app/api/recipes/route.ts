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

type AccessLevel = 'private' | 'shared-by-you' | 'shared-by-others';

function computeAccessLevel(recipe: { createdBy: string; isGlobal: boolean }, userId: string): AccessLevel {
  if (recipe.createdBy === userId && !recipe.isGlobal) return 'private';
  if (recipe.createdBy === userId && recipe.isGlobal) return 'shared-by-you';
  return 'shared-by-others';
}

function buildBaseFilter(accessLevel: string | null, userId: string): Record<string, unknown> {
  switch (accessLevel) {
    case 'private':
      return { createdBy: userId, isGlobal: false };
    case 'shared-by-you':
      return { createdBy: userId, isGlobal: true };
    case 'shared-by-others':
      return { isGlobal: true, createdBy: { $ne: userId } };
    default:
      return {
        $or: [
          { isGlobal: true },
          { createdBy: userId },
        ],
      };
  }
}

function addTextSearch(filter: Record<string, unknown>, query: string | null): Record<string, unknown> {
  if (!query || !query.trim()) return filter;

  const searchFilter = {
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { emoji: { $regex: query, $options: 'i' } },
    ],
  };
  return { $and: [filter, searchFilter] };
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
    const tagsParam = searchParams.get('tags');
    const ratingsParam = searchParams.get('ratings');

    const client = await getMongoClient();
    const db = client.db();
    const recipesCollection = db.collection('recipes');

    let filter = buildBaseFilter(accessLevel, session.user.id);
    filter = addTextSearch(filter, query);

    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(Boolean) : [];
    const ratings = ratingsParam ? ratingsParam.split(',').map(r => parseInt(r.trim(), 10)).filter(r => !Number.isNaN(r)) : [];
    const useAggregation = tags.length > 0 || ratings.length > 0;

    if (useAggregation) {
      // Use aggregation pipeline to join with recipeUserData for tag/rating filtering
      const skip = (page - 1) * limit;

      const pipeline: Record<string, unknown>[] = [
        { $match: filter },
        {
          $lookup: {
            from: 'recipeUserData',
            let: { recipeId: { $toString: '$_id' } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$recipeId', '$$recipeId'] },
                      { $eq: ['$userId', session.user.id] },
                    ],
                  },
                },
              },
            ],
            as: 'userDataArr',
          },
        },
        {
          $addFields: {
            userData: { $arrayElemAt: ['$userDataArr', 0] },
          },
        },
        { $unset: 'userDataArr' },
      ];

      // Add tag filter
      if (tags.length > 0) {
        pipeline.push({
          $match: { 'userData.tags': { $in: tags } },
        });
      }

      // Add rating filter (multi-select: match any of the selected ratings)
      if (ratings.length > 0) {
        pipeline.push({
          $match: { 'userData.rating': { $in: ratings } },
        });
      }

      // Sort — use userData.rating for rating sort
      const sortField = sortBy === 'rating' ? 'userData.rating' : sortBy;
      pipeline.push(
        { $sort: { [sortField]: sortOrder } },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            total: [{ $count: 'count' }],
          },
        },
        {
          $project: {
            data: 1,
            total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
          },
        },
      );

      const results = await recipesCollection.aggregate(pipeline).toArray();
      const result = results[0] || { data: [], total: 0 };
      const total = result.total as number;

      const dataWithAccessLevel = (result.data as Array<Record<string, unknown>>).map((recipe) => ({
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
    }

    // Simple find path (no tags/rating filtering)
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
