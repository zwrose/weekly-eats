import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

const toArrayMock = vi.fn();
const countDocumentsMock = vi.fn();
const insertOneMock = vi.fn();
const findMock = vi.fn();
const sortMock = vi.fn();
const skipMock = vi.fn();
const limitMock = vi.fn();

// Wire up chainable API: find -> sort -> skip -> limit -> toArray
function resetChain() {
  limitMock.mockReturnValue({ toArray: toArrayMock });
  skipMock.mockReturnValue({ limit: limitMock });
  sortMock.mockReturnValue({ skip: skipMock });
  findMock.mockReturnValue({ sort: sortMock });
}

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
        find: (...args: unknown[]) => {
          findMock(...args);
          return { sort: (...sArgs: unknown[]) => {
            sortMock(...sArgs);
            return { skip: (...skArgs: unknown[]) => {
              skipMock(...skArgs);
              return { limit: (...lArgs: unknown[]) => {
                limitMock(...lArgs);
                return { toArray: toArrayMock };
              }};
            }};
          }};
        },
        countDocuments: countDocumentsMock,
        insertOne: insertOneMock,
      }),
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const makeReq = (url: string, body?: unknown) =>
  ({ url, json: async () => body }) as any;

const mockSession = { user: { id: 'user1', isAdmin: false, isApproved: true } };

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findMock.mockReset();
  sortMock.mockReset();
  skipMock.mockReset();
  limitMock.mockReset();
  toArrayMock.mockReset();
  countDocumentsMock.mockReset();
  insertOneMock.mockReset();
  resetChain();
});

describe('GET /api/recipes', () => {
  it('returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET(makeReq('http://localhost/api/recipes'));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns paginated response with defaults', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    const recipes = [
      { _id: 'r1', title: 'Pizza', createdBy: 'user1', isGlobal: false },
      { _id: 'r2', title: 'Pasta', createdBy: 'other', isGlobal: true },
    ];
    toArrayMock.mockResolvedValue(recipes);
    countDocumentsMock.mockResolvedValue(2);

    const res = await routes.GET(makeReq('http://localhost/api/recipes'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.total).toBe(2);
    expect(json.page).toBe(1);
    expect(json.limit).toBe(25);
    expect(json.totalPages).toBe(1);
    expect(json.data).toHaveLength(2);
  });

  it('computes accessLevel for each recipe', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    const recipes = [
      { _id: 'r1', title: 'Personal', createdBy: 'user1', isGlobal: false },
      { _id: 'r2', title: 'Shared', createdBy: 'user1', isGlobal: true },
      { _id: 'r3', title: 'Global', createdBy: 'other', isGlobal: true },
    ];
    toArrayMock.mockResolvedValue(recipes);
    countDocumentsMock.mockResolvedValue(3);

    const res = await routes.GET(makeReq('http://localhost/api/recipes'));
    const json = await res.json();

    expect(json.data[0].accessLevel).toBe('personal');
    expect(json.data[1].accessLevel).toBe('shared-by-you');
    expect(json.data[2].accessLevel).toBe('global');
  });

  it('accepts page and limit params', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    toArrayMock.mockResolvedValue([]);
    countDocumentsMock.mockResolvedValue(50);

    const res = await routes.GET(
      makeReq('http://localhost/api/recipes?page=2&limit=10')
    );
    const json = await res.json();

    expect(json.page).toBe(2);
    expect(json.limit).toBe(10);
    expect(skipMock).toHaveBeenCalledWith(10); // (2-1) * 10
    expect(limitMock).toHaveBeenCalledWith(10);
  });

  it('accepts sortBy and sortOrder params', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    toArrayMock.mockResolvedValue([]);
    countDocumentsMock.mockResolvedValue(0);

    await routes.GET(
      makeReq('http://localhost/api/recipes?sortBy=title&sortOrder=asc')
    );

    expect(sortMock).toHaveBeenCalledWith({ title: 1 });
  });

  it('filters by text query', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    toArrayMock.mockResolvedValue([]);
    countDocumentsMock.mockResolvedValue(0);

    await routes.GET(makeReq('http://localhost/api/recipes?query=pizza'));

    const filter = findMock.mock.calls[0][0];
    const filterStr = JSON.stringify(filter);
    expect(filterStr).toContain('pizza');
  });

  it('filters by accessLevel=personal', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    toArrayMock.mockResolvedValue([]);
    countDocumentsMock.mockResolvedValue(0);

    await routes.GET(
      makeReq('http://localhost/api/recipes?accessLevel=personal')
    );

    const filter = findMock.mock.calls[0][0];
    const filterStr = JSON.stringify(filter);
    // personal = createdBy user, not global
    expect(filterStr).toContain('user1');
    expect(filterStr).toContain('false');
  });

  it('filters by accessLevel=shared-by-you', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    toArrayMock.mockResolvedValue([]);
    countDocumentsMock.mockResolvedValue(0);

    await routes.GET(
      makeReq('http://localhost/api/recipes?accessLevel=shared-by-you')
    );

    const filter = findMock.mock.calls[0][0];
    const filterStr = JSON.stringify(filter);
    // shared-by-you = createdBy user, isGlobal true
    expect(filterStr).toContain('user1');
    expect(filterStr).toContain('true');
  });

  it('filters by accessLevel=global', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    toArrayMock.mockResolvedValue([]);
    countDocumentsMock.mockResolvedValue(0);

    await routes.GET(
      makeReq('http://localhost/api/recipes?accessLevel=global')
    );

    const filter = findMock.mock.calls[0][0];
    const filterStr = JSON.stringify(filter);
    // global = isGlobal true, not created by user
    expect(filterStr).toContain('"$ne"');
  });

  it('returns unified view (all accessible recipes) when no accessLevel', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    toArrayMock.mockResolvedValue([]);
    countDocumentsMock.mockResolvedValue(0);

    await routes.GET(makeReq('http://localhost/api/recipes'));

    const filter = findMock.mock.calls[0][0];
    expect(filter.$or).toBeDefined();
    expect(filter.$or).toContainEqual({ isGlobal: true });
    expect(filter.$or).toContainEqual({ createdBy: 'user1' });
  });

  it('handles server errors', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    findMock.mockImplementation(() => {
      throw new Error('DB error');
    });

    const res = await routes.GET(makeReq('http://localhost/api/recipes'));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/recipes', () => {
  it('returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.POST(makeReq('http://localhost/api/recipes', {}));
    expect(res.status).toBe(401);
  });

  it('validates required fields', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    const body = { title: '', instructions: '', ingredients: [] };
    const res = await routes.POST(makeReq('http://localhost/api/recipes', body));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('inserts new recipe and returns 201', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    insertOneMock.mockResolvedValueOnce({ insertedId: 'new-id' });
    const valid = {
      title: 'My Recipe',
      emoji: '🍲',
      instructions: 'Cook it',
      isGlobal: false,
      ingredients: [
        {
          title: 'Group A',
          ingredients: [{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup' }],
        },
      ],
    };
    const res = await routes.POST(makeReq('http://localhost/api/recipes', valid));
    expect(insertOneMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json._id).toBe('new-id');
    expect(json.createdBy).toBe('user1');
  });
});
