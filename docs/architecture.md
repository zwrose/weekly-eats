# Weekly Eats Architecture

System design reference for the Weekly Eats meal planning application.

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | **Next.js 15** (App Router, Turbopack dev) | Server-side rendering, API routes, and file-based routing in one package |
| UI | **React 19** + **MUI v7** + **Emotion** | MUI provides a complete component library; Emotion is MUI's CSS-in-JS engine |
| Database | **MongoDB 8.0** via native `mongodb` driver (v6) | Flexible document model fits the nested recipe/meal-plan structures; no ORM overhead |
| Auth | **NextAuth 4** (Google OAuth, JWT strategy) + **@auth/mongodb-adapter** | Handles OAuth flow and session management with minimal config |
| Real-time | **Ably** (Pub/Sub + Presence) | WebSocket messaging for shopping list collaboration; works with serverless (Vercel) |
| Drag-and-drop | **@dnd-kit/core** + **@dnd-kit/sortable** | Accessible, performant DnD for meal plan reordering and ingredient ordering |
| Dates | **date-fns** + **@mui/x-date-pickers** | Lightweight date math and MUI-integrated calendar pickers |
| Unit conversion | **jonahsnider/convert** (`convert`) | Volume and weight conversions for ingredient deconfliction |
| Markdown | **react-markdown** + **remark-gfm** | Renders recipe instructions written in markdown |
| Pluralization | **@wei/pluralize** | Singular/plural food item name forms |
| Testing | **Vitest 3** + **React Testing Library** + **MSW 2** | Fast test runner with jsdom, component testing, and API mocking |

---

## Feature Routes

| Route | URL | Description |
|-------|-----|-------------|
| Landing | `/` | Public home page and Google OAuth sign-in entry point. Unauthenticated users are redirected here by middleware. |
| Pending Approval | `/pending-approval` | Shown to authenticated but unapproved users. Polls `/api/user/approval-status` every 60 seconds via `useApprovalStatus` and auto-redirects to `/meal-plans` on approval. |
| Meal Plans | `/meal-plans` | Weekly meal planning with drag-and-drop day slots. Supports templates (one per user), recipe/food-item assignment per meal, and meal plan sharing via invitations embedded in user settings. |
| Recipes | `/recipes` | CRUD for user and global recipes. Recipes have grouped ingredients (food items or nested sub-recipes), markdown instructions, tags, and per-user ratings stored in `recipeUserData`. Uses persistent URL dialogs for view/edit. |
| Food Items | `/food-items` | Manages the food item catalog with singular/plural names and units. Items can be user-scoped or global. Server-side paginated list view with search. |
| Pantry | `/pantry` | Tracks which food items the user has on hand. Items link to the food items catalog. |
| Shopping Lists | `/shopping-lists` | Store-based shopping lists with real-time Ably sync. Supports shopping mode (check off items), drag-to-reorder by store layout, meal-plan-to-list population with unit deconfliction, and purchase history tracking. |
| Settings | `/settings` | User preferences including theme mode (light/dark/system), meal plan sharing invitations, recipe sharing invitations, and default meal plan owner selection. |
| User Management | `/user-management` | Admin-only page. Approve/deny new user registrations, grant/revoke admin privileges. |

Each authenticated route includes `loading.tsx` (skeleton) and `error.tsx` (error boundary) files. Heavy dialog components are dynamically imported with `next/dynamic` (`{ ssr: false }`).

---

## State Management

The application uses three state management layers. There is no global state library (no Redux, Zustand, etc.).

### 1. ThemeContext (the only React Context)

**File:** `src/lib/theme-context.tsx`

ThemeContext is the single React context in the application. It manages the light/dark/system theme preference:

1. On mount, reads `initialMode` from cookies (set by the root layout for flash-free SSR)
2. Once the session is available, fetches the user's saved preference from `GET /api/user/settings`
3. Listens for `themeChange` DOM custom events (dispatched by the settings page when the user changes their theme)
4. Resolves `mode` to `isDark` boolean (respecting `prefers-color-scheme` media query for `system` mode)
5. Persists both `theme-mode` and `theme-isDark` as cookies for the next page load

### 2. Custom Hooks (per-feature data fetching)

Each feature page uses custom hooks from `src/lib/hooks/` for data fetching and local state. There is no shared cache between hooks -- each hook instance fetches independently and exposes a `refetch()` callback for manual refresh after mutations.

Pattern:
```
Component mounts -> hook calls useState + useEffect -> fetch from API -> return { data, loading, error, refetch }
```

Mutations (create, update, delete) are either handled inside the hook or performed by the component, which then calls `refetch()`.

### 3. URL State (persistent dialogs)

**Hook:** `usePersistentDialog(dialogKey)`

Encodes dialog open/close state and associated data in URL search params so dialogs survive browser refresh and support back/forward navigation. URL format: `?viewRecipe=true&viewRecipe_recipeId=abc123`.

Uses `setTimeout` (100-200ms) on `router.push`/`router.replace` calls to avoid conflicts with Next.js App Router's internal navigation state.

Pre-configured wrappers: `useRecipeModal()`, `useFoodItemModal()`, `useMealPlanModal()`.

---

## Authentication Flow

### End-to-End Sequence

```
Browser                    Middleware               NextAuth                  MongoDB
  |                           |                       |                        |
  |-- GET /meal-plans ------->|                       |                        |
  |                           |-- getToken() -------->|                        |
  |                           |<-- null (no JWT) -----|                        |
  |<-- 302 /?callbackUrl= ---|                       |                        |
  |                           |                       |                        |
  |-- Google OAuth flow ----->|                       |                        |
  |                           |                       |-- MongoDBAdapter ------>|
  |                           |                       |<-- user doc -----------|
  |                           |                       |-- jwt callback ------->|
  |                           |                       |   (cache isAdmin,      |
  |                           |                       |    isApproved in token) |
  |<-- Set JWT cookie --------|                       |                        |
  |                           |                       |                        |
  |-- GET /meal-plans ------->|                       |                        |
  |                           |-- getToken() -------->|                        |
  |                           |<-- valid JWT ---------|                        |
  |                           |-- NextResponse.next() |                        |
```

### Key Components

**NextAuth Configuration** (`src/lib/auth.ts`):
- **Provider:** Google OAuth via `GoogleProvider`
- **Adapter:** `MongoDBAdapter(clientPromise)` -- stores user accounts in MongoDB
- **Session strategy:** JWT (no server-side sessions)
- **JWT callback:** On `signIn`, `signUp`, or when `isAdmin` is `undefined`, queries the `users` collection to cache `isAdmin` and `isApproved` in the token. Subsequent requests skip the DB query.
- **Session callback:** Forwards `token.sub` as `session.user.id`, plus `isAdmin` and `isApproved`. No DB query.
- **Redirect callback:** Restricts redirects to same-origin URLs.

**Type Augmentation** (`src/types/next-auth.d.ts`):
- `Session.user` is extended with `id: string`, `isAdmin: boolean`, `isApproved: boolean`
- `JWT` is extended with `isAdmin?: boolean`, `isApproved?: boolean`

**Middleware** (`src/middleware.ts`):
- Runs on all routes except `/`, `/api/auth/*`, `/_next/*`, `/static/*`, `/manifest.json`, and files with extensions
- Calls `getToken()` to check for a valid JWT
- Redirects unauthenticated users to `/` with `callbackUrl` preserved in query params

**API Route Guards:**
- Every API route calls `getServerSession(authOptions)` and returns 401 if no session
- Admin routes additionally check `session.user.isAdmin` and return 403

**Approval Gate** (`src/lib/use-approval-status.ts`):
- `useApprovalStatus()` polls `GET /api/user/approval-status` every 60 seconds
- If approval status changes (approved -> unapproved or vice versa), calls `session.update()` then redirects via `router.push`
- Used by `AuthenticatedLayout` to gate access to the app for unapproved users

---

## Real-Time Architecture

Ably provides real-time shopping list synchronization between users who share a store.

### Components

| Component | File | Role |
|-----------|------|------|
| Server publisher | `src/lib/realtime/ably-server.ts` | Singleton `Ably.Rest` client. `publishShoppingEvent(storeId, name, data)` publishes to `shopping-store:{storeId}`. |
| Client singleton | `src/lib/realtime/ably-client.ts` | Lazy-loaded `Ably.Realtime` client. Authenticates via `authUrl: '/api/ably/token'`. `echoMessages: false` prevents receiving own messages. |
| Token endpoint | `GET /api/ably/token` | Issues Ably token requests using the server-side `ABLY_API_KEY`. |
| Sync hook | `src/lib/hooks/use-shopping-sync.ts` | `useShoppingSync(options)` -- manages channel subscription, presence, and reconnection. |

### Channel and Events

- **Channel:** `shopping-store:{storeId}`
- **Events:**

| Event | Published by | Data | Purpose |
|-------|-------------|------|---------|
| `item_checked` | Toggle endpoint (`PATCH .../toggle`) | `{ foodItemId, checked, updatedBy, timestamp }` | Single item check/uncheck |
| `list_updated` | Shopping list PUT endpoint | `{ items, updatedBy, timestamp }` | Full list replacement (add/edit items) |
| `item_deleted` | Shopping list PUT endpoint | `{ foodItemId, updatedBy, timestamp }` | Item removed from list |

### Presence

Users enter presence on the channel with `{ email, name }`. The hook tracks `ActiveUser[]` and exposes it for display as badges in the shopping list dialog header. Presence enter/leave events trigger a full presence member refresh.

### Reconnection

`useShoppingSync` implements exponential backoff with jitter for auto-reconnect:
- Base delay: `min(30s, 500ms * 2^(attempt-1))`
- Jitter: 0-250ms random addition
- Resets on successful connection
- Configurable via `autoReconnect` option (default: `true`)

### Access Control

Server API routes validate store access before publishing events: the user must be the store owner (`store.userId === session.user.id`) or have an accepted invitation in `store.invitations[]`.

---

## Database

All collections, their purpose, and key indexes. The authoritative index definitions are in `src/lib/database-indexes.ts`.

### Collections

| Collection | Purpose | Key Indexes |
|------------|---------|-------------|
| `users` | User accounts (managed by NextAuth adapter). Extended with `isAdmin`, `isApproved`, and `settings` (contains sharing invitations, theme preference). | `email` (unique), `isApproved` |
| `mealPlans` | Weekly meal plans with day slots containing recipe and food item references. | `userId + startDate`, `userId + createdAt`, `templateId` |
| `mealPlanTemplates` | One template per user defining their default meal plan structure. | `userId` (unique) |
| `recipes` | Recipes with grouped ingredients (food items or nested sub-recipes), markdown instructions, tags, and emoji. Can be user-scoped or global. | `createdBy + isGlobal`, `isGlobal`, `title`, `isGlobal + createdBy + updatedAt` (pagination) |
| `recipeUserData` | Per-user recipe metadata: personal tags and ratings. Separated from recipes to avoid write conflicts on shared recipes. | `userId + recipeId` (unique) |
| `foodItems` | Food item catalog with singular/plural names and default unit. Can be user-scoped or global. | `createdBy + isGlobal`, `isGlobal`, `name` |
| `pantry` | Tracks which food items a user has on hand. | `userId`, `userId + foodItemId` (unique) |
| `stores` | Stores (shopping locations) owned by a user. Contains embedded `invitations[]` array for sharing. | (no custom indexes beyond `_id`) |
| `shoppingLists` | One shopping list per store. Contains `items[]` array of food items with quantity, unit, and checked state. | `storeId` (unique) |
| `storeItemPositions` | Per-store item ordering for custom aisle/layout sorting in shopping mode. | `storeId + foodItemId` (unique), `storeId + position` |
| `purchaseHistory` | Tracks last purchase details per food item per store, used for auto-suggest. | `storeId + foodItemId` (unique), `storeId + lastPurchasedAt` |

### Sharing Model

Sharing uses embedded invitation arrays rather than separate junction collections:

- **Meal plan sharing:** `users.settings.mealPlanSharing.invitations[]` -- each `MealPlanSharingInvitation` contains `{ userId, userEmail, userName?, status, invitedBy, invitedAt }`. Status is `pending`, `accepted`, or `rejected`.
- **Recipe sharing:** `users.settings.recipeSharing.invitations[]` -- each `RecipeSharingInvitation` adds a `sharingTypes: ('tags' | 'ratings')[]` field to control what metadata is shared.
- **Store sharing:** `stores.invitations[]` -- each `StoreInvitation` contains `{ userId, userEmail, status, invitedBy, invitedAt }`. Accepted invitations grant access to the store's shopping list and real-time sync.

### Access Pattern

```typescript
const client = await getMongoClient();
const db = client.db();
const collection = db.collection('recipes');
// Direct MongoDB driver operations -- no ORM
```

---

## Key Subsystems

### Unit Deconfliction Engine

**File:** `src/lib/meal-plan-to-shopping-list.ts`
**Supporting:** `src/lib/unit-conversion.ts`

When populating a shopping list from meal plans, ingredients must be combined intelligently:

1. **Recursive extraction:** `extractFoodItemsFromMealPlans()` walks all meal plans, extracting food items from direct entries, recipes, ingredient groups, and nested sub-recipes. Tracks visited recipe IDs to prevent circular references (max depth: 50).

2. **Pre-merge combination:** `combineExtractedItems()` groups extracted items by `foodItemId`:
   - **Same unit:** Quantities are silently summed.
   - **Same family (e.g., cups + tablespoons):** Flagged as a conflict with `isAutoConverted: true` and pre-computed `suggestedQuantity`/`suggestedUnit` via `pickBestUnit()`.
   - **Cross-family (e.g., cups + pounds):** Flagged as a conflict with `isAutoConverted: false` for manual resolution.

3. **Merge with existing list:** `mergeWithShoppingList()` merges extracted items into an existing shopping list, applying the same unit-matching logic and producing conflicts for user review.

**Unit conversion** (`unit-conversion.ts`) wraps the `convert` library:
- `areSameFamily(unitA, unitB)` -- checks if two app units are both volume or both weight
- `tryConvert(quantity, from, to)` -- converts between app units, returns `null` on failure
- `pickBestUnit(quantity, unit)` -- converts to the most human-readable unit in the same family (imperial preference)
- Maps app unit names (e.g., `"teaspoon"`) to/from the `convert` library's identifiers (e.g., `"teaspoons"`)

### Server-Side Pagination

**File:** `src/lib/pagination-utils.ts`

Provides two utilities used by API routes:

- `parsePaginationParams(searchParams, defaults?)` -- extracts `page`, `limit` (clamped 1-100), `sortBy`, and `sortOrder` from URL search params with configurable defaults.
- `paginatedResponse(collection, filter, params)` -- runs parallel `find().sort().skip().limit()` and `countDocuments()` queries, returns `{ data, total, page, limit, totalPages }`.

Client-side consumption via `useServerPagination` hook, which manages page/sort state and calls the paginated API.

### Dialog Persistence

**File:** `src/lib/hooks/use-dialog.ts` (`usePersistentDialog`)

Encodes dialog state in URL search params to survive refresh and support browser history:

- `openDialog(data?)` sets `?{dialogKey}=true` plus `?{dialogKey}_{dataKey}=value` for each data entry, then calls `router.push()` after a 200ms `setTimeout`
- `closeDialog()` removes all dialog-related params and calls `router.replace()` after a 100ms `setTimeout`
- `removeDialogData(key)` removes a single data key
- The `setTimeout` delays work around Next.js App Router internal navigation conflicts that can cause dropped updates

---

## Custom Hooks Reference

All custom hooks, their locations, and what they do.

| Hook | File | Purpose | Pattern |
|------|------|---------|---------|
| `useFoodItems` | `src/lib/hooks/use-food-items.ts` | Fetches all food items on mount; provides `foodItemsMap` (ID-to-name lookup), `addFoodItem()`, and `refetch()`. | Fetch-on-mount, local state |
| `useSearchPagination` | `src/lib/hooks/use-search-pagination.ts` | Client-side search filtering and pagination over an in-memory array. Uses `useTransition` for non-blocking search updates. | Client-side filter + paginate |
| `useServerPagination` | `src/lib/hooks/use-server-pagination.ts` | Drives server-side paginated API calls. Manages page, sort, and filter state; auto-fetches on param change. Accepts a `fetchFn` and optional `filterKey` to reset page on filter change. | Server-side fetch on param change |
| `useShoppingSync` | `src/lib/hooks/use-shopping-sync.ts` | Manages Ably real-time connection for shopping list collaboration. Handles channel subscribe/unsubscribe, presence tracking, connection state, and exponential-backoff reconnection. | Event-driven, WebSocket |
| `useDialog` | `src/lib/hooks/use-dialog.ts` | Minimal open/close/toggle state for dialogs. | Local boolean state |
| `useConfirmDialog` | `src/lib/hooks/use-dialog.ts` | Dialog state with typed data payload for confirmation flows. | Local state with generic `<T>` |
| `usePersistentDialog` | `src/lib/hooks/use-dialog.ts` | Dialog state persisted in URL search params. Survives refresh, supports browser back/forward. | URL search params |
| `useRecipeModal` | `src/lib/hooks/use-dialog.ts` | Pre-configured `usePersistentDialog('recipe')`. | URL search params |
| `useFoodItemModal` | `src/lib/hooks/use-dialog.ts` | Pre-configured `usePersistentDialog('foodItem')`. | URL search params |
| `useMealPlanModal` | `src/lib/hooks/use-dialog.ts` | Pre-configured `usePersistentDialog('mealPlan')`. | URL search params |
| `useDebouncedSearch` | `src/lib/hooks/use-debounced-search.ts` | Debounced search input (configurable delay, default 300ms). Fires `onSearch` callback after debounce settles. Skips initial mount. | Debounced state |
| `useFoodItemSelector` | `src/lib/hooks/use-food-item-selector.ts` | Combined food item and recipe search/selection with autocomplete behavior. Supports local filtering or API search, keyboard navigation, and a "create new" callback. 750ms debounce. | Debounced search + selection |
| `useFoodItemCreator` | `src/lib/hooks/use-food-item-creator.ts` | Manages the create-food-item dialog flow: open with prefill, POST to API, optionally add to pantry, notify parent. | Dialog + API mutation |
| `useQuantityInput` | `src/lib/hooks/use-quantity-input.ts` | Quantity input validation: parses numeric input, manages error state for non-positive values, provides display value (empty string for zero). | Controlled input |
| `useApprovalStatus` | `src/lib/use-approval-status.ts` | Polls `GET /api/user/approval-status` every 60 seconds. Detects approval/revocation changes and triggers session update + redirect. | Polling interval |
| `useTheme` | `src/lib/theme-context.tsx` | Consumes `ThemeContext` to access current `mode`, `setMode`, and `isDark`. | React context consumer |
