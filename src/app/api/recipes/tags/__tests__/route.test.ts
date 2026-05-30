import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findMock = vi.fn();
const toArrayMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
        find: (...args: unknown[]) => {
          findMock(...args);
          return { toArray: toArrayMock };
        },
      }),
    }),
  })),
}));

const { auth } = await import('@/lib/auth');
const routes = await import('../route');

const makeRequest = () => ({ url: 'http://localhost/api/recipes/tags' }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (auth as any).mockReset();
  findMock.mockReset();
  toArrayMock.mockReset();
});

describe('GET /api/recipes/tags', () => {
  it('returns 401 when unauthenticated', async () => {
    (auth as any).mockResolvedValueOnce(null);
    const res = await routes.GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not approved', async () => {
    (auth as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
    const res = await routes.GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns 200 with sorted unique tags for the current user', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    toArrayMock.mockResolvedValueOnce([
      { tags: ['dinner', 'quick'] },
      { tags: ['quick', 'italian'] },
      { tags: [] },
    ]);

    const res = await routes.GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tags).toEqual(['dinner', 'italian', 'quick']);
  });

  it('returns empty array when user has no tagged recipes', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    toArrayMock.mockResolvedValueOnce([]);

    const res = await routes.GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tags).toEqual([]);
  });
});
