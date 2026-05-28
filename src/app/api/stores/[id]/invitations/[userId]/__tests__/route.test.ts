import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const storesFindOne = vi.fn();
const storesUpdateOne = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({ findOne: storesFindOne, updateOne: storesUpdateOne }),
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
});

describe('api/stores/[id]/invitations/[userId] route', () => {
  describe('PUT (accept/reject)', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.PUT(makeReq('http://localhost', { action: 'accept' }), {
        params: Promise.resolve({ id: VALID_ID, userId: 'u1' }),
      } as any);
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid ObjectId', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      const res = await routes.PUT(makeReq('http://localhost', { action: 'accept' }), {
        params: Promise.resolve({ id: 'bad', userId: 'u1' }),
      } as any);
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid action', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      const res = await routes.PUT(makeReq('http://localhost', { action: 'bogus' }), {
        params: Promise.resolve({ id: VALID_ID, userId: 'u1' }),
      } as any);
      expect(res.status).toBe(400);
    });

    it('returns 403 when acting on another user invitation', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      const res = await routes.PUT(makeReq('http://localhost', { action: 'accept' }), {
        params: Promise.resolve({ id: VALID_ID, userId: 'someone-else' }),
      } as any);
      expect(res.status).toBe(403);
    });

    it('returns 404 when pending invitation not found', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      storesFindOne.mockResolvedValueOnce(null);
      const res = await routes.PUT(makeReq('http://localhost', { action: 'accept' }), {
        params: Promise.resolve({ id: VALID_ID, userId: 'u1' }),
      } as any);
      expect(res.status).toBe(404);
    });

    it('accepts invitation on success', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      storesFindOne.mockResolvedValueOnce({
        _id: VALID_ID,
        invitations: [{ userId: 'u1', status: 'pending' }],
      });
      storesUpdateOne.mockResolvedValueOnce({ matchedCount: 1 });
      const res = await routes.PUT(makeReq('http://localhost', { action: 'accept' }), {
        params: Promise.resolve({ id: VALID_ID, userId: 'u1' }),
      } as any);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('returns 500 when DB throws', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      storesFindOne.mockRejectedValueOnce(new Error('db down'));
      const res = await routes.PUT(makeReq('http://localhost', { action: 'accept' }), {
        params: Promise.resolve({ id: VALID_ID, userId: 'u1' }),
      } as any);
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE (remove/leave)', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.DELETE(makeReq('http://localhost'), {
        params: Promise.resolve({ id: VALID_ID, userId: 'u2' }),
      } as any);
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid ObjectId', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      const res = await routes.DELETE(makeReq('http://localhost'), {
        params: Promise.resolve({ id: 'bad', userId: 'u2' }),
      } as any);
      expect(res.status).toBe(400);
    });

    it('returns 404 when store not found', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      storesFindOne.mockResolvedValueOnce(null);
      const res = await routes.DELETE(makeReq('http://localhost'), {
        params: Promise.resolve({ id: VALID_ID, userId: 'u2' }),
      } as any);
      expect(res.status).toBe(404);
    });

    it('returns 403 when neither owner nor self', async () => {
      // session user u3 is not the owner (u1) and not the target (u2)
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u3' } });
      storesFindOne.mockResolvedValueOnce({ _id: VALID_ID, userId: 'u1' });
      const res = await routes.DELETE(makeReq('http://localhost'), {
        params: Promise.resolve({ id: VALID_ID, userId: 'u2' }),
      } as any);
      expect(res.status).toBe(403);
    });

    it('allows owner to remove a user', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      storesFindOne.mockResolvedValueOnce({ _id: VALID_ID, userId: 'u1' });
      storesUpdateOne.mockResolvedValueOnce({ matchedCount: 1 });
      const res = await routes.DELETE(makeReq('http://localhost'), {
        params: Promise.resolve({ id: VALID_ID, userId: 'u2' }),
      } as any);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('allows user to remove themselves', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u2' } });
      storesFindOne.mockResolvedValueOnce({ _id: VALID_ID, userId: 'u1' });
      storesUpdateOne.mockResolvedValueOnce({ matchedCount: 1 });
      const res = await routes.DELETE(makeReq('http://localhost'), {
        params: Promise.resolve({ id: VALID_ID, userId: 'u2' }),
      } as any);
      expect(res.status).toBe(200);
    });

    it('returns 500 when DB throws', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
      storesFindOne.mockRejectedValueOnce(new Error('db down'));
      const res = await routes.DELETE(makeReq('http://localhost'), {
        params: Promise.resolve({ id: VALID_ID, userId: 'u2' }),
      } as any);
      expect(res.status).toBe(500);
    });
  });
});
