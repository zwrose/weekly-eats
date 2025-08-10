import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { UpdateRecipeRequest } from '../../../../types/recipe';
import { 
  AUTH_ERRORS, 
  RECIPE_ERRORS, 
  API_ERRORS,
  logError 
} from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: RECIPE_ERRORS.INVALID_RECIPE_ID }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const recipesCollection = db.collection('recipes');

    // Allow viewing global recipes or user's own recipes
    const recipe = await recipesCollection.findOne({
      _id: ObjectId.createFromHexString(id),
      $or: [
        { isGlobal: true },
        { createdBy: session.user.id }
      ]
    });

    if (!recipe) {
      return NextResponse.json({ error: RECIPE_ERRORS.RECIPE_NOT_FOUND }, { status: 404 });
    }

    return NextResponse.json(recipe);
  } catch (error) {
    logError('Recipes GET [id]', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: RECIPE_ERRORS.INVALID_RECIPE_ID }, { status: 400 });
    }

    const body: UpdateRecipeRequest = await request.json();

    const client = await getMongoClient();
    const db = client.db();
    const recipesCollection = db.collection('recipes');

    // Check if recipe exists and belongs to user (only creators can edit)
    const existingRecipe = await recipesCollection.findOne({
      _id: ObjectId.createFromHexString(id),
      createdBy: session.user.id
    });

    if (!existingRecipe) {
      return NextResponse.json({ error: RECIPE_ERRORS.NO_PERMISSION_TO_EDIT }, { status: 404 });
    }

    // Validate ingredients if provided
    if (body.ingredients) {
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
    }

    const updateData = {
      ...body,
      updatedAt: new Date()
    };

    const result = await recipesCollection.updateOne(
      { _id: ObjectId.createFromHexString(id), createdBy: session.user.id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: RECIPE_ERRORS.RECIPE_NOT_FOUND }, { status: 404 });
    }

    return NextResponse.json({ message: 'Recipe updated successfully' });
  } catch (error) {
    logError('Recipes PUT [id]', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid recipe ID' }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const recipesCollection = db.collection('recipes');

    // Only creators can delete their recipes
    const result = await recipesCollection.deleteOne({
      _id: ObjectId.createFromHexString(id),
      createdBy: session.user.id
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Recipe not found or you do not have permission to delete it' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 