import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { UpdateMealPlanRequest, MealPlanItem } from '@/types/meal-plan';
import { 
  AUTH_ERRORS, 
  MEAL_PLAN_ERRORS, 
  API_ERRORS,
  logError 
} from '@/lib/errors';

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
    const templatesCollection = db.collection('mealPlanTemplates');

    const mealPlan = await mealPlansCollection.findOne({
      _id: new ObjectId(id),
      userId: session.user.id
    });

    if (!mealPlan) {
      return NextResponse.json({ error: MEAL_PLAN_ERRORS.MEAL_PLAN_NOT_FOUND }, { status: 404 });
    }

    // Get template data
    const template = await templatesCollection.findOne({
      _id: new ObjectId(mealPlan.templateId)
    });

    const mealPlanWithTemplate = {
      ...mealPlan,
      template
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

    // Check if meal plan exists and belongs to user
    const existingMealPlan = await mealPlansCollection.findOne({
      _id: new ObjectId(id),
      userId: session.user.id
    });

    if (!existingMealPlan) {
      return NextResponse.json({ error: MEAL_PLAN_ERRORS.MEAL_PLAN_NOT_FOUND }, { status: 404 });
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
    
    // Get template data
    const templatesCollection = db.collection('mealPlanTemplates');
    const template = await templatesCollection.findOne({
      _id: new ObjectId(updatedMealPlan.templateId)
    });

    const mealPlanWithTemplate = {
      ...updatedMealPlan,
      template
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

    const result = await mealPlansCollection.deleteOne({
      _id: new ObjectId(id),
      userId: session.user.id
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