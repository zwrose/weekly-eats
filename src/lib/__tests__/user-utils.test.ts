import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServerSession } from 'next-auth/next';
import { getUserObjectId, getCurrentUserAdminStatus } from '../user-utils';

// Mock MongoDB
const mockCollection = {
  findOne: vi.fn(),
};

vi.mock('../mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => mockCollection,
    }),
  })),
}));

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockGetServerSession = vi.mocked(getServerSession);

describe('user-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserObjectId', () => {
    it('returns ObjectId when user exists', async () => {
      const mockUser = { _id: '507f1f77bcf86cd799439011' };
      mockCollection.findOne.mockResolvedValue(mockUser);

      const result = await getUserObjectId('test@example.com');

      expect(result).toBe('507f1f77bcf86cd799439011');
      expect(mockCollection.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('returns null when user does not exist', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await getUserObjectId('nonexistent@example.com');

      expect(result).toBeNull();
      expect(mockCollection.findOne).toHaveBeenCalledWith({ email: 'nonexistent@example.com' });
    });

    it('handles database errors gracefully', async () => {
      mockCollection.findOne.mockRejectedValue(new Error('Database error'));

      await expect(getUserObjectId('test@example.com')).rejects.toThrow('Database error');
    });
  });

  describe('getCurrentUserAdminStatus', () => {
    it('returns false when there is no session', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const result = await getCurrentUserAdminStatus();

      expect(result).toBe(false);
      expect(mockCollection.findOne).not.toHaveBeenCalled();
    });

    it('returns true when the user is an admin', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: 'admin@example.com' },
      });
      mockCollection.findOne.mockResolvedValue({ isAdmin: true });

      const result = await getCurrentUserAdminStatus();

      expect(result).toBe(true);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ email: 'admin@example.com' });
    });

    it('returns false when the user is not an admin', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: 'user@example.com' },
      });
      mockCollection.findOne.mockResolvedValue({ isAdmin: false });

      const result = await getCurrentUserAdminStatus();

      expect(result).toBe(false);
    });

    it('returns false when the user is not found', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: 'user@example.com' },
      });
      mockCollection.findOne.mockResolvedValue(null);

      const result = await getCurrentUserAdminStatus();

      expect(result).toBe(false);
    });
  });
});
