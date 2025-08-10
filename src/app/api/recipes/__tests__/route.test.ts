import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next-auth session
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

// Mock authOptions to avoid importing real auth module side effects
// Use the exact specifier used by the route file
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Prevent accidental DB adapter connections if auth gets imported elsewhere
vi.mock('@/lib/mongodb-adapter', () => ({
  default: Promise.resolve({}),
}));

// Mock Mongo client used by this route file
const findMock = vi.fn();
const insertOneMock = vi.fn();
const toArrayMock = vi.fn();
const sortMock = vi.fn(() => ({ limit: () => ({ toArray: toArrayMock }) }));
const limitMock = vi.fn((n: number) => ({ toArray: toArrayMock }));

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
        find: (filter: unknown) => {
          // chainable API: .find().sort().limit().toArray()
          // record the filter for assertions
          findMock(filter);
          return { sort: (sortArg: unknown) => {
            sortMock(sortArg);
            return { limit: (n: number) => {
              limitMock(n);
              return { toArray: toArrayMock };
            }};
          }};
        },
        insertOne: insertOneMock,
      }),
    }),
  })),
}));

// Convenient access to mocked imports
const { getServerSession } = await import('next-auth/next');

// Import the route module after mocks are set up
const routes = await import('../route');

const makeRequest = (url: string, body?: unknown) => ({
  url,
  json: async () => body,
}) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findMock.mockReset();
  insertOneMock.mockReset();
  toArrayMock.mockReset();
  sortMock.mockReset();
  limitMock.mockReset();
});

describe('api/recipes route', () => {
  it('GET returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET(makeRequest('http://localhost/api/recipes'));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('GET applies default filter for global or user recipes', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    toArrayMock.mockResolvedValueOnce([{ _id: 'r1' }]);
    const res = await routes.GET(makeRequest('http://localhost/api/recipes'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(findMock).toHaveBeenCalledTimes(1);
    const filter = findMock.mock.calls[0][0];
    expect(filter).toMatchObject({
      $or: [
        { isGlobal: true },
        { createdBy: 'user-1' },
      ],
    });
  });

  it('POST validates required fields', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    const body = { title: '', instructions: '', ingredients: [] };
    const res = await routes.POST(makeRequest('http://localhost/api/recipes', body));
    expect(res.status).toBe(400);
    const data = await res.json();
    // Route uses RECIPE_ERRORS.TITLE_REQUIRED for missing essential fields
    expect(data.error).toBeDefined();
  });

  it('POST inserts new recipe and returns 201', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    insertOneMock.mockResolvedValueOnce({ insertedId: 'new-id' });
    toArrayMock.mockReset();
    const valid = {
      title: 'My Recipe',
      emoji: '🍲',
      instructions: 'Cook it',
      isGlobal: false,
      ingredients: [
        { title: 'Group A', ingredients: [{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup' }] },
      ],
    };
    const res = await routes.POST(makeRequest('http://localhost/api/recipes', valid));
    expect(insertOneMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json._id).toBe('new-id');
    expect(json.createdBy).toBe('u1');
  });
});


