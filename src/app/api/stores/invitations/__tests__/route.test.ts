import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const toArrayMock = vi.fn();
const findMock = vi.fn(() => ({ toArray: toArrayMock }));

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({ find: findMock }),
    }),
  })),
}));

const { auth } = await import('@/lib/auth');
const routes = await import('../route');

beforeEach(() => {
  (auth as any).mockReset();
  toArrayMock.mockReset();
  findMock.mockClear();
});

describe('api/stores/invitations route', () => {
  describe('GET', () => {
    it('returns 401 when unauthenticated', async () => {
      (auth as any).mockResolvedValueOnce(null);
      const res = await routes.GET();
      expect(res.status).toBe(401);
    });

    it('returns pending invitations for the user', async () => {
      (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      toArrayMock.mockResolvedValueOnce([
        {
          _id: { toString: () => 'store1' },
          name: 'Trader Joes',
          emoji: '🛒',
          invitations: [
            { userId: 'u1', status: 'pending' },
            { userId: 'u2', status: 'accepted' },
          ],
        },
      ]);
      const res = await routes.GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveLength(1);
      expect(json[0].storeId).toBe('store1');
      expect(json[0].storeName).toBe('Trader Joes');
      expect(json[0].invitation.userId).toBe('u1');
    });

    it('filters out stores with no matching pending invitation', async () => {
      (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      toArrayMock.mockResolvedValueOnce([
        {
          _id: { toString: () => 'store2' },
          name: 'Costco',
          invitations: [{ userId: 'u1', status: 'accepted' }],
        },
      ]);
      const res = await routes.GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveLength(0);
    });

    it('returns 403 when the user is not approved', async () => {
      (auth as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
      const res = await routes.GET();
      expect(res.status).toBe(403);
    });

    it('returns 500 when DB throws', async () => {
      (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      toArrayMock.mockRejectedValueOnce(new Error('db down'));
      const res = await routes.GET();
      expect(res.status).toBe(500);
    });
  });
});
