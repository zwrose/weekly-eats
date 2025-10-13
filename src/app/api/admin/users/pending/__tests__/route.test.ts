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
const sortMock = vi.fn();
const limitMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
        find: (filter: unknown, options?: unknown) => {
          findMock(filter, options);
          return {
            sort: (sortObj: unknown) => {
              sortMock(sortObj);
              return {
                limit: (num: number) => {
                  limitMock(num);
                  return { toArray: toArrayMock };
                },
              };
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

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findMock.mockReset();
  toArrayMock.mockReset();
  findOneMock.mockReset();
  sortMock.mockReset();
  limitMock.mockReset();
});

describe('api/admin/users/pending route', () => {
  it('GET returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET();
    expect(res.status).toBe(401);
  });

  it('GET returns 403 when user is not admin', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'user@test.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'user@test.com', isAdmin: false });
    const res = await routes.GET();
    expect(res.status).toBe(403);
  });

  it('GET returns pending users with correct response format', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
    
    const mockUsers = [
      { _id: 'u3', name: 'Pending User 1', email: 'pending1@test.com', isAdmin: false, isApproved: false },
      { _id: 'u4', name: 'Pending User 2', email: 'pending2@test.com', isAdmin: false, isApproved: false },
    ];
    toArrayMock.mockResolvedValueOnce(mockUsers);
    
    const res = await routes.GET();
    expect(res.status).toBe(200);
    
    const data = await res.json();
    // Critical: Response must be an object with a 'users' property, not a plain array
    expect(data).toHaveProperty('users');
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users).toHaveLength(2);
    expect(data.users[0]._id).toBe('u3');
  });

  it('GET filters by unapproved non-admin users', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
    toArrayMock.mockResolvedValueOnce([]);
    
    await routes.GET();
    
    // Verify the query filters for pending users (not approved, not admin)
    expect(findMock).toHaveBeenCalledWith(
      {
        isApproved: { $ne: true },
        isAdmin: { $ne: true }
      },
      expect.any(Object)
    );
  });

  it('GET sorts by _id descending (newest first)', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
    toArrayMock.mockResolvedValueOnce([]);
    
    await routes.GET();
    
    expect(sortMock).toHaveBeenCalledWith({ _id: -1 });
  });

  it('GET limits results to 100 users', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
    toArrayMock.mockResolvedValueOnce([]);
    
    await routes.GET();
    
    expect(limitMock).toHaveBeenCalledWith(100);
  });

  it('GET returns only specified fields in projection', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
    toArrayMock.mockResolvedValueOnce([]);
    
    await routes.GET();
    
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

  it('Response format matches approved users endpoint format', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
    findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
    
    const mockUsers = [{ _id: 'u5', name: 'Test', email: 'test@test.com', isAdmin: false, isApproved: false }];
    toArrayMock.mockResolvedValueOnce(mockUsers);
    
    const res = await routes.GET();
    const data = await res.json();
    
    // Both endpoints should return the same structure: { users: [...] }
    expect(data).toEqual({
      users: mockUsers
    });
  });
});

