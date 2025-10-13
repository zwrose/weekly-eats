import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { UpdateMealPlanRequest, MealPlanItem, MealItem } from '@/types/meal-plan';
import { 
  AUTH_ERRORS, 
  MEAL_PLAN_ERRORS, 
  API_ERRORS,
  logError 
} from '@/lib/errors';
import { RecipeIngredientList } from '@/types/recipe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { id } = await params;

    const client = await getMongoClient();
    const db = client.db();
    const mealPlansCollection = db.collection('mealPlans');
    const foodItemsCollection = db.collection('foodItems');
    const recipesCollection = db.collection('recipes');
    const usersCollection = db.collection('users');

    const mealPlan = await mealPlansCollection.findOne({
      _id: new ObjectId(id)
    });

    if (!mealPlan) {
      return NextResponse.json({ error: MEAL_PLAN_ERRORS.MEAL_PLAN_NOT_FOUND }, { status: 404 });
    }

    // Check if user owns this meal plan OR if it's been shared with them
    const isOwner = mealPlan.userId === session.user.id;
    let hasSharedAccess = false;
    
    if (!isOwner) {
      const owner = await usersCollection.findOne({
        _id: ObjectId.createFromHexString(mealPlan.userId),
        'settings.mealPlanSharing.invitations': {
          $elemMatch: {
            userId: session.user.id,
            status: 'accepted'
          }
        }
      });
      hasSharedAccess = !!owner;
    }

    if (!isOwner && !hasSharedAccess) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 403 });
    }

    // Helper function to populate a single meal item's name
    const populateMealItemName = async (mealItem: MealItem): Promise<MealItem> => {
      if (mealItem.type === 'foodItem' && mealItem.id) {
        const foodItem = await foodItemsCollection.findOne({ _id: ObjectId.createFromHexString(mealItem.id) });
        return {
          ...mealItem,
          name: foodItem ? (mealItem.quantity === 1 ? foodItem.singularName : foodItem.pluralName) : mealItem.name || 'Unknown'
        };
      } else if (mealItem.type === 'recipe' && mealItem.id) {
        const recipe = await recipesCollection.findOne({ _id: ObjectId.createFromHexString(mealItem.id) });
        return {
          ...mealItem,
          name: recipe ? recipe.title : mealItem.name || 'Unknown'
        };
      } else if (mealItem.type === 'ingredientGroup' && mealItem.ingredients) {
        // Populate names for ingredients within the group
        const populatedIngredients = await Promise.all(
          mealItem.ingredients.map(async (group: RecipeIngredientList) => {
            const populatedGroupIngredients = await Promise.all(
              (group.ingredients || []).map(async (ingredient) => {
                if (ingredient.type === 'foodItem' && ingredient.id) {
                  const foodItem = await foodItemsCollection.findOne({ _id: ObjectId.createFromHexString(ingredient.id) });
                  return {
                    ...ingredient,
                    name: foodItem ? (ingredient.quantity === 1 ? foodItem.singularName : foodItem.pluralName) : 'Unknown'
                  };
                } else if (ingredient.type === 'recipe' && ingredient.id) {
                  const recipe = await recipesCollection.findOne({ _id: ObjectId.createFromHexString(ingredient.id) });
                  return {
                    ...ingredient,
                    name: recipe ? recipe.title : 'Unknown'
                  };
                }
                return ingredient;
              })
            );
            
            return {
              ...group,
              ingredients: populatedGroupIngredients
            };
          })
        );
        
        return {
          ...mealItem,
          ingredients: populatedIngredients,
          name: mealItem.name || ''
        };
      }
      return mealItem;
    };

    // Populate names for meal items
    const populatedItems = await Promise.all(
      ((mealPlan.items || []) as MealPlanItem[]).map(async (mealPlanItem) => {
        const populatedMealItems = await Promise.all(
          (mealPlanItem.items || []).map(populateMealItemName)
        );
        
        return {
          ...mealPlanItem,
          items: populatedMealItems
        };
      })
    );

    // Use template snapshot instead of fetching current template
    const mealPlanWithTemplate = {
      ...mealPlan,
      items: populatedItems,
      template: {
        _id: mealPlan.templateId,
        userId: session.user.id,
        ...mealPlan.templateSnapshot,
        createdAt: mealPlan.createdAt,
        updatedAt: mealPlan.createdAt // Use creation time as template was snapshot at creation
      }
    };

    return NextResponse.json(mealPlanWithTemplate);
  } catch (error) {
    logError('MealPlans GET [id]', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const { id } = await params;
    const body: UpdateMealPlanRequest = await request.json();
    const { name, items } = body;

    const client = await getMongoClient();
    const db = client.db();
    const mealPlansCollection = db.collection('mealPlans');
    const usersCollection = db.collection('users');

    // Check if meal plan exists
    const existingMealPlan = await mealPlansCollection.findOne({
      _id: new ObjectId(id)
    });

    if (!existingMealPlan) {
      return NextResponse.json({ error: MEAL_PLAN_ERRORS.MEAL_PLAN_NOT_FOUND }, { status: 404 });
    }

    // Check if user owns this meal plan OR if it's been shared with them
    const isOwner = existingMealPlan.userId === session.user.id;
    let hasSharedAccess = false;
    
    if (!isOwner) {
      const owner = await usersCollection.findOne({
        _id: ObjectId.createFromHexString(existingMealPlan.userId),
        'settings.mealPlanSharing.invitations': {
          $elemMatch: {
            userId: session.user.id,
            status: 'accepted'
          }
        }
      });
      hasSharedAccess = !!owner;
    }

    if (!isOwner && !hasSharedAccess) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 403 });
    }

    // Build update object
    const updateData: Partial<{
      name: string;
      items: MealPlanItem[];
      updatedAt: Date;
    }> = { updatedAt: new Date() };
    
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: API_ERRORS.BAD_REQUEST }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (items !== undefined) {
      if (!Array.isArray(items)) {
        return NextResponse.json({ error: API_ERRORS.BAD_REQUEST }, { status: 400 });
      }
      updateData.items = items;
    }

    const result = await mealPlansCollection.updateOne(
      { _id: new ObjectId(id), userId: session.user.id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: MEAL_PLAN_ERRORS.MEAL_PLAN_NOT_FOUND }, { status: 404 });
    }

    const updatedMealPlan = await mealPlansCollection.findOne({ _id: new ObjectId(id) });
    
    if (!updatedMealPlan) {
      return NextResponse.json({ error: MEAL_PLAN_ERRORS.MEAL_PLAN_UPDATE_FAILED }, { status: 500 });
    }
    
    // Use template snapshot instead of fetching current template
    const mealPlanWithTemplate = {
      ...updatedMealPlan,
      template: {
        _id: updatedMealPlan.templateId,
        userId: session.user.id,
        ...updatedMealPlan.templateSnapshot,
        createdAt: updatedMealPlan.createdAt,
        updatedAt: updatedMealPlan.createdAt // Use creation time as template was snapshot at creation
      }
    };

    return NextResponse.json(mealPlanWithTemplate);
  } catch (error) {
    logError('MealPlans PUT [id]', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const client = await getMongoClient();
    const db = client.db();
    const mealPlansCollection = db.collection('mealPlans');
    const usersCollection = db.collection('users');

    // Get the meal plan first
    const mealPlan = await mealPlansCollection.findOne({
      _id: new ObjectId(id)
    });

    if (!mealPlan) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 });
    }

    // Check if user owns this meal plan OR if it's been shared with them
    const isOwner = mealPlan.userId === session.user.id;
    let hasSharedAccess = false;
    
    if (!isOwner) {
      const owner = await usersCollection.findOne({
        _id: ObjectId.createFromHexString(mealPlan.userId),
        'settings.mealPlanSharing.invitations': {
          $elemMatch: {
            userId: session.user.id,
            status: 'accepted'
          }
        }
      });
      hasSharedAccess = !!owner;
    }

    if (!isOwner && !hasSharedAccess) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 403 });
    }

    const result = await mealPlansCollection.deleteOne({
      _id: new ObjectId(id)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Meal plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting meal plan:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 