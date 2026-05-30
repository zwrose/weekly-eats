# Auth.js v5 Migration + Redirect Proxy for Preview Deploys

**Issue:** [#142](https://github.com/zwrose/weekly-eats/issues/142)
**Date:** 2026-05-30
**Branch:** `feat/142-auth-v5-upgrade`

## Problem

Google OAuth requires exact, byte-for-byte redirect URIs and rejects wildcards.
Vercel gives every PR a unique preview URL, so signing in with Google on a
preview deploy fails with `redirect_uri_mismatch`. We cannot exercise the real
Google login flow on PR previews today, and registering `*.vercel.app` is both
disallowed by Google and a token-theft vector.

## Solution

Adopt the Auth.js **v5 redirect proxy**: register one stable callback with
Google (production), and configure previews to route Google's callback through
the stable host, then redirect back to the preview. This requires migrating
`next-auth` v4 → Auth.js v5, which is the bulk of the work.

One registered URI covers every preview, indefinitely.

## Decisions

These were settled during brainstorming:

1. **Scope:** Full v5 migration in code. No dev/credentials stopgap provider.
   Infra (Vercel env vars, Google Cloud) automated via tooling where possible.
2. **Env var naming:** Full idiomatic v5 rename (`AUTH_SECRET`, `AUTH_GOOGLE_ID`,
   `AUTH_GOOGLE_SECRET`); drop `NEXTAUTH_URL` in favor of `trustHost`.
3. **Middleware:** Split-config pattern (edge-safe `auth.config.ts` + full
   `auth.ts`). Chosen over keeping `getToken` because v5 derives the JWE key
   using the cookie name as an HKDF salt, and that name varies by environment
   (`__Secure-` prefix in prod). `getToken` would force us to resolve that
   manually (a footgun that silently breaks prod auth); the split config hands
   cookie/secret resolution to the framework.
4. **AUTH_SECRET:** Generate a **fresh** shared secret, set identically on
   Preview + Production. v4→v5 invalidates all sessions regardless of the secret
   value (cookie name + key-derivation both changed), so reuse buys no continuity.
   The only hard requirement is that Preview and Production share the same value.
5. **One-time re-login accepted.** All logged-in users re-authenticate once at
   cutover. We do not implement a token-bridging middleware.

## Architecture

### Package changes

- `next-auth`: `^4.24.11` → `^5` (published as `next-auth@beta`).
- `@auth/mongodb-adapter`: `^3.9.1` — already v5-compatible, no change.

### Config files (split pattern)

**`src/lib/auth.config.ts`** (new, edge-safe — no adapter, no DB import):

- `providers: [Google]` — auto-infers `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
- `session: { strategy: 'jwt' }`.
- `trustHost: true`.
- `redirectProxyUrl: process.env.AUTH_REDIRECT_PROXY_URL`.
- `callbacks.session` — maps token claims (`sub`, `isAdmin`, `isApproved`) onto
  `session.user` (moved from current `auth.ts`).
- `callbacks.redirect` — the **preview-origin allowlist** (see Security).
- **No `jwt` callback here** (it queries Mongo; must not run on edge).

**`src/lib/auth.ts`** (full config, Node runtime):

```ts
import NextAuth from 'next-auth';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import authConfig from './auth.config';
import clientPromise from './mongodb-adapter';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise),
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, trigger }) {
      /* existing DB-backed isAdmin/isApproved enrichment, unchanged */
    },
  },
});
```

The `jwt` callback runs only at sign-in/update in the Node-runtime route
handler. Middleware reads the already-baked claims off the decoded token.

### Server-side consumers

| File                                                                       | Change                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/api/auth/[...nextauth]/route.ts`                                  | `import { handlers } from '@/lib/auth'; export const { GET, POST } = handlers;`                                                                                                                                                                                                                                                    |
| `src/middleware.ts`                                                        | `import authConfig from '@/lib/auth.config'; const { auth } = NextAuth(authConfig); export default auth((req) => { … })`. Same approval-gate logic, reading `req.auth?.user?.isApproved` / `isAdmin` instead of `token.*`. Drops explicit `secret` param and the `NEXTAUTH_SECRET` reference. Keeps the existing `config.matcher`. |
| `src/lib/user-utils.ts`                                                    | `getServerSession(authOptions)` → `await auth()` (import from `@/lib/auth`). Drop the `next-auth/next` + `authOptions` imports.                                                                                                                                                                                                    |
| ~6 production API routes (`api/admin/users/*`, `api/user/approval-status`) | Same `getServerSession(authOptions)` → `await auth()` swap.                                                                                                                                                                                                                                                                        |

### Client components (minimal change)

`next-auth/react` still exports `useSession`, `SessionProvider`, `signIn`,
`signOut` in v5. Unchanged: `Providers`, `SessionWrapper`, `Header`, `BottomNav`,
`AdminOnly`, `theme-context`, `use-approval-status`, the feature pages.

Only the `callbackUrl` option was renamed to `redirectTo`:

- `src/components/SignInButton.tsx` — `signIn('google', { callbackUrl })` → `{ redirectTo: callbackUrl }`.
- `src/components/Header.tsx`, `src/components/BottomNav.tsx`,
  `src/app/pending-approval/page.tsx` — `signOut({ callbackUrl: '/' })` → `signOut({ redirectTo: '/' })`.

### Types

`src/types/next-auth.d.ts` — augmentation of `next-auth` (Session/User) and
`next-auth/jwt` (JWT) keeps working; same module names in v5. No change expected;
verify `Session.user` shape still compiles.

## Security: redirect proxy + origin allowlist

**Mechanism.** With `AUTH_REDIRECT_PROXY_URL` set, Auth.js sends Google the
_stable_ `redirect_uri` and stores the originating preview URL in the OAuth
`state`, signed with the shared `AUTH_SECRET`. After Google calls back to the
stable host, Auth.js verifies the signed state and redirects to the preview.

**Env config (both environments share `AUTH_SECRET`):**

| Var                                     | Production                                | Preview           |
| --------------------------------------- | ----------------------------------------- | ----------------- |
| `AUTH_SECRET`                           | fresh shared value                        | same shared value |
| `AUTH_REDIRECT_PROXY_URL`               | `https://weekly-eats.vercel.app/api/auth` | same              |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from current Google client                | same              |

On production the request origin equals the proxy origin, so Auth.js behaves
normally (no proxying). On a preview the origins differ, so it proxies.

**Allowlist (`redirect` callback, defense-in-depth beyond the signed state).**
Permit only:

- relative URLs (`url.startsWith('/')`),
- same origin as `baseUrl`,
- the production host `https://weekly-eats.vercel.app`,
- origins matching `^https://weekly-eats-[a-z0-9-]+-zach-roses-projects\.vercel\.app$`.

Anything else returns `baseUrl`. This closes the open-redirect / token-leak
vector the issue calls out.

## Environment variables & scripts

### Rename map

| Old                    | New                                         |
| ---------------------- | ------------------------------------------- |
| `NEXTAUTH_SECRET`      | `AUTH_SECRET`                               |
| `GOOGLE_CLIENT_ID`     | `AUTH_GOOGLE_ID`                            |
| `GOOGLE_CLIENT_SECRET` | `AUTH_GOOGLE_SECRET`                        |
| `NEXTAUTH_URL`         | _(removed — replaced by `trustHost: true`)_ |
| —                      | `AUTH_REDIRECT_PROXY_URL` _(new)_           |

### Files to update

- **`scripts/setup-worktree.js`** — `rewriteWorktreeEnv` currently rewrites the
  `NEXTAUTH_URL` port. With `trustHost`, worktrees on different ports work
  without it. Remove the `NEXTAUTH_URL` rewrite line; keep the `PORT` rewrite.
  Update the corresponding unit test for `rewriteWorktreeEnv`.
- **`scripts/check-env.cjs`** — update required-var validation to the new names.
- **`scripts/setup-ubuntu.sh`** — update the documented env var names and the
  `openssl rand` instruction (now `AUTH_SECRET`).
- **Local `.env.local`** (hook-protected, cannot edit programmatically) — provide
  the user exact lines to change: rename the three vars; `NEXTAUTH_URL` may be
  dropped. `AUTH_REDIRECT_PROXY_URL` is not needed for local dev.

## Infra automation

1. **Vercel** (CLI, authenticated as `zwrose`, project `weekly-eats` /
   `zach-roses-projects`):
   - Generate a fresh `AUTH_SECRET` (`openssl rand -base64 33`); add to Production
     and Preview (same value).
   - Add `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` = current Google client values
     (pulled from existing `GOOGLE_CLIENT_*`) to Production + Preview.
   - Add `AUTH_REDIRECT_PROXY_URL=https://weekly-eats.vercel.app/api/auth` to
     Production + Preview.
   - Remove old `NEXTAUTH_*` / `GOOGLE_CLIENT_*` only after the deploy verifies.
   - **Confirm with the user before any write to Production.**
2. **Google Cloud Console** (Chrome): verify the OAuth client already lists
   `https://weekly-eats.vercel.app/api/auth/callback/google` (production works
   today and the path is unchanged, so this is likely a no-op). Add only if
   missing.

## Tests

- **~40 API route tests** — replace
  `vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))` +
  `vi.mock('@/lib/auth', () => ({ authOptions: {} }))` with
  `vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))`, and
  `getServerSession.mockResolvedValue(...)` → `vi.mocked(auth).mockResolvedValue(...)`.
  `src/test-utils/session.ts` helpers (`approvedSession` / `unapprovedSession`)
  stay as-is; the `Session` type import still resolves.
- **`src/__tests__/middleware.test.ts`** — reworked: instead of mocking
  `next-auth/jwt` `getToken`, mock the `auth` wrapper so the handler receives a
  `req.auth` shaped like the decoded session. Preserve all existing gate cases
  (401/403 JSON for API, 307 redirect to `/pending-approval`, fail-closed on
  missing `isApproved`, admin bypass, exempt paths).
- **`rewriteWorktreeEnv` unit test** — update for the dropped `NEXTAUTH_URL` line.

## Docs

- `docs/architecture.md` — update the Auth row/section (NextAuth 4 → Auth.js v5),
  the config-file description (split config), env var names, and the middleware
  description (`auth` wrapper / `req.auth` vs `getToken`).
- `CLAUDE.md` — the auth conventions section references JWT strategy and token
  caching; update phrasing where it names `getServerSession`/`authOptions`.

## Verification

- `npm run check` (lint + 47-file test suite + build) locally.
- Manual (per issue acceptance criteria): sign-in and sign-out on **production**,
  on the **stable host**, and on a **fresh PR preview** deploy — confirm no
  `redirect_uri_mismatch` and correct redirect-back to the preview.

## Out of scope

- Token-bridging middleware to avoid the one-time re-login (explicitly accepted).
- Dev/credentials stopgap provider.
- Custom auth subdomain (`auth.<domain>`) — production host is the stable host.
- Any unrelated refactor of auth-adjacent code.
