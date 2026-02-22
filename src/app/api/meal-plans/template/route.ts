import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import {
  CreateMealPlanTemplateRequest,
  UpdateMealPlanTemplateRequest,
  MealItem,
} from '@/types/meal-plan';
import { RecipeIngredientList } from '@/types/recipe';
import { isValidDayOfWeek, isValidMealsConfig } from '@/lib/validation';
import { DEFAULT_TEMPLATE } from '@/lib/meal-plan-utils';
import { AUTH_ERRORS, TEMPLATE_ERRORS, MEAL_PLAN_ERRORS, API_ERRORS, logError } from '@/lib/errors';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const templatesCollection = db.collection('mealPlanTemplates');

    const template = await templatesCollection.findOne({ userId: session.user.id });

    if (!template) {
      return NextResponse.json(null);
    }

    // Resolve food item and recipe names server-side (same pattern as meal plan GET)
    if (template.weeklyStaples?.length > 0) {
      const foodItemsCollection = db.collection('foodItems');
      const recipesCollection = db.collection('recipes');

      const populateMealItemName = async (mealItem: MealItem): Promise<MealItem> => {
        if (mealItem.type === 'foodItem' && mealItem.id && ObjectId.isValid(mealItem.id)) {
          const foodItem = await foodItemsCollection.findOne({ _id: new ObjectId(mealItem.id) });
          return {
            ...mealItem,
            name: foodItem
              ? mealItem.quantity === 1
                ? foodItem.singularName
                : foodItem.pluralName
              : mealItem.name || 'Unknown',
          };
        } else if (mealItem.type === 'recipe' && mealItem.id && ObjectId.isValid(mealItem.id)) {
          const recipe = await recipesCollection.findOne({ _id: new ObjectId(mealItem.id) });
          return {
            ...mealItem,
            name: recipe ? recipe.title : mealItem.name || 'Unknown',
          };
        } else if (mealItem.type === 'ingredientGroup' && mealItem.ingredients) {
          const populatedIngredients = await Promise.all(
            mealItem.ingredients.map(async (group: RecipeIngredientList) => {
              const populatedGroupIngredients = await Promise.all(
                (group.ingredients || []).map(async (ingredient) => {
                  if (
                    ingredient.type === 'foodItem' &&
                    ingredient.id &&
                    ObjectId.isValid(ingredient.id)
                  ) {
                    const foodItem = await foodItemsCollection.findOne({
                      _id: new ObjectId(ingredient.id),
                    });
                    return {
                      ...ingredient,
                      name: foodItem
                        ? ingredient.quantity === 1
                          ? foodItem.singularName
                          : foodItem.pluralName
                        : ingredient.name || 'Unknown',
                    };
                  } else if (
                    ingredient.type === 'recipe' &&
                    ingredient.id &&
                    ObjectId.isValid(ingredient.id)
                  ) {
                    const recipe = await recipesCollection.findOne({
                      _id: new ObjectId(ingredient.id),
                    });
                    return {
                      ...ingredient,
                      name: recipe ? recipe.title : ingredient.name || 'Unknown',
                    };
                  }
                  return ingredient;
                })
              );
              return { ...group, ingredients: populatedGroupIngredients };
            })
          );
          return { ...mealItem, ingredients: populatedIngredients, name: mealItem.name || '' };
        }
        return mealItem;
      };

      template.weeklyStaples = await Promise.all(
        template.weeklyStaples.map((item: MealItem) => populateMealItemName(item))
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    logError('MealPlanTemplate GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const body: CreateMealPlanTemplateRequest = await request.json();
    const { startDay, meals, weeklyStaples } = body;

    // Validation
    if (!startDay || !isValidDayOfWeek(startDay)) {
      return NextResponse.json({ error: TEMPLATE_ERRORS.START_DAY_REQUIRED }, { status: 400 });
    }

    if (!isValidMealsConfig(meals)) {
      return NextResponse.json({ error: TEMPLATE_ERRORS.MEALS_CONFIG_REQUIRED }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const templatesCollection = db.collection('mealPlanTemplates');

    // Check if user already has a template
    const existingTemplate = await templatesCollection.findOne({ userId: session.user.id });
    if (existingTemplate) {
      return NextResponse.json(
        { error: MEAL_PLAN_ERRORS.TEMPLATE_ALREADY_EXISTS },
        { status: 409 }
      );
    }

    const now = new Date();
    const template = {
      startDay,
      meals,
      weeklyStaples: weeklyStaples || [], // Include weekly staples
      userId: session.user.id,
      createdAt: now,
      updatedAt: now,
    };

    const result = await templatesCollection.insertOne(template);
    const createdTemplate = await templatesCollection.findOne({ _id: result.insertedId });

    return NextResponse.json(createdTemplate, { status: 201 });
  } catch (error) {
    logError('MealPlanTemplate POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const body: UpdateMealPlanTemplateRequest = await request.json();
    const { startDay, meals, weeklyStaples } = body;

    const client = await getMongoClient();
    const db = client.db();
    const templatesCollection = db.collection('mealPlanTemplates');

    // Check if template exists
    const existingTemplate = await templatesCollection.findOne({ userId: session.user.id });

    if (!existingTemplate) {
      // Create new template if it doesn't exist
      const now = new Date();
      const newTemplate = {
        userId: session.user.id,
        startDay: startDay || DEFAULT_TEMPLATE.startDay,
        meals: meals || DEFAULT_TEMPLATE.meals,
        weeklyStaples: weeklyStaples || [], // Include weekly staples
        createdAt: now,
        updatedAt: now,
      };

      const result = await templatesCollection.insertOne(newTemplate);
      const createdTemplate = await templatesCollection.findOne({ _id: result.insertedId });

      if (!createdTemplate) {
        return NextResponse.json(
          { error: TEMPLATE_ERRORS.TEMPLATE_CREATION_FAILED },
          { status: 500 }
        );
      }

      return NextResponse.json(createdTemplate);
    }

    // Update existing template
    const updateData: Partial<{
      startDay: string;
      meals: Record<string, boolean>;
      weeklyStaples: MealItem[];
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (startDay !== undefined) {
      if (!isValidDayOfWeek(startDay)) {
        return NextResponse.json({ error: TEMPLATE_ERRORS.START_DAY_REQUIRED }, { status: 400 });
      }
      updateData.startDay = startDay;
    }

    if (meals !== undefined) {
      if (!isValidMealsConfig(meals)) {
        return NextResponse.json({ error: TEMPLATE_ERRORS.MEALS_CONFIG_REQUIRED }, { status: 400 });
      }
      updateData.meals = meals;
    }

    if (weeklyStaples !== undefined) {
      updateData.weeklyStaples = weeklyStaples;
    }

    const result = await templatesCollection.updateOne(
      { userId: session.user.id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: TEMPLATE_ERRORS.TEMPLATE_NOT_FOUND }, { status: 404 });
    }

    const updatedTemplate = await templatesCollection.findOne({ userId: session.user.id });
    return NextResponse.json(updatedTemplate);
  } catch (error) {
    logError('MealPlanTemplate PUT', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
