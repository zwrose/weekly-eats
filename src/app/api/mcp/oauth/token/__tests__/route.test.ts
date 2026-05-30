import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getClient,
  touchClient,
  consumeAuthCode,
  mintPair,
  findRefreshToken,
  rotateRefresh,
  revokeChain,
  lookupApproval,
} = vi.hoisted(() => ({
  getClient: vi.fn(),
  touchClient: vi.fn(),
  consumeAuthCode: vi.fn(),
  mintPair: vi.fn(),
  findRefreshToken: vi.fn(),
  rotateRefresh: vi.fn(),
  revokeChain: vi.fn(),
  lookupApproval: vi.fn(),
}));

vi.mock('@/lib/mcp/oauth/stores/clients', () => ({ getClient, touchClient }));
vi.mock('@/lib/mcp/oauth/stores/auth-codes', () => ({
  consumeAuthCode,
  grantIdForCode: (c: string) => `grant:${c}`,
}));
vi.mock('@/lib/mcp/oauth/stores/tokens', () => ({
  mintPair,
  findRefreshToken,
  rotateRefresh,
  revokeChain,
}));
vi.mock('@/lib/mcp/oauth/approval', () => ({ lookupApproval }));

import { POST } from '../route';

const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const challenge = createHash('sha256').update(verifier).digest('base64url');
const RESOURCE = 'https://app.test/api/mcp';

function tokenReq(body: Record<string, string>) {
  return new Request('https://app.test/api/mcp/oauth/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-host': 'app.test',
      'x-forwarded-proto': 'https',
    },
    body: new URLSearchParams(body).toString(),
  });
}
const codeDoc = {
  clientId: 'c1',
  redirectUri: 'https://claude.ai/cb',
  codeChallenge: challenge,
  resource: RESOURCE,
  userId: 'u1',
  scope: 'weekly-eats:rw',
};

beforeEach(() => {
  getClient
    .mockReset()
    .mockResolvedValue({ clientId: 'c1', redirectUris: ['https://claude.ai/cb'] });
  touchClient.mockReset().mockResolvedValue(undefined);
  consumeAuthCode.mockReset().mockResolvedValue(codeDoc);
  mintPair.mockReset().mockResolvedValue({ accessToken: 'AT', refreshToken: 'RT' });
  findRefreshToken.mockReset();
  rotateRefresh.mockReset();
  revokeChain.mockReset().mockResolvedValue(undefined);
  lookupApproval.mockReset().mockResolvedValue({ isApproved: true, isAdmin: false });
});

const codeGrant = {
  grant_type: 'authorization_code',
  code: 'the-code',
  redirect_uri: 'https://claude.ai/cb',
  client_id: 'c1',
  code_verifier: verifier,
};

describe('POST /token — authorization_code', () => {
  it('valid exchange → access + refresh + bearer + expires_in', async () => {
    const res = await POST(tokenReq(codeGrant));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body).toMatchObject({
      access_token: 'AT',
      refresh_token: 'RT',
      token_type: 'Bearer',
      scope: 'weekly-eats:rw',
    });
    expect(body.expires_in).toBeGreaterThan(0);
  });

  it('unknown client_id → invalid_client (T4)', async () => {
    getClient.mockResolvedValue(null);
    const res = await POST(tokenReq(codeGrant));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('invalid_client');
  });

  it('code_verifier mismatch → invalid_grant', async () => {
    const res = await POST(tokenReq({ ...codeGrant, code_verifier: 'wrong' }));
    expect((await res.json()).error).toBe('invalid_grant');
  });

  it('missing code_verifier with a stored challenge → invalid_grant (R2 downgrade)', async () => {
    const { code_verifier, ...noVerifier } = codeGrant;
    const res = await POST(tokenReq(noVerifier));
    expect((await res.json()).error).toBe('invalid_grant');
  });

  it('expired/consumed code (consume returns null) → invalid_grant + chain revoked (MA)', async () => {
    consumeAuthCode.mockResolvedValue(null);
    const res = await POST(tokenReq(codeGrant));
    expect((await res.json()).error).toBe('invalid_grant');
    expect(revokeChain).toHaveBeenCalledWith('grant:the-code', expect.any(Number));
  });

  it('code issued to client A, redeemed by client B → invalid_grant (sec-005)', async () => {
    getClient.mockResolvedValue({ clientId: 'c2', redirectUris: ['https://claude.ai/cb'] });
    const res = await POST(tokenReq({ ...codeGrant, client_id: 'c2' }));
    expect((await res.json()).error).toBe('invalid_grant');
  });

  it('redirect_uri not matching the code → invalid_grant (sec-005)', async () => {
    const res = await POST(tokenReq({ ...codeGrant, redirect_uri: 'https://claude.ai/other' }));
    expect((await res.json()).error).toBe('invalid_grant');
  });
});

describe('POST /token — refresh_token', () => {
  const refreshGrant = { grant_type: 'refresh_token', refresh_token: 'old-RT', client_id: 'c1' };
  const refreshDoc = {
    clientId: 'c1',
    userId: 'u1',
    resource: RESOURCE,
    scope: 'weekly-eats:rw',
    grantId: 'grant:the-code',
    expiresAt: new Date(9_999_999_999_999),
    revokedAt: null,
    replacedBy: null,
  };

  it('successful refresh with approval re-check → new pair (I5/T2)', async () => {
    findRefreshToken.mockResolvedValue(refreshDoc);
    rotateRefresh.mockResolvedValue({ accessToken: 'AT2', refreshToken: 'RT2' });
    const res = await POST(tokenReq(refreshGrant));
    expect(lookupApproval).toHaveBeenCalledWith('u1');
    expect(await res.json()).toMatchObject({ access_token: 'AT2', refresh_token: 'RT2' });
  });

  it('refresh by a now-unapproved user → invalid_grant + chain revoked (I5)', async () => {
    findRefreshToken.mockResolvedValue(refreshDoc);
    lookupApproval.mockResolvedValue({ isApproved: false, isAdmin: false });
    const res = await POST(tokenReq(refreshGrant));
    expect((await res.json()).error).toBe('invalid_grant');
    expect(revokeChain).toHaveBeenCalledWith('grant:the-code', expect.any(Number));
    expect(rotateRefresh).not.toHaveBeenCalled();
  });

  it('rotated/replayed refresh (rotate returns null) → invalid_grant + chain revoked (S3)', async () => {
    findRefreshToken.mockResolvedValue(refreshDoc);
    rotateRefresh.mockResolvedValue(null);
    const res = await POST(tokenReq(refreshGrant));
    expect((await res.json()).error).toBe('invalid_grant');
    expect(revokeChain).toHaveBeenCalledWith('grant:the-code', expect.any(Number));
  });

  it('expired refresh token (at-use) → invalid_grant', async () => {
    findRefreshToken.mockResolvedValue({ ...refreshDoc, expiresAt: new Date(1) });
    const res = await POST(tokenReq(refreshGrant));
    expect((await res.json()).error).toBe('invalid_grant');
  });

  it('already-revoked refresh token → invalid_grant + chain revoked', async () => {
    findRefreshToken.mockResolvedValue({ ...refreshDoc, revokedAt: 123 });
    const res = await POST(tokenReq(refreshGrant));
    expect((await res.json()).error).toBe('invalid_grant');
    expect(revokeChain).toHaveBeenCalled();
  });

  it('unknown refresh token → invalid_grant', async () => {
    findRefreshToken.mockResolvedValue(null);
    const res = await POST(tokenReq(refreshGrant));
    expect((await res.json()).error).toBe('invalid_grant');
  });
});

describe('POST /token — grant type', () => {
  it('unsupported grant_type → unsupported_grant_type', async () => {
    const res = await POST(tokenReq({ grant_type: 'password', client_id: 'c1' }));
    expect((await res.json()).error).toBe('unsupported_grant_type');
  });
});
