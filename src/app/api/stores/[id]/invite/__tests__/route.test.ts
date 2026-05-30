import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const storesFindOne = vi.fn();
const storesUpdateOne = vi.fn();
const usersFindOne = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'users') {
          return { findOne: usersFindOne };
        }
        // stores
        return { findOne: storesFindOne, updateOne: storesUpdateOne };
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
  usersFindOne.mockReset();
});

describe('api/stores/[id]/invite route', () => {
  describe('POST', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.POST(
        makeReq(`http://localhost/api/stores/${VALID_ID}/invite`, { email: 'a@b.com' }),
        { params: Promise.resolve({ id: VALID_ID }) } as any
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not approved', async () => {
      (getServerSession as any).mockResolvedValueOnce(
        unapprovedSession({ id: 'u1', email: 'me@x.com' })
      );
      const res = await routes.POST(
        makeReq(`http://localhost/api/stores/${VALID_ID}/invite`, { email: 'guest@x.com' }),
        { params: Promise.resolve({ id: VALID_ID }) } as any
      );
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid ObjectId', async () => {
      (getServerSession as any).mockResolvedValueOnce(
        approvedSession({ id: 'u1', email: 'me@x.com' })
      );
      const res = await routes.POST(
        makeReq('http://localhost/api/stores/bad/invite', { email: 'a@b.com' }),
        { params: Promise.resolve({ id: 'bad' }) } as any
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid email', async () => {
      (getServerSession as any).mockResolvedValueOnce(
        approvedSession({ id: 'u1', email: 'me@x.com' })
      );
      const res = await routes.POST(
        makeReq(`http://localhost/api/stores/${VALID_ID}/invite`, { email: 'notanemail' }),
        { params: Promise.resolve({ id: VALID_ID }) } as any
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 for self-invitation', async () => {
      (getServerSession as any).mockResolvedValueOnce(
        approvedSession({ id: 'u1', email: 'me@x.com' })
      );
      const res = await routes.POST(
        makeReq(`http://localhost/api/stores/${VALID_ID}/invite`, { email: 'ME@X.com' }),
        { params: Promise.resolve({ id: VALID_ID }) } as any
      );
      expect(res.status).toBe(400);
    });

    it('returns 404 when store not owned/found', async () => {
      (getServerSession as any).mockResolvedValueOnce(
        approvedSession({ id: 'u1', email: 'me@x.com' })
      );
      storesFindOne.mockResolvedValueOnce(null);
      const res = await routes.POST(
        makeReq(`http://localhost/api/stores/${VALID_ID}/invite`, { email: 'guest@x.com' }),
        { params: Promise.resolve({ id: VALID_ID }) } as any
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 when invited user not found', async () => {
      (getServerSession as any).mockResolvedValueOnce(
        approvedSession({ id: 'u1', email: 'me@x.com' })
      );
      storesFindOne.mockResolvedValueOnce({ _id: VALID_ID, userId: 'u1' });
      usersFindOne.mockResolvedValueOnce(null);
      const res = await routes.POST(
        makeReq(`http://localhost/api/stores/${VALID_ID}/invite`, { email: 'guest@x.com' }),
        { params: Promise.resolve({ id: VALID_ID }) } as any
      );
      expect(res.status).toBe(404);
    });

    it('creates invitation on success (201)', async () => {
      (getServerSession as any).mockResolvedValueOnce(
        approvedSession({ id: 'u1', email: 'me@x.com' })
      );
      storesFindOne.mockResolvedValueOnce({ _id: VALID_ID, userId: 'u1' });
      usersFindOne.mockResolvedValueOnce({ _id: { toString: () => 'u2' }, email: 'guest@x.com' });
      storesUpdateOne.mockResolvedValue({ matchedCount: 1 });
      const res = await routes.POST(
        makeReq(`http://localhost/api/stores/${VALID_ID}/invite`, { email: 'guest@x.com' }),
        { params: Promise.resolve({ id: VALID_ID }) } as any
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.invitation.userId).toBe('u2');
      expect(json.invitation.status).toBe('pending');
    });

    it('returns 500 when DB throws', async () => {
      (getServerSession as any).mockResolvedValueOnce(
        approvedSession({ id: 'u1', email: 'me@x.com' })
      );
      storesFindOne.mockRejectedValueOnce(new Error('db down'));
      const res = await routes.POST(
        makeReq(`http://localhost/api/stores/${VALID_ID}/invite`, { email: 'guest@x.com' }),
        { params: Promise.resolve({ id: VALID_ID }) } as any
      );
      expect(res.status).toBe(500);
    });
  });
});
