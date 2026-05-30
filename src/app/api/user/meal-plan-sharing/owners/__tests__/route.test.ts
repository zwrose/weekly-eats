import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findMock = vi.fn();
const toArrayMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
        find: (...args: unknown[]) => {
          findMock(...args);
          return { toArray: toArrayMock };
        },
      }),
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findMock.mockReset();
  toArrayMock.mockReset();
});

describe('api/user/meal-plan-sharing/owners GET', () => {
  it('returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not approved', async () => {
    (getServerSession as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
    const res = await routes.GET();
    expect(res.status).toBe(403);
  });

  it('returns owners whose invitations to the current user are accepted', async () => {
    (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    toArrayMock.mockResolvedValueOnce([
      { _id: 'owner1', email: 'owner@example.com', name: 'Owner One' },
    ]);

    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].userId).toBe('owner1');
    expect(json[0].email).toBe('owner@example.com');
    expect(json[0].name).toBe('Owner One');
    // Query filters on accepted status
    const filter = findMock.mock.calls[0][0];
    expect(filter['settings.mealPlanSharing.invitations'].$elemMatch.status).toBe('accepted');
  });

  it('returns 500 when the DB throws', async () => {
    (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    toArrayMock.mockRejectedValueOnce(new Error('db down'));
    const res = await routes.GET();
    expect(res.status).toBe(500);
  });
});
