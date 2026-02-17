import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePaginationParams, paginatedResponse } from '../pagination-utils';

describe('parsePaginationParams', () => {
  it('returns defaults when no params provided', () => {
    const params = new URLSearchParams();
    const result = parsePaginationParams(params);
    expect(result).toEqual({
      page: 1,
      limit: 10,
      sortBy: 'updatedAt',
      sortOrder: -1,
    });
  });

  it('parses page and limit from search params', () => {
    const params = new URLSearchParams({ page: '3', limit: '10' });
    const result = parsePaginationParams(params);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
  });

  it('parses sortBy and sortOrder', () => {
    const params = new URLSearchParams({ sortBy: 'title', sortOrder: 'asc' });
    const result = parsePaginationParams(params);
    expect(result.sortBy).toBe('title');
    expect(result.sortOrder).toBe(1);
  });

  it('treats sortOrder "desc" as -1', () => {
    const params = new URLSearchParams({ sortOrder: 'desc' });
    const result = parsePaginationParams(params);
    expect(result.sortOrder).toBe(-1);
  });

  it('clamps page to minimum of 1', () => {
    const params = new URLSearchParams({ page: '0' });
    const result = parsePaginationParams(params);
    expect(result.page).toBe(1);
  });

  it('clamps negative page to 1', () => {
    const params = new URLSearchParams({ page: '-5' });
    const result = parsePaginationParams(params);
    expect(result.page).toBe(1);
  });

  it('clamps limit to minimum of 1', () => {
    const params = new URLSearchParams({ limit: '0' });
    const result = parsePaginationParams(params);
    expect(result.limit).toBe(1);
  });

  it('clamps limit to maximum of 100', () => {
    const params = new URLSearchParams({ limit: '500' });
    const result = parsePaginationParams(params);
    expect(result.limit).toBe(100);
  });

  it('handles non-numeric page gracefully (defaults to 1)', () => {
    const params = new URLSearchParams({ page: 'abc' });
    const result = parsePaginationParams(params);
    expect(result.page).toBe(1);
  });

  it('handles non-numeric limit gracefully (defaults to 10)', () => {
    const params = new URLSearchParams({ limit: 'xyz' });
    const result = parsePaginationParams(params);
    expect(result.limit).toBe(10);
  });

  it('accepts custom defaults', () => {
    const params = new URLSearchParams();
    const result = parsePaginationParams(params, {
      defaultLimit: 50,
      defaultSortBy: 'createdAt',
      defaultSortOrder: 'asc',
    });
    expect(result).toEqual({
      page: 1,
      limit: 50,
      sortBy: 'createdAt',
      sortOrder: 1,
    });
  });
});

describe('paginatedResponse', () => {
  let mockCollection: {
    find: ReturnType<typeof vi.fn>;
    countDocuments: ReturnType<typeof vi.fn>;
  };
  let mockCursor: {
    sort: ReturnType<typeof vi.fn>;
    skip: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    toArray: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockCursor = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
    };
    mockCollection = {
      find: vi.fn().mockReturnValue(mockCursor),
      countDocuments: vi.fn(),
    };
  });

  it('returns paginated data with metadata', async () => {
    const mockData = [{ _id: '1', name: 'Item 1' }, { _id: '2', name: 'Item 2' }];
    mockCursor.toArray.mockResolvedValue(mockData);
    mockCollection.countDocuments.mockResolvedValue(50);

    const result = await paginatedResponse(mockCollection as any, {}, {
      page: 1,
      limit: 10,
      sortBy: 'updatedAt',
      sortOrder: -1,
    });

    expect(result).toEqual({
      data: mockData,
      total: 50,
      page: 1,
      limit: 10,
      totalPages: 5,
    });
  });

  it('applies filter to both find and countDocuments', async () => {
    mockCursor.toArray.mockResolvedValue([]);
    mockCollection.countDocuments.mockResolvedValue(0);

    const filter = { isGlobal: true };
    await paginatedResponse(mockCollection as any, filter, {
      page: 1,
      limit: 10,
      sortBy: 'updatedAt',
      sortOrder: -1,
    });

    expect(mockCollection.find).toHaveBeenCalledWith(filter);
    expect(mockCollection.countDocuments).toHaveBeenCalledWith(filter);
  });

  it('applies sort, skip, and limit correctly', async () => {
    mockCursor.toArray.mockResolvedValue([]);
    mockCollection.countDocuments.mockResolvedValue(100);

    await paginatedResponse(mockCollection as any, {}, {
      page: 3,
      limit: 10,
      sortBy: 'title',
      sortOrder: 1,
    });

    expect(mockCursor.sort).toHaveBeenCalledWith({ title: 1 });
    expect(mockCursor.skip).toHaveBeenCalledWith(20); // (3-1) * 10
    expect(mockCursor.limit).toHaveBeenCalledWith(10);
  });

  it('calculates totalPages correctly', async () => {
    mockCursor.toArray.mockResolvedValue([]);
    mockCollection.countDocuments.mockResolvedValue(51);

    const result = await paginatedResponse(mockCollection as any, {}, {
      page: 1,
      limit: 10,
      sortBy: 'updatedAt',
      sortOrder: -1,
    });

    expect(result.totalPages).toBe(6); // ceil(51/10)
  });

  it('returns totalPages of 0 when no documents match', async () => {
    mockCursor.toArray.mockResolvedValue([]);
    mockCollection.countDocuments.mockResolvedValue(0);

    const result = await paginatedResponse(mockCollection as any, {}, {
      page: 1,
      limit: 10,
      sortBy: 'updatedAt',
      sortOrder: -1,
    });

    expect(result.totalPages).toBe(0);
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
  });

  it('calls both find and countDocuments', async () => {
    mockCursor.toArray.mockResolvedValue([]);
    mockCollection.countDocuments.mockResolvedValue(0);

    await paginatedResponse(mockCollection as any, {}, {
      page: 1,
      limit: 10,
      sortBy: 'updatedAt',
      sortOrder: -1,
    });

    expect(mockCollection.find).toHaveBeenCalledTimes(1);
    expect(mockCollection.countDocuments).toHaveBeenCalledTimes(1);
  });
});
