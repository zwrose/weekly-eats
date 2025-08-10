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

// Mock Mongo client used by this route file
const findMock = vi.fn();
const toArrayMock = vi.fn();
const insertOneMock = vi.fn();
const findOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
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
      }),
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const makeRequest = (url: string, body?: unknown) => ({ url, json: async () => body } as any);

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findMock.mockReset();
  toArrayMock.mockReset();
  insertOneMock.mockReset();
  findOneMock.mockReset();
});

describe('api/food-items route', () => {
  it('GET returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET(makeRequest('http://localhost/api/food-items'));
    expect(res.status).toBe(401);
  });

  it('GET returns list when authenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    toArrayMock.mockResolvedValueOnce([{ _id: 'f1', name: 'Flour' }]);
    const res = await routes.GET(makeRequest('http://localhost/api/food-items?limit=5'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(findMock).toHaveBeenCalled();
  });

  it('POST validates required fields', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    const body = { name: '', singularName: '', pluralName: '', unit: '', isGlobal: false };
    const res = await routes.POST(makeRequest('http://localhost/api/food-items', body));
    expect(res.status).toBe(400);
  });

  it('POST creates food item', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    insertOneMock.mockResolvedValueOnce({ insertedId: 'new-food-id' });
    // Pre-insert uniqueness check should return null, then post-insert retrieval returns the created doc
    findOneMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: 'new-food-id', name: 'Sugar' });
    const body = { name: 'Sugar', singularName: 'sugar', pluralName: 'sugars', unit: 'gram', isGlobal: false };
    const res = await routes.POST(makeRequest('http://localhost/api/food-items', body));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json._id).toBe('new-food-id');
  });
});


