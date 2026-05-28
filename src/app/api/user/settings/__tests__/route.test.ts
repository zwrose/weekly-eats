import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

const requireApprovedSessionMock = vi.fn();
const getUserObjectIdMock = vi.fn();
vi.mock('@/lib/user-utils', () => ({
  requireApprovedSession: (...args: any[]) => requireApprovedSessionMock(...args),
  getUserObjectId: (...args: any[]) => getUserObjectIdMock(...args),
}));
vi.mock('@/lib/user-settings', () => ({ DEFAULT_USER_SETTINGS: { themeMode: 'system' } }));

const updateOneMock = vi.fn();
const findOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => ({
        findOne: findOneMock,
        updateOne: updateOneMock,
      }),
    }),
  })),
}));

const routes = await import('..//route');

const makeReq = (url: string, body?: unknown) => ({ url, json: async () => body }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  requireApprovedSessionMock.mockReset();
  getUserObjectIdMock.mockReset();
  updateOneMock.mockReset();
  findOneMock.mockReset();
});

describe('api/user/settings route', () => {
  it('GET 401 when unauthenticated', async () => {
    requireApprovedSessionMock.mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const res = await routes.GET();
    expect(res.status).toBe(401);
  });

  it('GET 403 when user is not approved', async () => {
    requireApprovedSessionMock.mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    });
    const res = await routes.GET();
    expect(res.status).toBe(403);
  });

  it('GET returns DEFAULT_USER_SETTINGS when user not found', async () => {
    requireApprovedSessionMock.mockResolvedValueOnce({
      session: approvedSession({ email: 'x@example.com' }),
    });
    getUserObjectIdMock.mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.settings).toMatchObject({ themeMode: 'system' });
  });

  it('POST 401 when unauthenticated', async () => {
    requireApprovedSessionMock.mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const res = await routes.POST(
      makeReq('http://localhost/api/user/settings', { settings: { themeMode: 'light' } })
    );
    expect(res.status).toBe(401);
  });

  it('POST 403 when user is not approved', async () => {
    requireApprovedSessionMock.mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    });
    const res = await routes.POST(
      makeReq('http://localhost/api/user/settings', { settings: { themeMode: 'light' } })
    );
    expect(res.status).toBe(403);
  });

  it('POST 404 when no user id found', async () => {
    requireApprovedSessionMock.mockResolvedValueOnce({
      session: approvedSession({ email: 'x@example.com' }),
    });
    getUserObjectIdMock.mockResolvedValueOnce(null);
    const res = await routes.POST(
      makeReq('http://localhost/api/user/settings', { settings: { themeMode: 'light' } })
    );
    expect(res.status).toBe(404);
  });

  it('POST 400 when invalid settings payload', async () => {
    requireApprovedSessionMock.mockResolvedValueOnce({
      session: approvedSession({ email: 'x@example.com' }),
    });
    getUserObjectIdMock.mockResolvedValueOnce('507f1f77bcf86cd799439011');
    const res = await routes.POST(makeReq('http://localhost/api/user/settings', { settings: {} }));
    expect(res.status).toBe(400);
  });

  it('POST succeeds and returns success true', async () => {
    requireApprovedSessionMock.mockResolvedValueOnce({
      session: approvedSession({ email: 'x@example.com', name: 'X' }),
    });
    getUserObjectIdMock.mockResolvedValueOnce('507f1f77bcf86cd799439011');
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });
    const res = await routes.POST(
      makeReq('http://localhost/api/user/settings', { settings: { themeMode: 'dark' } })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('POST allowlists settings — never writes sharing invitation arrays (mass-assignment guard)', async () => {
    requireApprovedSessionMock.mockResolvedValueOnce({
      session: approvedSession({ email: 'x@example.com', name: 'X' }),
    });
    getUserObjectIdMock.mockResolvedValueOnce('507f1f77bcf86cd799439011');
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });
    const res = await routes.POST(
      makeReq('http://localhost/api/user/settings', {
        settings: {
          themeMode: 'dark',
          // Forged grants that must never be persisted via this route:
          recipeSharing: { invitations: [{ userId: 'attacker', status: 'accepted' }] },
          mealPlanSharing: { invitations: [{ userId: 'attacker', status: 'accepted' }] },
        },
      })
    );
    expect(res.status).toBe(200);

    const update = updateOneMock.mock.calls[0][1];
    // Dot-notation, allowlisted keys only — no whole-object `settings` write.
    expect(update.$set).not.toHaveProperty('settings');
    expect(update.$set['settings.themeMode']).toBe('dark');
    const setKeys = Object.keys(update.$set);
    expect(setKeys.some((k) => k.includes('Sharing'))).toBe(false);
    expect(JSON.stringify(update)).not.toContain('attacker');
  });

  it('POST writes defaultMealPlanOwner when provided, unsets it when empty', async () => {
    requireApprovedSessionMock.mockResolvedValueOnce({
      session: approvedSession({ email: 'x@example.com', name: 'X' }),
    });
    getUserObjectIdMock.mockResolvedValueOnce('507f1f77bcf86cd799439011');
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });
    await routes.POST(
      makeReq('http://localhost/api/user/settings', {
        settings: { themeMode: 'dark', defaultMealPlanOwner: 'owner-123' },
      })
    );
    expect(updateOneMock.mock.calls[0][1].$set['settings.defaultMealPlanOwner']).toBe('owner-123');

    requireApprovedSessionMock.mockResolvedValueOnce({
      session: approvedSession({ email: 'x@example.com', name: 'X' }),
    });
    getUserObjectIdMock.mockResolvedValueOnce('507f1f77bcf86cd799439011');
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });
    await routes.POST(
      makeReq('http://localhost/api/user/settings', { settings: { themeMode: 'dark' } })
    );
    expect(updateOneMock.mock.calls[1][1].$unset).toHaveProperty('settings.defaultMealPlanOwner');
  });
});
