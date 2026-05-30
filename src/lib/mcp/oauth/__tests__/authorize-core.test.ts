import { beforeEach, describe, expect, it, vi } from 'vitest';

const { issueAuthCode, consumeAuthState } = vi.hoisted(() => ({
  issueAuthCode: vi.fn(),
  consumeAuthState: vi.fn(),
}));
vi.mock('../stores/auth-codes', () => ({
  issueAuthCode,
  grantIdForCode: (c: string) => `grant:${c}`,
}));
vi.mock('../stores/auth-states', () => ({ consumeAuthState }));

import { issueCodeAndRedirect } from '../authorize-core';
import type { McpAuthStateDoc } from '../types';

const state: McpAuthStateDoc = {
  hashedState: 'h',
  clientId: 'c1',
  redirectUri: 'https://c/cb',
  codeChallenge: 'chal',
  resource: 'https://app.test/api/mcp',
  scope: 'weekly-eats:rw',
  clientState: 'client-xyz',
  expiresAt: 9_999_999_999_999,
};

beforeEach(() => {
  issueAuthCode.mockReset().mockResolvedValue(undefined);
  consumeAuthState.mockReset().mockResolvedValue(state);
});

describe('issueCodeAndRedirect', () => {
  it('mints a code bound to the request and redirects with code+state+iss', async () => {
    const res = await issueCodeAndRedirect({
      nonce: 'raw-nonce',
      state,
      userId: 'u1',
      issuer: 'https://app.test',
      now: 1000,
    });
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.origin + loc.pathname).toBe('https://c/cb');
    expect(loc.searchParams.get('code')).toBeTruthy();
    expect(loc.searchParams.get('state')).toBe('client-xyz');
    expect(loc.searchParams.get('iss')).toBe('https://app.test');

    // the code was stored bound to client/redirect/challenge/resource/user
    const [, fields] = issueAuthCode.mock.calls[0];
    expect(fields).toMatchObject({
      clientId: 'c1',
      redirectUri: 'https://c/cb',
      codeChallenge: 'chal',
      resource: 'https://app.test/api/mcp',
      userId: 'u1',
      scope: 'weekly-eats:rw',
    });
    // single-use state consumed
    expect(consumeAuthState).toHaveBeenCalledWith('raw-nonce', 1000);
    // CONSUME-FIRST ordering (security-001): the nonce is claimed before the
    // code is minted, so a concurrent loser cannot also issue a code.
    expect(consumeAuthState.mock.invocationCallOrder[0]).toBeLessThan(
      issueAuthCode.mock.invocationCallOrder[0]
    );
  });

  it('aborts with access_denied when the nonce was already consumed (concurrent loser)', async () => {
    consumeAuthState.mockResolvedValue(null);
    const res = await issueCodeAndRedirect({
      nonce: 'raw-nonce',
      state,
      userId: 'u1',
      issuer: 'https://app.test',
      now: 1000,
    });
    const loc = new URL(res.headers.get('location')!);
    expect(loc.searchParams.get('error')).toBe('access_denied');
    expect(loc.searchParams.has('code')).toBe(false);
    expect(issueAuthCode).not.toHaveBeenCalled();
  });
});
