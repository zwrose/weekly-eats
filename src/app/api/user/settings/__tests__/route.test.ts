import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));

const getUserObjectIdMock = vi.fn();
vi.mock('@/lib/user-utils', () => ({ getUserObjectId: (...args: any[]) => getUserObjectIdMock(...args) }));
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

const { getServerSession } = await import('next-auth/next');
const routes = await import('..//route');

const makeReq = (url: string, body?: unknown) => ({ url, json: async () => body }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  getUserObjectIdMock.mockReset();
  updateOneMock.mockReset();
  findOneMock.mockReset();
});

describe('api/user/settings route', () => {
  it('GET 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
  });

  it('GET returns DEFAULT_USER_SETTINGS when user not found', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'x@example.com' } });
    getUserObjectIdMock.mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.settings).toMatchObject({ themeMode: 'system' });
  });

  it('POST 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.POST(makeReq('http://localhost/api/user/settings', { settings: { themeMode: 'light' } }));
    expect(res.status).toBe(401);
  });

  it('POST 404 when no user id found', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'x@example.com' } });
    getUserObjectIdMock.mockResolvedValueOnce(null);
    const res = await routes.POST(makeReq('http://localhost/api/user/settings', { settings: { themeMode: 'light' } }));
    expect(res.status).toBe(404);
  });

  it('POST 400 when invalid settings payload', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'x@example.com' } });
    getUserObjectIdMock.mockResolvedValueOnce('507f1f77bcf86cd799439011');
    const res = await routes.POST(makeReq('http://localhost/api/user/settings', { settings: {} }));
    expect(res.status).toBe(400);
  });

  it('POST succeeds and returns success true', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'x@example.com', name: 'X' } });
    getUserObjectIdMock.mockResolvedValueOnce('507f1f77bcf86cd799439011');
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });
    const res = await routes.POST(makeReq('http://localhost/api/user/settings', { settings: { themeMode: 'dark' } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});


