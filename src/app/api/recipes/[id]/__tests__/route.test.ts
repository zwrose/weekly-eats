import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// Mock next-auth session
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

// Mock authOptions
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/mongodb-adapter', () => ({
  default: Promise.resolve({}),
}));

// Mock Mongo client
const findOneMock = vi.fn();
const updateOneMock = vi.fn();
const deleteOneMock = vi.fn();
const foodItemsFindMock = vi.fn();
const recipesFindMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'foodItems') {
          return {
            find: foodItemsFindMock,
          };
        }
        return {
          findOne: findOneMock,
          updateOne: updateOneMock,
          deleteOne: deleteOneMock,
          find: recipesFindMock,
        };
      },
    }),
  })),
}));

const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

const makeRequest = (url: string, init: { method?: string; body?: unknown } = {}) => ({
  url,
  json: async () => init.body,
}) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  updateOneMock.mockReset();
  deleteOneMock.mockReset();
  foodItemsFindMock.mockReset();
  recipesFindMock.mockReset();

  // Default: no related food items or recipes to resolve
  foodItemsFindMock.mockReturnValue({ toArray: () => Promise.resolve([]) });
  recipesFindMock.mockReturnValue({ toArray: () => Promise.resolve([]) });
});

describe('api/recipes/[id] route', () => {
  it('GET 400 for invalid ObjectId', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    const res = await routes.GET(makeRequest('http://localhost/api/recipes/bad'), { params: Promise.resolve({ id: 'bad' }) } as any);
    expect(res.status).toBe(400);
  });

  it('GET 404 when not found', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    findOneMock.mockResolvedValueOnce(null);
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.GET(makeRequest(`http://localhost/api/recipes/${id}`), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(404);
  });

  it('PUT validates ingredient lists and returns updated recipe', async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: 'u1' } });
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    // Existing recipe belongs to u1
    findOneMock.mockResolvedValueOnce({ _id: id, createdBy: 'u1' });
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1 });
    // Second findOne returns the updated recipe
    findOneMock.mockResolvedValueOnce({ _id: id, createdBy: 'u1', title: 'Update' });
    const body = { title: 'Update', ingredients: [{ title: 'G', ingredients: [{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup' }] }] };
    const req = { url: `http://localhost/api/recipes/${id}`, json: async () => body } as any;
    const res = await routes.PUT(req, { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe('Update');
  });

  it('GET resolves ingredient names from food items and recipes', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const foodItemId = '64b7f8c2a2b7c2f1a2b7c2f2';
    const subRecipeId = '64b7f8c2a2b7c2f1a2b7c2f3';

    findOneMock.mockResolvedValueOnce({
      _id: id,
      title: 'Test Recipe',
      createdBy: 'u1',
      isGlobal: false,
      ingredients: [{
        title: '',
        isStandalone: true,
        ingredients: [
          { type: 'foodItem', id: foodItemId, quantity: 2, unit: 'cup' },
          { type: 'recipe', id: subRecipeId, quantity: 1 },
        ],
      }],
    });

    const { ObjectId } = await import('mongodb');
    foodItemsFindMock.mockReturnValueOnce({
      toArray: () => Promise.resolve([
        { _id: ObjectId.createFromHexString(foodItemId), singularName: 'Tomato', pluralName: 'Tomatoes' },
      ]),
    });
    recipesFindMock.mockReturnValueOnce({
      toArray: () => Promise.resolve([
        { _id: ObjectId.createFromHexString(subRecipeId), title: 'Tomato Sauce' },
      ]),
    });

    const res = await routes.GET(
      makeRequest(`http://localhost/api/recipes/${id}`),
      { params: Promise.resolve({ id }) } as any
    );
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ingredients[0].ingredients[0].name).toBe('Tomatoes');
    expect(json.ingredients[0].ingredients[1].name).toBe('Tomato Sauce');
  });

  it('GET uses singular name when quantity is 1', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const foodItemId = '64b7f8c2a2b7c2f1a2b7c2f2';

    findOneMock.mockResolvedValueOnce({
      _id: id,
      title: 'Test Recipe',
      createdBy: 'u1',
      isGlobal: false,
      ingredients: [{
        title: '',
        isStandalone: true,
        ingredients: [
          { type: 'foodItem', id: foodItemId, quantity: 1, unit: 'each' },
        ],
      }],
    });

    const { ObjectId } = await import('mongodb');
    foodItemsFindMock.mockReturnValueOnce({
      toArray: () => Promise.resolve([
        { _id: ObjectId.createFromHexString(foodItemId), singularName: 'Tomato', pluralName: 'Tomatoes' },
      ]),
    });

    const res = await routes.GET(
      makeRequest(`http://localhost/api/recipes/${id}`),
      { params: Promise.resolve({ id }) } as any
    );
    const json = await res.json();

    expect(json.ingredients[0].ingredients[0].name).toBe('Tomato');
  });

  it('DELETE 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const id = '64b7f8c2a2b7c2f1a2b7c2f1';
    const res = await routes.DELETE(makeRequest(`http://localhost/api/recipes/${id}`), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(401);
  });
});


