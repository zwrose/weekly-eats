import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

vi.mock('@/lib/realtime/ably-server', () => ({
  publishShoppingEvent: vi.fn(),
}));

const storesFindOne = vi.fn();
const shoppingListsFindOne = vi.fn();
const shoppingListsInsertOne = vi.fn();
const shoppingListsUpdateOne = vi.fn();
const foodItemsFind = vi.fn();
const foodItemsToArray = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'stores') return { findOne: storesFindOne };
        if (name === 'shoppingLists')
          return {
            findOne: shoppingListsFindOne,
            insertOne: shoppingListsInsertOne,
            updateOne: shoppingListsUpdateOne,
          };
        if (name === 'foodItems')
          return {
            find: (...args: unknown[]) => {
              foodItemsFind(...args);
              return { toArray: foodItemsToArray };
            },
          };
        return {};
      },
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const VALID_STORE_ID = '507f1f77bcf86cd799439011';

function makeGetRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/shopping-lists/${VALID_STORE_ID}`, {
    method: 'GET',
  });
}

function makePutRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/shopping-lists/${VALID_STORE_ID}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  storesFindOne.mockReset();
  shoppingListsFindOne.mockReset();
  shoppingListsInsertOne.mockReset();
  shoppingListsUpdateOne.mockReset();
  foodItemsFind.mockReset();
  foodItemsToArray.mockReset();
});

describe('GET /api/shopping-lists/[storeId]', () => {
  describe('Authentication & Authorization', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.GET(makeGetRequest(), {
        params: Promise.resolve({ storeId: VALID_STORE_ID }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not approved', async () => {
      (getServerSession as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
      const res = await routes.GET(makeGetRequest(), {
        params: Promise.resolve({ storeId: VALID_STORE_ID }),
      });
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid storeId', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      const res = await routes.GET(makeGetRequest(), {
        params: Promise.resolve({ storeId: 'bad' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when store not found or user has no access', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce(null);
      const res = await routes.GET(makeGetRequest(), {
        params: Promise.resolve({ storeId: VALID_STORE_ID }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('Approved path', () => {
    it('returns the existing shopping list for an approved user', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({
        _id: ObjectId.createFromHexString(VALID_STORE_ID),
        userId: 'u1',
      });
      const listId = new ObjectId();
      shoppingListsFindOne.mockResolvedValueOnce({
        _id: listId,
        storeId: VALID_STORE_ID,
        userId: 'u1',
        items: [],
      });

      const res = await routes.GET(makeGetRequest(), {
        params: Promise.resolve({ storeId: VALID_STORE_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.storeId).toBe(VALID_STORE_ID);
      expect(json.items).toEqual([]);
    });
  });
});

describe('PUT /api/shopping-lists/[storeId]', () => {
  describe('Authentication & Authorization', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.PUT(makePutRequest({ items: [] }), {
        params: Promise.resolve({ storeId: VALID_STORE_ID }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not approved', async () => {
      (getServerSession as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
      const res = await routes.PUT(makePutRequest({ items: [] }), {
        params: Promise.resolve({ storeId: VALID_STORE_ID }),
      });
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid storeId', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      const res = await routes.PUT(makePutRequest({ items: [] }), {
        params: Promise.resolve({ storeId: 'bad' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when store not found or user has no access', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce(null);
      const res = await routes.PUT(makePutRequest({ items: [] }), {
        params: Promise.resolve({ storeId: VALID_STORE_ID }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('Approved path', () => {
    it('upserts and returns the shopping list for an approved user', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({
        _id: ObjectId.createFromHexString(VALID_STORE_ID),
        userId: 'u1',
      });
      // previousList (to detect deletions)
      shoppingListsFindOne.mockResolvedValueOnce({ storeId: VALID_STORE_ID, items: [] });
      shoppingListsUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
      // updated list after upsert
      shoppingListsFindOne.mockResolvedValueOnce({
        _id: new ObjectId(),
        storeId: VALID_STORE_ID,
        userId: 'u1',
        items: [],
      });

      const res = await routes.PUT(makePutRequest({ items: [] }), {
        params: Promise.resolve({ storeId: VALID_STORE_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.storeId).toBe(VALID_STORE_ID);
    });
  });
});
