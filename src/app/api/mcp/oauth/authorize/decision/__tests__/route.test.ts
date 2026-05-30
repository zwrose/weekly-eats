import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  auth,
  peekAuthState,
  consumeAuthState,
  lookupApproval,
  grantConsent,
  issueCodeAndRedirect,
} = vi.hoisted(() => ({
  auth: vi.fn(),
  peekAuthState: vi.fn(),
  consumeAuthState: vi.fn(),
  lookupApproval: vi.fn(),
  grantConsent: vi.fn(),
  issueCodeAndRedirect: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth }));
vi.mock('@/lib/mcp/oauth/stores/auth-states', () => ({ peekAuthState, consumeAuthState }));
vi.mock('@/lib/mcp/oauth/approval', () => ({ lookupApproval }));
vi.mock('@/lib/mcp/oauth/stores/consents', () => ({ grantConsent }));
vi.mock('@/lib/mcp/oauth/authorize-core', () => ({ issueCodeAndRedirect }));

import { NextResponse } from 'next/server';
import { POST } from '../route';

const state = {
  clientId: 'c1',
  redirectUri: 'https://claude.ai/cb',
  scope: 'weekly-eats:rw',
  clientState: 'xyz',
  codeChallenge: 'chal',
  resource: 'https://app.test/api/mcp',
  expiresAt: 9_999_999_999_999,
};

function decisionReq(decision: string, nonce = 'raw-nonce') {
  const form = new URLSearchParams({ mcp_auth: nonce, decision });
  return new Request('https://app.test/api/mcp/oauth/authorize/decision', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-host': 'app.test',
      'x-forwarded-proto': 'https',
    },
    body: form.toString(),
  });
}

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ user: { id: 'u1' } });
  peekAuthState.mockReset().mockResolvedValue(state);
  consumeAuthState.mockReset().mockResolvedValue(state);
  lookupApproval.mockReset().mockResolvedValue({ isApproved: true, isAdmin: false });
  grantConsent.mockReset().mockResolvedValue(undefined);
  issueCodeAndRedirect
    .mockReset()
    .mockResolvedValue(NextResponse.redirect('https://claude.ai/cb?code=x', 302));
});

describe('POST /authorize/decision', () => {
  it('Allow → grants consent and issues a code (MD happy path)', async () => {
    const res = await POST(decisionReq('allow'));
    expect(grantConsent).toHaveBeenCalledWith('u1', 'c1', 'weekly-eats:rw', expect.any(Number));
    expect(issueCodeAndRedirect).toHaveBeenCalled();
    expect(res.status).toBe(302);
  });

  it('Deny → access_denied redirect, no code, state consumed', async () => {
    const res = await POST(decisionReq('deny'));
    const loc = new URL(res.headers.get('location')!);
    expect(loc.searchParams.get('error')).toBe('access_denied');
    expect(loc.searchParams.has('code')).toBe(false);
    expect(issueCodeAndRedirect).not.toHaveBeenCalled();
    expect(consumeAuthState).toHaveBeenCalled();
  });

  it('expired/unknown state → 400', async () => {
    peekAuthState.mockResolvedValue(null);
    const res = await POST(decisionReq('allow'));
    expect(res.status).toBe(400);
  });

  it('no session → redirect to login', async () => {
    auth.mockResolvedValue(null);
    const res = await POST(decisionReq('allow'));
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/');
  });

  it('Allow but now-unapproved → access_denied, no code (gate at issuance)', async () => {
    lookupApproval.mockResolvedValue({ isApproved: false, isAdmin: false });
    const res = await POST(decisionReq('allow'));
    const loc = new URL(res.headers.get('location')!);
    expect(loc.searchParams.get('error')).toBe('access_denied');
    expect(issueCodeAndRedirect).not.toHaveBeenCalled();
  });
});
