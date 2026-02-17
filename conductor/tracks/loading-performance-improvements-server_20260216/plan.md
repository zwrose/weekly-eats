# Implementation Plan: Loading Performance & Unified List Views

## Phase 1: Server-Side Pagination Infrastructure [x] [checkpoint: 9fed296]

Build the shared utilities that all subsequent phases depend on.

- [x] Task 1.1: Create server-side pagination helper [ce511a8]
  - [x] Write tests for a `parsePaginationParams(searchParams)` utility that extracts `page`, `limit`, `sortBy`, `sortOrder` from URL search params with defaults
  - [x] Write tests for a `paginatedResponse(collection, filter, options)` utility that returns `{ data, total, page, limit, totalPages }`
  - [x] Implement both utilities in `src/lib/pagination-utils.ts`
  - [x] Verify tests pass

- [x] Task 1.2: Create client-side pagination hook for server-paginated data [827946a]
  - [x] Write tests for a `useServerPagination` hook that manages page state, calls a fetch function with page/limit/sort params, and exposes loading/data/pagination state
  - [x] Implement `src/lib/hooks/use-server-pagination.ts`
  - [x] Verify tests pass

- [x] Task 1.3: Create debounced server search hook [26230e5]
  - [x] Write tests for a `useDebouncedSearch` hook that debounces input and triggers a callback after ~300ms
  - [x] Implement `src/lib/hooks/use-debounced-search.ts`
  - [x] Verify tests pass

## Phase 2: Recipes — Unified List with Filtering [x] [checkpoint: 5eeea04]

### API Changes

- [x] Task 2.1: Update recipes API for server-side pagination and unified query [31e7113]
  - [x] Write tests for `GET /api/recipes` with new params: `page`, `limit`, `sortBy`, `sortOrder`, `query`, `accessLevel`, `tags`, `minRating`
  - [x] Update the API route to accept these params, perform a unified query (no more `userOnly`/`globalOnly` split), and return paginated results with total count
  - [x] Add `accessLevel` field computation in the API response (personal / shared-by-you / global)
  - [x] Verify tests pass

- [x] Task 2.2: Add tag and rating filtering to recipes API [d828325]
  - [x] Write tests for filtering by tags (join with `recipeUserData` to match selected tags)
  - [x] Write tests for filtering by minimum rating and sorting by rating
  - [x] Implement the MongoDB aggregation pipeline to join `recipeUserData` and apply filters
  - [x] Add necessary indexes for the new query patterns
  - [x] Verify tests pass

### UI Changes

- [x] Task 2.3: Build filter bar component for recipes [5fd89ab]
  - [x] Write tests for a `RecipeFilterBar` component with: search input, access level dropdown, tag multi-select, rating filter, sort dropdown
  - [x] Implement the component using MUI controls
  - [x] Verify tests pass

- [x] Task 2.4: Refactor recipes page to unified server-paginated list [3acd7ae]
  - [x] Write tests for the updated recipes page: single list, server pagination, filter bar integration
  - [x] Refactor `src/app/recipes/page.tsx` to remove dual-section layout and use `useServerPagination` with the updated API
  - [x] Add access-level badges (Personal / Shared by You / Global) to each recipe row/card
  - [x] Verify tests pass

- [x] Task 2.5: Remove unused `useRecipes` hook (replaced by `useServerPagination` in Task 2.4)
  - [x] Verify no consumers of `useRecipes` remain
  - [x] Remove `src/lib/hooks/use-recipes.ts` and its export from `hooks/index.ts`
  - [x] Verify tests pass

- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 2R: Recipes & Food Items UX Rework (User Feedback) [x] [checkpoint: fed8dd9]

Based on manual verification feedback:

- [x] Task 2R.1: Rename access level labels and update API response values [1590ac0]
  - [x] Rename: "personal" → "private", "global" → "shared-by-others" across API and UI
  - [x] Update `computeAccessLevel` in recipes and food items APIs
  - [x] Remove red from badge colors
  - [x] Update all tests

- [x] Task 2R.2: Remove access level from table/filters, add to recipe view dialog [1590ac0]
  - [x] Remove access level column from desktop table and mobile cards
  - [x] Remove access level filter dropdown from RecipeFilterBar
  - [x] Add access level badge to RecipeViewDialog view mode (not edit mode)
  - [x] Update tests

- [x] Task 2R.3: Rework rating filter from min-rating to multi-select [4237f69]
  - [x] Change API from `minRating` param to `ratings` param (comma-separated, e.g., "4,5")
  - [x] Update RecipeFilterBar: replace Rating component with chip-based multi-select (same UX as tags)
  - [x] Update recipes page filter state and fetchRecipes
  - [x] Update API tests and page tests

- [x] Task 2R.4: Make tags filter chips clearable with X [1590ac0]
  - [x] Update RecipeFilterBar tags section to render selected tags as Chips with onDelete
  - [x] Update tests

- [x] Task 2R.5: Add sortable table column headers on desktop [1590ac0]
  - [x] Replace static table headers with clickable sort headers (click to sort, click again to reverse)
  - [x] Remove sort dropdown from RecipeFilterBar (desktop only; keep in mobile flyout)
  - [x] Update tests

- [x] Task 2R.6: Change default page size to 10 [69b4591]
  - [x] Update useServerPagination default from 25 to 10
  - [x] Update parsePaginationParams server default from 25 to 10
  - [x] Update food items page default to 10
  - [x] Update all affected tests

- [x] Task 2R.7: Mobile filter/search UX — single row with filter flyout [f9d87cd]
  - [x] On mobile: search bar + filter icon button on one row
  - [x] Filter button opens MUI Drawer or Popover with filter controls (tags, rating, sort)
  - [x] Update tests

- [x] Task: Conductor - User Manual Verification 'Phase 2R' (Protocol in workflow.md)

## Phase 3: Food Items — Unified List [x] [checkpoint: ec9a108]

### API Changes

- [x] Task 3.1: Update food items API for server-side pagination and unified query
  - [x] Write tests for `GET /api/food-items` with params: `page`, `limit`, `query`, `accessLevel`, `sortBy`, `sortOrder`
  - [x] Update the API route: unified query, paginated response, `accessLevel` field (Personal / Shared by You / Global)
  - [x] Verify tests pass

### UI Changes

- [x] Task 3.2: Refactor food items page to unified server-paginated list
  - [x] Write tests for the updated food items page: single list, server pagination, search, access level filter
  - [x] Refactor `src/app/food-items/page.tsx` to remove dual-section layout
  - [x] Add three-state access-level badges
  - [x] Verify tests pass

- [x] Task 3R.1: Update food items page with renamed labels and default page size 10 [69b4591]
  - [x] Rename access level labels: "Personal" → "Private", "Global" → "Shared by Others"
  - [x] Remove red badge colors
  - [x] Default page size to 10
  - [x] Update tests

- [x] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Meal Plans — Year/Month Browsing [x] [checkpoint: 428b88c]

### API Changes

- [x] Task 4.1: Add date-range and summary endpoints to meal plans API [c6fe21d]
  - [x] Write tests for `GET /api/meal-plans` with new params: `startDate`, `endDate` (return only plans in range)
  - [x] Write tests for `GET /api/meal-plans/summary` that returns year/month structure with plan counts (no full plan data)
  - [x] Implement both endpoints
  - [x] Add index support for date-range queries (existing userId+startDate index is sufficient)
  - [x] Verify tests pass

### UI Changes

- [x] Task 4.2: Build year/month folder tree component [e7a54a8]
  - [x] Write tests for a `MealPlanBrowser` component that renders collapsible year/month headers with plan counts
  - [x] Implement with MUI collapsible list
  - [x] Lazy-load month contents when expanded (calls API with date range)
  - [x] Verify tests pass

- [x] Task 4.3: Refactor meal plans page for current-week focus [a255e61]
  - [x] Write tests for the updated page: current week loads immediately, prior week optional, folder tree below
  - [x] Refactor `src/app/meal-plans/page.tsx` to use date-filtered API calls and the folder tree component
  - [x] Remove the "load all plans" pattern
  - [x] Verify tests pass

- [x] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)

## Phase 5: Pantry — Server-Side Search & Pagination [x] [checkpoint: 92ecf58]

- [x] Task 5.1: Update pantry API for server-side search and pagination [892fbf3]
  - [x] Write tests for `GET /api/pantry` with params: `page`, `limit`, `query`
  - [x] Move search filtering from in-memory to MongoDB query (regex on joined food item names)
  - [x] Return paginated results with total count
  - [x] Verify tests pass

- [x] Task 5.2: Update pantry page for server-side pagination [2cf7c7f]
  - [x] Write tests for the updated pantry page using server-paginated data and debounced search
  - [x] Refactor `src/app/pantry/page.tsx` to use `useServerPagination`
  - [x] Verify tests pass

- [x] Task: Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)

## Phase 6: Shopping Lists — Lazy Loading [~]

- [x] Task 6.1: Update stores API to return metadata only
  - [x] Write tests for `GET /api/stores` returning store metadata + item counts (not full item arrays)
  - [x] Update the API route to exclude shopping list items from the initial response
  - [x] Add `itemCount` field to the response
  - [x] Verify tests pass

- [x] Task 6.2: Build on-demand food item autocomplete
  - [x] Write tests for an updated `FoodItemAutocomplete` that fetches from API on input (debounced) instead of receiving a pre-loaded list
  - [x] Update the component to use debounced server search
  - [x] Verify tests pass

- [ ] Task 6.3: Refactor shopping lists page for lazy loading
  - [ ] Write tests for the updated page: store cards show item counts, items load on open, autocomplete is on-demand
  - [ ] Refactor `src/app/shopping-lists/page.tsx` to remove upfront food item fetch and rely on lazy-loaded store items
  - [ ] Add loading indicators for store item fetching
  - [ ] Verify all existing interactions (real-time sync, finish shop, purchase history) still work
  - [ ] Verify tests pass

- [ ] Task: Conductor - User Manual Verification 'Phase 6' (Protocol in workflow.md)
