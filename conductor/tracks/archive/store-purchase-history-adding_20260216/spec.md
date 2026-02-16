# Specification: Store Purchase History

## Overview

Add a purchase history feature to stores that records items when a user completes a shopping trip ("Finish Shop"). Users can browse previously purchased items for any store — sorted by most recent — and quickly re-add them to the active shopping list with adjustable quantities. History is shared across all users with access to the store.

## Functional Requirements

### FR-1: Record Purchase History

- When the user taps "Finish Shop", all checked items are saved to a `purchaseHistory` collection *before* being removed from the shopping list
- Each record stores: `storeId`, `foodItemId`, `name`, `quantity`, `unit`, `lastPurchasedAt`
- If the food item already exists in history for that store, update the record (upsert) with the latest quantity, unit, and date
- History is associated with the store, not a specific user (shared across all users with store access)

### FR-2: View Purchase History

- Accessible from **two entry points**:
  1. A history icon button on the store card/row in the shopping lists page (replaces the existing shopping cart icon, which is redundant with tapping the row)
  2. A "History" option in the store's overflow menu on the shopping list detail view
- Opens a dialog showing all previously purchased items for the selected store
- Items sorted by `lastPurchasedAt` descending (most recent first)
- Each item displays: food item name (with emoji from food item DB), last quantity + unit, last purchase date (relative, e.g. "3 days ago")
- Items currently on the active shopping list are visually distinguished to avoid duplicates
- A search/filter input allows finding items in large histories

### FR-3: Re-add Items to Shopping List

- **Single add**: Tapping a history item adds it to the active shopping list with its last quantity/unit; quantity is editable inline before confirming
- **Multi-select**: Users can select multiple items (via checkboxes), optionally adjust quantities, then add all selected items in one action
- Re-added items integrate with the existing position system (`storeItemPositions`) for remembered store layout
- Re-added items broadcast via Ably real-time sync so collaborators see the updates

## Non-Functional Requirements

- **NFR-1**: Purchase history queries should be indexed for fast retrieval by `storeId` + sorted by `lastPurchasedAt`
- **NFR-2**: The history dialog must be responsive and work well on mobile (touch-friendly tap targets, scrollable list)
- **NFR-3**: History recording during "Finish Shop" must not noticeably delay the existing flow
- **NFR-4**: Respects existing store access control — only users with store access (owner or accepted invitation) can view/use history

## Acceptance Criteria

1. Completing "Finish Shop" persists all checked items to the `purchaseHistory` collection
2. Reopening history for the same store shows the just-finished items at the top
3. Tapping a history item adds it to the shopping list with correct quantity/unit
4. Multi-selecting and adding multiple items works in a single action
5. Quantities can be adjusted before or during re-add
6. History is visible to all users with access to the shared store
7. Items already on the active shopping list are indicated in the history view
8. Search/filter narrows the history list

## Out of Scope

- Purchase frequency analytics or spending insights
- Automatic re-ordering / "buy again" suggestions
- Export or import of purchase history
- Per-user history views on shared stores
- Tracking price information
