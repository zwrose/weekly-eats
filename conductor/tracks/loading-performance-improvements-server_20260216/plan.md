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

## Phase 2: Recipes — Unified List with Filtering [ ]

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

- [~] Task 2.4: Refactor recipes page to unified server-paginated list
  - [ ] Write tests for the updated recipes page: single list, server pagination, filter bar integration
  - [ ] Refactor `src/app/recipes/page.tsx` to remove dual-section layout and use `useServerPagination` with the updated API
  - [ ] Add access-level badges (Personal / Shared by You / Global) to each recipe row/card
  - [ ] Verify tests pass

- [ ] Task 2.5: Update `useRecipes` hook for unified data model
  - [ ] Write tests for the updated hook that fetches a single paginated list instead of two separate lists
  - [ ] Refactor `src/lib/hooks/use-recipes.ts`
  - [ ] Verify tests pass

- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Food Items — Unified List [ ]

### API Changes

- [ ] Task 3.1: Update food items API for server-side pagination and unified query
  - [ ] Write tests for `GET /api/food-items` with params: `page`, `limit`, `query`, `accessLevel`, `sortBy`, `sortOrder`
  - [ ] Update the API route: unified query, paginated response, `accessLevel` field (Personal / Shared by You / Global)
  - [ ] Add necessary indexes
  - [ ] Verify tests pass

### UI Changes

- [ ] Task 3.2: Refactor food items page to unified server-paginated list
  - [ ] Write tests for the updated food items page: single list, server pagination, search, access level filter
  - [ ] Refactor `src/app/food-items/page.tsx` to remove dual-section layout
  - [ ] Add three-state access-level badges
  - [ ] Verify tests pass

- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Meal Plans — Year/Month Browsing [ ]

### API Changes

- [ ] Task 4.1: Add date-range and summary endpoints to meal plans API
  - [ ] Write tests for `GET /api/meal-plans` with new params: `startDate`, `endDate` (return only plans in range)
  - [ ] Write tests for `GET /api/meal-plans/summary` that returns year/month structure with plan counts (no full plan data)
  - [ ] Implement both endpoints
  - [ ] Add index support for date-range queries
  - [ ] Verify tests pass

### UI Changes

- [ ] Task 4.2: Build year/month folder tree component
  - [ ] Write tests for a `MealPlanBrowser` component that renders collapsible year/month headers with plan counts
  - [ ] Implement with MUI Accordion or collapsible list
  - [ ] Lazy-load month contents when expanded (calls API with date range)
  - [ ] Verify tests pass

- [ ] Task 4.3: Refactor meal plans page for current-week focus
  - [ ] Write tests for the updated page: current week loads immediately, prior week optional, folder tree below
  - [ ] Refactor `src/app/meal-plans/page.tsx` to use date-filtered API calls and the folder tree component
  - [ ] Remove the "load all plans" pattern
  - [ ] Verify tests pass

- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)

## Phase 5: Pantry — Server-Side Search & Pagination [ ]

- [ ] Task 5.1: Update pantry API for server-side search and pagination
  - [ ] Write tests for `GET /api/pantry` with params: `page`, `limit`, `query`
  - [ ] Move search filtering from in-memory to MongoDB query (regex on joined food item names)
  - [ ] Return paginated results with total count
  - [ ] Verify tests pass

- [ ] Task 5.2: Update pantry page for server-side pagination
  - [ ] Write tests for the updated pantry page using server-paginated data and debounced search
  - [ ] Refactor `src/app/pantry/page.tsx` to use `useServerPagination`
  - [ ] Verify tests pass

- [ ] Task: Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)

## Phase 6: Shopping Lists — Lazy Loading [ ]

- [ ] Task 6.1: Update stores API to return metadata only
  - [ ] Write tests for `GET /api/stores` returning store metadata + item counts (not full item arrays)
  - [ ] Update the API route to exclude shopping list items from the initial response
  - [ ] Add `itemCount` field to the response
  - [ ] Verify tests pass

- [ ] Task 6.2: Build on-demand food item autocomplete
  - [ ] Write tests for an updated `FoodItemAutocomplete` that fetches from API on input (debounced) instead of receiving a pre-loaded list
  - [ ] Update the component to use debounced server search
  - [ ] Verify tests pass

- [ ] Task 6.3: Refactor shopping lists page for lazy loading
  - [ ] Write tests for the updated page: store cards show item counts, items load on open, autocomplete is on-demand
  - [ ] Refactor `src/app/shopping-lists/page.tsx` to remove upfront food item fetch and rely on lazy-loaded store items
  - [ ] Add loading indicators for store item fetching
  - [ ] Verify all existing interactions (real-time sync, finish shop, purchase history) still work
  - [ ] Verify tests pass

- [ ] Task: Conductor - User Manual Verification 'Phase 6' (Protocol in workflow.md)
