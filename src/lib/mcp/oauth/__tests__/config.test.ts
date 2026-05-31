// src/lib/mcp/oauth/__tests__/config.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getIssuerUrl, getResourceUrl, MCP_SCOPE } from '../config';

afterEach(() => vi.unstubAllEnvs());

function req(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe('oauth config', () => {
  it('derives issuer from the request origin when MCP_ISSUER_URL is unset', () => {
    vi.stubEnv('MCP_ISSUER_URL', '');
    expect(getIssuerUrl(req('https://app.test/api/mcp'))).toBe('https://app.test');
  });

  it('honors a forwarded host/proto from the proxy', () => {
    vi.stubEnv('MCP_ISSUER_URL', '');
    const r = req('http://localhost:3000/api/mcp', {
      'x-forwarded-host': 'weekly-eats.vercel.app',
      'x-forwarded-proto': 'https',
    });
    expect(getIssuerUrl(r)).toBe('https://weekly-eats.vercel.app');
  });

  it('prefers an explicit MCP_ISSUER_URL override', () => {
    vi.stubEnv('MCP_ISSUER_URL', 'https://fixed.example');
    expect(getIssuerUrl(req('https://app.test/api/mcp'))).toBe('https://fixed.example');
  });

  it('builds the resource url as issuer + /api/mcp', () => {
    vi.stubEnv('MCP_ISSUER_URL', 'https://fixed.example');
    expect(getResourceUrl(req('https://app.test/api/mcp'))).toBe('https://fixed.example/api/mcp');
  });

  it('exposes the single v1 scope', () => {
    expect(MCP_SCOPE).toBe('weekly-eats:rw');
  });
});
