# Server-Side Approval Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop signed-in-but-unapproved users from reaching any data API by enforcing `isApproved` server-side, both centrally (middleware) and per-handler (a shared helper), without locking out users approved mid-session.

**Architecture:** Three coordinated changes plus tests. (1) `src/middleware.ts` gains an approval gate that reads the JWT's `token.isApproved` and 403s API requests / redirects page requests for unapproved users. (2) A new `requireApprovedSession()` helper in `src/lib/user-utils.ts` replaces the `if (!session?.user?.id) return 401` block in every user-data route, adding a 403-on-unapproved second layer. (3) `src/lib/auth.ts`'s `jwt` callback is fixed to re-read `isApproved` from the DB on the `update` trigger so the already-existing `useApprovalStatus` polling hook can unstick a freshly-approved user. The full design lives in `docs/superpowers/specs/2026-05-28-approval-enforcement-design.md`.

**Tech Stack:** Next.js 15 (App Router) middleware (edge runtime), NextAuth v4 (JWT strategy), MongoDB, Vitest + React Testing Library.

**Branch:** `fix/83-unapproved-users-access-issue` (already checked out). Never push to `main`.

**Commit convention:** Every commit message ends with the trailer:

```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

**Test commands:** Run a single file with `npx vitest run <path>`; a single case with `npx vitest run <path> -t "<name>"`. If a run errors on a real DB connection, prefix with `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true`. Final validation is `npm run check` (lint + test:coverage + build), run **once** at the end.

---

## File Structure

**New files:**

- `src/lib/user-utils.ts` — _modified_; gains `requireApprovedSession()` alongside the existing session helpers (single responsibility: server-side session/auth helpers).
- `src/test-utils/session.ts` — _new_; `approvedSession()` / `unapprovedSession()` test fixtures. One responsibility: build typed mock `Session` objects.
- `src/__tests__/middleware.test.ts` — _new_; middleware approval-gate tests (new harness mocking `getToken`).
- `src/lib/__tests__/use-approval-status.test.tsx` — _new_; tests for the existing (untested) polling hook.

**Modified files:**

- `src/middleware.ts` — add the approval gate + exempt list.
- `src/lib/auth.ts` — add `trigger === 'update'` to the `jwt` re-read guard.
- `src/lib/__tests__/auth.test.ts` — add `update`-trigger cases (reuse existing harness).
- `src/lib/__tests__/user-utils.test.ts` — add `requireApprovedSession` cases.
- **37 route handlers** under `src/app/api/**` (listed in Task 6) — swap the inline auth block for the helper.
- **~34 route test files** colocated with those handlers — swap session literals to the fixture + add an unapproved→403 case.

---

## Task 1: `requireApprovedSession()` helper

**Files:**

- Modify: `src/lib/user-utils.ts`
- Test: `src/lib/__tests__/user-utils.test.ts` (existing)

The helper calls `getServerSession(authOptions)` and returns a discriminated result. Consumers write `const { session, error } = await requireApprovedSession(); if (error) return error;`. The `error?: never` / `session?: never` typing lets TypeScript narrow `session` to non-null after the `if (error) return` guard. The helper does **not** touch the DB — it only reads `session.user.isApproved`.

- [ ] **Step 1: Write the failing tests**

Append this block to `src/lib/__tests__/user-utils.test.ts` (the file already mocks `next-auth/next` and `@/lib/auth`, and defines `mockGetServerSession`). Add the import at the top alongside the existing import from `../user-utils`:

```ts
import { getUserObjectId, getCurrentUserAdminStatus, requireApprovedSession } from '../user-utils';
```

Then add this describe block at the end of the top-level `describe('user-utils', ...)`:

```ts
describe('requireApprovedSession', () => {
  it('returns a 401 error response when there is no session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { session, error } = await requireApprovedSession();

    expect(session).toBeUndefined();
    expect(error?.status).toBe(401);
    expect(await error?.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns a 401 error response when the session has no user id', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'x@y.com' } } as never);

    const { error } = await requireApprovedSession();

    expect(error?.status).toBe(401);
  });

  it('returns a 403 error response when the user is not approved', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u1', isApproved: false },
    } as never);

    const { session, error } = await requireApprovedSession();

    expect(session).toBeUndefined();
    expect(error?.status).toBe(403);
    expect(await error?.json()).toEqual({ error: 'Forbidden' });
  });

  it('returns a 403 when isApproved is absent (fail-closed)', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } } as never);

    const { error } = await requireApprovedSession();

    expect(error?.status).toBe(403);
  });

  it('returns the session (no error) for an approved user', async () => {
    const approved = { user: { id: 'u1', isApproved: true } };
    mockGetServerSession.mockResolvedValue(approved as never);

    const { session, error } = await requireApprovedSession();

    expect(error).toBeUndefined();
    expect(session).toEqual(approved);
  });

  it('returns the session for an unapproved ADMIN (admins bypass approval)', async () => {
    const adminSession = { user: { id: 'a1', isApproved: false, isAdmin: true } };
    mockGetServerSession.mockResolvedValue(adminSession as never);

    const { session, error } = await requireApprovedSession();

    expect(error).toBeUndefined();
    expect(session).toEqual(adminSession);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/user-utils.test.ts -t requireApprovedSession`
Expected: FAIL — `requireApprovedSession is not a function` (not yet exported).

- [ ] **Step 3: Implement the helper**

In `src/lib/user-utils.ts`, add these imports at the top (next to the existing imports):

```ts
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { AUTH_ERRORS } from './errors';
```

Then append the helper to the file:

```ts
type RequireApprovedSessionResult =
  | { session: Session; error?: never }
  | { session?: never; error: NextResponse };

/**
 * Server-side gate for user-data API routes. Returns the session for a
 * signed-in user who is approved OR an admin (admins bypass approval, matching
 * the client behavior in use-approval-status.ts), or an `error` NextResponse to
 * return directly: 401 when unauthenticated, 403 when signed in but neither
 * approved nor admin.
 *
 * Usage:
 *   const { session, error } = await requireApprovedSession();
 *   if (error) return error;
 */
export const requireApprovedSession = async (): Promise<RequireApprovedSessionResult> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 }) };
  }
  // Admins bypass approval (isAdmin and isApproved are independent flags; an
  // unapproved admin must still reach admin tooling to approve users).
  if (session.user.isApproved !== true && session.user.isAdmin !== true) {
    return { error: NextResponse.json({ error: AUTH_ERRORS.FORBIDDEN }, { status: 403 }) };
  }
  return { session };
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/user-utils.test.ts -t requireApprovedSession`
Expected: PASS (5 passing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/user-utils.ts src/lib/__tests__/user-utils.test.ts
git commit -m "feat: add requireApprovedSession helper (#83)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Shared approved-session test fixture

**Files:**

- Create: `src/test-utils/session.ts`

This fixture is used by the route-test migration (Task 6) so ~270 ad-hoc session literals collapse to one overridable factory. No standalone test — it's exercised by every migrated route test.

- [ ] **Step 1: Create the fixture**

Create `src/test-utils/session.ts`:

```ts
import type { Session } from 'next-auth';

type SessionUserOverrides = Partial<Session['user']>;

/**
 * Build a mock NextAuth session for an APPROVED user.
 * Defaults: id 'u1', approved, non-admin. Override any field (id/email/isAdmin/
 * isApproved) to match a given route test's expectations.
 */
export const approvedSession = (overrides: SessionUserOverrides = {}): Session => ({
  user: {
    id: 'u1',
    email: 'user@test.com',
    isAdmin: false,
    isApproved: true,
    ...overrides,
  },
  expires: '2099-01-01T00:00:00.000Z',
});

/**
 * Build a mock NextAuth session for an UNAPPROVED user (signed in, awaiting
 * admin approval). Same overrides as approvedSession.
 */
export const unapprovedSession = (overrides: SessionUserOverrides = {}): Session =>
  approvedSession({ isApproved: false, ...overrides });
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors (the PostToolUse typecheck hook also runs this on save).

- [ ] **Step 3: Commit**

```bash
git add src/test-utils/session.ts
git commit -m "test: add approved/unapproved session fixtures (#83)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Fix the `jwt` callback to honor the `update` trigger

**Files:**

- Modify: `src/lib/auth.ts:21`
- Test: `src/lib/__tests__/auth.test.ts` (existing)

The `jwt` callback already re-reads `isAdmin`/`isApproved` from the DB by `token.email` inside its guard — but the guard omits `trigger === 'update'`, so `useApprovalStatus`'s `update()` call never refreshes the token. Adding `update` to the guard fixes the redirect loop. The callback never reads the client `update()` payload, so this cannot be used to self-approve — the new tests prove it.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('jwt callback', ...)` block in `src/lib/__tests__/auth.test.ts`:

```ts
it('re-reads isApproved from the DB on the update trigger', async () => {
  const findOne = vi.fn().mockResolvedValue({ isAdmin: false, isApproved: true });
  mockGetMongoClient.mockResolvedValue({
    db: () => ({ collection: () => ({ findOne }) }),
  });
  // Token is already populated from sign-in (isAdmin defined) and stale.
  const token = { email: 'user@example.com', isAdmin: false, isApproved: false } as JWT;

  const result = await callbacks.jwt!({
    token,
    trigger: 'update',
  } as Parameters<NonNullable<typeof callbacks.jwt>>[0]);

  expect(findOne).toHaveBeenCalledWith({ email: 'user@example.com' });
  expect(result.isApproved).toBe(true);
});

it('does not let the update payload override the DB (no self-approval)', async () => {
  const findOne = vi.fn().mockResolvedValue({ isAdmin: false, isApproved: false });
  mockGetMongoClient.mockResolvedValue({
    db: () => ({ collection: () => ({ findOne }) }),
  });
  const token = { email: 'attacker@example.com', isAdmin: false, isApproved: false } as JWT;

  const result = await callbacks.jwt!({
    token,
    trigger: 'update',
    session: { isApproved: true }, // attacker-supplied; must be ignored
  } as Parameters<NonNullable<typeof callbacks.jwt>>[0]);

  expect(result.isApproved).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify the first fails**

Run: `npx vitest run src/lib/__tests__/auth.test.ts -t "update trigger"`
Expected: FAIL — `re-reads isApproved from the DB on the update trigger` expects `true` but receives `false` (the guard skips the DB read). (The `no-self-approval` case already passes since the payload is never read — that's the regression guard.)

- [ ] **Step 3: Add `update` to the guard**

In `src/lib/auth.ts`, change the `jwt` callback guard (currently line 21):

```ts
      if (trigger === 'signIn' || trigger === 'signUp' || token.isAdmin === undefined) {
```

to:

```ts
      if (
        trigger === 'signIn' ||
        trigger === 'signUp' ||
        trigger === 'update' ||
        token.isAdmin === undefined
      ) {
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/auth.test.ts`
Expected: PASS (all jwt/session/redirect cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts
git commit -m "fix: refresh isApproved on jwt update trigger (#83)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Middleware approval gate

**Files:**

- Modify: `src/middleware.ts`
- Test: `src/__tests__/middleware.test.ts` (new)

Insert the gate **after** the existing exempt short-circuit and the `if (!token)` block, so `/api/auth/*` (sign-out) still works. Gate condition is `token.isApproved !== true && token.isAdmin !== true` (fail-closed; admins bypass approval, since `isAdmin`/`isApproved` are independent and an unapproved admin must still reach admin tooling). API paths get 403 JSON; page paths redirect to `/pending-approval`. Exempt: `/pending-approval`, `/api/user/approval-status`, `/api/avatar`.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/middleware.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JWT } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { middleware } from '../middleware';

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }));
const mockGetToken = vi.mocked(getToken);

const req = (path: string) => new NextRequest(new URL(`https://app.test${path}`));

describe('middleware approval gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 JSON for an unapproved token on an API route', async () => {
    mockGetToken.mockResolvedValue({ isApproved: false, isAdmin: false } as JWT);

    const res = await middleware(req('/api/meal-plans'));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('redirects an unapproved token to /pending-approval for a page route', async () => {
    mockGetToken.mockResolvedValue({ isApproved: false, isAdmin: false } as JWT);

    const res = await middleware(req('/recipes'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.test/pending-approval');
  });

  it('treats a token with no isApproved claim as unapproved (fail-closed)', async () => {
    mockGetToken.mockResolvedValue({ isAdmin: false } as JWT);

    const res = await middleware(req('/api/recipes'));

    expect(res.status).toBe(403);
  });

  it('lets an unapproved token reach exempt paths', async () => {
    mockGetToken.mockResolvedValue({ isApproved: false } as JWT);

    for (const path of ['/pending-approval', '/api/user/approval-status', '/api/avatar']) {
      const res = await middleware(req(path));
      expect(res.headers.get('x-middleware-next')).toBe('1'); // NextResponse.next()
    }
  });

  it('lets an unapproved token reach /api/auth/* (sign-out must work)', async () => {
    mockGetToken.mockResolvedValue({ isApproved: false } as JWT);

    const res = await middleware(req('/api/auth/signout'));

    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('passes an approved token through', async () => {
    mockGetToken.mockResolvedValue({ isApproved: true } as JWT);

    const res = await middleware(req('/api/meal-plans'));

    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('passes an unapproved ADMIN token through (admins bypass approval)', async () => {
    mockGetToken.mockResolvedValue({ isApproved: false, isAdmin: true } as JWT);

    const res = await middleware(req('/api/admin/users'));

    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('redirects to / when there is no token (existing behavior)', async () => {
    mockGetToken.mockResolvedValue(null);

    const res = await middleware(req('/recipes'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.test/?callbackUrl=%2Frecipes');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/middleware.test.ts`
Expected: FAIL — the unapproved cases return `x-middleware-next` (current middleware lets any authenticated token through) instead of 403/redirect. **On this first run, confirm the `x-middleware-next === '1'` passthrough assertion actually holds for `NextResponse.next()` in this Next version** (it couldn't be verified before `node_modules` existed). If the header isn't present, switch the passthrough assertions to `expect(res.status).toBe(200)` plus `expect(res.headers.get('location')).toBeNull()`.

- [ ] **Step 3: Implement the gate**

In `src/middleware.ts`, add the import:

```ts
import { AUTH_ERRORS } from '@/lib/errors';
```

Then insert this block **between** the existing `if (!token) { ... }` block and the final `return NextResponse.next();`:

```ts
// Approval gate: a signed-in but unapproved user may only reach the
// pending-approval screen and the endpoints that keep it functional.
// (/api/auth/* is already allowed by the exempt short-circuit above, so
// sign-out keeps working.)
const isApprovalExempt =
  pathname === '/pending-approval' ||
  pathname === '/api/user/approval-status' ||
  pathname === '/api/avatar';

// Admins bypass approval (isAdmin and isApproved are independent flags; an
// unapproved admin must still reach /user-management to approve users).
if (token.isApproved !== true && token.isAdmin !== true && !isApprovalExempt) {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: AUTH_ERRORS.FORBIDDEN }, { status: 403 });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/pending-approval';
  url.search = '';
  return NextResponse.redirect(url);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/middleware.test.ts`
Expected: PASS (9 passing).

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/__tests__/middleware.test.ts
git commit -m "feat: enforce approval in middleware (#83)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Test the existing `useApprovalStatus` hook

**Files:**

- Test: `src/lib/__tests__/use-approval-status.test.tsx` (new)

The hook (`src/lib/use-approval-status.ts`) already polls `/api/user/approval-status`, calls `update()`, and redirects — but is untested. No implementation change; this locks in the approve and demote transitions. The hook wraps `update()` + `router.push()` in `setTimeout(..., 100)`; the test uses real timers + `waitFor` (the 100ms fires well within the 1000ms default), avoiding fake-timer/promise interleaving flake.

- [ ] **Step 1: Write the tests**

Create `src/lib/__tests__/use-approval-status.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useApprovalStatus } from '../use-approval-status';

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockPush = vi.fn();

const sessionValue = (user: Record<string, unknown>) =>
  ({ data: { user }, update: mockUpdate }) as unknown as ReturnType<typeof useSession>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
  } as unknown as ReturnType<typeof useRouter>);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// NOTE: stubbing global.fetch is safe here despite the CLAUDE.md MSW gotcha —
// /api/user/approval-status has no MSW handler (MSW is onUnhandledRequest:'bypass')
// and afterEach unstubs. Do NOT copy this onto a test that relies on MSW handlers.
describe('useApprovalStatus', () => {
  it('refreshes the token and redirects to /meal-plans when newly approved', async () => {
    vi.mocked(useSession).mockReturnValue(
      sessionValue({ email: 'u@x.com', isApproved: false, isAdmin: false })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isApproved: true, isAdmin: false }),
      })
    );

    renderHook(() => useApprovalStatus());

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ isApproved: true }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/meal-plans'));
  });

  it('refreshes and redirects to /pending-approval when approval is revoked', async () => {
    vi.mocked(useSession).mockReturnValue(
      sessionValue({ email: 'u@x.com', isApproved: true, isAdmin: false })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isApproved: false, isAdmin: false }),
      })
    );

    renderHook(() => useApprovalStatus());

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ isApproved: false }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/pending-approval'));
  });
});
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/use-approval-status.test.tsx`
Expected: PASS (2 passing). If either flakes, wrap the assertions in a single `waitFor` rather than reducing timeouts.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/use-approval-status.test.tsx
git commit -m "test: cover useApprovalStatus approve/demote transitions (#83)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Migrate route handlers to `requireApprovedSession()`

**Files (37 handlers + their colocated tests):** see the grouped list below.

This task repeats one mechanical transformation across all user-data routes. Do it **one group at a time** (one commit per group) so each is reviewable and the suite stays green. Within each group: edit the test first (success mocks → fixture, add an unapproved→403 case), watch the new 403 case fail, edit the handler, watch it pass, commit.

**Explicitly NOT migrated** (do not touch in this task — verify the 42 `getServerSession` routes = these 37 + 5): the 4 admin routes `api/admin/users/route.ts`, `api/admin/users/approve/route.ts`, `api/admin/users/toggle-admin/route.ts`, `api/admin/users/pending/route.ts` (they gate on `isAdmin`, which the approval helper does not check — swapping in the helper would _weaken_ them); and `api/user/approval-status/route.ts` (must stay reachable for unapproved users — it drives the refresh poll and is middleware-exempt). `api/avatar` and `api/auth/*` have no helper-style auth block at all.

### The transformation (applies to every handler in every group)

**Handler — before** (the exact block appears once per exported `GET`/`POST`/`PUT`/`PATCH`/`DELETE`):

```ts
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
}
```

**Handler — after:**

```ts
const { session, error } = await requireApprovedSession();
if (error) return error;
```

Then:

- Add `import { requireApprovedSession } from '@/lib/user-utils';`.
- Remove now-unused imports: `getServerSession` from `next-auth/next` and `authOptions` from `@/lib/auth` — **only if** no other code in the file still references them. (`AUTH_ERRORS` usually stays; other handlers in the file use it.)
- Everything downstream that reads `session.user.id` / `session.user.email` is unchanged.
- **Email-gated variant** (`src/app/api/user/settings/route.ts` only): its blocks read `const session = await getServerSession();` (note: **no `authOptions`**) then `if (!session?.user?.email)`. Replace with the same `requireApprovedSession()` two-liner; downstream `session.user.email` still works (the helper guarantees a full session). **This is a deliberate behavioral tightening, not a no-op:** settings now requires approval (or admin) and is standardized onto `getServerSession(authOptions)`. Its tests seed `{ user: { email: 'x@example.com' } }` with **no `id`/`isApproved`** (route.test.ts:46,63,72); because the helper requires `session.user.id`, these must become `approvedSession({ email: 'x@example.com' })` — the fixture supplies the default `id` and `isApproved: true`. Do **not** preserve the email-only literal, or every settings success test will 401.

**Test — before** (per success case, the literal shape varies per file — usually uniform within a file):

```ts
(getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });
```

**Test — after** (import the fixture, keep the same id/email the file already used):

```ts
import { approvedSession, unapprovedSession } from '@/test-utils/session';
// ...
(getServerSession as any).mockResolvedValueOnce(approvedSession({ id: 'u1' }));
```

Within a file the session literal is typically identical, so a scoped replace-all of that literal → `approvedSession({ <same fields> })` is safe. Preserve each file's own id/email values (`'user-1'`, `SELF_ID`, `'user@test.com'`, etc.). The existing 401 test (`mockResolvedValueOnce(null)`) is left as-is — the helper still returns 401 for no session.

**Test — add one unapproved→403 case per file.** Place it next to the existing 401 test, calling the handler the same way the neighboring tests do (same params for `[id]` routes). Template (adjust handler import, call signature, and any required params to match the file):

```ts
it('returns 403 when the user is not approved', async () => {
  (getServerSession as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));

  const res = await GET(/* same args the sibling GET test passes */);

  expect(res.status).toBe(403);
});
```

**Files that already set `isApproved`** (reconcile, do not blind-overwrite): grep each test file for `isApproved` before editing; if a case already provides it, convert it to the fixture preserving its intent rather than dropping a duplicate.

### Per-group steps (repeat for each group)

- [ ] **Step A: Edit the group's test files** — swap success session literals to `approvedSession({...})`, add the unapproved→403 case to each.
- [ ] **Step B: Run the group's tests** — `npx vitest run <group test paths>`. Expected: the new 403 cases FAIL; success cases PASS.
- [ ] **Step C: Edit the group's handlers** — apply the handler transformation to every exported method.
- [ ] **Step D: Run the group's tests** — Expected: PASS.
- [ ] **Step E: Commit** — e.g. `git commit -m "feat: enforce approval on <group> routes (#83)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`.

### Groups

- [ ] **Group 1 — meal-plans** (worked example below): `meal-plans/route.ts`, `meal-plans/[id]/route.ts`, `meal-plans/summary/route.ts`, `meal-plans/template/route.ts` + their tests.
- [ ] **Group 2 — recipes:** `recipes/route.ts`, `recipes/[id]/route.ts`, `recipes/[id]/rating/route.ts`, `recipes/[id]/tags/route.ts`, `recipes/[id]/user-data/route.ts`, `recipes/tags/route.ts`, `recipes/user-data/batch/route.ts` + their tests.
- [ ] **Group 3 — food-items + pantry:** `food-items/route.ts`, `food-items/[id]/route.ts`, `pantry/route.ts`, `pantry/[id]/route.ts` + their tests.
- [ ] **Group 4 — stores:** `stores/route.ts`, `stores/[id]/route.ts`, `stores/[id]/invite/route.ts`, `stores/[id]/invitations/[userId]/route.ts`, `stores/invitations/route.ts` + their tests.
- [ ] **Group 5 — shopping-lists:** `shopping-lists/[storeId]/route.ts`, `shopping-lists/[storeId]/finish-shop/route.ts`, `shopping-lists/[storeId]/history/route.ts`, `shopping-lists/[storeId]/items/[foodItemId]/toggle/route.ts`, `shopping-lists/[storeId]/positions/route.ts` + their tests.
- [ ] **Group 6 — meal-plan-sharing:** `user/meal-plan-sharing/invite/route.ts`, `user/meal-plan-sharing/invitations/route.ts`, `user/meal-plan-sharing/invitations/[userId]/route.ts`, `user/meal-plan-sharing/owners/route.ts`, `user/meal-plan-sharing/shared-users/route.ts` + their tests.
- [ ] **Group 7 — recipe-sharing:** `user/recipe-sharing/invite/route.ts`, `user/recipe-sharing/invitations/route.ts`, `user/recipe-sharing/invitations/[userId]/route.ts`, `user/recipe-sharing/owners/route.ts`, `user/recipe-sharing/shared-users/route.ts` + their tests.
- [ ] **Group 8 — misc:** `ably/token/route.ts`, `user/settings/route.ts` (email-gated variant) + their tests.

### Worked example — Group 1, `meal-plans/route.ts` + its test

`src/app/api/meal-plans/__tests__/route.test.ts` sets the session with `(getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1' } });` (lines 133, 157, 195, 228, 259, …) and has a 401 test at line 127 (`mockResolvedValueOnce(null)`).

- [ ] **Step 1: Edit the test** — add the fixture import, replace every `{ user: { id: 'u1' } }` with `approvedSession({ id: 'u1' })`, and add the 403 case after the 401 test:

```ts
import { approvedSession, unapprovedSession } from '@/test-utils/session';
```

```ts
it('returns 403 when the user is not approved (GET)', async () => {
  (getServerSession as any).mockResolvedValueOnce(unapprovedSession({ id: 'u1' }));

  const res = await routes.GET(makeReq('http://localhost/api/meal-plans'));

  expect(res.status).toBe(403);
});
```

(This file imports handlers as `const routes = await import('../route')` and builds requests with the local `makeReq` helper — `route.test.ts:111,113` — so call `routes.GET(makeReq(...))`, matching the sibling GET tests. Other route-test files may import handlers differently; always mirror the file's existing call style.)

- [ ] **Step 2: Run** — `npx vitest run src/app/api/meal-plans/__tests__/route.test.ts`. Expected: the 403 case FAILS (handler not yet gated); other cases PASS.

- [ ] **Step 3: Edit `meal-plans/route.ts`** — add `import { requireApprovedSession } from '@/lib/user-utils';`; in **both** `GET` (line 22-25) and `POST` (line 193-196) replace:

```ts
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
}
```

with:

```ts
const { session, error } = await requireApprovedSession();
if (error) return error;
```

Remove the now-unused `getServerSession`/`authOptions` imports if nothing else in the file uses them.

- [ ] **Step 4: Run** — `npx vitest run src/app/api/meal-plans/__tests__/route.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** the meal-plans group (all 4 handlers + tests):

```bash
git add src/app/api/meal-plans
git commit -m "feat: enforce approval on meal-plans routes (#83)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

Apply Steps A–E identically to Groups 2–8.

---

## Task 7: Full validation + manual verification

**Files:** none (validation only).

- [ ] **Step 1: Run the full check once**

Run: `npm run check`
Expected: lint clean, all tests pass (including the new middleware, helper, auth, hook, and per-route 403 cases), build succeeds. If it fails with `MODULE_NOT_FOUND`, run `npm run clean` then retry.

- [ ] **Step 2: Manual smoke test (authenticated, via Claude in Chrome)**

Per CLAUDE.md, authenticated pages require the Chrome extension (Preview can't do Google OAuth). Verify, signed in as an **unapproved** user (set `isApproved: false` on a test user in the DB, or use a seeded pending user):

- Navigating to `/recipes` redirects to `/pending-approval` (no loop).
- `GET /api/meal-plans` returns `403 {"error":"Forbidden"}`.
- The pending-approval screen renders fully (avatar loads — `/api/avatar` is exempt).
- Approve the user in `/user-management` (as admin) → within ~60s the pending screen refreshes the token and redirects to `/meal-plans`; data routes now succeed.
- Sign-out from the pending screen works (`/api/auth/*` exempt).

- [ ] **Step 3: Final commit (if Step 1 produced any lint/format fixups)**

```bash
git add -A
git commit -m "chore: final validation fixups for approval enforcement (#83)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** Task 4 = §1 middleware gate (incl. `/api/avatar` exempt); Task 1 + Task 6 = §2 helper + uniform application across the 37 routes; Task 3 = §3 auth.ts fix; Tasks 1/3/4/5/6 = §4 test list (helper, jwt update, hook, middleware harness, 34-file fixture migration + unapproved→403 lock-in). No schema/migration/env change (matches Rollout).
- **Order rationale:** helper + fixture + auth fix + middleware + hook test land first (no route depends on them breaking); the route migration comes last and is grouped so the suite stays green per commit.
- **No self-approval:** Task 3's second test is the security guard — the `jwt` callback re-reads from the DB and never trusts the `update()` payload.
