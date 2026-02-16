# Weekly Eats

Meal planning app built with Next.js 15 (App Router), React 19, MUI v7, MongoDB, and NextAuth.

## Quick Reference

- **Dev server**: `npm run dev` (includes DB setup) or `npm run dev:fast` (skip setup)
- **Tests**: `npm test` (single run) or `npm run test:watch` (watch mode)
- **Full validation**: `npm run check` (lint + test + build — run before pushing)
- **Lint**: `npm run lint`
- **CI**: GitHub Actions runs lint + test with coverage on pushes/PRs to `main` and `develop`

## Project Structure

```
src/
  app/
    api/          # API routes (Next.js route handlers)
    food-items/   # Feature pages
    meal-plans/
    pantry/
    pending-approval/
    recipes/
    settings/
    shopping-lists/
    user-management/
  components/     # React components
    ui/           # Reusable UI wrappers (DialogTitle, etc.)
    optimized/    # Performance-optimized components
    __tests__/    # Component tests
  lib/
    hooks/        # Custom React hooks (useRecipes, useFoodItems, etc.)
    __tests__/    # Utility tests
    auth.ts       # NextAuth config
    mongodb.ts    # MongoDB connection singleton
    errors.ts     # Centralized error constants
    validation.ts # Input validation helpers
    *-utils.ts    # Domain-specific utilities
  types/          # TypeScript interfaces
```

## Conventions

### API Routes

- Check auth first: `const session = await getServerSession(authOptions)`
- Return `{ error: AUTH_ERRORS.UNAUTHORIZED }` with 401 if no session
- Admin routes check `user.isAdmin`, return 403 with `AUTH_ERRORS.FORBIDDEN`
- Session user has typed `id`, `isAdmin`, `isApproved` properties — never use `as` casts
- Auth uses JWT strategy; `isAdmin`/`isApproved` are cached in the token (see `src/lib/auth.ts`)
- Use error constants from `@/lib/errors` (never hardcode error strings)
- Log errors with `logError('ContextName', error)`
- Validate ObjectIds with `ObjectId.isValid(id)` before querying
- Always filter user-scoped data by `userId` from the session

### Components

- All interactive components need `"use client"` directive
- Use MUI components and `sx` prop for styling (no CSS files)
- Memoize with `React.memo` where appropriate
- Use custom hooks from `@/lib/hooks/` for data fetching
- Heavy dialog components are dynamically imported with `next/dynamic` (`{ ssr: false }`)
- Each feature route has `loading.tsx` (skeleton) and `error.tsx` (error boundary)

### Tests

- Colocated in `__tests__/` folders next to source files
- Vitest + React Testing Library + MSW for API mocking
- When mocking `@/lib/errors`, include ALL error constant groups the route uses (missing ones cause silent 500s)
- Mock next-auth: `vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))`
- Mock MongoDB: `vi.mock('@/lib/mongodb', () => ({ getMongoClient: vi.fn() }))`
- Use `userEvent.setup()` for user interactions (not fireEvent)
- Use `waitFor()` for async assertions

### Database

- MongoDB collections: `mealPlans`, `mealPlanTemplates`, `foodItems`, `recipes`, `recipeUserData`, `pantry`, `users`, `stores`, `storeItemPositions`, `shoppingLists`
- Access pattern: `const client = await getMongoClient(); const db = client.db();`
- Indexes defined in `src/lib/database-indexes.ts`, applied via `npm run setup-db`

## Gotchas

- **Build cache**: If `npm run check` fails with MODULE_NOT_FOUND, clear `.next` directory: `rm -rf .next`
- **ESM project**: `package.json` has `"type": "module"`. Any standalone `.js` scripts need `.cjs` extension to use `require()`.
- **Dynamic route params**: Next.js 15 params are async — use `{ params }: { params: Promise<{ id: string }> }` then `const { id } = await params;`
- **Test environment**: Tests need fake env vars to avoid real DB connections: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true`
- **`globals.css`**: Exists in `src/app/` for base resets only. All component styling uses MUI `sx` prop.

## Do Not Edit

- `.env.local` — contains secrets (MongoDB URI, NextAuth, Google OAuth, Ably keys)
- `package-lock.json` — modify only via npm commands
