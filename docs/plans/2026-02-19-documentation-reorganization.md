# Documentation Reorganization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the conductor/ directory and scattered docs/ files with 5 clean documentation files plus an updated CLAUDE.md hub.

**Architecture:** Delete stale files first, then write 5 new docs files in parallel (architecture.md, api-patterns.md, testing.md, setup.md, product.md), update CLAUDE.md to link to them, delete absorbed files, delete conductor/, and commit.

**Tech Stack:** Markdown documentation only. No code changes.

---

### Task 1: Delete stale files

These files have no content worth extracting. Delete them outright.

**Files:**
- Delete: `README.md`
- Delete: `docs/TODO.md`
- Delete: `docs/manual-testing-recipe-search-fix.md`
- Delete: `docs/BUILD_ERRORS.md`
- Delete: `docs/food-item-input-architecture-plan.md`
- Delete: `docs/food-item-input-migration-progress.md`

**Step 1: Delete files**

```bash
git rm README.md docs/TODO.md docs/manual-testing-recipe-search-fix.md docs/BUILD_ERRORS.md docs/food-item-input-architecture-plan.md docs/food-item-input-migration-progress.md
```

**Step 2: Commit**

```bash
git commit -m "docs: delete stale documentation files"
```

---

### Task 2: Write docs/architecture.md

The richest document. Synthesize from codebase exploration findings + existing docs.

**Files:**
- Create: `docs/architecture.md`
- Read for content: `conductor/docs/architecture.md`, `conductor/tech-stack.md`, `docs/authentication-security.md`, `docs/shopping-sync.md`, `docs/modal-persistence.md`, `docs/state-management-refactor.md`
- Read for accuracy: `src/lib/auth.ts`, `src/lib/theme-context.tsx`, `src/lib/hooks/` (all hooks), `src/lib/meal-plan-to-shopping-list.ts`, `src/lib/unit-conversion.ts`, `src/lib/pagination-utils.ts`, `src/lib/database-indexes.ts`, `src/lib/realtime/ably-server.ts`, `src/lib/realtime/ably-client.ts`

**Sections to include (in order):**

1. **Tech Stack** — Next.js 15 (App Router, Turbopack dev), React 19, MUI v7 + Emotion, MongoDB 6 + native driver, NextAuth 4 (Google OAuth, JWT strategy), Ably (real-time pub/sub), @dnd-kit (drag-drop), date-fns, jonahsnider/convert (unit math), react-markdown. Brief rationale for key choices.

2. **Feature Routes** — All 8 authenticated routes + landing + pending-approval. For each: URL, what it does, key UI patterns (e.g., server-paginated, URL-persistent dialogs, dynamic imports). Keep to 2-3 sentences each.

3. **State Management** — Three layers:
   - ThemeContext (the only React context): reads from cookies on load, fetches user preference after auth, listens to `themeChange` DOM events, persists to cookies
   - Custom hooks for per-feature data fetching: no shared cache, each page fetches independently, hooks provide refetch() callbacks
   - URL state for dialogs via usePersistentDialog: dialog open state + entity IDs encoded in URL search params, browser back button works

4. **Authentication Flow** — End-to-end:
   - Google OAuth via NextAuth → MongoDBAdapter creates/updates user
   - JWT callback caches isAdmin/isApproved from DB into token (no DB call per request after sign-in)
   - Session callback forwards token fields to session.user (typed via next-auth.d.ts augmentation)
   - Middleware (src/middleware.ts) checks JWT on all routes, redirects unauthenticated to / with callbackUrl
   - API routes check getServerSession(authOptions) for second-layer auth
   - Approval gate: new users have isApproved=false, useApprovalStatus polls every 60s, redirects to /pending-approval until admin approves

5. **Real-Time Architecture** — Ably for shopping list sync:
   - Client authenticates via GET /api/ably/token (Ably.Realtime with authUrl)
   - Channel per store: `shopping-store:{storeId}`
   - Three events: item_checked, list_updated, item_deleted (each with updatedBy, timestamp)
   - Presence tracking: email + name, so users see who's actively viewing
   - Server publishes via Ably.Rest singleton (src/lib/realtime/ably-server.ts) — no persistent server connection
   - Client uses useShoppingSync hook with exponential backoff reconnect (500ms base, doubles, capped at 30s)

6. **Database** — Table of all 12 collections with purpose and key indexes:
   - users, mealPlans, mealPlanTemplates, recipes, recipeUserData, foodItems, pantry, stores, shoppingLists, storeItemPositions, purchaseHistory
   - Sharing model: embedded invitation arrays in users.settings (not separate collections) for both meal plan and recipe sharing
   - Store sharing: embedded invitations array in the stores document
   - Authoritative index definitions in src/lib/database-indexes.ts

7. **Key Subsystems:**
   - Unit deconfliction engine (src/lib/meal-plan-to-shopping-list.ts): recursive recipe ingredient extraction (cycle-detected, 50-level depth limit), same-unit summing, cross-family conflict detection with auto-computed conversion suggestions
   - Server-side pagination (src/lib/pagination-utils.ts): parsePaginationParams normalizes URL params, paginatedResponse runs find+countDocuments in parallel
   - Dialog persistence (src/lib/hooks/use-persistent-dialog.ts): URL search params encode dialog state, 100-200ms setTimeout avoids Next.js router conflicts

8. **Custom Hooks Reference** — Table of all hooks in src/lib/hooks/ with name, purpose, and pattern. Include useApprovalStatus from src/lib/use-approval-status.ts.

**Step 1: Read source files listed above for accuracy**

Read the actual source files to verify details before writing. Don't rely solely on the exploration summaries.

**Step 2: Write docs/architecture.md**

Write the complete file with all 8 sections. Cross-reference source files for accuracy. Keep each section focused — this is reference documentation, not a tutorial.

**Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: add architecture reference"
```

---

### Task 3: Write docs/api-patterns.md

**Files:**
- Create: `docs/api-patterns.md`
- Read for content: `conductor/docs/api-patterns.md`
- Read for accuracy: `src/app/api/food-items/route.ts` (canonical GET+POST), `src/app/api/recipes/route.ts` (complex GET with aggregation), `src/lib/errors.ts`, `src/lib/pagination-utils.ts`, `src/lib/validation.ts`

**Sections to include:**

1. **Route Structure** — REST URL patterns, Next.js 15 route handler format (export async function GET/POST/PUT/DELETE), dynamic route params are async (`const { id } = await params`)

2. **Authentication** — Standard pattern:
   ```ts
   const session = await getServerSession(authOptions);
   if (!session?.user?.id) {
     return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
   }
   ```
   Admin routes additionally check `session.user.isAdmin` → 403 with AUTH_ERRORS.FORBIDDEN.

3. **Error Handling** — try/catch wrapping entire handler body, `logError('ContextName', error)` in catch, error constants from `@/lib/errors` (AUTH_ERRORS, MEAL_PLAN_ERRORS, RECIPE_ERRORS, FOOD_ITEM_ERRORS, PANTRY_ERRORS, STORE_ERRORS, SHOPPING_LIST_ERRORS, API_ERRORS). Response shape: `{ error: string }`.

4. **Validation** — ObjectId: `ObjectId.isValid(id)` before querying. Body: explicit field-by-field checks. Dates: `isValidDateString()` from `@/lib/validation`. Email: `email.includes('@')`.

5. **Response Formats** — Three patterns:
   - Single resource: `NextResponse.json(document)` (raw MongoDB doc with _id)
   - Paginated list: `NextResponse.json({ data, total, page, limit, totalPages })`
   - Action confirmation: `NextResponse.json({ success: true })` or `{ message: '...' }`

6. **Database Access** — Singleton pattern: `const client = await getMongoClient(); const db = client.db(); const collection = db.collection('name');`. No database name passed to db() — uses connection string default.

7. **Pagination** — `parsePaginationParams(searchParams)` normalizes page/limit/sortBy/sortOrder. `paginatedResponse(collection, query, options)` runs find+countDocuments in parallel.

**Step 1: Read source files for accuracy**

**Step 2: Write docs/api-patterns.md**

**Step 3: Commit**

```bash
git add docs/api-patterns.md
git commit -m "docs: add API patterns reference"
```

---

### Task 4: Rewrite docs/testing.md

**Files:**
- Rewrite: `docs/testing.md`
- Read for content: current `docs/testing.md`, `conductor/docs/testing-patterns.md`
- Read for accuracy: `vitest.config.ts`, `vitest.setup.ts`, `react-act.setup.ts`, `eslint.config.mjs`
- Read for examples: `src/app/api/food-items/__tests__/route.test.ts` (canonical API test), `src/components/__tests__/IngredientInput.behavior.test.tsx` (component test), `src/lib/hooks/__tests__/use-food-items.test.tsx` (hook test)

**Sections to include:**

1. **Configuration** — Vitest with jsdom, fork pool with singleFork (serialized for isolation), 20s timeout, V8 coverage. Path alias `@/` mirrors tsconfig.

2. **Setup Files** — Order matters:
   - `react-act.setup.ts` (first): sets `IS_REACT_ACT_ENVIRONMENT=true`, polyfills `ReadableStream` on globalThis for Next.js/undici compatibility
   - `vitest.setup.ts` (second): imports jest-dom matchers, mocks MUI transition components (Collapse, Fade, Grow, Slide, Zoom) as passthroughs to avoid act() warnings, starts MSW server with baseline handlers for `/api/food-items` and `/api/recipes`, sets fake MONGODB_URI

3. **Mocking Patterns** — Four patterns with code examples:
   - MongoDB: chainable mock structure (find → sort → skip → limit → toArray), multi-collection discrimination by name
   - NextAuth: `vi.mock('next-auth/next')` for API routes, `vi.mock('next-auth/react')` for components
   - MSW: baseline handlers in vitest.setup.ts, per-test overrides via `server.use()`, `server.resetHandlers()` in afterEach
   - `@/lib/errors`: MUST mock ALL error constant groups the route imports (missing ones cause silent 500 errors in tests)

4. **API Route Testing** — Key patterns:
   - Dynamic import after mocks: declare all vi.mock() calls first, then `const routes = await import('../route')`
   - Minimal request objects: `const makeReq = (url, body) => ({ url, json: async () => body } as any)`
   - Next.js 15 async params: `{ params: Promise.resolve({ id: '...' }) }`
   - Verify DB call structure: inspect mock arguments for correct queries, sort, skip, limit

5. **Component Testing** — Key patterns:
   - `userEvent.setup()` (not fireEvent)
   - `act()` wrapping for async state updates
   - MUI Autocomplete: click combobox role → find listbox → select option
   - Debounced inputs: `waitFor({ timeout: 2000-3000 })` for debounce callbacks
   - React Strict Mode: use `queryAllBy` with `.length > 0` instead of exact counts

6. **Hook Testing** — TestComponent harness:
   ```tsx
   let latestState;
   const TestComponent = () => { latestState = useMyHook(); return null; };
   render(<TestComponent />);
   ```

7. **Running Tests** — Commands: `npm test`, `npm run test:watch`, `npm run test:coverage`, `npm run check`

**Step 1: Read source files for accuracy**

**Step 2: Write docs/testing.md (full rewrite)**

**Step 3: Commit**

```bash
git add docs/testing.md
git commit -m "docs: rewrite testing reference"
```

---

### Task 5: Write docs/setup.md

**Files:**
- Create: `docs/setup.md`
- Read for content: `docs/SETUP.md`, `docs/MONGODB_MIGRATION.md`, `docs/LINTING.md`
- Read for accuracy: `package.json` (scripts), `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.github/workflows/ci.yml`, `scripts/setup-database.js`, `scripts/setup-ubuntu.sh`, `scripts/migrate-mongodb.sh`, `scripts/worktree-create.sh`

**Sections to include:**

1. **Prerequisites** — Node 20, MongoDB 8.0 Community, Google OAuth credentials (Google Cloud Console), Ably API key

2. **Environment Variables** — Table of 6 required vars in `.env.local`: MONGODB_URI, NEXTAUTH_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ABLY_API_KEY. With descriptions and example values (not real secrets).

3. **First-Time Setup** — `scripts/setup-ubuntu.sh` for Ubuntu MongoDB install. Manual steps for other platforms. `npm install` (runs postinstall → setup-db automatically). Google OAuth setup steps (redirect URI, authorized origins).

4. **Database** — Index creation via `npm run setup-db` / `scripts/setup-database.js`. Authoritative index list in `src/lib/database-indexes.ts`. Postinstall hook runs setup-db automatically.

5. **Dev Server** — `npm run dev` (includes DB setup), `npm run dev:fast` (skip setup), `npm run dev:clean` (clears .next first). Turbopack used for dev. The .next cache gotcha (crashes after build, fix with `rm -rf .next`).

6. **Linting** — `npm run lint`, `npm run lint -- --fix`. ESLint flat config (v9) extending next/core-web-vitals + next/typescript. Test files have relaxed rules (no-explicit-any off, no-unused-vars off). Editor integration: VS Code ESLint extension auto-fixes on save.

7. **Worktree Workflow** — Commands (create/list/remove), isolation table (port, DB, node_modules, .env.local, .next), rules for parallel agents. Reference CLAUDE.md for quick reference.

8. **Database Migration** — `scripts/migrate-mongodb.sh export` (mongodump → .tar.gz), `scripts/migrate-mongodb.sh import` (mongorestore). For moving data between machines.

9. **CI** — GitHub Actions on push/PR to main and develop. Steps: lint (--max-warnings=0), test with coverage (fake env vars), upload coverage to Codecov. Does NOT run next build (only local `npm run check` does that).

10. **Project Configuration** — Brief reference to key config files: next.config.ts (ESLint disabled during builds, Google image domain, 30-day cache TTL), tsconfig.json (strict, bundler resolution, @/ alias), eslint.config.mjs (flat config, test relaxations).

**Step 1: Read source files for accuracy**

**Step 2: Write docs/setup.md**

**Step 3: Commit**

```bash
git add docs/setup.md
git commit -m "docs: add setup and development guide"
```

---

### Task 6: Write docs/product.md

**Files:**
- Create: `docs/product.md`
- Read for content: `conductor/product.md`, `conductor/product-guidelines.md`, `conductor/workflow.md`

**Sections to include:**

1. **Product Vision** — What Weekly Eats is (household meal planning app), target users (individuals and families who plan meals weekly), the problem (coordinating what to eat, what to buy, what you have)

2. **Core Features** — Brief description of each:
   - Meal Planning: weekly plans from templates, configurable start day and meal types, weekly staples, sharing between household members
   - Recipes: create/edit with ingredient groups, tags, ratings, sharing (tags and/or ratings separately)
   - Shopping Lists: per-store lists, populate from meal plans (with unit deconfliction), drag-drop reordering, real-time sync between users, purchase history via "Finish Shop" workflow
   - Food Items: global catalog (admin-managed) + personal items, singular/plural names, unit types
   - Pantry: track what you have, exclude pantry items from shopping lists
   - Settings: theme (light/dark/system), default meal plan owner
   - User Management: admin approval workflow, admin/user roles
   - Sharing: meal plan sharing and recipe sharing via email invitations

3. **UX Guidelines** — MUI components throughout, responsive design (full-screen dialogs on mobile via responsiveDialogStyle), functional/friendly tone, skeleton loading states on every route, error boundaries on every route, dynamic imports for heavy dialogs

4. **Development Principles** — TDD approach, >80% test coverage target, lint with zero warnings, `npm run check` before pushing, worktree isolation for parallel work

**Step 1: Read conductor files for content**

**Step 2: Write docs/product.md**

**Step 3: Commit**

```bash
git add docs/product.md
git commit -m "docs: add product vision and guidelines"
```

---

### Task 7: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Changes:**

1. Add a "Documentation" section after "Quick Reference" that links to the 5 docs files:
   ```markdown
   ## Documentation

   - **[Architecture](docs/architecture.md)** — system design, features, state management, auth, real-time, database
   - **[API Patterns](docs/api-patterns.md)** — REST conventions, auth, validation, error handling, responses
   - **[Testing](docs/testing.md)** — Vitest setup, mocking patterns, component/API/hook testing
   - **[Setup](docs/setup.md)** — environment, database, dev server, worktrees, CI, migration
   - **[Product](docs/product.md)** — product vision, features, UX guidelines, development principles
   ```

2. Add code style conventions to the "Conventions" section (after the existing subsections):
   ```markdown
   ### Code Style

   - File naming: PascalCase for components (`MealEditor.tsx`), kebab-case for utilities (`date-utils.ts`)
   - TypeScript: prefer interfaces over type aliases, use `unknown` over `any`, avoid type assertions (`as`)
   - Exports: named exports only (no default exports)
   - Directives: `"use client"` at top of interactive components
   ```

**Step 1: Edit CLAUDE.md with both changes**

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add documentation links and code style to CLAUDE.md"
```

---

### Task 8: Delete absorbed files and conductor/

All content from these files has been extracted into the new docs. Delete them.

**Files:**
- Delete: `docs/authentication-security.md`
- Delete: `docs/shopping-sync.md`
- Delete: `docs/modal-persistence.md`
- Delete: `docs/state-management-refactor.md`
- Delete: `docs/user-management-api-tests.md`
- Delete: `docs/SETUP.md`
- Delete: `docs/MONGODB_MIGRATION.md`
- Delete: `docs/LINTING.md`
- Delete: `conductor/` (entire directory, 42 files)

**Step 1: Delete absorbed docs**

```bash
git rm docs/authentication-security.md docs/shopping-sync.md docs/modal-persistence.md docs/state-management-refactor.md docs/user-management-api-tests.md docs/SETUP.md docs/MONGODB_MIGRATION.md docs/LINTING.md
```

**Step 2: Delete conductor directory**

```bash
git rm -r conductor/
```

**Step 3: Commit**

```bash
git commit -m "docs: remove conductor/ and absorbed doc files"
```

---

### Task 9: Final validation

**Step 1: Verify final structure**

```bash
ls docs/
```

Expected output:
```
api-patterns.md
architecture.md
plans/
product.md
setup.md
testing.md
```

**Step 2: Verify no broken references**

Search for any remaining references to deleted files or conductor/:
```bash
grep -r "conductor" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.js" .
grep -r "SETUP\.md\|BUILD_ERRORS\|TODO\.md\|LINTING\.md\|MONGODB_MIGRATION" --include="*.md" .
```

Fix any stale references found.

**Step 3: Run check to verify nothing is broken**

```bash
npm run check
```

Expected: lint passes, tests pass, build succeeds.

**Step 4: Commit any fixes**

If Step 2 or 3 found issues, fix and commit.

---

## Parallelization Notes

Tasks 2-6 (writing the 5 new docs files) are fully independent and can be dispatched in parallel. Each reads from different source files and writes to a different output file.

Task 1 (delete stale files) should run first.
Task 7 (update CLAUDE.md) can run in parallel with Tasks 2-6.
Task 8 (delete absorbed files + conductor/) must wait for Tasks 2-6 to complete.
Task 9 (validation) must run last.
