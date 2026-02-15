# Product Guidelines

## Visual Identity

- **Design System:** Material UI (MUI) v7 with default theme
- **Icons:** MUI Icons (`@mui/icons-material`) throughout the app
- **Emoji Usage:** Recipes and food items use emoji for visual identification (e.g., recipe emoji, food category emoji via `FOOD_EMOJIS` constants)
- **Typography:** MUI default typography scale
- **Color Palette:** MUI default palette; no custom theme overrides detected

## UI Patterns

- **Navigation:** Bottom navigation bar (`BottomNav`) for mobile with icon+label items; `AppBar` header with profile menu for desktop
- **Layout:** Responsive design serving both desktop and mobile equally; pages use MUI `Box`, `Container`, and grid layouts
- **Dialogs:** MUI `Dialog` component for create/edit flows (e.g., `AddFoodItemDialog`); confirmation dialogs for destructive actions
- **Loading States:** `CircularProgress` spinner for session loading (`SessionWrapper`); inline loading indicators for data fetching
- **Lists & Tables:** MUI list components with search/filter bars; pagination via custom `Pagination` component
- **Drag & Drop:** `@dnd-kit` library for sortable meal plan items and ingredient ordering
- **Date Picking:** MUI X Date Pickers (`@mui/x-date-pickers`) with `date-fns` adapter

## Interaction Patterns

- **Forms:** Controlled inputs with React state; inline validation; autocomplete for food item/recipe selection
- **Real-time Updates:** Ably-powered live sync for shopping lists showing active users
- **Search:** Debounced search inputs with API-backed filtering
- **CRUD Operations:** Create via dialog modals; edit inline or via dedicated pages; delete with confirmation
- **Sharing/Invitations:** Email-based invitation flow for meal plan and store sharing

## Tone & Voice

- **Functional and friendly** - the app prioritizes getting things done quickly
- **Minimal text** - labels are concise; actions are icon-driven where possible
- **Emoji as visual shorthand** - recipes and food items use emoji to make lists scannable
- **Error messages** use centralized constants for consistency (from `src/lib/errors.ts`)

## Accessibility

- **Semantic HTML** via MUI components (buttons, inputs, labels)
- **ARIA labels** on interactive elements (autocomplete inputs, icon buttons)
- **Keyboard navigation** supported through MUI default behavior

## Code Quality Standards

- **"use client"** directive on all interactive components
- **TypeScript strict mode** with explicit interfaces for all data types
- **No inline styles** - use MUI `sx` prop for styling
- **Custom hooks** encapsulate complex state logic (e.g., `useRecipes`, `useFoodItems`, `useDialog`)

## Quick Reference - Key Rules

1. Components: PascalCase files, default exports, `"use client"` directive
2. Utilities/hooks: kebab-case files, named exports, barrel re-exports in `index.ts`
3. Constants: UPPER_SNAKE_CASE in dedicated modules
4. API routes: REST with `NextResponse.json()`, centralized error constants from `src/lib/errors.ts`
5. Testing: Vitest + Testing Library + MSW, co-located `__tests__/` directories
6. State: React hooks only (no global state library), custom hooks for domain logic
7. Styling: MUI `sx` prop, no inline styles or CSS modules
8. Auth: `getServerSession(authOptions)` check on every API route
9. Database: MongoDB native driver, `ObjectId.createFromHexString()` for IDs
10. Real-time: Ably client singleton for shopping list collaboration

## Detailed Documentation

- [Code Conventions](docs/code-conventions.md)
- [Architecture](docs/architecture.md)
- [Testing Patterns](docs/testing-patterns.md)
- [API Patterns](docs/api-patterns.md)
