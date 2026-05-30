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

  // NOTE: a positive auth-wiring test (correct bearer → not 401) was attempted
  // but removed. With a valid token the auth gate opens and mcp-handler's
  // handler body runs, which streams its JSON-RPC response through a Response
  // adapter that throws "Unexpected chunk type: object" under the jsdom/undici
  // test environment — an unhandled rejection that fails `npm run check`. This
  // is the undici/jsdom incompatibility the plan's Task 11 Step 8 skip clause
  // anticipated. The positive path is covered instead by the verify-token unit
  // tests (the gate returns valid AuthInfo for the dev token) and the register
  // smoke test (tools load); the two 401 cases above cover the rejection wiring.
});
