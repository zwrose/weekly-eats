# MCP Agent Connector — Progress Ledger

**Spec:** [`2026-05-29-agent-connector-design.md`](../specs/2026-05-29-agent-connector-design.md)
**Plan review:** [`2026-05-29-agent-connector-design-review.md`](../specs/2026-05-29-agent-connector-design-review.md) (7 loops + dedicated OAuth-AS research; converged 11→11→4→5→3→1→0)
**Integration PR:** _TBD — long-lived draft; squash-merges into `main` when all phases land_
**Branch:** `feat/mcp`
**Related issues:** #72 (MCP), #56 (recipe import skill)

This ledger tracks phase-by-phase progress on the Weekly Eats MCP agent connector — a
self-serve Claude Connector (remote MCP server + hand-rolled OAuth 2.1 AS) hosted in the
Next.js app on Vercel. Each phase is one reviewable unit landed onto the integration
branch. Update the status table + the phase's detail block as work progresses; post a
per-phase manual-test checklist as a slot comment on the PR when a phase lands.

---

## Status

| Phase | Surface                                                           | Status         | Landed |
| ----- | ----------------------------------------------------------------- | -------------- | ------ |
| 1     | Service layer + recipes/food-items MCP tools (dev-token gate)     | 🔲 Not started | —      |
| 2     | OAuth Authorization Server + approval-gated verification + deploy | 🔲 Not started | —      |
| 3     | `recipe-import` skill                                             | 🔲 Not started | —      |
| 4     | Remaining domains (meal plans, pantry, shopping lists)            | 🔲 Not started | —      |

**Legend:** ✅ Landed · 🚧 In progress · 🔲 Not started · ⏸️ Blocked

**Plan documents:** each phase gets its own `docs/superpowers/plans/YYYY-MM-DD-mcp-phase-N-*.md`
implementation plan (via `writing-plans`) before its code is written. Linked from the
phase block below once authored.

---

## Phase detail

### Phase 1 — Service layer + recipes/food-items tools 🔲

**Status:** Not started · **Spec:** §6.3, §6.5, §8, §8a, §11 · **No OAuth surface (lowest risk)**

Extract the shared service layer and stand up the MCP transport with recipes + food-items
tools, gated by a non-production dev token. This is the foundation both the HTTP routes
and the MCP tools call — no auth-server work yet.

**Planned deliverables:**

- `src/lib/service-errors.ts` — throwable `ValidationError` / `NotFoundError` / `ForbiddenError` / `ConflictError` (each carrying an `@/lib/errors` constant)
- `src/lib/services/recipes.ts`, `src/lib/services/food-items.ts` — pure `(userId, input) => Promise<Result>` functions (validation incl. `ObjectId.isValid`, ownership, user-scoping, Mongo)
- Refactor existing routes to thin callers (behavior-preserving; existing route tests stay green): `recipes/route.ts`, `recipes/[id]/route.ts`, `food-items/route.ts`, `food-items/[id]/route.ts`
- `src/app/api/mcp/route.ts` — stateless Streamable HTTP via `mcp-handler`; tools `food_items.search/get/create` (create forces `isGlobal:false` in the tool wrapper — A1), `recipes.search/get/create/update`; zod schemas
- Dev-token gate (C1): static bearer enabled only when `MCP_DEV_TOKEN` set **and** `NODE_ENV !== 'production'`
- Tests per §8a (service-layer unit + MCP-tool with mocked services)

**Exit:** tools callable from a local MCP client; `npm run check` green.

**Plan doc:** _not yet authored_
**Manual test:** to be posted as a slot comment when landed.

---

### Phase 2 — OAuth Authorization Server + approval-gated verification + deploy 🔲

**Status:** Not started · **Spec:** §6.2, §6.4, §9, §10, §11 · **⚠️ Highest-risk phase (hand-rolled OAuth 2.1 AS)**

Implement the OAuth Authorization Server, the `verifyToken` resource-server gate, the
`mcp*` collections, and deploy — turning the dev-token connector into a real self-serve
Claude Connector.

**Planned deliverables:**

- AS endpoints (§6.2): `/.well-known/oauth-protected-resource` (RFC 9728), `/.well-known/oauth-authorization-server` (RFC 8414), `/api/mcp/oauth/{register,authorize,token,revoke}`
- Hardening already specified: PKCE S256-only, server-verified `state`, DCR rate-limit + `redirect_uri` allowlist/byte-match, atomic single-use auth codes + client binding, refresh rotation (atomic) + reuse-detection + idle expiry, hashed tokens (incl. refresh) + CSPRNG, RFC 8707 audience, `iss` (RFC 9207), PKCE-downgrade rejection, token-passthrough prohibition, at-use expiry (not TTL), three-point approval gating, consent screen (CS1, defense-in-depth)
- `verifyToken` (§6.4) — owns all security logic (hash lookup, `tokenType:'access'` only, `revokedAt`, audience, live `users` approval lookup)
- New collections (§9): `mcpClients`, `mcpAuthCodes`, `mcpTokens`, `mcpAuthStates`, `mcpConsents`; indexes + `dropAllIndexes()` update
- Consent screen — minimal responsive server-rendered page (only new connector UI)
- Tests per §8a (verifyToken, all AS endpoints, consent paths)

**Exit checklist:** Phase 1 dev-token path removed/inert in production (verified by §8a integration test) **before deploy**; an approved user can add the connector in Claude and use recipes + food items.

**Open questions to resolve here:** how the programmatic AS authorize→login→callback threads through NextAuth v4 + Google (vs. a direct OIDC client — see Bojan's `mcp-paprika`); re-check the 2025-11-25 MCP auth revision; OAuth protocol error-code constants (L5-code-001); Vercel clock-skew + signing-secret management.

**Plan doc:** _not yet authored_
**Manual test:** to be posted as a slot comment when landed.

---

### Phase 3 — `recipe-import` skill 🔲

**Status:** Not started · **Spec:** §6.6, §7 · **Closes #56**

A distributable, installable Claude skill that orchestrates the Phase 1–2 tools with an
in-chat human review step. The motivating use case.

**Planned deliverables:**

- `SKILL.md` + supporting files — parse a recipe URL/PDF (via Claude's native file/URL reading), fuzzy-match ingredients to the user's food-item catalog, confirm mappings in chat, create new food items, assemble + save the recipe
- Installable/customizable in Claude

**Exit:** give Claude a recipe link/PDF → reviewed, correctly-structured recipe saved via the connector.

**Plan doc:** _not yet authored_
**Manual test:** to be posted as a slot comment when landed.

---

### Phase 4 — Remaining domains 🔲

**Status:** Not started · **Spec:** §6.5 (later domains), §11

Repeat the Phase-1 service-extraction + tool-registration pattern for the rest of the app,
yielding the full read/write tool surface.

**Planned deliverables:**

- `src/lib/services/meal-plans.ts`, `pantry.ts`, `shopping-lists.ts` + route refactors
- MCP tools (read + write) for meal plans, pantry, shopping lists
- Tests per §8a pattern

**Exit:** full read/write tool surface across all domains; `npm run check` green.

**Plan doc:** _not yet authored_
**Manual test:** to be posted as a slot comment when landed.
