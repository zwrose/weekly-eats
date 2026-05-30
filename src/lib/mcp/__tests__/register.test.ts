import { describe, it, expect, vi } from 'vitest';

// Services are not called during registration, but mock them so importing the
// tool modules never reaches Mongo.
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

const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
const { registerFoodItemTools } = await import('@/lib/mcp/tools/food-items');
const { registerRecipeTools } = await import('@/lib/mcp/tools/recipes');

describe('tool registration', () => {
  it('registers all Phase-1 tools on a real McpServer without throwing', () => {
    const server = new McpServer({ name: 'weekly-eats-test', version: '0.0.0' });
    expect(() => {
      // McpServer.registerTool is generic over the zod input shape, so it is
      // not structurally identical to our minimal ToolServer (Task 11, Step 9).
      registerFoodItemTools(server as never);
      registerRecipeTools(server as never);
    }).not.toThrow();
  });
});
