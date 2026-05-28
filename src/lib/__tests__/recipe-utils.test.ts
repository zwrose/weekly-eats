import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../vitest.setup';
import { fetchRecipes, fetchGlobalRecipes } from '../recipe-utils';

describe('fetchRecipes', () => {
  const recipes = [
    { _id: 'r1', name: 'Pasta' },
    { _id: 'r2', name: 'Soup' },
  ];

  it('normalizes a bare array response', async () => {
    server.use(
      http.get('/api/recipes', () => {
        return HttpResponse.json(recipes, { status: 200 });
      })
    );

    const result = await fetchRecipes();
    expect(result).toEqual(recipes);
  });

  it('normalizes a wrapped { data } response to the same array', async () => {
    server.use(
      http.get('/api/recipes', () => {
        return HttpResponse.json({ data: recipes }, { status: 200 });
      })
    );

    const result = await fetchRecipes();
    expect(result).toEqual(recipes);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get('/api/recipes', () => {
        return HttpResponse.json({ error: 'boom' }, { status: 500 });
      })
    );

    await expect(fetchRecipes()).rejects.toThrow('Failed to fetch recipes');
  });
});

describe('fetchGlobalRecipes', () => {
  const recipes = [{ _id: 'g1', name: 'Global Stew' }];

  it('does NOT carry excludeUserCreated when flag is unset', async () => {
    let seenUrl = '';
    server.use(
      http.get('/api/recipes', ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json(recipes, { status: 200 });
      })
    );

    const result = await fetchGlobalRecipes();
    expect(result).toEqual(recipes);
    const url = new URL(seenUrl);
    expect(url.searchParams.get('globalOnly')).toBe('true');
    expect(url.searchParams.has('excludeUserCreated')).toBe(false);
  });

  it('carries excludeUserCreated=true ONLY when the flag is set', async () => {
    let seenUrl = '';
    server.use(
      http.get('/api/recipes', ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json(recipes, { status: 200 });
      })
    );

    const result = await fetchGlobalRecipes(true);
    expect(result).toEqual(recipes);
    const url = new URL(seenUrl);
    expect(url.searchParams.get('globalOnly')).toBe('true');
    expect(url.searchParams.get('excludeUserCreated')).toBe('true');
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get('/api/recipes', () => {
        return HttpResponse.json({ error: 'boom' }, { status: 500 });
      })
    );

    await expect(fetchGlobalRecipes()).rejects.toThrow('Failed to fetch global recipes');
  });
});
