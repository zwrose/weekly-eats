import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next-auth session
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

// Mock authOptions to avoid importing real adapter
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/mongodb-adapter', () => ({
  default: Promise.resolve({}),
}));

vi.mock('@/lib/errors', () => ({
  AUTH_ERRORS: { UNAUTHORIZED: 'Unauthorized' },
  FOOD_ITEM_ERRORS: {
    NAME_REQUIRED: 'Name is required',
    SINGULAR_NAME_REQUIRED: 'Singular name is required',
    PLURAL_NAME_REQUIRED: 'Plural name is required',
    UNIT_REQUIRED: 'Unit is required',
    IS_GLOBAL_REQUIRED: 'isGlobal is required',
    FOOD_ITEM_ALREADY_EXISTS: 'Food item already exists',
  },
  API_ERRORS: { INTERNAL_SERVER_ERROR: 'Internal server error' },
  logError: vi.fn(),
}));

// Mock pagination-utils
const mockParsePaginationParams = vi.fn();
const mockPaginatedResponse = vi.fn();

vi.mock('@/lib/pagination-utils', () => ({
  parsePaginationParams: (...args: unknown[]) => mockParsePaginationParams(...args),
  paginatedResponse: (...args: unknown[]) => mockPaginatedResponse(...args),
}));

// Mock Mongo client
const findMock = vi.fn();
const toArrayMock = vi.fn();
const insertOneMock = vi.fn();
const findOneMock = vi.fn();
const collectionMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (...args: unknown[]) => {
        collectionMock(...args);
        return {
          find: (filter: unknown) => {
            findMock(filter);
            return {
              sort: () => ({
                limit: () => ({ toArray: toArrayMock }),
              }),
            };
          },
          insertOne: insertOneMock,
          findOne: findOneMock,
        };
      },
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const makeRequest = (url: string, body?: unknown) => ({ url, json: async () => body }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findMock.mockReset();
  toArrayMock.mockReset();
  insertOneMock.mockReset();
  findOneMock.mockReset();
  collectionMock.mockReset();
  mockParsePaginationParams.mockReset();
  mockPaginatedResponse.mockReset();

  // Default pagination params
  mockParsePaginationParams.mockReturnValue({
    page: 1,
    limit: 10,
    sortBy: 'name',
    sortOrder: 1,
  });
});

describe('api/food-items route', () => {
  describe('GET - authentication', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.GET(makeRequest('http://localhost/api/food-items'));
      expect(res.status).toBe(401);
    });
  });

  describe('GET - server-side pagination', () => {
    it('returns paginated response with defaults', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      mockPaginatedResponse.mockResolvedValueOnce({
        data: [{ _id: 'f1', name: 'Flour', isGlobal: false, createdBy: 'u1' }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const res = await routes.GET(makeRequest('http://localhost/api/food-items'));
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data).toHaveLength(1);
      expect(json.total).toBe(1);
      expect(json.page).toBe(1);
      expect(json.totalPages).toBe(1);
      expect(mockParsePaginationParams).toHaveBeenCalled();
      expect(mockPaginatedResponse).toHaveBeenCalled();
    });

    it('passes pagination params from URL', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      mockParsePaginationParams.mockReturnValue({
        page: 2,
        limit: 10,
        sortBy: 'updatedAt',
        sortOrder: -1,
      });
      mockPaginatedResponse.mockResolvedValueOnce({
        data: [],
        total: 15,
        page: 2,
        limit: 10,
        totalPages: 2,
      });

      const res = await routes.GET(
        makeRequest(
          'http://localhost/api/food-items?page=2&limit=10&sortBy=updatedAt&sortOrder=desc'
        )
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.page).toBe(2);
      expect(json.limit).toBe(10);
    });
  });

  describe('GET - unified query with accessLevel', () => {
    it('returns all accessible items by default (personal + global)', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      mockPaginatedResponse.mockResolvedValueOnce({
        data: [
          { _id: 'f1', name: 'My Flour', isGlobal: false, createdBy: 'u1' },
          { _id: 'f2', name: 'Global Sugar', isGlobal: true, createdBy: 'other' },
          { _id: 'f3', name: 'Shared Salt', isGlobal: true, createdBy: 'u1' },
        ],
        total: 3,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const res = await routes.GET(makeRequest('http://localhost/api/food-items'));
      const json = await res.json();

      // Verify unified filter passed to paginatedResponse
      const filterArg = mockPaginatedResponse.mock.calls[0][1];
      expect(filterArg.$or).toEqual([{ isGlobal: true }, { createdBy: 'u1' }]);

      // Verify accessLevel annotation
      expect(json.data[0].accessLevel).toBe('private');
      expect(json.data[1].accessLevel).toBe('shared-by-others');
      expect(json.data[2].accessLevel).toBe('shared-by-you');
    });

    it('filters by accessLevel=private', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      mockPaginatedResponse.mockResolvedValueOnce({
        data: [{ _id: 'f1', name: 'My Flour', isGlobal: false, createdBy: 'u1' }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const res = await routes.GET(
        makeRequest('http://localhost/api/food-items?accessLevel=private')
      );
      const json = await res.json();

      const filterArg = mockPaginatedResponse.mock.calls[0][1];
      expect(filterArg.createdBy).toBe('u1');
      expect(filterArg.isGlobal).toEqual({ $ne: true });
      expect(json.data[0].accessLevel).toBe('private');
    });

    it('filters by accessLevel=shared-by-others', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      mockPaginatedResponse.mockResolvedValueOnce({
        data: [{ _id: 'f2', name: 'Global Sugar', isGlobal: true, createdBy: 'other' }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const res = await routes.GET(
        makeRequest('http://localhost/api/food-items?accessLevel=shared-by-others')
      );
      const json = await res.json();

      const filterArg = mockPaginatedResponse.mock.calls[0][1];
      expect(filterArg.isGlobal).toBe(true);
      expect(filterArg.createdBy).toEqual({ $ne: 'u1' });
      expect(json.data[0].accessLevel).toBe('shared-by-others');
    });

    it('filters by accessLevel=shared-by-you', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      mockPaginatedResponse.mockResolvedValueOnce({
        data: [{ _id: 'f3', name: 'Shared Salt', isGlobal: true, createdBy: 'u1' }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const res = await routes.GET(
        makeRequest('http://localhost/api/food-items?accessLevel=shared-by-you')
      );
      const json = await res.json();

      const filterArg = mockPaginatedResponse.mock.calls[0][1];
      expect(filterArg.isGlobal).toBe(true);
      expect(filterArg.createdBy).toBe('u1');
      expect(json.data[0].accessLevel).toBe('shared-by-you');
    });
  });

  describe('GET - search filtering', () => {
    it('filters by query string (name search)', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      mockPaginatedResponse.mockResolvedValueOnce({
        data: [{ _id: 'f1', name: 'Flour', isGlobal: false, createdBy: 'u1' }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const res = await routes.GET(makeRequest('http://localhost/api/food-items?query=flour'));
      expect(res.status).toBe(200);

      const filterArg = mockPaginatedResponse.mock.calls[0][1];
      // Search uses $and to combine access filter with multi-field search
      expect(filterArg.$and).toBeDefined();
      expect(filterArg.$and).toHaveLength(2);
      const searchCondition = filterArg.$and[1];
      expect(searchCondition.$or).toEqual([
        { name: { $regex: 'flour', $options: 'i' } },
        { singularName: { $regex: 'flour', $options: 'i' } },
        { pluralName: { $regex: 'flour', $options: 'i' } },
      ]);
    });
  });

  describe('GET - backward compatibility', () => {
    it('supports legacy userOnly param', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      mockPaginatedResponse.mockResolvedValueOnce({
        data: [{ _id: 'f1', name: 'My Flour', isGlobal: false, createdBy: 'u1' }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const res = await routes.GET(makeRequest('http://localhost/api/food-items?userOnly=true'));
      expect(res.status).toBe(200);

      const filterArg = mockPaginatedResponse.mock.calls[0][1];
      expect(filterArg.createdBy).toBe('u1');
    });

    it('supports legacy globalOnly param', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      mockPaginatedResponse.mockResolvedValueOnce({
        data: [{ _id: 'f2', name: 'Global Sugar', isGlobal: true, createdBy: 'other' }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const res = await routes.GET(
        makeRequest('http://localhost/api/food-items?globalOnly=true&excludeUserCreated=true')
      );
      expect(res.status).toBe(200);

      const filterArg = mockPaginatedResponse.mock.calls[0][1];
      expect(filterArg.isGlobal).toBe(true);
      expect(filterArg.createdBy).toEqual({ $ne: 'u1' });
    });
  });

  describe('POST', () => {
    it('validates required fields', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      const body = { name: '', singularName: '', pluralName: '', unit: '', isGlobal: false };
      const res = await routes.POST(makeRequest('http://localhost/api/food-items', body));
      expect(res.status).toBe(400);
    });

    it('creates food item', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      insertOneMock.mockResolvedValueOnce({ insertedId: 'new-food-id' });
      findOneMock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ _id: 'new-food-id', name: 'Sugar' });
      const body = {
        name: 'Sugar',
        singularName: 'sugar',
        pluralName: 'sugars',
        unit: 'gram',
        isGlobal: false,
      };
      const res = await routes.POST(makeRequest('http://localhost/api/food-items', body));
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json._id).toBe('new-food-id');
    });
  });
});
