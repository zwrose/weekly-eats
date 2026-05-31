# Phase 1 Plan — Review Annotations

**Target:** `docs/superpowers/plans/2026-05-30-mcp-phase-1-service-tools-plan.md`
**Method:** `/review-plan` — 4 specialists (architecture, security, test, code) in parallel per loop.
**Verdict: PLAN READY** (converged over 3 loops).

## Convergence

| Loop | Architecture    | Security        | Test                | Code                                           | Net result                                   |
| ---- | --------------- | --------------- | ------------------- | ---------------------------------------------- | -------------------------------------------- |
| 1    | 0C/0I/3Min/1Nit | 0C/0I/1Min      | **0C/2I**/2Min      | 0C/0I (code agent mis-targeted; re-run loop 2) | **2 Important** → REVISE                     |
| 2    | 0C/0I/2Min/1Nit | 0C/0I/2Min/1Nit | 0C/**1I**/3Min/1Nit | 0C/0I/2Min/2Nit                                | 1 hedged-Important (verify-this) → folded in |
| 3    | **[]**          | **[]**          | **[]**              | **[]**                                         | **PLAN READY (clean)**                       |

(Loop-1 note: the explorer agents used for that loop lacked a Write tool and returned findings as text; the code agent additionally mis-resolved its session path and reviewed the design spec instead of the plan. Loops 2-3 used Write-capable general-purpose agents with a fixed session path — findings landed as JSON. No load-bearing finding was lost; the code dimension was fully covered in loops 2-3.)

## Important findings resolved

**L1 / Test — Recipe service had no ownership-rejection test; self-review falsely claimed `ForbiddenError` coverage for the recipe domain.**
Resolved: the recipe domain folds "not owned / not visible" into `NotFoundError` **by design** (mirrors the existing route's `RECIPE_ERRORS.NO_PERMISSION_TO_EDIT`). Added explicit ownership-rejection tests to `getRecipe` and `updateRecipe` that assert `NotFoundError` **and** that the query is scoped (`$or` visibility predicate for get; `createdBy` for update). Corrected the self-review to state the by-design distinction (only the food-item domain uses `ForbiddenError`).

**L1 / Test — `getRecipe`/`updateRecipe` tests didn't assert the userId-scoping filter argument.**
Resolved: the new ownership tests assert the actual filter object passed to `findOne`, so a regression that drops the scoping predicate is caught.

**L2 / Test — `getRecipe` name-resolution test under-specified the two-collection mock (hedged "verify the mock branches").**
Verified the recipe service test mock already branches `collection('foodItems')` vs the rest, and `resetChain()`/`beforeEach` reset `foodItemsFindMock`. Hardened the test anyway: it now asserts `foodItemsFindMock` was called with the `$in` of the ingredient id — proving name resolution rather than coincidental presence. Loop 3 confirmed clean.

## Minor / Nit items folded in

- **404→401 on unknown `/api/*` paths** (top-level `[transport]` catch-all): documented as an accepted side-effect in Scope & decisions, with the nest-under-`/api/mcp` escape hatch.
- **GET vs PUT/DELETE malformed-id message inconsistency** on `food-items/[id]`: documented as accepted (PUT/DELETE keep route-specific permission logic inline in Phase 1; converges in Phase 4). Same 400 status; existing tests assert status only.
- **`getAuthContext` error semantics**: now `ForbiddenError` + `AUTH_ERRORS.FORBIDDEN` (type and message agree).
- **`verify-token` test env handling**: switched to `vi.stubEnv` / `vi.unstubAllEnvs` (singleFork-safe), added the `MCP_DEV_USER_ID`-absent case (6 tests total).
- **Transport-route auth-wiring test**: added as optional Task 11 Step 8 (401-on-missing/wrong-bearer), with a skip clause so it can't become a rabbit hole.
- **Tool success-shape + ValidationError-through-tool** assertions added.

## Items reviewed and intentionally NOT changed (with rationale)

- **`as never` casts on tool registration** — justified in the plan (bridges precise handler types to the SDK's broad `registerTool` signature; not an `any` on data). Acceptable.
- **`createdBy` of shared/global items in tool results** — consistent with what the existing HTTP API already returns; not a new exposure.
- **Tool `limit`** — already clamped by `z.number().max(100)` on both tool input schemas.
- **`updateRecipe` find-then-update** — intentional (returns a proper `NotFoundError` and the updated doc).
- **Pre-existing literal** "Group titles are required for non-standalone ingredient groups" — carried over verbatim from existing route code, not a new hardcoded-string violation.

## Owed at code time (not plan-time)

Per the spec's reviewer-reliability note: code-time `/code-review` (or `/code-review ultra`) on the implemented branch, plus the usual `npm run check`. (Phase 2 — the OAuth surface — additionally owes a human security pass.)
