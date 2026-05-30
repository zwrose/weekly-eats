import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('MCP_DEV_TOKEN', 'secret-dev-token');
  vi.stubEnv('MCP_DEV_USER_ID', 'dev-user-id');
});
afterEach(() => vi.unstubAllEnvs());

describe('/api/mcp transport auth wiring', () => {
  it('rejects a POST with no Authorization header (401)', async () => {
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects a POST with a wrong bearer (401)', async () => {
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer wrong' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
