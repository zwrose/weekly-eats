import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { CreateMealPlanRequest, MealPlan } from '@/types/meal-plan';
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const mealPlansCollection = db.collection('mealPlans');

    const mealPlans = await mealPlansCollection
      .find({ userId: session.user.id })
      .sort({ startDate: -1 })
      .toArray();

    // Transform meal plans to use template snapshot instead of fetching current template
    const mealPlansWithTemplates = mealPlans.map(plan => ({
      ...plan,
      template: {
        _id: plan.templateId,
        userId: session.user.id,
        ...plan.templateSnapshot,
        createdAt: plan.createdAt,
        updatedAt: plan.createdAt // Use creation time as template was snapshot at creation
      }
    }));

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

    const now = new Date();
    const mealPlan = {
      name: mealPlanName,
      startDate: startDate,
      endDate: endDateString,
      templateId: template._id.toString(),
      templateSnapshot: {
        startDay: template.startDay,
        meals: template.meals
      },
      userId: session.user.id,
      items: [], // Will be populated based on template
      createdAt: now,
      updatedAt: now
    };

    const result = await mealPlansCollection.insertOne(mealPlan);
    const createdMealPlan = await mealPlansCollection.findOne({ _id: result.insertedId });

    if (!createdMealPlan) {
      return NextResponse.json({ error: MEAL_PLAN_ERRORS.MEAL_PLAN_CREATION_FAILED }, { status: 500 });
    }

    // Return with template snapshot data
    const mealPlanWithTemplate = {
      ...createdMealPlan,
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