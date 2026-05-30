import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedSession } from '@/lib/user-utils';
import { parsePaginationParams } from '@/lib/pagination-utils';
import { searchFoodItems, createFoodItem } from '@/lib/services/food-items';
import { serviceErrorResponse } from '@/lib/api-error-response';

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(searchParams, {
      defaultSortBy: 'name',
      defaultSortOrder: 'asc',
    });

    const result = await searchFoodItems(session.user.id, {
      query: searchParams.get('query') || '',
      accessLevel: searchParams.get('accessLevel'),
      userOnly: searchParams.get('userOnly') === 'true',
      globalOnly: searchParams.get('globalOnly') === 'true',
      excludeUserCreated: searchParams.get('excludeUserCreated') === 'true',
      pagination,
    });

    return NextResponse.json(result);
  } catch (error) {
    return serviceErrorResponse('FoodItems GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const body = await request.json();
    const created = await createFoodItem(session.user.id, {
      name: body?.name,
      singularName: body?.singularName,
      pluralName: body?.pluralName,
      unit: body?.unit,
      isGlobal: body?.isGlobal,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return serviceErrorResponse('FoodItems POST', error);
  }
}
