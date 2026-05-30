# Plan Review — Agent Connector Design Spec

- **Reviewed:** 2026-05-29
- **Target:** `docs/superpowers/specs/2026-05-29-agent-connector-design.md`
- **Verdict:** 🔴 MAJOR GAPS — RECONSIDER DESIGN (driven by one Critical; all findings addressable by spec edits)
- **Approved:** 1 Critical, 6 Important, 4 Minor
- **Dispatched:** architecture, security, test, code reviewers (parallel) under `REVIEW.md`

The architecture is sound — shared service layer, stateless Streamable HTTP, and the OAuth Proxy pattern all fit project conventions. The gaps are **OAuth Authorization Server specification completeness** and a **missing test plan**. All findings below were folded into the spec in the same commit series.

---

## §6.2 — OAuth Authorization Server

### 🟠 I4 — `state`/CSRF protection not specified [Security]

PKCE protects the code→token exchange, not authorization-request initiation. Without a server-verified `state`, a cross-site request can bind a victim's auth code to an attacker (login-CSRF). OAuth 2.1 §4.1.1 requires `state`.
**Fix:** `/authorize` generates a random `state`, stores it server-side bound to the initiating request, carries it through the Google/NextAuth redirect, and verifies on return before issuing the code.
**POV:** Fix (High).

### 🟠 I5 — refresh-token re-approval + lifetime [Security]

`§10` re-checks approval on every tool call, but the token endpoint did not re-check on **refresh** exchange, and no refresh lifetime was set — a revoked-approval user could keep minting access tokens.
**Fix (refined during review):** re-check `isApproved`/`isAdmin` + revocation on every refresh exchange (closes the gap); use **refresh-token rotation with reuse detection** and **idle/sliding expiry** instead of a hard 30-day cap, so active users are not forced to re-authenticate periodically while leaked/abandoned tokens still die.
**POV:** Fix (High).

### 🟠 I6 — DCR endpoint hardening [Security]

`/api/mcp/oauth/register` is an open, unauthenticated write endpoint to `mcpClients`; no rate limit, no quota, and no TTL on `mcpClients`.
**Fix:** per-IP rate limit on `/register`; TTL/cleanup policy for `mcpClients`; state whether registration is open (RFC 7591) or restricted to Claude's known client metadata.
**POV:** Fix (Medium).

### 🔵 M3 — revocation vs TTL consistency [Security]

TTL deletion is eventual; if `/revoke` sets a `revokedAt` flag rather than deleting, `verifyToken` must check it and the TTL must be on the expiry field.
**Fix:** specify delete-vs-`revokedAt`; `verifyToken` checks `revokedAt` if used.
**POV:** Fix (Medium) — resolves alongside M1/I5.

---

## §6.3 / §8 — Service layer & error handling

### 🟠 I2 — typed error classes have no home [Architecture]

`§8` says the service layer throws `ValidationError`/`NotFoundError`/`ForbiddenError`, but `src/lib/errors.ts` exports only string constants — no throwable classes exist.
**Fix:** add `src/lib/service-errors.ts` (throwable classes carrying an `@/lib/errors` message constant) as an explicit Phase 1 deliverable; reference from `§6.3` and `§8`. Route handlers `instanceof`-map them to existing HTTP statuses.
**POV:** Fix (High).

---

## §6.5 — MCP tools

### 🟠 I3 — `food_items.create` `isGlobal` authorization [Code + Security]

`food-items/route.ts:162` persists caller-supplied `isGlobal` with no admin gate — any approved user can create globally-shared items. An agent could pass `isGlobal:true` during import, polluting every user's catalog.
**Fix:** `food_items.create` via MCP always forces `isGlobal:false`; admin-created globals (if ever wanted) require an explicit `isAdmin` re-check.
**POV:** Fix (High).

### 🔵 M4 — tool test mock boundary [Test]

Tool tests should mock the service layer (`@/lib/services/*`), not Mongo.
**Fix:** noted in the Testing strategy section (folded into I1).
**POV:** Fix (Low).

---

## §8 — Testing (was absent)

### 🟠 I1 — no test list anywhere [Test + Security + Architecture + Code]

The only testing mention was "tests stay green." Project rules require an explicit, case-level test list. (Merged from 6 specialist findings.)
**Fix:** add a `## Testing strategy` section enumerating cases for: OAuth AS endpoints (PKCE exchange, verifier mismatch, expired/replayed code, refresh, revocation, resource-indicator mismatch); service layer (userId scoping, ForbiddenError, ValidationError, not-found); `verifyToken` (expired/revoked, unapproved blocked, admin bypass, malformed bearer); MCP tools (service mocked, error mapping, zod rejection). Follow the existing `__tests__` + `vi.mock('@/lib/mongodb')` pattern.
**POV:** Fix (High) — highest-risk gap.

---

## §9 — Data model

### 🔵 M2 — token/auth-code storage format [Architecture + Security]

`§9` did not say tokens/auth-codes are hashed at rest; plaintext bearer secrets mean a DB read impersonates any user.
**Fix:** store access tokens and auth codes as SHA-256 hashes; return the raw token once at issuance, never persist it.
**POV:** Fix (High).

---

## §10 — Security

### 🔵 M1 — approval re-check mechanism ambiguous [Architecture]

`§10` "re-check every call" vs `§9` not stating whether `isApproved` is embedded in `mcpTokens`.
**Fix:** state explicitly — `verifyToken` queries `users` each call (live), or embeds `isApproved` at minting (revocation then lags to expiry; note mitigations). Resolves with I5.
**POV:** Fix (High).

---

## §11 — Phases

### 🔴 C1 — Phase 1 dev token has no production gate [Security + Code]

Phase 1 exposes `/api/mcp` write tools behind a static bearer token with no enforced removal before deploy. If Phase 1 reaches Vercel, any token holder gets unauthenticated write to all user data.
**Fix:** gate the dev-token path behind a non-production env var (`MCP_DEV_TOKEN` present AND `NODE_ENV !== 'production'`); add a Phase 2 removal checklist item and an integration test asserting the production config rejects the static token.
**POV:** Fix (High) — arguably Important at plan time, but the safeguard belongs in the spec.
