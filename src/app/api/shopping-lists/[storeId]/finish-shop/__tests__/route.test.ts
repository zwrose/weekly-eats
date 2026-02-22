import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
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

// Mock errors module — must include ALL error groups used by the route
vi.mock('@/lib/errors', async () => {
  const actual = await vi.importActual('@/lib/errors');
  return actual;
});

// Mock Mongo client
const findOneMock = vi.fn();
const updateOneMock = vi.fn();
const bulkWriteMock = vi.fn();

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
            updateOne: updateOneMock,
          };
        }
        if (name === 'purchaseHistory') {
          return { bulkWrite: bulkWriteMock };
        }
        return {};
      },
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const { publishShoppingEvent } = await import('@/lib/realtime/ably-server');
const routes = await import('../route');

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/shopping-lists/abc/finish-shop', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  updateOneMock.mockReset();
  bulkWriteMock.mockReset();
  (publishShoppingEvent as any).mockClear();
});

describe('POST /api/shopping-lists/[storeId]/finish-shop', () => {
  const storeId = '507f1f77bcf86cd799439011';

  describe('Authentication & Authorization', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.POST(makeRequest({ checkedItems: [] }), {
        params: Promise.resolve({ storeId }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid storeId', async () => {
      (getServerSession as any).mockResolvedValueOnce({
        user: { id: 'user1', email: 'user@test.com' },
      });
      const res = await routes.POST(makeRequest({ checkedItems: [] }), {
        params: Promise.resolve({ storeId: 'invalid' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when user has no access to store', async () => {
      (getServerSession as any).mockResolvedValueOnce({
        user: { id: 'user1', email: 'user@test.com' },
      });
      findOneMock.mockResolvedValueOnce(null); // store not found

      const res = await routes.POST(
        makeRequest({
          checkedItems: [{ foodItemId: 'f1', name: 'Milk', quantity: 1, unit: 'gal' }],
        }),
        { params: Promise.resolve({ storeId }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe('Validation', () => {
    it('returns 400 when checkedItems is missing or empty', async () => {
      (getServerSession as any).mockResolvedValueOnce({
        user: { id: 'user1', email: 'user@test.com' },
      });
      findOneMock.mockResolvedValueOnce({
        _id: ObjectId.createFromHexString(storeId),
        userId: 'user1',
      });

      const res = await routes.POST(makeRequest({ checkedItems: [] }), {
        params: Promise.resolve({ storeId }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Finish Shop Logic', () => {
    const checkedItems = [
      { foodItemId: 'food1', name: 'Milk', quantity: 2, unit: 'gallon' },
      { foodItemId: 'food2', name: 'Bread', quantity: 1, unit: 'loaf' },
    ];

    beforeEach(() => {
      (getServerSession as any).mockResolvedValueOnce({
        user: { id: 'user1', email: 'user@test.com' },
      });
      // Store found
      findOneMock.mockResolvedValueOnce({
        _id: ObjectId.createFromHexString(storeId),
        userId: 'user1',
      });
    });

    it('upserts checked items into purchaseHistory', async () => {
      // Shopping list with items
      findOneMock.mockResolvedValueOnce({
        storeId,
        items: [
          { foodItemId: 'food1', name: 'Milk', quantity: 2, unit: 'gallon', checked: true },
          { foodItemId: 'food2', name: 'Bread', quantity: 1, unit: 'loaf', checked: true },
          { foodItemId: 'food3', name: 'Eggs', quantity: 12, unit: 'piece', checked: false },
        ],
      });
      bulkWriteMock.mockResolvedValueOnce({ modifiedCount: 2 });
      updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 });

      const res = await routes.POST(makeRequest({ checkedItems }), {
        params: Promise.resolve({ storeId }),
      });

      expect(res.status).toBe(200);
      expect(bulkWriteMock).toHaveBeenCalledTimes(1);

      // Verify bulkWrite operations are updateOne upserts
      const operations = bulkWriteMock.mock.calls[0][0];
      expect(operations).toHaveLength(2);
      expect(operations[0].updateOne.filter).toEqual({ storeId, foodItemId: 'food1' });
      expect(operations[0].updateOne.upsert).toBe(true);
    });

    it('removes checked items from shopping list', async () => {
      findOneMock.mockResolvedValueOnce({
        storeId,
        items: [
          { foodItemId: 'food1', name: 'Milk', quantity: 2, unit: 'gallon', checked: true },
          { foodItemId: 'food2', name: 'Bread', quantity: 1, unit: 'loaf', checked: true },
          { foodItemId: 'food3', name: 'Eggs', quantity: 12, unit: 'piece', checked: false },
        ],
      });
      bulkWriteMock.mockResolvedValueOnce({ modifiedCount: 2 });
      updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 });

      await routes.POST(makeRequest({ checkedItems }), { params: Promise.resolve({ storeId }) });

      // Verify the shopping list was updated to only contain unchecked items
      expect(updateOneMock).toHaveBeenCalledWith(
        { storeId },
        expect.objectContaining({
          $set: expect.objectContaining({
            items: [
              { foodItemId: 'food3', name: 'Eggs', quantity: 12, unit: 'piece', checked: false },
            ],
          }),
        })
      );
    });

    it('broadcasts list_updated event via Ably', async () => {
      findOneMock.mockResolvedValueOnce({
        storeId,
        items: [{ foodItemId: 'food1', name: 'Milk', quantity: 2, unit: 'gallon', checked: true }],
      });
      bulkWriteMock.mockResolvedValueOnce({ modifiedCount: 1 });
      updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 });

      await routes.POST(makeRequest({ checkedItems: [checkedItems[0]] }), {
        params: Promise.resolve({ storeId }),
      });

      expect(publishShoppingEvent).toHaveBeenCalledWith(
        storeId,
        'list_updated',
        expect.objectContaining({
          updatedBy: 'user@test.com',
        })
      );
    });

    it('returns success response with remaining items', async () => {
      findOneMock.mockResolvedValueOnce({
        storeId,
        items: [
          { foodItemId: 'food1', name: 'Milk', quantity: 2, unit: 'gallon', checked: true },
          { foodItemId: 'food3', name: 'Eggs', quantity: 12, unit: 'piece', checked: false },
        ],
      });
      bulkWriteMock.mockResolvedValueOnce({ modifiedCount: 1 });
      updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 });

      const res = await routes.POST(makeRequest({ checkedItems: [checkedItems[0]] }), {
        params: Promise.resolve({ storeId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.remainingItems).toHaveLength(1);
      expect(data.remainingItems[0].foodItemId).toBe('food3');
    });
  });
});
