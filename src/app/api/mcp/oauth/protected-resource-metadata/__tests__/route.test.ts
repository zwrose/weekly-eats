// src/app/api/mcp/oauth/protected-resource-metadata/__tests__/route.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';

afterEach(() => vi.unstubAllEnvs());

function req() {
  return new Request('https://app.test/.well-known/oauth-protected-resource', {
    headers: { 'x-forwarded-host': 'weekly-eats.vercel.app', 'x-forwarded-proto': 'https' },
  });
}

describe('protected resource metadata (RFC 9728)', () => {
  it('serves a well-formed PRM document advertising the AS + scope', async () => {
    vi.stubEnv('MCP_ISSUER_URL', '');
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resource).toBe('https://weekly-eats.vercel.app/api/mcp');
    expect(body.authorization_servers).toEqual(['https://weekly-eats.vercel.app']);
    expect(body.scopes_supported).toEqual(['weekly-eats:rw']);
  });
});
