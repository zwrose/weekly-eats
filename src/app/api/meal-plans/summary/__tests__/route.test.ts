import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const aggregateMock = vi.fn();
const toArrayMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'mealPlans') {
          return {
            aggregate: aggregateMock.mockImplementation(() => ({
              toArray: toArrayMock,
            })),
          };
        }
        if (name === 'users') {
          return {
            find: () => ({
              toArray: vi.fn().mockResolvedValue([]),
            }),
          };
        }
        return {} as any;
      },
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  aggregateMock.mockReset();
  toArrayMock.mockReset();
});

describe('api/meal-plans/summary route', () => {
  it('GET requires auth', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
  });

  it('GET returns year/month summary with plan counts', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    toArrayMock.mockResolvedValueOnce([
      { _id: { year: '2026', month: '02' }, count: 4, earliest: '2026-02-07', latest: '2026-02-28' },
      { _id: { year: '2026', month: '01' }, count: 3, earliest: '2026-01-03', latest: '2026-01-24' },
      { _id: { year: '2025', month: '12' }, count: 2, earliest: '2025-12-06', latest: '2025-12-20' },
    ]);

    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(3);
    expect(json[0]).toEqual({
      year: 2026,
      month: 2,
      count: 4,
      earliest: '2026-02-07',
      latest: '2026-02-28',
    });
    expect(json[1]).toEqual({
      year: 2026,
      month: 1,
      count: 3,
      earliest: '2026-01-03',
      latest: '2026-01-24',
    });
    expect(json[2]).toEqual({
      year: 2025,
      month: 12,
      count: 2,
      earliest: '2025-12-06',
      latest: '2025-12-20',
    });
  });

  it('GET returns empty array when no meal plans exist', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    toArrayMock.mockResolvedValueOnce([]);

    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it('GET uses aggregation pipeline with userId filter', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    toArrayMock.mockResolvedValueOnce([]);

    await routes.GET();

    expect(aggregateMock).toHaveBeenCalledTimes(1);
    const pipeline = aggregateMock.mock.calls[0][0];
    // First stage should be $match with userId
    expect(pipeline[0].$match.userId).toEqual({ $in: ['u1'] });
    // Should have $group stage
    const groupStage = pipeline.find((s: any) => s.$group);
    expect(groupStage).toBeDefined();
    // Should have $sort stage
    const sortStage = pipeline.find((s: any) => s.$sort);
    expect(sortStage).toBeDefined();
  });
});
