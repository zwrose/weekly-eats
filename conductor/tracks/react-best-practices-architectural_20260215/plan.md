# Plan: React Best Practices Architectural Audit & Refactor

## Phase 1: Quick Wins — Bundle & Memoization Fixes (CRITICAL/HIGH impact, LOW effort) [checkpoint: 760d5f2]

- [x] Task 1.1: Fix `foodItemsMap` in `use-food-items.ts` — replace `useCallback()()` IIFE with `useMemo` (`rerender-memo`) [0452692]
- [x] Task 1.2: Memoize theme context provider value in `src/lib/theme-context.tsx` — wrap `{ mode, setMode, isDark }` in `useMemo` (`rerender-memo-with-default-value`) [5e0ecd8]
- [x] Task 1.3: Fix EmojiPicker key — replace array index key with `item.emoji` in `src/components/EmojiPicker.tsx` (`rendering-hoist-jsx`) [f46c52d]
- [x] Task 1.4: Extract recurring inline `sx` prop objects to module-level constants in `src/app/recipes/page.tsx` (card styles, flex row patterns used 50+ times) (`rendering-hoist-jsx`) [59e89f9]
- [x] Task 1.5: Clean up unused code — remove `src/lib/context/app-context.tsx` (dead AppProvider) and verify `BaseIngredientInput.tsx` is unused, then remove if confirmed [aae4529]
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Dynamic Imports & Code Splitting (CRITICAL impact, MEDIUM effort) [checkpoint: 05d371d]

- [x] Task 2.1: Add `next/dynamic` import for `EmojiPicker` component with `{ ssr: false }` (`bundle-dynamic-imports`) [fc734b9]
- [x] Task 2.2: Dynamic import dialog-heavy components — extract and lazy-load recipe view/edit dialogs from `recipes/page.tsx` (`bundle-dynamic-imports`) [409f281]
- [x] Task 2.3: Dynamic import `react-markdown` + `remark-gfm` — `RecipeInstructionsView` should load these on demand (`bundle-conditional`) [409f281] (covered by Task 2.2 — component is dynamically imported, so its deps are already code-split)
- [x] Task 2.4: Lazy-load Ably — ensure the `ably` package only loads on the shopping-lists page, not globally (`bundle-defer-third-party`) [6a11e9b]
- [x] Task 2.5: Lazy-load `@dnd-kit` — ensure drag-and-drop packages only load on meal-plans page (`bundle-defer-third-party`) [no change needed — @dnd-kit is only imported in shopping-lists/page.tsx, already route-level code-split by Next.js]
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Split Oversized Page Components (CRITICAL impact, HIGH effort) [checkpoint: 9a78d55]

- [x] Task 3.1: Extract recipe view dialog into `src/components/RecipeViewDialog.tsx` from `recipes/page.tsx` [cb346cd]
- [x] Task 3.2: Extract recipe create/edit dialog into `src/components/RecipeEditorDialog.tsx` from `recipes/page.tsx` [3df65e8]
- [x] Task 3.3: Extract recipe sharing section into `src/components/RecipeSharingSection.tsx` from `recipes/page.tsx` [38fb201]
- [x] Task 3.4: Extract meal plan create/edit dialogs into dedicated components from `meal-plans/page.tsx` [179489e]
- [x] Task 3.5: Add `React.memo` to extracted components and list row/card subcomponents (`rerender-memo`) [9a78d55]
- [x] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Eliminate Data Fetching Waterfalls (CRITICAL impact, HIGH effort)

- [ ] Task 4.1: Create batch endpoint `POST /api/recipes/user-data/batch` that accepts `{ recipeIds: string[] }` and returns all user data in one request (`async-parallel`)
- [ ] Task 4.2: Refactor `loadRecipesUserData` in `recipes/page.tsx` to call the batch endpoint instead of N individual requests (`async-parallel`)
- [ ] Task 4.3: Refactor `GET /api/meal-plans` to use MongoDB `$lookup` aggregation instead of N+1 `findOne()` calls for meal item names (`async-api-routes`)
- [ ] Task 4.4: Add `Promise.all` for independent initial data loads in `settings/page.tsx` — `loadUserSettings` and `loadMealPlanOwners` currently fire sequentially via separate `useEffect` (`async-parallel`)
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)

## Phase 5: App Router Conventions & Metadata (HIGH impact, MEDIUM effort)

- [ ] Task 5.1: Add `loading.tsx` with skeleton UIs for key routes: `recipes/`, `meal-plans/`, `shopping-lists/` (`async-suspense-boundaries`)
- [ ] Task 5.2: Add `error.tsx` error boundary components for key routes: `recipes/`, `meal-plans/`, `shopping-lists/`
- [ ] Task 5.3: Add `not-found.tsx` for custom 404 page
- [ ] Task 5.4: Add dynamic metadata to feature pages — use `metadata` export with `title` for each page (e.g., "Recipes - Weekly Eats", "Meal Plans - Weekly Eats") and set `title.template` in root layout
- [ ] Task: Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)

## Phase 6: Auth & Type Safety Fixes (HIGH impact, MEDIUM effort)

- [ ] Task 6.1: Fix `src/lib/auth.ts` type safety — replace all 6 `any` casts with proper NextAuth types using the session callback signature (`server-auth-actions`)
- [ ] Task 6.2: Make `isAdmin` and `isApproved` non-optional in `src/types/next-auth.d.ts` session type extension — update all consumers
- [ ] Task 6.3: Cache auth session user lookup — store `isAdmin`/`isApproved` in the JWT token via the `jwt` callback instead of querying MongoDB on every `session()` call (`server-cache-lru`)
- [ ] Task 6.4: Standardize API error handling — audit all routes in `src/app/api/` and replace hardcoded error strings with centralized constants from `src/lib/errors.ts`; replace `console.error` with `logError`; remove local `STORE_ERRORS` from `stores/route.ts`
- [ ] Task: Conductor - User Manual Verification 'Phase 6' (Protocol in workflow.md)

## Phase 7: React 19 Modernization & Re-render Optimization (MEDIUM impact, MEDIUM effort)

- [ ] Task 7.1: Add `useTransition` to recipe search — wrap search input state updates to keep UI responsive during filtering (`rerender-transitions`)
- [ ] Task 7.2: Add `useTransition` to page/tab navigation in recipes and food-items pages (`rendering-usetransition-loading`)
- [ ] Task 7.3: Implement optimistic updates for recipe CRUD — stop refetching all recipes after create/update/delete; update local state optimistically (`rerender-functional-setstate`)
- [ ] Task 7.4: Implement optimistic updates for shopping list check-offs using `useOptimistic` (`rerender-functional-setstate`)
- [ ] Task 7.5: Extract inline event handlers in `Header.tsx` and `BottomNav.tsx` to `useCallback` where they're passed as props (`rerender-memo`)
- [ ] Task: Conductor - User Manual Verification 'Phase 7' (Protocol in workflow.md)

## Phase 8: Database & Missing Index Optimizations (MEDIUM impact, LOW effort)

- [ ] Task 8.1: Add missing MongoDB indexes to `src/lib/database-indexes.ts`: `shoppingLists.storeId`, `mealPlans.templateId`, compound `(userId, mealPlanId)` for meal plan items
- [ ] Task 8.2: Run `npm run setup-db` and verify indexes are applied
- [ ] Task: Conductor - User Manual Verification 'Phase 8' (Protocol in workflow.md)
