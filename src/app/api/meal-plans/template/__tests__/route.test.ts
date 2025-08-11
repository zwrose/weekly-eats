import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findOneMock = vi.fn();
const insertOneMock = vi.fn();
const updateOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => ({
        findOne: findOneMock,
        insertOne: insertOneMock,
        updateOne: updateOneMock,
      }),
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const makeReq = (url: string, body?: unknown) => ({ url, json: async () => body } as any);

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  insertOneMock.mockReset();
  updateOneMock.mockReset();
});

describe('api/meal-plans/template route', () => {
  it('GET requires auth', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
  });

  it('POST creates template when none exists', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce(null); // existing template
    insertOneMock.mockResolvedValueOnce({ insertedId: 't1' });
    findOneMock.mockResolvedValueOnce({ _id: 't1', userId: 'u1', startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true } });
    const res = await routes.POST(makeReq('http://localhost/api/meal-plans/template', { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true } }));
    expect(res.status).toBe(201);
  });

  it('PUT upserts template and returns updated', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce({ _id: 't1', userId: 'u1' }); // existing
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1 });
    findOneMock.mockResolvedValueOnce({ _id: 't1', userId: 'u1', startDay: 'monday', meals: { breakfast: true, lunch: true, dinner: true } });
    const res = await routes.PUT(makeReq('http://localhost/api/meal-plans/template', { startDay: 'monday', meals: { breakfast: true, lunch: true, dinner: true } }));
    expect(res.status).toBe(200);
  });
});


