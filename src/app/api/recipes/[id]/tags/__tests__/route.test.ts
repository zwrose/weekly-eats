import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next-auth session
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

// Mock authOptions
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Mock MongoDB
const findOneMock = vi.fn();
const updateOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'recipes') {
          return {
            findOne: findOneMock,
          };
        }
        if (name === 'recipeUserData') {
          return {
            updateOne: updateOneMock,
          };
        }
        return {};
      },
    }),
  })),
}));

// Mock errors
vi.mock('@/lib/errors', () => ({
  AUTH_ERRORS: {
    UNAUTHORIZED: 'Unauthorized',
  },
  RECIPE_ERRORS: {
    INVALID_RECIPE_ID: 'Invalid recipe ID',
    RECIPE_NOT_FOUND: 'Recipe not found',
  },
  API_ERRORS: {
    INTERNAL_SERVER_ERROR: 'Internal server error',
  },
  logError: vi.fn(),
}));

// Convenient access to mocked imports
const { getServerSession } = await import('next-auth/next');
const { ObjectId } = await import('mongodb');

// Import the route module after mocks are set up
const routes = await import('../route');

const makeRequest = (recipeId: string, body?: unknown) => ({
  json: async () => body,
}) as any;

const makeParams = (id: string) => ({
  params: Promise.resolve({ id }),
});

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  updateOneMock.mockReset();
});

describe('api/recipes/[id]/tags route', () => {
  const validRecipeId = new ObjectId().toString();
  const mockRecipe = {
    _id: ObjectId.createFromHexString(validRecipeId),
    title: 'Test Recipe',
    isGlobal: true,
  };

  it('POST returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.POST(makeRequest(validRecipeId, { tags: [] }), makeParams(validRecipeId));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('POST returns 400 for invalid recipe ID', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    const res = await routes.POST(makeRequest('invalid-id', { tags: [] }), makeParams('invalid-id'));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid recipe ID');
  });

  it('POST returns 400 when tags is not an array', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    findOneMock.mockResolvedValueOnce(mockRecipe);
    const res = await routes.POST(makeRequest(validRecipeId, { tags: 'not-an-array' }), makeParams(validRecipeId));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Tags must be an array');
  });

  it('POST returns 400 when tags contains non-string values', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    findOneMock.mockResolvedValueOnce(mockRecipe);
    const res = await routes.POST(makeRequest(validRecipeId, { tags: ['tag1', 123, 'tag2'] }), makeParams(validRecipeId));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('All tags must be strings');
  });

  it('POST returns 404 when recipe does not exist', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    findOneMock.mockResolvedValueOnce(null);
    const res = await routes.POST(makeRequest(validRecipeId, { tags: ['tag1'] }), makeParams(validRecipeId));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Recipe not found');
  });

  it('POST successfully updates tags', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    findOneMock.mockResolvedValueOnce(mockRecipe);
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });

    const tags = ['tag1', 'tag2', 'tag3'];
    const res = await routes.POST(makeRequest(validRecipeId, { tags }), makeParams(validRecipeId));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tags).toEqual(tags);

    expect(updateOneMock).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        recipeId: validRecipeId,
      },
      expect.objectContaining({
        $set: {
          tags: tags,
          updatedAt: expect.any(Date),
        },
        $setOnInsert: {
          userId: 'user-1',
          recipeId: validRecipeId,
          createdAt: expect.any(Date),
        },
      }),
      { upsert: true }
    );
  });

  it('POST trims and filters empty tags', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    findOneMock.mockResolvedValueOnce(mockRecipe);
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });

    const tags = ['tag1', '  ', 'tag2', '', '  tag3  '];
    const res = await routes.POST(makeRequest(validRecipeId, { tags }), makeParams(validRecipeId));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tags).toEqual(['tag1', 'tag2', 'tag3']);

    expect(updateOneMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: {
          tags: ['tag1', 'tag2', 'tag3'],
          updatedAt: expect.any(Date),
        },
      }),
      { upsert: true }
    );
  });

  it('POST allows access to global recipes', async () => {
    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-2' } });
    findOneMock.mockResolvedValueOnce(mockRecipe);
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });

    const res = await routes.POST(makeRequest(validRecipeId, { tags: ['tag1'] }), makeParams(validRecipeId));
    expect(res.status).toBe(200);

    expect(findOneMock).toHaveBeenCalledWith({
      _id: ObjectId.createFromHexString(validRecipeId),
      $or: [
        { isGlobal: true },
        { createdBy: 'user-2' },
      ],
    });
  });

  it('POST allows access to user-owned recipes', async () => {
    const userRecipe = {
      ...mockRecipe,
      isGlobal: false,
      createdBy: 'user-1',
    };

    (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    findOneMock.mockResolvedValueOnce(userRecipe);
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });

    const res = await routes.POST(makeRequest(validRecipeId, { tags: ['tag1'] }), makeParams(validRecipeId));
    expect(res.status).toBe(200);
  });
});

