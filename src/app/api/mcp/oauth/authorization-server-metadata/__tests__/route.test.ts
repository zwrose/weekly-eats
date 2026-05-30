import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';

afterEach(() => vi.unstubAllEnvs());

function req() {
  return new Request('https://app.test/.well-known/oauth-authorization-server', {
    headers: { 'x-forwarded-host': 'weekly-eats.vercel.app', 'x-forwarded-proto': 'https' },
  });
}

describe('authorization server metadata (RFC 8414)', () => {
  it('advertises endpoints, S256-only PKCE, scope, and iss support', async () => {
    vi.stubEnv('MCP_ISSUER_URL', '');
    const body = await (await GET(req())).json();
    const base = 'https://weekly-eats.vercel.app';
    expect(body.issuer).toBe(base);
    expect(body.authorization_endpoint).toBe(`${base}/api/mcp/oauth/authorize`);
    expect(body.token_endpoint).toBe(`${base}/api/mcp/oauth/token`);
    expect(body.registration_endpoint).toBe(`${base}/api/mcp/oauth/register`);
    expect(body.revocation_endpoint).toBe(`${base}/api/mcp/oauth/revoke`);
    expect(body.code_challenge_methods_supported).toEqual(['S256']);
    expect(body.response_types_supported).toEqual(['code']);
    expect(body.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
    expect(body.scopes_supported).toEqual(['weekly-eats:rw']);
    expect(body.token_endpoint_auth_methods_supported).toEqual(['none']);
    expect(body.authorization_response_iss_parameter_supported).toBe(true);
  });
});
