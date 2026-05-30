import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyToken } from '@/lib/mcp/verify-token';

const req = new Request('http://localhost/api/mcp');

// Use Vitest's env stubbing (auto-tracked + restored) rather than mutating
// process.env directly — direct reassignment is fragile under the project's
// singleFork vitest pool and can bleed into other test files. `vi.stubEnv`
// sets the value live; `vi.unstubAllEnvs` in afterEach restores everything.
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  // Default both to unset; each test stubs what it needs.
  vi.stubEnv('MCP_DEV_TOKEN', '');
  vi.stubEnv('MCP_DEV_USER_ID', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('verifyToken (Phase 1 dev-token gate)', () => {
  it('returns AuthInfo for the correct dev token in a non-production env', async () => {
    vi.stubEnv('MCP_DEV_TOKEN', 'secret-dev-token');
    vi.stubEnv('MCP_DEV_USER_ID', 'dev-user-id');
    const info = await verifyToken(req, 'secret-dev-token');
    expect(info).toBeDefined();
    expect(info?.extra?.userId).toBe('dev-user-id');
    expect(info?.token).toBe('secret-dev-token');
    expect(info?.clientId).toBe('mcp-dev');
  });

  it('returns undefined for a wrong token', async () => {
    vi.stubEnv('MCP_DEV_TOKEN', 'secret-dev-token');
    vi.stubEnv('MCP_DEV_USER_ID', 'dev-user-id');
    expect(await verifyToken(req, 'wrong')).toBeUndefined();
  });

  it('returns undefined for a same-length wrong token (exercises the constant-time path)', async () => {
    // 'secret-dev-token' and 'secret-dev-tokeX' are both 16 chars, so safeEqual
    // passes the length check and reaches timingSafeEqual — proving the
    // constant-time comparison itself rejects a mismatch.
    vi.stubEnv('MCP_DEV_TOKEN', 'secret-dev-token');
    vi.stubEnv('MCP_DEV_USER_ID', 'dev-user-id');
    expect(await verifyToken(req, 'secret-dev-tokeX')).toBeUndefined();
  });

  it('returns undefined when no bearer token is supplied', async () => {
    vi.stubEnv('MCP_DEV_TOKEN', 'secret-dev-token');
    vi.stubEnv('MCP_DEV_USER_ID', 'dev-user-id');
    expect(await verifyToken(req, undefined)).toBeUndefined();
  });

  it('returns undefined when MCP_DEV_TOKEN is not configured', async () => {
    vi.stubEnv('MCP_DEV_USER_ID', 'dev-user-id');
    expect(await verifyToken(req, 'anything')).toBeUndefined();
  });

  it('returns undefined when MCP_DEV_USER_ID is not configured', async () => {
    // Token present, user id absent → gate must still reject (C1: both required).
    vi.stubEnv('MCP_DEV_TOKEN', 'secret-dev-token');
    expect(await verifyToken(req, 'secret-dev-token')).toBeUndefined();
  });

  it('is inert in production even with the correct token (C1)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MCP_DEV_TOKEN', 'secret-dev-token');
    vi.stubEnv('MCP_DEV_USER_ID', 'dev-user-id');
    expect(await verifyToken(req, 'secret-dev-token')).toBeUndefined();
  });
});
