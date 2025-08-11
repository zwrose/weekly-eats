import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findMock = vi.fn();
const toArrayMock = vi.fn();
const insertOneMock = vi.fn();
const findOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'mealPlans') {
          return {
            find: () => ({
              // Support both .toArray() and .sort().toArray()
              toArray: toArrayMock,
              sort: () => ({ toArray: toArrayMock }),
            }),
            insertOne: insertOneMock,
            findOne: findOneMock,
          };
        }
        if (name === 'mealPlanTemplates') {
          return {
            findOne: findOneMock,
            insertOne: insertOneMock,
          };
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
  toArrayMock.mockReset();
  findOneMock.mockReset();
  insertOneMock.mockReset();
});

describe('api/meal-plans route', () => {
  it('GET requires auth', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
  });

  it('GET returns user meal plans', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    toArrayMock.mockResolvedValueOnce([
      { _id: 'p1', name: 'Week A', templateId: 't1', templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true } }, createdAt: new Date() },
    ]);
    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json[0]).toHaveProperty('template');
  });

  it('POST validates startDate and creates meal plan', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    // No existing template -> create default
    findOneMock.mockResolvedValueOnce(null); // templatesCollection.findOne
    insertOneMock.mockResolvedValueOnce({ insertedId: 't-new' }); // templates insert
    findOneMock.mockResolvedValueOnce({ _id: 't-new', startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true } });
    // Insert meal plan
    insertOneMock.mockResolvedValueOnce({ insertedId: 'p-new' });
    findOneMock.mockResolvedValueOnce({ _id: 'p-new', name: 'Week of ...', templateId: 't-new', templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true } }, createdAt: new Date() });
    toArrayMock.mockResolvedValueOnce([]); // existing plans for overlap

    const res = await routes.POST(makeReq('http://localhost/api/meal-plans', { startDate: '2024-03-01' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('_id');
    expect(body).toHaveProperty('template');
  });
});


