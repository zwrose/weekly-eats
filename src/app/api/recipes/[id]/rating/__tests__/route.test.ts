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

describe('api/recipes/[id]/rating route', () => {
  const validRecipeId = new ObjectId().toString();
  const mockRecipe = {
    _id: ObjectId.createFromHexString(validRecipeId),
    title: 'Test Recipe',
    isGlobal: true,
  };

  describe('POST', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.POST(makeRequest(validRecipeId, { rating: 5 }), makeParams(validRecipeId));
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 for invalid recipe ID', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
      const res = await routes.POST(makeRequest('invalid-id', { rating: 5 }), makeParams('invalid-id'));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid recipe ID');
    });

    it('returns 400 when rating is not a number', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
      findOneMock.mockResolvedValueOnce(mockRecipe);
      const res = await routes.POST(makeRequest(validRecipeId, { rating: '5' }), makeParams(validRecipeId));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Rating must be an integer between 1 and 5');
    });

    it('returns 400 when rating is less than 1', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
      findOneMock.mockResolvedValueOnce(mockRecipe);
      const res = await routes.POST(makeRequest(validRecipeId, { rating: 0 }), makeParams(validRecipeId));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Rating must be an integer between 1 and 5');
    });

    it('returns 400 when rating is greater than 5', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
      findOneMock.mockResolvedValueOnce(mockRecipe);
      const res = await routes.POST(makeRequest(validRecipeId, { rating: 6 }), makeParams(validRecipeId));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Rating must be an integer between 1 and 5');
    });

    it('returns 400 when rating is not an integer', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
      findOneMock.mockResolvedValueOnce(mockRecipe);
      const res = await routes.POST(makeRequest(validRecipeId, { rating: 3.5 }), makeParams(validRecipeId));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Rating must be an integer between 1 and 5');
    });

    it('returns 404 when recipe does not exist', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
      findOneMock.mockResolvedValueOnce(null);
      const res = await routes.POST(makeRequest(validRecipeId, { rating: 5 }), makeParams(validRecipeId));
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Recipe not found');
    });

    it('successfully updates rating', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
      findOneMock.mockResolvedValueOnce(mockRecipe);
      updateOneMock.mockResolvedValueOnce({ acknowledged: true });

      const rating = 5;
      const res = await routes.POST(makeRequest(validRecipeId, { rating }), makeParams(validRecipeId));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rating).toBe(rating);

      expect(updateOneMock).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          recipeId: validRecipeId,
        },
        expect.objectContaining({
          $set: {
            rating: rating,
            updatedAt: expect.any(Date),
          },
          $setOnInsert: {
            userId: 'user-1',
            recipeId: validRecipeId,
            tags: [],
            createdAt: expect.any(Date),
          },
        }),
        { upsert: true }
      );
    });

    it('accepts valid rating 1', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
      findOneMock.mockResolvedValueOnce(mockRecipe);
      updateOneMock.mockResolvedValueOnce({ acknowledged: true });

      const res = await routes.POST(makeRequest(validRecipeId, { rating: 1 }), makeParams(validRecipeId));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rating).toBe(1);
    });

    it('accepts valid rating 5', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
      findOneMock.mockResolvedValueOnce(mockRecipe);
      updateOneMock.mockResolvedValueOnce({ acknowledged: true });

      const res = await routes.POST(makeRequest(validRecipeId, { rating: 5 }), makeParams(validRecipeId));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rating).toBe(5);
    });
  });

  describe('DELETE', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as any).mockResolvedValueOnce(null);
      const res = await routes.DELETE(makeRequest(validRecipeId), makeParams(validRecipeId));
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 for invalid recipe ID', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
      const res = await routes.DELETE(makeRequest('invalid-id'), makeParams('invalid-id'));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid recipe ID');
    });

    it('returns 404 when rating does not exist', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
      updateOneMock.mockResolvedValueOnce({ matchedCount: 0 });
      const res = await routes.DELETE(makeRequest(validRecipeId), makeParams(validRecipeId));
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Rating not found');
    });

    it('successfully deletes rating', async () => {
      (getServerSession as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
      updateOneMock.mockResolvedValueOnce({ matchedCount: 1 });

      const res = await routes.DELETE(makeRequest(validRecipeId), makeParams(validRecipeId));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Rating removed successfully');

      expect(updateOneMock).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          recipeId: validRecipeId,
        },
        {
          $unset: { rating: '' },
          $set: { updatedAt: expect.any(Date) },
        }
      );
    });
  });
});

