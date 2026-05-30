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

| #   | Phase                                                    | Status  | Plan doc                                                                                       | PR test comment | Done |
| --- | -------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- | --------------- | ---- |
| 1   | Service layer + recipes/food-items MCP tools (dev-token) | pending | [`2026-05-30-mcp-phase-1-service-tools-plan.md`](2026-05-30-mcp-phase-1-service-tools-plan.md) | —               | —    |
| 2   | OAuth AS + approval-gated verification + deploy          | pending | —                                                                                              | —               | —    |
| 3   | `recipe-import` skill                                    | pending | —                                                                                              | —               | —    |
| 4   | Remaining domains (meal plans, pantry, shopping lists)   | pending | —                                                                                              | —               | —    |

Status values: `pending` → `in-progress` → `done`. Per-phase plans live at
`docs/superpowers/plans/YYYY-MM-DD-mcp-phase-N-<surface>-plan.md` (authored via
`writing-plans` before that phase's code). Per-phase manual-test checklists post as their
own slot comments on the draft PR when a phase lands.

## Next up

**Phase 1 — Service layer + recipes/food-items tools.** No OAuth surface → lowest-risk
starting point. Extract `src/lib/service-errors.ts` + `src/lib/services/{recipes,food-items}.ts`,
refactor the four existing routes to thin callers (behavior-preserving), stand up
`/api/mcp` (stateless Streamable HTTP via `mcp-handler`) with the recipes + food-items
tools behind the `MCP_DEV_TOKEN` + non-prod gate. Tests per spec §8a.

**How to resume (cold-start checklist):**

1. Read the spec (§6.3, §6.5, §8, §8a, §11) + this ledger. The Phase-1 plan (once authored
   via `writing-plans`) is self-contained (exact code + tests per task).
2. **Author the Phase-1 plan** with `superpowers:writing-plans` if not yet done; then
   **execute via `superpowers:subagent-driven-development`** (fresh subagent per task,
   two-stage review, TDD: failing test → run → implement → pass → commit). Run vitest
   per-task with `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run <file>`.
3. **`npm run check`** at the end (only when no dev server is running — Turbopack/build
   collision clobbers `.next`).
4. Push → CI. Post the Phase-1 manual-test checklist as a slot comment on the draft PR
   (`/manual-testing`), then verify locally.
5. Update this ledger (status → done, fill plan-doc/PR-comment/date), and pause for user
   review before calling the phase done if that's the agreed cadence.

## Decisions & carryovers

Dated entries for things decided during design/review that affect implementation but
aren't worth a spec rewrite.

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
- **2026-05-30 — Reviewer reliability caveat (this design session).** During the 7-loop
  review the orchestrator confabulated "prompt injection" alarms 3× and once overstated a
  finding's severity (CS1), each corrected after the fact. None reached the committed spec
  load-bearing. Terminal output was intermittently garbled (duplicated echoes) — that is
  NOT injection. Treat any "I detected an injection" claim from that session as a false
  alarm. The real security scrutiny still owed: code-time `/code-review ultra` + a human
  pass on the OAuth flow.
