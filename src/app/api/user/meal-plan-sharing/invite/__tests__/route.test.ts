import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findOneMock = vi.fn();
const updateOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
        findOne: findOneMock,
        updateOne: updateOneMock,
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
});

describe('api/user/meal-plan-sharing/invite POST', () => {
  it('returns 401 when unauthenticated', async () => {
    (auth as any).mockResolvedValueOnce(null);
    const res = await routes.POST(makeReq('http://localhost/api/x', { email: 'a@b.com' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not approved', async () => {
    (auth as any).mockResolvedValueOnce(
      unapprovedSession({ id: 'u1', email: 'me@example.com' })
    );
    const res = await routes.POST(
      makeReq('http://localhost/api/x', { email: 'friend@example.com' })
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid email', async () => {
    (auth as any).mockResolvedValueOnce(
      approvedSession({ id: 'u1', email: 'me@example.com' })
    );
    const res = await routes.POST(makeReq('http://localhost/api/x', { email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when inviting yourself', async () => {
    (auth as any).mockResolvedValueOnce(
      approvedSession({ id: 'u1', email: 'me@example.com' })
    );
    const res = await routes.POST(makeReq('http://localhost/api/x', { email: 'ME@example.com' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the invited user is not registered', async () => {
    (auth as any).mockResolvedValueOnce(
      approvedSession({ id: 'u1', email: 'me@example.com' })
    );
    findOneMock.mockResolvedValueOnce(null); // invited user lookup
    const res = await routes.POST(
      makeReq('http://localhost/api/x', { email: 'friend@example.com' })
    );
    expect(res.status).toBe(404);
  });

  it('creates a pending invitation and returns 201', async () => {
    (auth as any).mockResolvedValueOnce(
      approvedSession({ id: 'u1', email: 'me@example.com' })
    );
    // 1) invited user lookup
    findOneMock.mockResolvedValueOnce({
      _id: 'invited1',
      email: 'friend@example.com',
      name: 'Friend',
    });
    // 2) current user settings lookup
    findOneMock.mockResolvedValueOnce({
      _id: 'u1',
      email: 'me@example.com',
      settings: { mealPlanSharing: { invitations: [] } },
    });
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1 });

    const res = await routes.POST(
      makeReq('http://localhost/api/x', { email: 'friend@example.com' })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.invitation.userId).toBe('invited1');
    expect(json.invitation.status).toBe('pending');
    expect(json.invitation.invitedBy).toBe('u1');
  });

  it('returns 500 when the DB throws', async () => {
    (auth as any).mockResolvedValueOnce(
      approvedSession({ id: 'u1', email: 'me@example.com' })
    );
    findOneMock.mockRejectedValueOnce(new Error('db down'));
    const res = await routes.POST(
      makeReq('http://localhost/api/x', { email: 'friend@example.com' })
    );
    expect(res.status).toBe(500);
  });
});
