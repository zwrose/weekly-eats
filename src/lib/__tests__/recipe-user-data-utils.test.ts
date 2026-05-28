import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../vitest.setup';

const {
  fetchRecipeUserData,
  fetchRecipeUserDataBatch,
  updateRecipeTags,
  updateRecipeRating,
  deleteRecipeRating,
  fetchUserTags,
} = await import('../recipe-user-data-utils');

describe('fetchRecipeUserData', () => {
  it('returns the parsed user data', async () => {
    const mockData = { tags: ['quick', 'vegan'], rating: 4 };
    server.use(
      http.get('/api/recipes/:recipeId/user-data', () => {
        return HttpResponse.json(mockData, { status: 200 });
      })
    );

    const result = await fetchRecipeUserData('recipe1');
    expect(result).toEqual(mockData);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get('/api/recipes/:recipeId/user-data', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(fetchRecipeUserData('recipe1')).rejects.toThrow(
      'Failed to fetch recipe user data'
    );
  });
});

describe('fetchRecipeUserDataBatch', () => {
  it('resolves to an empty Map and fires NO request for empty input', async () => {
    const handler = vi.fn(() => HttpResponse.json({ data: {} }, { status: 200 }));
    server.use(http.post('/api/recipes/user-data/batch', handler));

    const result = await fetchRecipeUserDataBatch([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('builds a Map from the response data', async () => {
    const responseData = {
      r1: { tags: ['a'], rating: 5 },
      r2: { tags: [], rating: null },
    };
    server.use(
      http.post('/api/recipes/user-data/batch', () => {
        return HttpResponse.json({ data: responseData }, { status: 200 });
      })
    );

    const result = await fetchRecipeUserDataBatch(['r1', 'r2']);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.get('r1')).toEqual({ tags: ['a'], rating: 5 });
    expect(result.get('r2')).toEqual({ tags: [], rating: null });
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.post('/api/recipes/user-data/batch', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(fetchRecipeUserDataBatch(['r1'])).rejects.toThrow(
      'Failed to fetch recipe user data batch'
    );
  });
});

describe('updateRecipeTags', () => {
  it('returns the updated tags', async () => {
    const mockResponse = { tags: ['quick', 'easy'] };
    server.use(
      http.post('/api/recipes/:recipeId/tags', () => {
        return HttpResponse.json(mockResponse, { status: 200 });
      })
    );

    const result = await updateRecipeTags('recipe1', ['quick', 'easy']);
    expect(result).toEqual(mockResponse);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.post('/api/recipes/:recipeId/tags', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(updateRecipeTags('recipe1', ['quick'])).rejects.toThrow(
      'Failed to update recipe tags'
    );
  });
});

describe('updateRecipeRating', () => {
  it('returns the updated rating', async () => {
    const mockResponse = { rating: 5 };
    server.use(
      http.post('/api/recipes/:recipeId/rating', () => {
        return HttpResponse.json(mockResponse, { status: 200 });
      })
    );

    const result = await updateRecipeRating('recipe1', 5);
    expect(result).toEqual(mockResponse);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.post('/api/recipes/:recipeId/rating', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(updateRecipeRating('recipe1', 5)).rejects.toThrow(
      'Failed to update recipe rating'
    );
  });
});

describe('deleteRecipeRating', () => {
  it('resolves on ok response', async () => {
    server.use(
      http.delete('/api/recipes/:recipeId/rating', () => {
        return HttpResponse.json({ success: true }, { status: 200 });
      })
    );

    await expect(deleteRecipeRating('recipe1')).resolves.toBeUndefined();
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.delete('/api/recipes/:recipeId/rating', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(deleteRecipeRating('recipe1')).rejects.toThrow('Failed to delete recipe rating');
  });
});

describe('fetchUserTags', () => {
  it('returns the parsed tags list', async () => {
    server.use(
      http.get('/api/recipes/tags', () => {
        return HttpResponse.json({ tags: ['vegan', 'quick'] }, { status: 200 });
      })
    );

    const result = await fetchUserTags();
    expect(result).toEqual(['vegan', 'quick']);
  });

  it('returns [] when response omits tags', async () => {
    server.use(
      http.get('/api/recipes/tags', () => {
        return HttpResponse.json({}, { status: 200 });
      })
    );

    const result = await fetchUserTags();
    expect(result).toEqual([]);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get('/api/recipes/tags', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(fetchUserTags()).rejects.toThrow('Failed to fetch user tags');
  });
});
