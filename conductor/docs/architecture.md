# Architecture

> Detected from codebase analysis (Confidence: HIGH)

## Project Structure

```
src/
├── app/                          # Next.js App Router pages + API routes
│   ├── api/                      # REST API endpoints (40+ route.ts files)
│   │   ├── admin/users/          # Admin user management
│   │   ├── ably/token/           # Ably real-time token endpoint
│   │   ├── food-items/           # Food item CRUD
│   │   ├── meal-plans/           # Meal plan CRUD + templates
│   │   ├── pantry/               # Pantry item CRUD
│   │   ├── recipes/              # Recipe CRUD + tags + ratings
│   │   ├── stores/               # Store/shopping list management
│   │   └── user/                 # User settings, sharing, approval
│   ├── food-items/               # Food items page
│   ├── meal-plans/               # Meal planning page
│   ├── pantry/                   # Pantry page
│   ├── pending-approval/         # Approval status page
│   ├── recipes/                  # Recipes page
│   ├── settings/                 # User settings page
│   ├── shopping-lists/           # Shopping lists page
│   ├── user-management/          # Admin user management page
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/                   # Shared React components
│   ├── __tests__/                # Component tests
│   ├── food-item-inputs/         # Food item input components
│   ├── optimized/                # Performance-optimized components
│   ├── shopping-list/            # Shopping list components
│   └── ui/                       # Generic UI components
├── lib/                          # Shared utilities and business logic
│   ├── __tests__/                # Utility tests
│   ├── context/                  # React context providers
│   ├── hooks/                    # Custom React hooks
│   ├── realtime/                 # Ably real-time client
│   ├── auth.ts                   # NextAuth configuration
│   ├── mongodb.ts                # MongoDB client singleton
│   ├── errors.ts                 # Centralized error constants
│   └── *-utils.ts                # Domain-specific utilities
└── types/                        # TypeScript type definitions
    ├── recipe.ts
    ├── meal-plan.ts
    ├── shopping-list.ts
    ├── pantry.ts
    └── next-auth.d.ts            # NextAuth type augmentation
```

## Data Flow

```
User Action → React Component → Custom Hook / Fetch API → Next.js API Route → MongoDB
                                                              ↓
                                    ← JSON Response ← NextResponse.json()
```

## State Management

- **No global state library** (no Redux, Zustand, etc.)
- **React hooks** (`useState`, `useEffect`, `useCallback`, `useRef`) for local state
- **Custom hooks** in `src/lib/hooks/` encapsulate domain logic:
  - `useRecipes` - recipe state with fetch/create/update
  - `useFoodItems` - food items with memoized lookup map
  - `useDialog` / `useConfirmDialog` - modal state management
  - `useShoppingSync` - Ably real-time shopping collaboration
  - `useSearchPagination` - search + pagination state
- **React Context** in `src/lib/context/` for cross-component data sharing

## Authentication Flow

1. NextAuth handles sign-in via configured providers
2. `getServerSession(authOptions)` verifies session in API routes
3. `session.user.id` used to scope data access
4. Admin routes check `isAdmin` flag
5. New users enter `pending-approval` flow until admin approves

## Real-time Architecture

- **Ably** provides WebSocket messaging for shopping list collaboration
- Token-based auth via `/api/ably/token` endpoint
- Client singleton in `src/lib/realtime/ably-client.ts`
- `useShoppingSync` hook manages channel subscriptions and active user tracking

## Database Pattern

- MongoDB native driver (no ORM/ODM like Mongoose)
- `getMongoClient()` singleton in `src/lib/mongodb.ts`
- Direct collection operations: `find`, `insertOne`, `updateOne`, `deleteOne`
- `ObjectId.createFromHexString()` for ID conversion
- Upsert pattern for user-specific data (ratings, settings)
