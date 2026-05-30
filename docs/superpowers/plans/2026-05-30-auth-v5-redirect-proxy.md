# Auth.js v5 Migration + Redirect Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `next-auth` v4 → Auth.js v5 and adopt the v5 redirect proxy so Google login works on every Vercel preview deploy via one registered callback URL.

**Architecture:** Split config — an edge-safe `src/lib/auth.config.ts` (providers, session/redirect callbacks, `trustHost`, `redirectProxyUrl`) shared by both `src/lib/auth.ts` (adds the MongoDB adapter + DB-backed `jwt` callback, exports `handlers`/`auth`/`signIn`/`signOut`) and `src/middleware.ts` (uses the `auth` wrapper, reads `req.auth`). The `redirect` callback enforces a preview-origin allowlist as defense-in-depth beyond the signed OAuth `state`.

**Tech Stack:** Next.js 15 (App Router), Auth.js v5 (`next-auth@beta`), `@auth/mongodb-adapter` v3, Vitest, Vercel.

**Spec:** `docs/superpowers/specs/2026-05-30-auth-v5-redirect-proxy-design.md`

---

## Execution notes (read before starting)

- **This is a framework major-version swap, not an incremental feature.** Once Task 1 installs Auth.js v5, `next-auth/next` stops exporting `getServerSession` and `AuthOptions` is gone, so the project will NOT type-check or pass tests until the full source + test set (Tasks 1–13) lands. The `typecheck-on-edit` / `lint-on-edit` PostToolUse hooks will report transient errors on intermediate edits — this is expected. Push through the cohesive set; the green gate is `npm run check` in Task 17.
- Commit per task for reviewability even while the suite is red. The commit messages say what changed, not "tests pass."
- Work happens in the existing worktree on branch `feat/142-auth-v5-upgrade`. Do not create a new branch.
- Infra tasks (18–20) mutate production Vercel config and require an explicit user go-ahead — do not run them unprompted.

---

## File Structure

**Create:**

- `src/lib/auth.config.ts` — edge-safe shared config: providers, `session.strategy`, `trustHost`, `redirectProxyUrl`, `session` callback, `redirect` callback (preview-origin allowlist). No adapter, no DB import.

**Modify (source):**

- `src/lib/auth.ts` — becomes the full Node-runtime config; exports `handlers`/`auth`/`signIn`/`signOut`.
- `src/app/api/auth/[...nextauth]/route.ts` — re-export `handlers` as `GET`/`POST`.
- `src/middleware.ts` — `auth` wrapper, named export, reads `req.auth`.
- `src/lib/user-utils.ts` — `getServerSession(authOptions)` → `await auth()` (2 sites).
- `src/app/api/admin/users/route.ts`, `.../approve/route.ts`, `.../toggle-admin/route.ts`, `.../pending/route.ts`, `src/app/api/user/approval-status/route.ts` — same swap.
- `src/components/SignInButton.tsx` — `signIn` option `callbackUrl` → `redirectTo`.
- `src/components/Header.tsx`, `src/components/BottomNav.tsx`, `src/app/pending-approval/page.tsx` — `signOut` option `callbackUrl` → `redirectTo`.
- `src/types/next-auth.d.ts` — verify augmentation still compiles (likely no change).

**Modify (tests):**

- `src/lib/__tests__/auth.test.ts` — re-home to split config + add allowlist cases + config-wiring assertion.
- ~40 route tests under `src/app/api/**/__tests__/route.test.ts` — swap session mock.
- `src/lib/__tests__/user-utils.test.ts` — swap session mock.
- `src/__tests__/middleware.test.ts` — rework for the `auth` wrapper.
- `src/components/__tests__/BottomNav.test.tsx` — `callbackUrl` → `redirectTo` assertion + mock type.
- `test/manual/__tests__/setup-worktree.test.ts` — drop `NEXTAUTH_URL` expectations.

**Modify (scripts/docs):**

- `scripts/setup-worktree.js` — `rewriteWorktreeEnv` drops the `NEXTAUTH_URL` rewrite.
- `scripts/setup-ubuntu.sh` — env var doc rename.
- `docs/architecture.md`, `CLAUDE.md` — auth section updates.
- `package.json` — `next-auth` version bump (via npm).

**No change (verified):** `scripts/check-env.cjs` (generically redacts any `KEY=value`; no hardcoded var names).

---

## Phase A — Source migration

### Task 1: Install Auth.js v5

**Files:**

- Modify: `package.json` (+ `package-lock.json`, via npm)

- [ ] **Step 1: Install the v5 package**

Run:

```bash
npm install next-auth@beta
```

`@auth/mongodb-adapter@^3.9.1` is already installed and v5-compatible — do not touch it.

- [ ] **Step 2: Verify the installed major version is 5.x**

Run:

```bash
npm ls next-auth
```

Expected: `next-auth@5.0.0-beta.x` (some 5.x beta). If it resolved to 4.x, the install failed.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): install Auth.js v5 (next-auth@beta) (#142)"
```

---

### Task 2: Create the edge-safe split config

**Files:**

- Create: `src/lib/auth.config.ts`

- [ ] **Step 1: Write `src/lib/auth.config.ts`**

```ts
import type { NextAuthConfig } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import type { Session } from 'next-auth';
import Google from 'next-auth/providers/google';

// Preview-origin allowlist (defense-in-depth beyond the signed OAuth state).
// Match on the EXTRACTED origin, never the raw url — see the redirect callback.
const PROD_ORIGIN = 'https://weekly-eats.vercel.app';
const PREVIEW_ORIGIN = /^https:\/\/weekly-eats-[a-z0-9-]+-zach-roses-projects\.vercel\.app$/;

function isAllowedOrigin(origin: string, baseUrl: string): boolean {
  return origin === baseUrl || origin === PROD_ORIGIN || PREVIEW_ORIGIN.test(origin);
}

// Edge-safe config shared by auth.ts (full, Node runtime) and middleware.ts.
// No adapter, no MongoDB import — this module is bundled for the Edge runtime.
const authConfig = {
  providers: [Google], // auto-infers AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
  trustHost: true,
  redirectProxyUrl: process.env.AUTH_REDIRECT_PROXY_URL,
  session: { strategy: 'jwt' },
  callbacks: {
    session({ session, token }: { session: Session; token: JWT }) {
      // Forward cached token claims to the session — no DB query.
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      session.user.isAdmin = token.isAdmin === true;
      session.user.isApproved = token.isApproved === true;
      return session;
    },
    redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      const origin = new URL(url).origin;
      if (isAllowedOrigin(origin, baseUrl)) return url;
      return baseUrl;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
```

- [ ] **Step 2: Verify the file type-checks in isolation**

Run:

```bash
npx tsc --noEmit src/lib/auth.config.ts 2>&1 | head -20
```

Expected: no errors originating from `auth.config.ts` itself. (Project-wide `tsc` will still fail because `auth.ts` and consumers are not migrated yet — that is expected per the execution notes; you are only checking this file is internally sound.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.config.ts
git commit -m "feat(auth): add edge-safe auth.config with preview-origin allowlist (#142)"
```

---

### Task 2b: TDD the redirect allowlist (new security-critical logic)

This is the one genuinely new behavior; cover it red-green before moving on. The tests live in `auth.test.ts`, which is otherwise re-homed in Task 9 — here we add only the redirect block against `auth.config.ts` so the new logic is locked in early.

**Files:**

- Create (temporary test): `src/lib/__tests__/auth.config.test.ts`

- [ ] **Step 1: Write the failing allowlist tests**

```ts
import { describe, it, expect } from 'vitest';
import authConfig from '../auth.config';

const redirect = authConfig.callbacks.redirect;
const baseUrl = 'https://app.example.com';
const PREVIEW = 'https://weekly-eats-feat-x-zach-roses-projects.vercel.app';

describe('redirect callback — base branches', () => {
  it('resolves a relative path against baseUrl', () => {
    expect(redirect({ url: '/dashboard', baseUrl })).toBe(`${baseUrl}/dashboard`);
  });
  it('returns a same-origin absolute URL unchanged', () => {
    const url = `${baseUrl}/recipes`;
    expect(redirect({ url, baseUrl })).toBe(url);
  });
  it('falls back to baseUrl for a foreign origin', () => {
    expect(redirect({ url: 'https://evil.com', baseUrl })).toBe(baseUrl);
  });
});

describe('redirect callback — preview-origin allowlist', () => {
  it('accepts a valid preview origin (no path)', () => {
    expect(redirect({ url: PREVIEW, baseUrl })).toBe(PREVIEW);
  });
  it('accepts a valid preview origin carrying a path', () => {
    const url = `${PREVIEW}/meal-plans`;
    expect(redirect({ url, baseUrl })).toBe(url);
  });
  it('accepts the production origin', () => {
    const url = 'https://weekly-eats.vercel.app/recipes';
    expect(redirect({ url, baseUrl })).toBe(url);
  });
  it('rejects a foreign origin (→ baseUrl)', () => {
    expect(redirect({ url: 'https://attacker.example/x', baseUrl })).toBe(baseUrl);
  });
  it('rejects a suffix-attack lookalike host (→ baseUrl)', () => {
    const url = 'https://weekly-eats-x-zach-roses-projects.vercel.app.evil.com/cb';
    expect(redirect({ url, baseUrl })).toBe(baseUrl);
  });
});
```

- [ ] **Step 2: Run the tests — expect PASS (logic written in Task 2)**

Run:

```bash
MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/auth.config.test.ts
```

Expected: all 8 pass. (The allowlist was implemented in Task 2; this task proves it. If any _reject_ case returns the url instead of baseUrl, the anchors/char-class are wrong — fix `PREVIEW_ORIGIN` in `auth.config.ts` before continuing.)

- [ ] **Step 3: Fold these cases into auth.test.ts later, remove the temp file**

These exact cases move into the re-homed `auth.test.ts` in Task 9. For now keep `auth.config.test.ts` as the guard. Task 9 deletes it after copying the cases over.

- [ ] **Step 4: Commit**

```bash
git add src/lib/__tests__/auth.config.test.ts
git commit -m "test(auth): cover redirect preview-origin allowlist (#142)"
```

---

### Task 3: Rewrite `auth.ts` as the full config

**Files:**

- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Replace the entire file contents**

```ts
import type { JWT } from 'next-auth/jwt';
import NextAuth from 'next-auth';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import authConfig from './auth.config';
import clientPromise from './mongodb-adapter';
import { getMongoClient } from './mongodb';
import { logError } from './errors';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise),
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, trigger }: { token: JWT; trigger?: 'signIn' | 'signUp' | 'update' }) {
      // On sign-in/up/update (or first hydration), fetch user status from the DB
      // and cache it in the token. Runs only in the Node-runtime route handler.
      if (
        trigger === 'signIn' ||
        trigger === 'signUp' ||
        trigger === 'update' ||
        token.isAdmin === undefined
      ) {
        if (token.email) {
          try {
            const client = await getMongoClient();
            const db = client.db();
            const user = await db.collection('users').findOne({ email: token.email });
            token.isAdmin = user?.isAdmin === true;
            token.isApproved = user?.isApproved === true;
          } catch (error) {
            logError('AuthJWT', error);
            token.isAdmin = false;
            token.isApproved = false;
          }
        }
      }
      return token;
    },
  },
});
```

- [ ] **Step 2: Commit** (project-wide typecheck still red — expected)

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): split auth.ts into full v5 config exporting handlers/auth (#142)"
```

---

### Task 4: Update the NextAuth route handler

**Files:**

- Modify: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Replace the entire file contents**

```ts
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/auth/[...nextauth]/route.ts"
git commit -m "feat(auth): use v5 handlers in the nextauth route (#142)"
```

---

### Task 5: Rewrite the middleware with the `auth` wrapper

**Files:**

- Modify: `src/middleware.ts`

- [ ] **Step 1: Replace the entire file contents**

The gate logic is unchanged; only the token source (`req.auth.user.*`) and the export shape change. Note `req.auth` is the Session object (the `session` callback in `auth.config.ts` populates `.user`).

```ts
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from '@/lib/auth.config';
import { AUTH_ERRORS } from '@/lib/errors';

const { auth } = NextAuth(authConfig);

export const middleware = auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow: home/login, auth API, Next internals, static/public assets.
  if (
    pathname === '/' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname === '/manifest.json' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Not authenticated → redirect to home (login), preserving the destination.
  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    if (pathname !== '/') {
      url.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(url);
  }

  // Approval gate. /api/auth/* is already exempt above (keeps sign-out working).
  const isApprovalExempt =
    pathname === '/pending-approval' ||
    pathname === '/api/user/approval-status' ||
    pathname === '/api/avatar';

  // Admins bypass approval (isAdmin and isApproved are independent flags).
  // Fail-closed: anything other than `true` is treated as not-approved.
  if (req.auth.user?.isApproved !== true && req.auth.user?.isAdmin !== true && !isApprovalExempt) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: AUTH_ERRORS.FORBIDDEN }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/pending-approval';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): rewrite middleware on the v5 auth wrapper (#142)"
```

---

### Task 6: Migrate the `user-utils.ts` chokepoint

**Files:**

- Modify: `src/lib/user-utils.ts:3-4` (imports), `:23`, `:50`

- [ ] **Step 1: Replace the two `next-auth` imports**

Replace lines 3–4:

```ts
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';
```

with:

```ts
import { auth } from './auth';
```

- [ ] **Step 2: Swap both call sites**

At `getCurrentUserAdminStatus` (line 23): `const session = await getServerSession(authOptions);` → `const session = await auth();`

At `requireApprovedSession` (line 50): `const session = await getServerSession(authOptions);` → `const session = await auth();`

(The `Session` type import on line 6 stays — `requireApprovedSession`'s return type still uses it.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/user-utils.ts
git commit -m "feat(auth): migrate user-utils chokepoint to v5 auth() (#142)"
```

---

### Task 7: Migrate the 5 direct-call routes

**Files:**

- Modify: `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/approve/route.ts`, `src/app/api/admin/users/toggle-admin/route.ts`, `src/app/api/admin/users/pending/route.ts`, `src/app/api/user/approval-status/route.ts`

Each file imports `getServerSession` from `next-auth/next` and `authOptions` from a relative `../../../../lib/auth` path, then calls `const session = await getServerSession(authOptions);`.

- [ ] **Step 1: In each of the 5 files, replace the two auth imports with a single `auth` import**

Remove the `import { getServerSession } from 'next-auth/next';` and `import { authOptions } from '<relative>/lib/auth';` lines. Add `import { auth } from '@/lib/auth';` (use the `@/lib/auth` alias — these route files already use `@/lib/errors`, so the alias is available and avoids relative-depth bugs).

- [ ] **Step 2: In each file, swap the call**

`const session = await getServerSession(authOptions);` → `const session = await auth();`

The downstream `session?.user?.email` / `session.user.isAdmin` usage is unchanged (same Session shape).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/users/route.ts src/app/api/admin/users/approve/route.ts src/app/api/admin/users/toggle-admin/route.ts src/app/api/admin/users/pending/route.ts src/app/api/user/approval-status/route.ts
git commit -m "feat(auth): migrate 5 direct getServerSession routes to auth() (#142)"
```

---

### Task 8: Update client sign-in / sign-out option key

**Files:**

- Modify: `src/components/SignInButton.tsx:16`, `src/components/Header.tsx:60`, `src/components/BottomNav.tsx:44`, `src/app/pending-approval/page.tsx:50`

The next-auth option key `callbackUrl` is renamed `redirectTo` in v5. **Do NOT rename** the app-owned `callbackUrl` _query param_ read at `SignInButton.tsx:9` — only the option object passed to `signIn`/`signOut`.

- [ ] **Step 1: SignInButton.tsx** — line 16: `signIn('google', { callbackUrl })` → `signIn('google', { redirectTo: callbackUrl })`. Leave line 9 (`searchParams.get('callbackUrl')`) untouched.

- [ ] **Step 2: Header.tsx** — line 60: `signOut({ callbackUrl: '/' })` → `signOut({ redirectTo: '/' })`.

- [ ] **Step 3: BottomNav.tsx** — line 44: `signOut({ callbackUrl: '/' })` → `signOut({ redirectTo: '/' })`.

- [ ] **Step 4: pending-approval/page.tsx** — line 50: `signOut({ callbackUrl: '/' })` → `signOut({ redirectTo: '/' })`.

- [ ] **Step 5: Verify type augmentation still compiles**

Open `src/types/next-auth.d.ts`. The `declare module 'next-auth'` (Session/User) and `declare module 'next-auth/jwt'` (JWT) blocks are unchanged in v5 — no edit expected. Confirm there are no references to removed v4-only types. (Full typecheck is deferred to Task 17.)

- [ ] **Step 6: Commit**

```bash
git add src/components/SignInButton.tsx src/components/Header.tsx src/components/BottomNav.tsx src/app/pending-approval/page.tsx
git commit -m "feat(auth): rename signIn/signOut callbackUrl option to redirectTo (#142)"
```

---

## Phase B — Tests

### Task 9: Re-home `auth.test.ts` to the split config

**Files:**

- Modify: `src/lib/__tests__/auth.test.ts`
- Delete: `src/lib/__tests__/auth.config.test.ts` (its cases move here)

The test currently does `const { authOptions } = await import('../auth')` and reads `authOptions.callbacks.*`. After the split, `authOptions` is gone: `session`/`redirect` live on `auth.config.ts`'s default export, and `jwt` must be read from the assembled `auth.ts`. The `jwt` callback is on the `NextAuth(...)` result — it is not separately exported, so test it by importing `auth.config`'s callbacks for session/redirect and keep the jwt-callback tests against a small reimport. Since `jwt` is defined inline in `auth.ts` and not exported, expose it for testing by reading it off `auth.config` is impossible — instead, **move the jwt callback test to assert via `auth.config` is wrong**. Use this approach: import `session`/`redirect` from `auth.config`; for `jwt`, keep the existing DB-mock tests but import the callback from a new named export.

- [ ] **Step 1: Add a named `jwt` export to `auth.ts` so it stays unit-testable**

In `src/lib/auth.ts`, lift the `jwt` callback to a named function and reference it in the config:

```ts
export async function jwtCallback({
  token,
  trigger,
}: {
  token: JWT;
  trigger?: 'signIn' | 'signUp' | 'update';
}) {
  if (
    trigger === 'signIn' ||
    trigger === 'signUp' ||
    trigger === 'update' ||
    token.isAdmin === undefined
  ) {
    if (token.email) {
      try {
        const client = await getMongoClient();
        const db = client.db();
        const user = await db.collection('users').findOne({ email: token.email });
        token.isAdmin = user?.isAdmin === true;
        token.isApproved = user?.isApproved === true;
      } catch (error) {
        logError('AuthJWT', error);
        token.isAdmin = false;
        token.isApproved = false;
      }
    }
  }
  return token;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise),
  callbacks: { ...authConfig.callbacks, jwt: jwtCallback },
});
```

- [ ] **Step 2: Rewrite `auth.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JWT } from 'next-auth/jwt';
import type { Session } from 'next-auth';

const mockGetMongoClient = vi.fn();

vi.mock('@/lib/mongodb', () => ({ getMongoClient: mockGetMongoClient }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));
// Avoid noisy error logging during the jwt error-path test
vi.mock('@/lib/errors', () => ({ logError: vi.fn() }));

const authConfig = (await import('../auth.config')).default;
const { jwtCallback } = await import('../auth');

const redirect = authConfig.callbacks.redirect;
const session = authConfig.callbacks.session;
const baseUrl = 'https://app.example.com';
const PREVIEW = 'https://weekly-eats-feat-x-zach-roses-projects.vercel.app';

describe('config wiring', () => {
  it('enables trustHost and wires the redirect proxy from env', () => {
    expect(authConfig.trustHost).toBe(true);
    expect('redirectProxyUrl' in authConfig).toBe(true);
  });
});

describe('redirect callback', () => {
  it('resolves a relative path against baseUrl', () => {
    expect(redirect({ url: '/dashboard', baseUrl })).toBe(`${baseUrl}/dashboard`);
  });
  it('returns a same-origin absolute URL unchanged', () => {
    const url = `${baseUrl}/recipes`;
    expect(redirect({ url, baseUrl })).toBe(url);
  });
  it('falls back to baseUrl for a foreign origin', () => {
    expect(redirect({ url: 'https://evil.com', baseUrl })).toBe(baseUrl);
  });
  it('accepts a valid preview origin (no path)', () => {
    expect(redirect({ url: PREVIEW, baseUrl })).toBe(PREVIEW);
  });
  it('accepts a valid preview origin carrying a path', () => {
    const url = `${PREVIEW}/meal-plans`;
    expect(redirect({ url, baseUrl })).toBe(url);
  });
  it('accepts the production origin', () => {
    const url = 'https://weekly-eats.vercel.app/recipes';
    expect(redirect({ url, baseUrl })).toBe(url);
  });
  it('rejects a suffix-attack lookalike host (→ baseUrl)', () => {
    const url = 'https://weekly-eats-x-zach-roses-projects.vercel.app.evil.com/cb';
    expect(redirect({ url, baseUrl })).toBe(baseUrl);
  });
});

describe('session callback', () => {
  it('maps token fields onto session.user', () => {
    const token = { isAdmin: true, isApproved: false, sub: 'u1' } as JWT;
    const result = session({ session: { user: {} } as Session, token }) as Session;
    expect(result.user.id).toBe('u1');
    expect(result.user.isAdmin).toBe(true);
    expect(result.user.isApproved).toBe(false);
  });
});

describe('jwt callback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('defaults admin/approved to false when the DB lookup fails', async () => {
    mockGetMongoClient.mockRejectedValue(new Error('DB down'));
    const result = await jwtCallback({
      token: { email: 'user@example.com' } as JWT,
      trigger: 'signIn',
    });
    expect(result.isAdmin).toBe(false);
    expect(result.isApproved).toBe(false);
  });

  it('caches isAdmin/isApproved from the DB user on signIn', async () => {
    const findOne = vi.fn().mockResolvedValue({ isAdmin: true, isApproved: true });
    mockGetMongoClient.mockResolvedValue({ db: () => ({ collection: () => ({ findOne }) }) });
    const result = await jwtCallback({
      token: { email: 'admin@example.com' } as JWT,
      trigger: 'signIn',
    });
    expect(findOne).toHaveBeenCalledWith({ email: 'admin@example.com' });
    expect(result.isAdmin).toBe(true);
    expect(result.isApproved).toBe(true);
  });

  it('coerces missing DB user fields to false (no implicit admin/approval)', async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    mockGetMongoClient.mockResolvedValue({ db: () => ({ collection: () => ({ findOne }) }) });
    const result = await jwtCallback({
      token: { email: 'ghost@example.com' } as JWT,
      trigger: 'signIn',
    });
    expect(result.isAdmin).toBe(false);
    expect(result.isApproved).toBe(false);
  });

  it('re-reads isApproved from the DB on the update trigger', async () => {
    const findOne = vi.fn().mockResolvedValue({ isAdmin: false, isApproved: true });
    mockGetMongoClient.mockResolvedValue({ db: () => ({ collection: () => ({ findOne }) }) });
    const token = { email: 'user@example.com', isAdmin: false, isApproved: false } as JWT;
    const result = await jwtCallback({ token, trigger: 'update' });
    expect(findOne).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(result.isApproved).toBe(true);
  });
});
```

(The v4 "update payload override" test asserted on a `session` arg that the inline callback ignored; `jwtCallback`'s signature omits it, so that case is dropped — behavior is unchanged since the callback never read it.)

- [ ] **Step 3: Delete the temporary guard test**

Run:

```bash
git rm src/lib/__tests__/auth.config.test.ts
```

- [ ] **Step 4: Run the re-homed test**

Run:

```bash
MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/auth.test.ts
```

Expected: PASS (config wiring + redirect + session + jwt groups).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts
git commit -m "test(auth): re-home auth callback tests to split config + allowlist (#142)"
```

---

### Task 10: Swap the ~40 route-test session mocks

**Files:**

- Modify: every `src/app/api/**/__tests__/route.test.ts` that mocks `next-auth/next` (40 files).

All 40 share one pattern. The canonical form (e.g. `src/app/api/recipes/__tests__/route.test.ts:4,65`):

```ts
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));
// ...later:
const { getServerSession } = await import('next-auth/next');
// ...in tests:
(getServerSession as any).mockResolvedValueOnce(approvedSession());
```

- [ ] **Step 1: Find every affected file**

Run:

```bash
grep -rl "next-auth/next" src/app --include="route.test.ts"
```

Expected: 40 paths. Apply Steps 2–4 to each.

- [ ] **Step 2: Replace the mock declarations**

Replace:

```ts
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
```

with:

```ts
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
```

**Keep** the `vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }))` line — importing `@/lib/auth` still loads the adapter at module init.

- [ ] **Step 3: Replace the mock-handle acquisition**

Replace `const { getServerSession } = await import('next-auth/next');` with `const { auth } = await import('@/lib/auth');`.

- [ ] **Step 4: Replace every mock-set call**

`(getServerSession as any).mockResolvedValueOnce(...)` → `(auth as any).mockResolvedValueOnce(...)`, and `(getServerSession as any).mockReset()` → `(auth as any).mockReset()`. (Some files use `.mockResolvedValue`; rename the handle the same way regardless of method.) Per-file variation: a few tests import the handle at the top rather than via `await import` — in those, rename the import source `next-auth/next` → `@/lib/auth` and the symbol `getServerSession` → `auth`.

- [ ] **Step 5: Run the full route-test suite**

Run:

```bash
MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/app/api
```

Expected: all route tests PASS. Investigate any file individually if it fails (`npx vitest run <path>`).

- [ ] **Step 6: Commit**

```bash
git add src/app/api
git commit -m "test(auth): swap route-test session mocks to v5 auth() (#142)"
```

---

### Task 11: Swap `user-utils.test.ts`

**Files:**

- Modify: `src/lib/__tests__/user-utils.test.ts:2-3,17-21` (and every mock-set call)

- [ ] **Step 1: Replace the mock declarations + import**

Remove the top import `import { getServerSession } from 'next-auth/next';`. Replace:

```ts
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
const mockGetServerSession = vi.mocked(getServerSession);
```

with:

```ts
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
const { auth } = await import('@/lib/auth');
const mockAuth = vi.mocked(auth);
```

Keep the existing `vi.mock('../mongodb', ...)` block.

- [ ] **Step 2: Rename every usage**

`mockGetServerSession.mockResolvedValue(...)` / `.mockReset()` / `.mockResolvedValueOnce(...)` → `mockAuth.…`.

- [ ] **Step 3: Run the test**

Run:

```bash
MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/user-utils.test.ts
```

Expected: PASS (getUserObjectId, getCurrentUserAdminStatus, requireApprovedSession 401/403/admin-bypass/fail-closed).

- [ ] **Step 4: Commit**

```bash
git add src/lib/__tests__/user-utils.test.ts
git commit -m "test(auth): swap user-utils.test session mock to v5 auth() (#142)"
```

---

### Task 12: Rework `middleware.test.ts`

**Files:**

- Modify: `src/__tests__/middleware.test.ts`

The middleware is now `export const middleware = auth((req) => …)`. Mock `next-auth` so `NextAuth(authConfig)` returns a pass-through `auth` (the wrapper just returns the handler), then drive the handler by attaching a synthetic `auth` (the Session, or `null`) onto a real `NextRequest`.

- [ ] **Step 1: Replace the entire test file**

```ts
// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Session } from 'next-auth';

// The auth wrapper becomes a pass-through: middleware === the handler we wrote.
vi.mock('next-auth', () => ({
  default: () => ({ auth: (handler: unknown) => handler }),
}));
vi.mock('@/lib/auth.config', () => ({ default: {} }));

const { middleware } = await import('../middleware');

// Build a request with a synthetic req.auth (Session | null), as the real
// wrapper would inject. `auth` is attached the way the wrapper extends the request.
function req(path: string, auth: Session | null) {
  const r = new NextRequest(new URL(`https://app.test${path}`));
  return Object.assign(r, { auth });
}

const approved = (over: Partial<Session['user']> = {}): Session =>
  ({
    user: { id: 'u1', isAdmin: false, isApproved: true, ...over },
    expires: '2099-01-01',
  }) as Session;
const unapproved = (over: Partial<Session['user']> = {}): Session =>
  approved({ isApproved: false, ...over });

describe('middleware approval gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 JSON for an unapproved session on an API route', async () => {
    const res = await middleware(req('/api/meal-plans', unapproved()));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('redirects an unapproved session to /pending-approval for a page route', async () => {
    const res = await middleware(req('/recipes', unapproved()));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.test/pending-approval');
  });

  it('treats a session with no isApproved claim as unapproved (fail-closed)', async () => {
    const res = await middleware(req('/api/recipes', approved({ isApproved: undefined })));
    expect(res.status).toBe(403);
  });

  it('lets an unapproved session reach exempt paths', async () => {
    for (const path of ['/pending-approval', '/api/user/approval-status', '/api/avatar']) {
      const res = await middleware(req(path, unapproved()));
      expect(res.headers.get('x-middleware-next')).toBe('1');
    }
  });

  it('lets an unapproved session reach /api/auth/* (sign-out must work)', async () => {
    const res = await middleware(req('/api/auth/signout', unapproved()));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('passes an approved session through', async () => {
    const res = await middleware(req('/api/meal-plans', approved()));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('passes an unapproved ADMIN session through (admins bypass approval)', async () => {
    const res = await middleware(req('/api/admin/users', unapproved({ isAdmin: true })));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('redirects to / when there is no session (existing behavior)', async () => {
    const res = await middleware(req('/recipes', null));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.test/?callbackUrl=%2Frecipes');
  });
});
```

- [ ] **Step 2: Run the test**

Run:

```bash
MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/__tests__/middleware.test.ts
```

Expected: PASS (all 8 gate cases). If `Object.assign` typing complains, the handler reads only `req.nextUrl` and `req.auth`; confirm the cast in `req()` attaches `auth`.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/middleware.test.ts
git commit -m "test(auth): rework middleware test for the v5 auth wrapper (#142)"
```

---

### Task 13: Update `BottomNav.test.tsx`

**Files:**

- Modify: `src/components/__tests__/BottomNav.test.tsx:11,353`

- [ ] **Step 1: Update the mock option type (line 11)**

`signOut: (options: { callbackUrl?: string }) => mockSignOut(options),` → `signOut: (options: { redirectTo?: string }) => mockSignOut(options),`

- [ ] **Step 2: Update the assertion (line 353)**

`expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });` → `expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: '/' });`

- [ ] **Step 3: Run the test**

Run:

```bash
MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/__tests__/BottomNav.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/__tests__/BottomNav.test.tsx
git commit -m "test(auth): update BottomNav signOut assertion to redirectTo (#142)"
```

---

## Phase C — Scripts & docs

### Task 14: Drop `NEXTAUTH_URL` from the worktree env rewrite

**Files:**

- Modify: `scripts/setup-worktree.js:72-78` (`rewriteWorktreeEnv`)
- Modify: `test/manual/__tests__/setup-worktree.test.ts`

With `trustHost: true`, worktrees on different ports no longer need `NEXTAUTH_URL`.

- [ ] **Step 1: Update the test first (red)**

Rewrite `test/manual/__tests__/setup-worktree.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rewriteWorktreeEnv } from '../../../scripts/setup-worktree.js';

describe('rewriteWorktreeEnv', () => {
  const main = ['MONGODB_URI=mongodb://localhost:27017/weekly-eats-dev', 'AUTH_SECRET=abc'].join(
    '\n'
  );

  it('preserves the MONGODB_URI line verbatim (no DB-name rewrite)', () => {
    const out = rewriteWorktreeEnv(main, { port: 3456 });
    expect(out).toContain('MONGODB_URI=mongodb://localhost:27017/weekly-eats-dev');
  });

  it('sets PORT to the worktree port', () => {
    const out = rewriteWorktreeEnv(main, { port: 3456 });
    expect(out).toMatch(/^PORT=3456$/m);
  });

  it('does not duplicate PORT when one already exists', () => {
    const out = rewriteWorktreeEnv(main + '\nPORT=9999', { port: 3456 });
    expect(out.match(/^PORT=/gm)?.length).toBe(1);
    expect(out).toMatch(/^PORT=3456$/m);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (the function still references `NEXTAUTH_URL`, but more importantly the old test asserted on it)

Run:

```bash
MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/setup-worktree.test.ts
```

Expected: still passes structurally (the new test doesn't assert NEXTAUTH_URL), but proceed to update the function so the dead rewrite line is removed.

- [ ] **Step 3: Update `rewriteWorktreeEnv`**

In `scripts/setup-worktree.js`, change the function (and its doc comment) to drop the `NEXTAUTH_URL` line:

```js
/**
 * Pure env-rewrite: keep MONGODB_URI verbatim (shared DB), rewrite only PORT.
 * Auth.js v5 trustHost handles the per-port host, so NEXTAUTH_URL is gone.
 * Exported for unit testing.
 */
export function rewriteWorktreeEnv(content, { port }) {
  let env = content;
  env = env.replace(/^PORT=.*\n?/m, '');
  env = env.trimEnd() + '\nPORT=' + port + '\n';
  return env;
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run:

```bash
MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/setup-worktree.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/setup-worktree.js test/manual/__tests__/setup-worktree.test.ts
git commit -m "chore(worktree): drop NEXTAUTH_URL rewrite (trustHost handles it) (#142)"
```

---

### Task 15: Update `setup-ubuntu.sh` env documentation

**Files:**

- Modify: `scripts/setup-ubuntu.sh:87-94,99`

- [ ] **Step 1: Update the `.env.local` template block and the echo instruction**

Replace the auth env lines (87–94):

```bash
# Generate a random secret with: openssl rand -base64 33
AUTH_SECRET=your-auth-secret-here

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

with:

```bash
# Generate a random secret with: openssl rand -base64 33
AUTH_SECRET=your-auth-secret-here

AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
```

(Drop the `NEXTAUTH_URL=...` line — `trustHost` covers localhost.) Update line 99's echo: `Generate NEXTAUTH_SECRET: openssl rand -base64 32` → `Generate AUTH_SECRET: openssl rand -base64 33`.

- [ ] **Step 2: Commit**

```bash
git add scripts/setup-ubuntu.sh
git commit -m "docs(setup): rename auth env vars in ubuntu setup script (#142)"
```

---

### Task 16: Update architecture docs & CLAUDE.md

**Files:**

- Modify: `docs/architecture.md` (auth section, ~lines 12, 80–132, 186)
- Modify: `CLAUDE.md` (auth conventions section)

- [ ] **Step 1: Update `docs/architecture.md`**

- Tech table (line ~12): `**NextAuth 4** (Google OAuth, JWT strategy)` → `**Auth.js v5** (Google OAuth, JWT strategy)`.
- Auth Configuration section (~108): describe the split config (`auth.config.ts` edge-safe + `auth.ts` full), the `redirectProxyUrl` + preview-origin allowlist, and `trustHost`.
- Middleware section (~121): replace the `getToken` description with the `auth` wrapper reading `req.auth.user.isApproved`/`isAdmin`; note the named `middleware` export.
- API-route section (~126): `getServerSession(authOptions)` → `await auth()`.
- Env var names referenced anywhere: `NEXTAUTH_*`/`GOOGLE_CLIENT_*` → `AUTH_*`/`AUTH_GOOGLE_*`; add `AUTH_REDIRECT_PROXY_URL`.

- [ ] **Step 2: Update `CLAUDE.md`**

In the "API Routes" conventions: `const session = await getServerSession(authOptions)` → `const session = await auth()` (import from `@/lib/auth`). Update the line "Auth uses JWT strategy; `isAdmin`/`isApproved` are cached in the token (see `src/lib/auth.ts`)" to also mention `src/lib/auth.config.ts` for the edge-safe callbacks.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md CLAUDE.md
git commit -m "docs: update auth docs for Auth.js v5 migration (#142)"
```

---

## Phase D — Validation

### Task 17: Full validation gate

**Files:** none (validation only)

- [ ] **Step 1: Run the full check**

Run:

```bash
npm run check
```

Expected: lint + full test suite + build all green. This is the convergence gate — the suite was red throughout Phase A by design; it must be green now.

- [ ] **Step 2: If the build fails with MODULE_NOT_FOUND**, clear the cache and retry once:

```bash
npm run clean && npm run check
```

- [ ] **Step 3: Triage any failure** with the specific test in verbose mode (`npx vitest run <path>`). Common v5 gotchas: a missed `getServerSession` handle in a route test (re-grep `grep -rl "next-auth/next" src`), or a type error from a route still importing `authOptions` (`grep -rln "authOptions" src`).

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(auth): resolve v5 migration validation failures (#142)"
```

---

## Phase E — Infra & manual verification (require user go-ahead)

> **STOP.** Tasks 18–20 mutate production Vercel config and the OAuth flow. Confirm with the user before each write to Production. These run after the branch is pushed and a preview deploy exists.

### Task 18: Configure Vercel environment variables

**Files:** none (Vercel CLI)

- [ ] **Step 1: Generate the fresh shared secret**

Run:

```bash
openssl rand -base64 33
```

Capture the value; it is used identically for Production and Preview.

- [ ] **Step 2: Read the current Google client values** (to copy into the renamed vars)

Run:

```bash
vercel env pull /tmp/we.env.production --environment=production
grep -E 'GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET' /tmp/we.env.production
```

- [ ] **Step 3: Add the new vars to Production and Preview** (confirm with user first)

For each of `AUTH_SECRET` (the generated value), `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (the pulled Google values), and `AUTH_REDIRECT_PROXY_URL` (`https://weekly-eats.vercel.app/api/auth`), run `vercel env add <NAME> production` and `vercel env add <NAME> preview` and paste the value when prompted. Use the SAME `AUTH_SECRET` for both environments.

- [ ] **Step 4: Clean up the pulled env file**

```bash
rm -f /tmp/we.env.production
```

- [ ] **Step 5: Do NOT remove the old `NEXTAUTH_*` / `GOOGLE_CLIENT_*` vars yet** — leave them until Task 20 verifies the deploy works, then remove with `vercel env rm <NAME> production/preview`.

### Task 19: Verify the Google Cloud OAuth callback

**Files:** none (Chrome / Google Cloud Console)

- [ ] **Step 1: Confirm the single stable callback is registered**

Using the Claude-in-Chrome tools, open the Google Cloud Console OAuth client for this project and confirm the Authorized redirect URIs include `https://weekly-eats.vercel.app/api/auth/callback/google`. Production already uses this exact path, so it is almost certainly present — add it only if missing. No wildcard entries.

### Task 20: Manual end-to-end verification

**Files:** none (deploy + browser)

- [ ] **Step 1: Push the branch and open the PR**

```bash
git push -u origin feat/142-auth-v5-upgrade
```

Open a PR to `main` so Vercel builds a preview deploy.

- [ ] **Step 2: Verify sign-in/out on all three surfaces** (per issue acceptance criteria), using Claude-in-Chrome (Google OAuth is an external domain — Preview tools can't handle it):
  - Production (`https://weekly-eats.vercel.app`): sign out, sign back in.
  - The stable host (same as production here): confirm callback works.
  - A **fresh PR preview** URL: sign in with Google — confirm NO `redirect_uri_mismatch` and that after Google callback you land back on the preview origin, signed in.

- [ ] **Step 3: After all three pass, remove the obsolete env vars** (Task 18 Step 5) and redeploy to confirm nothing depended on them.

---

## Self-Review (completed during planning)

- **Spec coverage:** every spec section maps to a task — package bump (T1), split config (T2), allowlist + TDD (T2/T2b/T9), handler (T4), middleware (T5), user-utils + 5 routes (T6/T7), client rename (T8), types (T8 S5), all six test groups (T9–T14), scripts (T14/T15), `check-env.cjs` no-op (noted), docs (T16), validation (T17), infra + manual (T18–T20).
- **Placeholders:** none — every code step contains full code; the 40-file route-test swap gives the exact pattern + grep to enumerate (the skill's repeated-pattern exception).
- **Type consistency:** `jwtCallback` named export (T9) is referenced by both `auth.ts` config and `auth.test.ts`; `auth.config.ts` default export's `.callbacks.redirect`/`.session` are read consistently in T2b and T9; `isAllowedOrigin`/`PREVIEW_ORIGIN` names match across T2 and tests; `req.auth.user.isApproved` shape matches the `session` callback output.
