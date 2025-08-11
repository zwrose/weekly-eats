import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findMock = vi.fn();
const toArrayMock = vi.fn();
const insertOneMock = vi.fn();
const findOneMock = vi.fn();
const deleteOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'pantry') {
          return {
            find: () => ({ sort: () => ({ limit: () => ({ toArray: toArrayMock }) }) }),
            insertOne: insertOneMock,
            findOne: findOneMock,
            deleteOne: deleteOneMock,
          };
        }
        if (name === 'foodItems') {
          return {
            find: findMock,
            findOne: findOneMock,
            toArray: toArrayMock,
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
  findMock.mockReset();
  toArrayMock.mockReset();
  insertOneMock.mockReset();
  findOneMock.mockReset();
  deleteOneMock.mockReset();
});

describe('api/pantry route', () => {
  it('GET requires auth', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET(makeReq('http://localhost/api/pantry'));
    expect(res.status).toBe(401);
  });

  it('POST validates and creates pantry item', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    // Food item exists
    const validFoodItemId = '64b7f8c2a2b7c2f1a2b7c2f1';
    findOneMock.mockResolvedValueOnce({ _id: validFoodItemId, name: 'Apple', singularName: 'apple', pluralName: 'apples', unit: 'each' });
    // No existing pantry item
    findOneMock.mockResolvedValueOnce(null);
    insertOneMock.mockResolvedValueOnce({ insertedId: 'p1' });
    findOneMock.mockResolvedValueOnce({ _id: 'p1', userId: 'u1', foodItemId: validFoodItemId, addedAt: new Date() });
    const res = await routes.POST(makeReq('http://localhost/api/pantry', { foodItemId: validFoodItemId }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty('foodItem');
  });

  it('DELETE removes a pantry item', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    deleteOneMock.mockResolvedValueOnce({ deletedCount: 1 });
    const res = await routes.DELETE(makeReq('http://localhost/api/pantry?foodItemId=f1'));
    expect(res.status).toBe(200);
  });
});


