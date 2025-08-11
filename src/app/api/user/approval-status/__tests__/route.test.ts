import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const findOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({ findOne: findOneMock })
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('..//route');

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
});

describe('api/user/approval-status GET', () => {
  it('401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
  });

  it('returns booleans for isApproved and isAdmin', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'x@example.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'x@example.com', isApproved: true, isAdmin: false });
    const res = await routes.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ isApproved: true, isAdmin: false });
  });
});


