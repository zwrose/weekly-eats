import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findOneMock = vi.fn();
const updateOneMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
        findOne: findOneMock,
        updateOne: updateOneMock,
        updateMany: updateManyMock,
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
  updateOneMock.mockReset();
  updateManyMock.mockReset();
});

describe('api/user/meal-plan-sharing/invitations/[userId] PUT', () => {
  it('returns 401 when unauthenticated', async () => {
    (auth as any).mockResolvedValueOnce(null);
    const res = await routes.PUT(makeReq('http://localhost/api/x', { action: 'accept' }), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not approved', async () => {
    (auth as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
    const res = await routes.PUT(makeReq('http://localhost/api/x', { action: 'accept' }), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid action', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    const res = await routes.PUT(makeReq('http://localhost/api/x', { action: 'bogus' }), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(400);
  });

  it('returns 403 when acting on an invitation that is not the caller', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    const res = await routes.PUT(makeReq('http://localhost/api/x', { action: 'accept' }), {
      params: Promise.resolve({ userId: 'someoneElse' }),
    } as any);
    expect(res.status).toBe(403);
  });

  it('returns 404 when no owner invitation is found', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    findOneMock.mockResolvedValueOnce(null);
    const res = await routes.PUT(makeReq('http://localhost/api/x', { action: 'accept' }), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(404);
  });

  it('accepts an invitation and sets status to accepted', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    findOneMock.mockResolvedValueOnce({ _id: 'owner1' });
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1 });

    const res = await routes.PUT(makeReq('http://localhost/api/x', { action: 'accept' }), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    const update = updateOneMock.mock.calls[0][1];
    expect(update.$set['settings.mealPlanSharing.invitations.$.status']).toBe('accepted');
  });

  it('rejects an invitation and sets status to rejected', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    findOneMock.mockResolvedValueOnce({ _id: 'owner1' });
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1 });

    const res = await routes.PUT(makeReq('http://localhost/api/x', { action: 'reject' }), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(200);
    const update = updateOneMock.mock.calls[0][1];
    expect(update.$set['settings.mealPlanSharing.invitations.$.status']).toBe('rejected');
  });

  it('returns 500 when the DB throws', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    findOneMock.mockRejectedValueOnce(new Error('db down'));
    const res = await routes.PUT(makeReq('http://localhost/api/x', { action: 'accept' }), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(500);
  });
});

describe('api/user/meal-plan-sharing/invitations/[userId] DELETE', () => {
  it('returns 401 when unauthenticated', async () => {
    (auth as any).mockResolvedValueOnce(null);
    const res = await routes.DELETE(makeReq('http://localhost/api/x'), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not approved', async () => {
    (auth as any).mockResolvedValueOnce(
      unapprovedSession({ id: 'u1', email: 'me@example.com' })
    );
    const res = await routes.DELETE(makeReq('http://localhost/api/x'), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 when caller is neither owner nor the user themselves', async () => {
    (auth as any).mockResolvedValueOnce(
      approvedSession({ id: 'u1', email: 'me@example.com' })
    );
    findOneMock.mockResolvedValueOnce(null); // not owner
    const res = await routes.DELETE(makeReq('http://localhost/api/x'), {
      params: Promise.resolve({ userId: 'someoneElse' }),
    } as any);
    expect(res.status).toBe(403);
  });

  it('owner removing a user pulls the invitation via updateOne', async () => {
    (auth as any).mockResolvedValueOnce(
      approvedSession({ id: 'u1', email: 'owner@example.com' })
    );
    findOneMock.mockResolvedValueOnce({ _id: 'owner1' }); // is owner
    updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 });

    const res = await routes.DELETE(makeReq('http://localhost/api/x'), {
      params: Promise.resolve({ userId: 'target' }),
    } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    // Owner removal targets the owner's own doc and pulls only the target user's invitation.
    expect(updateOneMock.mock.calls[0][0]).toEqual({ email: 'owner@example.com' });
    expect(updateOneMock.mock.calls[0][1].$pull).toEqual({
      'settings.mealPlanSharing.invitations': { userId: 'target' },
    });
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it('user leaving (self) pulls invitations via updateMany', async () => {
    (auth as any).mockResolvedValueOnce(
      approvedSession({ id: 'u1', email: 'me@example.com' })
    );
    findOneMock.mockResolvedValueOnce(null); // not owner
    updateManyMock.mockResolvedValueOnce({ modifiedCount: 1 });

    const res = await routes.DELETE(makeReq('http://localhost/api/x'), {
      params: Promise.resolve({ userId: 'u1' }), // self
    } as any);
    expect(res.status).toBe(200);
    // Self-leave scans all docs holding the user's invitation and pulls it everywhere.
    expect(updateManyMock.mock.calls[0][0]).toEqual({
      'settings.mealPlanSharing.invitations.userId': 'u1',
    });
    expect(updateManyMock.mock.calls[0][1].$pull).toEqual({
      'settings.mealPlanSharing.invitations': { userId: 'u1' },
    });
    expect(updateOneMock).not.toHaveBeenCalled();
  });

  it('returns 500 when the DB throws', async () => {
    (auth as any).mockResolvedValueOnce(
      approvedSession({ id: 'u1', email: 'me@example.com' })
    );
    findOneMock.mockRejectedValueOnce(new Error('db down'));
    const res = await routes.DELETE(makeReq('http://localhost/api/x'), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(500);
  });
});
