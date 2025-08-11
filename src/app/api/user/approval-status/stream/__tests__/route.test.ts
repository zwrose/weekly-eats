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

const makeReq = (url: string) => ({ url, signal: new AbortController().signal } as any);

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
});

describe('api/user/approval-status/stream GET', () => {
  it('401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET(makeReq('http://localhost/api/user/approval-status/stream'));
    expect(res.status).toBe(401);
  });

  it('returns text/event-stream response for authenticated user', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'x@example.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'x@example.com', isApproved: false, isAdmin: true });
    const res = await routes.GET(makeReq('http://localhost/api/user/approval-status/stream'));
    // Should be a Response with SSE headers
    expect(res.headers.get('Content-Type')).toMatch(/text\/event-stream/);
  });
});


