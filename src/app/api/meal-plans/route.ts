import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { CreateMealPlanRequest, MealPlan, DayOfWeek, MealItem, MealType, MealPlanItem } from '@/types/meal-plan';
import { 
  generateMealPlanNameFromString, 
  calculateEndDateAsString
} from '@/lib/date-utils';
import { checkMealPlanOverlap } from '@/lib/meal-plan-utils';
import { isValidDateString } from '@/lib/validation';
import { 
  AUTH_ERRORS, 
  MEAL_PLAN_ERRORS, 
  TEMPLATE_ERRORS, 
  API_ERRORS,
  logError 
} from '@/lib/errors';
import { ObjectId } from 'mongodb';
import { RecipeIngredientList } from '@/types/recipe';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const mealPlansCollection = db.collection('mealPlans');
    const foodItemsCollection = db.collection('foodItems');
    const recipesCollection = db.collection('recipes');

    const mealPlans = await mealPlansCollection
      .find({ userId: session.user.id })
      .sort({ startDate: -1 })
      .toArray();

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

    // Transform meal plans to use template snapshot and populate names
    const mealPlansWithTemplates = await Promise.all(
      mealPlans.map(async (plan) => {
        const populatedItems = await Promise.all(
          ((plan.items || []) as MealPlanItem[]).map(async (mealPlanItem) => {
            const populatedMealItems = await Promise.all(
              (mealPlanItem.items || []).map(populateMealItemName)
            );
            
            return {
              ...mealPlanItem,
              items: populatedMealItems
            };
          })
        );

        return {
          ...plan,
          items: populatedItems,
          template: {
            _id: plan.templateId,
            userId: session.user.id,
            ...plan.templateSnapshot,
            createdAt: plan.createdAt,
            updatedAt: plan.createdAt
          }
        };
      })
    );

    return NextResponse.json(mealPlansWithTemplates);
  } catch (error) {
    logError('MealPlans GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const body: CreateMealPlanRequest = await request.json();
    const { startDate } = body;

    // Validation
    if (!isValidDateString(startDate)) {
      return NextResponse.json({ error: MEAL_PLAN_ERRORS.START_DATE_REQUIRED }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const mealPlansCollection = db.collection('mealPlans');
    const templatesCollection = db.collection('mealPlanTemplates');

    // --- Overlap validation ---
    const existingPlans = (await mealPlansCollection.find({ userId: session.user.id }).toArray()) as unknown as MealPlan[];
    const overlapResult = checkMealPlanOverlap(startDate, existingPlans);
    if (overlapResult.isOverlapping) {
      return NextResponse.json({
        error: `Meal plan dates overlap with "${overlapResult.conflict!.planName}" (${overlapResult.conflict!.startDate} to ${overlapResult.conflict!.endDate})`
      }, { status: 409 });
    }
    // --- End overlap validation ---

    // Get or create user's template
    let template = await templatesCollection.findOne({
      userId: session.user.id
    });

    if (!template) {
      // Create default template
      const defaultTemplate = {
        userId: session.user.id,
        startDay: 'saturday',
        meals: {
          breakfast: true,
          lunch: true,
          dinner: true
        },
        weeklyStaples: [], // Initialize with empty staples
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const templateResult = await templatesCollection.insertOne(defaultTemplate);
      template = await templatesCollection.findOne({ _id: templateResult.insertedId });
      
      if (!template) {
        return NextResponse.json({ error: TEMPLATE_ERRORS.TEMPLATE_CREATION_FAILED }, { status: 500 });
      }
    }

    // Calculate end date and generate meal plan name using date strings
    const endDateString = calculateEndDateAsString(startDate);

    // Generate meal plan name based on start date
    const mealPlanName = generateMealPlanNameFromString(startDate);

    // Create meal plan items based on template
    const items = [];
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDateString);
    
    // Generate items for each day in the meal plan
    for (let date = new Date(startDateObj); date <= endDateObj; date.setDate(date.getDate() + 1)) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[date.getDay()] as DayOfWeek;
      
      // Add meals based on template
      if (template.meals.breakfast) {
        items.push({
          _id: new ObjectId().toString(),
          mealPlanId: '', // Will be set after meal plan creation
          dayOfWeek,
          mealType: 'breakfast',
          items: [],
          notes: ''
        });
      }
      
      if (template.meals.lunch) {
        items.push({
          _id: new ObjectId().toString(),
          mealPlanId: '', // Will be set after meal plan creation
          dayOfWeek,
          mealType: 'lunch',
          items: [],
          notes: ''
        });
      }
      
      if (template.meals.dinner) {
        items.push({
          _id: new ObjectId().toString(),
          mealPlanId: '', // Will be set after meal plan creation
          dayOfWeek,
          mealType: 'dinner',
          items: [],
          notes: ''
        });
      }
    }
    
    // Add weekly staples once for the entire meal plan (not per day)
    if (template.weeklyStaples && template.weeklyStaples.length > 0) {
      items.push({
        _id: new ObjectId().toString(),
        mealPlanId: '', // Will be set after meal plan creation
        dayOfWeek: template.startDay, // Use the meal plan start day for staples
        mealType: 'staples' as MealType, // Special meal type for staples
        items: template.weeklyStaples.map((staple: MealItem) => ({
          ...staple,
          _id: new ObjectId().toString()
        })),
        notes: 'Weekly Staples'
      });
    }

    const now = new Date();
    const mealPlan = {
      name: mealPlanName,
      startDate: startDate,
      endDate: endDateString,
      templateId: template._id.toString(),
      templateSnapshot: {
        startDay: template.startDay,
        meals: template.meals,
        weeklyStaples: template.weeklyStaples || [] // Include staples in snapshot
      },
      userId: session.user.id,
      items, // Populated based on template
      createdAt: now,
      updatedAt: now
    };

    const result = await mealPlansCollection.insertOne(mealPlan);
    const createdMealPlan = await mealPlansCollection.findOne({ _id: result.insertedId });

    if (!createdMealPlan) {
      return NextResponse.json({ error: MEAL_PLAN_ERRORS.MEAL_PLAN_CREATION_FAILED }, { status: 500 });
    }

    // Update meal plan items with the correct meal plan ID
    if (items.length > 0) {
      await mealPlansCollection.updateOne(
        { _id: result.insertedId },
        { 
          $set: { 
            'items': items.map(item => ({ ...item, mealPlanId: result.insertedId.toString() }))
          }
        }
      );
    }

    // Return with template snapshot data
    const mealPlanWithTemplate = {
      ...createdMealPlan,
      items: items.map(item => ({ ...item, mealPlanId: result.insertedId.toString() })),
      template: {
        _id: template._id.toString(),
        userId: session.user.id,
        ...createdMealPlan.templateSnapshot,
        createdAt: now,
        updatedAt: now
      }
    };

    return NextResponse.json(mealPlanWithTemplate, { status: 201 });
  } catch (error) {
    logError('MealPlans POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
} 