import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
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

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const SELF_ID = '64b7f8c2a2b7c2f1a2b7c2f1';

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  toArrayMock.mockReset();
  findMock.mockClear();
});

describe('api/user/recipe-sharing/invitations route (GET)', () => {
  it('returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not approved', async () => {
    (getServerSession as any).mockResolvedValueOnce(unapprovedSession({ id: SELF_ID }));
    const res = await routes.GET();
    expect(res.status).toBe(403);
  });

  it('returns pending invitations for the current user with owner info', async () => {
    (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: SELF_ID }));
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
                status: 'pending',
                invitedBy: 'owner-1',
                invitedAt: new Date(),
                sharingTypes: ['tags', 'ratings'],
              },
              // An accepted/other invitation that should be ignored
              {
                userId: 'other-user',
                userEmail: 'other@example.com',
                status: 'accepted',
                invitedBy: 'owner-1',
                invitedAt: new Date(),
                sharingTypes: ['tags'],
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
    expect(json[0].ownerId).toBe('owner-1');
    expect(json[0].ownerEmail).toBe('owner@example.com');
    expect(json[0].ownerName).toBe('Owner One');
    expect(json[0].invitation.status).toBe('pending');
    expect(json[0].invitation.sharingTypes).toEqual(['tags', 'ratings']);
  });

  it('filters out owners with no matching pending invitation for the user', async () => {
    (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: SELF_ID }));
    toArrayMock.mockResolvedValueOnce([
      {
        _id: { toString: () => 'owner-2' },
        email: 'owner2@example.com',
        name: 'Owner Two',
        settings: {
          recipeSharing: {
            invitations: [
              {
                userId: 'someone-else',
                status: 'pending',
                sharingTypes: ['tags'],
              },
            ],
          },
        },
      },
    ]);

    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it('returns 500 when the DB throws', async () => {
    (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: SELF_ID }));
    toArrayMock.mockRejectedValueOnce(new Error('db boom'));
    const res = await routes.GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Internal server error');
  });
});
