import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedSession, unapprovedSession } from '@/test-utils/session';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));

const findOneMock = vi.fn();
const deleteOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({ findOne: findOneMock, deleteOne: deleteOneMock }),
    }),
  })),
}));

const { auth } = await import('@/lib/auth');
const routes = await import('..//route');

const makeReq = (url: string) => ({ url }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (auth as any).mockReset();
  findOneMock.mockReset();
  deleteOneMock.mockReset();
});

describe('api/pantry/[id] DELETE', () => {
  it('401 when unauthenticated', async () => {
    (auth as any).mockResolvedValueOnce(null);
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.DELETE(makeReq(`http://localhost/api/pantry/${id}`), {
      params: Promise.resolve({ id }),
    } as any);
    expect(res.status).toBe(401);
  });

  it('403 when user is not approved', async () => {
    (auth as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.DELETE(makeReq(`http://localhost/api/pantry/${id}`), {
      params: Promise.resolve({ id }),
    } as any);
    expect(res.status).toBe(403);
  });

  it('400 when invalid id', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    const res = await routes.DELETE(makeReq('http://localhost/api/pantry/bad'), {
      params: Promise.resolve({ id: 'bad' }),
    } as any);
    expect(res.status).toBe(400);
  });

  it('404 when item not found', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    findOneMock.mockResolvedValueOnce(null);
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.DELETE(makeReq(`http://localhost/api/pantry/${id}`), {
      params: Promise.resolve({ id }),
    } as any);
    expect(res.status).toBe(404);
  });

  it('200 on delete success', async () => {
    (auth as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
    findOneMock.mockResolvedValueOnce({ _id: 'x', userId: 'u1' });
    deleteOneMock.mockResolvedValueOnce({ deletedCount: 1 });
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.DELETE(makeReq(`http://localhost/api/pantry/${id}`), {
      params: Promise.resolve({ id }),
    } as any);
    expect(res.status).toBe(200);
  });
});
