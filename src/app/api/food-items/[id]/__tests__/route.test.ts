import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must match specifiers used in the route under test
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

const findOneMock = vi.fn();
const updateOneMock = vi.fn();
const deleteOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
        findOne: findOneMock,
        updateOne: updateOneMock,
        deleteOne: deleteOneMock,
      }),
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('..//route');

const makeReq = (url: string, body?: unknown) => ({ url, json: async () => body }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  updateOneMock.mockReset();
  deleteOneMock.mockReset();
});

describe('api/food-items/[id] route', () => {
  it('PUT 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.PUT(makeReq(`http://localhost/api/food-items/${id}`, { name: 'A' }), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(401);
  });

  it('PUT 400 when name missing', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.PUT(makeReq(`http://localhost/api/food-items/${id}`, { name: '' }), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(400);
  });

  it('PUT 404 when item not found', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce(null);
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.PUT(makeReq(`http://localhost/api/food-items/${id}`, { name: 'New' }), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(404);
  });

  it('PUT 403 when user neither admin nor owner', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u2', isAdmin: false } });
    findOneMock.mockResolvedValueOnce({ _id: 'x', createdBy: 'u1', isGlobal: false });
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.PUT(makeReq(`http://localhost/api/food-items/${id}`, { name: 'New' }), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(403);
  });

  it('PUT succeeds for owner and returns updated item', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1', isAdmin: false } });
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    findOneMock.mockResolvedValueOnce({ _id: id, createdBy: 'u1', isGlobal: false });
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1 });
    // findOne called again to fetch updated item
    findOneMock.mockResolvedValueOnce({ _id: id, name: 'Updated', isGlobal: false, createdBy: 'u1' });
    const res = await routes.PUT(makeReq(`http://localhost/api/food-items/${id}`, { name: 'Updated' }), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('Updated');
  });

  it('DELETE 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.DELETE(makeReq(`http://localhost/api/food-items/${id}`), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(401);
  });

  it('DELETE 404 when not found', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce(null);
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.DELETE(makeReq(`http://localhost/api/food-items/${id}`), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(404);
  });

  it('DELETE 403 when non-admin tries to delete global item', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1', isAdmin: false } });
    findOneMock.mockResolvedValueOnce({ _id: 'x', createdBy: 'u1', isGlobal: true });
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.DELETE(makeReq(`http://localhost/api/food-items/${id}`), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(403);
  });

  it('DELETE succeeds for owner personal item', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1', isAdmin: false } });
    findOneMock.mockResolvedValueOnce({ _id: 'x', createdBy: 'u1', isGlobal: false });
    deleteOneMock.mockResolvedValueOnce({ deletedCount: 1 });
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.DELETE(makeReq(`http://localhost/api/food-items/${id}`), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(200);
  });
});


