import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { AUTH_ERRORS, RECIPE_ERRORS, API_ERRORS, logError } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { id: recipeId } = await params;
    if (!ObjectId.isValid(recipeId)) {
      return NextResponse.json({ error: RECIPE_ERRORS.INVALID_RECIPE_ID }, { status: 400 });
    }

    const body = await request.json();
    const { tags } = body;

    // Validate tags
    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: 'Tags must be an array' }, { status: 400 });
    }

    // Validate that all tags are strings
    if (!tags.every((tag: unknown) => typeof tag === 'string')) {
      return NextResponse.json({ error: 'All tags must be strings' }, { status: 400 });
    }

    // Trim and filter empty tags
    const processedTags = tags
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag.length > 0);

    const client = await getMongoClient();
    const db = client.db();
    const recipesCollection = db.collection('recipes');
    const recipeUserDataCollection = db.collection('recipeUserData');

    // Verify recipe exists and is accessible
    const recipe = await recipesCollection.findOne({
      _id: ObjectId.createFromHexString(recipeId),
      $or: [{ isGlobal: true }, { createdBy: session.user.id }],
    });

    if (!recipe) {
      return NextResponse.json({ error: RECIPE_ERRORS.RECIPE_NOT_FOUND }, { status: 404 });
    }

    const now = new Date();

    // Upsert user data
    await recipeUserDataCollection.updateOne(
      {
        userId: session.user.id,
        recipeId: recipeId,
      },
      {
        $set: {
          tags: processedTags,
          updatedAt: now,
        },
        $setOnInsert: {
          userId: session.user.id,
          recipeId: recipeId,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ tags: processedTags });
  } catch (error) {
    logError('Recipes Tags POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
