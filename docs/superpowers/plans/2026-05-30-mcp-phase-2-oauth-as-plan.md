# MCP Phase 2 — OAuth 2.1 Authorization Server + Approval-Gated Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase-1 static dev token with a hand-rolled, spec-compliant OAuth 2.1 Authorization Server (delegating human login to the app's existing Auth.js v5 + Google flow) so any approved Weekly Eats user can self-serve add the connector in Claude, and harden `verifyToken` to do a live approval lookup on every tool call.

**Architecture:** Weekly Eats becomes the OAuth 2.1 AS. New endpoints under `/api/mcp/oauth/*` (register, authorize, authorize/decision, token, revoke) plus two metadata documents served via `next.config.ts` rewrites from `/.well-known/*`. A new server-rendered consent page lives at `/mcp/consent`. Five new Mongo collections (`mcpClients`, `mcpAuthCodes`, `mcpTokens`, `mcpAuthStates`, `mcpConsents`) plus an internal `mcpRateLimits` collection back the flow; all secrets are stored SHA-256-hashed, generated from a CSPRNG, single-use-enforced with atomic Mongo ops, and expiry-checked at use (never trusting TTL). The `/authorize` route reuses the app's existing landing-page Google sign-in by 302-redirecting unauthenticated users to `/?callbackUrl=…`; already-authenticated users skip straight to the post-login branch.

**Tech Stack:** Next.js 15 App Router (route handlers + one server component), Auth.js v5 (`auth()`, no second identity), MongoDB 6 driver, `mcp-handler@1.1.0` + `@modelcontextprotocol/sdk@1.26.0` (Resource-Server side only), zod 4, Node `crypto` (`randomBytes`/`createHash`/`timingSafeEqual`), Vitest 4 + RTL + `vi.mock('@/lib/mongodb')`.

**Spec:** `docs/superpowers/specs/2026-05-29-agent-connector-design.md` (§6.2, §6.4, §8a, §9, §10, §11 Phase 2). **Ledger:** `docs/superpowers/plans/mcp-connector-progress.md`. **Reference impl:** `bojanrajkovic/mcp-paprika` (`src/auth/`).

---

## Conventions used throughout this plan

- **Branch:** continue on `feat/mcp` (Phase 1 + 1.5 already landed there). No new branch.
- **Test command:** `npx vitest run <path>` (project mocks Mongo, so no real DB). Full validation only at the end: `npm run check` (lint + test:coverage + build) — run **once**.
- **Mongo access in code:** `const client = await getMongoClient(); const db = client.db();` then `db.collection('<name>')`.
- **Mongo mock in tests:** `vi.mock('@/lib/mongodb', () => ({ getMongoClient: vi.fn() }))`, then build a fake `db` whose `.collection(name)` returns an object with the methods the unit calls (`findOne`, `insertOne`, `findOneAndDelete`, `findOneAndUpdate`, `updateMany`, `deleteOne`). Helper pattern shown in Task 5; reuse it.
- **Time:** every store/endpoint takes `now: number` (ms) as a parameter (or `Date.now()` at the route boundary) so expiry is deterministically testable. Pass `Date.now()` from route handlers; pass a fixed number from unit tests.
- **Errors:** OAuth protocol errors use the RFC-literal codes from the new `MCP_OAUTH_ERRORS` group (Task 3) — this is the explicit exemption to the "no hardcoded strings" rule for RFC-defined wire constants (resolves spec §12 carryover (c)). Service-layer/domain errors keep using `@/lib/errors` + `service-errors.ts`.
- **userId:** the session user id (`session.user.id`) is the Mongo adapter `_id` as a hex string. The live approval lookup converts it with `ObjectId.createFromHexString` behind an `ObjectId.isValid` guard.
- **Exports:** named exports only. Files start with `"use client"` only if interactive client components (none here except none — the consent page is a server component).

## File structure (created/modified)

**New — OAuth lib (`src/lib/mcp/oauth/`):**

- `config.ts` — TTL/scope constants + `getIssuerUrl`/`getResourceUrl` derivation.
- `types.ts` — document interfaces for the six collections.
- `crypto.ts` — `generateSecret`, `sha256Hex`, `constantTimeEqual`, `pkceS256Matches`.
- `oauth-response.ts` — `oauthErrorJson`, `redirectWithError`, `redirectWithCode` (all emit `iss`).
- `stores/clients.ts`, `stores/auth-states.ts`, `stores/auth-codes.ts`, `stores/tokens.ts`, `stores/consents.ts`, `stores/rate-limit.ts`.

**New — routes (`src/app/api/mcp/oauth/`):**

- `register/route.ts`, `authorize/route.ts`, `authorize/decision/route.ts`, `token/route.ts`, `revoke/route.ts`, `protected-resource-metadata/route.ts`, `authorization-server-metadata/route.ts`.

**New — UI:**

- `src/app/mcp/consent/page.tsx` (server component) + `src/app/mcp/consent/__tests__/page.test.tsx`.

**Modified:**

- `src/lib/mcp/verify-token.ts` — rewritten (dev-token path removed; OAuth verifier).
- `src/app/api/[transport]/route.ts` — `resourceMetadataPath`/`resourceUrl` wiring; export metadata CORS `OPTIONS` unchanged.
- `src/lib/errors.ts` — add `MCP_OAUTH_ERRORS`.
- `src/lib/database-indexes.ts` — add the six collections to `createDatabaseIndexes` + `dropAllIndexes`.
- `next.config.ts` — `rewrites()` for `/.well-known/*`.
- Docs: `docs/architecture.md`, `CLAUDE.md`, the ledger.

---

## Spec → Task coverage map

| Spec ref                               | Requirement                              | Task |
| -------------------------------------- | ---------------------------------------- | ---- |
| §9 storage, S4 CSPRNG, M2/S1 hashing   | crypto helpers                           | 2    |
| §12(c)                                 | OAuth error constants                    | 3    |
| §9, MB                                 | collections + indexes + `dropAllIndexes` | 4    |
| §9 `mcpClients`, I6 TTL                | clients store                            | 5    |
| I4, A2, MC, test-001                   | auth-states store                        | 6    |
| §9 `mcpAuthCodes`, MA single-use       | auth-codes store                         | 7    |
| arch-001/002, S3, I5, T2, M2/S1        | tokens store                             | 8    |
| CS1 `mcpConsents`                      | consents store                           | 9    |
| I6                                     | rate-limit store                         | 10   |
| R4, RFC 9728                           | PRM metadata                             | 11   |
| RFC 8414                               | AS metadata                              | 12   |
| RFC 7591, S2, I6                       | `/register`                              | 13   |
| I4, sec-004, L5-S1, L6, R1, byte-match | `/authorize`                             | 14   |
| CS1 UI                                 | consent page                             | 15   |
| CS1, Deny, MD, L6                      | `/authorize/decision`                    | 16   |
| MA, sec-005, R2, I5, S3, T2, T4        | `/token`                                 | 17   |
| M3, RFC 7009                           | `/revoke`                                | 18   |
| §6.4, arch-001, M1, R3, T1, T3         | `verifyToken` rewrite                    | 19   |
| R4 wiring                              | `[transport]/route.ts`                   | 20   |
| C1                                     | dev-token-inert exit test                | 21   |
| R4 end-to-end                          | discovery integration test               | 22   |
| deploy                                 | infra + docs + ledger                    | 23   |

---

## Task 1: OAuth config + document types

**Files:**

- Create: `src/lib/mcp/oauth/config.ts`
- Create: `src/lib/mcp/oauth/types.ts`
- Test: `src/lib/mcp/oauth/__tests__/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/mcp/oauth/__tests__/config.test.ts`
Expected: FAIL — `Cannot find module '../config'`.

- [ ] **Step 3: Write `config.ts`**

```ts
// src/lib/mcp/oauth/config.ts
import { getPublicOrigin } from 'mcp-handler';

/** The single OAuth scope granted in v1 (a user's access to their own data). */
export const MCP_SCOPE = 'weekly-eats:rw';

/** Auth codes are single-use and extremely short-lived (seconds, §9 R6). */
export const AUTH_CODE_TTL_MS = 60_000;
/** Access tokens are short-lived; a refresh keeps active users connected. */
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
/** Refresh tokens use a sliding/idle TTL — reset on each rotation (I5/T2). */
export const REFRESH_TOKEN_IDLE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
/** In-flight /authorize state nonce lifetime (I4/A2). */
export const AUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10m

/** DCR per-IP throttle (I6). */
export const DCR_RATE_LIMIT = 10;
export const DCR_RATE_WINDOW_MS = 10 * 60 * 1000; // 10m

/**
 * Stable issuer for this deployment. `getPublicOrigin` respects Vercel's
 * forwarding headers (X-Forwarded-Host/Proto); MCP_ISSUER_URL is an explicit
 * override for fixed-host setups. Issuer + resource derive from the same source
 * so metadata, minted-token audience, and verifyToken stay self-consistent
 * within a single deployment.
 */
export function getIssuerUrl(req: Request): string {
  const override = process.env.MCP_ISSUER_URL;
  if (override) return override;
  return getPublicOrigin(req);
}

/** RFC 8707 resource indicator / token audience: the MCP endpoint URL. */
export function getResourceUrl(req: Request): string {
  return `${getIssuerUrl(req)}/api/mcp`;
}
```

- [ ] **Step 4: Write `types.ts`**

```ts
// src/lib/mcp/oauth/types.ts
import type { ObjectId } from 'mongodb';

export interface McpClientDoc {
  _id?: ObjectId;
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: number;
  lastUsedAt: number;
}

export interface McpAuthStateDoc {
  _id?: ObjectId;
  hashedState: string; // SHA-256 of the raw nonce
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scope: string;
  clientState: string | null; // the OAuth client's own `state`, echoed back verbatim
  expiresAt: number;
}

export interface McpAuthCodeDoc {
  _id?: ObjectId;
  hashedCode: string; // SHA-256 of the raw code
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  userId: string;
  scope: string;
  expiresAt: number;
}

export type McpTokenType = 'access' | 'refresh';

export interface McpTokenDoc {
  _id?: ObjectId;
  hashedToken: string; // SHA-256 of the raw token
  tokenType: McpTokenType;
  userId: string;
  clientId: string;
  resource: string;
  scope: string;
  /** Shared across an entire grant lineage (= SHA-256 of the originating auth code). */
  grantId: string;
  expiresAt: number;
  revokedAt: number | null;
  /** Refresh tokens only: hash of the token that replaced this one (rotation). */
  replacedBy: string | null;
}

export interface McpConsentDoc {
  _id?: ObjectId;
  userId: string;
  clientId: string;
  scope: string;
  grantedAt: number;
}

export interface McpRateLimitDoc {
  _id?: ObjectId;
  key: string; // e.g. `register:<ip>`
  count: number;
  windowStart: number;
  expiresAt: number;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/mcp/oauth/__tests__/config.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/mcp/oauth/config.ts src/lib/mcp/oauth/types.ts src/lib/mcp/oauth/__tests__/config.test.ts
git commit -m "feat(mcp): OAuth AS config constants + document types"
```

---

## Task 2: Crypto helpers (CSPRNG, hashing, PKCE, constant-time compare)

**Files:**

- Create: `src/lib/mcp/oauth/crypto.ts`
- Test: `src/lib/mcp/oauth/__tests__/crypto.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/mcp/oauth/__tests__/crypto.test.ts
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { constantTimeEqual, generateSecret, pkceS256Matches, sha256Hex } from '../crypto';

describe('oauth crypto', () => {
  it('generates a high-entropy, url-safe, unique secret each call (S4)', () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding
    // 32 random bytes → 43 base64url chars
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it('sha256Hex matches the node reference hash', () => {
    const value = 'hello-token';
    const expected = createHash('sha256').update(value).digest('hex');
    expect(sha256Hex(value)).toBe(expected);
  });

  it('constantTimeEqual is true for equal, false for different or different-length', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });

  it('pkceS256Matches verifies an S256 verifier→challenge pair', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    expect(pkceS256Matches(verifier, challenge)).toBe(true);
    expect(pkceS256Matches('wrong-verifier', challenge)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/mcp/oauth/__tests__/crypto.test.ts`
Expected: FAIL — `Cannot find module '../crypto'`.

- [ ] **Step 3: Write `crypto.ts`**

```ts
// src/lib/mcp/oauth/crypto.ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** CSPRNG secret, ≥256 bits, url-safe (tokens, codes, state nonces) — S4. */
export function generateSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex digest. Secrets are stored hashed at rest (M2/S1). */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Length-checked constant-time string compare. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** RFC 7636 S256: base64url(SHA-256(verifier)) === challenge (sec-004). */
export function pkceS256Matches(verifier: string, challenge: string): boolean {
  const computed = createHash('sha256').update(verifier).digest('base64url');
  return constantTimeEqual(computed, challenge);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/mcp/oauth/__tests__/crypto.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/oauth/crypto.ts src/lib/mcp/oauth/__tests__/crypto.test.ts
git commit -m "feat(mcp): OAuth crypto helpers (CSPRNG, SHA-256, PKCE S256, constant-time)"
```

---

## Task 3: OAuth protocol error constants + response helpers

**Files:**

- Modify: `src/lib/errors.ts` (add `MCP_OAUTH_ERRORS` after the existing groups, before `createErrorResponse` at line ~175)
- Create: `src/lib/mcp/oauth/oauth-response.ts`
- Test: `src/lib/mcp/oauth/__tests__/oauth-response.test.ts`

This resolves spec §12 carryover (c): OAuth wire error codes are RFC-literal constants (an explicit, documented exemption to the "no hardcoded strings" rule), grouped so they are not scattered string literals.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/mcp/oauth/__tests__/oauth-response.test.ts`
Expected: FAIL — `MCP_OAUTH_ERRORS` undefined / module not found.

- [ ] **Step 3: Add `MCP_OAUTH_ERRORS` to `src/lib/errors.ts`**

Insert this group after the last domain group and before `createErrorResponse` (≈ line 173):

```ts
// OAuth 2.1 protocol error codes (RFC 6749 §4.1.2.1 / §5.2, RFC 6750, RFC 8628).
// These are wire-format literals defined by the RFCs — kept here as the single
// source of truth. RFC-literal exemption to the "no hardcoded strings" rule.
export const MCP_OAUTH_ERRORS = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
  INVALID_SCOPE: 'invalid_scope',
  ACCESS_DENIED: 'access_denied',
  INVALID_TOKEN: 'invalid_token',
  SERVER_ERROR: 'server_error',
  // Custom (NOT an OAuth-RFC code): emitted by the rate-limited DCR endpoint.
  // Kept here so every wire error string has one source of truth.
  RATE_LIMITED: 'rate_limited',
} as const;

export type McpOAuthError = (typeof MCP_OAUTH_ERRORS)[keyof typeof MCP_OAUTH_ERRORS];
```

- [ ] **Step 4: Write `oauth-response.ts`**

```ts
// src/lib/mcp/oauth/oauth-response.ts
import { NextResponse } from 'next/server';
import type { McpOAuthError } from '@/lib/errors';

/** OAuth error as a JSON body (token/register endpoints). Always no-store. */
export function oauthErrorJson(
  error: McpOAuthError,
  description: string,
  status: number
): NextResponse {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { 'cache-control': 'no-store' } }
  );
}

function buildRedirect(redirectUri: string, params: Record<string, string | null>): NextResponse {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null) url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url.toString());
}

/** Error redirect back to the client. Emits `iss` on the error path too (R1). */
export function redirectWithError(args: {
  redirectUri: string;
  error: McpOAuthError;
  clientState: string | null;
  issuer: string;
  description?: string;
}): NextResponse {
  return buildRedirect(args.redirectUri, {
    error: args.error,
    error_description: args.description ?? null,
    state: args.clientState,
    iss: args.issuer,
  });
}

/** Success redirect carrying the auth code, echoed client state, and `iss` (R1). */
export function redirectWithCode(args: {
  redirectUri: string;
  code: string;
  clientState: string | null;
  issuer: string;
}): NextResponse {
  return buildRedirect(args.redirectUri, {
    code: args.code,
    state: args.clientState,
    iss: args.issuer,
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/mcp/oauth/__tests__/oauth-response.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/errors.ts src/lib/mcp/oauth/oauth-response.ts src/lib/mcp/oauth/__tests__/oauth-response.test.ts
git commit -m "feat(mcp): OAuth protocol error constants + redirect/JSON response helpers"
```

---

## Task 4: Database indexes for the six mcp\* collections

**Files:**

- Modify: `src/lib/database-indexes.ts` (add to `createDatabaseIndexes` before the closing `console.log`; add the six names to the `dropAllIndexes` array — MB)
- Test: `src/lib/__tests__/database-indexes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/database-indexes.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createIndex = vi.fn().mockResolvedValue('ok');
const dropIndexes = vi.fn().mockResolvedValue('ok');
const collection = vi.fn(() => ({ createIndex, dropIndexes }));

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({ db: () => ({ collection }) })),
}));

import { createDatabaseIndexes, dropAllIndexes } from '../database-indexes';

const MCP = [
  'mcpClients',
  'mcpAuthCodes',
  'mcpTokens',
  'mcpAuthStates',
  'mcpConsents',
  'mcpRateLimits',
];

describe('database indexes — mcp* collections', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates indexes on every mcp* collection (incl. TTL on expiry fields)', async () => {
    await createDatabaseIndexes();
    const touched = new Set(collection.mock.calls.map((c) => c[0]));
    for (const name of MCP) expect(touched.has(name)).toBe(true);

    // TTL index present on each expiry-bearing collection
    const ttlNames = createIndex.mock.calls
      .filter((c) => c[1]?.expireAfterSeconds === 0)
      .map((c) => c[1]?.name);
    expect(ttlNames).toEqual(
      expect.arrayContaining([
        'mcpAuthCodes_expiry_ttl',
        'mcpTokens_expiry_ttl',
        'mcpAuthStates_expiry_ttl',
        'mcpRateLimits_expiry_ttl',
      ])
    );
  });

  it('dropAllIndexes includes all six mcp* collections (MB)', async () => {
    await dropAllIndexes();
    const dropped = new Set(collection.mock.calls.map((c) => c[0]));
    for (const name of MCP) expect(dropped.has(name)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/__tests__/database-indexes.test.ts`
Expected: FAIL — mcp\* collections not touched.

- [ ] **Step 3: Add the index block to `createDatabaseIndexes`**

Insert immediately before `console.log('Database indexes created successfully');`:

```ts
// --- MCP OAuth Authorization Server collections (Phase 2, spec §9) ---

// mcpClients — registered DCR clients; unique clientId; TTL-less (reaped by
// lastUsedAt cleanup policy, I6).
const mcpClients = db.collection('mcpClients');
await mcpClients.createIndex({ clientId: 1 }, { name: 'mcpClients_clientId', unique: true });
await mcpClients.createIndex({ lastUsedAt: 1 }, { name: 'mcpClients_lastUsedAt' });

// mcpAuthCodes — single-use PKCE codes; lookup by hash; TTL on expiry.
const mcpAuthCodes = db.collection('mcpAuthCodes');
await mcpAuthCodes.createIndex(
  { hashedCode: 1 },
  { name: 'mcpAuthCodes_hashedCode', unique: true }
);
await mcpAuthCodes.createIndex(
  { expiresAt: 1 },
  { name: 'mcpAuthCodes_expiry_ttl', expireAfterSeconds: 0 }
);

// mcpTokens — access + refresh; lookup by hash; chain ops by grantId; TTL on expiry.
const mcpTokens = db.collection('mcpTokens');
await mcpTokens.createIndex({ hashedToken: 1 }, { name: 'mcpTokens_hashedToken', unique: true });
await mcpTokens.createIndex({ grantId: 1 }, { name: 'mcpTokens_grantId' });
await mcpTokens.createIndex(
  { expiresAt: 1 },
  { name: 'mcpTokens_expiry_ttl', expireAfterSeconds: 0 }
);

// mcpAuthStates — in-flight /authorize nonces; lookup by hash; TTL on expiry.
const mcpAuthStates = db.collection('mcpAuthStates');
await mcpAuthStates.createIndex(
  { hashedState: 1 },
  { name: 'mcpAuthStates_hashedState', unique: true }
);
await mcpAuthStates.createIndex(
  { expiresAt: 1 },
  { name: 'mcpAuthStates_expiry_ttl', expireAfterSeconds: 0 }
);

// mcpConsents — one row per (userId, clientId); exact-match consent skip (CS1).
const mcpConsents = db.collection('mcpConsents');
await mcpConsents.createIndex(
  { userId: 1, clientId: 1 },
  { name: 'mcpConsents_userId_clientId', unique: true }
);

// mcpRateLimits — DCR per-IP throttle (I6); lookup by key; TTL on expiry.
const mcpRateLimits = db.collection('mcpRateLimits');
await mcpRateLimits.createIndex({ key: 1 }, { name: 'mcpRateLimits_key', unique: true });
await mcpRateLimits.createIndex(
  { expiresAt: 1 },
  { name: 'mcpRateLimits_expiry_ttl', expireAfterSeconds: 0 }
);
```

- [ ] **Step 4: Add the six names to the `dropAllIndexes` array (MB)**

In the `collections` array inside `dropAllIndexes`, add the six entries (after `'purchaseHistory'`):

```ts
      'purchaseHistory',
      'mcpClients',
      'mcpAuthCodes',
      'mcpTokens',
      'mcpAuthStates',
      'mcpConsents',
      'mcpRateLimits',
      'manualTestState',
      'manualTestLocks',
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/database-indexes.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/database-indexes.ts src/lib/__tests__/database-indexes.test.ts
git commit -m "feat(mcp): indexes for the six OAuth AS collections + dropAllIndexes (MB)"
```

---

## Task 5: Clients store (DCR persistence)

**Files:**

- Create: `src/lib/mcp/oauth/stores/clients.ts`
- Create: `src/lib/mcp/oauth/stores/__tests__/test-db.ts` (shared fake-db helper, reused by Tasks 6–10)
- Test: `src/lib/mcp/oauth/stores/__tests__/clients.test.ts`

- [ ] **Step 1: Write the shared fake-db helper**

```ts
// src/lib/mcp/oauth/stores/__tests__/test-db.ts
import { vi } from 'vitest';

/**
 * Build an in-memory fake of the Mongo methods our stores use. Each collection
 * is backed by an array of docs; methods mutate it the way the real driver
 * (close enough) would. Returns the spies so tests can assert call args.
 */
export function makeFakeDb() {
  const store = new Map<string, any[]>();
  const col = (name: string) => {
    if (!store.has(name)) store.set(name, []);
    return store.get(name)!;
  };
  const matches = (doc: any, filter: any) =>
    Object.entries(filter).every(([k, v]) => {
      if (v && typeof v === 'object' && '$gt' in v) return doc[k] > (v as any).$gt;
      if (v === null) return doc[k] === null || doc[k] === undefined;
      return doc[k] === v;
    });

  const collection = vi.fn((name: string) => ({
    findOne: vi.fn(async (filter: any) => col(name).find((d) => matches(d, filter)) ?? null),
    insertOne: vi.fn(async (doc: any) => {
      col(name).push({ ...doc });
      return { insertedId: 'fake-id' };
    }),
    findOneAndDelete: vi.fn(async (filter: any) => {
      const arr = col(name);
      const i = arr.findIndex((d) => matches(d, filter));
      if (i === -1) return null;
      return arr.splice(i, 1)[0];
    }),
    findOneAndUpdate: vi.fn(async (filter: any, update: any) => {
      const arr = col(name);
      const i = arr.findIndex((d) => matches(d, filter));
      if (i === -1) return null;
      Object.assign(arr[i], update.$set ?? {});
      return arr[i];
    }),
    updateOne: vi.fn(async (filter: any, update: any, opts: any = {}) => {
      const arr = col(name);
      const i = arr.findIndex((d) => matches(d, filter));
      if (i === -1) {
        if (opts.upsert)
          arr.push({ ...filter, ...(update.$set ?? {}), ...(update.$setOnInsert ?? {}) });
        return { matchedCount: 0, upsertedCount: opts.upsert ? 1 : 0 };
      }
      Object.assign(arr[i], update.$set ?? {});
      return { matchedCount: 1, upsertedCount: 0 };
    }),
    updateMany: vi.fn(async (filter: any, update: any) => {
      let n = 0;
      for (const d of col(name))
        if (matches(d, filter)) {
          Object.assign(d, update.$set ?? {});
          n++;
        }
      return { matchedCount: n };
    }),
  }));

  return { db: { collection }, collection, store };
}
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/mcp/oauth/stores/__tests__/clients.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeDb } from './test-db';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { getClient, registerClient, touchClient } from '../clients';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

describe('clients store', () => {
  it('registerClient persists and getClient reads it back', async () => {
    const { clientId } = await registerClient(
      { clientName: 'Claude', redirectUris: ['https://claude.ai/cb'] },
      1000
    );
    expect(clientId).toMatch(/^[A-Za-z0-9_-]+$/);
    const doc = await getClient(clientId);
    expect(doc?.clientName).toBe('Claude');
    expect(doc?.redirectUris).toEqual(['https://claude.ai/cb']);
    expect(doc?.createdAt).toBe(1000);
  });

  it('getClient returns null for an unknown clientId (T4)', async () => {
    expect(await getClient('nope')).toBeNull();
  });

  it('touchClient updates lastUsedAt', async () => {
    const { clientId } = await registerClient(
      { clientName: 'C', redirectUris: ['https://x/cb'] },
      1000
    );
    await touchClient(clientId, 5000);
    expect((await getClient(clientId))?.lastUsedAt).toBe(5000);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/mcp/oauth/stores/__tests__/clients.test.ts`
Expected: FAIL — `Cannot find module '../clients'`.

- [ ] **Step 4: Write `clients.ts`**

```ts
// src/lib/mcp/oauth/stores/clients.ts
import { getMongoClient } from '@/lib/mongodb';
import { generateSecret } from '@/lib/mcp/oauth/crypto';
import type { McpClientDoc } from '@/lib/mcp/oauth/types';

async function clients() {
  const client = await getMongoClient();
  return client.db().collection<McpClientDoc>('mcpClients');
}

export async function registerClient(
  input: { clientName: string; redirectUris: string[] },
  now: number
): Promise<{ clientId: string }> {
  const clientId = generateSecret();
  await (
    await clients()
  ).insertOne({
    clientId,
    clientName: input.clientName,
    redirectUris: input.redirectUris,
    createdAt: now,
    lastUsedAt: now,
  });
  return { clientId };
}

export async function getClient(clientId: string): Promise<McpClientDoc | null> {
  return (await clients()).findOne({ clientId });
}

export async function touchClient(clientId: string, now: number): Promise<void> {
  await (await clients()).updateOne({ clientId }, { $set: { lastUsedAt: now } });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/mcp/oauth/stores/__tests__/clients.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/mcp/oauth/stores/clients.ts src/lib/mcp/oauth/stores/__tests__/
git commit -m "feat(mcp): clients store (DCR persistence) + shared fake-db test helper"
```

---

## Task 6: Auth-states store (I4 CSRF nonce, A2)

**Files:**

- Create: `src/lib/mcp/oauth/stores/auth-states.ts`
- Test: `src/lib/mcp/oauth/stores/__tests__/auth-states.test.ts`

The store keys on `sha256Hex(rawNonce)`. `createAuthState` returns `{ nonce, doc }` — the raw nonce (carried through the login round-trip) plus the inserted doc (so an already-authenticated caller skips a read-back, arch-004). `peekAuthState` reads without consuming (for the consent page render). `consumeAuthState` deletes (single-use) and enforces at-use expiry (R6).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/mcp/oauth/stores/__tests__/auth-states.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeDb } from './test-db';
import { sha256Hex } from '../../crypto';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { consumeAuthState, createAuthState, peekAuthState } from '../auth-states';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

const base = {
  clientId: 'c1',
  redirectUri: 'https://c/cb',
  codeChallenge: 'chal',
  resource: 'https://app.test/api/mcp',
  scope: 'weekly-eats:rw',
  clientState: 'client-xyz',
};

describe('auth-states store', () => {
  it('createAuthState returns the raw nonce + inserted doc; peek reads it by raw nonce', async () => {
    const { nonce, doc: created } = await createAuthState(base, 1000, 1000 + 600_000);
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    // the returned doc lets an authed caller skip a read-back (arch-004)
    expect(created.clientId).toBe('c1');
    expect(created.expiresAt).toBe(1000 + 600_000);
    const doc = await peekAuthState(nonce, 1000);
    expect(doc?.clientId).toBe('c1');
    expect(doc?.clientState).toBe('client-xyz');
  });

  it('peek rejects an expired state by at-use comparison (test-001/R6)', async () => {
    const { nonce } = await createAuthState(base, 1000, 1000 + 600_000);
    expect(await peekAuthState(nonce, 1000 + 600_001)).toBeNull();
  });

  it('consumeAuthState deletes (single-use) and returns the doc', async () => {
    const { nonce } = await createAuthState(base, 1000, 1000 + 600_000);
    expect(await consumeAuthState(nonce, 2000)).not.toBeNull();
    expect(await consumeAuthState(nonce, 2000)).toBeNull(); // gone
  });

  it('a nonce from session A is not found under a different nonce (MC isolation)', async () => {
    await createAuthState(base, 1000, 1000 + 600_000);
    expect(await peekAuthState('some-other-nonce', 1000)).toBeNull();
  });

  it('stores only the hash, never the raw nonce', async () => {
    const { nonce } = await createAuthState(base, 1000, 1000 + 600_000);
    const docs = fake.store.get('mcpAuthStates')!;
    expect(docs[0].hashedState).toBe(sha256Hex(nonce));
    expect(JSON.stringify(docs[0])).not.toContain(nonce);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/mcp/oauth/stores/__tests__/auth-states.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `auth-states.ts`**

```ts
// src/lib/mcp/oauth/stores/auth-states.ts
import { getMongoClient } from '@/lib/mongodb';
import { generateSecret, sha256Hex } from '@/lib/mcp/oauth/crypto';
import type { McpAuthStateDoc } from '@/lib/mcp/oauth/types';

async function states() {
  const client = await getMongoClient();
  return client.db().collection<McpAuthStateDoc>('mcpAuthStates');
}

type AuthStateInput = Omit<McpAuthStateDoc, '_id' | 'hashedState' | 'expiresAt'>;

/**
 * Creates a single-use state nonce. Returns the RAW nonce (stored hashed) AND
 * the inserted doc, so a caller that already has a session can proceed without
 * a redundant read-back of the row it just wrote (arch-004).
 */
export async function createAuthState(
  input: AuthStateInput,
  now: number,
  expiresAt: number
): Promise<{ nonce: string; doc: McpAuthStateDoc }> {
  const nonce = generateSecret();
  const doc: McpAuthStateDoc = {
    ...input,
    hashedState: sha256Hex(nonce),
    expiresAt,
  };
  await (await states()).insertOne(doc);
  return { nonce, doc };
}

/** Read without consuming (consent render). Enforces at-use expiry (R6). */
export async function peekAuthState(nonce: string, now: number): Promise<McpAuthStateDoc | null> {
  const doc = await (await states()).findOne({ hashedState: sha256Hex(nonce) });
  if (!doc || doc.expiresAt <= now) return null;
  return doc;
}

/** Single-use consume: delete + at-use expiry. Returns the doc, or null. */
export async function consumeAuthState(
  nonce: string,
  now: number
): Promise<McpAuthStateDoc | null> {
  const doc = await (await states()).findOneAndDelete({ hashedState: sha256Hex(nonce) });
  if (!doc || doc.expiresAt <= now) return null;
  return doc;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/mcp/oauth/stores/__tests__/auth-states.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/oauth/stores/auth-states.ts src/lib/mcp/oauth/stores/__tests__/auth-states.test.ts
git commit -m "feat(mcp): auth-states store (I4 CSRF nonce, single-use, at-use expiry)"
```

---

## Task 7: Auth-codes store (MA atomic single-use)

**Files:**

- Create: `src/lib/mcp/oauth/stores/auth-codes.ts`
- Test: `src/lib/mcp/oauth/stores/__tests__/auth-codes.test.ts`

`issueAuthCode` stores `sha256Hex(rawCode)` + all binding fields. `consumeAuthCode` uses an atomic `findOneAndDelete` (MA) and enforces at-use expiry (R6). The raw code is the grant lineage id later (`grantId = sha256Hex(rawCode)`), so the store also exposes `grantIdForCode`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/mcp/oauth/stores/__tests__/auth-codes.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeDb } from './test-db';
import { sha256Hex } from '../../crypto';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { consumeAuthCode, grantIdForCode, issueAuthCode } from '../auth-codes';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

const code = 'raw-code-value';
const fields = {
  clientId: 'c1',
  redirectUri: 'https://c/cb',
  codeChallenge: 'chal',
  resource: 'https://app.test/api/mcp',
  userId: 'u1',
  scope: 'weekly-eats:rw',
};

describe('auth-codes store', () => {
  it('issue + consume returns the bound fields once', async () => {
    await issueAuthCode(code, fields, 1000 + 60_000);
    const doc = await consumeAuthCode(code, 1000);
    expect(doc?.clientId).toBe('c1');
    expect(doc?.userId).toBe('u1');
  });

  it('a second consume of the same code returns null (single-use, MA)', async () => {
    await issueAuthCode(code, fields, 1000 + 60_000);
    expect(await consumeAuthCode(code, 1000)).not.toBeNull();
    expect(await consumeAuthCode(code, 1000)).toBeNull();
  });

  it('rejects an expired code at use (R6)', async () => {
    await issueAuthCode(code, fields, 1000 + 60_000);
    expect(await consumeAuthCode(code, 1000 + 60_001)).toBeNull();
  });

  it('grantIdForCode is the SHA-256 of the raw code', () => {
    expect(grantIdForCode(code)).toBe(sha256Hex(code));
  });

  it('stores only the code hash, never the raw code', async () => {
    await issueAuthCode(code, fields, 1000 + 60_000);
    const docs = fake.store.get('mcpAuthCodes')!;
    expect(docs[0].hashedCode).toBe(sha256Hex(code));
    expect(JSON.stringify(docs[0])).not.toContain(code);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/mcp/oauth/stores/__tests__/auth-codes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `auth-codes.ts`**

```ts
// src/lib/mcp/oauth/stores/auth-codes.ts
import { getMongoClient } from '@/lib/mongodb';
import { sha256Hex } from '@/lib/mcp/oauth/crypto';
import type { McpAuthCodeDoc } from '@/lib/mcp/oauth/types';

async function codes() {
  const client = await getMongoClient();
  return client.db().collection<McpAuthCodeDoc>('mcpAuthCodes');
}

type AuthCodeFields = Omit<McpAuthCodeDoc, '_id' | 'hashedCode' | 'expiresAt'>;

/** The grant lineage id derived from a raw code (tags tokens minted from it). */
export function grantIdForCode(rawCode: string): string {
  return sha256Hex(rawCode);
}

export async function issueAuthCode(
  rawCode: string,
  fields: AuthCodeFields,
  expiresAt: number
): Promise<void> {
  await (await codes()).insertOne({ ...fields, hashedCode: sha256Hex(rawCode), expiresAt });
}

/** Atomic single-use consume (MA) + at-use expiry (R6). */
export async function consumeAuthCode(
  rawCode: string,
  now: number
): Promise<McpAuthCodeDoc | null> {
  const doc = await (await codes()).findOneAndDelete({ hashedCode: sha256Hex(rawCode) });
  if (!doc || doc.expiresAt <= now) return null;
  return doc;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/mcp/oauth/stores/__tests__/auth-codes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/oauth/stores/auth-codes.ts src/lib/mcp/oauth/stores/__tests__/auth-codes.test.ts
git commit -m "feat(mcp): auth-codes store (atomic single-use findOneAndDelete, at-use expiry)"
```

---

## Task 8: Tokens store (mint, lookup, atomic rotation, chain revocation) — security core

**Files:**

- Create: `src/lib/mcp/oauth/stores/tokens.ts`
- Test: `src/lib/mcp/oauth/stores/__tests__/tokens.test.ts`

This is the highest-risk module. Behaviors:

- `mintPair(grantId, fields, now)` — insert an access doc (`tokenType:'access'`, expiry `now+ACCESS_TTL`) and a refresh doc (`tokenType:'refresh'`, expiry `now+IDLE_TTL`, `replacedBy:null`), both tagged with `grantId`. Returns the raw access + refresh secrets.
- `findValidAccessToken(rawToken, now)` — by `sha256Hex`, **`tokenType:'access'` only** (arch-001 — a refresh presented as bearer must not match), `revokedAt:null`, at-use expiry (R6).
- `findRefreshToken(rawToken)` — by hash, `tokenType:'refresh'` only (for the /token refresh branch; expiry/revocation checked by the caller so reuse can trigger chain revoke).
- `rotateRefresh(oldRawRefresh, grantId, fields, now)` — **atomic** `findOneAndUpdate` (filter: `hashedToken` + `replacedBy:null` + `revokedAt:null`; set `replacedBy = sha256Hex(newRefresh)`) (S3). If it matched, mint a new access + refresh under the same `grantId` and return them. If it did **not** match, the token was already rotated/revoked → return `null` so the caller revokes the chain.
- `revokeChain(grantId, now)` — set `revokedAt` on every token sharing the grant (rotated-replay → whole-chain revoke).
- `revokeByHash(rawToken, now)` — set `revokedAt` on one token (the `/revoke` endpoint, M3).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/mcp/oauth/stores/__tests__/tokens.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeDb } from './test-db';
import { sha256Hex } from '../../crypto';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import {
  findRefreshToken,
  findValidAccessToken,
  mintPair,
  revokeByHash,
  revokeChain,
  rotateRefresh,
} from '../tokens';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

const fields = {
  userId: 'u1',
  clientId: 'c1',
  resource: 'https://app.test/api/mcp',
  scope: 'weekly-eats:rw',
};
const NOW = 1_000_000;

describe('tokens store', () => {
  it('mintPair issues an access + refresh under one grantId', async () => {
    const { accessToken, refreshToken } = await mintPair('grant-1', fields, NOW);
    const acc = await findValidAccessToken(accessToken, NOW);
    expect(acc?.userId).toBe('u1');
    expect(acc?.tokenType).toBe('access');
    const ref = await findRefreshToken(refreshToken);
    expect(ref?.tokenType).toBe('refresh');
    expect(ref?.grantId).toBe('grant-1');
  });

  it('a refresh token presented as a bearer does NOT match (arch-001)', async () => {
    const { refreshToken } = await mintPair('grant-1', fields, NOW);
    expect(await findValidAccessToken(refreshToken, NOW)).toBeNull();
  });

  it('submitting sha256Hex(T) as the bearer does NOT authenticate (T1 negative)', async () => {
    // Proves the QUERY-side hash step is live: the store hashes the incoming
    // bearer, so a pre-hashed value hashes again and cannot match the stored hash.
    const { accessToken } = await mintPair('grant-1', fields, NOW);
    expect(await findValidAccessToken(sha256Hex(accessToken), NOW)).toBeNull();
  });

  it('an expired access token is rejected at use (R6)', async () => {
    const { accessToken } = await mintPair('grant-1', fields, NOW);
    expect(await findValidAccessToken(accessToken, NOW + 60 * 60 * 1000 + 1)).toBeNull();
  });

  it('a revoked access token is rejected (M3/T3-store)', async () => {
    const { accessToken } = await mintPair('grant-1', fields, NOW);
    await revokeByHash(accessToken, NOW + 1);
    expect(await findValidAccessToken(accessToken, NOW + 2)).toBeNull();
  });

  // Note (test-003): this exercises SEQUENTIAL reuse detection. True concurrent
  // rotation (two simultaneous findOneAndUpdate calls before either completes) is
  // untestable with a single-threaded fake DB. The S3 atomicity guarantee comes
  // from MongoDB's server-side atomic findOneAndUpdate: the filter
  // {hashedToken, replacedBy:null, revokedAt:null} lets exactly one concurrent
  // caller match and set replacedBy; all others find it set and get null. This
  // sequential test is the accepted unit-level substitute for the concurrent case.
  it('rotateRefresh succeeds once; the old refresh cannot rotate again (S3)', async () => {
    const { refreshToken } = await mintPair('grant-1', fields, NOW);
    const rotated = await rotateRefresh(refreshToken, 'grant-1', fields, NOW + 10);
    expect(rotated).not.toBeNull();
    // second rotation of the SAME old token fails (replacedBy now set)
    expect(await rotateRefresh(refreshToken, 'grant-1', fields, NOW + 20)).toBeNull();
  });

  it('the new refresh from rotation gets a fresh sliding expiry (T2)', async () => {
    const { refreshToken } = await mintPair('grant-1', fields, NOW);
    const rotated = await rotateRefresh(refreshToken, 'grant-1', fields, NOW + 10);
    const newRef = await findRefreshToken(rotated!.refreshToken);
    expect(newRef?.expiresAt).toBe(NOW + 10 + 30 * 24 * 60 * 60 * 1000);
  });

  it('revokeChain revokes every token sharing the grant', async () => {
    const { accessToken, refreshToken } = await mintPair('grant-1', fields, NOW);
    await revokeChain('grant-1', NOW + 5);
    expect(await findValidAccessToken(accessToken, NOW + 6)).toBeNull();
    expect((await findRefreshToken(refreshToken))?.revokedAt).toBe(NOW + 5);
  });

  it('mintPair stores only hashes, never the raw secrets (M2/S1)', async () => {
    const { accessToken, refreshToken } = await mintPair('grant-1', fields, NOW);
    const docs = fake.store.get('mcpTokens')!;
    const blob = JSON.stringify(docs);
    expect(blob).not.toContain(accessToken);
    expect(blob).not.toContain(refreshToken);
    expect(docs.some((d) => d.hashedToken === sha256Hex(accessToken))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/mcp/oauth/stores/__tests__/tokens.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `tokens.ts`**

```ts
// src/lib/mcp/oauth/stores/tokens.ts
import { getMongoClient } from '@/lib/mongodb';
import { generateSecret, sha256Hex } from '@/lib/mcp/oauth/crypto';
import { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_IDLE_TTL_MS } from '@/lib/mcp/oauth/config';
import type { McpTokenDoc } from '@/lib/mcp/oauth/types';

async function tokens() {
  const client = await getMongoClient();
  return client.db().collection<McpTokenDoc>('mcpTokens');
}

type GrantFields = Pick<McpTokenDoc, 'userId' | 'clientId' | 'resource' | 'scope'>;

/** Mint an access + refresh pair under one grant lineage. Returns RAW secrets. */
export async function mintPair(
  grantId: string,
  fields: GrantFields,
  now: number
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = generateSecret();
  const refreshToken = generateSecret();
  const col = await tokens();
  await col.insertOne({
    ...fields,
    hashedToken: sha256Hex(accessToken),
    tokenType: 'access',
    grantId,
    expiresAt: now + ACCESS_TOKEN_TTL_MS,
    revokedAt: null,
    replacedBy: null,
  });
  await col.insertOne({
    ...fields,
    hashedToken: sha256Hex(refreshToken),
    tokenType: 'refresh',
    grantId,
    expiresAt: now + REFRESH_TOKEN_IDLE_TTL_MS,
    revokedAt: null,
    replacedBy: null,
  });
  return { accessToken, refreshToken };
}

/** Bearer lookup for verifyToken: access-only, non-revoked, non-expired at use. */
export async function findValidAccessToken(
  rawToken: string,
  now: number
): Promise<McpTokenDoc | null> {
  const doc = await (
    await tokens()
  ).findOne({
    hashedToken: sha256Hex(rawToken),
    tokenType: 'access',
    revokedAt: null,
  });
  if (!doc || doc.expiresAt <= now) return null;
  return doc;
}

/** Refresh lookup for /token (expiry/revocation handled by the caller). */
export async function findRefreshToken(rawToken: string): Promise<McpTokenDoc | null> {
  return (await tokens()).findOne({ hashedToken: sha256Hex(rawToken), tokenType: 'refresh' });
}

/**
 * Atomic rotation (S3): consume the old refresh (filter requires replacedBy
 * null + revokedAt null) and, only if that succeeded, mint a new pair under the
 * same grant. Returns null when the old token was already rotated/revoked — the
 * caller treats that as reuse and revokes the chain.
 */
export async function rotateRefresh(
  oldRawRefresh: string,
  grantId: string,
  fields: GrantFields,
  now: number
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const newRefresh = generateSecret();
  // The filter also requires a non-expired token (expiresAt > now) so the store
  // self-enforces at-use expiry (arch-002), consistent with findValidAccessToken
  // — a future caller can't mint a fresh pair from an expired-but-unreaped link.
  const claimed = await (
    await tokens()
  ).findOneAndUpdate(
    {
      hashedToken: sha256Hex(oldRawRefresh),
      replacedBy: null,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { replacedBy: sha256Hex(newRefresh) } }
  );
  if (!claimed) return null;

  const accessToken = generateSecret();
  const col = await tokens();
  await col.insertOne({
    ...fields,
    hashedToken: sha256Hex(accessToken),
    tokenType: 'access',
    grantId,
    expiresAt: now + ACCESS_TOKEN_TTL_MS,
    revokedAt: null,
    replacedBy: null,
  });
  await col.insertOne({
    ...fields,
    hashedToken: sha256Hex(newRefresh),
    tokenType: 'refresh',
    grantId,
    expiresAt: now + REFRESH_TOKEN_IDLE_TTL_MS,
    revokedAt: null,
    replacedBy: null,
  });
  return { accessToken, refreshToken: newRefresh };
}

/** Revoke every token in a grant lineage (rotated-token replay → kill chain). */
export async function revokeChain(grantId: string, now: number): Promise<void> {
  await (await tokens()).updateMany({ grantId }, { $set: { revokedAt: now } });
}

/** Revoke a single token by raw value (RFC 7009 /revoke, M3). */
export async function revokeByHash(rawToken: string, now: number): Promise<void> {
  await (
    await tokens()
  ).updateOne({ hashedToken: sha256Hex(rawToken) }, { $set: { revokedAt: now } });
}
```

> **Note for the implementer:** the `rotateRefresh` "new refresh shares the same grantId" line is what makes reuse-detection chain revocation work. Do **not** assign a new grantId on rotation — the lineage must be stable so `revokeChain` reaches every link (matches spec §6.2 S3 and the rotated-token-replay test in Task 17).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/mcp/oauth/stores/__tests__/tokens.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/oauth/stores/tokens.ts src/lib/mcp/oauth/stores/__tests__/tokens.test.ts
git commit -m "feat(mcp): tokens store (mint/lookup/atomic rotation/chain revocation, hashed at rest)"
```

---

## Task 9: Consents store (CS1 exact-match skip)

**Files:**

- Create: `src/lib/mcp/oauth/stores/consents.ts`
- Test: `src/lib/mcp/oauth/stores/__tests__/consents.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/mcp/oauth/stores/__tests__/consents.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeDb } from './test-db';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { grantConsent, hasConsent } from '../consents';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

describe('consents store', () => {
  it('hasConsent is false before granting', async () => {
    expect(await hasConsent('u1', 'c1', 'weekly-eats:rw')).toBe(false);
  });

  it('grantConsent then hasConsent matches on exact (userId, clientId, scope)', async () => {
    await grantConsent('u1', 'c1', 'weekly-eats:rw', 1000);
    expect(await hasConsent('u1', 'c1', 'weekly-eats:rw')).toBe(true);
  });

  it('a different clientId does not match (silent-authorization guard)', async () => {
    await grantConsent('u1', 'c1', 'weekly-eats:rw', 1000);
    expect(await hasConsent('u1', 'c2', 'weekly-eats:rw')).toBe(false);
  });

  it('a different scope does not match', async () => {
    await grantConsent('u1', 'c1', 'weekly-eats:rw', 1000);
    expect(await hasConsent('u1', 'c1', 'other-scope')).toBe(false);
  });

  it('grantConsent is idempotent (re-grant updates the row, no duplicate)', async () => {
    await grantConsent('u1', 'c1', 'weekly-eats:rw', 1000);
    await grantConsent('u1', 'c1', 'weekly-eats:rw', 2000);
    expect(fake.store.get('mcpConsents')!.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/mcp/oauth/stores/__tests__/consents.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `consents.ts`**

```ts
// src/lib/mcp/oauth/stores/consents.ts
import { getMongoClient } from '@/lib/mongodb';
import type { McpConsentDoc } from '@/lib/mcp/oauth/types';

async function consents() {
  const client = await getMongoClient();
  return client.db().collection<McpConsentDoc>('mcpConsents');
}

/** Exact (userId, clientId, scope) match — a new client or scope re-prompts (CS1). */
export async function hasConsent(
  userId: string,
  clientId: string,
  scope: string
): Promise<boolean> {
  const doc = await (await consents()).findOne({ userId, clientId });
  return doc?.scope === scope;
}

export async function grantConsent(
  userId: string,
  clientId: string,
  scope: string,
  now: number
): Promise<void> {
  await (
    await consents()
  ).updateOne(
    { userId, clientId },
    { $set: { scope, grantedAt: now }, $setOnInsert: { userId, clientId } },
    { upsert: true }
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/mcp/oauth/stores/__tests__/consents.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/oauth/stores/consents.ts src/lib/mcp/oauth/stores/__tests__/consents.test.ts
git commit -m "feat(mcp): consents store (CS1 exact-match consent skip)"
```

---

## Task 10: Rate-limit store (I6 DCR per-IP throttle)

**Files:**

- Create: `src/lib/mcp/oauth/stores/rate-limit.ts`
- Test: `src/lib/mcp/oauth/stores/__tests__/rate-limit.test.ts`

Fixed-window counter keyed on `register:<ip>`. `consumeRateLimit` increments and returns `{ allowed }`. A new window starts when the stored `windowStart` is older than the window.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/mcp/oauth/stores/__tests__/rate-limit.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeDb } from './test-db';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { consumeRateLimit } from '../rate-limit';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

describe('rate-limit store', () => {
  it('allows up to the limit, then blocks within the window', async () => {
    const key = 'register:1.2.3.4';
    for (let i = 0; i < 3; i++) {
      const r = await consumeRateLimit(key, 3, 10_000, 1000);
      expect(r.allowed).toBe(true);
    }
    const blocked = await consumeRateLimit(key, 3, 10_000, 1000);
    expect(blocked.allowed).toBe(false);
  });

  it('resets after the window elapses', async () => {
    const key = 'register:1.2.3.4';
    for (let i = 0; i < 3; i++) await consumeRateLimit(key, 3, 10_000, 1000);
    const afterWindow = await consumeRateLimit(key, 3, 10_000, 12_000);
    expect(afterWindow.allowed).toBe(true);
  });

  it('tracks distinct keys independently', async () => {
    await consumeRateLimit('register:a', 1, 10_000, 1000);
    expect((await consumeRateLimit('register:a', 1, 10_000, 1000)).allowed).toBe(false);
    expect((await consumeRateLimit('register:b', 1, 10_000, 1000)).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/mcp/oauth/stores/__tests__/rate-limit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `rate-limit.ts`**

```ts
// src/lib/mcp/oauth/stores/rate-limit.ts
import { getMongoClient } from '@/lib/mongodb';
import type { McpRateLimitDoc } from '@/lib/mcp/oauth/types';

async function limits() {
  const client = await getMongoClient();
  return client.db().collection<McpRateLimitDoc>('mcpRateLimits');
}

/**
 * Fixed-window per-key counter. Returns { allowed } for this hit. A new window
 * starts when the stored windowStart is older than windowMs. expiresAt feeds the
 * TTL index (cleanup only — the windowStart comparison is the real gate).
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number
): Promise<{ allowed: boolean }> {
  const col = await limits();
  const doc = await col.findOne({ key });
  if (!doc || now - doc.windowStart >= windowMs) {
    await col.updateOne(
      { key },
      { $set: { key, count: 1, windowStart: now, expiresAt: now + windowMs } },
      { upsert: true }
    );
    return { allowed: true };
  }
  if (doc.count >= limit) return { allowed: false };
  await col.updateOne({ key }, { $set: { count: doc.count + 1 } });
  return { allowed: true };
}
```

> **Serverless note:** this is a best-effort throttle (read-then-write, not fully atomic across concurrent instances). That is acceptable for the DCR abuse-bounding goal (I6) — it is a bound, not a hard security control; the real authorization boundary is the approval allowlist. If precise limiting is ever needed, switch the increment to an atomic `findOneAndUpdate` with `$inc` and a window-conditional filter.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/mcp/oauth/stores/__tests__/rate-limit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/oauth/stores/rate-limit.ts src/lib/mcp/oauth/stores/__tests__/rate-limit.test.ts
git commit -m "feat(mcp): rate-limit store (I6 DCR per-IP fixed-window throttle)"
```

---

## Task 11: Protected Resource Metadata (RFC 9728) + well-known rewrites

**Files:**

- Modify: `next.config.ts` (add `rewrites()`)
- Create: `src/app/api/mcp/oauth/protected-resource-metadata/route.ts`
- Test: `src/app/api/mcp/oauth/protected-resource-metadata/__tests__/route.test.ts`

Next.js ignores dot-prefixed dirs, so the `/.well-known/*` URLs are served via rewrites to normal route handlers. PRM is built with `generateProtectedResourceMetadata` (mcp-handler), adding `scopes_supported` via `additionalMetadata`.

- [ ] **Step 1: Add `rewrites()` to `next.config.ts`**

Add inside `nextConfig` (after `images: {...}`):

```ts
  async rewrites() {
    return [
      {
        source: '/.well-known/oauth-protected-resource',
        destination: '/api/mcp/oauth/protected-resource-metadata',
      },
      {
        source: '/.well-known/oauth-protected-resource/:path*',
        destination: '/api/mcp/oauth/protected-resource-metadata',
      },
      {
        source: '/.well-known/oauth-authorization-server',
        destination: '/api/mcp/oauth/authorization-server-metadata',
      },
      {
        source: '/.well-known/oauth-authorization-server/:path*',
        destination: '/api/mcp/oauth/authorization-server-metadata',
      },
    ];
  },
```

- [ ] **Step 2: Write the failing test**

```ts
// src/app/api/mcp/oauth/protected-resource-metadata/__tests__/route.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';

afterEach(() => vi.unstubAllEnvs());

function req() {
  return new Request('https://app.test/.well-known/oauth-protected-resource', {
    headers: { 'x-forwarded-host': 'weekly-eats.vercel.app', 'x-forwarded-proto': 'https' },
  });
}

describe('protected resource metadata (RFC 9728)', () => {
  it('serves a well-formed PRM document advertising the AS + scope', async () => {
    vi.stubEnv('MCP_ISSUER_URL', '');
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resource).toBe('https://weekly-eats.vercel.app/api/mcp');
    expect(body.authorization_servers).toEqual(['https://weekly-eats.vercel.app']);
    expect(body.scopes_supported).toEqual(['weekly-eats:rw']);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/app/api/mcp/oauth/protected-resource-metadata/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 4: Write the route**

```ts
// src/app/api/mcp/oauth/protected-resource-metadata/route.ts
import { generateProtectedResourceMetadata, metadataCorsOptionsRequestHandler } from 'mcp-handler';
import { getIssuerUrl, getResourceUrl, MCP_SCOPE } from '@/lib/mcp/oauth/config';

export function GET(req: Request): Response {
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [getIssuerUrl(req)],
    resourceUrl: getResourceUrl(req),
    additionalMetadata: { scopes_supported: [MCP_SCOPE] },
  });
  return Response.json(metadata, { headers: { 'cache-control': 'public, max-age=3600' } });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/app/api/mcp/oauth/protected-resource-metadata/__tests__/route.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add next.config.ts src/app/api/mcp/oauth/protected-resource-metadata/
git commit -m "feat(mcp): RFC 9728 Protected Resource Metadata + well-known rewrites"
```

---

## Task 12: Authorization Server Metadata (RFC 8414)

**Files:**

- Create: `src/app/api/mcp/oauth/authorization-server-metadata/route.ts`
- Test: `src/app/api/mcp/oauth/authorization-server-metadata/__tests__/route.test.ts`

Hand-rolled AS metadata. Advertises authorize/token/register/revoke endpoints, `code_challenge_methods_supported: ["S256"]` (sec-004), the single scope, and `authorization_response_iss_parameter_supported: true` (R1).

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/mcp/oauth/authorization-server-metadata/__tests__/route.test.ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/api/mcp/oauth/authorization-server-metadata/__tests__/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the route**

```ts
// src/app/api/mcp/oauth/authorization-server-metadata/route.ts
import { metadataCorsOptionsRequestHandler } from 'mcp-handler';
import { getIssuerUrl, MCP_SCOPE } from '@/lib/mcp/oauth/config';

export function GET(req: Request): Response {
  const issuer = getIssuerUrl(req);
  const metadata = {
    issuer,
    authorization_endpoint: `${issuer}/api/mcp/oauth/authorize`,
    token_endpoint: `${issuer}/api/mcp/oauth/token`,
    registration_endpoint: `${issuer}/api/mcp/oauth/register`,
    revocation_endpoint: `${issuer}/api/mcp/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [MCP_SCOPE],
    // RFC 9207 — we emit `iss` on every authorization response (R1).
    authorization_response_iss_parameter_supported: true,
  };
  return Response.json(metadata, { headers: { 'cache-control': 'public, max-age=3600' } });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/mcp/oauth/authorization-server-metadata/__tests__/route.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mcp/oauth/authorization-server-metadata/
git commit -m "feat(mcp): RFC 8414 Authorization Server Metadata (S256-only, iss support)"
```

---

## Task 13: `/register` — Dynamic Client Registration (RFC 7591)

**Files:**

- Create: `src/lib/mcp/oauth/request-ip.ts` (shared client-IP extraction)
- Create: `src/app/api/mcp/oauth/register/route.ts`
- Test: `src/app/api/mcp/oauth/register/__tests__/route.test.ts`

Validates `redirect_uris` (HTTPS, or `http://localhost`/`127.0.0.1` per RFC 8252 — S2), rate-limits per IP (I6), stores the client, returns the RFC 7591 response. Stores `redirect_uris` verbatim for later byte-match (S2).

- [ ] **Step 1: Write the client-IP helper**

```ts
// src/lib/mcp/oauth/request-ip.ts
/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
```

- [ ] **Step 2: Write the failing test**

```ts
// src/app/api/mcp/oauth/register/__tests__/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { makeFakeDb } from '@/lib/mcp/oauth/stores/__tests__/test-db';
import { POST } from '../route';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

function post(body: unknown, ip = '1.2.3.4') {
  return new Request('https://app.test/api/mcp/oauth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('POST /register (DCR)', () => {
  it('registers a client and returns client_id + echoed metadata', async () => {
    const res = await POST(
      post({ client_name: 'Claude', redirect_uris: ['https://claude.ai/cb'] })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.client_id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(body.redirect_uris).toEqual(['https://claude.ai/cb']);
    expect(body.token_endpoint_auth_method).toBe('none');
  });

  it('accepts http://localhost redirect_uris (RFC 8252)', async () => {
    const res = await POST(post({ redirect_uris: ['http://localhost:8080/cb'] }));
    expect(res.status).toBe(201);
  });

  it('rejects a non-HTTPS non-localhost redirect_uri → 400 (S2)', async () => {
    const res = await POST(post({ redirect_uris: ['http://attacker.example/cb'] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_redirect_uri');
  });

  it('rejects an empty redirect_uris → 400', async () => {
    const res = await POST(post({ redirect_uris: [] }));
    expect(res.status).toBe(400);
  });

  it('rate-limits a flood from one IP → 429 (I6)', async () => {
    let last: Response | undefined;
    for (let i = 0; i < 12; i++) {
      last = await POST(post({ redirect_uris: ['https://claude.ai/cb'] }, '9.9.9.9'));
    }
    expect(last!.status).toBe(429);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/app/api/mcp/oauth/register/__tests__/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the route**

```ts
// src/app/api/mcp/oauth/register/route.ts
import { NextResponse } from 'next/server';
import { DCR_RATE_LIMIT, DCR_RATE_WINDOW_MS } from '@/lib/mcp/oauth/config';
import { registerClient } from '@/lib/mcp/oauth/stores/clients';
import { consumeRateLimit } from '@/lib/mcp/oauth/stores/rate-limit';
import { getClientIp } from '@/lib/mcp/oauth/request-ip';
import { logError, MCP_OAUTH_ERRORS } from '@/lib/errors';

// RFC 8252: only HTTPS, or loopback http, redirect URIs are accepted (S2).
function isValidRedirectUri(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.protocol === 'https:') return true;
  if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
    return true;
  }
  return false;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const now = Date.now();
    const ip = getClientIp(req);
    const { allowed } = await consumeRateLimit(
      `register:${ip}`,
      DCR_RATE_LIMIT,
      DCR_RATE_WINDOW_MS,
      now
    );
    if (!allowed) {
      return NextResponse.json(
        { error: MCP_OAUTH_ERRORS.RATE_LIMITED, error_description: 'Too many registrations' },
        { status: 429, headers: { 'cache-control': 'no-store' } }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      client_name?: unknown;
      redirect_uris?: unknown;
    } | null;
    const redirectUris = Array.isArray(body?.redirect_uris) ? body!.redirect_uris : [];
    if (
      redirectUris.length === 0 ||
      !redirectUris.every((u): u is string => typeof u === 'string' && isValidRedirectUri(u))
    ) {
      return NextResponse.json(
        {
          error: 'invalid_redirect_uri',
          error_description: 'redirect_uris must be HTTPS or loopback',
        },
        { status: 400, headers: { 'cache-control': 'no-store' } }
      );
    }
    const clientName = typeof body?.client_name === 'string' ? body.client_name : 'MCP Client';

    const { clientId } = await registerClient({ clientName, redirectUris }, now);

    return NextResponse.json(
      {
        client_id: clientId,
        client_name: clientName,
        redirect_uris: redirectUris,
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      },
      { status: 201, headers: { 'cache-control': 'no-store' } }
    );
  } catch (error) {
    logError('McpOAuthRegister', error);
    return NextResponse.json(
      { error: MCP_OAUTH_ERRORS.SERVER_ERROR },
      { status: 500, headers: { 'cache-control': 'no-store' } }
    );
  }
}
```

> **Note:** the DCR response uses RFC 7591 field names (`client_id`, `redirect_uris`, `token_endpoint_auth_method`) — wire literals, not subject to the `@/lib/errors` rule. Two error codes are distinct categories: `invalid_redirect_uri` is an RFC 7591 §3.2.2-defined code, kept inline as an RFC-literal local to this endpoint; `rate_limited` is **not** an OAuth-RFC code (custom extension) and so lives in `MCP_OAUTH_ERRORS.RATE_LIMITED` (Task 3) as the single source of truth, used via the constant above.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/app/api/mcp/oauth/register/__tests__/route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/mcp/oauth/request-ip.ts src/app/api/mcp/oauth/register/
git commit -m "feat(mcp): /register DCR endpoint (RFC 7591, S2 redirect validation, I6 rate limit)"
```

---

## Task 14a: Approval lookup + code-issuance helpers (shared)

**Files:**

- Create: `src/lib/mcp/oauth/approval.ts` (live `users` lookup — used by authorize, token-refresh, verifyToken)
- Create: `src/lib/mcp/oauth/authorize-core.ts` (mint-code-and-redirect — used by authorize consent-skip + decision Allow)
- Test: `src/lib/mcp/oauth/__tests__/approval.test.ts`
- Test: `src/lib/mcp/oauth/__tests__/authorize-core.test.ts`

- [ ] **Step 1: Write the failing approval test**

```ts
// src/lib/mcp/oauth/__tests__/approval.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { lookupApproval } from '../approval';

const findOne = vi.fn();
beforeEach(() => {
  findOne.mockReset();
  getMongoClient.mockResolvedValue({ db: () => ({ collection: () => ({ findOne }) }) });
});

const id = new ObjectId().toHexString();

describe('lookupApproval', () => {
  it('returns flags for an approved user', async () => {
    findOne.mockResolvedValue({ isApproved: true, isAdmin: false });
    expect(await lookupApproval(id)).toEqual({ isApproved: true, isAdmin: false });
  });

  it('returns null for an unknown user', async () => {
    findOne.mockResolvedValue(null);
    expect(await lookupApproval(id)).toBeNull();
  });

  it('returns null (not a throw) for a malformed user id', async () => {
    expect(await lookupApproval('not-an-objectid')).toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('coerces missing flags to false (fail-closed)', async () => {
    findOne.mockResolvedValue({});
    expect(await lookupApproval(id)).toEqual({ isApproved: false, isAdmin: false });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**, then **write `approval.ts`**

Run: `npx vitest run src/lib/mcp/oauth/__tests__/approval.test.ts` → FAIL (module not found).

```ts
// src/lib/mcp/oauth/approval.ts
import { ObjectId } from 'mongodb';
import { getMongoClient } from '@/lib/mongodb';

export interface ApprovalFlags {
  isApproved: boolean;
  isAdmin: boolean;
}

/**
 * Live `users` lookup by id (M1). Returns null for a malformed id or an unknown
 * user; coerces missing flags to false (fail-closed). The caller enforces
 * `isApproved || isAdmin`. This is the intentional departure from the
 * JWT-cached web-app pattern — revoked approval takes effect immediately.
 */
export async function lookupApproval(userId: string): Promise<ApprovalFlags | null> {
  if (!ObjectId.isValid(userId)) return null;
  const client = await getMongoClient();
  const user = await client
    .db()
    .collection('users')
    .findOne({ _id: ObjectId.createFromHexString(userId) });
  if (!user) return null;
  return { isApproved: user.isApproved === true, isAdmin: user.isAdmin === true };
}
```

- [ ] **Step 3: Write the failing authorize-core test**

```ts
// src/lib/mcp/oauth/__tests__/authorize-core.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const issueAuthCode = vi.fn();
const consumeAuthState = vi.fn();
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
```

- [ ] **Step 4: Run it to verify it fails**, then **write `authorize-core.ts`**

Run: `npx vitest run src/lib/mcp/oauth/__tests__/authorize-core.test.ts` → FAIL (module not found).

```ts
// src/lib/mcp/oauth/authorize-core.ts
import type { NextResponse } from 'next/server';
import { MCP_OAUTH_ERRORS } from '@/lib/errors';
import { AUTH_CODE_TTL_MS } from '@/lib/mcp/oauth/config';
import { generateSecret } from '@/lib/mcp/oauth/crypto';
import { redirectWithCode, redirectWithError } from '@/lib/mcp/oauth/oauth-response';
import { issueAuthCode } from '@/lib/mcp/oauth/stores/auth-codes';
import { consumeAuthState } from '@/lib/mcp/oauth/stores/auth-states';
import type { McpAuthStateDoc } from '@/lib/mcp/oauth/types';

/**
 * Mint a PKCE-bound auth code for an authenticated, approved, consenting user,
 * and redirect to the client with code + echoed state + iss (R1). Used by both
 * the consent-skip path in /authorize and the Allow path in /authorize/decision.
 *
 * CONSUME-FIRST (security-001): the single-use state nonce is atomically consumed
 * BEFORE the code is minted, and a null result aborts with access_denied. Two
 * concurrent Allow POSTs for the same nonce therefore cannot both mint a code —
 * exactly one wins the consumeAuthState delete; the loser gets null and aborts.
 * (peekAuthState in the consent render is a non-destructive read, so the atomic
 * delete here is the only single-use gate.)
 */
export async function issueCodeAndRedirect(args: {
  nonce: string;
  state: McpAuthStateDoc;
  userId: string;
  issuer: string;
  now: number;
}): Promise<NextResponse> {
  // 1. Atomically claim the nonce. Loser of a concurrent race gets null → abort.
  const consumed = await consumeAuthState(args.nonce, args.now);
  if (!consumed) {
    return redirectWithError({
      redirectUri: args.state.redirectUri,
      error: MCP_OAUTH_ERRORS.ACCESS_DENIED,
      clientState: args.state.clientState,
      issuer: args.issuer,
    });
  }

  // 2. Only the winner mints + stores the code.
  const code = generateSecret();
  await issueAuthCode(
    code,
    {
      clientId: args.state.clientId,
      redirectUri: args.state.redirectUri,
      codeChallenge: args.state.codeChallenge,
      resource: args.state.resource,
      userId: args.userId,
      scope: args.state.scope,
    },
    args.now + AUTH_CODE_TTL_MS
  );
  return redirectWithCode({
    redirectUri: args.state.redirectUri,
    code,
    clientState: args.state.clientState,
    issuer: args.issuer,
  });
}
```

- [ ] **Step 5: Run both tests to verify they pass**

Run: `npx vitest run src/lib/mcp/oauth/__tests__/approval.test.ts src/lib/mcp/oauth/__tests__/authorize-core.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/mcp/oauth/approval.ts src/lib/mcp/oauth/authorize-core.ts src/lib/mcp/oauth/__tests__/approval.test.ts src/lib/mcp/oauth/__tests__/authorize-core.test.ts
git commit -m "feat(mcp): shared live-approval lookup (M1) + code-issuance helper"
```

---

## Task 14: `/authorize` — validation, login delegation, approval gate, consent routing

**Files:**

- Create: `src/app/api/mcp/oauth/authorize/route.ts`
- Test: `src/app/api/mcp/oauth/authorize/__tests__/route.test.ts`

Flow (see the design narrative at the top of this plan):

- **Initial hit** (no `mcp_auth`): validate `client_id` (→ 400 `invalid_client`, can't redirect), then byte-match `redirect_uri` against the stored list (→ 400 `invalid_request`, can't redirect). Once `redirect_uri` is trusted, validate `response_type=code`, `code_challenge` present, `code_challenge_method=S256` (sec-004), scope; failures **redirect back** with `error` + `iss` (R1). Create the state nonce. If a session exists → fall through to the post-login branch; else 302 to `/?callbackUrl=<encoded /api/mcp/oauth/authorize?mcp_auth=NONCE>`.
- **Post-login** (`mcp_auth` present, or fall-through): load state (→ 400 if expired/unknown, R6/test-001); require a session (→ back to login); **live approval gate before any code issuance, including the consent-skip path** (→ `access_denied` redirect, L5-S1/L6); if prior consent exists → `issueCodeAndRedirect`; else 302 to `/mcp/consent?mcp_auth=NONCE`.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/mcp/oauth/authorize/__tests__/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));
const auth = vi.fn();
vi.mock('@/lib/auth', () => ({ auth }));

const getClient = vi.fn();
vi.mock('@/lib/mcp/oauth/stores/clients', () => ({ getClient }));
const lookupApproval = vi.fn();
vi.mock('@/lib/mcp/oauth/approval', () => ({ lookupApproval }));
const hasConsent = vi.fn();
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

  it('no session → 302 to /?callbackUrl=<authorize?mcp_auth=...>', async () => {
    auth.mockResolvedValue(null);
    const res = await GET(authorizeReq({ ...valid }));
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/');
    const cb = loc.searchParams.get('callbackUrl')!;
    expect(cb).toContain('/api/mcp/oauth/authorize');
    expect(cb).toContain('mcp_auth=');
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
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/api/mcp/oauth/authorize/__tests__/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the route**

```ts
// src/app/api/mcp/oauth/authorize/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { MCP_OAUTH_ERRORS } from '@/lib/errors';
import { AUTH_STATE_TTL_MS, getIssuerUrl, getResourceUrl, MCP_SCOPE } from '@/lib/mcp/oauth/config';
import { oauthErrorJson, redirectWithError } from '@/lib/mcp/oauth/oauth-response';
import { getClient } from '@/lib/mcp/oauth/stores/clients';
import {
  consumeAuthState,
  createAuthState,
  peekAuthState,
} from '@/lib/mcp/oauth/stores/auth-states';
import { hasConsent } from '@/lib/mcp/oauth/stores/consents';
import { lookupApproval } from '@/lib/mcp/oauth/approval';
import { issueCodeAndRedirect } from '@/lib/mcp/oauth/authorize-core';
import type { McpAuthStateDoc } from '@/lib/mcp/oauth/types';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const p = url.searchParams;
  const now = Date.now();
  const issuer = getIssuerUrl(req);
  const nonce = p.get('mcp_auth');

  if (nonce) return postLogin(req, nonce, issuer, now);
  return initial(req, p, issuer, now);
}

async function initial(
  req: Request,
  p: URLSearchParams,
  issuer: string,
  now: number
): Promise<Response> {
  const clientId = p.get('client_id') ?? '';
  const redirectUri = p.get('redirect_uri') ?? '';
  const clientState = p.get('state');

  // 1. Validate client + redirect_uri BEFORE trusting redirect_uri (no redirect on failure).
  const client = await getClient(clientId);
  if (!client) {
    return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_CLIENT, 'Unknown client_id', 400);
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_REQUEST, 'redirect_uri not registered', 400);
  }

  // 2. redirect_uri is trusted → remaining failures redirect back with iss (R1).
  const fail = (description: string) =>
    redirectWithError({
      redirectUri,
      error: MCP_OAUTH_ERRORS.INVALID_REQUEST,
      clientState,
      issuer,
      description,
    });

  if (p.get('response_type') !== 'code') {
    return redirectWithError({
      redirectUri,
      error: MCP_OAUTH_ERRORS.UNSUPPORTED_RESPONSE_TYPE,
      clientState,
      issuer,
    });
  }
  const codeChallenge = p.get('code_challenge');
  if (!codeChallenge) return fail('code_challenge required');
  if (p.get('code_challenge_method') !== 'S256') return fail('code_challenge_method must be S256');

  const scope = p.get('scope') ?? MCP_SCOPE;
  if (scope !== MCP_SCOPE) {
    return redirectWithError({
      redirectUri,
      error: MCP_OAUTH_ERRORS.INVALID_SCOPE,
      clientState,
      issuer,
    });
  }
  // Resource indicator (RFC 8707): default to this server; reject a foreign one.
  const resource = p.get('resource') ?? getResourceUrl(req);
  if (resource !== getResourceUrl(req)) return fail('resource indicator mismatch');

  // 3. Persist the in-flight request behind a single-use nonce (I4/A2).
  const { nonce, doc } = await createAuthState(
    { clientId, redirectUri, codeChallenge, resource, scope, clientState },
    now,
    now + AUTH_STATE_TTL_MS
  );

  // 4. Need an authenticated human. Reuse the app's existing Google sign-in.
  const session = await auth();
  if (!session?.user?.id) {
    const callbackUrl = `/api/mcp/oauth/authorize?mcp_auth=${nonce}`;
    const loginUrl = new URL('/', getIssuerUrl(req));
    loginUrl.searchParams.set('callbackUrl', callbackUrl);
    return NextResponse.redirect(loginUrl.toString());
  }
  // Already authenticated: use the doc we just inserted — no read-back (arch-004).
  return postLoginWithState(req, nonce, doc, session.user.id, issuer, now);
}

async function postLogin(
  req: Request,
  nonce: string,
  issuer: string,
  now: number
): Promise<Response> {
  const state = await peekAuthState(nonce, now);
  if (!state) {
    return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_REQUEST, 'Authorization request expired', 400);
  }
  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL('/', getIssuerUrl(req));
    loginUrl.searchParams.set('callbackUrl', `/api/mcp/oauth/authorize?mcp_auth=${nonce}`);
    return NextResponse.redirect(loginUrl.toString());
  }
  return postLoginWithState(req, nonce, state, session.user.id, issuer, now);
}

async function postLoginWithState(
  _req: Request,
  nonce: string,
  state: McpAuthStateDoc | null,
  userId: string,
  issuer: string,
  now: number
): Promise<Response> {
  if (!state)
    return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_REQUEST, 'Authorization request expired', 400);

  // Approval gate BEFORE any code issuance — including the consent-skip path (L5-S1/L6).
  const approval = await lookupApproval(userId);
  if (!approval || (!approval.isApproved && !approval.isAdmin)) {
    // Consume the nonce on denial too (single-use; mirrors /authorize/decision).
    await consumeAuthState(nonce, now);
    return redirectWithError({
      redirectUri: state.redirectUri,
      error: MCP_OAUTH_ERRORS.ACCESS_DENIED,
      clientState: state.clientState,
      issuer,
    });
  }

  // Prior consent for this exact (user, client, scope) → skip the screen (CS1).
  if (await hasConsent(userId, state.clientId, state.scope)) {
    return issueCodeAndRedirect({ nonce, state, userId, issuer, now });
  }
  // Otherwise show the consent screen.
  const consentUrl = new URL('/mcp/consent', issuer);
  consentUrl.searchParams.set('mcp_auth', nonce);
  return NextResponse.redirect(consentUrl.toString());
}
```

> **Implementer note:** `initial` calls `postLoginWithState` directly when a session already exists, so an already-authenticated user never round-trips through `/` (which would redirect them to `/meal-plans` and drop the flow — see the design narrative). Only the no-session branch routes through `/?callbackUrl=`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/mcp/oauth/authorize/__tests__/route.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mcp/oauth/authorize/
git commit -m "feat(mcp): /authorize (validation, login delegation, L5-S1 approval gate, consent routing, R1 iss)"
```

---

## Task 15: Consent screen (CS1 — the one new connector UI)

**Files:**

- Create: `src/app/mcp/consent/page.tsx` (server component)
- Test: `src/app/mcp/consent/__tests__/page.test.tsx`

A minimal, responsive, server-rendered page. Reads `mcp_auth`, peeks the pending request to name the client, guards on session, and renders Allow/Deny forms that POST to `/api/mcp/oauth/authorize/decision` with the hidden nonce. The page is render-only; the decision route does the security-bearing work.

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/mcp/consent/__tests__/page.test.tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
vi.mock('@/lib/auth', () => ({ auth }));
const peekAuthState = vi.fn();
vi.mock('@/lib/mcp/oauth/stores/auth-states', () => ({ peekAuthState }));
const getClient = vi.fn();
vi.mock('@/lib/mcp/oauth/stores/clients', () => ({ getClient }));
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock('next/navigation', () => ({ redirect }));

import ConsentPage from '../page';

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ user: { id: 'u1', name: 'Zach' } });
  peekAuthState.mockReset().mockResolvedValue({
    clientId: 'c1',
    redirectUri: 'https://claude.ai/cb',
    scope: 'weekly-eats:rw',
    clientState: 'xyz',
    codeChallenge: 'chal',
    resource: 'https://app.test/api/mcp',
    expiresAt: 9_999_999_999_999,
  });
  getClient
    .mockReset()
    .mockResolvedValue({ clientId: 'c1', clientName: 'Claude', redirectUris: [] });
});

describe('consent page', () => {
  it('renders the client name and Allow/Deny forms carrying the nonce', async () => {
    const ui = await ConsentPage({ searchParams: Promise.resolve({ mcp_auth: 'raw-nonce' }) });
    render(ui);
    expect(screen.getByText(/Claude/)).toBeInTheDocument();
    const allow = screen.getByRole('button', { name: /allow/i });
    const deny = screen.getByRole('button', { name: /deny/i });
    expect(allow).toBeInTheDocument();
    expect(deny).toBeInTheDocument();
    // both forms POST to the decision endpoint with a hidden mcp_auth + decision
    const hidden = document.querySelectorAll('input[name="mcp_auth"][value="raw-nonce"]');
    expect(hidden.length).toBe(2);
    const forms = document.querySelectorAll('form[action="/api/mcp/oauth/authorize/decision"]');
    expect(forms.length).toBe(2);
  });

  it('redirects home when the pending request is missing/expired', async () => {
    peekAuthState.mockResolvedValue(null);
    await expect(
      ConsentPage({ searchParams: Promise.resolve({ mcp_auth: 'bad' }) })
    ).rejects.toThrow(/REDIRECT:\//);
  });

  it('redirects home when there is no session', async () => {
    auth.mockResolvedValue(null);
    await expect(
      ConsentPage({ searchParams: Promise.resolve({ mcp_auth: 'raw-nonce' }) })
    ).rejects.toThrow(/REDIRECT:/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/mcp/consent/__tests__/page.test.tsx`
Expected: FAIL — `Cannot find module '../page'`.

- [ ] **Step 3: Write the page**

```tsx
// src/app/mcp/consent/page.tsx
import { redirect } from 'next/navigation';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { auth } from '@/lib/auth';
import { peekAuthState } from '@/lib/mcp/oauth/stores/auth-states';
import { getClient } from '@/lib/mcp/oauth/stores/clients';

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { mcp_auth } = await searchParams;
  const nonce = typeof mcp_auth === 'string' ? mcp_auth : '';

  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const state = nonce ? await peekAuthState(nonce, Date.now()) : null;
  if (!state) redirect('/');

  const client = await getClient(state.clientId);
  const clientName = client?.clientName ?? 'This application';

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
      <Paper sx={{ p: { xs: 3, sm: 4 } }} elevation={2}>
        <Typography variant="h5" component="h1" gutterBottom>
          Authorize access
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Allow <strong>{clientName}</strong> to read and modify your Weekly Eats recipes, food
          items, meal plans, pantry, and shopping lists?
        </Typography>
        <Stack
          direction={{ xs: 'column-reverse', sm: 'row' }}
          spacing={2}
          justifyContent="flex-end"
        >
          <Box component="form" action="/api/mcp/oauth/authorize/decision" method="POST">
            <input type="hidden" name="mcp_auth" value={nonce} />
            <input type="hidden" name="decision" value="deny" />
            <Button type="submit" variant="outlined" color="inherit" fullWidth>
              Deny
            </Button>
          </Box>
          <Box component="form" action="/api/mcp/oauth/authorize/decision" method="POST">
            <input type="hidden" name="mcp_auth" value={nonce} />
            <input type="hidden" name="decision" value="allow" />
            <Button type="submit" variant="contained" fullWidth>
              Allow
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/mcp/consent/__tests__/page.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/mcp/consent/
git commit -m "feat(mcp): server-rendered OAuth consent screen (CS1)"
```

---

## Task 16: `/authorize/decision` — Allow/Deny POST

**Files:**

- Create: `src/app/api/mcp/oauth/authorize/decision/route.ts`
- Test: `src/app/api/mcp/oauth/authorize/decision/__tests__/route.test.ts`

Parses the form, re-loads the pending state, re-verifies the session, **re-runs the approval gate** (defense-in-depth at the issuance boundary), then: Deny → `access_denied` redirect + consume state; Allow → `grantConsent` + `issueCodeAndRedirect` (MD happy path).

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/mcp/oauth/authorize/decision/__tests__/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
vi.mock('@/lib/auth', () => ({ auth }));
const peekAuthState = vi.fn();
const consumeAuthState = vi.fn();
vi.mock('@/lib/mcp/oauth/stores/auth-states', () => ({ peekAuthState, consumeAuthState }));
const lookupApproval = vi.fn();
vi.mock('@/lib/mcp/oauth/approval', () => ({ lookupApproval }));
const grantConsent = vi.fn();
vi.mock('@/lib/mcp/oauth/stores/consents', () => ({ grantConsent }));
const issueCodeAndRedirect = vi.fn();
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
    .mockResolvedValue(NextResponse.redirect('https://claude.ai/cb?code=x'));
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/api/mcp/oauth/authorize/decision/__tests__/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the route**

```ts
// src/app/api/mcp/oauth/authorize/decision/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { MCP_OAUTH_ERRORS } from '@/lib/errors';
import { getIssuerUrl } from '@/lib/mcp/oauth/config';
import { oauthErrorJson, redirectWithError } from '@/lib/mcp/oauth/oauth-response';
import { consumeAuthState, peekAuthState } from '@/lib/mcp/oauth/stores/auth-states';
import { grantConsent } from '@/lib/mcp/oauth/stores/consents';
import { lookupApproval } from '@/lib/mcp/oauth/approval';
import { issueCodeAndRedirect } from '@/lib/mcp/oauth/authorize-core';

export async function POST(req: Request): Promise<Response> {
  const now = Date.now();
  const issuer = getIssuerUrl(req);
  const form = await req.formData();
  const nonce = String(form.get('mcp_auth') ?? '');
  const decision = String(form.get('decision') ?? '');

  const state = await peekAuthState(nonce, now);
  if (!state) {
    return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_REQUEST, 'Authorization request expired', 400);
  }

  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL('/', issuer);
    loginUrl.searchParams.set('callbackUrl', `/api/mcp/oauth/authorize?mcp_auth=${nonce}`);
    return NextResponse.redirect(loginUrl.toString());
  }
  const userId = session.user.id;

  const denied = () => {
    return redirectWithError({
      redirectUri: state.redirectUri,
      error: MCP_OAUTH_ERRORS.ACCESS_DENIED,
      clientState: state.clientState,
      issuer,
    });
  };

  // Re-run the approval gate at the issuance boundary (defense-in-depth).
  const approval = await lookupApproval(userId);
  if (!approval || (!approval.isApproved && !approval.isAdmin)) {
    await consumeAuthState(nonce, now);
    return denied();
  }

  if (decision !== 'allow') {
    await consumeAuthState(nonce, now);
    return denied();
  }

  await grantConsent(userId, state.clientId, state.scope, now);
  return issueCodeAndRedirect({ nonce, state, userId, issuer, now });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/mcp/oauth/authorize/decision/__tests__/route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mcp/oauth/authorize/decision/
git commit -m "feat(mcp): /authorize/decision (Allow grants consent + issues code; Deny → access_denied)"
```

---

## Task 17: `/token` — authorization_code exchange + refresh_token rotation

**Files:**

- Create: `src/app/api/mcp/oauth/token/route.ts`
- Test: `src/app/api/mcp/oauth/token/__tests__/route.test.ts`

The largest endpoint. Two grants:

**authorization_code:** client auth (`client_id` registered → else `invalid_client`, T4); atomic `consumeAuthCode` (MA) — if null, treat as replay: `revokeChain(grantIdForCode(code))` then `invalid_grant`; verify `clientId` + `redirect_uri` match the code (sec-005); PKCE — `code_verifier` required against the stored `code_challenge` (R2), `pkceS256Matches` else `invalid_grant`; resource match; `mintPair(grantIdForCode(code), …)`; return the token JSON.

**refresh_token:** client auth; `findRefreshToken`; reject if missing/expired-at-use/revoked (`invalid_grant`); verify `clientId`; **live approval re-check (I5)** → if unapproved, `revokeChain` + `invalid_grant`; atomic `rotateRefresh` (S3) — if null (already rotated/reused), `revokeChain` + `invalid_grant`; else return the new pair (idle TTL refreshed, T2).

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/mcp/oauth/token/__tests__/route.test.ts
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClient = vi.fn();
vi.mock('@/lib/mcp/oauth/stores/clients', () => ({ getClient }));
const consumeAuthCode = vi.fn();
vi.mock('@/lib/mcp/oauth/stores/auth-codes', () => ({
  consumeAuthCode,
  grantIdForCode: (c: string) => `grant:${c}`,
}));
const mintPair = vi.fn();
const findRefreshToken = vi.fn();
const rotateRefresh = vi.fn();
const revokeChain = vi.fn();
vi.mock('@/lib/mcp/oauth/stores/tokens', () => ({
  mintPair,
  findRefreshToken,
  rotateRefresh,
  revokeChain,
}));
const lookupApproval = vi.fn();
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
    expiresAt: 9_999_999_999_999,
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
    findRefreshToken.mockResolvedValue({ ...refreshDoc, expiresAt: 1 });
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/api/mcp/oauth/token/__tests__/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the route**

```ts
// src/app/api/mcp/oauth/token/route.ts
import { NextResponse } from 'next/server';
import { MCP_OAUTH_ERRORS } from '@/lib/errors';
import { ACCESS_TOKEN_TTL_MS, getResourceUrl, MCP_SCOPE } from '@/lib/mcp/oauth/config';
import { pkceS256Matches } from '@/lib/mcp/oauth/crypto';
import { oauthErrorJson } from '@/lib/mcp/oauth/oauth-response';
import { getClient } from '@/lib/mcp/oauth/stores/clients';
import { consumeAuthCode, grantIdForCode } from '@/lib/mcp/oauth/stores/auth-codes';
import {
  findRefreshToken,
  mintPair,
  revokeChain,
  rotateRefresh,
} from '@/lib/mcp/oauth/stores/tokens';
import { lookupApproval } from '@/lib/mcp/oauth/approval';

function tokenJson(pair: { accessToken: string; refreshToken: string }, scope: string): Response {
  return NextResponse.json(
    {
      access_token: pair.accessToken,
      refresh_token: pair.refreshToken,
      token_type: 'Bearer',
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      scope,
    },
    { status: 200, headers: { 'cache-control': 'no-store' } }
  );
}

export async function POST(req: Request): Promise<Response> {
  const now = Date.now();
  const form = await req.formData();
  const grantType = String(form.get('grant_type') ?? '');
  const clientId = String(form.get('client_id') ?? '');

  // Client auth (public client; PKCE substitutes for a secret). T4.
  const client = await getClient(clientId);
  if (!client) return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_CLIENT, 'Unknown client', 401);

  if (grantType === 'authorization_code') {
    const rawCode = String(form.get('code') ?? '');
    const redirectUri = String(form.get('redirect_uri') ?? '');
    const codeVerifier = form.get('code_verifier');

    const codeDoc = await consumeAuthCode(rawCode, now);
    if (!codeDoc) {
      // Replay of a consumed code → revoke tokens minted from it (MA).
      await revokeChain(grantIdForCode(rawCode), now);
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Invalid or expired code', 400);
    }
    // Cross-client / cross-redirect injection (sec-005).
    if (codeDoc.clientId !== clientId || codeDoc.redirectUri !== redirectUri) {
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Code/client/redirect mismatch', 400);
    }
    // PKCE — verifier required against the stored challenge (R2 downgrade reject).
    if (typeof codeVerifier !== 'string' || !pkceS256Matches(codeVerifier, codeDoc.codeChallenge)) {
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'PKCE verification failed', 400);
    }
    // Audience (RFC 8707) — minted token is bound to this server.
    if (codeDoc.resource !== getResourceUrl(req)) {
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Resource mismatch', 400);
    }

    const pair = await mintPair(
      grantIdForCode(rawCode),
      { userId: codeDoc.userId, clientId, resource: codeDoc.resource, scope: codeDoc.scope },
      now
    );
    return tokenJson(pair, codeDoc.scope);
  }

  if (grantType === 'refresh_token') {
    const rawRefresh = String(form.get('refresh_token') ?? '');
    const doc = await findRefreshToken(rawRefresh);
    if (!doc) return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Unknown refresh token', 400);
    if (doc.clientId !== clientId) {
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Client mismatch', 400);
    }
    if (doc.expiresAt <= now) {
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Refresh token expired', 400);
    }
    if (doc.revokedAt !== null) {
      await revokeChain(doc.grantId, now);
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Refresh token revoked', 400);
    }

    // Live approval re-check on every refresh (I5).
    const approval = await lookupApproval(doc.userId);
    if (!approval || (!approval.isApproved && !approval.isAdmin)) {
      await revokeChain(doc.grantId, now);
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'User not approved', 400);
    }

    // Atomic rotation w/ reuse detection (S3). Null → already rotated → kill chain.
    const rotated = await rotateRefresh(
      rawRefresh,
      doc.grantId,
      { userId: doc.userId, clientId, resource: doc.resource, scope: doc.scope },
      now
    );
    if (!rotated) {
      await revokeChain(doc.grantId, now);
      return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_GRANT, 'Refresh token reuse detected', 400);
    }
    return tokenJson(rotated, doc.scope ?? MCP_SCOPE);
  }

  return oauthErrorJson(MCP_OAUTH_ERRORS.UNSUPPORTED_GRANT_TYPE, 'Unsupported grant_type', 400);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/mcp/oauth/token/__tests__/route.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mcp/oauth/token/
git commit -m "feat(mcp): /token (PKCE code exchange + atomic refresh rotation, I5/S3/R2/MA/sec-005)"
```

---

## Task 18: `/revoke` — token revocation (RFC 7009, M3)

**Files:**

- Create: `src/app/api/mcp/oauth/revoke/route.ts`
- Test: `src/app/api/mcp/oauth/revoke/__tests__/route.test.ts`

Sets `revokedAt` (M3 — never deletes, so `verifyToken`'s revocation check always wins over TTL). RFC 7009 §2.2: an unknown token still returns 200. Requires client auth.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/mcp/oauth/revoke/__tests__/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClient = vi.fn();
vi.mock('@/lib/mcp/oauth/stores/clients', () => ({ getClient }));
const revokeByHash = vi.fn();
vi.mock('@/lib/mcp/oauth/stores/tokens', () => ({ revokeByHash }));

import { POST } from '../route';

function revokeReq(body: Record<string, string>) {
  return new Request('https://app.test/api/mcp/oauth/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
}

beforeEach(() => {
  getClient.mockReset().mockResolvedValue({ clientId: 'c1', redirectUris: [] });
  revokeByHash.mockReset().mockResolvedValue(undefined);
});

describe('POST /revoke', () => {
  it('revokes a token and returns 200', async () => {
    const res = await POST(revokeReq({ token: 'AT', client_id: 'c1' }));
    expect(res.status).toBe(200);
    expect(revokeByHash).toHaveBeenCalledWith('AT', expect.any(Number));
  });

  it('returns 200 for an unknown token (RFC 7009 §2.2)', async () => {
    revokeByHash.mockResolvedValue(undefined); // no-op for unknown
    const res = await POST(revokeReq({ token: 'nope', client_id: 'c1' }));
    expect(res.status).toBe(200);
  });

  it('unknown client → 401 invalid_client', async () => {
    getClient.mockResolvedValue(null);
    const res = await POST(revokeReq({ token: 'AT', client_id: 'ghost' }));
    expect(res.status).toBe(401);
  });

  it('missing token → 200 (nothing to do, still success)', async () => {
    const res = await POST(revokeReq({ client_id: 'c1' }));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**, then **write the route**

Run: `npx vitest run src/app/api/mcp/oauth/revoke/__tests__/route.test.ts` → FAIL (module not found).

```ts
// src/app/api/mcp/oauth/revoke/route.ts
import { NextResponse } from 'next/server';
import { MCP_OAUTH_ERRORS } from '@/lib/errors';
import { oauthErrorJson } from '@/lib/mcp/oauth/oauth-response';
import { getClient } from '@/lib/mcp/oauth/stores/clients';
import { revokeByHash } from '@/lib/mcp/oauth/stores/tokens';

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const clientId = String(form.get('client_id') ?? '');
  const token = form.get('token');

  const client = await getClient(clientId);
  if (!client) return oauthErrorJson(MCP_OAUTH_ERRORS.INVALID_CLIENT, 'Unknown client', 401);

  // RFC 7009: revoke if present; unknown token is still a success.
  if (typeof token === 'string' && token.length > 0) {
    await revokeByHash(token, Date.now());
  }
  return new NextResponse(null, { status: 200, headers: { 'cache-control': 'no-store' } });
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/app/api/mcp/oauth/revoke/__tests__/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/mcp/oauth/revoke/
git commit -m "feat(mcp): /revoke (RFC 7009, sets revokedAt — M3)"
```

---

## Task 19: Rewrite `verifyToken` — OAuth-minted-token verifier (replaces the dev token)

**Files:**

- Modify (rewrite): `src/lib/mcp/verify-token.ts`
- Rewrite: `src/lib/mcp/__tests__/verify-token.test.ts` (the existing dev-token tests are replaced)

This removes the Phase-1 dev-token path entirely (C1) and implements §6.4: hash lookup, `tokenType:'access'` only (arch-001), at-use expiry + `revokedAt` (R6/M3), resource/audience match (R3), then a **live `users` approval lookup** (M1) — nothing approval-related is trusted from the token.

- [ ] **Step 1: Replace the test file**

```ts
// src/lib/mcp/__tests__/verify-token.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findValidAccessToken = vi.fn();
vi.mock('@/lib/mcp/oauth/stores/tokens', () => ({ findValidAccessToken }));
const lookupApproval = vi.fn();
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
```

> **Note:** `findValidAccessToken` already filters `tokenType:'access'`, so the arch-001 "refresh-as-bearer" case is covered at the store layer (Task 8). The integration path is exercised end-to-end in Task 22.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/mcp/__tests__/verify-token.test.ts`
Expected: FAIL — current `verify-token.ts` reads env/dev token, not the stores.

- [ ] **Step 3: Rewrite `verify-token.ts`**

```ts
// src/lib/mcp/verify-token.ts
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getResourceUrl } from '@/lib/mcp/oauth/config';
import { findValidAccessToken } from '@/lib/mcp/oauth/stores/tokens';
import { lookupApproval } from '@/lib/mcp/oauth/approval';

/**
 * MCP auth gate for withMcpAuth (§6.4). Owns ALL security logic — the adapter
 * only checks expiry+scope after we return (R5). Steps:
 *  1. hash-lookup an access-only, non-revoked, non-expired-at-use token (T1/R6/M3, arch-001),
 *  2. verify the token's bound resource is this server (R3 audience binding),
 *  3. live `users` approval lookup (M1) — revoked approval applies immediately.
 * Any failure returns undefined → withMcpAuth issues 401 + WWW-Authenticate (R4).
 */
export async function verifyToken(
  req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const now = Date.now();
  const tokenDoc = await findValidAccessToken(bearerToken, now);
  if (!tokenDoc) return undefined;

  if (tokenDoc.resource !== getResourceUrl(req)) return undefined; // R3

  const approval = await lookupApproval(tokenDoc.userId); // M1
  if (!approval || (!approval.isApproved && !approval.isAdmin)) return undefined;

  return {
    token: bearerToken,
    clientId: tokenDoc.clientId,
    scopes: [tokenDoc.scope],
    extra: {
      userId: tokenDoc.userId,
      isApproved: approval.isApproved,
      isAdmin: approval.isAdmin,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/mcp/__tests__/verify-token.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/verify-token.ts src/lib/mcp/__tests__/verify-token.test.ts
git commit -m "feat(mcp): rewrite verifyToken as the OAuth verifier (M1 live approval, R3 audience); remove dev token (C1)"
```

---

## Task 20: Wire the transport route to the PRM challenge (R4)

**Files:**

- Modify: `src/app/api/[transport]/route.ts`
- Modify: `src/app/api/[transport]/__tests__/route.test.ts`

Set `resourceMetadataPath` so the `401` `WWW-Authenticate` points at our PRM (R4). The `verifyToken` import is unchanged (same path, new implementation). Tools unchanged.

- [ ] **Step 1: Update the route**

Replace the `withMcpAuth(...)` call:

```ts
// Phase 2: OAuth-minted-token verifier (§6.4). required:true → unauthenticated
// calls get 401 + WWW-Authenticate carrying the RFC 9728 resource_metadata
// challenge (R4), pointing Claude at our Protected Resource Metadata.
const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});
```

Update the leading comment block above it (it currently says "Phase 1: static dev-token auth") to the Phase-2 description.

- [ ] **Step 2: Update the route test**

The existing `route.test.ts` asserts the dev-token behavior of the wiring. Update its no-/bad-token expectations to assert a `401` with a `WWW-Authenticate` header containing `resource_metadata` (the adapter emits it when `verifyToken` returns undefined). Replace any dev-token-specific cases with:

```ts
it('an unauthenticated POST gets 401 with a resource_metadata challenge (R4)', async () => {
  const res = await POST(
    new Request('https://app.test/api/mcp', {
      method: 'POST',
      headers: { 'x-forwarded-host': 'app.test', 'x-forwarded-proto': 'https' },
    })
  );
  expect(res.status).toBe(401);
  expect(res.headers.get('www-authenticate')).toContain('resource_metadata');
});
```

> Keep the existing register/smoke assertions that don't depend on the dev token. If the current test imported or stubbed `MCP_DEV_TOKEN`, remove that — the dev path is gone.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/app/api/[transport]/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/[transport]/route.ts src/app/api/[transport]/__tests__/route.test.ts
git commit -m "feat(mcp): wire transport route to PRM resource_metadata challenge (R4)"
```

---

## Task 21: Exit checklist — dev token provably inert in production (C1)

**Files:**

- Create: `src/lib/mcp/__tests__/dev-token-inert.test.ts`

The Phase-1 dev token is **removed** (Task 19), but the spec §11 exit checklist requires a test that _proves_ it cannot authenticate in production. This integration test sets the old dev env vars **and** `NODE_ENV=production`, drives the real `verifyToken` (only the stores mocked, returning "no such token"), and asserts rejection — i.e. there is no surviving env-gated bypass.

- [ ] **Step 1: Write the test**

```ts
// src/lib/mcp/__tests__/dev-token-inert.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const findValidAccessToken = vi.fn();
vi.mock('@/lib/mcp/oauth/stores/tokens', () => ({ findValidAccessToken }));
const lookupApproval = vi.fn();
vi.mock('@/lib/mcp/oauth/approval', () => ({ lookupApproval }));

import { verifyToken } from '../verify-token';

afterEach(() => vi.unstubAllEnvs());

function req() {
  return new Request('https://app.test/api/mcp', {
    headers: { 'x-forwarded-host': 'app.test', 'x-forwarded-proto': 'https' },
  });
}

describe('C1 — dev token is inert in production', () => {
  it('with dev env vars set AND NODE_ENV=production, the dev token is rejected', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MCP_DEV_TOKEN', 'dev-secret');
    vi.stubEnv('MCP_DEV_USER_ID', '64b8f0000000000000000001');
    // No token row exists for "dev-secret" — the dev bypass code path is gone.
    findValidAccessToken.mockResolvedValue(null);

    expect(await verifyToken(req(), 'dev-secret')).toBeUndefined();
    // The dev user id is never trusted: approval lookup is only reached for a real token.
    expect(lookupApproval).not.toHaveBeenCalled();
  });

  it('verify-token.ts contains no reference to MCP_DEV_TOKEN (static guarantee)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../verify-token.ts', import.meta.url), 'utf8');
    expect(src).not.toContain('MCP_DEV_TOKEN');
    expect(src).not.toContain('MCP_DEV_USER_ID');
  });
});
```

- [ ] **Step 2: Run it to verify it passes (Task 19 already removed the path)**

Run: `npx vitest run src/lib/mcp/__tests__/dev-token-inert.test.ts`
Expected: PASS (2 tests). If the static-guarantee test fails, finish removing the dev env references from `verify-token.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mcp/__tests__/dev-token-inert.test.ts
git commit -m "test(mcp): C1 exit gate — dev token provably inert in production"
```

---

## Task 22: End-to-end discovery + authorize→token→verify integration test

**Files:**

- Create: `src/lib/mcp/oauth/__tests__/flow.integration.test.ts`

Proves the pieces compose against a single fake DB: discovery documents cross-reference (PRM `authorization_servers[0]` === AS `issuer`); and a full **register → authorize(initial+consent skip via decision) → token (code exchange) → verifyToken** chain yields a usable access token, while the same code replayed fails (MA) and the issued token authenticates only for the bound resource (R3). Uses the real stores + `authorize-core`, mocking only `auth()` and `lookupApproval`.

- [ ] **Step 1: Write the integration test**

```ts
// src/lib/mcp/oauth/__tests__/flow.integration.test.ts
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));
const auth = vi.fn();
vi.mock('@/lib/auth', () => ({ auth }));
const lookupApproval = vi.fn();
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
```

> **Implementer note:** this test exercises the real `authorize-core`, all five stores, and `verifyToken` against one in-memory DB — the strongest single guard that the pieces fit. If it fails, fix the integration before moving on; do not weaken the assertions. The fake-db `matches` helper supports the `revokedAt: null` filter and `$gt`; if a store you wrote uses an operator the helper doesn't model, extend `makeFakeDb` (Task 5) rather than the test.

- [ ] **Step 2: Run it to verify it passes**

Run: `npx vitest run src/lib/mcp/oauth/__tests__/flow.integration.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: Commit**

```bash
git add src/lib/mcp/oauth/__tests__/flow.integration.test.ts
git commit -m "test(mcp): end-to-end discovery + register→authorize→token→verify integration"
```

---

## Task 23: Full validation, docs, deploy infra, ledger

**Files:**

- Modify: `docs/architecture.md`, `CLAUDE.md`, `docs/superpowers/plans/mcp-connector-progress.md`
- (Infra: Vercel env, Google Cloud — user-confirmed before any Production write)

- [ ] **Step 1: Run the full suite once**

Run: `npm run check`
Expected: lint 0, all tests pass (Phase-1 count + the ~70 new Phase-2 tests), build OK. Investigate any failure with `npx vitest run <path>` before proceeding. Do **not** re-run individual steps after a green `check`.

- [ ] **Step 2: Update `docs/architecture.md`**

Add an "MCP Agent Connector / OAuth AS" subsection documenting: the `/api/mcp` Resource Server + `verifyToken` (live approval lookup, M1); the hand-rolled AS endpoints under `/api/mcp/oauth/*`; the two `/.well-known/*` metadata docs (served via `next.config.ts` rewrites); the six `mcp*` collections and that all secrets are SHA-256-hashed at rest, CSPRNG-generated, single-use via atomic Mongo ops, expiry-checked at use; and that the consent screen is the one new connector UI. Note the login leg reuses the existing Auth.js v5 + Google flow (no second identity).

- [ ] **Step 3: Update `CLAUDE.md`**

In the Database section, add the six `mcp*` collections to the collections list. In the API Routes / conventions area, add a one-line note that OAuth protocol wire constants live in `MCP_OAUTH_ERRORS` (RFC-literal exemption to the no-hardcoded-strings rule). Add `MCP_ISSUER_URL` (optional issuer override) to any env documentation.

- [ ] **Step 4: Deploy infra (confirm with the user before any Production write)**

- **Vercel env (Production + Preview):** no _required_ new var — issuer/resource derive from the request origin via `getPublicOrigin`. Optionally set `MCP_ISSUER_URL` to the stable production origin (`https://weekly-eats.vercel.app`) on Production to pin the issuer regardless of forwarding headers. **Do not** set `MCP_DEV_TOKEN`/`MCP_DEV_USER_ID` in any deployed environment (they are now inert anyway — Task 21).
- **`maxDuration`:** confirm `src/app/api/[transport]/route.ts` keeps `export const maxDuration = 60` (Fluid Compute).
- **Google Cloud:** no change — DCR clients (Claude) use their own `redirect_uris`; the app's own Google callback (`/api/auth/callback/google`) is unchanged from Phase 1.5. The connector login leg rides the existing Auth.js v5 redirect-proxy + origin allowlist.
- **Manual end-to-end verification:** after deploy to a preview, add the connector in Claude by URL (`https://<preview>/api/mcp`), complete the Google login + consent, and exercise the Phase-1 tools over the real OAuth token. Post the §8a-derived manual checklist to PR #140 via `/manual-testing`. (Execution-time, not a code step.)

- [ ] **Step 5: Update the ledger** (`docs/superpowers/plans/mcp-connector-progress.md`)

Flip the Phase 2 row to `done` with this plan's path + the PR test-comment link + date; update the "Next up" block to point at Phase 3 (`recipe-import` skill); record key carryovers: the resolved §12 open questions (login leg = reuse landing-page sign-in via relative `callbackUrl`, not programmatic `signIn()`; OAuth error constants = `MCP_OAUTH_ERRORS` group); the §6.4 dev-token carryover is now **closed** (dev path removed, C1 test green); and note the rate limiter is best-effort (serverless, read-then-write) per Task 10.

- [ ] **Step 6: Commit + push**

```bash
git add docs/architecture.md CLAUDE.md docs/superpowers/plans/mcp-connector-progress.md
git commit -m "docs(mcp): Phase 2 OAuth AS — architecture, conventions, ledger"
git push
```

Then pause for user review (and the optional, user-triggered `/code-review` + `/code-review ultra` security pass before any Production env writes).

---

## Self-Review (run by the plan author before handing off)

**1. Spec coverage** — every §6.2 / §6.4 / §8a / §9 / §10 requirement maps to a task in the coverage table above. Cross-checked the §8a Phase-2 test list item-by-item:

- `/token`: PKCE exchange (17), verifier mismatch (17), missing verifier R2 (17), expired code (17 — `consumeAuthCode` at-use), unknown client T4 (17), cross-client sec-005 (17), replay MA + revoke (17 + 22), concurrent rotation S3 (8 `rotateRefresh` + 17), refresh approval re-check I5 (17), now-unapproved refresh (17), rotated-replay chain revoke (8 + 17), idle TTL T2 (8).
- `/authorize`: missing challenge (14), plain/absent method sec-004 (14), missing/!verified state (14 post-login 400 + 6 store), state cross-session MC (6), expired state test-001 (6 + 14), redirect_uri mismatch (14), unapproved cannot get code L5-S1 (14), consent required CS1 (14 routes to consent + 16), Deny (16), prior-consent skip + new-client re-prompt (14 + 9), L6 skip-path gate (14), happy path MD (16 + 22).
- `/register`: rate limit (13), non-HTTPS S2 (13). `/revoke`: valid + unknown-silent + unauthenticated (18).
- research cases: `iss` on success+error R1 (3 + 14), PKCE downgrade R2 (17), token-passthrough/audience R3 (19), at-use expiry R6 (6/7/8 stores), discovery R4 (11 + 20 + 22).
- `verifyToken`: valid, expired, revoked, unapproved, admin-bypass, malformed/forged, resource mismatch, T1 hash (8 store), T3 post-issuance revocation (19), arch-001 refresh-as-bearer (8). Dev-token C1 (21).

**2. Placeholder scan** — no "TBD"/"add error handling"/"similar to Task N"/"write tests for the above". Every code step shows complete code; every test step shows the actual assertions.

**3. Type consistency** — `McpAuthStateDoc`/`McpAuthCodeDoc`/`McpTokenDoc` field names are used identically across `types.ts`, every store, and every route. `grantId` is stable across a lineage (mint + rotate share it; never reassigned). `getIssuerUrl`/`getResourceUrl`/`MCP_SCOPE` names match between config, metadata, authorize, token, and verifyToken. The fake-db helper (Task 5) is reused by Tasks 6–10, 13, 14, 22; the `matches` helper supports the `null` and `$gt` filters those stores use. `lookupApproval` returns `{isApproved, isAdmin} | null` everywhere it's consumed (14, 16, 17, 19).

**4. Known soft spots flagged for the implementer** — (a) the serverless rate limiter is best-effort (Task 10 note); (b) the fake-db `matches` helper is intentionally minimal — extend it, not the assertions, if a store uses an unmodeled operator (Task 22 note); (c) confirm exact Claude DCR/metadata field names against the live connector docs while implementing 11–13 (spec §12 residual, low risk); (d) re-check the 2025-11-25 MCP auth revision is still non-contradictory before deploy (spec §12 residual).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-30-mcp-phase-2-oauth-as-plan.md`. Given this is the high-risk, security-critical phase (hand-rolled OAuth + write-capable connector), I recommend a `/review-plan` pass on **this implementation plan** before building (the spec was reviewed; the plan's task-level security decisions — atomic ops, the login-leg reuse, the grantId lineage, the approval-gate ordering — have not been). Then build via **subagent-driven-development** (fresh subagent per task, two-stage review between tasks), which suits the 23 tightly-scoped TDD tasks here.
