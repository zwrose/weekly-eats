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
const findMock = vi.fn();
const sortMock = vi.fn();
const toArrayMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'stores') {
          return { findOne: findOneMock };
        }
        if (name === 'purchaseHistory') {
          return {
            find: findMock,
          };
        }
        return {};
      },
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');

const routes = await import('../route');

const makeRequest = () => ({}) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  findMock.mockReset();
  sortMock.mockReset();
  toArrayMock.mockReset();

  // Chain: find().sort().toArray()
  sortMock.mockReturnValue({ toArray: toArrayMock });
  findMock.mockReturnValue({ sort: sortMock });
});

describe('GET /api/shopping-lists/[storeId]/history', () => {
  const storeId = '507f1f77bcf86cd799439011';

  describe('Authentication & Authorization', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.GET(makeRequest(), {
        params: Promise.resolve({ storeId }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid storeId', async () => {
      (getServerSession as any).mockResolvedValueOnce({
        user: { id: 'user1', email: 'user@test.com' },
      });
      const res = await routes.GET(makeRequest(), {
        params: Promise.resolve({ storeId: 'invalid' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when user has no access to store', async () => {
      (getServerSession as any).mockResolvedValueOnce({
        user: { id: 'user1', email: 'user@test.com' },
      });
      findOneMock.mockResolvedValueOnce(null);

      const res = await routes.GET(makeRequest(), {
        params: Promise.resolve({ storeId }),
      });
      expect(res.status).toBe(404);
    });

    it('allows access for store owner', async () => {
      (getServerSession as any).mockResolvedValueOnce({
        user: { id: 'user1', email: 'user@test.com' },
      });
      findOneMock.mockResolvedValueOnce({
        _id: ObjectId.createFromHexString(storeId),
        userId: 'user1',
      });
      toArrayMock.mockResolvedValueOnce([]);

      const res = await routes.GET(makeRequest(), {
        params: Promise.resolve({ storeId }),
      });
      expect(res.status).toBe(200);
    });

    it('allows access for user with accepted invitation', async () => {
      (getServerSession as any).mockResolvedValueOnce({
        user: { id: 'user2', email: 'user2@test.com' },
      });
      findOneMock.mockResolvedValueOnce({
        _id: ObjectId.createFromHexString(storeId),
        userId: 'user1',
        invitations: [{ userId: 'user2', status: 'accepted' }],
      });
      toArrayMock.mockResolvedValueOnce([]);

      const res = await routes.GET(makeRequest(), {
        params: Promise.resolve({ storeId }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Response data', () => {
    it('returns history items sorted by lastPurchasedAt descending', async () => {
      (getServerSession as any).mockResolvedValueOnce({
        user: { id: 'user1', email: 'user@test.com' },
      });
      findOneMock.mockResolvedValueOnce({
        _id: ObjectId.createFromHexString(storeId),
        userId: 'user1',
      });

      const historyItems = [
        {
          _id: new ObjectId(),
          storeId,
          foodItemId: 'food1',
          name: 'Milk',
          quantity: 2,
          unit: 'gallon',
          lastPurchasedAt: new Date('2026-02-15'),
        },
        {
          _id: new ObjectId(),
          storeId,
          foodItemId: 'food2',
          name: 'Bread',
          quantity: 1,
          unit: 'loaf',
          lastPurchasedAt: new Date('2026-02-14'),
        },
      ];
      toArrayMock.mockResolvedValueOnce(historyItems);

      const res = await routes.GET(makeRequest(), {
        params: Promise.resolve({ storeId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('Milk');
      expect(data[1].name).toBe('Bread');
    });

    it('returns empty array when no history exists', async () => {
      (getServerSession as any).mockResolvedValueOnce({
        user: { id: 'user1', email: 'user@test.com' },
      });
      findOneMock.mockResolvedValueOnce({
        _id: ObjectId.createFromHexString(storeId),
        userId: 'user1',
      });
      toArrayMock.mockResolvedValueOnce([]);

      const res = await routes.GET(makeRequest(), {
        params: Promise.resolve({ storeId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([]);
    });

    it('queries purchaseHistory with correct storeId and sort', async () => {
      (getServerSession as any).mockResolvedValueOnce({
        user: { id: 'user1', email: 'user@test.com' },
      });
      findOneMock.mockResolvedValueOnce({
        _id: ObjectId.createFromHexString(storeId),
        userId: 'user1',
      });
      toArrayMock.mockResolvedValueOnce([]);

      await routes.GET(makeRequest(), {
        params: Promise.resolve({ storeId }),
      });

      expect(findMock).toHaveBeenCalledWith({ storeId });
      expect(sortMock).toHaveBeenCalledWith({ lastPurchasedAt: -1 });
    });
  });
});
