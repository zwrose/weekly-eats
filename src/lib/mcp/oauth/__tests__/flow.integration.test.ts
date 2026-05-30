import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMongoClient, auth, lookupApproval } = vi.hoisted(() => ({
  getMongoClient: vi.fn(),
  auth: vi.fn(),
  lookupApproval: vi.fn(),
}));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));
vi.mock('@/lib/auth', () => ({ auth }));
vi.mock('@/lib/mcp/oauth/approval', () => ({ lookupApproval }));

import { makeFakeDb } from '@/lib/mcp/oauth/stores/__tests__/test-db';
import { POST as register } from '@/app/api/mcp/oauth/register/route';
import { GET as authorize } from '@/app/api/mcp/oauth/authorize/route';
import { POST as decision } from '@/app/api/mcp/oauth/authorize/decision/route';
import { POST as token } from '@/app/api/mcp/oauth/token/route';
import { verifyToken } from '@/lib/mcp/verify-token';
import { GET as prm } from '@/app/api/mcp/oauth/protected-resource-metadata/route';
import { GET as asMeta } from '@/app/api/mcp/oauth/authorization-server-metadata/route';

const H = { 'x-forwarded-host': 'app.test', 'x-forwarded-proto': 'https' };
const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const challenge = createHash('sha256').update(verifier).digest('base64url');

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
  auth.mockReset().mockResolvedValue({ user: { id: '64b8f0000000000000000001' } });
  lookupApproval.mockReset().mockResolvedValue({ isApproved: true, isAdmin: false });
  vi.stubEnv('MCP_ISSUER_URL', '');
});

describe('OAuth AS — discovery + full flow', () => {
  it('PRM authorization_servers[0] equals AS metadata issuer', async () => {
    const prmDoc = await (await prm(new Request('https://app.test/x', { headers: H }))).json();
    const asDoc = await (await asMeta(new Request('https://app.test/x', { headers: H }))).json();
    expect(prmDoc.authorization_servers[0]).toBe(asDoc.issuer);
    expect(prmDoc.resource).toBe(`${asDoc.issuer}/api/mcp`);
  });

  it('register → authorize → decision(allow) → token → verifyToken yields a usable token', async () => {
    // 1. DCR
    const reg = await (
      await register(
        new Request('https://app.test/api/mcp/oauth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...H },
          body: JSON.stringify({ client_name: 'Claude', redirect_uris: ['https://claude.ai/cb'] }),
        })
      )
    ).json();
    const clientId = reg.client_id as string;

    // 2. /authorize (session present, approved, no prior consent) → redirect to /mcp/consent?mcp_auth=
    const authzUrl = new URL('https://app.test/api/mcp/oauth/authorize');
    Object.entries({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: 'https://claude.ai/cb',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'client-xyz',
      scope: 'weekly-eats:rw',
    }).forEach(([k, v]) => authzUrl.searchParams.set(k, v));
    const authzRes = await authorize(new Request(authzUrl, { headers: H }));
    expect(authzRes.status).toBe(302);
    const consentLoc = new URL(authzRes.headers.get('location')!);
    expect(consentLoc.pathname).toBe('/mcp/consent');
    const nonce = consentLoc.searchParams.get('mcp_auth')!;

    // 3. consent decision = allow → redirect to client with ?code=
    const form = new URLSearchParams({ mcp_auth: nonce, decision: 'allow' });
    const decRes = await decision(
      new Request('https://app.test/api/mcp/oauth/authorize/decision', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...H },
        body: form.toString(),
      })
    );
    expect(decRes.status).toBe(302);
    const cbLoc = new URL(decRes.headers.get('location')!);
    const code = cbLoc.searchParams.get('code')!;
    expect(code).toBeTruthy();
    expect(cbLoc.searchParams.get('iss')).toBe('https://app.test');

    // 4. /token code exchange
    const tokRes = await token(
      new Request('https://app.test/api/mcp/oauth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...H },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'https://claude.ai/cb',
          client_id: clientId,
          code_verifier: verifier,
        }).toString(),
      })
    );
    expect(tokRes.status).toBe(200);
    const tokens = await tokRes.json();
    expect(tokens.access_token).toBeTruthy();

    // 5. verifyToken accepts the minted access token for THIS resource (R3)
    const info = await verifyToken(
      new Request('https://app.test/api/mcp', { headers: H }),
      tokens.access_token
    );
    expect(info?.extra).toMatchObject({ userId: '64b8f0000000000000000001', isApproved: true });

    // 6. replaying the consumed code fails (MA) and revokes the issued tokens
    const replay = await token(
      new Request('https://app.test/api/mcp/oauth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...H },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'https://claude.ai/cb',
          client_id: clientId,
          code_verifier: verifier,
        }).toString(),
      })
    );
    expect((await replay.json()).error).toBe('invalid_grant');
    // the previously-minted token is now revoked → no longer verifies
    expect(
      await verifyToken(
        new Request('https://app.test/api/mcp', { headers: H }),
        tokens.access_token
      )
    ).toBeUndefined();
  });
});
