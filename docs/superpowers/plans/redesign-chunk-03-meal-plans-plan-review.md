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
