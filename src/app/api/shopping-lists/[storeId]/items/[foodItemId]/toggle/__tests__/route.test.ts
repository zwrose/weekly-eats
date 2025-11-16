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

// Mock Ably server publisher
vi.mock('@/lib/realtime/ably-server', () => ({
  publishShoppingEvent: vi.fn(),
}));

// Mock Mongo client
const findOneMock = vi.fn();
const updateOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'stores') {
          return { findOne: findOneMock };
        }
        if (name === 'shoppingLists') {
          return { 
            findOne: findOneMock,
            updateOne: updateOneMock
          };
        }
        return {};
      },
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const { publishShoppingEvent } = await import('@/lib/realtime/ably-server');
const routes = await import('../route');

const makeRequest = () => ({} as any);

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  updateOneMock.mockReset();
  (publishShoppingEvent as any).mockClear();
});

describe('api/shopping-lists/[storeId]/items/[foodItemId]/toggle route', () => {
  const storeId = '507f1f77bcf86cd799439011';
  const foodItemId = 'food-123';

  describe('Authentication & Authorization', () => {
    it('PATCH returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.PATCH(makeRequest(), {
        params: Promise.resolve({ storeId, foodItemId })
      });
      expect(res.status).toBe(401);
    });

    it('PATCH returns 400 when storeId is invalid', async () => {
      (getServerSession as any).mockResolvedValueOnce({ 
        user: { id: 'user1', email: 'user@test.com' } 
      });
      const res = await routes.PATCH(makeRequest(), {
        params: Promise.resolve({ storeId: 'invalid', foodItemId })
      });
      expect(res.status).toBe(400);
    });

    it('PATCH returns 404 when user does not have access to store', async () => {
      (getServerSession as any).mockResolvedValueOnce({ 
        user: { id: 'user1', email: 'user@test.com' } 
      });
      
      // Store not found or user has no access
      findOneMock.mockResolvedValueOnce(null);
      
      const res = await routes.PATCH(makeRequest(), {
        params: Promise.resolve({ storeId, foodItemId })
      });
      expect(res.status).toBe(404);
    });
  });

  describe('Item Toggle Functionality', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValueOnce({ 
        user: { id: 'user1', email: 'user@test.com' } 
      });
    });

    it('PATCH toggles item from unchecked to checked', async () => {
      // Store exists and user has access
      findOneMock
        .mockResolvedValueOnce({
          _id: ObjectId.createFromHexString(storeId),
          userId: 'user1',
          invitations: []
        })
        .mockResolvedValueOnce({
          storeId,
          items: [
            { foodItemId: 'food-123', quantity: 2, unit: 'cup', checked: false }
          ]
        })
        .mockResolvedValueOnce({
          storeId,
          items: [
            { foodItemId: 'food-123', quantity: 2, unit: 'cup', checked: true }
          ]
        });

      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const res = await routes.PATCH(makeRequest(), {
        params: Promise.resolve({ storeId, foodItemId })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.checked).toBe(true);
      expect(data.foodItemId).toBe(foodItemId);
    });

    it('PATCH toggles item from checked to unchecked', async () => {
      findOneMock
        .mockResolvedValueOnce({
          _id: ObjectId.createFromHexString(storeId),
          userId: 'user1',
          invitations: []
        })
        .mockResolvedValueOnce({
          storeId,
          items: [
            { foodItemId: 'food-123', quantity: 2, unit: 'cup', checked: true }
          ]
        })
        .mockResolvedValueOnce({
          storeId,
          items: [
            { foodItemId: 'food-123', quantity: 2, unit: 'cup', checked: false }
          ]
        });

      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const res = await routes.PATCH(makeRequest(), {
        params: Promise.resolve({ storeId, foodItemId })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.checked).toBe(false);
    });

    it('PATCH returns 404 when item not found in shopping list', async () => {
      findOneMock
        .mockResolvedValueOnce({
          _id: ObjectId.createFromHexString(storeId),
          userId: 'user1',
          invitations: []
        })
        .mockResolvedValueOnce({
          storeId,
          items: [
            { foodItemId: 'different-food', quantity: 1, unit: 'each', checked: false }
          ]
        });

      const res = await routes.PATCH(makeRequest(), {
        params: Promise.resolve({ storeId, foodItemId: 'non-existent' })
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('not found');
    });

    it('PATCH works for shared user with accepted invitation', async () => {
      (getServerSession as any).mockResolvedValueOnce({ 
        user: { id: 'user2', email: 'user2@test.com' } 
      });

      // Store owned by user1, but user2 has accepted invitation
      findOneMock
        .mockResolvedValueOnce({
          _id: ObjectId.createFromHexString(storeId),
          userId: 'user1',
          invitations: [
            { userId: 'user2', status: 'accepted' }
          ]
        })
        .mockResolvedValueOnce({
          storeId,
          items: [
            { foodItemId: 'food-123', quantity: 2, unit: 'cup', checked: false }
          ]
        })
        .mockResolvedValueOnce({
          storeId,
          items: [
            { foodItemId: 'food-123', quantity: 2, unit: 'cup', checked: true }
          ]
        });

      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const res = await routes.PATCH(makeRequest(), {
        params: Promise.resolve({ storeId, foodItemId })
      });

      expect(res.status).toBe(200);
    });
  });

  describe('Broadcasting', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValueOnce({ 
        user: { id: 'user1', email: 'user@test.com' } 
      });
    });

    it('PATCH broadcasts item_checked event on successful toggle', async () => {
      findOneMock
        .mockResolvedValueOnce({
          _id: ObjectId.createFromHexString(storeId),
          userId: 'user1',
          invitations: []
        })
        .mockResolvedValueOnce({
          storeId,
          items: [
            { foodItemId: 'food-123', quantity: 2, unit: 'cup', checked: false }
          ]
        })
        .mockResolvedValueOnce({
          storeId,
          items: [
            { foodItemId: 'food-123', quantity: 2, unit: 'cup', checked: true }
          ]
        });

      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await routes.PATCH(makeRequest(), {
        params: Promise.resolve({ storeId, foodItemId })
      });

      // Verify publishShoppingEvent was called with correct parameters
      expect(publishShoppingEvent).toHaveBeenCalledWith(
        storeId,
        'item_checked',
        expect.objectContaining({
          foodItemId,
          checked: true,
          updatedBy: 'user@test.com'
        })
      );
    });

    it('PATCH does not broadcast on error', async () => {
      findOneMock
        .mockResolvedValueOnce({
          _id: ObjectId.createFromHexString(storeId),
          userId: 'user1',
          invitations: []
        })
        .mockResolvedValueOnce({
          storeId,
          items: []
        });

      await routes.PATCH(makeRequest(), {
        params: Promise.resolve({ storeId, foodItemId: 'non-existent' })
      });

      // Should not publish when item not found
      expect(publishShoppingEvent).not.toHaveBeenCalled();
    });
  });

  describe('Response Format', () => {
    it('PATCH returns success with item data', async () => {
      (getServerSession as any).mockResolvedValueOnce({ 
        user: { id: 'user1', email: 'user@test.com' } 
      });

      findOneMock
        .mockResolvedValueOnce({
          _id: ObjectId.createFromHexString(storeId),
          userId: 'user1',
          invitations: []
        })
        .mockResolvedValueOnce({
          storeId,
          items: [
            { foodItemId: 'food-123', quantity: 2, unit: 'cup', checked: false }
          ]
        })
        .mockResolvedValueOnce({
          storeId,
          items: [
            { foodItemId: 'food-123', quantity: 2, unit: 'cup', checked: true }
          ]
        });

      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const res = await routes.PATCH(makeRequest(), {
        params: Promise.resolve({ storeId, foodItemId })
      });

      const data = await res.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('foodItemId');
      expect(data).toHaveProperty('checked');
      expect(data).toHaveProperty('items');
      expect(data.success).toBe(true);
      expect(data.foodItemId).toBe(foodItemId);
    });
  });
});

