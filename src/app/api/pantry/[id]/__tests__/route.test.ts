import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const findOneMock = vi.fn();
const deleteOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({ findOne: findOneMock, deleteOne: deleteOneMock })
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('..//route');

const makeReq = (url: string) => ({ url }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  deleteOneMock.mockReset();
});

describe('api/pantry/[id] DELETE', () => {
  it('401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.DELETE(makeReq(`http://localhost/api/pantry/${id}`), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(401);
  });

  it('400 when invalid id', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    const res = await routes.DELETE(makeReq('http://localhost/api/pantry/bad'), { params: Promise.resolve({ id: 'bad' }) } as any);
    expect(res.status).toBe(400);
  });

  it('404 when item not found', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce(null);
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.DELETE(makeReq(`http://localhost/api/pantry/${id}`), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(404);
  });

  it('200 on delete success', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce({ _id: 'x', userId: 'u1' });
    deleteOneMock.mockResolvedValueOnce({ deletedCount: 1 });
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.DELETE(makeReq(`http://localhost/api/pantry/${id}`), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(200);
  });
});


