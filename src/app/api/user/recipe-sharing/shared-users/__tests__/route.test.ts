import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findOneMock = vi.fn();
const toArrayMock = vi.fn();
const findMock = vi.fn(() => ({ toArray: toArrayMock }));

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({ findOne: findOneMock, find: findMock }),
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const SELF_ID = '64b7f8c2a2b7c2f1a2b7c2f1';
const SHARED_ID = '64b7f8c2a2b7c2f1a2b7c2f2';

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  toArrayMock.mockReset();
  findMock.mockClear();
});

describe('api/user/recipe-sharing/shared-users route (GET)', () => {
  it('returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns an empty array when the user has no accepted invitations', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: SELF_ID } });
    findOneMock.mockResolvedValueOnce({
      _id: SELF_ID,
      settings: { recipeSharing: { invitations: [] } },
    });

    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
    // No lookup query needed when there are no shared user ids
    expect(findMock).not.toHaveBeenCalled();
  });

  it('returns shared users with their sharingTypes for accepted invitations', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: SELF_ID } });
    findOneMock.mockResolvedValueOnce({
      _id: SELF_ID,
      settings: {
        recipeSharing: {
          invitations: [
            {
              userId: SHARED_ID,
              status: 'accepted',
              sharingTypes: ['ratings'],
            },
            {
              userId: '64b7f8c2a2b7c2f1a2b7c2f3',
              status: 'pending',
              sharingTypes: ['tags'],
            },
          ],
        },
      },
    });
    toArrayMock.mockResolvedValueOnce([
      {
        _id: { toString: () => SHARED_ID },
        email: 'shared@example.com',
        name: 'Shared User',
      },
    ]);

    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].userId).toBe(SHARED_ID);
    expect(json[0].email).toBe('shared@example.com');
    expect(json[0].name).toBe('Shared User');
    expect(json[0].sharingTypes).toEqual(['ratings']);
  });

  it('returns 500 when the DB throws', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: SELF_ID } });
    findOneMock.mockRejectedValueOnce(new Error('db boom'));
    const res = await routes.GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Internal server error');
  });
});
