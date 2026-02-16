# Specification: Loading Performance & Unified List Views

## Overview

Improve loading performance across all major features by introducing server-side pagination, search, and filtering — replacing the current pattern of loading all records upfront. Additionally, unify the split "Your Items / Global Items" presentation in Recipes and Food Items into single lists with access-level badges and filters. Restructure Meal Plans browsing with a year/month folder hierarchy that prioritizes the current week.

## Functional Requirements

### FR-1: Recipes — Unified List with Server-Side Pagination & Filtering

- **Unified list**: Merge "Your Recipes" and "Global Recipes" into a single paginated list (remove the two-section layout)
- **Access-level badge**: Each recipe displays one of three badges:
  - **Personal** — user-created, not shared globally
  - **Shared by You** — user-created and marked global
  - **Global** — created by someone else, globally available
- **Server-side pagination**: API returns a page of results (e.g., 25 per page) with total count; client renders pagination controls
- **Server-side search**: Move text search to the API (query by title, existing regex approach)
- **Tag filter**: Multi-select dropdown of the user's known tags; API filters recipes that have ANY of the selected tags (via `recipeUserData` join)
- **Rating filter/sort**: Option to filter by minimum rating (e.g., 3+ stars) and sort by rating descending
- **Access level filter**: Dropdown to narrow to Personal / Shared by You / Global / All
- **Sort options**: Updated date (default), rating, title alphabetical

### FR-2: Food Items — Unified List with Server-Side Pagination

- **Unified list**: Merge "Your Food Items" and "Global Food Items" into a single paginated list (same pattern as Recipes)
- **Access-level badge**: Each food item displays one of three badges:
  - **Personal** — user-created, not shared globally
  - **Shared by You** — user-created and marked global
  - **Global** — created by someone else, globally available
- **Server-side pagination**: API returns paginated results (25 per page) with total count
- **Server-side search**: Move text search to API (query by name/singularName/pluralName)
- **Access level filter**: Dropdown to narrow to Personal / Shared by You / Global / All

### FR-3: Meal Plans — Current Week Focus with Year/Month Browsing

- **Default view**: Load and display the current week's meal plan (and prior week if it exists) automatically on page load
- **Year/month folder structure**: Below the current/prior week, show a collapsible hierarchy:
  - Year headers (e.g., "2026", "2025") — collapsed by default
  - Month sub-headers (e.g., "January", "February") — collapsed by default
  - Expanding a month lazy-loads that month's meal plan summaries (name, date range, item count) from the server
- **Server-side date filtering**: API accepts date range parameters (`startDate`, `endDate`) to return only plans within that window
- **Folder metadata**: API provides lightweight year/month counts so the folder tree can show plan counts without loading full plans (e.g., "January 2026 (4)")

### FR-4: Pantry — Server-Side Search

- **Server-side search**: Move the current in-memory search to a database query so only matching items are returned
- **Server-side pagination**: API returns paginated results (25 per page) with total count
- **No structural changes**: Keep the single flat list UI

### FR-5: Shopping Lists — Lazy Loading Optimization

- **Lazy-load store items**: Initial `/api/stores` returns store metadata only (name, emoji, item count) — not full shopping list items
- **On-demand list loading**: Full shopping list items load when a store is opened (existing `fetchShoppingList` call), with a loading indicator
- **On-demand food item autocomplete**: Instead of pre-loading 1,000 food items, the autocomplete component fetches results as the user types (debounced server-side search)
- **Preserve current UX**: All existing interactions (drag-drop, real-time sync, finish shop, purchase history) continue working; loading states are shown during lazy loads

## Non-Functional Requirements

- **NFR-1**: Initial page load for each feature should transfer significantly less data (target: <50KB initial payload per feature vs current 100KB-2MB)
- **NFR-2**: Server-side paginated queries must use MongoDB indexes for sub-100ms response times
- **NFR-3**: All loading states must show appropriate skeletons or spinners (no blank screens)
- **NFR-4**: Client-side search/filter UX should feel responsive — debounce server calls at ~300ms
- **NFR-5**: Maintain mobile responsiveness across all changed views
- **NFR-6**: No regressions in existing real-time shopping list collaboration

## Acceptance Criteria

1. Recipes page shows a single unified list with access-level badges; filtering by tag, rating, and access level works
2. Food Items page shows a single unified list with three-state access-level badges and server-side search
3. Meal Plans page loads current week instantly; expanding a year/month folder lazy-loads that month's plans
4. Meal plan folder tree shows plan counts per month without loading full plan data
5. Pantry search queries the server and returns paginated results
6. Shopping lists page loads store cards without embedded item lists; opening a store loads items with a visible loading state
7. Food item autocomplete in shopping lists searches on-demand (no 1,000-item preload)
8. All pages maintain existing functionality (create, edit, delete, share, real-time sync)
9. All changed features have appropriate loading/skeleton states

## Out of Scope

- Infinite scroll (using traditional pagination controls)
- Caching layer (e.g., React Query, SWR) — plain fetch with useState is the current pattern
- Virtual scrolling for long lists
- Search across multiple features (global search)
- Changing the meal plan detail/editing view
- Modifying shopping list real-time collaboration protocol
