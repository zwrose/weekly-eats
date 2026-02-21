# Food Item Bugs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix four related bugs: shopping list typeahead (DRY refactor), silent duplicate food item creation, "Unknown" names in deconfliction, and missing rollback on conflict resolution save failure.

**Architecture:** Unify food item search by replacing `ItemEditorDialog`'s bespoke client-side Autocomplete with `useFoodItemSelector` (server-side search). Fix `AddFoodItemDialog`'s missing error propagation. Harden the deconfliction flow's name resolution and save rollback.

**Tech Stack:** React 19, MUI v7 Autocomplete, `useFoodItemSelector` hook, Next.js API routes, Vitest + RTL

---

### Task 1: Fix AddFoodItemDialog silent error swallowing

The simplest, most isolated fix. Unblocks duplicate-error surfacing for both `FoodItemAutocomplete` and `ItemEditorDialog` consumers.

**Files:**
- Modify: `src/components/AddFoodItemDialog.tsx:69-116`
- Test: `src/components/__tests__/AddFoodItemDialog.test.tsx`

**Step 1: Write the failing test**

Add to `AddFoodItemDialog.test.tsx`:

```tsx
it('shows error when onAdd rejects with an error', async () => {
  const user = userEvent.setup();
  const failingAdd = vi.fn().mockRejectedValue(new Error('Food item already exists'));

  render(
    <AddFoodItemDialog open onClose={handleClose} onAdd={failingAdd} />
  );

  // Fill form
  await user.type(screen.getByLabelText(/default name/i), 'Flour');
  await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByRole('option', { name: /cup/i }));

  // Submit
  await user.click(screen.getByRole('button', { name: /add food item/i }));

  // Error should be displayed
  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('Food item already exists');
  });

  // Form fields should NOT be reset (user's data preserved)
  expect(screen.getByLabelText(/default name/i)).toHaveValue('Flour');
});

it('clears error and resets form on successful onAdd', async () => {
  const user = userEvent.setup();
  // First call fails, second succeeds
  const onAdd = vi.fn()
    .mockRejectedValueOnce(new Error('Food item already exists'))
    .mockResolvedValueOnce(undefined);

  render(
    <AddFoodItemDialog open onClose={handleClose} onAdd={onAdd} />
  );

  // Fill form
  await user.type(screen.getByLabelText(/default name/i), 'Flour');
  await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByRole('option', { name: /cup/i }));

  // First submit — fails
  await user.click(screen.getByRole('button', { name: /add food item/i }));
  await waitFor(() => {
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  // Second submit — succeeds
  await user.click(screen.getByRole('button', { name: /add food item/i }));
  await waitFor(() => {
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // Form should be reset after success
  expect(screen.getByLabelText(/default name/i)).toHaveValue('');
});
```

**Step 2: Run tests to verify they fail**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/__tests__/AddFoodItemDialog.test.tsx -v`
Expected: 2 new tests FAIL (no try/catch, error not shown, form resets regardless)

**Step 3: Implement the fix**

In `src/components/AddFoodItemDialog.tsx`, replace `handleSubmit` (lines 69-116) with:

```tsx
const handleSubmit = async () => {
  // Validate required fields
  if (!name.trim()) {
    setError('Food item name is required');
    return;
  }
  if (!unit) {
    setError('Unit is required');
    return;
  }

  // If unit is "each", validate singular/plural names
  if (unit === 'each') {
    if (!singularName.trim() || !pluralName.trim()) {
      setError('Both singular and plural names are required');
      return;
    }
  }

  const payload = unit === 'each'
    ? {
        name: singularName.trim(),
        singularName: singularName.trim(),
        pluralName: pluralName.trim(),
        unit,
        isGlobal,
        addToPantry,
      }
    : {
        name: name.trim(),
        singularName: name.trim(),
        pluralName: name.trim(),
        unit,
        isGlobal,
        addToPantry,
      };

  try {
    await onAdd(payload);
    // Reset form only on success
    setName('');
    setUnit(null);
    setIsGlobal(true);
    setAddToPantry(false);
    setError('');
    setSingularName('');
    setPluralName('');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to add food item');
  }
};
```

**Step 4: Run tests to verify they pass**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/__tests__/AddFoodItemDialog.test.tsx -v`
Expected: ALL tests PASS

**Step 5: Commit**

```bash
git add src/components/AddFoodItemDialog.tsx src/components/__tests__/AddFoodItemDialog.test.tsx
git commit -m "fix: surface onAdd errors in AddFoodItemDialog instead of swallowing"
```

---

### Task 2: Refactor ItemEditorDialog to use useFoodItemSelector

Replace the bespoke client-side `Autocomplete` with `useFoodItemSelector` for server-side search. This is the largest change — keep the dialog layout identical, only swap the search internals.

**Files:**
- Modify: `src/components/shopping-list/ItemEditorDialog.tsx`
- Test: `src/components/shopping-list/__tests__/ItemEditorDialog.test.tsx`

**Step 1: Update ItemEditorDialog to use useFoodItemSelector**

Replace the entire `ItemEditorDialog.tsx` file. Key changes:
- Remove `foodItems` prop — the hook fetches its own data
- Remove `createFilterOptions` import and `defaultFilter`
- Remove `FoodItemOption` type export (use `FoodItem` from the hook instead)
- Add `useFoodItemSelector` and `useFoodItemCreator` hooks
- Add `CircularProgress` for loading state
- Keep `excludeFoodItemIds`, quantity/unit inputs, save/delete, keyboard inset logic
- Use `useFoodItemCreator` for the AddFoodItemDialog integration (replaces inline `handleCreateFoodItem`)

Important interface changes:
- Remove `foodItems: FoodItemOption[]` from props
- Remove `onFoodItemCreated` callback — the hook handles refresh internally
- Keep `excludeFoodItemIds`, `initialDraft`, `onClose`, `onSave`, `onDelete`
- Add `onFoodItemAdded` callback for parent to refresh its food items state if needed

The Autocomplete should:
- Use `selector.options` for options (already filtered by hook)
- Use `selector.isLoading` for loading state
- Show `loadingText` with CircularProgress spinner
- Append "Add New" option when `selector.inputValue.trim()` and not loading
- Handle selection by setting local `selectedFoodItem` state
- Use `useFoodItemCreator` for creation, with auto-select of newly created items

When a food item is selected from the autocomplete:
- Set `selectedFoodItem` to the selected item
- Set `foodItemInputValue` to the item name
- Auto-set unit if the user hasn't manually changed it (`hasTouchedUnitRef`)

When the Save button is clicked:
- If `selectedFoodItem` exists, call `onSave` with `{ foodItemId, quantity, unit }`
- If no selection but text is entered (freeSolo), open creation dialog with pending save

**Step 2: Update the test file**

Replace `ItemEditorDialog.test.tsx`. The tests can no longer pass `foodItems` as a prop. Instead, mock the API responses that `useFoodItemSelector` will call.

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ItemEditorDialog from "../ItemEditorDialog";

const mockFetch = vi.fn();

describe("ItemEditorDialog", () => {
  const defaultProps = {
    open: true,
    mode: "add" as const,
    excludeFoodItemIds: [] as string[],
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);

    // Default: return food items for search queries
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/food-items") && url.includes("query=")) {
        const queryMatch = url.match(/query=([^&]*)/);
        const query = queryMatch ? decodeURIComponent(queryMatch[1]).toLowerCase() : "";
        const allItems = [
          { _id: "f1", name: "Apple", singularName: "Apple", pluralName: "Apples", unit: "each" },
          { _id: "f2", name: "Banana", singularName: "Banana", pluralName: "Bananas", unit: "each" },
        ];
        const filtered = allItems.filter(
          (i) =>
            i.name.toLowerCase().includes(query) ||
            i.singularName.toLowerCase().includes(query) ||
            i.pluralName.toLowerCase().includes(query),
        );
        return Promise.resolve({ ok: true, json: async () => filtered });
      }
      if (url.includes("/api/food-items")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              { _id: "f1", name: "Apple", singularName: "Apple", pluralName: "Apples", unit: "each" },
              { _id: "f2", name: "Banana", singularName: "Banana", pluralName: "Bananas", unit: "each" },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  function getItemNameInput() {
    return screen.getByRole("combobox", { name: /item name/i });
  }

  it('shows "Add as a Food Item" option when input has no exact matches', async () => {
    const user = userEvent.setup();
    render(<ItemEditorDialog {...defaultProps} />);

    const input = getItemNameInput();
    await user.type(input, "Zucchini");

    await waitFor(
      () => {
        expect(
          screen.getByRole("button", { name: /add "zucchini" as a food item/i }),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("shows matching results from server-side search", async () => {
    const user = userEvent.setup();
    render(<ItemEditorDialog {...defaultProps} />);

    const input = getItemNameInput();
    await user.type(input, "App");

    await waitFor(
      () => {
        expect(screen.getByText("Apple")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
```

**Step 3: Run tests to verify they pass**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/shopping-list/__tests__/ItemEditorDialog.test.tsx -v`
Expected: ALL tests PASS

**Step 4: Commit**

```bash
git add src/components/shopping-list/ItemEditorDialog.tsx src/components/shopping-list/__tests__/ItemEditorDialog.test.tsx
git commit -m "refactor: replace ItemEditorDialog client-side search with useFoodItemSelector"
```

---

### Task 3: Update shopping-lists page to remove foodItems prop passing

Now that `ItemEditorDialog` fetches its own food items via `useFoodItemSelector`, remove the `foodItems` prop and the `loadFoodItems` calls that were only needed for the dialog.

**Files:**
- Modify: `src/app/shopping-lists/page.tsx`

**Step 1: Update page.tsx**

Key changes:
- Keep `foodItems` state and `loadFoodItems` — they're still needed for `resolveNameForFoodItemId` (used in save handler) and deconfliction
- Remove `void loadFoodItems()` from `handleOpenAddItemEditor` (line 614) and `handleOpenEditItemEditor` (line 626) — the dialog fetches its own data now
- Remove `foodItems={foodItems}` prop from `<ItemEditorDialog>` JSX (line 2457)
- Remove `onFoodItemCreated` prop from `<ItemEditorDialog>` JSX (lines 2465-2467) — hook handles refresh
- Add `onFoodItemAdded` callback to refresh `foodItems` state when a new item is created from the dialog (needed for `resolveNameForFoodItemId` in the save handler)
- Update `handleSaveItemFromEditor` to handle the case where `resolveNameForFoodItemId` returns "Unknown" — if so, fetch the food item by ID as a fallback

**Step 2: Run the shopping list page tests**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/app/shopping-lists/__tests__/ -v`
Expected: ALL tests PASS (or note pre-existing failures)

**Step 3: Commit**

```bash
git add src/app/shopping-lists/page.tsx
git commit -m "fix: remove foodItems prop passing to ItemEditorDialog, keep for deconfliction"
```

---

### Task 4: Fix deconfliction "Unknown" names and stale closure

Harden the name resolution in the deconfliction flow.

**Files:**
- Modify: `src/app/shopping-lists/page.tsx:344-357` (loadFoodItems catch block)
- Modify: `src/app/shopping-lists/page.tsx:1011-1031` (conflict name resolution)

**Step 1: Fix stale closure in loadFoodItems catch block**

In `loadFoodItems` (line 344), the catch block returns `foodItems` from the stale closure. Fix:

```tsx
const loadFoodItems = useCallback(async () => {
  if (foodItemsLoadedRef.current && foodItems.length > 0) return foodItems;
  try {
    const res = await fetch("/api/food-items?limit=1000");
    const json = await res.json();
    const items: FoodItem[] = Array.isArray(json) ? json : json.data || [];
    setFoodItems(items);
    foodItemsLoadedRef.current = true;
    return items;
  } catch (error) {
    console.error("Error loading food items:", error);
    return [];  // Return empty explicitly — stale closure was returning outdated state
  }
}, [foodItems]);
```

Note: returning `[]` is the same as the stale closure's behavior on first call, but at least it's explicit and consistent.

**Step 2: Add fallback name resolution for conflicts**

When building `UnitConflict[]` from `preMergeConflicts` (line 1011), if a food item isn't in `foodItemsMap`, fetch it individually:

After the `foodItemsMap` is built (line 980), add a step to fetch missing food item names for any conflicts:

```tsx
// Fetch names for any conflict food items missing from the map
const missingIds = preMergeConflicts
  .filter((c: PreMergeConflict) => !foodItemsMap.has(c.foodItemId))
  .map((c: PreMergeConflict) => c.foodItemId);

if (missingIds.length > 0) {
  const missingItems = await Promise.all(
    missingIds.map(async (id) => {
      try {
        const res = await fetch(`/api/food-items/${id}`);
        if (res.ok) return await res.json();
      } catch { /* ignore */ }
      return null;
    }),
  );
  for (const item of missingItems) {
    if (item) {
      foodItemsMap.set(item._id, {
        singularName: item.singularName,
        pluralName: item.pluralName,
        unit: item.unit,
      });
    }
  }
}
```

**Step 3: Commit**

```bash
git add src/app/shopping-lists/page.tsx
git commit -m "fix: resolve Unknown food item names in deconfliction dialog"
```

---

### Task 5: Add rollback on failed conflict resolution save

Follow the existing rollback pattern used in `handleRemoveItemFromList` and `handleSaveItemFromEditor`.

**Files:**
- Modify: `src/app/shopping-lists/page.tsx:1157-1220`

**Step 1: Add rollback logic**

In `handleApplyConflictResolutions`, capture previous items before updating state and restore on failure:

```tsx
const handleApplyConflictResolutions = async () => {
  if (!selectedStore) return;

  // ... existing resolution-building code (lines 1161-1199) stays the same ...

  const previousItems = shoppingListItems;  // Capture for rollback
  setShoppingListItems(updatedItems);

  try {
    await updateShoppingList(selectedStore._id, { items: updatedItems });
    const updatedStores = await fetchStores();
    setStores(updatedStores);
    unitConflictDialog.closeDialog();
    setSelectedMealPlanIds([]);
    setUnitConflicts([]);
    setCurrentConflictIndex(0);
    setConflictResolutions(new Map());
  } catch (error) {
    console.error(
      "Error saving shopping list after conflict resolution:",
      error,
    );
    showSnackbar("Failed to save shopping list", "error");
    setShoppingListItems(previousItems);  // Rollback on failure
  }
};
```

**Step 2: Commit**

```bash
git add src/app/shopping-lists/page.tsx
git commit -m "fix: rollback shopping list state on failed conflict resolution save"
```

---

### Task 6: Run full validation

**Step 1: Run `npm run check`**

Run: `npm run check`
Expected: Lint passes, all tests pass, build succeeds.

**Step 2: Fix any failures**

If tests fail, investigate and fix. Common issues:
- Shopping list page tests may need updated mocks if they reference `foodItems` prop
- ItemEditorDialog tests may need API mock adjustments

**Step 3: Final commit if needed**

```bash
git add -u
git commit -m "fix: resolve test issues from food item bug fixes"
```

---

### Task 7: Create PR

Create a pull request from the feature branch to `main`.

```bash
git push -u origin fix/food-item-search-and-error-handling
gh pr create --title "Fix food item search, duplicate errors & deconfliction bugs" --body "$(cat <<'EOF'
## Summary
- Refactor `ItemEditorDialog` to use `useFoodItemSelector` for server-side search (DRY with `FoodItemAutocomplete`)
- Fix silent failure when creating duplicate food items (`AddFoodItemDialog` error handling)
- Fix "Unknown" food item names in unit conversion deconfliction dialog
- Add rollback on failed conflict resolution save

## Test plan
- [ ] Create a food item that already exists — error message should appear in dialog
- [ ] Open shopping list "Add Item" dialog — typeahead should search server-side with loading spinner
- [ ] Import meal plans with unit conflicts — food item names should display correctly
- [ ] Verify all existing tests pass (`npm run check`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
