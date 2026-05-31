import { describe, it, expect, vi } from 'vitest';

// Tools must import cleanly without hitting Mongo.
vi.mock('@/lib/services/food-items', () => ({
  searchFoodItems: vi.fn(),
  getFoodItem: vi.fn(),
  createFoodItem: vi.fn(),
}));
vi.mock('@/lib/services/recipes', () => ({
  searchRecipes: vi.fn(),
  getRecipe: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
}));

const { POST } = await import('../route');

describe('/api/mcp transport auth wiring', () => {
  it('an unauthenticated POST gets 401 with a resource_metadata challenge (R4)', async () => {
    const res = await POST(
      new Request('https://app.test/api/mcp', {
        method: 'POST',
        headers: { 'x-forwarded-host': 'app.test', 'x-forwarded-proto': 'https' },
      })
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata');
  });
});
