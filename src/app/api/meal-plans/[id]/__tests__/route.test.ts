import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findOneMock = vi.fn();
const updateOneMock = vi.fn();
const deleteOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
        findOne: findOneMock,
        updateOne: updateOneMock,
        deleteOne: deleteOneMock,
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
  updateOneMock.mockReset();
  deleteOneMock.mockReset();
});

describe('api/meal-plans/[id] route', () => {
  it('GET returns 404 when not found', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce(null);
    const res = await routes.GET(makeReq('http://localhost/api/meal-plans/x'), { params: Promise.resolve({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }) } as any);
    expect(res.status).toBe(404);
  });

  it('PUT updates meal plan when valid', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce({ _id: 'p1', userId: 'u1', templateId: 't1', templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true } }, createdAt: new Date() });
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1 });
    findOneMock.mockResolvedValueOnce({ _id: 'p1', userId: 'u1', templateId: 't1', templateSnapshot: { startDay: 'saturday', meals: { breakfast: true, lunch: true, dinner: true } }, createdAt: new Date() });
    const res = await routes.PUT(makeReq('http://localhost/api/meal-plans/p1', { name: 'Updated' }), { params: Promise.resolve({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }) } as any);
    expect(res.status).toBe(200);
  });

  it('DELETE requires auth', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.DELETE(makeReq('http://localhost/api/meal-plans/p1'), { params: Promise.resolve({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }) } as any);
    expect(res.status).toBe(401);
  });
});


