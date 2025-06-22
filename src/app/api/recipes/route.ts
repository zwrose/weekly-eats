import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '../../../lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '../../../lib/mongodb';
import { CreateRecipeRequest } from '../../../types/recipe';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userOnly = searchParams.get('userOnly') === 'true';
    const globalOnly = searchParams.get('globalOnly') === 'true';
    const excludeUserCreated = searchParams.get('excludeUserCreated') === 'true';

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

    const recipes = await recipesCollection
      .find(filter)
      .sort({ updatedAt: -1 })
      .toArray();

    return NextResponse.json(recipes);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateRecipeRequest = await request.json();
    
    // Validate required fields
    if (!body.title || !body.instructions || !body.ingredients || body.ingredients.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate ingredients structure
    for (const ingredientList of body.ingredients) {
      if (!ingredientList.ingredients || ingredientList.ingredients.length === 0) {
        return NextResponse.json({ error: 'Each ingredient list must have at least one ingredient' }, { status: 400 });
      }
      
      for (const ingredient of ingredientList.ingredients) {
        if (!ingredient.foodItemId || ingredient.quantity <= 0 || !ingredient.unit) {
          return NextResponse.json({ error: 'Invalid ingredient data' }, { status: 400 });
        }
      }
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
    console.error('Error creating recipe:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 