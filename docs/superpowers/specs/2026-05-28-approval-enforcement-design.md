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
   `session.update()` when the pending-approval page detects approval. Preserves
   the JWT caching design; costs one DB read only at the moment of approval.

## Architecture

Three coordinated pieces plus tests.

### 1. Middleware gate — `src/middleware.ts` (primary, central)

After the existing `if (!token)` redirect block, add an approval check using the
JWT's `token.isApproved` (no DB query). Behavior branches by request type:

- **API requests** (`pathname.startsWith('/api/')`) → `403` JSON
  `{ error: AUTH_ERRORS.FORBIDDEN }`.
- **Page requests** → `NextResponse.redirect` to `/pending-approval`.

**Exempt paths** an unapproved user must still reach (checked before the gate so
they are never blocked):

- `/pending-approval` — the page itself; prevents a redirect loop.
- `/api/user/approval-status` — the polling endpoint that drives token refresh.
- Everything already short-circuited at the top of the middleware (`/`,
  `/api/auth/*`, `/_next/*`, `/static/*`, `/manifest.json`, any path containing
  `.`).

**Edge-runtime note:** confirm `@/lib/errors` is edge-safe before importing
`AUTH_ERRORS` into middleware (it should be — plain constants and a `logError`
function with no Node built-ins at module load). If it is not edge-safe, move the
needed constant into an edge-safe module rather than hardcoding the string
(project convention: never hardcode error strings).

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
- `session.user.isApproved !== true` → `403` with `AUTH_ERRORS.FORBIDDEN`.

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

### 3. Token refresh on approval — `src/app/pending-approval/page.tsx`

Today the page relies on `useSession()` and the cached token, which never
refreshes mid-session — so an approved user stays stuck until manual re-login.
`/api/user/approval-status` exists but currently has no consumer. This wires it
up:

- Poll `/api/user/approval-status` on an interval (~10s) — a fresh DB read that
  bypasses the stale token.
- When it returns `isApproved: true`, call `update()` from `useSession()`. This
  fires the `jwt` callback with `trigger === 'update'`, which `auth.ts:21`
  already handles by re-reading `isApproved` from the DB into the token.
- Then redirect to `/meal-plans`. Middleware now sees a fresh
  `isApproved: true` — no bounce-back loop.

`src/lib/auth.ts` needs no change if the `update` trigger already re-reads
`isApproved` (it does — line 21 includes `trigger === 'update'` via the
`token.isAdmin === undefined` / signIn / signUp / update guard). Verify during
implementation; only adjust if the guard excludes the update path.

Stop the polling interval on unmount and once approval is detected.

### 4. Testing

- **`src/__tests__/middleware.test.ts` (new):**
  - unapproved token → `403` on `/api/meal-plans`
  - unapproved token → redirect to `/pending-approval` on `/recipes`
  - exempt paths (`/pending-approval`, `/api/user/approval-status`) pass through
    for an unapproved token
  - approved token → passes through
  - no token → redirect to `/` (existing behavior preserved)
- **Helper unit tests:** `401` (no session), `403` (unapproved), pass-through
  (approved).
- **Representative route tests:** add an "unapproved → 403" case to a couple of
  data routes (e.g. meal-plans, recipes) to lock in the helper wiring; update any
  existing route tests whose session mocks omit `isApproved: true`.
- **Pending-approval page test:** poll returns approved → `update()` called →
  redirect to `/meal-plans`.

Follow the project's test conventions (`docs/testing.md`): mock `next-auth/next`
and `@/lib/mongodb`; when mocking `@/lib/errors`, include all constant groups the
route uses.

## Risks & mitigations

| Risk                                                                          | Mitigation                                                                                                                        |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Redirect loop (stale token bounces approved user back to `/pending-approval`) | Option 1 token refresh via `update()` before redirect; `/pending-approval` and `/api/user/approval-status` exempted in middleware |
| `@/lib/errors` not edge-safe, breaking middleware build                       | Verify edge-safety; relocate the constant to an edge-safe module if needed (no hardcoded strings)                                 |
| Existing route tests fail because session mocks lack `isApproved`             | Audit and update affected mocks as part of the change                                                                             |
| Pending-approval page breaks if its layout makes API calls                    | Verified: `AuthenticatedLayout` makes no API calls and renders no avatar; page only needs `/api/auth/session` (exempt)            |

## Rollout

Single PR on `fix/83-unapproved-users-access-issue`. `npm run check` (lint +
test:coverage + build) must pass. No migration or env changes.
