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

    // Resolve ingredient names from food items and recipes collections
    const foodItemIds: string[] = [];
    const recipeIngredientIds: string[] = [];
    for (const group of recipe.ingredients || []) {
      for (const ingredient of group.ingredients || []) {
        if (ingredient.type === 'foodItem' && ingredient.id) {
          foodItemIds.push(ingredient.id);
        } else if (ingredient.type === 'recipe' && ingredient.id) {
          recipeIngredientIds.push(ingredient.id);
        }
      }
    }

    const [foodItemsDocs, recipesDocs] = await Promise.all([
      foodItemIds.length > 0
        ? db.collection('foodItems').find({
            _id: { $in: foodItemIds.map(fid => ObjectId.createFromHexString(fid)) },
          }).toArray()
        : Promise.resolve([]),
      recipeIngredientIds.length > 0
        ? recipesCollection.find({
            _id: { $in: recipeIngredientIds.map(rid => ObjectId.createFromHexString(rid)) },
          }).toArray()
        : Promise.resolve([]),
    ]);

    const foodItemsMap = new Map(foodItemsDocs.map(fi => [fi._id.toString(), fi]));
    const recipesMap = new Map(recipesDocs.map(r => [r._id.toString(), r]));

    for (const group of recipe.ingredients || []) {
      for (const ingredient of group.ingredients || []) {
        if (ingredient.type === 'foodItem') {
          const fi = foodItemsMap.get(ingredient.id);
          if (fi) {
            ingredient.name = ingredient.quantity === 1 ? fi.singularName : fi.pluralName;
          }
        } else if (ingredient.type === 'recipe') {
          const r = recipesMap.get(ingredient.id);
          if (r) {
            ingredient.name = r.title;
          }
        }
      }
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

    const objectId = ObjectId.createFromHexString(id);
    const result = await recipesCollection.updateOne(
      { _id: objectId, createdBy: session.user.id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: RECIPE_ERRORS.RECIPE_NOT_FOUND }, { status: 404 });
    }

    const updatedRecipe = await recipesCollection.findOne({ _id: objectId });
    return NextResponse.json(updatedRecipe);
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
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: RECIPE_ERRORS.INVALID_RECIPE_ID }, { status: 400 });
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
      return NextResponse.json({ error: RECIPE_ERRORS.NO_PERMISSION_TO_EDIT }, { status: 404 });
    }

    return NextResponse.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    logError('Recipes DELETE [id]', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
} 