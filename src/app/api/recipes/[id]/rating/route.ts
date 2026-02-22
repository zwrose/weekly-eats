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
    const { rating } = body;

    // Validate rating
    if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json(
        { error: 'Rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

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
          rating: rating,
          updatedAt: now,
        },
        $setOnInsert: {
          userId: session.user.id,
          recipeId: recipeId,
          tags: [],
          createdAt: now,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ rating });
  } catch (error) {
    logError('Recipes Rating POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { id: recipeId } = await params;
    if (!ObjectId.isValid(recipeId)) {
      return NextResponse.json({ error: RECIPE_ERRORS.INVALID_RECIPE_ID }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const recipeUserDataCollection = db.collection('recipeUserData');

    // Remove rating (but keep the document if tags exist)
    const result = await recipeUserDataCollection.updateOne(
      {
        userId: session.user.id,
        recipeId: recipeId,
      },
      {
        $unset: { rating: '' },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Rating not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Rating removed successfully' });
  } catch (error) {
    logError('Recipes Rating DELETE', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
