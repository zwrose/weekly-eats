import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedSession } from '@/lib/user-utils';
import { ObjectId } from 'mongodb';
import { getMongoClient } from '@/lib/mongodb';
import { RECIPE_ERRORS } from '@/lib/errors';
import { getRecipe, updateRecipe } from '@/lib/services/recipes';
import { serviceErrorResponse } from '@/lib/api-error-response';
import type { UpdateRecipeRequest } from '@/types/recipe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const { id } = await params;
    const recipe = await getRecipe(session.user.id, id);
    return NextResponse.json(recipe);
  } catch (error) {
    return serviceErrorResponse('Recipes GET [id]', error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const { id } = await params;
    const body: UpdateRecipeRequest = await request.json();
    const updated = await updateRecipe(session.user.id, id, body);
    return NextResponse.json(updated);
  } catch (error) {
    return serviceErrorResponse('Recipes PUT [id]', error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: RECIPE_ERRORS.INVALID_RECIPE_ID }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const recipesCollection = db.collection('recipes');

    const result = await recipesCollection.deleteOne({
      _id: ObjectId.createFromHexString(id),
      createdBy: session.user.id,
    });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: RECIPE_ERRORS.NO_PERMISSION_TO_EDIT }, { status: 404 });
    }

    return NextResponse.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    return serviceErrorResponse('Recipes DELETE [id]', error);
  }
}
