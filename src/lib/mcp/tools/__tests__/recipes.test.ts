import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const searchRecipesMock = vi.fn();
const getRecipeMock = vi.fn();
const createRecipeMock = vi.fn();
const updateRecipeMock = vi.fn();

vi.mock('@/lib/services/recipes', () => ({
  searchRecipes: (...a: unknown[]) => searchRecipesMock(...a),
  getRecipe: (...a: unknown[]) => getRecipeMock(...a),
  createRecipe: (...a: unknown[]) => createRecipeMock(...a),
  updateRecipe: (...a: unknown[]) => updateRecipeMock(...a),
}));

const {
  recipesSearchInput,
  recipesGetInput,
  recipesCreateInput,
  recipesUpdateInput,
  recipesSearchHandler,
  recipesGetHandler,
  recipesCreateHandler,
  recipesUpdateHandler,
} = await import('@/lib/mcp/tools/recipes');

const extra = { authInfo: { extra: { userId: 'u1', isAdmin: false } } };

beforeEach(() => {
  searchRecipesMock.mockReset();
  getRecipeMock.mockReset();
  createRecipeMock.mockReset();
  updateRecipeMock.mockReset();
});

describe('recipes.search tool', () => {
  it('calls searchRecipes with the authed userId', async () => {
    searchRecipesMock.mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
    await recipesSearchHandler({ query: 'pizza' }, extra);
    const [userId, input] = searchRecipesMock.mock.calls[0];
    expect(userId).toBe('u1');
    expect(input.query).toBe('pizza');
    expect(input.pagination).toMatchObject({ page: 1, limit: 10 });
  });
});

describe('recipes.get tool', () => {
  it('passes the authed userId and id', async () => {
    getRecipeMock.mockResolvedValueOnce({ _id: 'r1', title: 'Pizza' });
    await recipesGetHandler({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }, extra);
    expect(getRecipeMock).toHaveBeenCalledWith('u1', '64b7f8c2a2b7c2f1a2b7c2f1');
  });

  it('maps a domain error to an isError result', async () => {
    const { NotFoundError } = await import('@/lib/service-errors');
    getRecipeMock.mockRejectedValueOnce(new NotFoundError('Recipe not found'));
    const res = await recipesGetHandler({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }, extra);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('Recipe not found');
  });
});

describe('recipes.create tool', () => {
  it('calls createRecipe with the authed userId and the recipe body', async () => {
    createRecipeMock.mockResolvedValueOnce({ _id: 'new', title: 'My Recipe' });
    const body = {
      title: 'My Recipe',
      instructions: 'Cook it',
      ingredients: [
        {
          ingredients: [{ type: 'foodItem' as const, id: 'f1', quantity: 1, unit: 'cup' }],
          isStandalone: true,
        },
      ],
    };
    await recipesCreateHandler(body, extra);
    const [userId, input] = createRecipeMock.mock.calls[0];
    expect(userId).toBe('u1');
    expect(input.title).toBe('My Recipe');
  });

  // Unlike food_items_create (which forces isGlobal:false), the recipe tool
  // DELIBERATELY forwards isGlobal: a user's own global recipe is the recipe-
  // sharing mechanism ("shared-by-you"), per spec §6.5 / key decisions. This
  // pins that intentional asymmetry so a future change that silently forces or
  // strips isGlobal on the recipe path is caught.
  it('forwards a caller-supplied isGlobal:true to createRecipe (recipe sharing is allowed)', async () => {
    createRecipeMock.mockResolvedValueOnce({ _id: 'new', title: 'Shared', isGlobal: true });
    const body = {
      title: 'Shared',
      instructions: 'Cook it',
      isGlobal: true,
      ingredients: [
        {
          ingredients: [{ type: 'foodItem' as const, id: 'f1', quantity: 1, unit: 'cup' }],
          isStandalone: true,
        },
      ],
    };
    await recipesCreateHandler(body, extra);
    const [, input] = createRecipeMock.mock.calls[0];
    expect(input.isGlobal).toBe(true);
  });
});

describe('recipes.update tool', () => {
  it('splits id from the patch and forwards both', async () => {
    updateRecipeMock.mockResolvedValueOnce({ _id: 'r1', title: 'New' });
    await recipesUpdateHandler({ id: '64b7f8c2a2b7c2f1a2b7c2f1', title: 'New' }, extra);
    expect(updateRecipeMock).toHaveBeenCalledWith('u1', '64b7f8c2a2b7c2f1a2b7c2f1', {
      title: 'New',
    });
  });
});

describe('input schemas', () => {
  it('recipes.get requires an id', () => {
    expect(z.object(recipesGetInput).safeParse({}).success).toBe(false);
  });
  it('recipes.create requires title/instructions/ingredients', () => {
    expect(z.object(recipesCreateInput).safeParse({ title: 'x' }).success).toBe(false);
  });
  it('recipes.update requires an id', () => {
    expect(z.object(recipesUpdateInput).safeParse({ title: 'x' }).success).toBe(false);
  });
  it('recipes.search accepts an empty object', () => {
    expect(z.object(recipesSearchInput).safeParse({}).success).toBe(true);
  });
});
