import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedSession } from '@/lib/user-utils';
import { parsePaginationParams } from '@/lib/pagination-utils';
import { searchRecipes, createRecipe } from '@/lib/services/recipes';
import { serviceErrorResponse } from '@/lib/api-error-response';
import type { CreateRecipeRequest } from '@/types/recipe';

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(searchParams);

    const tagsParam = searchParams.get('tags');
    const ratingsParam = searchParams.get('ratings');
    const tags = tagsParam
      ? tagsParam
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const ratings = ratingsParam
      ? ratingsParam
          .split(',')
          .map((r) => parseInt(r.trim(), 10))
          .filter((r) => !Number.isNaN(r))
      : [];

    const result = await searchRecipes(session.user.id, {
      query: searchParams.get('query'),
      accessLevel: searchParams.get('accessLevel'),
      tags,
      ratings,
      pagination,
    });

    return NextResponse.json(result);
  } catch (error) {
    return serviceErrorResponse('Recipes GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const body: CreateRecipeRequest = await request.json();
    const created = await createRecipe(session.user.id, body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return serviceErrorResponse('Recipes POST', error);
  }
}
