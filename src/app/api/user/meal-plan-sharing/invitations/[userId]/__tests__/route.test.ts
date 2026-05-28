import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
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

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const makeReq = (url: string, body?: unknown) => ({ url, json: async () => body }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  updateOneMock.mockReset();
  updateManyMock.mockReset();
});

describe('api/user/meal-plan-sharing/invitations/[userId] PUT', () => {
  it('returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.PUT(makeReq('http://localhost/api/x', { action: 'accept' }), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid action', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    const res = await routes.PUT(makeReq('http://localhost/api/x', { action: 'bogus' }), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(400);
  });

  it('returns 403 when acting on an invitation that is not the caller', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    const res = await routes.PUT(makeReq('http://localhost/api/x', { action: 'accept' }), {
      params: Promise.resolve({ userId: 'someoneElse' }),
    } as any);
    expect(res.status).toBe(403);
  });

  it('returns 404 when no owner invitation is found', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce(null);
    const res = await routes.PUT(makeReq('http://localhost/api/x', { action: 'accept' }), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(404);
  });

  it('accepts an invitation and sets status to accepted', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
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
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
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
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockRejectedValueOnce(new Error('db down'));
    const res = await routes.PUT(makeReq('http://localhost/api/x', { action: 'accept' }), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(500);
  });
});

describe('api/user/meal-plan-sharing/invitations/[userId] DELETE', () => {
  it('returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.DELETE(makeReq('http://localhost/api/x'), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is neither owner nor the user themselves', async () => {
    (getServerSession as any).mockResolvedValueOnce({
      user: { id: 'u1', email: 'me@example.com' },
    });
    findOneMock.mockResolvedValueOnce(null); // not owner
    const res = await routes.DELETE(makeReq('http://localhost/api/x'), {
      params: Promise.resolve({ userId: 'someoneElse' }),
    } as any);
    expect(res.status).toBe(403);
  });

  it('owner removing a user pulls the invitation via updateOne', async () => {
    (getServerSession as any).mockResolvedValueOnce({
      user: { id: 'u1', email: 'owner@example.com' },
    });
    findOneMock.mockResolvedValueOnce({ _id: 'owner1' }); // is owner
    updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 });

    const res = await routes.DELETE(makeReq('http://localhost/api/x'), {
      params: Promise.resolve({ userId: 'target' }),
    } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(updateOneMock).toHaveBeenCalled();
  });

  it('user leaving (self) pulls invitations via updateMany', async () => {
    (getServerSession as any).mockResolvedValueOnce({
      user: { id: 'u1', email: 'me@example.com' },
    });
    findOneMock.mockResolvedValueOnce(null); // not owner
    updateManyMock.mockResolvedValueOnce({ modifiedCount: 1 });

    const res = await routes.DELETE(makeReq('http://localhost/api/x'), {
      params: Promise.resolve({ userId: 'u1' }), // self
    } as any);
    expect(res.status).toBe(200);
    expect(updateManyMock).toHaveBeenCalled();
  });

  it('returns 500 when the DB throws', async () => {
    (getServerSession as any).mockResolvedValueOnce({
      user: { id: 'u1', email: 'me@example.com' },
    });
    findOneMock.mockRejectedValueOnce(new Error('db down'));
    const res = await routes.DELETE(makeReq('http://localhost/api/x'), {
      params: Promise.resolve({ userId: 'u1' }),
    } as any);
    expect(res.status).toBe(500);
  });
});
