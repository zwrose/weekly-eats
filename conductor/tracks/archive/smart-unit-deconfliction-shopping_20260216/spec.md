# Spec: Smart Unit Deconfliction for Shopping List Meal Plan Population

## Overview

When populating a shopping list from meal plans, the same food item can appear across multiple recipes with different units (e.g., "2 cups milk" from one recipe and "0.5 gallon milk" from another). The current workflow has no unit conversion intelligence — it presents raw conflicts to the user one-by-one and asks them to manually resolve each. Additionally, the pre-merge step (`combineExtractedItems`) that should consolidate extracted items before comparing to the existing shopping list is dead code and never called.

This track adds intelligent unit conversion using the [`convert`](https://github.com/jonahsnider/convert) library, pre-merges extracted items before comparing to the shopping list, and ensures at most one deconfliction prompt per food item.

## Functional Requirements

### FR-1: Install and integrate `convert` library

- Add the `convert` npm package as a project dependency.
- Create a unit conversion utility module (`src/lib/unit-conversion.ts`) that:
  - Maps the app's `FOOD_UNITS` unit names to `convert` library unit identifiers where a mapping exists (volume and weight families).
  - Exposes a `tryConvert(quantity, fromUnit, toUnit)` function that returns the converted quantity or `null` if the units are not in the same family.
  - Exposes a `areSameFamily(unitA, unitB)` function that checks whether two units belong to the same measurement family (both volume, both weight).
  - Exposes a `pickBestUnit(quantity, unit)` function that converts the given quantity+unit to the most human-readable unit in the same family (targeting a result in the range ~0.25–50 to avoid absurd quantities like "2000 teaspoons"). Uses the `convert` library's `to("best", "imperial")` for volume/weight and falls back to the original unit for non-convertible units.

### FR-2: Pre-merge extracted items with conversion intelligence

- Wire up and rewrite `combineExtractedItems` in `src/lib/meal-plan-to-shopping-list.ts` so it is actually called during the meal plan population flow.
- The pre-merge step runs after `extractFoodItemsFromMealPlans` and before `mergeWithShoppingList`.
- For each group of extracted items sharing the same `foodItemId`:
  - **Same unit:** Sum quantities (existing behavior).
  - **Convertible units (same family):** Convert all to the best human-readable unit, then sum.
  - **Non-convertible units (different families or countable units like "can", "bag"):** Flag as a conflict — these still require user resolution.
- Output: a single consolidated `ExtractedItem` per food item (or a conflict entry when conversion is not possible).

### FR-3: Update `mergeWithShoppingList` to use conversion

- When merging consolidated extracted items with the existing shopping list:
  - **Same unit:** Sum quantities (existing behavior, unchanged).
  - **Convertible units:** Convert the extracted item's quantity into the existing item's unit family, pick the best human-readable unit, and pre-fill the resolution. Mark as a "convertible conflict" (for pre-filled resolution in the dialog).
  - **Non-convertible units:** Mark as a "manual conflict" (existing behavior).

### FR-4: Enhanced conflict resolution dialog

- The existing conflict resolution dialog (`UnitConflictDialog` in the shopping list page) is updated:
  - **Convertible conflicts** show the pre-filled combined quantity and best unit. The user can adjust the unit (via the existing autocomplete dropdown) and quantity before confirming.
  - **Non-convertible conflicts** behave as today: show both values, user picks manually.
  - A visual indicator distinguishes auto-converted entries from manual ones (e.g., a small "auto-converted" chip or note showing the original values).
  - The dialog still steps through conflicts one-by-one, but now there is at most **one conflict per food item** (thanks to FR-2 pre-merge).

### FR-5: Guarantee at most one deconfliction per food item

- The combination of FR-2 (pre-merge extracted items) and FR-3 (merge with existing list) ensures each food item appears at most once in the conflict resolution dialog.
- If a food item has entries from 3 recipes in 3 different units, the pre-merge step consolidates them into one entry first, then the merge step compares that single entry against the existing shopping list.

## Non-Functional Requirements

- **NFR-1:** Unit conversion logic must be pure functions with no side effects, easily testable in isolation.
- **NFR-2:** The `convert` library is tree-shakeable and lightweight (~4KB gzip). Bundle size impact should be minimal.
- **NFR-3:** Conversion mappings should only cover volume and weight families. Countable/container units (can, bag, piece, slice, bunch, etc.) are never auto-converted.
- **NFR-4:** When the `convert` library cannot handle a unit (not in its registry), the system falls back gracefully to manual conflict resolution — no errors thrown.
- **NFR-5:** All new code must have >80% test coverage.

## Acceptance Criteria

1. **AC-1:** When adding items from meal plans where the same food item appears in two recipes with convertible units (e.g., "2 cups milk" + "1 pint milk"), the system automatically converts and sums them, showing a single pre-filled conflict with the best unit (e.g., "3 cups milk").
2. **AC-2:** When the same food item appears with non-convertible units (e.g., "2 cans tomatoes" + "1 pound tomatoes"), the system shows a manual conflict dialog as it does today.
3. **AC-3:** No food item appears more than once in the conflict resolution dialog.
4. **AC-4:** The user can change the pre-filled unit in the conflict dialog to any other unit (existing behavior preserved).
5. **AC-5:** When all extracted items for a food item share the same unit, they are silently summed with no conflict shown (existing behavior, now also works across multiple recipes).
6. **AC-6:** The `combineExtractedItems` function is actively called in the production flow, not dead code.

## Out of Scope

- **Cross-family conversion** (weight-to-volume or vice versa) using density tables — this would require per-food-item density data that doesn't exist in the data model.
- **Changes to the food item data model** — no new fields added to food items.
- **Automatic conversion without user confirmation** — convertible conflicts still show the pre-filled dialog for user review.
- **Recipe-level unit normalization** — recipes keep their ingredient units as-is; conversion only happens during shopping list population.
- **Shopping list UI changes** beyond the conflict dialog enhancements.
