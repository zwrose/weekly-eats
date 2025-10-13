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

describe('api/admin/users/approve route', () => {
  describe('Authentication & Authorization', () => {
    it('POST returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.POST(makeRequest({ userId: 'test-id', isApproved: true }));
      expect(res.status).toBe(401);
    });

    it('POST returns 403 when user is not admin', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'user@test.com' } });
      findOneMock.mockResolvedValueOnce({ email: 'user@test.com', isAdmin: false });
      const res = await routes.POST(makeRequest({ userId: 'test-id', isApproved: true }));
      expect(res.status).toBe(403);
    });
  });

  describe('Request Parameter Validation', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
      findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
    });

    it('POST returns 400 when userId is missing', async () => {
      const res = await routes.POST(makeRequest({ isApproved: true }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('POST returns 400 when isApproved is missing', async () => {
      const res = await routes.POST(makeRequest({ userId: 'test-id' }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('POST returns 400 when isApproved is not a boolean', async () => {
      const res = await routes.POST(makeRequest({ userId: 'test-id', isApproved: 'true' }));
      expect(res.status).toBe(400);
    });

    /**
     * CRITICAL TEST: Ensures the API expects 'isApproved' (not 'approved')
     * This test prevents the parameter mismatch bug that occurred when:
     * - Frontend sent: { userId, approved: true }
     * - Backend expected: { userId, isApproved: true }
     */
    it('POST rejects request with "approved" instead of "isApproved"', async () => {
      const res = await routes.POST(makeRequest({ userId: 'test-id', approved: true }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('POST accepts valid request with correct parameter names', async () => {
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
      const res = await routes.POST(makeRequest({ 
        userId: '507f1f77bcf86cd799439011', 
        isApproved: true 
      }));
      expect(res.status).toBe(200);
    });
  });

  describe('User Approval Logic', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
      findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
    });

    it('POST approves user when isApproved is true', async () => {
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
      
      const userId = '507f1f77bcf86cd799439011';
      await routes.POST(makeRequest({ userId, isApproved: true }));

      expect(updateOneMock).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: { isApproved: true } }
      );
    });

    it('POST revokes approval when isApproved is false', async () => {
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
      
      const userId = '507f1f77bcf86cd799439011';
      await routes.POST(makeRequest({ userId, isApproved: false }));

      expect(updateOneMock).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: { isApproved: false } }
      );
    });

    it('POST returns 404 when user not found', async () => {
      updateOneMock.mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 });
      
      const res = await routes.POST(makeRequest({ 
        userId: '507f1f77bcf86cd799439011', 
        isApproved: true 
      }));
      
      expect(res.status).toBe(404);
    });

    it('POST converts userId string to ObjectId correctly', async () => {
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
      
      const userId = '507f1f77bcf86cd799439011';
      await routes.POST(makeRequest({ userId, isApproved: true }));

      const callArgs = updateOneMock.mock.calls[0];
      const queryFilter = callArgs[0];
      
      expect(queryFilter._id).toBeInstanceOf(ObjectId);
      expect(queryFilter._id.toString()).toBe(userId);
    });

    it('POST returns success response with correct format', async () => {
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
      
      const res = await routes.POST(makeRequest({ 
        userId: '507f1f77bcf86cd799439011', 
        isApproved: true 
      }));
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
    });
  });

  describe('Error Handling', () => {
    it('POST handles database errors gracefully', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
      findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
      updateOneMock.mockRejectedValueOnce(new Error('Database connection failed'));
      
      const res = await routes.POST(makeRequest({ 
        userId: '507f1f77bcf86cd799439011', 
        isApproved: true 
      }));
      
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('POST handles invalid ObjectId format', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { email: 'admin@test.com' } });
      findOneMock.mockResolvedValueOnce({ email: 'admin@test.com', isAdmin: true });
      
      const res = await routes.POST(makeRequest({ 
        userId: 'invalid-id', 
        isApproved: true 
      }));
      
      expect(res.status).toBe(500);
    });
  });
});

