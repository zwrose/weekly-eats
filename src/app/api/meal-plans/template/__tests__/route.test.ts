import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
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

const { auth } = await import('@/lib/auth');
const routes = await import('../route');

const makeReq = (url: string, body?: unknown) => ({ url, json: async () => body }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (auth as any).mockReset();
  findOneMock.mockReset();
  insertOneMock.mockReset();
  updateOneMock.mockReset();
});

describe('api/meal-plans/template route', () => {
  it('GET requires auth', async () => {
    (auth as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not approved (GET)', async () => {
    (auth as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
    const res = await routes.GET();
    expect(res.status).toBe(403);
  });

  it('POST creates template when none exists', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    findOneMock.mockResolvedValueOnce(null); // existing template
    insertOneMock.mockResolvedValueOnce({ insertedId: 't1' });
    findOneMock.mockResolvedValueOnce({
      _id: 't1',
      userId: 'u1',
      startDay: 'saturday',
      meals: { breakfast: true, lunch: true, dinner: true },
    });
    const res = await routes.POST(
      makeReq('http://localhost/api/meal-plans/template', {
        startDay: 'saturday',
        meals: { breakfast: true, lunch: true, dinner: true },
      })
    );
    expect(res.status).toBe(201);
  });

  it('PUT upserts template and returns updated', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    findOneMock.mockResolvedValueOnce({ _id: 't1', userId: 'u1' }); // existing
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1 });
    findOneMock.mockResolvedValueOnce({
      _id: 't1',
      userId: 'u1',
      startDay: 'monday',
      meals: { breakfast: true, lunch: true, dinner: true },
    });
    const res = await routes.PUT(
      makeReq('http://localhost/api/meal-plans/template', {
        startDay: 'monday',
        meals: { breakfast: true, lunch: true, dinner: true },
      })
    );
    expect(res.status).toBe(200);
  });
});
