# Implementation Plan: Store Purchase History

## Phase 1: Data Layer — Types, Collection & Indexes `[ ]`

- [x] Task: Add `PurchaseHistoryRecord` interface to `src/types/shopping-list.ts` [f682be7]
  - Fields: `_id`, `storeId`, `foodItemId`, `name`, `quantity`, `unit`, `lastPurchasedAt`
- [x] Task: Add `purchaseHistory` collection indexes to `src/lib/database-indexes.ts` [ef7dc28]
  - Unique compound index on `{ storeId, foodItemId }`
  - Sort index on `{ storeId, lastPurchasedAt: -1 }`
- [x] Task: Add error constants for purchase history to `src/lib/errors.ts` [e7fd2e7]

## Phase 2: API Routes `[ ]`

- [ ] Task: Write tests for `GET /api/shopping-lists/[storeId]/history` route
  - Test auth check, store access validation (owner + invited user), returns items sorted by `lastPurchasedAt` desc
- [ ] Task: Implement `GET /api/shopping-lists/[storeId]/history` route
  - Validates session and store access (owner or accepted invitation)
  - Returns purchase history for the store sorted by most recent first
- [ ] Task: Write tests for `POST /api/shopping-lists/[storeId]/finish-shop` route
  - Test that it upserts checked items into `purchaseHistory` then clears them from the shopping list
  - Test auth and store access validation
- [ ] Task: Implement `POST /api/shopping-lists/[storeId]/finish-shop` route
  - Receives checked items, bulk upserts into `purchaseHistory` collection, removes checked items from shopping list
  - Replaces the current client-side "Finish Shop" logic with a single server-side operation

## Phase 3: Client Utilities `[ ]`

- [ ] Task: Add `fetchPurchaseHistory` and `finishShop` functions to `src/lib/shopping-list-utils.ts`
- [ ] Task: Update `handleClearCheckedItems` in the shopping list page to call the new `finishShop` API instead of directly updating the list

## Phase 4: History Dialog Component `[ ]`

- [ ] Task: Write tests for `StoreHistoryDialog` component
  - Test rendering history items, search/filter, single add, multi-select add, quantity editing, empty state
- [ ] Task: Create `src/components/shopping-list/StoreHistoryDialog.tsx` (dynamically imported)
  - Displays history items in a scrollable list sorted by recency
  - Each item shows: food emoji + name, last quantity + unit, relative date (e.g. "3 days ago")
  - Items already on the active shopping list are visually indicated (muted/badged)
  - Search input filters the history list
  - Single-tap adds item to list; quantity editable inline via `QuantityInput`
  - Checkbox mode for multi-select with "Add Selected" button
  - Integrates with `insertItemsWithPositions` for remembered store layout

## Phase 5: UI Integration `[ ]`

- [ ] Task: Replace `ShoppingCart` icon on store cards/rows (both desktop table and mobile card) with a `History` icon that opens `StoreHistoryDialog` for that store
- [ ] Task: Add "Purchase History" menu item to the shopping list overflow menu (alongside "Add items from meal plans" and "Pantry check")
- [ ] Task: Wire up Ably broadcast for items re-added from history (reuse existing `list_updated` event)
- [ ] Task: Write/update integration tests for the new entry points
- [ ] Task: Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)
