# MCP Phase 1 — Service Layer + recipes/food-items Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a transport-agnostic service layer for recipes + food items, refactor the four existing HTTP routes to thin callers of it (behavior-preserving), and stand up a stateless `/api/mcp` Streamable-HTTP MCP server exposing recipes + food-items tools behind a non-production dev-token gate.

**Architecture:** Business logic moves from route handlers into `src/lib/services/{food-items,recipes}.ts`, which throw typed domain errors from `src/lib/service-errors.ts`. HTTP routes map those errors to status codes via `src/lib/api-error-response.ts`. MCP tools (`src/lib/mcp/tools/*`) are thin wrappers that resolve the authed `userId` from `extra.authInfo`, call the same service functions, and map domain errors to MCP `isError` results. Auth on the MCP route is a Phase-1 static dev token (`MCP_DEV_TOKEN`), enabled only when set **and** `NODE_ENV !== 'production'`. No OAuth — that is Phase 2.

**Tech Stack:** Next.js 15 App Router, React 19, MongoDB driver 6, `mcp-handler@1.1.0` over `@modelcontextprotocol/sdk@1.29.0`, `zod@3.23.8`, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-05-29-agent-connector-design.md` (§6.1, §6.3, §6.5, §8, §8a, §11). **Ledger:** `docs/superpowers/plans/mcp-connector-progress.md`.

---

## Scope & decisions (read before starting)

- **Phase 1 only.** Do **not** implement any OAuth AS endpoint, `verifyToken` hash/`mcpTokens` lookup, consent screen, `mcp*` collections, or database-index changes. Those are Phase 2. The only auth in this phase is the static dev token.
- **Four routes refactored:** `src/app/api/food-items/route.ts`, `src/app/api/food-items/[id]/route.ts`, `src/app/api/recipes/route.ts`, `src/app/api/recipes/[id]/route.ts`. Leave all other routes untouched (spec §12 "service extraction surface").
- **Behavior-preserving = existing route tests stay green unchanged.** Do **not** edit any existing `__tests__/route.test.ts`. They are the regression guard.
- **One intentional response-body refinement:** `food-items/[id]` GET/PUT/DELETE currently return `API_ERRORS.BAD_REQUEST` ("Bad request") for a malformed id. The shared service throws `ValidationError(FOOD_ITEM_ERRORS.INVALID_FOOD_ITEM_ID)` ("Invalid food item ID") instead — **same 400 status**, more accurate message. The existing tests only assert `res.status === 400` (verified), so they stay green. This is the ME convention ("malformed id → ValidationError with the right `@/lib/errors` constant") applied consistently.
- **A1 (isGlobal):** `createFoodItem` **service** keeps accepting `isGlobal` (HTTP path unchanged). The **MCP `food_items.create` tool** omits `isGlobal` from its input schema and passes `isGlobal: false`. The restriction lives in the tool, never the service.
- **Tool names use dots** (`food_items.search`) per spec §6.5. Task 11's smoke test registers them on a real `McpServer`, so if the SDK rejects dot-names the test fails immediately — fall back to underscores (`food_items_search`) and update the smoke test's expected list.
- **MCP route path:** `mcp-handler` requires a `[transport]` dynamic segment. We mount at `src/app/api/[transport]/route.ts` with `basePath: '/api'`, which makes the connector endpoint `/api/mcp` (transport segment `mcp` = Streamable HTTP) — matching the spec's intended `/api/mcp` endpoint. The spec's §6.1 illustrative path `src/app/api/mcp/route.ts` is superseded by this library requirement. Static sibling routes (`/api/recipes`, etc.) take precedence over the dynamic segment, so nothing else breaks. (Phase 2's `/api/mcp/oauth/*` routes live deeper and do not collide.)
- **Commit after every task.** Conventional-commit messages. Do not push (the long-lived draft PR #140 tracks the branch; pushing happens at end-of-phase per the ledger).
- **Per-task test command:** `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run <file>`. Final validation: `npm run check` (only when no dev server is running — Turbopack/build collide on `.next`).
- **Conventions:** named exports only; no `as` casts (except the `as const` literal-narrowing used in tool results); error strings come from `@/lib/errors`; `logError('Context', error)` for server-side logging; services must **not** import `next/server` (transport-agnostic).

---

## File structure

**Create:**

| File                                             | Responsibility                                                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/service-errors.ts`                      | Typed throwable domain errors (`ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`) extending a `ServiceError` base. Transport-agnostic. |
| `src/lib/api-error-response.ts`                  | Maps a caught `ServiceError` to a `NextResponse` with the right HTTP status; falls through to a logged 500. HTTP-only.                                     |
| `src/lib/services/food-items.ts`                 | `searchFoodItems`, `getFoodItem`, `createFoodItem`. Validation (incl. `ObjectId.isValid`), ownership, user-scoping, Mongo access.                          |
| `src/lib/services/recipes.ts`                    | `searchRecipes`, `getRecipe`, `createRecipe`, `updateRecipe`. Same responsibilities.                                                                       |
| `src/lib/mcp/tool-helpers.ts`                    | `getAuthContext(extra)`, `runTool(fn)` — shared auth-extraction + domain-error→`isError` mapping for tools.                                                |
| `src/lib/mcp/tools/food-items.ts`                | zod input shapes + handlers + `registerFoodItemTools(server)`.                                                                                             |
| `src/lib/mcp/tools/recipes.ts`                   | zod input shapes + handlers + `registerRecipeTools(server)`.                                                                                               |
| `src/lib/mcp/verify-token.ts`                    | Phase-1 dev-token `verifyToken` for `withMcpAuth` (inert in production).                                                                                   |
| `src/app/api/[transport]/route.ts`               | `createMcpHandler` + `withMcpAuth`; registers the tools; exports GET/POST/DELETE/OPTIONS.                                                                  |
| `src/lib/__tests__/service-errors.test.ts`       | Unit tests for the error classes + mapper.                                                                                                                 |
| `src/lib/services/__tests__/food-items.test.ts`  | Service unit tests (§8a).                                                                                                                                  |
| `src/lib/services/__tests__/recipes.test.ts`     | Service unit tests (§8a).                                                                                                                                  |
| `src/lib/mcp/__tests__/tool-helpers.test.ts`     | Helper unit tests.                                                                                                                                         |
| `src/lib/mcp/tools/__tests__/food-items.test.ts` | Tool unit tests (§8a).                                                                                                                                     |
| `src/lib/mcp/tools/__tests__/recipes.test.ts`    | Tool unit tests (§8a).                                                                                                                                     |
| `src/lib/mcp/__tests__/verify-token.test.ts`     | Dev-token gate tests (incl. production-inert).                                                                                                             |
| `src/lib/mcp/__tests__/register.test.ts`         | Smoke test: tools register on a real `McpServer` without throwing.                                                                                         |

**Modify:** the four route files listed above (each becomes a thin caller).

---

## Task 1: Install MCP dependencies

**Files:**

- Modify: `package.json` (via npm — never hand-edit `package-lock.json`)

- [ ] **Step 1: Install pinned versions**

Run:

```bash
npm install mcp-handler@1.1.0 @modelcontextprotocol/sdk@1.29.0
```

Expected: both added to `dependencies`; `zod` already present at `3.23.8` (no change). `@modelcontextprotocol/sdk@1.29.0` satisfies the spec's ≥1.26.0 requirement (the version that removed `ProxyOAuthServerProvider`).

- [ ] **Step 2: Verify the install resolved**

Run:

```bash
node -e "const p=require('./package.json'); console.log('mcp-handler', p.dependencies['mcp-handler']); console.log('sdk', p.dependencies['@modelcontextprotocol/sdk']); console.log('zod', (p.dependencies.zod));"
```

Expected:

```
mcp-handler 1.1.0
sdk 1.29.0
zod 3.23.8
```

- [ ] **Step 3: Confirm the SDK auth-types path exists** (used by `verify-token.ts`)

Run:

```bash
node -e "require.resolve('@modelcontextprotocol/sdk/server/auth/types.js'); require.resolve('@modelcontextprotocol/sdk/server/mcp.js'); console.log('ok');"
```

Expected: `ok`. If either path fails to resolve, run `node -e "const e=require('@modelcontextprotocol/sdk/package.json').exports; console.log(Object.keys(e))"` and adjust the import specifiers in later tasks to the actual exported subpaths before proceeding.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add mcp-handler + @modelcontextprotocol/sdk for Phase 1 MCP server"
```

---

## Task 2: Typed domain errors — `service-errors.ts`

**Files:**

- Create: `src/lib/service-errors.ts`
- Test: `src/lib/__tests__/service-errors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/service-errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  ServiceError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '@/lib/service-errors';

describe('service-errors', () => {
  it('ValidationError is a ServiceError and an Error carrying the message', () => {
    const err = new ValidationError('Name is required');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ServiceError);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe('Name is required');
    expect(err.name).toBe('ValidationError');
  });

  it('NotFoundError / ForbiddenError are distinct subclasses', () => {
    const nf = new NotFoundError('Recipe not found');
    const fb = new ForbiddenError('Forbidden');
    expect(nf).toBeInstanceOf(NotFoundError);
    expect(nf).not.toBeInstanceOf(ForbiddenError);
    expect(fb).toBeInstanceOf(ForbiddenError);
    expect(fb).not.toBeInstanceOf(NotFoundError);
  });

  it('ConflictError carries an optional details string', () => {
    const withDetails = new ConflictError('Food item already exists', 'duplicate of "sugar"');
    const without = new ConflictError('Food item already exists');
    expect(withDetails).toBeInstanceOf(ConflictError);
    expect(withDetails.details).toBe('duplicate of "sugar"');
    expect(without.details).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/service-errors.test.ts`
Expected: FAIL — cannot resolve `@/lib/service-errors`.

- [ ] **Step 3: Implement the errors**

Create `src/lib/service-errors.ts`:

```ts
/**
 * Typed, transport-agnostic domain errors thrown by the service layer
 * (src/lib/services/*). Each carries a message constant from @/lib/errors.
 * HTTP routes map these to status codes via @/lib/api-error-response; MCP
 * tools map them to isError results via @/lib/mcp/tool-helpers.
 *
 * MUST NOT import next/server or any transport — services depend on this.
 */
export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    // new.target resolves to the concrete subclass being constructed.
    this.name = new.target.name;
  }
}

/** Invalid input (missing/malformed fields, non-ObjectId id). Maps to 400. */
export class ValidationError extends ServiceError {}

/** Requested document does not exist (or is not visible). Maps to 404. */
export class NotFoundError extends ServiceError {}

/** Authenticated but not permitted to access/mutate this document. Maps to 403. */
export class ForbiddenError extends ServiceError {}

/** A uniqueness/state conflict (e.g. duplicate food item). Maps to 409. */
export class ConflictError extends ServiceError {
  readonly details?: string;
  constructor(message: string, details?: string) {
    super(message);
    this.details = details;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/service-errors.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/service-errors.ts src/lib/__tests__/service-errors.test.ts
git commit -m "feat: add typed service-layer domain errors (Phase 1)"
```

---

## Task 3: HTTP error mapper — `api-error-response.ts`

**Files:**

- Create: `src/lib/api-error-response.ts`
- Test: `src/lib/__tests__/api-error-response.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/api-error-response.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '@/lib/service-errors';
import { serviceErrorResponse } from '@/lib/api-error-response';

describe('serviceErrorResponse', () => {
  it('maps ValidationError to 400 with the message', async () => {
    const res = serviceErrorResponse('Ctx', new ValidationError('Name is required'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Name is required' });
  });

  it('maps ForbiddenError to 403', async () => {
    const res = serviceErrorResponse('Ctx', new ForbiddenError('Forbidden'));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('maps NotFoundError to 404', async () => {
    const res = serviceErrorResponse('Ctx', new NotFoundError('Recipe not found'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Recipe not found' });
  });

  it('maps ConflictError to 409 and includes details when present', async () => {
    const res = serviceErrorResponse('Ctx', new ConflictError('Food item already exists', 'dup'));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Food item already exists', details: 'dup' });
  });

  it('maps ConflictError without details to 409 with just the error', async () => {
    const res = serviceErrorResponse('Ctx', new ConflictError('Food item already exists'));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Food item already exists' });
  });

  it('falls through unknown errors to a logged 500', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = serviceErrorResponse('Ctx', new Error('boom'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/api-error-response.test.ts`
Expected: FAIL — cannot resolve `@/lib/api-error-response`.

- [ ] **Step 3: Implement the mapper**

Create `src/lib/api-error-response.ts`:

```ts
import { NextResponse } from 'next/server';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '@/lib/service-errors';
import { API_ERRORS, logError } from '@/lib/errors';

/**
 * Maps a caught service-layer error to a NextResponse with the matching HTTP
 * status. Unknown errors are logged and returned as a generic 500, preserving
 * the existing route behavior. HTTP-only — never import this into a service.
 */
export function serviceErrorResponse(context: string, error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    const body = error.details
      ? { error: error.message, details: error.details }
      : { error: error.message };
    return NextResponse.json(body, { status: 409 });
  }
  logError(context, error);
  return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/api-error-response.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-error-response.ts src/lib/__tests__/api-error-response.test.ts
git commit -m "feat: add service-error to HTTP-status mapper (Phase 1)"
```

---

## Task 4: Food-items service

**Files:**

- Create: `src/lib/services/food-items.ts`
- Test: `src/lib/services/__tests__/food-items.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/services/__tests__/food-items.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Mongo at the module boundary the service imports.
const findOneMock = vi.fn();
const insertOneMock = vi.fn();
const paginatedResponseMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: () => ({
        findOne: findOneMock,
        insertOne: insertOneMock,
      }),
    }),
  })),
}));

vi.mock('@/lib/pagination-utils', () => ({
  paginatedResponse: (...args: unknown[]) => paginatedResponseMock(...args),
}));

const { searchFoodItems, getFoodItem, createFoodItem } = await import('@/lib/services/food-items');
const { ValidationError, NotFoundError, ForbiddenError, ConflictError } =
  await import('@/lib/service-errors');

const pagination = { page: 1, limit: 10, sortBy: 'name', sortOrder: 1 as const };

beforeEach(() => {
  findOneMock.mockReset();
  insertOneMock.mockReset();
  paginatedResponseMock.mockReset();
});

describe('searchFoodItems', () => {
  it('scopes the default query to global OR the caller and annotates accessLevel', async () => {
    paginatedResponseMock.mockResolvedValueOnce({
      data: [
        { _id: 'f1', name: 'Mine', isGlobal: false, createdBy: 'u1' },
        { _id: 'f2', name: 'Global', isGlobal: true, createdBy: 'other' },
        { _id: 'f3', name: 'SharedByMe', isGlobal: true, createdBy: 'u1' },
      ],
      total: 3,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    const result = await searchFoodItems('u1', { pagination });

    const filterArg = paginatedResponseMock.mock.calls[0][1];
    expect(filterArg.$or).toEqual([{ isGlobal: true }, { createdBy: 'u1' }]);
    expect(result.data[0].accessLevel).toBe('private');
    expect(result.data[1].accessLevel).toBe('shared-by-others');
    expect(result.data[2].accessLevel).toBe('shared-by-you');
  });

  it("never returns another user's personal items in accessLevel=private", async () => {
    paginatedResponseMock.mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
    await searchFoodItems('u1', { accessLevel: 'private', pagination });
    const filterArg = paginatedResponseMock.mock.calls[0][1];
    expect(filterArg.createdBy).toBe('u1');
    expect(filterArg.isGlobal).toEqual({ $ne: true });
  });
});

describe('getFoodItem', () => {
  it('throws ValidationError for a malformed id', async () => {
    await expect(getFoodItem('u1', { id: 'not-an-objectid' })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('throws NotFoundError when the document is missing', async () => {
    findOneMock.mockResolvedValueOnce(null);
    await expect(getFoodItem('u1', { id: '64b7f8c2a2b7c2f1a2b7c2f1' })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("throws ForbiddenError for another user's personal item", async () => {
    findOneMock.mockResolvedValueOnce({ _id: 'x', isGlobal: false, createdBy: 'u2' });
    await expect(getFoodItem('u1', { id: '64b7f8c2a2b7c2f1a2b7c2f1' })).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it('returns a global item to any caller', async () => {
    const doc = { _id: 'x', name: 'Sugar', isGlobal: true, createdBy: 'u2' };
    findOneMock.mockResolvedValueOnce(doc);
    const result = await getFoodItem('u1', { id: '64b7f8c2a2b7c2f1a2b7c2f1' });
    expect(result).toEqual(doc);
  });

  it("lets an admin read another user's personal item", async () => {
    const doc = { _id: 'x', name: 'Private', isGlobal: false, createdBy: 'u2' };
    findOneMock.mockResolvedValueOnce(doc);
    const result = await getFoodItem('u1', { id: '64b7f8c2a2b7c2f1a2b7c2f1', isAdmin: true });
    expect(result).toEqual(doc);
  });
});

describe('createFoodItem', () => {
  const valid = {
    name: 'Sugar',
    singularName: 'sugar',
    pluralName: 'sugars',
    unit: 'gram',
    isGlobal: false,
  };

  it('throws ValidationError when the name is missing', async () => {
    await expect(createFoodItem('u1', { ...valid, name: '' })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('throws ValidationError for an invalid unit', async () => {
    await expect(createFoodItem('u1', { ...valid, unit: 'furlong' })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('throws ValidationError when isGlobal is not a boolean', async () => {
    await expect(
      // @ts-expect-error testing runtime guard on a non-boolean
      createFoodItem('u1', { ...valid, isGlobal: undefined })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ConflictError when a duplicate exists', async () => {
    findOneMock.mockResolvedValueOnce({ singularName: 'sugar', pluralName: 'sugars' });
    await expect(createFoodItem('u1', valid)).rejects.toBeInstanceOf(ConflictError);
  });

  it('inserts a personal item scoped to the caller and returns the created doc', async () => {
    findOneMock.mockResolvedValueOnce(null); // dedupe check
    insertOneMock.mockResolvedValueOnce({ insertedId: 'new-id' });
    findOneMock.mockResolvedValueOnce({ _id: 'new-id', ...valid, createdBy: 'u1' });

    const created = await createFoodItem('u1', valid);

    const insertedDoc = insertOneMock.mock.calls[0][0];
    expect(insertedDoc.createdBy).toBe('u1');
    expect(insertedDoc.isGlobal).toBe(false);
    expect(created._id).toBe('new-id');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/services/__tests__/food-items.test.ts`
Expected: FAIL — cannot resolve `@/lib/services/food-items`.

- [ ] **Step 3: Implement the service**

Create `src/lib/services/food-items.ts`:

```ts
import { ObjectId, Document, WithId } from 'mongodb';
import { getMongoClient } from '@/lib/mongodb';
import { paginatedResponse, PaginationParams } from '@/lib/pagination-utils';
import { VALID_UNITS } from '@/lib/food-items-utils';
import { AUTH_ERRORS, FOOD_ITEM_ERRORS } from '@/lib/errors';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '@/lib/service-errors';

export interface SearchFoodItemsInput {
  query?: string;
  accessLevel?: string | null;
  userOnly?: boolean;
  globalOnly?: boolean;
  excludeUserCreated?: boolean;
  pagination: PaginationParams;
}

export interface GetFoodItemInput {
  id: string;
  isAdmin?: boolean;
}

export interface CreateFoodItemInput {
  name?: string;
  singularName?: string;
  pluralName?: string;
  unit?: string;
  isGlobal?: boolean;
}

type FoodItemDoc = WithId<Document>;

function computeAccessLevel(item: FoodItemDoc, userId: string): string {
  if (item.isGlobal && item.createdBy === userId) return 'shared-by-you';
  if (item.isGlobal) return 'shared-by-others';
  return 'private';
}

export async function searchFoodItems(userId: string, input: SearchFoodItemsInput) {
  const { query = '', accessLevel, userOnly, globalOnly, excludeUserCreated, pagination } = input;

  const client = await getMongoClient();
  const db = client.db();
  const foodItemsCollection = db.collection('foodItems');

  let filter: Record<string, unknown> = {};
  if (accessLevel === 'private' || userOnly) {
    filter.createdBy = userId;
    if (accessLevel === 'private') {
      filter.isGlobal = { $ne: true };
    }
  } else if (accessLevel === 'shared-by-others' || (globalOnly && excludeUserCreated)) {
    filter.isGlobal = true;
    filter.createdBy = { $ne: userId };
  } else if (accessLevel === 'shared-by-you') {
    filter.isGlobal = true;
    filter.createdBy = userId;
  } else if (globalOnly) {
    filter.isGlobal = true;
  } else {
    filter.$or = [{ isGlobal: true }, { createdBy: userId }];
  }

  if (query.trim()) {
    filter = {
      $and: [
        filter,
        {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { singularName: { $regex: query, $options: 'i' } },
            { pluralName: { $regex: query, $options: 'i' } },
          ],
        },
      ],
    };
  }

  const result = await paginatedResponse(foodItemsCollection, filter, pagination);
  return {
    ...result,
    data: result.data.map((item) => ({
      ...item,
      accessLevel: computeAccessLevel(item, userId),
    })),
  };
}

export async function getFoodItem(userId: string, input: GetFoodItemInput): Promise<FoodItemDoc> {
  const { id, isAdmin = false } = input;
  if (!ObjectId.isValid(id)) {
    throw new ValidationError(FOOD_ITEM_ERRORS.INVALID_FOOD_ITEM_ID);
  }

  const client = await getMongoClient();
  const db = client.db();
  const foodItemsCollection = db.collection('foodItems');

  const foodItem = await foodItemsCollection.findOne({ _id: new ObjectId(id) });
  if (!foodItem) {
    throw new NotFoundError(FOOD_ITEM_ERRORS.FOOD_ITEM_NOT_FOUND);
  }
  if (!foodItem.isGlobal && foodItem.createdBy !== userId && !isAdmin) {
    throw new ForbiddenError(AUTH_ERRORS.FORBIDDEN);
  }
  return foodItem;
}

export async function createFoodItem(
  userId: string,
  input: CreateFoodItemInput
): Promise<FoodItemDoc> {
  const { name, singularName, pluralName, unit, isGlobal } = input;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError(FOOD_ITEM_ERRORS.NAME_REQUIRED);
  }
  if (!singularName || typeof singularName !== 'string' || singularName.trim().length === 0) {
    throw new ValidationError(FOOD_ITEM_ERRORS.SINGULAR_NAME_REQUIRED);
  }
  if (!pluralName || typeof pluralName !== 'string' || pluralName.trim().length === 0) {
    throw new ValidationError(FOOD_ITEM_ERRORS.PLURAL_NAME_REQUIRED);
  }
  if (!unit || typeof unit !== 'string' || !VALID_UNITS.includes(unit)) {
    throw new ValidationError(FOOD_ITEM_ERRORS.UNIT_REQUIRED);
  }
  if (typeof isGlobal !== 'boolean') {
    throw new ValidationError(FOOD_ITEM_ERRORS.IS_GLOBAL_REQUIRED);
  }

  const client = await getMongoClient();
  const db = client.db();
  const foodItemsCollection = db.collection('foodItems');

  const trimmedName = name.trim();
  const trimmedSingularName = singularName.trim();
  const trimmedPluralName = pluralName.trim();

  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const existingItem = await foodItemsCollection.findOne({
    $and: [
      {
        $or: [
          { singularName: { $regex: `^${escapeRegex(trimmedSingularName)}$`, $options: 'i' } },
          { pluralName: { $regex: `^${escapeRegex(trimmedPluralName)}$`, $options: 'i' } },
          { singularName: { $regex: `^${escapeRegex(trimmedPluralName)}$`, $options: 'i' } },
          { pluralName: { $regex: `^${escapeRegex(trimmedSingularName)}$`, $options: 'i' } },
        ],
      },
      {
        $or: [{ isGlobal: true }, { isGlobal: false, createdBy: userId }],
      },
    ],
  });

  if (existingItem) {
    throw new ConflictError(
      FOOD_ITEM_ERRORS.FOOD_ITEM_ALREADY_EXISTS,
      `A food item with name "${existingItem.singularName}" or "${existingItem.pluralName}" already exists`
    );
  }

  const now = new Date();
  const newFoodItem = {
    name: trimmedName,
    singularName: trimmedSingularName,
    pluralName: trimmedPluralName,
    unit,
    isGlobal,
    isApproved: true, // auto-approved; no admin approval step exists
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  const result = await foodItemsCollection.insertOne(newFoodItem);
  const createdItem = await foodItemsCollection.findOne({ _id: result.insertedId });
  if (!createdItem) {
    // Should never happen — the insert just succeeded.
    throw new NotFoundError(FOOD_ITEM_ERRORS.FOOD_ITEM_NOT_FOUND);
  }
  return createdItem;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/services/__tests__/food-items.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/food-items.ts src/lib/services/__tests__/food-items.test.ts
git commit -m "feat: extract food-items service layer (Phase 1)"
```

---

## Task 5: Refactor the food-items routes to thin callers

**Files:**

- Modify: `src/app/api/food-items/route.ts`
- Modify: `src/app/api/food-items/[id]/route.ts`
- (Do **not** modify) `src/app/api/food-items/__tests__/route.test.ts`, `src/app/api/food-items/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Confirm the existing route tests pass before refactor (baseline)**

Run:

```bash
cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/app/api/food-items/__tests__/route.test.ts src/app/api/food-items/[id]/__tests__/route.test.ts
```

Expected: PASS. (This is the regression guard; record that it's green.)

- [ ] **Step 2: Rewrite `src/app/api/food-items/route.ts` as a thin caller**

Replace the entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedSession } from '@/lib/user-utils';
import { parsePaginationParams } from '@/lib/pagination-utils';
import { searchFoodItems, createFoodItem } from '@/lib/services/food-items';
import { serviceErrorResponse } from '@/lib/api-error-response';

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(searchParams, {
      defaultSortBy: 'name',
      defaultSortOrder: 'asc',
    });

    const result = await searchFoodItems(session.user.id, {
      query: searchParams.get('query') || '',
      accessLevel: searchParams.get('accessLevel'),
      userOnly: searchParams.get('userOnly') === 'true',
      globalOnly: searchParams.get('globalOnly') === 'true',
      excludeUserCreated: searchParams.get('excludeUserCreated') === 'true',
      pagination,
    });

    return NextResponse.json(result);
  } catch (error) {
    return serviceErrorResponse('FoodItems GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const body = await request.json();
    const created = await createFoodItem(session.user.id, {
      name: body?.name,
      singularName: body?.singularName,
      pluralName: body?.pluralName,
      unit: body?.unit,
      isGlobal: body?.isGlobal,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return serviceErrorResponse('FoodItems POST', error);
  }
}
```

- [ ] **Step 3: Rewrite `src/app/api/food-items/[id]/route.ts` as a thin caller**

The `[id]` PUT/DELETE permission logic (admin-vs-owner, only-admins-can-edit/delete/make-global) is route-specific and not exposed by any Phase-1 tool, so keep that logic in the route. Only the GET id-validation + visibility moves to `getFoodItem`. Replace the **GET handler** with the thin version below; **leave PUT and DELETE as they are** (they already use `requireApprovedSession`, `ObjectId.isValid`, and the existing error constants). Replace only the GET function:

```ts
// at top of file, add the imports:
import { getFoodItem } from '@/lib/services/food-items';
import { serviceErrorResponse } from '@/lib/api-error-response';
```

```ts
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const { id } = await params;
    const foodItem = await getFoodItem(session.user.id, {
      id,
      isAdmin: session.user.isAdmin,
    });
    return NextResponse.json(foodItem);
  } catch (error) {
    return serviceErrorResponse('FoodItems GET [id]', error);
  }
}
```

After this edit the file still imports `ObjectId`, `getMongoClient`, `AUTH_ERRORS`, `FOOD_ITEM_ERRORS`, `API_ERRORS`, `logError` for PUT/DELETE — keep those imports. Remove any import that becomes unused **only if** lint flags it (e.g. if GET was the sole user of something; PUT/DELETE still use all of them, so likely no removals).

- [ ] **Step 4: Verify existing route tests stay green (behavior-preserving)**

Run:

```bash
cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/app/api/food-items/__tests__/route.test.ts src/app/api/food-items/[id]/__tests__/route.test.ts
```

Expected: PASS — identical pass count to Step 1. The `[id]` GET invalid-id cases still return 400 (now via `ValidationError`), and the tests assert only status, so they remain green.

- [ ] **Step 5: Typecheck the edited files compile**

Run: `npx tsc --noEmit`
Expected: no errors. (If lint flags an unused import in `[id]/route.ts`, remove it and re-run.)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/food-items/route.ts src/app/api/food-items/[id]/route.ts
git commit -m "refactor: food-items routes call the service layer (behavior-preserving)"
```

---

## Task 6: Recipes service

**Files:**

- Create: `src/lib/services/recipes.ts`
- Test: `src/lib/services/__tests__/recipes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/services/__tests__/recipes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMock = vi.fn();
const sortMock = vi.fn();
const skipMock = vi.fn();
const limitMock = vi.fn();
const toArrayMock = vi.fn();
const countDocumentsMock = vi.fn();
const insertOneMock = vi.fn();
const updateOneMock = vi.fn();
const findOneMock = vi.fn();
const aggregateMock = vi.fn();
const aggregateToArrayMock = vi.fn();
const foodItemsFindMock = vi.fn();

function resetChain() {
  limitMock.mockReturnValue({ toArray: toArrayMock });
  skipMock.mockReturnValue({ limit: limitMock });
  sortMock.mockReturnValue({ skip: skipMock });
  findMock.mockReturnValue({ sort: sortMock });
  aggregateMock.mockReturnValue({ toArray: aggregateToArrayMock });
  foodItemsFindMock.mockReturnValue({ toArray: () => Promise.resolve([]) });
}

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'foodItems') {
          return { find: foodItemsFindMock };
        }
        return {
          find: findMock,
          aggregate: aggregateMock,
          countDocuments: countDocumentsMock,
          insertOne: insertOneMock,
          updateOne: updateOneMock,
          findOne: findOneMock,
        };
      },
    }),
  })),
}));

const { searchRecipes, getRecipe, createRecipe, updateRecipe } =
  await import('@/lib/services/recipes');
const { ValidationError, NotFoundError } = await import('@/lib/service-errors');

const pagination = { page: 1, limit: 10, sortBy: 'updatedAt', sortOrder: -1 as const };

beforeEach(() => {
  findMock.mockReset();
  sortMock.mockReset();
  skipMock.mockReset();
  limitMock.mockReset();
  toArrayMock.mockReset();
  countDocumentsMock.mockReset();
  insertOneMock.mockReset();
  updateOneMock.mockReset();
  findOneMock.mockReset();
  aggregateMock.mockReset();
  aggregateToArrayMock.mockReset();
  foodItemsFindMock.mockReset();
  resetChain();
});

describe('searchRecipes', () => {
  it('scopes the default query to global OR the caller and annotates accessLevel', async () => {
    toArrayMock.mockResolvedValueOnce([
      { _id: 'r1', title: 'Mine', createdBy: 'u1', isGlobal: false },
      { _id: 'r2', title: 'SharedByMe', createdBy: 'u1', isGlobal: true },
      { _id: 'r3', title: 'Others', createdBy: 'u2', isGlobal: true },
    ]);
    countDocumentsMock.mockResolvedValueOnce(3);

    const result = await searchRecipes('u1', { pagination });

    const filter = findMock.mock.calls[0][0];
    expect(filter.$or).toContainEqual({ isGlobal: true });
    expect(filter.$or).toContainEqual({ createdBy: 'u1' });
    expect(result.data[0].accessLevel).toBe('private');
    expect(result.data[1].accessLevel).toBe('shared-by-you');
    expect(result.data[2].accessLevel).toBe('shared-by-others');
  });

  it('uses the aggregation path when tags are provided', async () => {
    aggregateToArrayMock.mockResolvedValueOnce([
      {
        total: 1,
        data: [{ _id: 'r1', title: 'Tagged', createdBy: 'u1', isGlobal: false }],
      },
    ]);
    const result = await searchRecipes('u1', { tags: ['italian'], pagination });
    expect(aggregateMock).toHaveBeenCalled();
    expect(result.total).toBe(1);
    expect(result.data[0].accessLevel).toBe('private');
  });
});

describe('getRecipe', () => {
  it('throws ValidationError for a malformed id', async () => {
    await expect(getRecipe('u1', 'bad-id')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws NotFoundError when missing', async () => {
    findOneMock.mockResolvedValueOnce(null);
    await expect(getRecipe('u1', '64b7f8c2a2b7c2f1a2b7c2f1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns the recipe with resolved ingredient names', async () => {
    const { ObjectId } = await import('mongodb');
    const foodItemId = '64b7f8c2a2b7c2f1a2b7c2f2';
    findOneMock.mockResolvedValueOnce({
      _id: '64b7f8c2a2b7c2f1a2b7c2f1',
      title: 'Test',
      createdBy: 'u1',
      isGlobal: false,
      ingredients: [
        {
          isStandalone: true,
          ingredients: [{ type: 'foodItem', id: foodItemId, quantity: 2, unit: 'cup' }],
        },
      ],
    });
    foodItemsFindMock.mockReturnValueOnce({
      toArray: () =>
        Promise.resolve([
          {
            _id: ObjectId.createFromHexString(foodItemId),
            singularName: 'Tomato',
            pluralName: 'Tomatoes',
          },
        ]),
    });
    const recipe = await getRecipe('u1', '64b7f8c2a2b7c2f1a2b7c2f1');
    expect(recipe.ingredients[0].ingredients[0].name).toBe('Tomatoes');
  });
});

describe('createRecipe', () => {
  it('throws ValidationError when the title is missing', async () => {
    await expect(
      createRecipe('u1', { title: '', instructions: 'x', isGlobal: false, ingredients: [] })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when there are no ingredients', async () => {
    await expect(
      createRecipe('u1', { title: 'T', instructions: 'x', isGlobal: false, ingredients: [] })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('inserts a recipe scoped to the caller and returns it', async () => {
    insertOneMock.mockResolvedValueOnce({ insertedId: 'new-id' });
    const created = await createRecipe('u1', {
      title: 'My Recipe',
      instructions: 'Cook it',
      isGlobal: false,
      ingredients: [
        { title: 'G', ingredients: [{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup' }] },
      ],
    });
    expect(insertOneMock).toHaveBeenCalledTimes(1);
    expect(created.createdBy).toBe('u1');
    expect(created._id).toBe('new-id');
  });
});

describe('updateRecipe', () => {
  it('throws ValidationError for a malformed id', async () => {
    await expect(updateRecipe('u1', 'bad', { title: 'X' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws NotFoundError when the caller does not own the recipe', async () => {
    findOneMock.mockResolvedValueOnce(null);
    await expect(
      updateRecipe('u1', '64b7f8c2a2b7c2f1a2b7c2f1', { title: 'X' })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('allowlists fields — never $sets createdBy/_id/createdAt', async () => {
    findOneMock.mockResolvedValueOnce({ _id: 'x', createdBy: 'u1' });
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1 });
    findOneMock.mockResolvedValueOnce({ _id: 'x', createdBy: 'u1', title: 'New' });
    await updateRecipe('u1', '64b7f8c2a2b7c2f1a2b7c2f1', {
      title: 'New',
      // @ts-expect-error attacker-injected fields are not in the input type
      createdBy: 'someone-else',
      _id: 'forged',
    });
    const setArg = updateOneMock.mock.calls[0][1].$set;
    expect(setArg).not.toHaveProperty('createdBy');
    expect(setArg).not.toHaveProperty('_id');
    expect(setArg).not.toHaveProperty('createdAt');
    expect(setArg.title).toBe('New');
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/services/__tests__/recipes.test.ts`
Expected: FAIL — cannot resolve `@/lib/services/recipes`.

- [ ] **Step 3: Implement the service**

Create `src/lib/services/recipes.ts`. This moves the GET-list, GET-by-id, POST, and PUT logic verbatim from the route handlers. The non-standalone-group-title literal string is preserved exactly as it exists today (it is pre-existing; do not "fix" it in this phase).

```ts
import { ObjectId, Document, WithId } from 'mongodb';
import { getMongoClient } from '@/lib/mongodb';
import { PaginationParams } from '@/lib/pagination-utils';
import { RECIPE_ERRORS } from '@/lib/errors';
import { ValidationError, NotFoundError } from '@/lib/service-errors';
import type {
  CreateRecipeRequest,
  UpdateRecipeRequest,
  RecipeIngredientList,
} from '@/types/recipe';

type RecipeDoc = WithId<Document>;
type AccessLevel = 'private' | 'shared-by-you' | 'shared-by-others';

export interface SearchRecipesInput {
  query?: string | null;
  accessLevel?: string | null;
  tags?: string[];
  ratings?: number[];
  pagination: PaginationParams;
}

function computeAccessLevel(
  recipe: { createdBy: string; isGlobal: boolean },
  userId: string
): AccessLevel {
  if (recipe.createdBy === userId && !recipe.isGlobal) return 'private';
  if (recipe.createdBy === userId && recipe.isGlobal) return 'shared-by-you';
  return 'shared-by-others';
}

function buildBaseFilter(
  accessLevel: string | null | undefined,
  userId: string
): Record<string, unknown> {
  switch (accessLevel) {
    case 'private':
      return { createdBy: userId, isGlobal: false };
    case 'shared-by-you':
      return { createdBy: userId, isGlobal: true };
    case 'shared-by-others':
      return { isGlobal: true, createdBy: { $ne: userId } };
    default:
      return { $or: [{ isGlobal: true }, { createdBy: userId }] };
  }
}

function addTextSearch(
  filter: Record<string, unknown>,
  query: string | null | undefined
): Record<string, unknown> {
  if (!query || !query.trim()) return filter;
  const searchFilter = {
    $or: [{ title: { $regex: query, $options: 'i' } }, { emoji: { $regex: query, $options: 'i' } }],
  };
  return { $and: [filter, searchFilter] };
}

function validateIngredientLists(ingredients: RecipeIngredientList[]): void {
  let totalIngredients = 0;
  for (const ingredientList of ingredients) {
    if (!ingredientList.ingredients) {
      throw new ValidationError(RECIPE_ERRORS.INGREDIENT_LIST_REQUIRED);
    }
    totalIngredients += ingredientList.ingredients.length;
    if (
      !ingredientList.isStandalone &&
      (!ingredientList.title || ingredientList.title.trim() === '')
    ) {
      throw new ValidationError('Group titles are required for non-standalone ingredient groups');
    }
    for (const ingredient of ingredientList.ingredients) {
      if (
        !ingredient.id ||
        ingredient.quantity <= 0 ||
        (ingredient.type === 'foodItem' && !ingredient.unit)
      ) {
        throw new ValidationError(RECIPE_ERRORS.INVALID_INGREDIENT_DATA);
      }
    }
  }
  if (totalIngredients === 0) {
    throw new ValidationError(RECIPE_ERRORS.INGREDIENT_LIST_REQUIRED);
  }
}

export async function searchRecipes(userId: string, input: SearchRecipesInput) {
  const { query, accessLevel, tags = [], ratings = [], pagination } = input;
  const { page, limit, sortBy, sortOrder } = pagination;

  const client = await getMongoClient();
  const db = client.db();
  const recipesCollection = db.collection('recipes');

  let filter = buildBaseFilter(accessLevel, userId);
  filter = addTextSearch(filter, query);

  const useAggregation = tags.length > 0 || ratings.length > 0 || sortBy === 'rating';

  if (useAggregation) {
    const skip = (page - 1) * limit;
    const pipeline: Record<string, unknown>[] = [
      { $match: filter },
      {
        $lookup: {
          from: 'recipeUserData',
          let: { recipeId: { $toString: '$_id' } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$recipeId', '$$recipeId'] }, { $eq: ['$userId', userId] }],
                },
              },
            },
          ],
          as: 'userDataArr',
        },
      },
      { $addFields: { userData: { $arrayElemAt: ['$userDataArr', 0] } } },
      { $unset: 'userDataArr' },
    ];

    if (tags.length > 0) {
      pipeline.push({ $match: { 'userData.tags': { $in: tags } } });
    }
    if (ratings.length > 0) {
      pipeline.push({ $match: { 'userData.rating': { $in: ratings } } });
    }

    const sortField = sortBy === 'rating' ? 'userData.rating' : sortBy;
    pipeline.push(
      { $sort: { [sortField]: sortOrder } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
        },
      }
    );

    const results = await recipesCollection.aggregate(pipeline).toArray();
    const result = results[0] || { data: [], total: 0 };
    const total = result.total as number;
    const data = (result.data as RecipeDoc[]).map((recipe) => ({
      ...recipe,
      accessLevel: computeAccessLevel(
        { createdBy: recipe.createdBy, isGlobal: recipe.isGlobal },
        userId
      ),
    }));
    return { data, total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
  }

  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    recipesCollection
      .find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray(),
    recipesCollection.countDocuments(filter),
  ]);

  const data = docs.map((recipe) => ({
    ...recipe,
    accessLevel: computeAccessLevel(
      { createdBy: recipe.createdBy, isGlobal: recipe.isGlobal },
      userId
    ),
  }));
  return { data, total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
}

export async function getRecipe(userId: string, id: string): Promise<RecipeDoc> {
  if (!ObjectId.isValid(id)) {
    throw new ValidationError(RECIPE_ERRORS.INVALID_RECIPE_ID);
  }

  const client = await getMongoClient();
  const db = client.db();
  const recipesCollection = db.collection('recipes');

  const recipe = await recipesCollection.findOne({
    _id: ObjectId.createFromHexString(id),
    $or: [{ isGlobal: true }, { createdBy: userId }],
  });
  if (!recipe) {
    throw new NotFoundError(RECIPE_ERRORS.RECIPE_NOT_FOUND);
  }

  const foodItemIds: string[] = [];
  const recipeIngredientIds: string[] = [];
  for (const group of recipe.ingredients || []) {
    for (const ingredient of group.ingredients || []) {
      if (ingredient.type === 'foodItem' && ingredient.id) foodItemIds.push(ingredient.id);
      else if (ingredient.type === 'recipe' && ingredient.id)
        recipeIngredientIds.push(ingredient.id);
    }
  }

  const [foodItemsDocs, recipesDocs] = await Promise.all([
    foodItemIds.length > 0
      ? db
          .collection('foodItems')
          .find({ _id: { $in: foodItemIds.map((fid) => ObjectId.createFromHexString(fid)) } })
          .toArray()
      : Promise.resolve([]),
    recipeIngredientIds.length > 0
      ? recipesCollection
          .find({
            _id: { $in: recipeIngredientIds.map((rid) => ObjectId.createFromHexString(rid)) },
          })
          .toArray()
      : Promise.resolve([]),
  ]);

  const foodItemsMap = new Map(foodItemsDocs.map((fi) => [fi._id.toString(), fi]));
  const recipesMap = new Map(recipesDocs.map((r) => [r._id.toString(), r]));

  for (const group of recipe.ingredients || []) {
    for (const ingredient of group.ingredients || []) {
      if (ingredient.type === 'foodItem') {
        const fi = foodItemsMap.get(ingredient.id);
        if (fi) ingredient.name = ingredient.quantity === 1 ? fi.singularName : fi.pluralName;
      } else if (ingredient.type === 'recipe') {
        const r = recipesMap.get(ingredient.id);
        if (r) ingredient.name = r.title;
      }
    }
  }

  return recipe;
}

export async function createRecipe(userId: string, input: CreateRecipeRequest): Promise<RecipeDoc> {
  const { title, instructions, ingredients } = input;
  if (!title || !instructions || !ingredients || ingredients.length === 0) {
    throw new ValidationError(RECIPE_ERRORS.TITLE_REQUIRED);
  }
  validateIngredientLists(ingredients);

  const client = await getMongoClient();
  const db = client.db();
  const recipesCollection = db.collection('recipes');

  const now = new Date();
  const recipe = {
    title: input.title,
    emoji: input.emoji,
    ingredients: input.ingredients,
    instructions: input.instructions,
    isGlobal: input.isGlobal ?? false,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  const result = await recipesCollection.insertOne(recipe);
  return { ...recipe, _id: result.insertedId };
}

export async function updateRecipe(
  userId: string,
  id: string,
  input: UpdateRecipeRequest
): Promise<RecipeDoc> {
  if (!ObjectId.isValid(id)) {
    throw new ValidationError(RECIPE_ERRORS.INVALID_RECIPE_ID);
  }

  const client = await getMongoClient();
  const db = client.db();
  const recipesCollection = db.collection('recipes');
  const objectId = ObjectId.createFromHexString(id);

  const existingRecipe = await recipesCollection.findOne({ _id: objectId, createdBy: userId });
  if (!existingRecipe) {
    throw new NotFoundError(RECIPE_ERRORS.NO_PERMISSION_TO_EDIT);
  }

  if (input.ingredients) {
    validateIngredientLists(input.ingredients);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) updateData.title = input.title;
  if (input.emoji !== undefined) updateData.emoji = input.emoji;
  if (input.ingredients !== undefined) updateData.ingredients = input.ingredients;
  if (input.instructions !== undefined) updateData.instructions = input.instructions;
  if (input.isGlobal !== undefined) updateData.isGlobal = input.isGlobal;

  const result = await recipesCollection.updateOne(
    { _id: objectId, createdBy: userId },
    { $set: updateData }
  );
  if (result.matchedCount === 0) {
    throw new NotFoundError(RECIPE_ERRORS.RECIPE_NOT_FOUND);
  }

  const updatedRecipe = await recipesCollection.findOne({ _id: objectId });
  if (!updatedRecipe) {
    throw new NotFoundError(RECIPE_ERRORS.RECIPE_NOT_FOUND);
  }
  return updatedRecipe;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/services/__tests__/recipes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/recipes.ts src/lib/services/__tests__/recipes.test.ts
git commit -m "feat: extract recipes service layer (Phase 1)"
```

---

## Task 7: Refactor the recipes routes to thin callers

**Files:**

- Modify: `src/app/api/recipes/route.ts`
- Modify: `src/app/api/recipes/[id]/route.ts`
- (Do **not** modify) the two existing recipe route test files.

- [ ] **Step 1: Baseline — confirm existing recipe route tests pass**

Run:

```bash
cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/app/api/recipes/__tests__/route.test.ts src/app/api/recipes/[id]/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 2: Rewrite `src/app/api/recipes/route.ts`**

Replace the entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedSession } from '@/lib/user-utils';
import { parsePaginationParams } from '@/lib/pagination-utils';
import { searchRecipes, createRecipe } from '@/lib/services/recipes';
import { serviceErrorResponse } from '@/lib/api-error-response';
import type { CreateRecipeRequest } from '@/types/recipe';

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(searchParams);

    const tagsParam = searchParams.get('tags');
    const ratingsParam = searchParams.get('ratings');
    const tags = tagsParam
      ? tagsParam
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const ratings = ratingsParam
      ? ratingsParam
          .split(',')
          .map((r) => parseInt(r.trim(), 10))
          .filter((r) => !Number.isNaN(r))
      : [];

    const result = await searchRecipes(session.user.id, {
      query: searchParams.get('query'),
      accessLevel: searchParams.get('accessLevel'),
      tags,
      ratings,
      pagination,
    });

    return NextResponse.json(result);
  } catch (error) {
    return serviceErrorResponse('Recipes GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const body: CreateRecipeRequest = await request.json();
    const created = await createRecipe(session.user.id, body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return serviceErrorResponse('Recipes POST', error);
  }
}
```

Note: the recipe GET error-handling test (`findMock` throws → 500) still passes — `searchRecipes` calls `find()` which throws, propagating to the route's `catch` → `serviceErrorResponse` logs and returns 500.

- [ ] **Step 3: Rewrite `src/app/api/recipes/[id]/route.ts`**

Replace the entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedSession } from '@/lib/user-utils';
import { ObjectId } from 'mongodb';
import { getMongoClient } from '@/lib/mongodb';
import { RECIPE_ERRORS } from '@/lib/errors';
import { getRecipe, updateRecipe } from '@/lib/services/recipes';
import { serviceErrorResponse } from '@/lib/api-error-response';
import type { UpdateRecipeRequest } from '@/types/recipe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const { id } = await params;
    const recipe = await getRecipe(session.user.id, id);
    return NextResponse.json(recipe);
  } catch (error) {
    return serviceErrorResponse('Recipes GET [id]', error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const { id } = await params;
    const body: UpdateRecipeRequest = await request.json();
    const updated = await updateRecipe(session.user.id, id, body);
    return NextResponse.json(updated);
  } catch (error) {
    return serviceErrorResponse('Recipes PUT [id]', error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error } = await requireApprovedSession();
    if (error) return error;

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: RECIPE_ERRORS.INVALID_RECIPE_ID }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const recipesCollection = db.collection('recipes');

    const result = await recipesCollection.deleteOne({
      _id: ObjectId.createFromHexString(id),
      createdBy: session.user.id,
    });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: RECIPE_ERRORS.NO_PERMISSION_TO_EDIT }, { status: 404 });
    }

    return NextResponse.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    return serviceErrorResponse('Recipes DELETE [id]', error);
  }
}
```

Note: DELETE stays inline (no `deleteRecipe` service needed in Phase 1 — no tool deletes recipes). It keeps the original 400/404/message behavior exactly.

- [ ] **Step 4: Verify existing recipe route tests stay green**

Run:

```bash
cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/app/api/recipes/__tests__/route.test.ts src/app/api/recipes/[id]/__tests__/route.test.ts
```

Expected: PASS — identical pass count to Step 1. (The `[id]` PUT allowlist-injection test still passes: `updateRecipe`'s explicit field allowlist never copies `createdBy`/`_id`/`createdAt` into `$set`.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/recipes/route.ts src/app/api/recipes/[id]/route.ts
git commit -m "refactor: recipes routes call the service layer (behavior-preserving)"
```

---

## Task 8: MCP tool helpers

**Files:**

- Create: `src/lib/mcp/tool-helpers.ts`
- Test: `src/lib/mcp/__tests__/tool-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/mcp/__tests__/tool-helpers.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { getAuthContext, runTool } from '@/lib/mcp/tool-helpers';
import { ValidationError, ForbiddenError } from '@/lib/service-errors';

describe('getAuthContext', () => {
  it('extracts userId and isAdmin from extra.authInfo.extra', () => {
    const ctx = getAuthContext({
      authInfo: { extra: { userId: 'u1', isAdmin: true } },
    });
    expect(ctx).toEqual({ userId: 'u1', isAdmin: true });
  });

  it('defaults isAdmin to false when absent', () => {
    const ctx = getAuthContext({ authInfo: { extra: { userId: 'u1' } } });
    expect(ctx).toEqual({ userId: 'u1', isAdmin: false });
  });

  it('throws ForbiddenError when there is no userId', () => {
    expect(() => getAuthContext({ authInfo: { extra: {} } })).toThrow(ForbiddenError);
    expect(() => getAuthContext({})).toThrow(ForbiddenError);
  });
});

describe('runTool', () => {
  it('wraps a successful result as JSON text content', async () => {
    const res = await runTool(async () => ({ ok: true, n: 2 }));
    expect(res.isError).toBeUndefined();
    expect(res.content[0]).toEqual({ type: 'text', text: JSON.stringify({ ok: true, n: 2 }) });
  });

  it('maps a domain error to an isError result carrying the message', async () => {
    const res = await runTool(async () => {
      throw new ValidationError('Name is required');
    });
    expect(res.isError).toBe(true);
    expect(res.content[0]).toEqual({ type: 'text', text: 'Name is required' });
  });

  it('logs and returns a generic isError for an unexpected error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await runTool(async () => {
      throw new Error('kaboom');
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('Something went wrong. Please try again.');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/mcp/__tests__/tool-helpers.test.ts`
Expected: FAIL — cannot resolve `@/lib/mcp/tool-helpers`.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/mcp/tool-helpers.ts`:

```ts
import { AUTH_ERRORS, logError } from '@/lib/errors';
import { ServiceError, ForbiddenError } from '@/lib/service-errors';

/** Shape of the `extra` argument an MCP tool handler receives from mcp-handler. */
export interface ToolExtra {
  authInfo?: {
    extra?: Record<string, unknown>;
  };
}

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
}

/** Minimal MCP tool result shape (subset of the SDK's CallToolResult). */
export interface ToolResult {
  isError?: true;
  content: Array<{ type: 'text'; text: string }>;
}

/**
 * Resolves the authenticated user from the MCP auth context. verifyToken
 * (withMcpAuth) places { userId, isApproved, isAdmin } on authInfo.extra.
 */
export function getAuthContext(extra: ToolExtra): AuthContext {
  const userId = extra?.authInfo?.extra?.userId;
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new ForbiddenError(AUTH_ERRORS.UNAUTHORIZED);
  }
  const isAdmin = extra?.authInfo?.extra?.isAdmin === true;
  return { userId, isAdmin };
}

function toolText(text: string, isError?: true): ToolResult {
  return isError
    ? { isError, content: [{ type: 'text', text }] }
    : { content: [{ type: 'text', text }] };
}

/**
 * Runs a tool body, serializing the result to JSON text. Domain (ServiceError)
 * failures become actionable isError results; unexpected errors are logged and
 * returned as a generic isError so internals never leak to the agent.
 */
export async function runTool(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const data = await fn();
    return toolText(JSON.stringify(data));
  } catch (error) {
    if (error instanceof ServiceError) {
      return toolText(error.message, true);
    }
    logError('McpTool', error);
    return toolText('Something went wrong. Please try again.', true);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/mcp/__tests__/tool-helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/tool-helpers.ts src/lib/mcp/__tests__/tool-helpers.test.ts
git commit -m "feat: add MCP tool helpers (auth context + error mapping)"
```

---

## Task 9: Food-items MCP tools

**Files:**

- Create: `src/lib/mcp/tools/food-items.ts`
- Test: `src/lib/mcp/tools/__tests__/food-items.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/mcp/tools/__tests__/food-items.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const searchFoodItemsMock = vi.fn();
const getFoodItemMock = vi.fn();
const createFoodItemMock = vi.fn();

vi.mock('@/lib/services/food-items', () => ({
  searchFoodItems: (...a: unknown[]) => searchFoodItemsMock(...a),
  getFoodItem: (...a: unknown[]) => getFoodItemMock(...a),
  createFoodItem: (...a: unknown[]) => createFoodItemMock(...a),
}));

const {
  foodItemsSearchInput,
  foodItemsGetInput,
  foodItemsCreateInput,
  foodItemsSearchHandler,
  foodItemsGetHandler,
  foodItemsCreateHandler,
} = await import('@/lib/mcp/tools/food-items');

const extra = { authInfo: { extra: { userId: 'u1', isAdmin: false } } };

beforeEach(() => {
  searchFoodItemsMock.mockReset();
  getFoodItemMock.mockReset();
  createFoodItemMock.mockReset();
});

describe('food_items.search tool', () => {
  it('calls searchFoodItems with the authed userId and parsed pagination', async () => {
    searchFoodItemsMock.mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
    const res = await foodItemsSearchHandler({ query: 'flour', page: 2, limit: 5 }, extra);
    expect(searchFoodItemsMock).toHaveBeenCalledTimes(1);
    const [userId, input] = searchFoodItemsMock.mock.calls[0];
    expect(userId).toBe('u1');
    expect(input.query).toBe('flour');
    expect(input.pagination).toMatchObject({ page: 2, limit: 5 });
    expect(res.isError).toBeUndefined();
  });
});

describe('food_items.get tool', () => {
  it('passes the authed userId and isAdmin', async () => {
    getFoodItemMock.mockResolvedValueOnce({ _id: 'x', name: 'Sugar' });
    await foodItemsGetHandler({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }, extra);
    expect(getFoodItemMock).toHaveBeenCalledWith('u1', {
      id: '64b7f8c2a2b7c2f1a2b7c2f1',
      isAdmin: false,
    });
  });

  it('maps a domain error to an isError result', async () => {
    const { NotFoundError } = await import('@/lib/service-errors');
    getFoodItemMock.mockRejectedValueOnce(new NotFoundError('Food item not found'));
    const res = await foodItemsGetHandler({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }, extra);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('Food item not found');
  });
});

describe('food_items.create tool', () => {
  it('forces isGlobal:false regardless of input', async () => {
    createFoodItemMock.mockResolvedValueOnce({ _id: 'new', name: 'Sugar' });
    await foodItemsCreateHandler(
      { name: 'Sugar', singularName: 'sugar', pluralName: 'sugars', unit: 'gram' },
      extra
    );
    expect(createFoodItemMock).toHaveBeenCalledTimes(1);
    const [userId, input] = createFoodItemMock.mock.calls[0];
    expect(userId).toBe('u1');
    expect(input.isGlobal).toBe(false);
  });

  it('its input schema does not accept an isGlobal field', () => {
    // Forcing happens in the wrapper; the schema must not even surface isGlobal.
    expect(Object.keys(foodItemsCreateInput)).not.toContain('isGlobal');
  });
});

describe('input schemas reject invalid input', () => {
  it('food_items.get requires a string id', () => {
    const result = z.object(foodItemsGetInput).safeParse({});
    expect(result.success).toBe(false);
  });

  it('food_items.create requires name/singularName/pluralName/unit', () => {
    const result = z.object(foodItemsCreateInput).safeParse({ name: 'x' });
    expect(result.success).toBe(false);
  });

  it('food_items.search accepts an empty object', () => {
    const result = z.object(foodItemsSearchInput).safeParse({});
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/mcp/tools/__tests__/food-items.test.ts`
Expected: FAIL — cannot resolve `@/lib/mcp/tools/food-items`.

- [ ] **Step 3: Implement the tools**

Create `src/lib/mcp/tools/food-items.ts`:

```ts
import { z } from 'zod';
import type { PaginationParams } from '@/lib/pagination-utils';
import { searchFoodItems, getFoodItem, createFoodItem } from '@/lib/services/food-items';
import { getAuthContext, runTool, type ToolExtra, type ToolResult } from '@/lib/mcp/tool-helpers';

// --- input shapes (zod raw shapes for registerTool inputSchema) ---

export const foodItemsSearchInput = {
  query: z.string().optional(),
  accessLevel: z.enum(['private', 'shared-by-you', 'shared-by-others']).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
};

export const foodItemsGetInput = {
  id: z.string(),
};

// Note: no isGlobal — MCP-created food items are always personal (A1, §6.5).
export const foodItemsCreateInput = {
  name: z.string(),
  singularName: z.string(),
  pluralName: z.string(),
  unit: z.string(),
};

function toPagination(page?: number, limit?: number): PaginationParams {
  return {
    page: page ?? 1,
    limit: limit ?? 10,
    sortBy: 'name',
    sortOrder: 1,
  };
}

// --- handlers ---

export async function foodItemsSearchHandler(
  args: { query?: string; accessLevel?: string; page?: number; limit?: number },
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId } = getAuthContext(extra);
    return searchFoodItems(userId, {
      query: args.query,
      accessLevel: args.accessLevel,
      pagination: toPagination(args.page, args.limit),
    });
  });
}

export async function foodItemsGetHandler(
  args: { id: string },
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId, isAdmin } = getAuthContext(extra);
    return getFoodItem(userId, { id: args.id, isAdmin });
  });
}

export async function foodItemsCreateHandler(
  args: { name: string; singularName: string; pluralName: string; unit: string },
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId } = getAuthContext(extra);
    // Force personal ownership — agents may never create global items (I3/A1).
    return createFoodItem(userId, { ...args, isGlobal: false });
  });
}

// --- registration ---

interface ToolServer {
  registerTool: (
    name: string,
    config: { title: string; description: string; inputSchema: Record<string, unknown> },
    handler: (args: never, extra: never) => Promise<ToolResult>
  ) => unknown;
}

export function registerFoodItemTools(server: ToolServer): void {
  server.registerTool(
    'food_items.search',
    {
      title: 'Search food items',
      description:
        "Search the user's food-item catalog (their personal items plus shared/global items). Returns paginated results.",
      inputSchema: foodItemsSearchInput,
    },
    foodItemsSearchHandler as never
  );
  server.registerTool(
    'food_items.get',
    {
      title: 'Get a food item',
      description: 'Fetch a single food item by its id, if the user can see it.',
      inputSchema: foodItemsGetInput,
    },
    foodItemsGetHandler as never
  );
  server.registerTool(
    'food_items.create',
    {
      title: 'Create a food item',
      description:
        "Create a new personal food item in the user's catalog. Items created via the agent are always personal (never global).",
      inputSchema: foodItemsCreateInput,
    },
    foodItemsCreateHandler as never
  );
}
```

Note: the `as never` casts on the handlers bridge our precise handler arg types to the SDK's broad `registerTool` handler signature; they are not `any` assertions on data and keep the handlers themselves fully typed.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/mcp/tools/__tests__/food-items.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/tools/food-items.ts src/lib/mcp/tools/__tests__/food-items.test.ts
git commit -m "feat: add food-items MCP tools (search/get/create, isGlobal forced false)"
```

---

## Task 10: Recipes MCP tools

**Files:**

- Create: `src/lib/mcp/tools/recipes.ts`
- Test: `src/lib/mcp/tools/__tests__/recipes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/mcp/tools/__tests__/recipes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const searchRecipesMock = vi.fn();
const getRecipeMock = vi.fn();
const createRecipeMock = vi.fn();
const updateRecipeMock = vi.fn();

vi.mock('@/lib/services/recipes', () => ({
  searchRecipes: (...a: unknown[]) => searchRecipesMock(...a),
  getRecipe: (...a: unknown[]) => getRecipeMock(...a),
  createRecipe: (...a: unknown[]) => createRecipeMock(...a),
  updateRecipe: (...a: unknown[]) => updateRecipeMock(...a),
}));

const {
  recipesSearchInput,
  recipesGetInput,
  recipesCreateInput,
  recipesUpdateInput,
  recipesSearchHandler,
  recipesGetHandler,
  recipesCreateHandler,
  recipesUpdateHandler,
} = await import('@/lib/mcp/tools/recipes');

const extra = { authInfo: { extra: { userId: 'u1', isAdmin: false } } };

beforeEach(() => {
  searchRecipesMock.mockReset();
  getRecipeMock.mockReset();
  createRecipeMock.mockReset();
  updateRecipeMock.mockReset();
});

describe('recipes.search tool', () => {
  it('calls searchRecipes with the authed userId', async () => {
    searchRecipesMock.mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
    await recipesSearchHandler({ query: 'pizza' }, extra);
    const [userId, input] = searchRecipesMock.mock.calls[0];
    expect(userId).toBe('u1');
    expect(input.query).toBe('pizza');
    expect(input.pagination).toMatchObject({ page: 1, limit: 10 });
  });
});

describe('recipes.get tool', () => {
  it('passes the authed userId and id', async () => {
    getRecipeMock.mockResolvedValueOnce({ _id: 'r1', title: 'Pizza' });
    await recipesGetHandler({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }, extra);
    expect(getRecipeMock).toHaveBeenCalledWith('u1', '64b7f8c2a2b7c2f1a2b7c2f1');
  });

  it('maps a domain error to an isError result', async () => {
    const { NotFoundError } = await import('@/lib/service-errors');
    getRecipeMock.mockRejectedValueOnce(new NotFoundError('Recipe not found'));
    const res = await recipesGetHandler({ id: '64b7f8c2a2b7c2f1a2b7c2f1' }, extra);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('Recipe not found');
  });
});

describe('recipes.create tool', () => {
  it('calls createRecipe with the authed userId and the recipe body', async () => {
    createRecipeMock.mockResolvedValueOnce({ _id: 'new', title: 'My Recipe' });
    const body = {
      title: 'My Recipe',
      instructions: 'Cook it',
      ingredients: [
        {
          ingredients: [{ type: 'foodItem' as const, id: 'f1', quantity: 1, unit: 'cup' }],
          isStandalone: true,
        },
      ],
    };
    await recipesCreateHandler(body, extra);
    const [userId, input] = createRecipeMock.mock.calls[0];
    expect(userId).toBe('u1');
    expect(input.title).toBe('My Recipe');
  });
});

describe('recipes.update tool', () => {
  it('splits id from the patch and forwards both', async () => {
    updateRecipeMock.mockResolvedValueOnce({ _id: 'r1', title: 'New' });
    await recipesUpdateHandler({ id: '64b7f8c2a2b7c2f1a2b7c2f1', title: 'New' }, extra);
    expect(updateRecipeMock).toHaveBeenCalledWith('u1', '64b7f8c2a2b7c2f1a2b7c2f1', {
      title: 'New',
    });
  });
});

describe('input schemas', () => {
  it('recipes.get requires an id', () => {
    expect(z.object(recipesGetInput).safeParse({}).success).toBe(false);
  });
  it('recipes.create requires title/instructions/ingredients', () => {
    expect(z.object(recipesCreateInput).safeParse({ title: 'x' }).success).toBe(false);
  });
  it('recipes.update requires an id', () => {
    expect(z.object(recipesUpdateInput).safeParse({ title: 'x' }).success).toBe(false);
  });
  it('recipes.search accepts an empty object', () => {
    expect(z.object(recipesSearchInput).safeParse({}).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/mcp/tools/__tests__/recipes.test.ts`
Expected: FAIL — cannot resolve `@/lib/mcp/tools/recipes`.

- [ ] **Step 3: Implement the tools**

Create `src/lib/mcp/tools/recipes.ts`:

```ts
import { z } from 'zod';
import type { PaginationParams } from '@/lib/pagination-utils';
import type { CreateRecipeRequest, UpdateRecipeRequest } from '@/types/recipe';
import { searchRecipes, getRecipe, createRecipe, updateRecipe } from '@/lib/services/recipes';
import { getAuthContext, runTool, type ToolExtra, type ToolResult } from '@/lib/mcp/tool-helpers';

const ingredientSchema = z.object({
  type: z.enum(['foodItem', 'recipe']),
  id: z.string(),
  quantity: z.number(),
  unit: z.string().optional(),
  prepInstructions: z.string().optional(),
});

const ingredientListSchema = z.object({
  title: z.string().optional(),
  ingredients: z.array(ingredientSchema),
  isStandalone: z.boolean().optional(),
});

export const recipesSearchInput = {
  query: z.string().optional(),
  accessLevel: z.enum(['private', 'shared-by-you', 'shared-by-others']).optional(),
  tags: z.array(z.string()).optional(),
  ratings: z.array(z.number().int()).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
};

export const recipesGetInput = {
  id: z.string(),
};

export const recipesCreateInput = {
  title: z.string(),
  emoji: z.string().optional(),
  instructions: z.string(),
  isGlobal: z.boolean().optional(),
  ingredients: z.array(ingredientListSchema),
};

export const recipesUpdateInput = {
  id: z.string(),
  title: z.string().optional(),
  emoji: z.string().optional(),
  instructions: z.string().optional(),
  isGlobal: z.boolean().optional(),
  ingredients: z.array(ingredientListSchema).optional(),
};

function toPagination(page?: number, limit?: number): PaginationParams {
  return { page: page ?? 1, limit: limit ?? 10, sortBy: 'updatedAt', sortOrder: -1 };
}

export async function recipesSearchHandler(
  args: {
    query?: string;
    accessLevel?: string;
    tags?: string[];
    ratings?: number[];
    page?: number;
    limit?: number;
  },
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId } = getAuthContext(extra);
    return searchRecipes(userId, {
      query: args.query,
      accessLevel: args.accessLevel,
      tags: args.tags,
      ratings: args.ratings,
      pagination: toPagination(args.page, args.limit),
    });
  });
}

export async function recipesGetHandler(
  args: { id: string },
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId } = getAuthContext(extra);
    return getRecipe(userId, args.id);
  });
}

export async function recipesCreateHandler(
  args: CreateRecipeRequest,
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId } = getAuthContext(extra);
    return createRecipe(userId, args);
  });
}

export async function recipesUpdateHandler(
  args: { id: string } & UpdateRecipeRequest,
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId } = getAuthContext(extra);
    const { id, ...patch } = args;
    return updateRecipe(userId, id, patch);
  });
}

interface ToolServer {
  registerTool: (
    name: string,
    config: { title: string; description: string; inputSchema: Record<string, unknown> },
    handler: (args: never, extra: never) => Promise<ToolResult>
  ) => unknown;
}

export function registerRecipeTools(server: ToolServer): void {
  server.registerTool(
    'recipes.search',
    {
      title: 'Search recipes',
      description:
        "Search the user's recipes (their own plus shared/global recipes), optionally filtered by tags or ratings. Returns paginated results.",
      inputSchema: recipesSearchInput,
    },
    recipesSearchHandler as never
  );
  server.registerTool(
    'recipes.get',
    {
      title: 'Get a recipe',
      description: 'Fetch a single recipe by id with resolved ingredient names.',
      inputSchema: recipesGetInput,
    },
    recipesGetHandler as never
  );
  server.registerTool(
    'recipes.create',
    {
      title: 'Create a recipe',
      description:
        'Create a recipe. Each ingredient must reference a real food item (with a unit) or another recipe by id.',
      inputSchema: recipesCreateInput,
    },
    recipesCreateHandler as never
  );
  server.registerTool(
    'recipes.update',
    {
      title: 'Update a recipe',
      description: "Update one of the user's own recipes by id.",
      inputSchema: recipesUpdateInput,
    },
    recipesUpdateHandler as never
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/mcp/tools/__tests__/recipes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/tools/recipes.ts src/lib/mcp/tools/__tests__/recipes.test.ts
git commit -m "feat: add recipes MCP tools (search/get/create/update)"
```

---

## Task 11: Dev-token verifier + MCP route + registration smoke test

**Files:**

- Create: `src/lib/mcp/verify-token.ts`
- Create: `src/lib/mcp/__tests__/verify-token.test.ts`
- Create: `src/lib/mcp/__tests__/register.test.ts`
- Create: `src/app/api/[transport]/route.ts`

- [ ] **Step 1: Write the failing verify-token test**

Create `src/lib/mcp/__tests__/verify-token.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verifyToken } from '@/lib/mcp/verify-token';

const req = new Request('http://localhost/api/mcp');
const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.MCP_DEV_TOKEN;
  delete process.env.MCP_DEV_USER_ID;
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('verifyToken (Phase 1 dev-token gate)', () => {
  it('returns AuthInfo for the correct dev token in a non-production env', async () => {
    process.env.MCP_DEV_TOKEN = 'secret-dev-token';
    process.env.MCP_DEV_USER_ID = 'dev-user-id';
    const info = await verifyToken(req, 'secret-dev-token');
    expect(info).toBeDefined();
    expect(info?.extra?.userId).toBe('dev-user-id');
    expect(info?.token).toBe('secret-dev-token');
    expect(info?.clientId).toBe('mcp-dev');
  });

  it('returns undefined for a wrong token', async () => {
    process.env.MCP_DEV_TOKEN = 'secret-dev-token';
    process.env.MCP_DEV_USER_ID = 'dev-user-id';
    expect(await verifyToken(req, 'wrong')).toBeUndefined();
  });

  it('returns undefined when no bearer token is supplied', async () => {
    process.env.MCP_DEV_TOKEN = 'secret-dev-token';
    process.env.MCP_DEV_USER_ID = 'dev-user-id';
    expect(await verifyToken(req, undefined)).toBeUndefined();
  });

  it('returns undefined when MCP_DEV_TOKEN is not configured', async () => {
    process.env.MCP_DEV_USER_ID = 'dev-user-id';
    expect(await verifyToken(req, 'anything')).toBeUndefined();
  });

  it('is inert in production even with the correct token (C1)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MCP_DEV_TOKEN = 'secret-dev-token';
    process.env.MCP_DEV_USER_ID = 'dev-user-id';
    expect(await verifyToken(req, 'secret-dev-token')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/mcp/__tests__/verify-token.test.ts`
Expected: FAIL — cannot resolve `@/lib/mcp/verify-token`.

- [ ] **Step 3: Implement the verifier**

Create `src/lib/mcp/verify-token.ts`:

```ts
import { timingSafeEqual } from 'node:crypto';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

/**
 * Phase 1 MCP auth: a single static dev token, enabled ONLY when
 * MCP_DEV_TOKEN and MCP_DEV_USER_ID are set AND NODE_ENV !== 'production'
 * (C1, spec §11). It is never wired into any deployed environment; Phase 2
 * replaces this entirely with the OAuth-minted token verifier (§6.4).
 *
 * Env is read on every call (not at module load) so config/test changes take
 * effect without a reimport.
 */
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function verifyToken(
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  const devToken = process.env.MCP_DEV_TOKEN;
  const devUserId = process.env.MCP_DEV_USER_ID;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction || !devToken || !devUserId) return undefined;
  if (!bearerToken || !safeEqual(bearerToken, devToken)) return undefined;

  return {
    token: bearerToken,
    clientId: 'mcp-dev',
    scopes: ['weekly-eats:rw'],
    extra: { userId: devUserId, isApproved: true, isAdmin: false },
  };
}
```

- [ ] **Step 4: Run the verify-token test to verify it passes**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/mcp/__tests__/verify-token.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the registration smoke test (validates tool names/schemas on a real McpServer)**

Create `src/lib/mcp/__tests__/register.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// Services are not called during registration, but mock them so importing the
// tool modules never reaches Mongo.
vi.mock('@/lib/services/food-items', () => ({
  searchFoodItems: vi.fn(),
  getFoodItem: vi.fn(),
  createFoodItem: vi.fn(),
}));
vi.mock('@/lib/services/recipes', () => ({
  searchRecipes: vi.fn(),
  getRecipe: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
}));

const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
const { registerFoodItemTools } = await import('@/lib/mcp/tools/food-items');
const { registerRecipeTools } = await import('@/lib/mcp/tools/recipes');

describe('tool registration', () => {
  it('registers all Phase-1 tools on a real McpServer without throwing', () => {
    const server = new McpServer({ name: 'weekly-eats-test', version: '0.0.0' });
    expect(() => {
      registerFoodItemTools(server);
      registerRecipeTools(server);
    }).not.toThrow();
  });
});
```

If this test throws on a tool name (the SDK rejecting `.`), rename every tool to use `_` instead of `.` (e.g. `food_items_search`) in `tools/food-items.ts` and `tools/recipes.ts`, and update the §8a manual-test expectations accordingly. Re-run until green.

- [ ] **Step 6: Run the smoke test**

Run: `cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npx vitest run src/lib/mcp/__tests__/register.test.ts`
Expected: PASS. (If it fails on dot-names, apply the rename above.)

- [ ] **Step 7: Create the MCP transport route**

Create `src/app/api/[transport]/route.ts`:

```ts
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerFoodItemTools } from '@/lib/mcp/tools/food-items';
import { registerRecipeTools } from '@/lib/mcp/tools/recipes';
import { verifyToken } from '@/lib/mcp/verify-token';

// Vercel function timeout (Fluid Compute). Raise if tool calls need longer.
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    registerFoodItemTools(server);
    registerRecipeTools(server);
  },
  {},
  { basePath: '/api' }
);

// Phase 1: static dev-token auth (inert in production). Phase 2 swaps in the
// OAuth-minted-token verifier (§6.4). required:true → unauthenticated calls
// get 401 + WWW-Authenticate from mcp-handler.
const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export {
  authHandler as GET,
  authHandler as POST,
  authHandler as DELETE,
  // OPTIONS (CORS preflight) goes through the un-authed base handler so the
  // browser preflight is not rejected by required:true.
  handler as OPTIONS,
};
```

- [ ] **Step 8: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors. If `createMcpHandler`'s server callback param type does not structurally accept our `registerFoodItemTools`/`registerRecipeTools` (whose `ToolServer` interface is a structural subset of `McpServer`), the call still typechecks because `McpServer` provides `registerTool`. If TS complains, widen the `ToolServer.registerTool` handler param types or annotate the callback param as the type `createMcpHandler` provides.

- [ ] **Step 9: Commit**

```bash
git add src/lib/mcp/verify-token.ts src/lib/mcp/__tests__/verify-token.test.ts src/lib/mcp/__tests__/register.test.ts "src/app/api/[transport]/route.ts"
git commit -m "feat: stand up /api/mcp transport with dev-token gate (Phase 1)"
```

---

## Task 12: Full validation

**Files:** none (validation only)

- [ ] **Step 1: Ensure no dev server is running, clear stale build cache**

Run: `npm run clean`
Expected: removes `.next` (avoids the Turbopack/build collision noted in CLAUDE.md).

- [ ] **Step 2: Run the full check pipeline**

Run: `npm run check`
Expected: lint (0 warnings) + full vitest coverage run (all suites, including the new service/tool/helper/verify-token/register tests **and** the unchanged route tests) + production build all pass. The build also validates that `src/app/api/[transport]/route.ts` coexists with the existing static `/api/*` routes without a routing conflict.

- [ ] **Step 3: If the build flags a route conflict on `[transport]`**

Fallback only if Step 2 fails with a Next.js routing conflict: move the route to `src/app/api/mcp/[transport]/route.ts` and change `basePath` to `'/api/mcp'` (endpoint becomes `/api/mcp/mcp`). Re-run `npm run check`. Record the change in the ledger's "Decisions & carryovers". (Not expected — static siblings take precedence over the dynamic segment — but documented as the escape hatch.)

- [ ] **Step 4: Commit any lint/format fixups**

```bash
git add -A
git commit -m "chore: Phase 1 validation fixups"  # only if there are changes
```

---

## Manual verification (after `npm run check` is green)

Not a code task — for the human/operator, since the deliverable is "tools callable from a local MCP client":

1. In `.env.local`, set `MCP_DEV_TOKEN=<a random string>` and `MCP_DEV_USER_ID=<an approved user's _id from the dev DB>`.
2. `npm run dev`, then point a local MCP client (e.g. MCP Inspector) at `http://localhost:<port>/api/mcp` with `Authorization: Bearer <MCP_DEV_TOKEN>`.
3. Confirm `tools/list` shows all seven tools; call `food_items.search`, `recipes.search`, then `food_items.create` and verify the created item is personal (`isGlobal:false`).
4. Confirm an omitted/incorrect bearer yields 401.

After the phase lands: push `feat/mcp`, let CI run, post the Phase-1 manual-test checklist as a slot comment on draft PR #140 (`/manual-testing`), and update `docs/superpowers/plans/mcp-connector-progress.md` (Phase 1 status → done, fill plan-doc + PR-comment + date).

---

## Self-review (completed by plan author)

**Spec coverage (§11 Phase 1):**

- `service-errors.ts` typed throwables → Task 2. ✓
- Extract `services/recipes.ts` + `services/food-items.ts` → Tasks 4, 6. ✓
- Refactor the existing routes (behavior-preserving, existing tests green) → Tasks 5, 7. ✓
- Stand up `/api/mcp` stateless Streamable HTTP with recipes + food-items tools → Tasks 9, 10, 11. ✓
- Dev-token gate C1 (set **and** non-prod) → Task 11 (`verify-token.ts` + tests incl. production-inert). ✓
- §8a service tests (happy path, userId scoping, ForbiddenError, ValidationError incl. malformed ObjectId, NotFoundError, ConflictError) → Tasks 4, 6. ✓
- §8a tool tests (mock services, authed userId passed, domain-error→isError, zod rejection, isGlobal:false forcing) → Tasks 9, 10. ✓
- A1 (service keeps `isGlobal`; tool forces false) → Task 4 service + Task 9 tool. ✓
- ME (`ObjectId.isValid` in services) → `getFoodItem`, `getRecipe`, `updateRecipe`. ✓

**Out of scope (correctly deferred to Phase 2), confirmed absent:** OAuth endpoints, `mcpTokens`/hash lookup in `verifyToken`, consent screen, `mcp*` collections, `database-indexes.ts` changes, `dropAllIndexes()` edit. ✓

**Placeholder scan:** no TBD/TODO/"add validation"/"similar to Task N"; every code step contains complete code. ✓

**Type consistency:** `ToolExtra`/`ToolResult`/`AuthContext` defined in `tool-helpers.ts` and reused by both tool modules; `PaginationParams` imported from `pagination-utils`; `CreateRecipeRequest`/`UpdateRecipeRequest`/`RecipeIngredientList` imported from `@/types/recipe`; service function names (`searchFoodItems`/`getFoodItem`/`createFoodItem`/`searchRecipes`/`getRecipe`/`createRecipe`/`updateRecipe`) match between service, route, and tool call sites. ✓
