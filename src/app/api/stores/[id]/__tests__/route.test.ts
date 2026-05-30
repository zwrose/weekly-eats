import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const storesFindOne = vi.fn();
const storesUpdateOne = vi.fn();
const storesDeleteOne = vi.fn();
const shoppingListsFindOne = vi.fn();
const shoppingListsDeleteOne = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'shoppingLists') {
          return { findOne: shoppingListsFindOne, deleteOne: shoppingListsDeleteOne };
        }
        // stores
        return { findOne: storesFindOne, updateOne: storesUpdateOne, deleteOne: storesDeleteOne };
      },
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const VALID_ID = '64b7f8c2a2b7c2f1a2b7c2f1';
const makeReq = (url: string, body?: unknown) => ({ url, json: async () => body }) as any;

beforeEach(() => {
  (getServerSession as any).mockReset();
  storesFindOne.mockReset();
  storesUpdateOne.mockReset();
  storesDeleteOne.mockReset();
  shoppingListsFindOne.mockReset();
  shoppingListsDeleteOne.mockReset();
});

describe('api/stores/[id] route', () => {
  describe('GET', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.GET(makeReq(`http://localhost/api/stores/${VALID_ID}`), {
        params: Promise.resolve({ id: VALID_ID }),
      } as any);
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not approved', async () => {
      (getServerSession as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
      const res = await routes.GET(makeReq(`http://localhost/api/stores/${VALID_ID}`), {
        params: Promise.resolve({ id: VALID_ID }),
      } as any);
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid ObjectId', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      const res = await routes.GET(makeReq('http://localhost/api/stores/bad'), {
        params: Promise.resolve({ id: 'bad' }),
      } as any);
      expect(res.status).toBe(400);
    });

    it('returns 404 when store not owned/found', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce(null);
      const res = await routes.GET(makeReq(`http://localhost/api/stores/${VALID_ID}`), {
        params: Promise.resolve({ id: VALID_ID }),
      } as any);
      expect(res.status).toBe(404);
    });

    it('returns store with shopping list on success', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({ _id: VALID_ID, userId: 'u1', name: 'Store' });
      shoppingListsFindOne.mockResolvedValueOnce({ _id: 'sl1', storeId: VALID_ID, items: [] });
      const res = await routes.GET(makeReq(`http://localhost/api/stores/${VALID_ID}`), {
        params: Promise.resolve({ id: VALID_ID }),
      } as any);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.name).toBe('Store');
      expect(json.shoppingList._id).toBe('sl1');
    });

    it('returns default shopping list when none exists', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({ _id: VALID_ID, userId: 'u1', name: 'Store' });
      shoppingListsFindOne.mockResolvedValueOnce(null);
      const res = await routes.GET(makeReq(`http://localhost/api/stores/${VALID_ID}`), {
        params: Promise.resolve({ id: VALID_ID }),
      } as any);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.shoppingList.items).toEqual([]);
    });

    it('returns 500 when DB throws', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockRejectedValueOnce(new Error('db down'));
      const res = await routes.GET(makeReq(`http://localhost/api/stores/${VALID_ID}`), {
        params: Promise.resolve({ id: VALID_ID }),
      } as any);
      expect(res.status).toBe(500);
    });
  });

  describe('PUT', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.PUT(makeReq(`http://localhost/api/stores/${VALID_ID}`, {}), {
        params: Promise.resolve({ id: VALID_ID }),
      } as any);
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not approved', async () => {
      (getServerSession as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
      const res = await routes.PUT(makeReq(`http://localhost/api/stores/${VALID_ID}`, {}), {
        params: Promise.resolve({ id: VALID_ID }),
      } as any);
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid ObjectId', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      const res = await routes.PUT(makeReq('http://localhost/api/stores/bad', { name: 'X' }), {
        params: Promise.resolve({ id: 'bad' }),
      } as any);
      expect(res.status).toBe(400);
    });

    it('returns 404 when store not owned/found', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce(null);
      const res = await routes.PUT(
        makeReq(`http://localhost/api/stores/${VALID_ID}`, { name: 'X' }),
        {
          params: Promise.resolve({ id: VALID_ID }),
        } as any
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 for empty name', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({ _id: VALID_ID, userId: 'u1' });
      const res = await routes.PUT(
        makeReq(`http://localhost/api/stores/${VALID_ID}`, { name: '  ' }),
        {
          params: Promise.resolve({ id: VALID_ID }),
        } as any
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 for duplicate store name', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({ _id: VALID_ID, userId: 'u1' }); // ownership
      storesFindOne.mockResolvedValueOnce({ _id: 'other', name: 'Dup' }); // duplicate check
      const res = await routes.PUT(
        makeReq(`http://localhost/api/stores/${VALID_ID}`, { name: 'Dup' }),
        {
          params: Promise.resolve({ id: VALID_ID }),
        } as any
      );
      expect(res.status).toBe(400);
    });

    it('updates store on success', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({ _id: VALID_ID, userId: 'u1' }); // ownership
      storesFindOne.mockResolvedValueOnce(null); // no duplicate
      storesUpdateOne.mockResolvedValueOnce({ matchedCount: 1 });
      storesFindOne.mockResolvedValueOnce({ _id: VALID_ID, userId: 'u1', name: 'Renamed' }); // reload
      const res = await routes.PUT(
        makeReq(`http://localhost/api/stores/${VALID_ID}`, { name: 'Renamed', emoji: '🛒' }),
        { params: Promise.resolve({ id: VALID_ID }) } as any
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.name).toBe('Renamed');
    });

    it('returns 500 when DB throws', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockRejectedValueOnce(new Error('db down'));
      const res = await routes.PUT(
        makeReq(`http://localhost/api/stores/${VALID_ID}`, { name: 'X' }),
        {
          params: Promise.resolve({ id: VALID_ID }),
        } as any
      );
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.DELETE(makeReq(`http://localhost/api/stores/${VALID_ID}`), {
        params: Promise.resolve({ id: VALID_ID }),
      } as any);
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not approved', async () => {
      (getServerSession as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
      const res = await routes.DELETE(makeReq(`http://localhost/api/stores/${VALID_ID}`), {
        params: Promise.resolve({ id: VALID_ID }),
      } as any);
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid ObjectId', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      const res = await routes.DELETE(makeReq('http://localhost/api/stores/bad'), {
        params: Promise.resolve({ id: 'bad' }),
      } as any);
      expect(res.status).toBe(400);
    });

    it('returns 404 when store not owned/found', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce(null);
      const res = await routes.DELETE(makeReq(`http://localhost/api/stores/${VALID_ID}`), {
        params: Promise.resolve({ id: VALID_ID }),
      } as any);
      expect(res.status).toBe(404);
    });

    it('deletes store and reports shared user count', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({
        _id: VALID_ID,
        userId: 'u1',
        invitations: [
          { userId: 'u2', status: 'accepted' },
          { userId: 'u3', status: 'pending' },
        ],
      });
      shoppingListsDeleteOne.mockResolvedValueOnce({ deletedCount: 1 });
      storesDeleteOne.mockResolvedValueOnce({ deletedCount: 1 });
      const res = await routes.DELETE(makeReq(`http://localhost/api/stores/${VALID_ID}`), {
        params: Promise.resolve({ id: VALID_ID }),
      } as any);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.sharedUserCount).toBe(1);
    });

    it('returns 500 when DB throws', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockRejectedValueOnce(new Error('db down'));
      const res = await routes.DELETE(makeReq(`http://localhost/api/stores/${VALID_ID}`), {
        params: Promise.resolve({ id: VALID_ID }),
      } as any);
      expect(res.status).toBe(500);
    });
  });
});
