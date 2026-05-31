import { afterEach, describe, expect, it, vi } from 'vitest';

const { findValidAccessToken, lookupApproval } = vi.hoisted(() => ({
  findValidAccessToken: vi.fn(),
  lookupApproval: vi.fn(),
}));
vi.mock('@/lib/mcp/oauth/stores/tokens', () => ({ findValidAccessToken }));
vi.mock('@/lib/mcp/oauth/approval', () => ({ lookupApproval }));

import { verifyToken } from '../verify-token';

afterEach(() => vi.unstubAllEnvs());

function req() {
  return new Request('https://app.test/api/mcp', {
    headers: { 'x-forwarded-host': 'app.test', 'x-forwarded-proto': 'https' },
  });
}

describe('C1 — dev token is inert in production', () => {
  it('with dev env vars set AND NODE_ENV=production, the dev token is rejected', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MCP_DEV_TOKEN', 'dev-secret');
    vi.stubEnv('MCP_DEV_USER_ID', '64b8f0000000000000000001');
    // No token row exists for "dev-secret" — the dev bypass code path is gone.
    findValidAccessToken.mockResolvedValue(null);

    expect(await verifyToken(req(), 'dev-secret')).toBeUndefined();
    // The dev user id is never trusted: approval lookup is only reached for a real token.
    expect(lookupApproval).not.toHaveBeenCalled();
  });

  it('verify-token.ts contains no reference to MCP_DEV_TOKEN (static guarantee)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(dir, '../verify-token.ts'), 'utf8');
    expect(src).not.toContain('MCP_DEV_TOKEN');
    expect(src).not.toContain('MCP_DEV_USER_ID');
  });
});
