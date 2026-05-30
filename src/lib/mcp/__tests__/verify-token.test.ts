import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findValidAccessToken } = vi.hoisted(() => ({ findValidAccessToken: vi.fn() }));
vi.mock('@/lib/mcp/oauth/stores/tokens', () => ({ findValidAccessToken }));
const { lookupApproval } = vi.hoisted(() => ({ lookupApproval: vi.fn() }));
vi.mock('@/lib/mcp/oauth/approval', () => ({ lookupApproval }));

import { verifyToken } from '../verify-token';

const RESOURCE = 'https://app.test/api/mcp';
function req() {
  return new Request('https://app.test/api/mcp', {
    headers: { 'x-forwarded-host': 'app.test', 'x-forwarded-proto': 'https' },
  });
}
const tokenDoc = {
  userId: 'u1',
  clientId: 'c1',
  resource: RESOURCE,
  scope: 'weekly-eats:rw',
  tokenType: 'access' as const,
};

beforeEach(() => {
  findValidAccessToken.mockReset().mockResolvedValue(tokenDoc);
  lookupApproval.mockReset().mockResolvedValue({ isApproved: true, isAdmin: false });
});

describe('verifyToken (OAuth verifier)', () => {
  it('valid access token + approved user → AuthInfo with userId/flags', async () => {
    const info = await verifyToken(req(), 'AT');
    expect(info?.extra).toMatchObject({ userId: 'u1', isApproved: true, isAdmin: false });
    expect(info?.clientId).toBe('c1');
    expect(info?.scopes).toEqual(['weekly-eats:rw']);
  });

  it('no bearer → undefined', async () => {
    expect(await verifyToken(req(), undefined)).toBeUndefined();
  });

  it('unknown/expired/revoked token (store returns null) → undefined (T1/R6/M3)', async () => {
    findValidAccessToken.mockResolvedValue(null);
    expect(await verifyToken(req(), 'AT')).toBeUndefined();
  });

  it('resource/audience mismatch → undefined (R3)', async () => {
    findValidAccessToken.mockResolvedValue({ ...tokenDoc, resource: 'https://evil/api/mcp' });
    expect(await verifyToken(req(), 'AT')).toBeUndefined();
  });

  it('live lookup says unapproved → undefined even though token is valid (T3/M1)', async () => {
    lookupApproval.mockResolvedValue({ isApproved: false, isAdmin: false });
    expect(await verifyToken(req(), 'AT')).toBeUndefined();
  });

  it('admin bypasses approval (M1 parity with requireApprovedSession)', async () => {
    lookupApproval.mockResolvedValue({ isApproved: false, isAdmin: true });
    const info = await verifyToken(req(), 'AT');
    expect(info?.extra).toMatchObject({ isAdmin: true });
  });

  it('user vanished from users (lookup null) → undefined', async () => {
    lookupApproval.mockResolvedValue(null);
    expect(await verifyToken(req(), 'AT')).toBeUndefined();
  });

  it('the old MCP_DEV_TOKEN no longer authenticates (C1 — dev path removed)', async () => {
    // No special-casing: a dev token is just an unknown bearer now.
    findValidAccessToken.mockResolvedValue(null);
    vi.stubEnv('MCP_DEV_TOKEN', 'dev-secret');
    vi.stubEnv('MCP_DEV_USER_ID', 'u1');
    expect(await verifyToken(req(), 'dev-secret')).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
