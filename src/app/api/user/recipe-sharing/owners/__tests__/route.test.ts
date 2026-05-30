import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const toArrayMock = vi.fn();
const findMock = vi.fn(() => ({ toArray: toArrayMock }));

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({ find: findMock }),
    }),
  })),
}));

const { auth } = await import('@/lib/auth');
const routes = await import('../route');

const SELF_ID = '64b7f8c2a2b7c2f1a2b7c2f1';

beforeEach(() => {
  vi.restoreAllMocks();
  (auth as any).mockReset();
  toArrayMock.mockReset();
  findMock.mockClear();
});

describe('api/user/recipe-sharing/owners route (GET)', () => {
  it('returns 401 when unauthenticated', async () => {
    (auth as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not approved', async () => {
    (auth as any).mockResolvedValueOnce(unapprovedSession({ id: SELF_ID }));
    const res = await routes.GET();
    expect(res.status).toBe(403);
  });

  it('returns owners with their sharingTypes for accepted invitations', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: SELF_ID }));
    toArrayMock.mockResolvedValueOnce([
      {
        _id: { toString: () => 'owner-1' },
        email: 'owner@example.com',
        name: 'Owner One',
        settings: {
          recipeSharing: {
            invitations: [
              {
                userId: SELF_ID,
                userEmail: 'me@example.com',
                status: 'accepted',
                invitedBy: 'owner-1',
                invitedAt: new Date(),
                sharingTypes: ['tags', 'ratings'],
              },
            ],
          },
        },
      },
    ]);

    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].userId).toBe('owner-1');
    expect(json[0].email).toBe('owner@example.com');
    expect(json[0].name).toBe('Owner One');
    expect(json[0].sharingTypes).toEqual(['tags', 'ratings']);
  });

  it('defaults sharingTypes to an empty array when none present', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: SELF_ID }));
    toArrayMock.mockResolvedValueOnce([
      {
        _id: { toString: () => 'owner-2' },
        email: 'owner2@example.com',
        name: 'Owner Two',
        settings: {
          recipeSharing: {
            invitations: [
              {
                userId: SELF_ID,
                status: 'accepted',
                // no sharingTypes field
              },
            ],
          },
        },
      },
    ]);

    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json[0].sharingTypes).toEqual([]);
  });

  it('returns 500 when the DB throws', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: SELF_ID }));
    toArrayMock.mockRejectedValueOnce(new Error('db boom'));
    const res = await routes.GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Internal server error');
  });
});
