import { describe, it, expect, vi } from 'vitest';

const createMcpHandlerMock = vi.fn(() => 'base-handler');
const withMcpAuthMock = vi.fn((h: unknown) => h);

vi.mock('mcp-handler', () => ({
  createMcpHandler: (...a: unknown[]) => createMcpHandlerMock(...a),
  withMcpAuth: (...a: unknown[]) => withMcpAuthMock(...a),
}));

const registerFoodItemToolsMock = vi.fn();
const registerRecipeToolsMock = vi.fn();
const registerSkillToolsMock = vi.fn();

vi.mock('@/lib/mcp/tools/food-items', () => ({
  registerFoodItemTools: (...a: unknown[]) => registerFoodItemToolsMock(...a),
}));
vi.mock('@/lib/mcp/tools/recipes', () => ({
  registerRecipeTools: (...a: unknown[]) => registerRecipeToolsMock(...a),
}));
vi.mock('@/lib/mcp/tools/skills', () => ({
  registerSkillTools: (...a: unknown[]) => registerSkillToolsMock(...a),
}));
vi.mock('@/lib/mcp/verify-token', () => ({ verifyToken: vi.fn() }));

await import('../route');

describe('MCP transport route configuration', () => {
  it('passes server instructions that mention skills_list', () => {
    const serverOptions = createMcpHandlerMock.mock.calls[0][1] as { instructions?: string };
    expect(serverOptions.instructions).toBeDefined();
    expect(serverOptions.instructions).toContain('skills_list');
  });

  it('registers food-item, recipe, and skill tools in the setup callback', () => {
    const setup = createMcpHandlerMock.mock.calls[0][0] as (s: unknown) => void;
    const fakeServer = { registerTool: vi.fn() };
    setup(fakeServer);
    expect(registerFoodItemToolsMock).toHaveBeenCalledWith(fakeServer);
    expect(registerRecipeToolsMock).toHaveBeenCalledWith(fakeServer);
    expect(registerSkillToolsMock).toHaveBeenCalledWith(fakeServer);
  });
});
