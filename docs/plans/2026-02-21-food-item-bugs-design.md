# Food Item Search, Duplicate Errors & Deconfliction Bugs

**Date:** 2026-02-21

## Problem

Four related bugs share a common root: error responses and data-fetching results are silently swallowed or never reach the user.

1. **Shopping list typeahead broken.** `ItemEditorDialog` uses client-side filtering against a pre-loaded 1000-item array. Items beyond position 1000 are invisible, and the search has no loading indicator.

2. **Duplicate food item creation fails silently.** `AddFoodItemDialog` calls `await onAdd(...)` without try/catch. A 409 response produces an unhandled rejection. The user sees no error message.

3. **Deconfliction dialog shows "Unknown" food item names.** The conflict resolution UI builds names from a `foodItemsMap` capped at 1000 entries. Any item beyond the cap shows "Unknown."

4. **No rollback after failed conflict resolution save.** `handleApplyConflictResolutions` updates local state before the database write. A failed save leaves the UI and server out of sync.

## Architecture Diagnosis

The codebase has two independent food-item search implementations:

| Dimension | `FoodItemAutocomplete` (meals, pantry) | `ItemEditorDialog` (shopping list) |
|---|---|---|
| Search | Server-side `/api/food-items?query=...&limit=50` | Client-side `createFilterOptions()` on pre-loaded array |
| Hook | `useFoodItemSelector` | None |
| Loading indicator | CircularProgress spinner | None |
| Scalability | Any catalog size | Breaks past 1000 items |

The duplicate-creation error chain breaks at two points:
- `AddFoodItemDialog.handleSubmit` has no try/catch around `await onAdd(...)`
- `FoodItemAutocomplete.handleCreate` discards `creator.error` (never reads it)

## Fixes

### Fix 1 — Refactor ItemEditorDialog to use `useFoodItemSelector`

Replace the inline `<Autocomplete>` with `useFoodItemSelector` for server-side search. Keep the existing dialog layout. Remove the `foodItems` prop and the parent page's `loadFoodItems` function.

**Files changed:**
- `src/components/shopping-list/ItemEditorDialog.tsx` — replace Autocomplete internals
- `src/app/shopping-lists/page.tsx` — remove `loadFoodItems`, `foodItems` state, and prop passing

### Fix 2 — Surface duplicate-creation errors in AddFoodItemDialog

Wrap `await onAdd(...)` in try/catch. On error, set the dialog's existing `error` state. Do not reset form fields on failure.

**Files changed:**
- `src/components/AddFoodItemDialog.tsx` — add try/catch in `handleSubmit`

### Fix 3 — Resolve food item names from extracted data in deconfliction

Use the `foodItemName` already present on `ExtractedItem` when building `UnitConflict[]`. Fall back to querying individual items if unavailable.

**Files changed:**
- `src/app/shopping-lists/page.tsx` — change conflict-building logic
- `src/lib/meal-plan-to-shopping-list.ts` — ensure `foodItemName` propagates through `combineExtractedItems`

### Fix 4 — Add rollback on failed conflict resolution save

Capture `previousItems` before mutation. Restore on database error.

**Files changed:**
- `src/app/shopping-lists/page.tsx` — add rollback in `handleApplyConflictResolutions`
