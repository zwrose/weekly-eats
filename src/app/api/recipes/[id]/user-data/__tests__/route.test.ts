import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findOneMock = vi.fn();
const findMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'recipes') {
          return { findOne: findOneMock };
        }
        if (name === 'recipeUserData') {
          return { findOne: findOneMock };
        }
        if (name === 'users') {
          return {
            find: () => ({ toArray: () => Promise.resolve([]) }),
          };
        }
        return {};
      },
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const { ObjectId } = await import('mongodb');

const validId = '64b7f8c2a2b7c2f1a2b7c2f1';

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });
const makeRequest = (id: string) =>
  ({ url: `http://localhost/api/recipes/${id}/user-data` }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  findMock.mockReset();
});

describe('GET /api/recipes/[id]/user-data', () => {
  it('returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET(makeRequest(validId), makeParams(validId));
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not approved', async () => {
    (getServerSession as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
    const res = await routes.GET(makeRequest(validId), makeParams(validId));
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid recipe ID', async () => {
    (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    const res = await routes.GET(makeRequest('bad-id'), makeParams('bad-id'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when recipe is not found', async () => {
    (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    // First findOne call is for recipes collection
    findOneMock.mockResolvedValueOnce(null);
    const res = await routes.GET(makeRequest(validId), makeParams(validId));
    expect(res.status).toBe(404);
  });

  it('returns 200 with tags and rating for an accessible recipe', async () => {
    (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    // recipes.findOne — recipe found
    findOneMock.mockResolvedValueOnce({
      _id: ObjectId.createFromHexString(validId),
      title: 'Test Recipe',
      isGlobal: true,
    });
    // recipeUserData.findOne — user data found
    findOneMock.mockResolvedValueOnce({ tags: ['dinner'], rating: 4 });

    const res = await routes.GET(makeRequest(validId), makeParams(validId));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tags).toEqual(['dinner']);
    expect(json.rating).toBe(4);
  });
});
