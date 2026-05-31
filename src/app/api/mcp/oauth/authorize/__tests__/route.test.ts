// src/app/api/mcp/oauth/authorize/__tests__/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMongoClient, auth, getClient, touchClient, lookupApproval, hasConsent } = vi.hoisted(
  () => ({
    getMongoClient: vi.fn(),
    auth: vi.fn(),
    getClient: vi.fn(),
    touchClient: vi.fn(),
    lookupApproval: vi.fn(),
    hasConsent: vi.fn(),
  })
);
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));
vi.mock('@/lib/auth', () => ({ auth }));
vi.mock('@/lib/mcp/oauth/stores/clients', () => ({ getClient, touchClient }));
vi.mock('@/lib/mcp/oauth/approval', () => ({ lookupApproval }));
vi.mock('@/lib/mcp/oauth/stores/consents', () => ({ hasConsent }));

// real auth-states + authorize-core, backed by the fake db
import { makeFakeDb } from '@/lib/mcp/oauth/stores/__tests__/test-db';
import { GET } from '../route';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
  auth.mockReset();
  getClient.mockReset().mockResolvedValue({
    clientId: 'c1',
    clientName: 'Claude',
    redirectUris: ['https://claude.ai/cb'],
  });
  touchClient.mockReset().mockResolvedValue(undefined);
  lookupApproval.mockReset();
  hasConsent.mockReset().mockResolvedValue(false);
});

const ORIGIN = { 'x-forwarded-host': 'app.test', 'x-forwarded-proto': 'https' };
function authorizeReq(params: Record<string, string>) {
  const u = new URL('https://app.test/api/mcp/oauth/authorize');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new Request(u, { headers: ORIGIN });
}
const valid = {
  response_type: 'code',
  client_id: 'c1',
  redirect_uri: 'https://claude.ai/cb',
  code_challenge: 'chal',
  code_challenge_method: 'S256',
  state: 'client-xyz',
  scope: 'weekly-eats:rw',
};

describe('GET /authorize', () => {
  it('unknown client → 400 invalid_client, no redirect', async () => {
    getClient.mockResolvedValue(null);
    const res = await GET(authorizeReq({ ...valid }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_client');
  });

  it('redirect_uri not byte-matching a registered uri → 400, no redirect', async () => {
    const res = await GET(authorizeReq({ ...valid, redirect_uri: 'https://claude.ai/cb2' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_request');
  });

  it('code_challenge_method=plain → error redirect with iss (sec-004)', async () => {
    const res = await GET(authorizeReq({ ...valid, code_challenge_method: 'plain' }));
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.origin + loc.pathname).toBe('https://claude.ai/cb');
    expect(loc.searchParams.get('error')).toBe('invalid_request');
    expect(loc.searchParams.get('iss')).toBe('https://app.test');
    expect(loc.searchParams.get('state')).toBe('client-xyz');
  });

  it('absent code_challenge_method → error redirect (sec-004, absent case)', async () => {
    // Guards against a refactor to `=== "plain"` that would silently accept an
    // omitted method. The route requires `=== "S256"`, so null must be rejected.
    const { code_challenge_method, ...noMethod } = valid;
    const res = await GET(authorizeReq(noMethod as Record<string, string>));
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.searchParams.get('error')).toBe('invalid_request');
  });

  it('missing code_challenge → error redirect (invalid_request)', async () => {
    const { code_challenge, ...noChallenge } = valid;
    const res = await GET(authorizeReq(noChallenge));
    const loc = new URL(res.headers.get('location')!);
    expect(loc.searchParams.get('error')).toBe('invalid_request');
  });

  it('no session → 302 to /mcp/connect?mcp_auth=<nonce>', async () => {
    auth.mockResolvedValue(null);
    const res = await GET(authorizeReq({ ...valid }));
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/mcp/connect');
    expect(loc.searchParams.get('mcp_auth')).toBeTruthy();
    // a state row was persisted
    expect(fake.store.get('mcpAuthStates')!.length).toBe(1);
  });

  it('session + approved + no prior consent → 302 to /mcp/consent', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });
    lookupApproval.mockResolvedValue({ isApproved: true, isAdmin: false });
    const res = await GET(authorizeReq({ ...valid }));
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/mcp/consent');
    expect(loc.searchParams.get('mcp_auth')).toBeTruthy();
  });

  it('session but UNAPPROVED → access_denied redirect, no code (L5-S1)', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });
    lookupApproval.mockResolvedValue({ isApproved: false, isAdmin: false });
    const res = await GET(authorizeReq({ ...valid }));
    const loc = new URL(res.headers.get('location')!);
    expect(loc.origin + loc.pathname).toBe('https://claude.ai/cb');
    expect(loc.searchParams.get('error')).toBe('access_denied');
    expect(loc.searchParams.has('code')).toBe(false);
    expect(fake.store.get('mcpAuthCodes') ?? []).toHaveLength(0);
  });

  it('session + approved + prior consent → consent-skip issues a code (L6 gate still ran)', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });
    lookupApproval.mockResolvedValue({ isApproved: true, isAdmin: false });
    hasConsent.mockResolvedValue(true);
    const res = await GET(authorizeReq({ ...valid }));
    const loc = new URL(res.headers.get('location')!);
    expect(loc.origin + loc.pathname).toBe('https://claude.ai/cb');
    expect(loc.searchParams.get('code')).toBeTruthy();
    expect(lookupApproval).toHaveBeenCalled(); // gate ran on the skip path
  });

  it('consent-skip path STILL denies a now-unapproved user (L6)', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });
    lookupApproval.mockResolvedValue({ isApproved: false, isAdmin: false });
    hasConsent.mockResolvedValue(true);
    const res = await GET(authorizeReq({ ...valid }));
    const loc = new URL(res.headers.get('location')!);
    expect(loc.searchParams.get('error')).toBe('access_denied');
    expect(loc.searchParams.has('code')).toBe(false);
  });

  it('post-login with an expired/unknown mcp_auth → 400 (test-001/R6)', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await GET(authorizeReq({ mcp_auth: 'bogus-nonce' }));
    expect(res.status).toBe(400);
  });

  it('post-login leg with a valid nonce but still no session → 302 back to /mcp/connect', async () => {
    auth.mockResolvedValue(null);
    // initial leg persists the state and redirects to the connect screen
    const first = await GET(authorizeReq({ ...valid }));
    const nonce = new URL(first.headers.get('location')!).searchParams.get('mcp_auth')!;
    // the user returns to /authorize?mcp_auth=... but is still unauthenticated
    const res = await GET(authorizeReq({ mcp_auth: nonce }));
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/mcp/connect');
    expect(loc.searchParams.get('mcp_auth')).toBe(nonce);
  });
});
