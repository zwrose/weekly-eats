// src/lib/mcp/oauth/__tests__/oauth-response.test.ts
import { describe, expect, it } from 'vitest';
import { MCP_OAUTH_ERRORS } from '@/lib/errors';
import { oauthErrorJson, redirectWithCode, redirectWithError } from '../oauth-response';

describe('oauth-response', () => {
  it('oauthErrorJson returns the OAuth error body + status + no-store', async () => {
    const res = oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'bad code', 400);
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      error: 'invalid_grant',
      error_description: 'bad code',
    });
  });

  it('redirectWithError appends error, state, and iss (R1 — error path too)', () => {
    const res = redirectWithError({
      redirectUri: 'https://client.example/cb',
      error: MCP_OAUTH_ERRORS.ACCESS_DENIED,
      clientState: 'xyz',
      issuer: 'https://app.test',
    });
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.origin + loc.pathname).toBe('https://client.example/cb');
    expect(loc.searchParams.get('error')).toBe('access_denied');
    expect(loc.searchParams.get('state')).toBe('xyz');
    expect(loc.searchParams.get('iss')).toBe('https://app.test');
  });

  it('redirectWithError omits state when the client sent none', () => {
    const res = redirectWithError({
      redirectUri: 'https://client.example/cb',
      error: MCP_OAUTH_ERRORS.INVALID_REQUEST,
      clientState: null,
      issuer: 'https://app.test',
    });
    const loc = new URL(res.headers.get('location')!);
    expect(loc.searchParams.has('state')).toBe(false);
  });

  it('redirectWithCode appends code, state, and iss (R1 — success path)', () => {
    const res = redirectWithCode({
      redirectUri: 'https://client.example/cb',
      code: 'the-code',
      clientState: 'xyz',
      issuer: 'https://app.test',
    });
    const loc = new URL(res.headers.get('location')!);
    expect(loc.searchParams.get('code')).toBe('the-code');
    expect(loc.searchParams.get('state')).toBe('xyz');
    expect(loc.searchParams.get('iss')).toBe('https://app.test');
  });
});
