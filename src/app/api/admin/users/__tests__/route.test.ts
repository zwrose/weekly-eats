import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next-auth session
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

// Mock authOptions
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Mock mongodb-adapter
vi.mock('@/lib/mongodb-adapter', () => ({
  default: Promise.resolve({}),
}));

// Mock Mongo client
const findMock = vi.fn();
const toArrayMock = vi.fn();
const findOneMock = vi.fn();
const limitMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
        find: (filter: unknown, options?: unknown) => {
          findMock(filter, options);
          return {
            limit: (num: number) => {
              limitMock(num);
              return { toArray: toArrayMock };
            },
          };
        },
        findOne: findOneMock,
      }),
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const makeRequest = (url: string) => ({ 
  url,
  nextUrl: new URL(url)
} as any);

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findMock.mockReset();
  toArrayMock.mockReset();
  findOneMock.mockReset();
  limitMock.mockReset();
});

describe('api/admin/users route', () => {
  it('GET returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET(makeRequest('http://localhost/api/admin/users'));
    expect(res.status).toBe(401);
  });

  it('GET returns 403 when user is not admin', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'user@test.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'user@test.com', isAdmin: false });
    const res = await routes.GET(makeRequest('http://localhost/api/admin/users'));
    expect(res.status).toBe(403);
  });

  it('GET returns approved users with correct response format', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
    
    const mockUsers = [
      { _id: 'u1', name: 'User 1', email: 'user1@test.com', isAdmin: false, isApproved: true },
      { _id: 'u2', name: 'User 2', email: 'user2@test.com', isAdmin: true, isApproved: true },
    ];
    toArrayMock.mockResolvedValueOnce(mockUsers);
    
    const res = await routes.GET(makeRequest('http://localhost/api/admin/users'));
    expect(res.status).toBe(200);
    
    const data = await res.json();
    // Critical: Response must be an object with a 'users' property, not a plain array
    expect(data).toHaveProperty('users');
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users).toHaveLength(2);
    expect(data.users[0]._id).toBe('u1');
  });

  it('GET filters by isApproved: true', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
    toArrayMock.mockResolvedValueOnce([]);
    
    await routes.GET(makeRequest('http://localhost/api/admin/users'));
    
    // Verify the query filters for approved users
    expect(findMock).toHaveBeenCalledWith(
      { isApproved: true },
      expect.any(Object)
    );
  });

  it('GET supports search filter', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
    toArrayMock.mockResolvedValueOnce([]);
    
    await routes.GET(makeRequest('http://localhost/api/admin/users?search=john'));
    
    // Verify the query includes search filter
    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: expect.arrayContaining([
          expect.objectContaining({
            $or: expect.any(Array)
          }),
          { isApproved: true }
        ])
      }),
      expect.any(Object)
    );
  });

  it('GET limits results to 50 users', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
    toArrayMock.mockResolvedValueOnce([]);
    
    await routes.GET(makeRequest('http://localhost/api/admin/users'));
    
    expect(limitMock).toHaveBeenCalledWith(50);
  });

  it('GET returns only specified fields in projection', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
    toArrayMock.mockResolvedValueOnce([]);
    
    await routes.GET(makeRequest('http://localhost/api/admin/users'));
    
    expect(findMock).toHaveBeenCalledWith(
      expect.any(Object),
      {
        projection: {
          _id: 1,
          name: 1,
          email: 1,
          isAdmin: 1,
          isApproved: 1
        }
      }
    );
  });
});

