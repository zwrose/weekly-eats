import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findOneMock = vi.fn();
const findMock = vi.fn();
const toArrayMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
        findOne: findOneMock,
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

// Route calls ObjectId.createFromHexString on the session user id, so it must be valid hex.
const VALID_ID = '507f1f77bcf86cd799439011';
const SHARED_ID = '507f1f77bcf86cd799439012';

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  findMock.mockReset();
  toArrayMock.mockReset();
});

describe('api/user/meal-plan-sharing/shared-users GET', () => {
  it('returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not approved', async () => {
    (getServerSession as any).mockResolvedValueOnce(unapprovedSession({ id: VALID_ID }));
    const res = await routes.GET();
    expect(res.status).toBe(403);
  });

  it('returns an empty array when the user has no accepted invitations', async () => {
    (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: VALID_ID }));
    findOneMock.mockResolvedValueOnce({
      _id: VALID_ID,
      settings: { mealPlanSharing: { invitations: [{ userId: SHARED_ID, status: 'pending' }] } },
    });

    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
    // No lookup of shared users when nothing is accepted
    expect(findMock).not.toHaveBeenCalled();
  });

  it('returns shared user info for accepted invitations', async () => {
    (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: VALID_ID }));
    findOneMock.mockResolvedValueOnce({
      _id: VALID_ID,
      settings: { mealPlanSharing: { invitations: [{ userId: SHARED_ID, status: 'accepted' }] } },
    });
    toArrayMock.mockResolvedValueOnce([
      { _id: SHARED_ID, email: 'shared@example.com', name: 'Shared User' },
    ]);

    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].userId).toBe(SHARED_ID);
    expect(json[0].email).toBe('shared@example.com');
    expect(json[0].name).toBe('Shared User');
  });

  it('returns 500 when the DB throws', async () => {
    (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: VALID_ID }));
    findOneMock.mockRejectedValueOnce(new Error('db down'));
    const res = await routes.GET();
    expect(res.status).toBe(500);
  });
});
