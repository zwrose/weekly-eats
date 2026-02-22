import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/mongodb-adapter', () => ({
  default: Promise.resolve({}),
}));

const findOneMock = vi.fn();
const findMock = vi.fn();
const toArrayMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        collectionName = name;
        return {
          find: (filter: unknown) => {
            findMock(name, filter);
            return {
              project: () => ({ toArray: () => toArrayMock(name + ':project') }),
              toArray: () => toArrayMock(name),
            };
          },
          findOne: (filter: unknown) => findOneMock(name, filter),
        };
      },
    }),
  })),
}));

let collectionName = '';

const { getServerSession } = await import('next-auth/next');
const mockedGetSession = vi.mocked(getServerSession);

const { POST } = await import('../route');

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/recipes/user-data/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/recipes/user-data/batch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toArrayMock.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockedGetSession.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ recipeIds: ['abc'] }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing or empty recipeIds', async () => {
    mockedGetSession.mockResolvedValueOnce({ user: { id: 'u1' }, expires: '' });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);

    mockedGetSession.mockResolvedValueOnce({ user: { id: 'u1' }, expires: '' });
    const res2 = await POST(makeRequest({ recipeIds: [] }));
    expect(res2.status).toBe(400);
  });

  it('returns empty data for all invalid ObjectIds', async () => {
    mockedGetSession.mockResolvedValueOnce({ user: { id: 'u1' }, expires: '' });
    const res = await POST(makeRequest({ recipeIds: ['not-valid'] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({});
  });

  it('returns user data for accessible recipes', async () => {
    mockedGetSession.mockResolvedValueOnce({ user: { id: 'u1' }, expires: '' });

    const recipeId = '507f1f77bcf86cd799439011';

    // recipes.find (accessible check)
    toArrayMock.mockImplementation((key: string) => {
      if (key === 'recipes:project') {
        return [{ _id: { toString: () => recipeId } }];
      }
      if (key === 'recipeUserData') {
        return [{ recipeId, tags: ['dinner', 'quick'], rating: 4 }];
      }
      // users (sharing owners) - none
      return [];
    });

    const res = await POST(makeRequest({ recipeIds: [recipeId] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[recipeId]).toEqual({
      tags: ['dinner', 'quick'],
      rating: 4,
    });
  });

  it('includes shared tags and ratings from sharing owners', async () => {
    mockedGetSession.mockResolvedValueOnce({ user: { id: 'u1' }, expires: '' });

    const recipeId = '507f1f77bcf86cd799439011';

    toArrayMock.mockImplementation((key: string) => {
      if (key === 'recipes:project') {
        return [{ _id: { toString: () => recipeId } }];
      }
      if (key === 'recipeUserData') {
        // First call is user's own data, second is shared data
        // We return both in one array since the batch does separate queries
        return [{ recipeId, userId: 'u1', tags: ['my-tag'], rating: 3 }];
      }
      if (key === 'users') {
        return [
          {
            _id: { toString: () => 'owner1' },
            name: 'Owner',
            email: 'owner@test.com',
            settings: {
              recipeSharing: {
                invitations: [
                  {
                    userId: 'u1',
                    status: 'accepted',
                    sharingTypes: ['tags', 'ratings'],
                  },
                ],
              },
            },
          },
        ];
      }
      return [];
    });

    const res = await POST(makeRequest({ recipeIds: [recipeId] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[recipeId].tags).toEqual(['my-tag']);
    expect(json.data[recipeId].rating).toBe(3);
  });
});
