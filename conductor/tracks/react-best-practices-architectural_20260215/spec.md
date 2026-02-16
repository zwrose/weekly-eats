# Spec: React Best Practices Architectural Audit & Refactor Plan

## Overview

A full-codebase architectural audit of the Weekly Eats Next.js 15 / React 19 application, cross-referenced against Vercel Engineering's React Best Practices (57 rules across 8 categories). The audit identifies violations, missed optimization opportunities, and architectural gaps, then provides a prioritized refactor plan.

## Audit Findings

### Finding 1: All Pages Are Client Components — No Server-Side Rendering Leverage (CRITICAL)

**Vercel Rules Violated:** `server-parallel-fetching`, `async-suspense-boundaries`, `server-serialization`

Every feature page (`meal-plans`, `recipes`, `shopping-lists`, `food-items`, `pantry`, `settings`, `user-management`) has `"use client"` at the top. All data fetching happens client-side via `useEffect` + custom hooks. This means:

- No server-side data fetching (initial page load is always a loading spinner)
- No streaming or progressive rendering
- No SEO benefit for any page content
- All 35 components marked `"use client"` — some unnecessarily (e.g., `RecipeInstructionsView` only renders markdown)

**Impact:** Users always see a loading spinner first, then content. Server components could deliver initial data in the HTML response.

### Finding 2: Waterfall Data Fetching in Recipes Page (CRITICAL)

**Vercel Rules Violated:** `async-parallel`, `async-api-routes`

`src/app/recipes/page.tsx` fetches recipes first, then triggers a second wave of N requests to `/api/recipes/[id]/user-data` for every recipe loaded. With 100 recipes, this creates 100 sequential API calls after the initial fetch.

Additionally, `src/app/api/meal-plans/route.ts` has an N+1 query problem — each meal plan item requires 3 separate `findOne()` calls to populate names (food item, recipe). With 100 meal items, this becomes 300 database queries per request.

### Finding 3: No Dynamic Imports or Code Splitting (CRITICAL)

**Vercel Rules Violated:** `bundle-dynamic-imports`, `bundle-conditional`, `bundle-defer-third-party`

- Zero uses of `next/dynamic` or `React.lazy()` in the entire codebase
- Heavy dialog components (recipe editor, sharing dialogs, emoji picker) always render inline
- Ably (~150KB gzipped) loads on every page despite only being used on shopping lists
- `@dnd-kit` loads globally despite only being used on meal plans
- `react-markdown` + `remark-gfm` loads despite only being used in recipe instructions

### Finding 4: Missing App Router Conventions (HIGH)

- **No `loading.tsx` files** — No skeleton UIs for route transitions
- **No `error.tsx` files** — No route-level error boundaries
- **No `not-found.tsx`** — No custom 404 pages
- **No dynamic metadata** — Only root metadata defined; no per-page titles (browser tabs all say "Weekly Eats")
- **No route segment config** — No explicit `dynamic`, `revalidate`, or `fetchCache` exports

### Finding 5: Inline sx Prop Objects Recreated Every Render (MEDIUM)

**Vercel Rules Violated:** `rerender-memo`, `rendering-hoist-jsx`

MUI `sx` prop objects are created inline throughout the codebase. In `src/app/recipes/page.tsx` (~2,144 lines), the same responsive flex layout pattern appears 50+ times, and style objects inside `.map()` loops are recreated per item per render (e.g., 25 card styles recreated every render cycle).

Theme context provider value (`{ mode, setMode, isDark }`) is not memoized, causing all consumers to re-render on any provider render.

### Finding 6: No React 19 Features Used (MEDIUM)

**Vercel Rules Violated:** `rerender-transitions`, `rendering-usetransition-loading`

The codebase uses React 19 but doesn't leverage any React 19 features:
- No `useOptimistic` (shopping list check-offs could benefit)
- No `useTransition` (recipe search, page transitions)
- No `useActionState` / `useFormStatus` (form submissions)
- No `use()` hook (promise unwrapping)
- No Server Actions

### Finding 7: Auth Session Database Query on Every Request (HIGH)

`src/lib/auth.ts` performs a MongoDB lookup on every `session()` callback to check `isAdmin` and `isApproved` flags. This runs on every authenticated request. The `isAdmin`/`isApproved` values should be stored in the JWT token.

Additionally, `auth.ts` uses 6 instances of `any` type — auth is the worst place for type safety gaps.

### Finding 8: Oversized Page Components (MEDIUM)

- `src/app/recipes/page.tsx` — **2,144 lines** (CRUD + sharing + tagging + rating + search + pagination)
- `src/app/meal-plans/page.tsx` — Very large (multiple dialogs, sharing, templates)
- `src/app/food-items/page.tsx` — ~850 lines

These monolithic page components handle too many concerns and prevent effective code splitting.

### Finding 9: Missing Memoization (MEDIUM)

**Vercel Rules Violated:** `rerender-memo`, `rerender-memo-with-default-value`, `rerender-functional-setstate`

- Only 2 components use `React.memo` (`SearchBar`, `Pagination`)
- `foodItemsMap` in `use-food-items.ts` uses `useCallback()()` (immediately invoked) instead of `useMemo`
- EmojiPicker uses array index as key in dynamic list
- Inline onClick handlers throughout Header and BottomNav components
- Multiple mutation handlers refetch ALL data instead of using optimistic updates

### Finding 10: Inconsistent API Error Handling (LOW)

- Some routes use centralized error constants (`AUTH_ERRORS.UNAUTHORIZED`), others use hardcoded strings
- `src/app/api/stores/route.ts` defines local `STORE_ERRORS` instead of using shared constants
- `src/app/api/recipes/[id]/route.ts` has hardcoded error strings in DELETE handler
- Some routes use `logError()`, others use `console.error()`

### Finding 11: Unused Code (LOW)

- `src/lib/context/app-context.tsx` — AppProvider context defined (128 lines) but never instantiated in the provider tree
- `src/components/BaseIngredientInput.tsx` — Possibly superseded by `IngredientInput.tsx`

## Functional Requirements

1. Produce a prioritized refactor plan organized into phases, ordered by Vercel best practice impact level (CRITICAL > HIGH > MEDIUM > LOW)
2. Each refactor item must reference the specific Vercel rule(s) it addresses
3. Refactors must be scoped to individual tasks that can be implemented and tested independently
4. No changes to user-facing behavior — all refactors are internal architecture improvements
5. All existing tests must continue to pass after each refactor

## Non-Functional Requirements

- Maintain or improve Lighthouse performance scores
- Maintain >80% test coverage
- No new dependencies unless justified (e.g., SWR for data deduplication)
- Each phase should be independently deployable

## Acceptance Criteria

- [ ] Audit findings documented with specific file paths and line numbers
- [ ] Refactor plan organized by impact priority (CRITICAL, HIGH, MEDIUM, LOW)
- [ ] Each task is independently implementable and testable
- [ ] Plan covers all 11 findings identified in the audit
- [ ] Vercel best practice rule references included for each task

## Out of Scope

- New feature development
- UI/UX redesign
- Database schema changes (index additions are in-scope)
- Migration to different state management libraries (recommendations only)
- Full Server Component migration (partial, pragmatic adoption is in-scope)
