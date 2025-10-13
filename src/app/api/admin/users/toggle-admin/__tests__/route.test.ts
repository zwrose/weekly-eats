import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

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

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const makeRequest = (body: unknown) => ({
  json: async () => body,
} as any);

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  updateOneMock.mockReset();
});

describe('api/admin/users/toggle-admin route', () => {
  describe('Authentication & Authorization', () => {
    it('POST returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.POST(makeRequest({ userId: 'test-id', isAdmin: true }));
      expect(res.status).toBe(401);
    });

    it('POST returns 403 when user is not admin', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'user@test.com' } });
      findOneMock.mockResolvedValueOnce({ email: 'user@test.com', isAdmin: false });
      const res = await routes.POST(makeRequest({ userId: 'test-id', isAdmin: true }));
      expect(res.status).toBe(403);
    });
  });

  describe('Request Parameter Validation', () => {
    it('POST returns 400 when userId is missing', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
      findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
      
      const res = await routes.POST(makeRequest({ isAdmin: true }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('POST returns 400 when isAdmin is missing', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
      findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
      
      const res = await routes.POST(makeRequest({ userId: 'test-id' }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('POST returns 400 when isAdmin is not a boolean', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
      findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
      
      const res = await routes.POST(makeRequest({ userId: 'test-id', isAdmin: 'true' }));
      expect(res.status).toBe(400);
    });

    /**
     * CRITICAL TEST: Ensures the API expects 'isAdmin' (not 'admin')
     * Prevents parameter mismatch bugs similar to the isApproved issue
     */
    it('POST rejects request with "admin" instead of "isAdmin"', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
      findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
      
      const res = await routes.POST(makeRequest({ userId: 'test-id', admin: true }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('POST accepts valid request with correct parameter names', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
      findOneMock
        .mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true }) // current user check
        .mockResolvedValueOnce({ email: 'user@test.com', isAdmin: false }); // target user check
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
      
      const res = await routes.POST(makeRequest({ 
        userId: '507f1f77bcf86cd799439011', 
        isAdmin: true 
      }));
      expect(res.status).toBe(200);
    });
  });

  describe('Admin Toggle Logic', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
    });

    it('POST grants admin when isAdmin is true', async () => {
      findOneMock
        .mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true })
        .mockResolvedValueOnce({ email: 'user@test.com', isAdmin: false });
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
      
      const userId = '507f1f77bcf86cd799439011';
      await routes.POST(makeRequest({ userId, isAdmin: true }));

      expect(updateOneMock).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: { isAdmin: true } }
      );
    });

    it('POST revokes admin when isAdmin is false', async () => {
      findOneMock
        .mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true })
        .mockResolvedValueOnce({ email: 'user@test.com', isAdmin: true });
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
      
      const userId = '507f1f77bcf86cd799439011';
      await routes.POST(makeRequest({ userId, isAdmin: false }));

      expect(updateOneMock).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: { isAdmin: false } }
      );
    });

    it('POST returns 404 when target user not found', async () => {
      findOneMock
        .mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true })
        .mockResolvedValueOnce(null); // target user not found
      
      const res = await routes.POST(makeRequest({ 
        userId: '507f1f77bcf86cd799439011', 
        isAdmin: true 
      }));
      
      expect(res.status).toBe(404);
    });

    it('POST prevents user from modifying their own admin status', async () => {
      findOneMock
        .mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true })
        .mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true }); // same email
      
      const res = await routes.POST(makeRequest({ 
        userId: '507f1f77bcf86cd799439011', 
        isAdmin: false 
      }));
      
      expect(res.status).toBe(400);
      expect(updateOneMock).not.toHaveBeenCalled();
    });

    it('POST converts userId string to ObjectId correctly', async () => {
      findOneMock
        .mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true })
        .mockResolvedValueOnce({ email: 'user@test.com', isAdmin: false });
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
      
      const userId = '507f1f77bcf86cd799439011';
      await routes.POST(makeRequest({ userId, isAdmin: true }));

      const callArgs = updateOneMock.mock.calls[0];
      const queryFilter = callArgs[0];
      
      expect(queryFilter._id).toBeInstanceOf(ObjectId);
      expect(queryFilter._id.toString()).toBe(userId);
    });

    it('POST returns success response with correct format', async () => {
      findOneMock
        .mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true })
        .mockResolvedValueOnce({ email: 'user@test.com', isAdmin: false });
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
      
      const res = await routes.POST(makeRequest({ 
        userId: '507f1f77bcf86cd799439011', 
        isAdmin: true 
      }));
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
    });
  });

  describe('Error Handling', () => {
    it('POST handles database errors gracefully', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
      findOneMock
        .mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true })
        .mockRejectedValueOnce(new Error('Database connection failed'));
      
      const res = await routes.POST(makeRequest({ 
        userId: '507f1f77bcf86cd799439011', 
        isAdmin: true 
      }));
      
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('POST handles invalid ObjectId format', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
      findOneMock
        .mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
      
      const res = await routes.POST(makeRequest({ 
        userId: 'invalid-id', 
        isAdmin: true 
      }));
      
      expect(res.status).toBe(500);
    });
  });
});

