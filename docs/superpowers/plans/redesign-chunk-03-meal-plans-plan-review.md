# Review — Chunk 3 Meal Plans Plan

**Verdict (initial): REVISE BEFORE IMPLEMENTING** — 0 Critical, 4 Important, 5 Minor.
**Status: all 9 findings fixed in the plan (2026-05-28).** Re-verdict: **PLAN READY.**

Dispatched the four `/review-code` specialists (architecture, security, test, code) against the plan doc. Security returned clean (verified `PUT /api/meal-plans/[id]` scopes the write by `userId` server-side, so the client-side items-rebuild in Task 14 carries no IDOR risk; no new endpoints; no schema change).

## Important (fixed)

- **[Architecture] `addGroup` derived `searchTarget` from a stale `draft.items.length` closure** (Task 12). Under React 19 batching the closure can lag the committed state, routing subsequent group-adds to the wrong index. → Fixed: index is now computed inside the `setDraft` updater and applied via a `pendingTargetRef` + `useEffect`.
- **[Code] `getMealDayLabel` does not exist** (Task 14 wiring). → Fixed: use `getDateForDay` (exists at `page.tsx:660`, already in scope).
- **[Test] Three component tests stubbed `global.fetch` while MSW is globally active** (CombinedSearch, MealEditorDialog, MealPlanViewDialog) — violates the CLAUDE.md fetch-mocking gotcha. → Fixed: switched to MSW `server.use()` (CombinedSearch) / rely on the global handlers (the dialogs); `server` is exported from `vitest.setup.ts:71`.
- **[Test] Decision 3 ("no per-meal notes UI") claimed covered but had no assertion.** → Fixed: added a `queryByLabelText/queryByPlaceholderText(/notes/i)` negative assertion to Task 12.
- **[Test] `QtyEditor`/`UnitEditor` desktop `Popover` branch never tested** (jsdom `useMediaQuery` → false, only the `Drawer` path ran). → Fixed: added a `matchMedia`-mocked desktop-branch test to each.

## Minor (fixed)

- **[Architecture] `PlanViewProps` defined in `PlanViewMobile`, imported by sibling `PlanViewDesktop`.** → Moved to `meal-display-utils.ts`; both views import it from there.
- **[Architecture] Preamble claimed `useQuantityInput` reused verbatim**, contradicting Task 9's bespoke numpad. → Preamble corrected.
- **[Test] Unused `rerender` destructure** in the decision-1 test. → Removed.
- **[Test] Ambiguous `/skip/i` selector** collided with the "Skip this meal" toggle label. → Skip-clear confirm button relabeled **"Skip anyway"** and queried exactly.

## Not flagged (verified sound)

- Self-contained B3 editor under `src/components/meal-plans/` rather than reusing `IngredientInput`/`IngredientGroup` — justified (recipes/chunk 4 still depend on those; B3's qty-chip/unit-chip/combined-search interaction is fundamentally different).
- Dual-mount responsive plan view (desktop + mobile both in DOM, CSS-toggled) — matches the existing project pattern.
- No write-logic drift: same `updateMealPlan({ items })` / `updateMealPlanTemplate({ weeklyStaples })` payloads; food-item creation reuses `useFoodItemCreator` unchanged.

---

## Round 2 (after the plan-detail-as-route restructure)

**Verdict: REVISE BEFORE IMPLEMENTING** — 0 Critical, 4 Important, 3 Minor/Nit. **All fixed.** Re-verdict: **PLAN READY.** Security clean again (verified `GET/PUT/DELETE /api/meal-plans/[id]` gate on `isOwner || hasSharedAccess`; the route is reachable by navigating to the `[id]` page but server-side scoping holds; the new Past-6-weeks read is `userId`-scoped; the old-URL redirect uses a path segment, not an open redirect).

### Important (fixed)

- **[Test] `[id]/loading.tsx` + `[id]/error.tsx` had no tests.** Project convention = every route has them (the index does). → Added `src/app/meal-plans/[id]/__tests__/{loading,error}.test.tsx` to Task 13.
- **[Code/Test] `error.tsx` ambiguity — could wrap `AuthenticatedLayout`.** That calls `useSession` during an error render. → Task 13 + File Structure now state explicitly: `loading.tsx` wraps `AuthenticatedLayout`, `error.tsx` does NOT (mirror existing index `error.tsx`).
- **[Test] `matchMedia` stub cleaned up inline, not in `afterEach`** (the round-1 desktop-popover tests) — a failed assertion would leak it. → Moved `vi.unstubAllGlobals()` into `afterEach` for `QtyEditor`/`UnitEditor` tests.
- **[Code] Helper move under-specified** — `PlanDetail` calls `getDaysInOrder`/`getDateForDay` but the plan didn't show the export/import. → Task 13 Step 3 now gives explicit signatures + the `import … from './meal-display-utils'` line.

### Minor / Nit (fixed)

- **[Arch] `routeAdd` read `searchTarget` from the closure inside `setDraft`** — same stale-state class as the round-1 `addGroup` fix (lower risk, but cheap to close). → Added a `searchTargetRef` mirrored from state; `routeAdd` reads the ref.
- **[Test] Task 14 `page.test.tsx` rewrite was prose-only** — risked dropping `afterEach(cleanup)`. → Added an explicit requirement (cleanup + `next/navigation` mock).
- **[Test] `Object.keys(putBody)).toEqual(['items'])` brittle on key order.** → `toHaveLength(1)` + `toHaveProperty('items')`.
- **[Nit/Arch] `MEAL_LETTER_LOCAL` duplicated `MEAL_LETTER`.** → Import the shared one; local map deleted.

### Dismissed (verified non-issues)

- `AddFoodItemDialog` `onAdd` prop (flagged "Critical") — verified `onAdd` is the real prop name. Plan is correct.
- `AuthenticatedLayout` default import / `SessionProvider` availability — matches every existing page; fine.
- DELETE route `deleteOne({ _id })` without a `userId` in the _filter_ — pre-existing; the handler already 403s non-owner/non-shared above it, and shared-edit-can-delete matches the sharing model. Not introduced by this chunk; out of diff-scope.
