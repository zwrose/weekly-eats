import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '../../../../lib/auth';
import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { UpdateRecipeRequest } from '../../../../types/recipe';

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid recipe ID' }, { status: 400 });
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
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    return NextResponse.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
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
      return NextResponse.json({ error: 'Recipe not found or you do not have permission to edit it' }, { status: 404 });
    }

    // Validate ingredients if provided
    if (body.ingredients) {
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
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Recipe updated successfully' });
  } catch (error) {
    console.error('Error updating recipe:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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