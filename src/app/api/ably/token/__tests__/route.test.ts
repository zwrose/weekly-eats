import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

// Capture the options passed to createTokenRequest so we can assert on capability scoping.
const createTokenRequestMock = vi.fn();
vi.mock('ably', () => ({
  default: {
    Rest: class {
      auth = { createTokenRequest: createTokenRequestMock };
    },
  },
}));

const storesFindMock = vi.fn();
vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({ find: storesFindMock }),
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const mockStores = (stores: { _id: { toString: () => string } }[]) =>
  storesFindMock.mockReturnValueOnce({ toArray: () => Promise.resolve(stores) });

beforeEach(() => {
  (getServerSession as any).mockReset();
  createTokenRequestMock.mockReset();
  storesFindMock.mockReset();
  process.env.ABLY_API_KEY = 'test-key';
  // Resolve the token request callback with a fake token echoing the capability.
  createTokenRequestMock.mockImplementation((opts: any, cb: any) =>
    cb(null, { token: 'fake-token', capability: opts.capability })
  );
});

describe('api/ably/token route', () => {
  it('returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
    expect(createTokenRequestMock).not.toHaveBeenCalled();
  });

  it('scopes the token capability to only the user accessible store channels', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    mockStores([{ _id: { toString: () => 'storeA' } }, { _id: { toString: () => 'storeB' } }]);

    const res = await routes.GET();
    expect(res.status).toBe(200);

    const opts = createTokenRequestMock.mock.calls[0][0];
    const capability = JSON.parse(opts.capability);
    // Per-store channels only — never a wildcard.
    expect(capability).toHaveProperty('shopping-store:storeA');
    expect(capability).toHaveProperty('shopping-store:storeB');
    expect(capability).not.toHaveProperty('*');
    // Clients subscribe + enter presence but never publish.
    expect(capability['shopping-store:storeA']).toEqual(['subscribe', 'presence']);
    expect(capability['shopping-store:storeA']).not.toContain('publish');
  });

  it('queries stores the user owns OR holds an accepted invitation to', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    mockStores([]);
    await routes.GET();
    const filter = storesFindMock.mock.calls[0][0];
    expect(filter.$or).toEqual([
      { userId: 'u1' },
      { 'invitations.userId': 'u1', 'invitations.status': 'accepted' },
    ]);
  });

  it('falls back to a private user-scoped channel when the user has no stores', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    mockStores([]);

    const res = await routes.GET();
    expect(res.status).toBe(200);
    const capability = JSON.parse(createTokenRequestMock.mock.calls[0][0].capability);
    expect(Object.keys(capability)).toEqual(['user:u1']);
    expect(capability['user:u1']).toEqual(['subscribe']);
    // Crucially, no wildcard channel access.
    expect(capability).not.toHaveProperty('*');
  });
});
