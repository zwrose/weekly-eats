# MCP Agent Connector — Progress Ledger

Living dashboard for the Weekly Eats MCP agent connector. This is the **compaction
resume-anchor**: a freshly-compacted context reads the spec + this file to know where
things stand. Git is the objective truth; this is the readable narrative.

- **Spec (roadmap):** `docs/superpowers/specs/2026-05-29-agent-connector-design.md`
- **Plan review:** `docs/superpowers/specs/2026-05-29-agent-connector-design-review.md` (7 loops + dedicated OAuth-AS research; converged 11→11→4→5→3→1→0 → PLAN READY)
- **Branch:** `feat/mcp` · **Draft PR:** [#140](https://github.com/zwrose/weekly-eats/pull/140) (long-lived, opened docs-only 2026-05-30)
- **Related issues:** #72 (MCP), #56 (recipe import skill — closed by Phase 3), #142 (Auth.js v5 redirect proxy — **gates Phase 2**, folded in as Phase 1.5)

What this is: a self-serve **Claude Connector** (remote MCP server + hand-rolled OAuth 2.1
AS that delegates login to Google/NextAuth and mints its own tokens) hosted in the Next.js
app on Vercel. Motivating use case: a `recipe-import` skill. Built phase-by-phase; each
phase is one reviewable unit landed onto `feat/mcp`; final squash-merge into `main` when
all phases land.

## Phase status

| #   | Phase                                                        | Status                                                                  | Plan doc                                                                                                                 | PR test comment                                                                | Done       |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------- |
| 1   | Service layer + recipes/food-items MCP tools (dev-token)     | **DONE** — code + manual verify + review-code (clean)                   | [`plan`](2026-05-30-mcp-phase-1-service-tools-plan.md) · [`review`](2026-05-30-mcp-phase-1-service-tools-plan-review.md) | [#140](https://github.com/zwrose/weekly-eats/pull/140#issuecomment-4582026777) | 2026-05-30 |
| 1.5 | Auth.js v5 migration + redirect proxy (#142) — gates Phase 2 | **DONE** — merged to `main` (#146) + pulled into `feat/mcp` (`45bcd2b`) | — _(user effort)_                                                                                                        | —                                                                              | 2026-05-30 |
| 2   | OAuth AS + approval-gated verification + deploy              | **DONE** — code + review-code (clean) + `npm run check` green           | [`plan`](2026-05-30-mcp-phase-2-oauth-as-plan.md)                                                                        | —                                                                              | 2026-05-30 |
| 3   | `recipe-import` skill                                        | pending                                                                 | —                                                                                                                        | —                                                                              | —          |
| 4   | Remaining domains (meal plans, pantry, shopping lists)       | pending                                                                 | —                                                                                                                        | —                                                                              | —          |

Status values: `pending` → `in-progress` → `done`. Per-phase plans live at
`docs/superpowers/plans/YYYY-MM-DD-mcp-phase-N-<surface>-plan.md` (authored via
`writing-plans` before that phase's code). Per-phase manual-test checklists post as their
own slot comments on the draft PR when a phase lands.

## Next up

> ### ⚠️ PRODUCTION-LAUNCH CHECKLIST (do these when `feat/mcp` ships to production)
>
> - [ ] **Set `MCP_ISSUER_URL=https://weekly-eats.zamilyfam.com` on Vercel _Production_** (the canonical custom domain). REQUIRED — prod has multiple hostnames (custom domain + `.vercel.app` + `beta` subdomain), so without pinning, OAuth tokens break across hosts. **Leave Preview unset.** Command: `vercel env add MCP_ISSUER_URL production` (CLI already authed to `zach-roses-projects/weekly-eats`). See carryover (f).
> - [ ] Confirm **no** `MCP_DEV_TOKEN` / `MCP_DEV_USER_ID` in the Production/Preview env (currently absent — keep it that way; the dev path is removed).
> - [ ] (Optional, #142 cleanup) remove the now-dead v4 vars from Vercel: `GOOGLE_CLIENT_ID/SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`.

**▶ PHASE 2 IS DONE (2026-05-30).** Built via `writing-plans` → `review-plan` → `subagent-driven-development` (22 TDD tasks, two-stage review per task) → `review-code` (clean) → `npm run check` green. Delivers the full hand-rolled OAuth 2.1 AS: DCR (`register`), PKCE authorize flow with consent screen, `token` (auth-code exchange + refresh rotation with reuse detection), `revoke`, two `/.well-known/*` discovery docs via `next.config.ts` rewrites, six `mcp*` MongoDB collections (all secrets SHA-256-hashed / CSPRNG / single-use atomic / expiry-checked at use), rewritten `verifyToken` with live approval lookup on every call (M1 + audience R3 + dev token removed). **▶ NEXT: Phase 3 (recipe-import skill).**

**▶ CURRENT SEQUENCING (updated 2026-05-30):** Phase 2 (OAuth AS) is **DONE** — `npm run check` green, branch `feat/mcp`. Plan Phase 3 via `writing-plans` before starting code.

**Historical (Phase 1 + 1.5 build narrative, kept for reference):** Phase 1 pushed to `feat/mcp` (PR #140, HEAD `60e5581`). Built via `writing-plans` → 3-loop `review-plan` (clean) → `subagent-driven-development` (11 TDD tasks) → `review-code` (1 round, clean: 0 Critical/Important, security clean, 4 Minor/Nit auto-fixed in `57259a7`) → `npm run check` green (**1488 tests**, lint 0, build OK) → synced with `main` → **manual end-to-end verify passed** (all 3 checklist sections). Phase 1.5 (#142 Auth.js v5) merged to `main` (#146) and pulled into `feat/mcp` via merge `45bcd2b`; `npm run check` green (**1500 tests**) with zero source fallout.

**Manual/end-to-end verification COMPLETE (2026-05-30, Phase 1).** User connected MCP Inspector to
`/api/mcp` with the dev token and walked the full checklist: section A (browser regression),
section B (all 7 tools — search/get/create/update for both domains, isGlobal-forced-false,
error mapping), section C (401 gate: no-auth→401, wrong-token→401, correct-token→200,
confirmed via curl). Verification surfaced **two real bugs, both fixed on-branch**:

1. **Seed recipes 500'd on fetch** — `cc10ea9` (ingredient ids written as ObjectId, not hex
   string; see the dated carryover below + issue #144).
2. **`/api/mcp` redirected to the HTML login page** — `920d771`. The global NextAuth session
   middleware matched `/api/mcp`, found no session cookie (MCP clients use a Bearer token),
   and 307-redirected → "Unexpected content type: text/html" in the client. Fixed by exempting
   `/api/mcp` in the middleware allow short-circuit (same treatment as `/api/auth/*`); the
   route's `withMcpAuth` bearer gate owns auth. Regression test added.

Also **synced with `main`** (`3bde32c`): merged the major dep wave (zod 4 / TS 6 / vitest 4 /
Node 24 / convert 7) — only `package-lock.json` conflicted; `npm run check` green afterward
with zero source fixes. `feat/mcp` is now 0 behind main.

Dev-token-in-worktree gotcha (cost real time during verify): `npm run dev` runs
`setup-worktree.js`, which **regenerates the worktree's `.env.local` from the main worktree's
copy** (`rewriteWorktreeEnv` only rewrites PORT/NEXTAUTH_URL, passes other lines through). So
`MCP_DEV_TOKEN`/`MCP_DEV_USER_ID` must live in **main's** `.env.local` (`/Users/zwrose/weekly-eats/.env.local`)
to survive restarts — adding them to the worktree copy gets wiped on the next `npm run dev`.

Final `npm run check` (build step included, dev server stopped) ran clean — **exit 0, 1488
tests** — closing the one item that was previously outstanding. See the current-sequencing
note above for what's next.

Implementation notes worth carrying forward:

- **SDK pin:** `@modelcontextprotocol/sdk@1.26.0` **exactly** (mcp-handler@1.1.0's peer is
  exact; 1.29.0 → ERESOLVE). Still satisfies spec ≥1.26.0.
- **Tool names use underscores** (`food_items_search`, not `food_items.search`) — the SDK's
  `McpServer.registerTool` rejects `.` in names. The dot form in the spec is superseded.
- **Route mount:** `src/app/api/[transport]/route.ts` + `basePath:'/api'` → endpoint
  `/api/mcp` (mcp-handler requires the `[transport]` dynamic segment). Accepted side effect:
  unknown `/api/<typo>` paths now 401 instead of 404 (documented in the plan's Scope).
- **Transport positive-auth test omitted on purpose:** with a valid bearer the handler
  streams a response mcp-handler's adapter can't build under jsdom/undici (`Unexpected chunk
type`); covered instead by verify-token unit tests + the register smoke test.
- **Seed manifest** (`test/manual/manifests/feat%2Fmcp.json`) pins `user-baseline` to
  `zwrose@gmail.com` — the dev DB has 4 users so apply is ambiguous without it.

**Prior cold-start checklist (kept for reference; Phase 1 is now built + verified):**

1. Read the spec (§6.3, §6.5, §8, §8a, §11) + this ledger. The Phase-1 plan is self-contained.
2. Execute via `superpowers:subagent-driven-development` (fresh subagent per task, TDD).
3. **`npm run check`** at the end (only when no dev server is running — Turbopack/build
   collision clobbers `.next`).
4. Push → CI. Post the Phase-1 manual-test checklist on the draft PR (`/manual-testing`),
   then verify locally.
5. Update this ledger (status → done, fill plan-doc/PR-comment/date), pause for user review.

## Decisions & carryovers

Dated entries for things decided during design/review that affect implementation but
aren't worth a spec rewrite.

- **2026-05-30 — Synced with `main`: Next.js 16 + MUI v9 + uuid-override removal (merge `9b9b0f6`).**
  Pulled in #148 (Next 15→16 + ESLint flat-config; `lint` script → `eslint .`), #149 (MUI 7→9), #150
  (drop dead uuid override). Only `package.json`/`package-lock.json` conflicted; `next.config.ts`
  (my `/.well-known` rewrites vs main's Next-16 edits) **auto-merged**, `eslint.config.mjs` identical.
  Resolved by taking main's package baseline + re-adding the two MCP deps (`mcp-handler@^1.1.0`,
  `@modelcontextprotocol/sdk@1.26.0` — exact), `npm install` (no ERESOLVE; mcp-handler peers `next>=13`).
  **One source-fallout fix** (`cc0f1aa`): MUI v9 tightened `Stack` typing — `justifyContent` is no longer
  a direct prop, moved to `sx` on the consent page. `npm run check` green (**1599 tests**, lint 0, build OK).
  Carryover: Next 16 deprecates the `middleware.ts` convention in favor of `proxy.ts` (warning only, not a
  break; affects `main` too) — a future migration, out of scope for this sync. `feat/mcp` now 0 behind main.

- **2026-05-30 — Phase 2 open questions resolved + §6.4 carryover closed.**
  (a) **Login leg:** reuses the app's existing landing-page Google sign-in via a relative `callbackUrl` — NOT a programmatic `signIn()` call. No second identity system. The AS `/authorize` redirects the user to the landing page with a `callbackUrl` pointing back into the OAuth flow; Auth.js v5 handles the Google round-trip transparently.
  (b) **OAuth wire error constants:** resolved as `MCP_OAUTH_ERRORS` — a dedicated group in `src/lib/errors.ts` holding RFC-literal values (e.g. `invalid_client`, `invalid_grant`, `rate_limited`). This is a documented exemption to the no-hardcoded-strings rule; the RFC requires these exact strings on the wire.
  (c) **§6.4 dev-token carryover CLOSED:** the static `MCP_DEV_TOKEN`/`MCP_DEV_USER_ID` path has been removed from `verifyToken`. The live-lookup OAuth verifier is the only auth path. C1 regression test confirms the dev path is inert (rejects any token not in `mcpTokens`).
  (d) **DCR rate limiter is best-effort:** the per-IP counter is a serverless read-then-write (not atomic), so it is a bound, not a hard control. Accepted — the cost of a DCR burst is low and the alternative (distributed atomic counters) is disproportionate.
  (e) **I6 client reaping DONE + latent TTL bug fixed (commit `39c2550`).** The final review surfaced that MongoDB TTL indexes only reap **BSON `Date`** fields, but every mcp\* expiry/timestamp field was stored as a `number` (ms epoch, for deterministic tests) — so all five `expireAfterSeconds` indexes were silent no-ops (security unaffected; the at-use `expiresAt` checks always governed, but expired docs were never reclaimed). Fix: the TTL-driving fields (`expiresAt` on auth-codes/auth-states/tokens/rate-limits, `lastUsedAt` on clients) are now stored as `Date`; at-use comparisons use `.getTime()`, the rotate filter uses `{ $gt: new Date(now) }`, `windowStart` stays numeric. `mcpClients` got a real **90-day TTL** on `lastUsedAt`, and `touchClient` is now wired into `/token` + `/authorize` so the timestamp refreshes on use — the I6 reaper is live. `npm run check` green (1599 tests).
  (f) **Set `MCP_ISSUER_URL` in production — REQUIRED at launch (not optional).** The app serves production at **multiple hostnames** (`weekly-eats.zamilyfam.com` custom domain, `weekly-eats.vercel.app` alias, `beta.weekly-eats.zamilyfam.com` — see `auth.config.ts` PROD_ORIGINS). Unset, the token audience derives per-request from `x-forwarded-host`, so a token minted under one host fails `verifyToken`'s audience check when a request arrives via another → connector silently breaks ("connected but nothing works"). **Pin it to the canonical connector origin** (the custom domain): on Vercel Production set `MCP_ISSUER_URL=https://weekly-eats.zamilyfam.com`. **Leave Preview UNSET** (each preview has its own URL → must derive per-request). See the ⚠️ launch checklist at the top of "Next up". Vercel CLI is authed (`zach-roses-projects/weekly-eats`); a worktree links via `vercel link --yes --project weekly-eats`.

- **2026-05-30 — Hand-rolled OAuth AS is forced, not just preferred.** Dedicated research
  (25 primary-source claims) confirmed `@modelcontextprotocol/sdk` **removed**
  `ProxyOAuthServerProvider`/`mcpAuthRouter`, and `mcp-handler`'s `withMcpAuth` is
  Resource-Server-only. So the AS is hand-rolled either way; `verifyToken` owns ALL
  security logic (hash lookup, `tokenType:'access'`, `revokedAt`, audience, live approval).
  Managed providers (WorkOS/Stytch/Scalekit/Descope) were considered and deferred — single
  identity / no new SaaS, per the spec's key decisions.
- **2026-05-30 — Primary reference impl is `bojanrajkovic/mcp-paprika` (`src/auth/`).** An
  independent, working, Claude-connectable hand-rolled OAuth-Proxy AS, Google/OIDC-delegated,
  with property tests — direct analogues to our `mcp*` collections. Replaces the weaker
  `DTeam-Top/mcp-oauth` pointer as the go-to template. One structural difference: it uses a
  generic OIDC client; we reuse the app's NextAuth+Google flow.
- **2026-05-30 — Consent screen (CS1) is defense-in-depth, NOT load-bearing.** The MCP BCP
  consent requirement is conditional (static upstream client-id + replayable cookie). The
  real authorization boundary is the `isApproved`/`isAdmin` allowlist + per-user data
  scoping. Kept by explicit user choice for good consent UX; do not re-frame it as a
  critical confused-deputy fix.
- **2026-05-30 — Approval is enforced at THREE points (L5-S1 + I5 + M1).** `/authorize`
  before code issuance **on every path including consent-skip** (L6), every refresh
  exchange (I5), and live in `verifyToken` on every tool call (M1). The `/authorize` gate
  must read live `users` (not the NextAuth-cached JWT `isApproved`).
- **2026-05-30 — Open questions to resolve IN Phase 2 (not now):** (a) how the programmatic
  AS authorize→login→callback threads through **Auth.js v5** (`auth()` + redirect proxy) +
  Google — re-point this at v5 once #142 lands (was "NextAuth v4"); ask Bojan how he wires
  the login leg; (b) re-check the **2025-11-25** MCP auth revision (research used 2025-06-18;
  confirmed non-contradictory but verify); (c) OAuth protocol error-code constants vs the
  `@/lib/errors` "no hardcoded strings" rule (L5-code-001, deferred — RFC-literal exemption
  vs. a new `MCP_OAUTH_ERRORS` group); (d) Vercel clock-skew tolerance for second-scale
  code expiry + signing/hashing-pepper secret management.
- **2026-05-30 — #142 (Auth.js v5 redirect proxy) gates Phase 2; folded in as Phase 1.5.**
  #142 migrates `next-auth` v4 → Auth.js v5 to make Google login work on Vercel preview
  deploys (one stable registered callback; previews carried in OAuth `state`). It rewrites
  the exact login leg the AS `/authorize` delegates to and the `getServerSession`→`auth()`
  surface that `requireApprovedSession` (Phase 2's `/authorize` + `verifyToken` approval
  gates) sits on. **Phase 1 is independent** (keeps every `requireApprovedSession` call site
  byte-identical — body just moves to services — so a v5 migration rebases cleanly; no
  semantic collision). **Phase 2 is coupled:** building the AS against v4 then migrating =
  redoing the riskiest, most security-sensitive code twice. Also a testing synergy — #142 is
  what makes the real Google flow (hence the connector end-to-end) exercisable on PR
  previews, which Phase 2's "add the connector in Claude and sign in" deliverable needs.
  **Sequence:** Phase 1 now (decoupled) → land #142 (its own effort; sequence around the
  in-flight dep upgrades #133/#132/#131/#129 it notes) → Phase 2. At minimum, freeze the
  v4-vs-v5 auth foundation before writing the AS login leg. When Phase 2 is planned, also
  evaluate whether the connector's Google-callback leg should ride on v5's redirect proxy
  (shared origin allowlisting) rather than reinvent it.
- **2026-05-30 — Phase 1 dev-token MUST be inert in production before Phase 2 deploy (C1).**
  Enabled only when `MCP_DEV_TOKEN` set **and** `NODE_ENV !== 'production'`; Phase 2 has an
  exit-checklist integration test asserting prod config rejects it.
- **2026-05-30 — `food_items.create` forces `isGlobal:false` in the TOOL wrapper, not the
  service (A1).** Keeps "routes and tools call identical service functions" true; the
  service still accepts `isGlobal` (HTTP behavior preserved), the MCP tool overrides it.
- **2026-05-30 — Phase-1 `/review-code` pass: clean (READY FOR PR), one Phase-2 carryover.**
  Branch-mode multi-agent review of all of Phase 1 (commit `57259a7`): **0 Critical, 0
  Important; security dimension clean.** Auto-fixed 4 Minor/Nit findings — hoisted the
  duplicated `ToolServer` interface into `tool-helpers.ts`, and added 3 test-coverage cases
  (`searchFoodItems` text-search `$and` scope, `searchRecipes` text-search ownership scope,
  `verifyToken` same-length wrong-token to exercise `timingSafeEqual`). Deliberately NOT
  changed: the `[id]`-route DELETE/PUT stayed inline (YAGNI scope), the two domain-specific
  `computeAccessLevel` funcs stayed separate (no shared helper exists; different access
  models), and the invalid-food-item-id message change (`'Bad request'` → `'Invalid food
item ID'`, same 400) was **accepted** as an improvement matching the recipes route — note
  it in the PR description. **Carryover to Phase 2:** the dev gate trusts `MCP_DEV_USER_ID`
  verbatim + hardcodes `isApproved:true` with no `users` lookup (accepted: dev-only,
  prod-inert). Phase 2's live-lookup `verifyToken` (spec §6.4 M1) is the required
  replacement — the static-id trust must not carry over. Now noted in the spec §6.4.
  (Process note: the orchestrator initially confabulated a different finding set from
  garbled terminal output and had to be corrected against the agents' real JSON — the
  reliability caveat below, again.)
- **2026-05-30 — Seed recipe ingredient ids must be hex strings (bug fix, commit `cc10ea9`).**
  Manual verify surfaced "failed to fetch" on every _seeded_ recipe (organically-created
  ones were fine). Root cause was NOT in Phase-1 app code: the `recipes` seed block
  (`test/manual/scenarios/recipes.ts`) wrote ingredient `id` as a raw BSON `ObjectId`, but
  `RecipeIngredient.id` is a hex string and `getRecipe` runs every id through
  `ObjectId.createFromHexString` (identical call pre- and post-refactor — behavior preserved),
  which throws on a non-string → unhandled 500. Fixed by stringifying the resolved food-item
  `_id`s + giving the placeholder fallback valid 24-hex ids; corrected two tests that had
  codified the buggy shape. Re-seeded; verified all 5 recipes' 9 ingredient ids are 24-hex.
  Carryover: the service does a raw `createFromHexString` on ingredient ids with no guard — a
  latent 500 on any malformed id; out of scope for behavior-preserving Phase 1, worth a guard
  later if real data can ever hold bad ids.
- **2026-05-30 — Reviewer reliability caveat (this design session).** During the 7-loop
  review the orchestrator confabulated "prompt injection" alarms 3× and once overstated a
  finding's severity (CS1), each corrected after the fact. None reached the committed spec
  load-bearing. Terminal output was intermittently garbled (duplicated echoes) — that is
  NOT injection. Treat any "I detected an injection" claim from that session as a false
  alarm. The real security scrutiny still owed: code-time `/code-review ultra` + a human
  pass on the OAuth flow.
