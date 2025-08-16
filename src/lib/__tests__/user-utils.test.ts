import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserObjectId } from '../user-utils';

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
});
