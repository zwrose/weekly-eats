# Plan: Smart Unit Deconfliction for Shopping List Meal Plan Population

## Phase 1: Unit Conversion Utility Module [checkpoint: 3455203]

- [x] Task: Install `convert` npm package [f8b385c]
  - Run `npm install convert` in the worktree
  - Verify it appears in `package.json` dependencies

- [x] Task: Create unit conversion utility with TDD [425b23b]
  - **Test first** (`src/lib/__tests__/unit-conversion.test.ts`):
    - `toConvertUnit`: maps app unit names (e.g., `'cup'`, `'tablespoon'`, `'pound'`) to `convert` library identifiers; returns `null` for unmappable units (e.g., `'can'`, `'bag'`, `'piece'`)
    - `areSameFamily`: returns `true` for same-family pairs (cup/gallon, ounce/pound); `false` for cross-family (cup/pound) and non-convertible (can/bag)
    - `tryConvert`: converts `(2, 'cup', 'tablespoon')` → `32`; returns `null` for non-convertible pairs
    - `pickBestUnit`: picks human-readable unit (e.g., `(2000, 'teaspoon')` → something like `~2.6 gallons`, not 2000 tsp); targets range ~0.25–50; returns original unit for non-convertible
    - Edge cases: unknown units, zero quantity, same-unit no-op
  - **Implement** (`src/lib/unit-conversion.ts`):
    - `UNIT_MAP`: Record mapping app singular unit names → `convert` library unit strings (volume: teaspoon, tablespoon, fluid ounce, cup, pint, quart, gallon, milliliter, liter; weight: gram, kilogram, ounce, pound)
    - `toConvertUnit(appUnit: string): string | null`
    - `areSameFamily(unitA: string, unitB: string): boolean` — uses `getMeasureKind` from `convert`
    - `tryConvert(quantity: number, fromUnit: string, toUnit: string): number | null`
    - `pickBestUnit(quantity: number, unit: string): { quantity: number; unit: string }` — converts to `'best'` with `'imperial'` preference, then maps back to app unit names; falls back to original if unmappable
  - **Refactor**: ensure all functions are pure, well-typed, exported

## Phase 2: Smart Pre-Merge of Extracted Items [checkpoint: b22264a]

- [x] Task: Rewrite `combineExtractedItems` with conversion intelligence (TDD) [ec0690f]
  - **Test first** (update `src/lib/__tests__/meal-plan-to-shopping-list.test.ts`):
    - Same unit, same food item → sum quantities (existing behavior, keep passing)
    - Convertible units, same food item (e.g., 2 cups + 1 pint of f1) → converts to best unit and sums
    - Non-convertible units, same food item (e.g., 2 cans + 1 pound of f1) → returns conflict
    - Mixed: some items convertible, some not, some single-entry
    - Three+ different convertible units for same food item → all converted and summed
  - **Implement**: update `combineExtractedItems` in `src/lib/meal-plan-to-shopping-list.ts`:
    - Group by `foodItemId` (existing)
    - For each group with multiple units: check if all are in the same family via `areSameFamily`
    - If same family: convert all to a common unit using `tryConvert`, pick best unit via `pickBestUnit`, sum quantities
    - If not same family: flag as conflict (return in conflicts map)
    - Update return type: conflicts now contain pre-combined entries with their original breakdown for display

- [x] Task: Wire `combineExtractedItems` into the production flow [6dfe049]
  - **Test first** (update test for `handleAddItemsFromMealPlans` flow or add integration-style test):
    - Mock extracted items with convertible duplicates → verify they arrive at `mergeWithShoppingList` already combined
  - **Implement**: in `src/app/shopping-lists/page.tsx` `handleAddItemsFromMealPlans`:
    - After `extractFoodItemsFromMealPlans(selectedPlans)` and before `mergeWithShoppingList`, call `combineExtractedItems(extractedItems)`
    - Pass `combinedItems` (not raw `extractedItems`) to `mergeWithShoppingList`
    - Handle pre-merge conflicts from `combineExtractedItems` — add them to the conflict list shown to the user

## Phase 3: Conversion-Aware Merge with Existing Shopping List [checkpoint: b7bd87f]

- [x] Task: Update `mergeWithShoppingList` to attempt conversion before flagging conflicts (TDD) [ab13309]
  - **Test first** (update `src/lib/__tests__/meal-plan-to-shopping-list.test.ts`):
    - Existing item in cups + extracted item in tablespoons → auto-converts and pre-fills conflict with combined quantity in best unit
    - Existing item in cans + extracted item in pounds → non-convertible conflict (manual, existing behavior)
    - Existing item in cups + extracted item in cups → sums silently (existing behavior, keep passing)
    - New item not in existing list → adds directly (existing behavior, keep passing)
  - **Implement**: update `mergeWithShoppingList` in `src/lib/meal-plan-to-shopping-list.ts`:
    - When units differ: call `areSameFamily(existing.unit, extracted.unit)`
    - If same family: convert extracted to existing's unit via `tryConvert`, pick best unit via `pickBestUnit` for the total, create a `UnitConflict` with `isAutoConverted: true` and pre-filled `suggestedQuantity`/`suggestedUnit`
    - If not same family: create `UnitConflict` with `isAutoConverted: false` (existing behavior)
  - **Update `UnitConflict` interface**: add `isAutoConverted: boolean`, `suggestedQuantity?: number`, `suggestedUnit?: string`

## Phase 4: Enhanced Conflict Resolution Dialog and Test Data [checkpoint: 33ce44e]

- [x] Task: Seed test meal plan and recipes in the worktree database for manual verification [efbb078]
  - Create a seed script (`scripts/seed-deconfliction-test-data.cjs`) that inserts into the worktree's database:
    - **Food items**: Milk (default unit: gallon), Flour (default unit: pound), Canned Tomatoes (default unit: can)
    - **Recipe A** ("Pancakes"): uses 2 cups milk, 3 cups flour
    - **Recipe B** ("Béchamel Sauce"): uses 1 pint milk, 8 tablespoons flour (a.k.a. 0.5 cups)
    - **Recipe C** ("Pasta Sauce"): uses 2 cans tomatoes, 1 pound tomatoes (non-convertible conflict)
    - **Meal plan** ("Deconfliction Test Week"): includes Recipe A (Mon dinner), Recipe B (Tue dinner), Recipe C (Wed dinner)
    - **Store** with an empty shopping list to populate from the meal plan
  - This creates clear test scenarios:
    - Milk: 2 cups + 1 pint → convertible, should auto-merge to ~3 cups
    - Flour: 3 cups + 8 tablespoons → convertible, should auto-merge to ~3.5 cups
    - Tomatoes: 2 cans + 1 pound → non-convertible, should show manual conflict
  - Run the seed script against the worktree database (`weekly-eats-feature-smart-unit-deconfliction`)

- [x] Task: Update conflict dialog to show pre-filled values for auto-converted conflicts [1f28669, 069e185, 03879a7]
  - **Implement** in `src/app/shopping-lists/page.tsx`:
    - Update `getCurrentConflictResolution` to default to `suggestedQuantity`/`suggestedUnit` for auto-converted conflicts (instead of defaulting to existing values)
    - For auto-converted conflicts: show a Chip or Typography note like "Auto-converted: 2 cups + 1 pint = 3 cups" above the quantity/unit inputs
    - For non-convertible conflicts: keep existing "different units" Alert (no change)
    - User can still modify the pre-filled quantity and unit via the existing inputs
  - **Test**: component-level test or manual verification that:
    - Auto-converted conflicts show pre-filled combined values
    - Non-convertible conflicts show existing behavior
    - User can change pre-filled values

- [x] Task: Conductor - User Manual Verification 'Phase 4' [33ce44e]

## Phase 5: Cleanup and Final Validation [checkpoint: 33ce44e]

- [x] Task: Remove dead code paths and ensure type safety
  - Reviewed all files — no dead code paths, all types properly defined
  - `mergeWithShoppingList` still exported and tested but no longer used in main flow
  - No unused imports remain in page.tsx

- [x] Task: Run full validation suite (`npm run check`) and verify coverage
  - `unit-conversion.ts`: 93.39% statements, 86.36% branches, 100% functions
  - `meal-plan-to-shopping-list.ts`: 91.8% statements, 100% functions
  - 602 tests pass, lint clean, build succeeds
