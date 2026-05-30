# Weekly Eats Agent Connector — Design Spec

- **Date:** 2026-05-29
- **Branch:** `feat/mcp`
- **Status:** Approved design, pending implementation plans
- **Scope:** One spec, built in sequential implementation phases (see §11)

## 1. Summary

Build a way for AI agents (Claude) to interact with a user's Weekly Eats data. The
primary surface is a **remote MCP server** hosted inside the existing Next.js app —
i.e. a self-serve **Claude Connector** that any approved Weekly Eats user can add by
URL, authenticate with their own Google account, and use to read and write their
recipes, food items, meal plans, pantry, and shopping lists.

The motivating use case is a distributable, installable **`recipe-import` skill**:
give Claude a recipe URL or PDF, and it parses the recipe, maps ingredients to the
user's food-item catalog (creating new ones as needed), confirms everything in chat,
and saves a properly-structured recipe via the connector.

## 2. Goals

- A remote MCP server (Claude Connector) served from the deployed Next.js app on Vercel.
- Self-serve: any approved user connects with their own Google identity; data is
  scoped to that user exactly as the web app scopes it today.
- Read + write tools across recipes, food items, meal plans, pantry, shopping lists.
- A `recipe-import` skill that uses the tools with an in-chat human review step.
- No duplication of validation/ownership logic: MCP tools and HTTP API routes share
  one service layer.

## 3. Non-goals

- No second identity system. We reuse the existing Google/NextAuth login for the
  human-authentication step.
- No in-app "draft recipe" status or recipe-review UI. Recipe import review happens
  **in chat** (see §7), so the data model and app UI are unchanged for v1.
- No local CLI in this spec. The remote Connector is the surface. A developer CLI can
  be revisited later if a power-user/scripting need emerges.
- No changes to how the web app authenticates browser users.

## 4. Key decisions (with rationale)

| Decision        | Choice                                                                       | Rationale                                                                                                              |
| --------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Audience        | Any Weekly Eats user, self-serve                                             | User requirement. Drives OAuth + public remote endpoint.                                                               |
| Surface         | Remote MCP server = Claude Connector                                         | Self-serve "add by URL" can't be a local CLI.                                                                          |
| Hosting         | Route in the existing Next.js app on Vercel                                  | App already deploys to Vercel; shares auth + data layer.                                                               |
| Transport       | Streamable HTTP, **stateless**                                               | Current best practice; works with Fluid Compute; **no Redis** (Redis was only for legacy SSE / stateful sessions).     |
| Adapter         | `vercel/mcp-handler` over `@modelcontextprotocol/sdk` (≥ 1.26.0)             | Maintained Next.js adapter; provides `withMcpAuth` + RFC 9728 metadata handler. Pin a known-good version (see §10).    |
| Data access     | **Shared service layer** (Approach A)                                        | One source of truth for validation/ownership; no drift between HTTP and MCP.                                           |
| Auth server     | **Hand-rolled OAuth 2.1 AS** on top of Google/NextAuth                       | Single identity, no new SaaS dependency. Weekly Eats becomes the Authorization Server; Google is the human-login step. |
| Token model     | App mints its **own** MCP access/refresh tokens; Google tokens never exposed | "OAuth Proxy" pattern — control over token lifecycle, scope, revocation.                                               |
| Recipe review   | **In chat**, no draft state                                                  | Fastest, agent-native; avoids schema + review-UI work.                                                                 |
| Build structure | One spec, multiple implementation plans                                      | Pieces are tightly coupled (shared auth/service/tool conventions).                                                     |

## 5. Architecture overview

```
Claude (agent / recipe-import skill)
      │  MCP over Streamable HTTP (stateless)
      ▼
/api/mcp  ──withMcpAuth──►  verify MCP token → { userId, isApproved } in tool context
      │                              ▲
      │                              │ tokens minted by ↓
      │                     Weekly Eats OAuth AS (hand-rolled, §6.2)
      │                              │ delegates human login to
      │                     existing Google / NextAuth flow
      ▼
src/lib/services/*   ◄── same functions ──►  /api/* route handlers (thin wrappers)
      │
      ▼
MongoDB (user-scoped, unchanged collections + new mcp* collections)
```

The structural move: business logic migrates out of route handlers into
`src/lib/services/*`. Route handlers and MCP tools both become thin callers. One place
for validation, ownership, and user-scoping.

## 6. Components

### 6.1 MCP transport route — `src/app/api/mcp/route.ts`

- Built with `mcp-handler` wrapping `@modelcontextprotocol/sdk`.
- Stateless Streamable HTTP. Exports `GET`, `POST`, `DELETE`, and `OPTIONS`
  (incomplete method export causes silent client failures).
- Registers tools with **zod** schemas (already a dependency).
- Wrapped in `withMcpAuth` (see §6.4); `required: true`.
- Runs on Vercel Fluid Compute; extend function timeout as needed.

### 6.2 OAuth Authorization Server (hand-rolled)

Weekly Eats acts as a spec-compliant OAuth 2.1 Authorization Server. New endpoints:

| Endpoint                                  | Role                                                                                                                                                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/.well-known/oauth-protected-resource`   | RFC 9728 Protected Resource Metadata; advertises the AS. Served by `protectedResourceHandler()`.                                                                                                                  |
| `/.well-known/oauth-authorization-server` | AS metadata: issuer, authorize/token/register URLs, PKCE methods, supported scopes.                                                                                                                               |
| `/api/mcp/oauth/register`                 | Dynamic Client Registration (RFC 7591) — Claude auto-registers itself. Per-IP rate limited; see "AS hardening" below.                                                                                             |
| `/api/mcp/oauth/authorize`                | Authorization endpoint. Requires PKCE **and a server-verified `state`**. Bounces the user through existing Google/NextAuth login, then issues a short-lived, PKCE-bound auth code.                                |
| `/api/mcp/oauth/token`                    | Token endpoint. Exchanges auth code (or refresh token) for the app's own MCP access + refresh tokens, bound to `userId` and the resource indicator (RFC 8707). Re-checks approval on refresh; see "AS hardening". |
| `/api/mcp/oauth/revoke`                   | Token revocation (sets `revokedAt`; see §9).                                                                                                                                                                      |

**Token flow:** Claude → `register` → `authorize` → (Google login via NextAuth) →
auth code → `token` → MCP access + refresh token. Google's tokens are never returned
to Claude.

**Requirements enforced:** OAuth 2.1 + PKCE; Resource Indicators (RFC 8707) so tokens
are valid only for this MCP server; `401` responses carry `WWW-Authenticate` pointing
at the Protected Resource Metadata URL.

**AS hardening (required, from plan review):**

- **CSRF / `state` (I4):** `/authorize` generates a cryptographically random `state`,
  stores it server-side bound to the initiating request, carries it through the
  Google/NextAuth redirect, and verifies it on return **before** issuing the auth code.
  PKCE alone does not cover the authorization-request initiation leg.
- **Refresh & revocation (I5):** the token endpoint re-checks `isApproved`/`isAdmin`
  (and revocation status) from `users` on **every refresh exchange**, returning `401`
  and deleting the refresh token if the user is no longer approved. Refresh tokens use
  **rotation with reuse detection** (each refresh issues a new refresh token and
  invalidates the prior one; replay of a rotated token revokes the whole chain) and an
  **idle/sliding expiry** (TTL resets on use) rather than a hard absolute lifetime — so
  active users are never forced to periodically re-authenticate, while leaked or
  abandoned tokens still expire. **Rotation is atomic (S3):** perform it with a
  conditional `findOneAndUpdate` (filter: `hashedToken = H(R1)` **and** `replacedBy`
  unset **and** `revokedAt` null → set **only** `replacedBy = H(R2)`). `replacedBy` alone
  marks the token consumed (it can no longer match the filter), so `revokedAt` is
  reserved for "revoked for cause" (arch-002). If no document matched, the token was
  already rotated → revoke the whole chain (set `revokedAt` on every link). This mirrors the
  auth-code `findOneAndDelete` pattern (MA) and prevents a serverless race where two
  concurrent refreshes of the same token both succeed without tripping reuse detection.
- **DCR abuse (I6):** `/register` is per-IP rate limited; `mcpClients` documents carry
  a TTL/last-used cleanup policy (see §9). Registration is open per RFC 7591 but
  bounded by the rate limit; restricting to Claude's known client metadata is an option
  if abuse appears.
- **`redirect_uri` validation (S2):** `/register` rejects non-HTTPS `redirect_uris`
  (except `http://localhost`/`127.0.0.1` per RFC 8252). The AS stores them verbatim and
  matches **byte-for-byte** at `/authorize` — no prefix or wildcard matching. Without
  this, open registration lets an attacker register `redirect_uri=https://attacker.com`
  and exfiltrate a victim's auth code (RFC 7591 §5 open-redirector risk).
- **Auth-code single-use (MA):** `/token` consumes the auth code with an **atomic**
  `findOneAndDelete` (delete-on-exchange) so two concurrent exchanges of one code cannot
  both succeed on serverless. If an already-consumed code is presented again → `400`
  **and** revoke the access + refresh tokens issued from the first exchange (RFC 6749
  §4.1.2).
- **PKCE S256-only (sec-004):** the AS advertises and accepts **only**
  `code_challenge_method=S256`; `plain` or an absent method → `400`
  (`code_challenge_methods_supported = ["S256"]`). `plain` makes the challenge equal the
  verifier, which sits in the redirect URL — no real interception protection.
- **Auth-code client binding (sec-005):** `/token` verifies the request `client_id`
  equals the code's issuing `clientId` and the `redirect_uri` matches the authorization
  request's (both stored on `mcpAuthCodes`, §9) — OAuth 2.1 §4.1.3, so a different
  registered client cannot redeem another client's code.

**Approval re-check mechanism (M1):** `verifyToken` performs a **live `users` lookup on
every tool call** to read `isApproved`/`isAdmin` (not embedded in the token), so revoked
approval takes effect immediately. This is the intentional departure from the
JWT-cached web-app pattern in `src/lib/auth.ts`; the latency cost is one indexed lookup
per call and is accepted for a write-capable agent surface.

**Claude registration (resolved):** Claude uses **Dynamic Client Registration by
default** — it registers itself with our AS automatically — so `/api/mcp/oauth/register`
(RFC 7591) is a required Phase-2 deliverable, not optional. Manually-entered client
ID/secret (Claude's Advanced settings) is the fallback if DCR is ever unavailable. The
Protected Resource Metadata document must include `authorization_servers` and
`scopes_supported`; the AS metadata must advertise the authorize/token/register
endpoints and supported PKCE methods. Only residual: confirm exact field names against
the live Claude connector docs while implementing Phase 2.

**Reference implementation:** DTeam-Top/mcp-oauth (OAuth 2.1 MCP server as a Next.js
app) — adapt its AS endpoint structure to our Google/NextAuth login + Mongo storage.

### 6.3 Service layer — `src/lib/services/*`

Pure, transport-agnostic functions, one module per domain
(`recipes.ts`, `food-items.ts`, `meal-plans.ts`, `pantry.ts`, `shopping-lists.ts`).

- Signature shape: `(userId: string, input: …) => Promise<Result>`.
- Encapsulate validation — **including `ObjectId.isValid(id)` for id parameters (ME)**,
  per the project convention — plus ownership checks, user-scoping, and Mongo access.
- Throw typed domain errors from **`src/lib/service-errors.ts`** (see §8a) — a new
  Phase 1 deliverable, since `src/lib/errors.ts` today exports only string constants,
  not throwable classes.
- Existing route handlers are refactored to call these (behavior-preserving).
- MCP tools call the identical functions.

### 6.4 MCP auth gate — `verifyToken` for `withMcpAuth`

The connector equivalent of `requireApprovedSession`:

- Extract the bearer token, hash it, look it up in `mcpTokens`; reject if missing,
  **not `tokenType: 'access'` (arch-001 — a refresh token must never be accepted as a
  bearer; RFC 6749 §1.5)**, expired, `revokedAt` set, or the resource indicator doesn't
  match (M3, §9).
- Resolve `userId`, then perform a **live `users` lookup** for `isApproved`/`isAdmin`
  (not embedded in the token — see M1 in §6.2) so revoked approval applies immediately.
- Enforce `isApproved || isAdmin` (matches `requireApprovedSession` semantics).
- On success return `AuthInfo` with `userId` (+ approval flags) in `extra`; tool
  handlers read `extra.authInfo`.
- On failure return `undefined` → `withMcpAuth` issues `401` with `WWW-Authenticate`.

### 6.5 MCP tools

Thin wrappers over the service layer, grouped by domain. Each tool: zod input schema,
calls a service function with the authed `userId`, maps domain errors to MCP tool
errors. Initial (Phase set, §11):

- **Food items:** `food_items.search`, `food_items.get`, `food_items.create`.
- **Recipes:** `recipes.search`, `recipes.get`, `recipes.create`, `recipes.update`.
- **Later domains:** meal plans, pantry, shopping lists (read + write).

**Ownership-bearing fields (I3):** `food_items.create` via MCP **always forces
`isGlobal: false`** (personal items only). The existing HTTP route persists a
caller-supplied `isGlobal` with no admin gate (`food-items/route.ts:162`), so an agent
could otherwise publish globally-visible items into every user's catalog during import.
If admin-created globals are ever wanted, that path must re-check `isAdmin` from the MCP
auth context explicitly. Tool tests verify the forced `isGlobal: false` (see §8a).

**Override layer (A1):** to keep "routes and tools call identical service functions"
(§6.3) true, the `createFoodItem` **service** keeps accepting an `isGlobal` parameter
(preserving the HTTP route's current behavior). The **MCP tool wrapper** is what passes
`isGlobal: false` — the restriction lives in the tool, not the service. This avoids
silently changing the HTTP create path while still constraining the agent surface.

### 6.6 `recipe-import` skill

A distributable, installable Claude skill (`SKILL.md` + supporting files). It only
orchestrates MCP tools and the in-chat review — it never touches Mongo or the HTTP API
directly. Encapsulates the _judgment_ (parsing, fuzzy ingredient matching, unit
normalization, good confirmation questions); the connector enforces the _invariants_
(valid units, ownership, recipe structure). Installable and customizable in Claude.

**Source ingestion (resolved):** the skill relies on **Claude's native file/URL
reading** (Claude.ai, mobile, and Claude Code all ingest PDFs and fetch URLs) rather
than bundling its own fetcher/PDF parser. The skill operates on already-read content;
its job is extraction → tool orchestration. No parsing dependency to build or maintain.

## 7. Data flow — recipe import

```
User: "import this recipe: <url | pdf>"
  1. Skill fetches/reads the source; extracts { title, emoji?, ingredient lines, instructions }.
  2. For each ingredient line → food_items.search (fuzzy match against the user's catalog).
  3. Present in chat: matched food items + proposed NEW food items + parsed quantities/units.
  4. User confirms / corrects mappings.            ◄── human-in-the-loop, in chat
  5. food_items.create for each confirmed-new item.
  6. Assemble RecipeIngredientList[] with resolved foodItem ids + units.
  7. recipes.create → return a link to the recipe in the app.
```

Recipe structure is strict (per `src/types/recipe.ts`): each ingredient references a
real `foodItem` (with a unit) or another recipe by id — there is no free-text
ingredient. Steps 2–6 exist precisely to satisfy that invariant, and the connector
re-validates at `recipes.create`.

## 8. Error handling

- Service layer throws typed domain errors `ValidationError`, `NotFoundError`,
  `ForbiddenError` defined in **`src/lib/service-errors.ts`** (a new Phase 1
  deliverable — `@/lib/errors` provides only the message-string constants, which each
  error class carries). Route handlers and tools `instanceof`-check these.
- HTTP route handlers map these to existing status codes (400/403/404/500) — external
  API behavior is unchanged.
- MCP tools map these to MCP tool errors (`isError: true` + an actionable message
  Claude can respond to, e.g. "no matching food item; create one or pick another").
- Auth: missing/invalid token → `401` + `WWW-Authenticate` (triggers OAuth);
  authenticated-but-unapproved → a clear "not approved" tool error.
- Continue using `logError('ContextName', error)` server-side.

## 8a. Testing strategy

Every phase ships with tests, following the existing `__tests__/` + `vi.mock('@/lib/mongodb')`
pattern (see `docs/testing.md`). No phase is "done" on "tests stay green" alone.

- **Service layer (Phase 1)** — unit tests per function: happy path; `userId` scoping
  (never returns/ mutates another user's docs); ownership rejection → `ForbiddenError`;
  validation rejection → `ValidationError` with the right `@/lib/errors` constant;
  **malformed (non-ObjectId) id → `ValidationError` (ME)**; unknown id → `NotFoundError`.
  Plus: existing route-handler tests still pass after the refactor (behavior-preserving).
- **MCP tools (Phase 1)** — mock `@/lib/services/*` (not Mongo): correct service called
  with the authed `userId` from `extra.authInfo`; domain errors mapped to `isError`
  responses; zod input rejection produces a readable MCP error; `food_items.create`
  forces `isGlobal: false`.
- **`verifyToken` (Phase 2)** — valid token resolves to `{ userId, isApproved, isAdmin }`;
  expired token → `undefined`; revoked token (`revokedAt` set) → `undefined`;
  unapproved + non-admin → `undefined`; admin bypasses approval; malformed/forged
  bearer → `undefined`; resource-indicator mismatch → `undefined`.
  **Hashed-bearer lookup (T1):** a record keyed on `SHA-256(T)` matches raw bearer `T`,
  and submitting `SHA-256(T)` as the bearer does **not** match — proves the hash step is
  live, not just documented. **Post-issuance revocation (T3):** with the `mcpTokens`
  record still valid (non-expired, non-revoked) but the **live `users` lookup** returning
  `isApproved: false`, `verifyToken` → `undefined` — proves the live lookup governs, not
  a value cached in the token (the M1 guarantee). **Refresh-as-bearer (arch-001):** a
  valid, non-expired refresh token presented as the bearer → `undefined` (only
  `tokenType: 'access'` is accepted).
- **OAuth AS endpoints (Phase 2)** — `/token`: successful PKCE code exchange;
  `code_verifier` mismatch → 400; missing verifier → 400; expired auth code → 400;
  **unknown/unregistered `client_id` → 400/401 (T4)** (client auth per OAuth 2.1; mock
  `mcpClients.findOne` → null); **valid-but-wrong `client_id` or `redirect_uri` — code
  issued to client A, exchanged by client B → 400 (sec-005)**; replayed (single-use)
  code → 400 **and tokens from the first exchange are revoked (MA)**; **concurrent refresh of one token — exactly one
  succeeds, the loser triggers chain revocation (S3 atomicity)**; successful refresh
  **with** approval re-check; refresh by a now-unapproved user
  → 401 + token deleted; rotated-token replay revokes the chain. **Idle/sliding TTL
  (T2):** a successful refresh sets the replacement token's expiry relative to the
  exchange time; a token left unused past its idle window is rejected even if the
  absolute time since first issuance is short. `/authorize`: missing `code_challenge` →
  400; **`code_challenge_method=plain` or absent → 400 (sec-004)**; missing/!verified
  `state` → 400; **`state` cross-session isolation (MC)** — a valid `state` value
  generated in session A is rejected when replayed in session B; **expired
  `mcpAuthStates` doc rejected by application code (past `expiresAt`, mock lookup to
  bypass the TTL reaper) → 400 (test-001)**;
  `redirect_uri` mismatch → 400; unapproved user cannot obtain a code; **happy path (MD)**
  — valid `code_challenge` + matching `state` + approved user → code issued, `state`
  single-use. `/register`: rate-limit enforced; **non-HTTPS `redirect_uri` (non-localhost)
  → 400 (S2)**. `/revoke`: valid revocation succeeds; unknown token succeeds silently
  (RFC 7009 §2.2); unauthenticated → 401.
- **Phase 1 dev-token gate (Phase 2)** — integration test asserting the production
  configuration rejects the static dev token (see §11, C1).
- **Skill (Phase 3)** — validated manually.

## 9. Data model changes

No changes to existing collections. New collections for the AS:

- `mcpClients` — registered OAuth clients (from DCR). Carries a `lastUsedAt`/TTL
  cleanup policy so abandoned registrations are reaped (I6).
- `mcpAuthCodes` — short-lived PKCE-bound authorization codes. Each stores the issuing
  **`clientId`, `redirectUri`, and PKCE `code_challenge`**; `/token` verifies the
  request's `client_id` and `redirect_uri` match these at exchange (sec-005, OAuth 2.1
  §4.1.3 — prevents cross-client code injection). **Single-use enforced via an atomic
  `findOneAndDelete` on exchange (MA)** — not a read-then-delete — so concurrent
  serverless exchanges of one code cannot both succeed.
- `mcpTokens` — access + refresh tokens bound to `userId`, each with a
  **`tokenType: 'access' | 'refresh'`** discriminator (arch-001; `verifyToken` accepts
  only `'access'`), expiry, and a `revokedAt` field. Refresh tokens use rotation (a
  `replacedBy`/chain reference) for reuse detection and an idle/sliding TTL; rotation is
  performed with an **atomic conditional `findOneAndUpdate`** (S3, §6.2).
- `mcpAuthStates` (A2) — one document per in-flight `/authorize` request, holding the
  `state` nonce (or its hash), `clientId`, `redirectUri`, and a short TTL (~10 min).
  Single-use: deleted on the callback after verification. This is where the I4 `state`
  lives (the stateless runtime can't hold it in memory, and the auth code doesn't exist
  yet at redirect time). A signed, short-lived server-side cookie is an acceptable
  alternative; the collection is the default.

**Storage format (M2 + S1):** access tokens, **refresh tokens**, and auth codes are all
persisted as **SHA-256 hashes**, never plaintext — the raw secret is returned to the
client once at issuance and never stored. The token endpoint hashes an incoming refresh
token before lookup and stores its rotated replacement as a hash. A database read
therefore cannot impersonate a user or mint new tokens (refresh tokens are the
long-lived secret, so hashing them is as important as hashing access tokens).
**Generation (S4):** raw tokens, auth codes, and `state` nonces are generated from a
CSPRNG (`crypto.randomBytes(32)`, ≥256 bits) — hashing at rest does not compensate for a
weak source, so the entropy must come from generation.

**Revocation (M3):** `/revoke` (and refresh-rotation/approval-loss) sets `revokedAt`
rather than deleting the document, so `verifyToken` and the token endpoint **must check
`revokedAt`** on every use. TTL indexes are keyed on the **expiry** field (not
`revokedAt`), so MongoDB's eventual TTL deletion never races ahead of an explicit
revocation check.

Indexes added to `src/lib/database-indexes.ts` (TTL on `mcpAuthCodes`/`mcpTokens`/
`mcpAuthStates` expiry; `mcpClients` cleanup; lookup indexes on the hashed-token
fields). **Also add the four `mcp*` collections to the hardcoded list in
`dropAllIndexes()` (`database-indexes.ts:155`) (MB)**, or dev/test resets leave stale
`mcp*` indexes behind.

## 10. Security considerations

- **User-scoping is non-negotiable:** every service function filters by the authed
  `userId`; no tool accepts a caller-supplied user id. `food_items.create` forces
  `isGlobal: false` (I3, §6.5).
- **Approval gating** re-checked live on every tool call **and on every refresh
  exchange** (not just at token issuance) — see §6.2 (I5) and §6.4 (M1).
- **Token isolation:** Google tokens never leave the server; only app-minted MCP
  tokens reach Claude, stored hashed at rest (M2, §9). Tokens are resource-scoped
  (RFC 8707).
- **PKCE + `state` required** on the authorization code flow (I4, §6.2); DCR endpoint
  is rate limited (I6, §6.2).
- **Pinned dependencies:** `@modelcontextprotocol/sdk` ≥ 1.26.0 (prior versions have
  advisories). Per the `mcp-handler` README, **Redis is optional and only needed for
  the legacy SSE transport** — stateless Streamable HTTP needs none. The earlier
  no-Redis infinite-loop issue (vercel/vercel#13321) is closed; use a current
  `mcp-handler` release.
- **Least privilege:** v1 uses a single scope granting the user access to their own
  data; finer scopes can come later.

## 11. Implementation phases

One spec, built and reviewed as separate plans (run `writing-plans` per phase):

**Phase 1 — Service layer + recipes/food-items tools (behind a dev token).**
Add `src/lib/service-errors.ts` (typed throwable errors, §8); extract
`services/recipes.ts` and `services/food-items.ts`; refactor the existing routes to call
them (existing tests stay green) and add the service + tool tests in §8a. Stand up
`/api/mcp` (stateless Streamable HTTP) with the recipes + food-items tools.
**Dev-token gate (C1):** the temporary static bearer token is enabled **only** when
`MCP_DEV_TOKEN` is set **and** `NODE_ENV !== 'production'` — it is never wired into any
deployed environment. _Deliverable: tools callable from a local MCP client._

**Phase 2 — OAuth Authorization Server + approval-gated verification + deploy.**
Implement the AS endpoints (§6.2) including `state`/CSRF, refresh re-approval + rotation,
DCR rate limiting, and hashed token storage; implement `verifyToken` (§6.4); create the
`mcp*` collections + indexes (§9); add the §8a auth tests. **Exit checklist:** the
Phase 1 dev-token code path is removed or provably inert in production, verified by the
§8a integration test, before deploy. Replace the dev token with real OAuth.
_Deliverable: a self-serve connector an approved user can add in Claude and use for
recipes + food items._

**Phase 3 — `recipe-import` skill.**
Build and package the skill (§6.6) on top of Phase 1–2 tools. _Deliverable: the
motivating use case, installable in Claude._

**Phase 4 — Remaining domains.**
Extract services + register tools for meal plans, pantry, and shopping lists, repeating
the established pattern. _Deliverable: full read/write tool surface._

## 12. Open questions / risks

Resolved during design (see §6.2, §6.6, §10): Claude DCR is a confirmed Phase-2
requirement; the stateless/Redis concern is cleared (Redis is SSE-only); PDF/URL
ingestion uses Claude's native file reading.

Resolved during plan review (see `2026-05-29-agent-connector-design-review.md`): the
OAuth AS now specifies `state`/CSRF (I4), refresh re-approval + rotation + idle expiry
(I5), DCR rate limiting + `mcpClients` TTL (I6), hashed token storage (M2),
`revokedAt`-based revocation (M3), and live approval re-check (M1); the spec adds a
Testing strategy (§8a, I1), a `service-errors.ts` deliverable (I2), the
`food_items.create` `isGlobal: false` rule (I3), and the Phase 1 dev-token gate (C1).

Resolved during plan review loop 2 (see the same review file): refresh tokens are now
hashed too (S1); `/register` validates `redirect_uri` (HTTPS + byte-match, S2); the
`isGlobal: false` override is pinned to the tool layer (A1); auth codes are single-use
via atomic `findOneAndDelete` + revoke-on-replay (MA); `dropAllIndexes()` must include
the `mcp*` collections (MB); §6.3 calls out `ObjectId.isValid` (ME); and §8a gains test
cases for hashed-bearer lookup (T1), idle TTL (T2), post-issuance live revocation (T3),
`state` cross-session isolation (MC), the `/authorize` happy path (MD), and malformed
ids (ME).

Resolved during plan review loop 3 (see the same review file): refresh-token rotation is
**atomic** via conditional `findOneAndUpdate` (S3); a new `mcpAuthStates` collection
holds the I4 `state` nonce (A2); tokens/codes/state are generated from a CSPRNG (S4);
and §8a adds `/token` unknown-`client_id` and concurrent-rotation cases (T4 + S3).

Resolved during plan review loop 4 (deep security pass): `mcpTokens` gains a `tokenType`
discriminator and `verifyToken` accepts only access tokens (arch-001); `mcpAuthCodes`
stores and `/token` verifies `clientId`/`redirectUri` (sec-005); PKCE is S256-only,
`plain` rejected (sec-004); the S3 rotation update payload is clarified (arch-002); and
§8a adds refresh-as-bearer, cross-client-code, `plain`-rejection, and expired-`state`
cases. With these, the review converged — no Critical/Important findings remain.

Remaining:

- **Exact Claude DCR/metadata field names:** confirm against the live Claude connector
  docs while implementing Phase 2 (low risk — shape is known, only field-name details
  remain).
- **Service extraction surface:** keep each phase's refactor scoped to the routes that
  phase exposes; avoid a big-bang refactor of all routes at once. (Process guideline,
  not an unknown.)

## 13. References

- [MCP Authorization spec (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [Claude — custom connectors via remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [vercel/mcp-handler](https://github.com/vercel/mcp-handler) · [AUTHORIZATION.md](https://github.com/vercel/mcp-handler/blob/main/docs/AUTHORIZATION.md)
- [Vercel — building efficient MCP servers](https://vercel.com/blog/building-efficient-mcp-servers)
- [Google OAuth + custom MCP tokens (OAuth Proxy pattern)](https://medium.com/@v31u/mcp-security-simplified-leveraging-google-oauth-for-authentication-475893c51ce0)
- [DTeam-Top/mcp-oauth — OAuth 2.1 MCP server on Next.js](https://mcpservers.org/servers/DTeam-Top/mcp-oauth)
