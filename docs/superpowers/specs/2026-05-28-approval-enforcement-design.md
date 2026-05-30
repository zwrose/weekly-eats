# Server-side approval enforcement — design

**Issue:** [#83](https://github.com/zwrose/weekly-eats/issues/83) — No server-side
approval enforcement: unapproved authenticated users can call every data API.
**Date:** 2026-05-28
**Status:** Approved (design) — pending implementation plan

## Problem

`src/middleware.ts:30` gates only on `if (!token)` — it checks authentication,
never `token.isApproved`. Every data API route likewise gates only on
`if (!session?.user?.id)`. As a result a signed-in but **unapproved** user (one
awaiting admin approval) can call every data route: create/read/update meal
plans, recipes, pantry, stores, shopping lists, and send sharing invites. The
`/pending-approval` screen is purely client-side and enforces nothing.

`isApproved` is already cached in the JWT (`src/lib/auth.ts:28,44`), so the gate
can read it without a database query.

## Goals

- Enforce approval on the server for every user-data route.
- Defense-in-depth: a central gate plus a per-handler check, so a gap in either
  layer is covered by the other.
- Avoid locking out a user who is approved mid-session.
- Self-contained: does not depend on the redesign plan.

## Non-goals

- Instant `isAdmin` promote/demote propagation (admins re-login as today).
- Broader sharing-permission rework.
- Changing the JWT session strategy.

## Decisions (from brainstorming)

1. **Enforcement layering:** Both — central middleware gate **and** a shared
   per-handler helper.
2. **Stale-token handling:** Option 1 — refresh the token via NextAuth's
   `session.update()` when approval is detected. The polling + `update()` +
   redirect loop **already exists** in `src/lib/use-approval-status.ts` (mounted
   via `AuthenticatedLayout`); the only change required is fixing the `jwt`
   callback to honor the `update` trigger (see §3). Preserves the JWT caching
   design; costs one DB read only at the moment of approval.

## Architecture

Three coordinated pieces plus tests.

### 1. Middleware gate — `src/middleware.ts` (primary, central)

Insert the approval check **after** the existing `if (!token)` redirect block
**and after** the exempt short-circuit (`middleware.ts:12-21`), so `/api/auth/*`
(sign-out, session) keeps working for pending users. The gate condition is
`token.isApproved !== true && token.isAdmin !== true` (not `=== false`) so a
token minted before the claim existed fails closed. **Admins bypass approval:**
`isAdmin` and `isApproved` are independent flags (granting admin never sets
approval, and nothing auto-approves admins), and the client already exempts
admins from approval gating (`use-approval-status.ts`); an unapproved admin must
still reach `/user-management` to approve users. It reads the JWT's claims (no DB
query) and branches by request type:

- **API requests** (`pathname.startsWith('/api/')`) → `403` JSON
  `{ error: AUTH_ERRORS.FORBIDDEN }`.
- **Page requests** → `NextResponse.redirect` to `/pending-approval`.

**Exempt paths** an unapproved user must still reach (checked before the gate so
they are never blocked):

- `/pending-approval` — the page itself; prevents a redirect loop.
- `/api/user/approval-status` — the polling endpoint that drives token refresh.
- `/api/avatar` — public image proxy with no session and its own URL validation
  (only `https://lh3.googleusercontent.com/`). The pending-approval page renders
  `AuthenticatedLayout` → `Header` → `CachedAvatar`, which requests
  `/api/avatar`; exempting it keeps the avatar working on the pending screen
  (otherwise `CachedAvatar` falls back to a default icon — cosmetic but
  avoidable).
- Everything already short-circuited at the top of the middleware (`/`,
  `/api/auth/*`, `/_next/*`, `/static/*`, `/manifest.json`, any path containing
  `.`).

**Edge-runtime note:** `@/lib/errors` is confirmed edge-safe (plain constant
objects + a `console.error`-based `logError`, no Node built-ins at module load),
so import `AUTH_ERRORS` from `@/lib/errors` into middleware directly.

### 2. Shared API helper — `requireApprovedSession()` (defense-in-depth)

New helper added alongside the existing session helpers in
`src/lib/user-utils.ts`. Returns a discriminated result so handlers stay terse:

```ts
// Returns { session } on success, or { error: NextResponse } to return directly.
const { session, error } = await requireApprovedSession();
if (error) return error;
// ...session.user.id / session.user.isApproved are safe to use
```

- No session / no `user.id` → `401` with `AUTH_ERRORS.UNAUTHORIZED`.
- `session.user.isApproved !== true && session.user.isAdmin !== true` → `403`
  with `AUTH_ERRORS.FORBIDDEN` (admins bypass approval, matching the middleware
  gate and the client's `use-approval-status` exemption).

This **replaces** the existing `if (!session?.user?.id) return 401` blocks in all
user-data routes:

- `meal-plans` (`route.ts`, `[id]`, `summary`, `template`)
- `recipes` (`route.ts`, `[id]`, `[id]/rating`, `[id]/tags`, `[id]/user-data`,
  `tags`, `user-data/batch`)
- `food-items` (`route.ts`, `[id]`)
- `pantry` (`route.ts`, `[id]`)
- `stores` (`route.ts`, `[id]`, `[id]/invite`, `[id]/invitations/[userId]`,
  `invitations`)
- `shopping-lists` (`[storeId]` and all sub-routes)
- `user/meal-plan-sharing/*`, `user/recipe-sharing/*`, `user/settings`
- `ably/token`

**Not touched:**

- Admin routes (`api/admin/*`) — keep their own `isAdmin` DB gate.
- `/api/user/approval-status` — must serve unapproved users.
- `/api/avatar` — public proxy, no session.
- `/api/auth/*` — NextAuth internals.

The helper is the second layer: even though middleware already blocks `/api/*`
for unapproved users, the helper guarantees a correct `403` if the middleware
matcher ever changes or a path slips through.

**Placement note:** the helper returns an HTTP `NextResponse` from
`user-utils.ts`, which today holds pure data logic. This is acceptable (the file
already imports `getServerSession`), but the discriminated `{ session, error }`
shape must be applied **uniformly** across every route in the set above — not
partially — so the gating is consistent and greppable.

### 3. Token refresh on approval — `src/lib/auth.ts` (required fix)

The client side of this already exists and needs **no new code**:
`src/lib/use-approval-status.ts` (mounted via `AuthenticatedLayout`, which the
pending-approval page renders) already polls `/api/user/approval-status` every
60s, calls `update({ isApproved: true })` on the approve transition, redirects to
`/meal-plans`, and handles the reverse (approved → unapproved) demotion to
`/pending-approval`. So the pending-approval page itself needs no polling added.

The bug is server-side. `update()` fires the `jwt` callback with
`trigger === 'update'`, but the callback's guard
(`src/lib/auth.ts:21`) is `trigger === 'signIn' || trigger === 'signUp' ||
token.isAdmin === undefined` — it has **no `update` branch**. After sign-in
`token.isAdmin` is defined, so `update()` never re-reads `isApproved` and the
token stays stale. Today that's invisible (nothing enforces `isApproved`
server-side); once the middleware gate lands, the stale token bounces the
just-approved user straight back to `/pending-approval` — the redirect loop.

**Required change:** add `trigger === 'update'` to the `jwt` callback's re-read
branch so the token is refreshed from the database. The re-read must query the
DB by `token.email` (authoritative) — it must **not** merge the client-supplied
`update({ isApproved: true })` payload into the token, or a malicious client
could self-approve. Re-reading both `isApproved` and `isAdmin` from the DB keeps
the value trustworthy.

After the fix: poll detects approval → `update()` → `jwt` callback re-reads
`isApproved: true` from the DB → redirect → middleware sees a fresh approved
token. No loop.

### 4. Testing

- **`src/__tests__/middleware.test.ts` (new).** No test in the project currently
  mocks `getToken`, and there is no `middleware.test.ts` precedent, so the harness
  must be built: mock `getToken` from `next-auth/jwt`, construct a `NextRequest`
  with the target URL, and assert the response (redirect = 307 + `location`
  header for page paths; 403 JSON body for `/api/*` paths). Add a
  `// @vitest-environment node` docblock if the default jsdom env can't construct
  the request. Cases:
  - unapproved token → `403` JSON on `/api/meal-plans`
  - unapproved token → redirect to `/pending-approval` on `/recipes`
  - `isApproved: undefined` token → treated as unapproved (fail-closed)
  - exempt passthrough for an unapproved token: `/api/user/approval-status`,
    `/pending-approval`, **and** `/api/auth/*` (sign-out must keep working)
  - approved token → passes through
  - no token → redirect to `/` (existing behavior preserved)
- **`jwt` callback test — extend the existing file.**
  `src/lib/__tests__/auth.test.ts` already exists (added in #87) with a working
  jwt-callback harness (mocks `getMongoClient`, `@/lib/mongodb-adapter`,
  `@/lib/errors`) covering the `signIn` trigger. Add a case there: `trigger ===
'update'` re-reads `isApproved` from the DB and **ignores** the client-supplied
  `update()` payload (proves no self-approval). Reuse the file's existing mock
  setup rather than building a new harness.
- **`useApprovalStatus` hook test (currently untested):** poll returns
  `isApproved: true` → `update()` called → redirect to `/meal-plans`; and the
  reverse demotion (`true → false`) → redirect to `/pending-approval`. **The hook
  wraps `update()` + `router.push()` in `setTimeout(..., 100)`
  (`use-approval-status.ts:45-49,55-59`)** — the test must drive it with fake
  timers (`vi.useFakeTimers` + `advanceTimersByTime`) or `waitFor`, or it will be
  flaky. Mock `useSession`/`useRouter`/`fetch` using the existing precedent at
  `src/app/meal-plans/__tests__/page.test.tsx:12-16`.
- **Helper unit tests:** `401` (no session), `403` (unapproved), pass-through
  (approved); cover `isApproved` **absent vs. `false`**. Mock `@/lib/mongodb` and
  `@/lib/mongodb-adapter` (the latter is imported transitively via `auth.ts`); see
  `src/lib/__tests__/auth.test.ts` for the established adapter-mock pattern
  (`vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }))`).
- **Route-test migration (core work, not an afterthought).** As of the #87 merge,
  **34 user-data route test files** mock the session (~270 session-mock literals,
  shapes like `{ user: { id: 'u1' } }` / `{ user: { email: ... } }`) and
  essentially **none** set `isApproved`. Once the helper enforces
  `isApproved !== true`, every one of those success-path tests would flip to
  `403`. Introduce a single shared approved-session fixture in a test-helpers
  module (e.g. `src/test-utils/session.ts` exporting
  `approvedSession(overrides?)` → a session with `isApproved: true` by default and
  **overridable** `id`/`email`/`isAdmin`, since the existing mocks use varied
  shapes — `id`-based, `email`-based, some with `isAdmin`). Apply it across all 34
  files rather than editing ~270 literals ad hoc (a naive find-replace won't work
  given the varied shapes). The ~2 files that already set `isApproved` must be
  **reconciled** to the fixture, not blindly overwritten. The 4 `api/admin/*`
  route test files are **excluded** (they gate on `isAdmin`, not the helper). The
  `ably/token` route test (added in #87) is part of the 34. Add at least one
  explicit "unapproved → 403" case (e.g. meal-plans, recipes) to lock in the
  helper wiring.

Follow the project's test conventions (`docs/testing.md`): mock `next-auth/next`
and `@/lib/mongodb`; when mocking `@/lib/errors`, include all constant groups the
route uses.

## Risks & mitigations

| Risk                                                                                           | Mitigation                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redirect loop (stale token bounces approved user back to `/pending-approval`)                  | Fix the `jwt` callback to re-read `isApproved` on the `update` trigger (§3); `/pending-approval` and `/api/user/approval-status` exempted in middleware                                                                                                                                |
| Self-approval via the `update()` payload                                                       | The `jwt` callback re-reads `isApproved` from the DB by `email`; it never trusts the client-supplied `update({ isApproved })` value                                                                                                                                                    |
| 34 route-test success paths (~270 session mocks) flip to 403 once the helper enforces approval | Introduce a shared approved-session fixture and apply across all 34 affected route tests; the 4 `api/admin/*` route tests are excluded (treated as core work in §4)                                                                                                                    |
| Sign-out breaks for pending users if the gate is mis-ordered                                   | Insert the gate after the exempt short-circuit; assert `/api/auth/*` passthrough in the middleware test                                                                                                                                                                                |
| Pending-approval page breaks if its layout makes API calls                                     | `AuthenticatedLayout` mounts `useApprovalStatus` (polls `/api/user/approval-status`, exempt) and renders `Header` → `CachedAvatar` → `GET /api/avatar`. Both are exempted in §1, so the page works fully; `CachedAvatar` also degrades to a default icon if `/api/avatar` ever errors. |

## Rollout

Single PR on `fix/83-unapproved-users-access-issue`. `npm run check` (lint +
test:coverage + build) must pass. Note that `vitest.config.ts` defines no
enforced coverage thresholds, so the correctness guarantee for the new gate code
is the **explicit §4 test list**, not a coverage gate — `check` still runs
lint + test + build. No migration or env changes.
