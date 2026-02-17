import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

vi.mock('@/lib/errors', () => ({
  AUTH_ERRORS: { UNAUTHORIZED: 'Unauthorized' },
  PANTRY_ERRORS: {
    FOOD_ITEM_ID_REQUIRED: 'Food item ID is required',
    FOOD_ITEM_NOT_FOUND: 'Food item not found',
    ITEM_ALREADY_EXISTS: 'Item already in pantry',
    PANTRY_ITEM_NOT_FOUND: 'Pantry item not found',
    PANTRY_ITEM_CREATION_FAILED: 'Failed to create pantry item',
  },
  FOOD_ITEM_ERRORS: { INVALID_FOOD_ITEM_ID: 'Invalid food item ID' },
  API_ERRORS: { INTERNAL_SERVER_ERROR: 'Internal server error' },
  logError: vi.fn(),
}));

const aggregateToArrayMock = vi.fn();
const aggregatePipelines: unknown[][] = [];
const insertOneMock = vi.fn();
const findOneMock = vi.fn();
const deleteOneMock = vi.fn();
const findMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'pantry') {
          return {
            aggregate: (pipeline: unknown[]) => {
              aggregatePipelines.push(pipeline);
              return { toArray: aggregateToArrayMock };
            },
            find: () => ({ sort: () => ({ limit: () => ({ toArray: aggregateToArrayMock }) }) }),
            insertOne: insertOneMock,
            findOne: findOneMock,
            deleteOne: deleteOneMock,
          };
        }
        if (name === 'foodItems') {
          return {
            find: (...args: unknown[]) => {
              findMock(...args);
              return { toArray: aggregateToArrayMock };
            },
            findOne: findOneMock,
          } as any;
        }
        return {} as any;
      },
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const makeReq = (url: string, body?: unknown) => ({ url, json: async () => body } as any);

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  aggregateToArrayMock.mockReset();
  aggregatePipelines.length = 0;
  insertOneMock.mockReset();
  findOneMock.mockReset();
  deleteOneMock.mockReset();
  findMock.mockReset();
});

describe('api/pantry route', () => {
  describe('GET - authentication', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.GET(makeReq('http://localhost/api/pantry'));
      expect(res.status).toBe(401);
    });
  });

  describe('GET - server-side pagination', () => {
    it('returns paginated response with defaults', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });

      // First aggregate call: count pipeline
      aggregateToArrayMock.mockResolvedValueOnce([{ total: 1 }]);
      // Second aggregate call: data pipeline
      aggregateToArrayMock.mockResolvedValueOnce([
        {
          _id: 'p1',
          userId: 'u1',
          foodItemId: 'f1',
          addedAt: new Date(),
          foodItem: { _id: 'f1', name: 'Apple', singularName: 'apple', pluralName: 'apples', unit: 'each' },
        },
      ]);

      const res = await routes.GET(makeReq('http://localhost/api/pantry'));
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data).toHaveLength(1);
      expect(json.data[0].foodItem.name).toBe('Apple');
      expect(json.total).toBe(1);
      expect(json.page).toBe(1);
      expect(json.limit).toBe(10);
      expect(json.totalPages).toBe(1);
    });

    it('passes page and limit params', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });

      aggregateToArrayMock.mockResolvedValueOnce([{ total: 15 }]);
      aggregateToArrayMock.mockResolvedValueOnce([]);

      const res = await routes.GET(makeReq('http://localhost/api/pantry?page=2&limit=10'));
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.page).toBe(2);
      expect(json.limit).toBe(10);
      expect(json.total).toBe(15);
      expect(json.totalPages).toBe(2);

      // Verify the data pipeline includes $skip and $limit
      const dataPipeline = aggregatePipelines[1];
      const skipStage = dataPipeline.find((s: any) => s.$skip !== undefined) as any;
      const limitStage = dataPipeline.find((s: any) => s.$limit !== undefined) as any;
      expect(skipStage.$skip).toBe(10); // (page 2 - 1) * limit 10
      expect(limitStage.$limit).toBe(10);
    });

    it('filters by search query on food item names', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });

      aggregateToArrayMock.mockResolvedValueOnce([{ total: 1 }]);
      aggregateToArrayMock.mockResolvedValueOnce([
        {
          _id: 'p1',
          userId: 'u1',
          foodItemId: 'f1',
          addedAt: new Date(),
          foodItem: { _id: 'f1', name: 'Apple', singularName: 'apple', pluralName: 'apples', unit: 'each' },
        },
      ]);

      const res = await routes.GET(makeReq('http://localhost/api/pantry?query=apple'));
      expect(res.status).toBe(200);

      // Verify the aggregation pipeline includes a $lookup and $match for food item name
      const dataPipeline = aggregatePipelines[1];
      const lookupStage = dataPipeline.find((s: any) => s.$lookup) as any;
      expect(lookupStage).toBeDefined();
      expect(lookupStage.$lookup.from).toBe('foodItems');

      // There should be a $match stage with $or for food item names
      const matchStages = dataPipeline.filter((s: any) => s.$match) as any[];
      const nameMatch = matchStages.find((s: any) => s.$match.$or);
      expect(nameMatch).toBeDefined();
      expect(nameMatch.$match.$or).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 'foodItem.name': expect.any(Object) }),
        ])
      );
    });

    it('sorts by food item name by default', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });

      aggregateToArrayMock.mockResolvedValueOnce([{ total: 0 }]);
      aggregateToArrayMock.mockResolvedValueOnce([]);

      await routes.GET(makeReq('http://localhost/api/pantry'));

      const dataPipeline = aggregatePipelines[1];
      const sortStage = dataPipeline.find((s: any) => s.$sort) as any;
      expect(sortStage).toBeDefined();
      expect(sortStage.$sort['foodItem.name']).toBe(1);
    });

    it('returns empty results when total is 0', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });

      aggregateToArrayMock.mockResolvedValueOnce([]); // count returns empty
      aggregateToArrayMock.mockResolvedValueOnce([]);

      const res = await routes.GET(makeReq('http://localhost/api/pantry'));
      const json = await res.json();

      expect(json.total).toBe(0);
      expect(json.totalPages).toBe(0);
      expect(json.data).toHaveLength(0);
    });

    it('clamps limit to max 100', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });

      aggregateToArrayMock.mockResolvedValueOnce([{ total: 0 }]);
      aggregateToArrayMock.mockResolvedValueOnce([]);

      const res = await routes.GET(makeReq('http://localhost/api/pantry?limit=500'));
      const json = await res.json();

      expect(json.limit).toBe(100);
    });
  });

  describe('POST', () => {
    it('validates and creates pantry item', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      const validFoodItemId = '64b7f8c2a2b7c2f1a2b7c2f1';
      findOneMock.mockResolvedValueOnce({ _id: validFoodItemId, name: 'Apple', singularName: 'apple', pluralName: 'apples', unit: 'each' });
      findOneMock.mockResolvedValueOnce(null); // no existing pantry item
      insertOneMock.mockResolvedValueOnce({ insertedId: 'p1' });
      findOneMock.mockResolvedValueOnce({ _id: 'p1', userId: 'u1', foodItemId: validFoodItemId, addedAt: new Date() });
      const res = await routes.POST(makeReq('http://localhost/api/pantry', { foodItemId: validFoodItemId }));
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json).toHaveProperty('foodItem');
    });

    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.POST(makeReq('http://localhost/api/pantry', { foodItemId: 'f1' }));
      expect(res.status).toBe(401);
    });

    it('returns 400 for missing foodItemId', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      const res = await routes.POST(makeReq('http://localhost/api/pantry', {}));
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid ObjectId', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      const res = await routes.POST(makeReq('http://localhost/api/pantry', { foodItemId: 'invalid' }));
      expect(res.status).toBe(400);
    });

    it('returns 409 for duplicate pantry item', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      const validFoodItemId = '64b7f8c2a2b7c2f1a2b7c2f1';
      findOneMock.mockResolvedValueOnce({ _id: validFoodItemId, name: 'Apple' }); // food item exists
      findOneMock.mockResolvedValueOnce({ _id: 'p1' }); // already in pantry
      const res = await routes.POST(makeReq('http://localhost/api/pantry', { foodItemId: validFoodItemId }));
      expect(res.status).toBe(409);
    });
  });

  describe('DELETE', () => {
    it('removes a pantry item', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      deleteOneMock.mockResolvedValueOnce({ deletedCount: 1 });
      const res = await routes.DELETE(makeReq('http://localhost/api/pantry?foodItemId=f1'));
      expect(res.status).toBe(200);
    });

    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.DELETE(makeReq('http://localhost/api/pantry?foodItemId=f1'));
      expect(res.status).toBe(401);
    });

    it('returns 400 for missing foodItemId', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      const res = await routes.DELETE(makeReq('http://localhost/api/pantry'));
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent pantry item', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      deleteOneMock.mockResolvedValueOnce({ deletedCount: 0 });
      const res = await routes.DELETE(makeReq('http://localhost/api/pantry?foodItemId=f1'));
      expect(res.status).toBe(404);
    });
  });
});
