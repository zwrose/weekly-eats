import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const findOneMock = vi.fn();
const updateOneMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'users') {
          return {
            findOne: findOneMock,
            updateOne: updateOneMock,
            updateMany: updateManyMock,
          };
        }
        return {
          findOne: findOneMock,
          updateOne: updateOneMock,
          updateMany: updateManyMock,
        };
      },
    }),
  })),
}));

const { auth } = await import('@/lib/auth');
const routes = await import('../route');

const SELF_ID = '64b7f8c2a2b7c2f1a2b7c2f1';
const OTHER_ID = '64b7f8c2a2b7c2f1a2b7c2f9';

const makeReq = (body?: unknown) => ({ url: 'http://localhost', json: async () => body }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (auth as any).mockReset();
  findOneMock.mockReset();
  updateOneMock.mockReset();
  updateManyMock.mockReset();
});

describe('api/user/recipe-sharing/invitations/[userId] route', () => {
  describe('PUT (accept/reject invitation)', () => {
    it('returns 401 when unauthenticated', async () => {
      (auth as any).mockResolvedValueOnce(null);
      const res = await routes.PUT(makeReq({ action: 'accept' }), {
        params: Promise.resolve({ userId: SELF_ID }),
      } as any);
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not approved', async () => {
      (auth as any).mockResolvedValueOnce(unapprovedSession({ id: SELF_ID }));
      const res = await routes.PUT(makeReq({ action: 'accept' }), {
        params: Promise.resolve({ userId: SELF_ID }),
      } as any);
      expect(res.status).toBe(403);
    });

    it('returns 400 for an invalid action', async () => {
      (auth as any).mockResolvedValueOnce(approvedSession({ id: SELF_ID }));
      const res = await routes.PUT(makeReq({ action: 'maybe' }), {
        params: Promise.resolve({ userId: SELF_ID }),
      } as any);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid action');
    });

    it('returns 403 when acting on an invitation that is not yours', async () => {
      (auth as any).mockResolvedValueOnce(approvedSession({ id: SELF_ID }));
      const res = await routes.PUT(makeReq({ action: 'accept' }), {
        params: Promise.resolve({ userId: OTHER_ID }),
      } as any);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Not authorized to perform this action');
    });

    it('returns 404 when no pending invitation exists', async () => {
      (auth as any).mockResolvedValueOnce(approvedSession({ id: SELF_ID }));
      findOneMock.mockResolvedValueOnce(null);
      const res = await routes.PUT(makeReq({ action: 'accept' }), {
        params: Promise.resolve({ userId: SELF_ID }),
      } as any);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Invitation not found');
    });

    it('accepts an invitation and sets status to accepted', async () => {
      (auth as any).mockResolvedValueOnce(approvedSession({ id: SELF_ID }));
      findOneMock.mockResolvedValueOnce({ _id: 'owner-1' });
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const res = await routes.PUT(makeReq({ action: 'accept' }), {
        params: Promise.resolve({ userId: SELF_ID }),
      } as any);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      const setArg = updateOneMock.mock.calls[0][1].$set;
      expect(setArg['settings.recipeSharing.invitations.$.status']).toBe('accepted');
    });

    it('rejects an invitation and sets status to rejected', async () => {
      (auth as any).mockResolvedValueOnce(approvedSession({ id: SELF_ID }));
      findOneMock.mockResolvedValueOnce({ _id: 'owner-1' });
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const res = await routes.PUT(makeReq({ action: 'reject' }), {
        params: Promise.resolve({ userId: SELF_ID }),
      } as any);
      expect(res.status).toBe(200);

      const setArg = updateOneMock.mock.calls[0][1].$set;
      expect(setArg['settings.recipeSharing.invitations.$.status']).toBe('rejected');
    });

    it('returns 500 when the DB throws', async () => {
      (auth as any).mockResolvedValueOnce(approvedSession({ id: SELF_ID }));
      findOneMock.mockRejectedValueOnce(new Error('db boom'));
      const res = await routes.PUT(makeReq({ action: 'accept' }), {
        params: Promise.resolve({ userId: SELF_ID }),
      } as any);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Internal server error');
    });
  });

  describe('DELETE (remove user / leave sharing)', () => {
    it('returns 401 when unauthenticated', async () => {
      (auth as any).mockResolvedValueOnce(null);
      const res = await routes.DELETE(makeReq(), {
        params: Promise.resolve({ userId: SELF_ID }),
      } as any);
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not approved', async () => {
      (auth as any).mockResolvedValueOnce(
        unapprovedSession({ id: SELF_ID, email: 'me@example.com' })
      );
      const res = await routes.DELETE(makeReq(), {
        params: Promise.resolve({ userId: SELF_ID }),
      } as any);
      expect(res.status).toBe(403);
    });

    it('returns 403 when not the owner and not the invited user', async () => {
      (auth as any).mockResolvedValueOnce(
        approvedSession({ id: SELF_ID, email: 'me@example.com' })
      );
      // Not an owner of any invitation for OTHER_ID
      findOneMock.mockResolvedValueOnce(null);
      const res = await routes.DELETE(makeReq(), {
        params: Promise.resolve({ userId: OTHER_ID }),
      } as any);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Not authorized to perform this action');
    });

    it('owner removes a shared user via $pull on their own doc', async () => {
      (auth as any).mockResolvedValueOnce(
        approvedSession({ id: SELF_ID, email: 'owner@example.com' })
      );
      // Current user is the owner of an invitation for OTHER_ID
      findOneMock.mockResolvedValueOnce({ _id: 'owner-doc', email: 'owner@example.com' });
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const res = await routes.DELETE(makeReq(), {
        params: Promise.resolve({ userId: OTHER_ID }),
      } as any);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      // Owner path uses updateOne keyed by their own email
      expect(updateOneMock.mock.calls[0][0]).toEqual({ email: 'owner@example.com' });
      expect(updateManyMock).not.toHaveBeenCalled();
    });

    it('user leaves sharing via $pull across all owners (updateMany)', async () => {
      (auth as any).mockResolvedValueOnce(
        approvedSession({ id: SELF_ID, email: 'me@example.com' })
      );
      // Not an owner, but self (userId === session.user.id)
      findOneMock.mockResolvedValueOnce(null);
      updateManyMock.mockResolvedValueOnce({ matchedCount: 2, modifiedCount: 2 });

      const res = await routes.DELETE(makeReq(), {
        params: Promise.resolve({ userId: SELF_ID }),
      } as any);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(updateManyMock).toHaveBeenCalledTimes(1);
      expect(updateOneMock).not.toHaveBeenCalled();
    });

    it('returns 500 when the DB throws', async () => {
      (auth as any).mockResolvedValueOnce(
        approvedSession({ id: SELF_ID, email: 'me@example.com' })
      );
      findOneMock.mockRejectedValueOnce(new Error('db boom'));
      const res = await routes.DELETE(makeReq(), {
        params: Promise.resolve({ userId: SELF_ID }),
      } as any);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Internal server error');
    });
  });
});
