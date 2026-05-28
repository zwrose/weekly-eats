import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const storesFindOne = vi.fn();
const positionsFindOne = vi.fn();
const positionsBulkWrite = vi.fn();
const positionsToArray = vi.fn();
const positionsSort = vi.fn(() => ({ toArray: positionsToArray }));
const positionsFind = vi.fn(() => ({ sort: positionsSort }));

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'storeItemPositions') {
          return { findOne: positionsFindOne, find: positionsFind, bulkWrite: positionsBulkWrite };
        }
        // stores
        return { findOne: storesFindOne };
      },
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const VALID_STORE_ID = '64b7f8c2a2b7c2f1a2b7c2f1';
const VALID_FOOD_ID = '507f1f77bcf86cd799439011';
const makeReq = (url: string, body?: unknown) => ({ url, json: async () => body }) as any;

beforeEach(() => {
  (getServerSession as any).mockReset();
  storesFindOne.mockReset();
  positionsFindOne.mockReset();
  positionsBulkWrite.mockReset();
  positionsToArray.mockReset();
  positionsSort.mockClear();
  positionsFind.mockClear();
});

describe('api/shopping-lists/[storeId]/positions route', () => {
  describe('GET', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.GET(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`),
        {
          params: Promise.resolve({ storeId: VALID_STORE_ID }),
        } as any
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not approved', async () => {
      (getServerSession as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
      const res = await routes.GET(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`),
        {
          params: Promise.resolve({ storeId: VALID_STORE_ID }),
        } as any
      );
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid storeId', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      const res = await routes.GET(makeReq('http://localhost/api/shopping-lists/bad/positions'), {
        params: Promise.resolve({ storeId: 'bad' }),
      } as any);
      expect(res.status).toBe(400);
    });

    it('returns 404 when store not accessible', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce(null);
      const res = await routes.GET(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`),
        {
          params: Promise.resolve({ storeId: VALID_STORE_ID }),
        } as any
      );
      expect(res.status).toBe(404);
    });

    it('returns all positions for the store', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({ _id: VALID_STORE_ID, userId: 'u1' });
      positionsToArray.mockResolvedValueOnce([
        { foodItemId: VALID_FOOD_ID, position: 0.5, updatedAt: new Date() },
      ]);
      const res = await routes.GET(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`),
        {
          params: Promise.resolve({ storeId: VALID_STORE_ID }),
        } as any
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.positions).toHaveLength(1);
      expect(json.positions[0].position).toBe(0.5);
    });

    it('returns single position when foodItemId query provided', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({ _id: VALID_STORE_ID, userId: 'u1' });
      positionsFindOne.mockResolvedValueOnce({ position: 0.25 });
      const res = await routes.GET(
        makeReq(
          `http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions?foodItemId=${VALID_FOOD_ID}`
        ),
        { params: Promise.resolve({ storeId: VALID_STORE_ID }) } as any
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.position).toBe(0.25);
    });

    it('returns null position when not found for foodItemId', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({ _id: VALID_STORE_ID, userId: 'u1' });
      positionsFindOne.mockResolvedValueOnce(null);
      const res = await routes.GET(
        makeReq(
          `http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions?foodItemId=${VALID_FOOD_ID}`
        ),
        { params: Promise.resolve({ storeId: VALID_STORE_ID }) } as any
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.position).toBeNull();
    });

    it('returns 400 for invalid foodItemId query', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({ _id: VALID_STORE_ID, userId: 'u1' });
      const res = await routes.GET(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions?foodItemId=bad`),
        { params: Promise.resolve({ storeId: VALID_STORE_ID }) } as any
      );
      expect(res.status).toBe(400);
    });

    it('returns 500 when DB throws', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockRejectedValueOnce(new Error('db down'));
      const res = await routes.GET(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`),
        {
          params: Promise.resolve({ storeId: VALID_STORE_ID }),
        } as any
      );
      expect(res.status).toBe(500);
    });
  });

  describe('POST', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.POST(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`, {
          positions: [],
        }),
        { params: Promise.resolve({ storeId: VALID_STORE_ID }) } as any
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not approved', async () => {
      (getServerSession as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
      const res = await routes.POST(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`, {
          positions: [],
        }),
        { params: Promise.resolve({ storeId: VALID_STORE_ID }) } as any
      );
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid storeId', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      const res = await routes.POST(
        makeReq('http://localhost/api/shopping-lists/bad/positions', { positions: [] }),
        { params: Promise.resolve({ storeId: 'bad' }) } as any
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when positions is not an array', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      const res = await routes.POST(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`, {
          positions: 'nope',
        }),
        { params: Promise.resolve({ storeId: VALID_STORE_ID }) } as any
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing foodItemId in a position', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      const res = await routes.POST(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`, {
          positions: [{ position: 0.5 }],
        }),
        { params: Promise.resolve({ storeId: VALID_STORE_ID }) } as any
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 for out-of-range position', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      const res = await routes.POST(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`, {
          positions: [{ foodItemId: VALID_FOOD_ID, position: 5 }],
        }),
        { params: Promise.resolve({ storeId: VALID_STORE_ID }) } as any
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid foodItemId format', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      const res = await routes.POST(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`, {
          positions: [{ foodItemId: 'bad', position: 0.5 }],
        }),
        { params: Promise.resolve({ storeId: VALID_STORE_ID }) } as any
      );
      expect(res.status).toBe(400);
    });

    it('returns 404 when store not accessible', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce(null);
      const res = await routes.POST(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`, {
          positions: [{ foodItemId: VALID_FOOD_ID, position: 0.5 }],
        }),
        { params: Promise.resolve({ storeId: VALID_STORE_ID }) } as any
      );
      expect(res.status).toBe(404);
    });

    it('upserts positions on success', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({ _id: VALID_STORE_ID, userId: 'u1' });
      positionsBulkWrite.mockResolvedValueOnce({ ok: 1 });
      const res = await routes.POST(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`, {
          positions: [{ foodItemId: VALID_FOOD_ID, position: 0.5 }],
        }),
        { params: Promise.resolve({ storeId: VALID_STORE_ID }) } as any
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(positionsBulkWrite).toHaveBeenCalled();
    });

    it('succeeds with empty positions without calling bulkWrite', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({ _id: VALID_STORE_ID, userId: 'u1' });
      const res = await routes.POST(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`, {
          positions: [],
        }),
        { params: Promise.resolve({ storeId: VALID_STORE_ID }) } as any
      );
      expect(res.status).toBe(200);
      expect(positionsBulkWrite).not.toHaveBeenCalled();
    });

    it('returns 500 when DB throws', async () => {
      (getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
      storesFindOne.mockResolvedValueOnce({ _id: VALID_STORE_ID, userId: 'u1' });
      positionsBulkWrite.mockRejectedValueOnce(new Error('db down'));
      const res = await routes.POST(
        makeReq(`http://localhost/api/shopping-lists/${VALID_STORE_ID}/positions`, {
          positions: [{ foodItemId: VALID_FOOD_ID, position: 0.5 }],
        }),
        { params: Promise.resolve({ storeId: VALID_STORE_ID }) } as any
      );
      expect(res.status).toBe(500);
    });
  });
});
