import { Collection, Document, Filter, WithId } from 'mongodb';

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 1 | -1;
}

export interface PaginationDefaults {
  defaultLimit?: number;
  defaultSortBy?: string;
  defaultSortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults?: PaginationDefaults
): PaginationParams {
  const defaultLimit = defaults?.defaultLimit ?? 10;
  const defaultSortBy = defaults?.defaultSortBy ?? 'updatedAt';
  const defaultSortOrder = defaults?.defaultSortOrder ?? 'desc';

  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const rawLimit = parseInt(searchParams.get('limit') || String(defaultLimit), 10);
  const sortBy = searchParams.get('sortBy') || defaultSortBy;
  const sortOrderParam = searchParams.get('sortOrder') || defaultSortOrder;

  const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const limit = Number.isNaN(rawLimit)
    ? defaultLimit
    : Math.min(Math.max(rawLimit, 1), 100);
  const sortOrder: 1 | -1 = sortOrderParam === 'asc' ? 1 : -1;

  return { page, limit, sortBy, sortOrder };
}

export async function paginatedResponse<T extends Document>(
  collection: Collection<T>,
  filter: Filter<T>,
  params: PaginationParams
): Promise<PaginatedResult<WithId<T>>> {
  const { page, limit, sortBy, sortOrder } = params;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
