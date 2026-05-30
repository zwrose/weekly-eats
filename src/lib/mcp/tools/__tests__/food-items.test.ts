import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const searchFoodItemsMock = vi.fn();
const getFoodItemMock = vi.fn();
const createFoodItemMock = vi.fn();

vi.mock('@/lib/services/food-items', () => ({
  searchFoodItems: (...a: unknown[]) => searchFoodItemsMock(...a),
  getFoodItem: (...a: unknown[]) => getFoodItemMock(...a),
  createFoodItem: (...a: unknown[]) => createFoodItemMock(...a),
}));

const {
  foodItemsSearchInput,
  foodItemsGetInput,
  foodItemsCreateInput,
  foodItemsSearchHandler,
  foodItemsGetHandler,
  foodItemsCreateHandler,
} = await import('@/lib/mcp/tools/food-items');

const extra = { authInfo: { extra: { userId: 'u1', isAdmin: false } } };

beforeEach(() => {
  searchFoodItemsMock.mockReset();
  getFoodItemMock.mockReset();
  createFoodItemMock.mockReset();
});

describe('food_items.search tool', () => {
  it('calls searchFoodItems with the authed userId and parsed pagination', async () => {
    searchFoodItemsMock.mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
    const res = await foodItemsSearchHandler({ query: 'flour', page: 2, limit: 5 }, extra);
    expect(searchFoodItemsMock).toHaveBeenCalledTimes(1);
    const [userId, input] = searchFoodItemsMock.mock.calls[0];
    expect(userId).toBe('u1');
    expect(input.query).toBe('flour');
    expect(input.pagination).toMatchObject({ page: 2, limit: 5 });
    expect(res.isError).toBeUndefined();
  });
});

describe('food_items.get tool', () => {
  it('passes the authed userId and isAdmin', async () => {
    getFoodItemMock.mockResolvedValueOnce({ _id: 'x', name: 'Sugar' });
    await foodItemsGetHandler({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }, extra);
    expect(getFoodItemMock).toHaveBeenCalledWith('u1', {
      id: '64b7f8c2a2b7c2f1a2b7c2f1',
      isAdmin: false,
    });
  });

  it('maps a domain error to an isError result', async () => {
    const { NotFoundError } = await import('@/lib/service-errors');
    getFoodItemMock.mockRejectedValueOnce(new NotFoundError('Food item not found'));
    const res = await foodItemsGetHandler({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }, extra);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('Food item not found');
  });
});

describe('food_items.create tool', () => {
  it('forces isGlobal:false regardless of input', async () => {
    createFoodItemMock.mockResolvedValueOnce({ _id: 'new', name: 'Sugar' });
    await foodItemsCreateHandler(
      { name: 'Sugar', singularName: 'sugar', pluralName: 'sugars', unit: 'gram' },
      extra
    );
    expect(createFoodItemMock).toHaveBeenCalledTimes(1);
    const [userId, input] = createFoodItemMock.mock.calls[0];
    expect(userId).toBe('u1');
    expect(input.isGlobal).toBe(false);
  });

  it('its input schema does not accept an isGlobal field', () => {
    // Forcing happens in the wrapper; the schema must not even surface isGlobal.
    expect(Object.keys(foodItemsCreateInput)).not.toContain('isGlobal');
  });
});

describe('input schemas reject invalid input', () => {
  it('food_items.get requires a string id', () => {
    const result = z.object(foodItemsGetInput).safeParse({});
    expect(result.success).toBe(false);
  });

  it('food_items.create requires name/singularName/pluralName/unit', () => {
    const result = z.object(foodItemsCreateInput).safeParse({ name: 'x' });
    expect(result.success).toBe(false);
  });

  it('food_items.search accepts an empty object', () => {
    const result = z.object(foodItemsSearchInput).safeParse({});
    expect(result.success).toBe(true);
  });
});
