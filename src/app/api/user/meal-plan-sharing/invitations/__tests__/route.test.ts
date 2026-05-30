import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
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

const { auth } = await import('@/lib/auth');
const routes = await import('../route');

beforeEach(() => {
  vi.restoreAllMocks();
  (auth as any).mockReset();
  findMock.mockReset();
  toArrayMock.mockReset();
});

describe('api/user/meal-plan-sharing/invitations GET', () => {
  it('returns 401 when unauthenticated', async () => {
    (auth as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not approved', async () => {
    (auth as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
    const res = await routes.GET();
    expect(res.status).toBe(403);
  });

  it('returns pending invitations addressed to the current user', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    toArrayMock.mockResolvedValueOnce([
      {
        _id: 'owner1',
        email: 'owner@example.com',
        name: 'Owner One',
        settings: {
          mealPlanSharing: {
            invitations: [
              { userId: 'u1', status: 'pending', userEmail: 'me@example.com' },
              { userId: 'other', status: 'pending' },
            ],
          },
        },
      },
    ]);

    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].ownerId).toBe('owner1');
    expect(json[0].ownerEmail).toBe('owner@example.com');
    expect(json[0].invitation.userId).toBe('u1');
    expect(json[0].invitation.status).toBe('pending');
  });

  it('returns 500 when the DB throws', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    toArrayMock.mockRejectedValueOnce(new Error('db down'));
    const res = await routes.GET();
    expect(res.status).toBe(500);
  });
});
