import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Mongo at the module boundary the service imports.
const findOneMock = vi.fn();
const insertOneMock = vi.fn();
const paginatedResponseMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
        findOne: findOneMock,
        insertOne: insertOneMock,
      }),
    }),
  })),
}));

vi.mock('@/lib/pagination-utils', () => ({
  paginatedResponse: (...args: unknown[]) => paginatedResponseMock(...args),
}));

const { searchFoodItems, getFoodItem, createFoodItem } = await import('@/lib/services/food-items');
const { ValidationError, NotFoundError, ForbiddenError, ConflictError } =
  await import('@/lib/service-errors');

const pagination = { page: 1, limit: 10, sortBy: 'name', sortOrder: 1 as const };

beforeEach(() => {
  findOneMock.mockReset();
  insertOneMock.mockReset();
  paginatedResponseMock.mockReset();
});

describe('searchFoodItems', () => {
  it('scopes the default query to global OR the caller and annotates accessLevel', async () => {
    paginatedResponseMock.mockResolvedValueOnce({
      data: [
        { _id: 'f1', name: 'Mine', isGlobal: false, createdBy: 'u1' },
        { _id: 'f2', name: 'Global', isGlobal: true, createdBy: 'other' },
        { _id: 'f3', name: 'SharedByMe', isGlobal: true, createdBy: 'u1' },
      ],
      total: 3,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    const result = await searchFoodItems('u1', { pagination });

    const filterArg = paginatedResponseMock.mock.calls[0][1];
    expect(filterArg.$or).toEqual([{ isGlobal: true }, { createdBy: 'u1' }]);
    expect(result.data[0].accessLevel).toBe('private');
    expect(result.data[1].accessLevel).toBe('shared-by-others');
    expect(result.data[2].accessLevel).toBe('shared-by-you');
  });

  it("never returns another user's personal items in accessLevel=private", async () => {
    paginatedResponseMock.mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
    await searchFoodItems('u1', { accessLevel: 'private', pagination });
    const filterArg = paginatedResponseMock.mock.calls[0][1];
    expect(filterArg.createdBy).toBe('u1');
    expect(filterArg.isGlobal).toEqual({ $ne: true });
  });
});

describe('getFoodItem', () => {
  it('throws ValidationError for a malformed id', async () => {
    await expect(getFoodItem('u1', { id: 'not-an-objectid' })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('throws NotFoundError when the document is missing', async () => {
    findOneMock.mockResolvedValueOnce(null);
    await expect(getFoodItem('u1', { id: '64b7f8c2a2b7c2f1a2b7c2f1' })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("throws ForbiddenError for another user's personal item", async () => {
    findOneMock.mockResolvedValueOnce({ _id: 'x', isGlobal: false, createdBy: 'u2' });
    await expect(getFoodItem('u1', { id: '64b7f8c2a2b7c2f1a2b7c2f1' })).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it('returns a global item to any caller', async () => {
    const doc = { _id: 'x', name: 'Sugar', isGlobal: true, createdBy: 'u2' };
    findOneMock.mockResolvedValueOnce(doc);
    const result = await getFoodItem('u1', { id: '64b7f8c2a2b7c2f1a2b7c2f1' });
    expect(result).toEqual(doc);
  });

  it("lets an admin read another user's personal item", async () => {
    const doc = { _id: 'x', name: 'Private', isGlobal: false, createdBy: 'u2' };
    findOneMock.mockResolvedValueOnce(doc);
    const result = await getFoodItem('u1', { id: '64b7f8c2a2b7c2f1a2b7c2f1', isAdmin: true });
    expect(result).toEqual(doc);
  });
});

describe('createFoodItem', () => {
  const valid = {
    name: 'Sugar',
    singularName: 'sugar',
    pluralName: 'sugars',
    unit: 'gram',
    isGlobal: false,
  };

  it('throws ValidationError when the name is missing', async () => {
    await expect(createFoodItem('u1', { ...valid, name: '' })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('throws ValidationError for an invalid unit', async () => {
    await expect(createFoodItem('u1', { ...valid, unit: 'furlong' })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('throws ValidationError when isGlobal is not a boolean', async () => {
    await expect(
      // @ts-expect-error testing runtime guard on a non-boolean
      createFoodItem('u1', { ...valid, isGlobal: undefined })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ConflictError when a duplicate exists', async () => {
    findOneMock.mockResolvedValueOnce({ singularName: 'sugar', pluralName: 'sugars' });
    await expect(createFoodItem('u1', valid)).rejects.toBeInstanceOf(ConflictError);
  });

  it('inserts a personal item scoped to the caller and returns the created doc', async () => {
    findOneMock.mockResolvedValueOnce(null); // dedupe check
    insertOneMock.mockResolvedValueOnce({ insertedId: 'new-id' });
    findOneMock.mockResolvedValueOnce({ _id: 'new-id', ...valid, createdBy: 'u1' });

    const created = await createFoodItem('u1', valid);

    const insertedDoc = insertOneMock.mock.calls[0][0];
    expect(insertedDoc.createdBy).toBe('u1');
    expect(insertedDoc.isGlobal).toBe(false);
    expect(created._id).toBe('new-id');
  });
});
