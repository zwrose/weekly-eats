# API Patterns

Conventions and patterns used across all Next.js Route Handler API endpoints in Weekly Eats.

## 1. Route Structure

All API routes live under `src/app/api/` and follow Next.js 15 App Router conventions. Each `route.ts` file exports named functions matching HTTP methods.

### URL Patterns

```
/api/[resource]                          GET (list), POST (create)
/api/[resource]/[id]                     GET (single), PUT (update), DELETE (remove)
/api/[resource]/[id]/[sub-resource]      Nested resource operations
```

### File Structure

```
src/app/api/
  food-items/
    route.ts              # GET (list), POST (create)
    [id]/
      route.ts            # PUT (update), DELETE (remove)
  recipes/
    route.ts              # GET (list), POST (create)
    tags/
      route.ts            # GET all user tags
    [id]/
      route.ts            # GET, PUT, DELETE
      rating/
        route.ts          # POST (upsert rating)
      tags/
        route.ts          # GET, POST tags for a recipe
      user-data/
        route.ts          # GET user-specific data
  meal-plans/
    route.ts              # GET (list), POST (create)
    summary/
      route.ts            # GET summary view
    template/
      route.ts            # GET, PUT meal plan template
    [id]/
      route.ts            # GET, PUT, DELETE
  stores/
    route.ts              # GET (list), POST (create)
    invitations/
      route.ts            # GET pending invitations
    [id]/
      route.ts            # GET, PUT, DELETE
      invite/
        route.ts          # POST invitation
      invitations/
        [userId]/
          route.ts        # PUT (accept/reject)
  shopping-lists/
    [storeId]/
      route.ts            # GET, PUT
      positions/
        route.ts          # GET, PUT item positions
      items/
        [foodItemId]/
          toggle/
            route.ts      # PATCH toggle checked state
      finish-shop/
        route.ts          # POST
      history/
        route.ts          # GET purchase history
  admin/
    users/
      route.ts            # GET (admin only)
      pending/
        route.ts          # GET pending users
      approve/
        route.ts          # POST approve user
      toggle-admin/
        route.ts          # POST toggle admin status
  user/
    settings/
      route.ts            # GET, PUT
    approval-status/
      route.ts            # GET
    meal-plan-sharing/
      invite/
        route.ts          # POST
      invitations/
        route.ts          # GET
        [userId]/
          route.ts        # PUT (accept/reject)
      owners/
        route.ts          # GET
      shared-users/
        route.ts          # GET
    recipe-sharing/
      ...                 # Same structure as meal-plan-sharing
```

### Handler Signature

Collection routes export `GET` and/or `POST`:

```ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) { ... }
export async function POST(request: NextRequest) { ... }
```

Dynamic routes receive params as a second argument. In Next.js 15, params is a `Promise` and must be awaited:

```ts
interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  // ...
}
```

## 2. Authentication

Every endpoint starts with a session check. The project uses NextAuth with JWT strategy.

### Standard User Route

```ts
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { AUTH_ERRORS } from '@/lib/errors';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
  }

  // session.user has typed properties: id, email, isAdmin, isApproved
  const userId = session.user.id;
  // ...
}
```

### Admin Route

Admin routes add a second authorization check. The pattern in `src/app/api/admin/users/route.ts` looks up the user in the database to verify admin status:

```ts
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
  }

  const client = await getMongoClient();
  const db = client.db();
  const usersCollection = db.collection('users');

  const currentUser = await usersCollection.findOne({ email: session.user.email });
  if (!currentUser?.isAdmin) {
    return NextResponse.json({ error: AUTH_ERRORS.FORBIDDEN }, { status: 403 });
  }

  // Admin-only logic here...
}
```

### Session User Properties

The session user object (typed in `src/lib/auth.ts`) provides:

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | MongoDB `_id` as string |
| `email` | `string` | User email |
| `isAdmin` | `boolean` | Admin flag (cached in JWT) |
| `isApproved` | `boolean` | Approval flag (cached in JWT) |

Never use `as` casts on session properties -- they are typed through NextAuth module augmentation.

## 3. Error Handling

### Try/Catch Wrapper

Every handler body is wrapped in `try/catch`. The catch block logs the error and returns a generic 500:

```ts
export async function GET(request: NextRequest) {
  try {
    // ... handler logic
  } catch (error) {
    logError('FoodItems GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
```

The `logError` function (from `@/lib/errors`) produces structured console output:

```ts
export const logError = (context: string, error: unknown, additionalInfo?: Record<string, unknown>) => {
  console.error(`[${context}] Error:`, {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...additionalInfo,
    timestamp: new Date().toISOString(),
  });
};
```

### Error Constant Groups

All error strings are centralized in `src/lib/errors.ts`. Never hardcode error messages -- import from the appropriate constant group:

| Group | Domain |
|-------|--------|
| `AUTH_ERRORS` | `UNAUTHORIZED`, `FORBIDDEN`, `SESSION_EXPIRED` |
| `MEAL_PLAN_ERRORS` | Start date, overlap, CRUD failures |
| `TEMPLATE_ERRORS` | Meal plan template validation |
| `RECIPE_ERRORS` | Title, ingredients, CRUD failures |
| `FOOD_ITEM_ERRORS` | Name, unit, permission, CRUD failures |
| `PANTRY_ERRORS` | Food item ID, duplicates, CRUD failures |
| `STORE_ERRORS` | Store ID, name, duplicates, ownership |
| `STORE_INVITATION_ERRORS` | Email, self-invite, authorization |
| `SHOPPING_LIST_ERRORS` | Store ID, items, duplicates |
| `MEAL_PLAN_SHARING_ERRORS` | Email, self-invite, authorization |
| `RECIPE_SHARING_ERRORS` | Email, self-invite, sharing types |
| `PURCHASE_HISTORY_ERRORS` | Store access, fetch/record failures |
| `USER_ERRORS` | User lookup, approval, admin toggle |
| `DATABASE_ERRORS` | Connection, query, CRUD failures |
| `API_ERRORS` | `INTERNAL_SERVER_ERROR`, `BAD_REQUEST`, `NOT_FOUND`, `VALIDATION_FAILED` |
| `SETTINGS_ERRORS` | Fetch/update failures |

### Response Shape

All error responses use a consistent `{ error: string }` shape:

```ts
return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
return NextResponse.json({ error: FOOD_ITEM_ERRORS.NAME_REQUIRED }, { status: 400 });
return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
```

Some 409 (conflict) responses include a `details` field for context:

```ts
return NextResponse.json({
  error: FOOD_ITEM_ERRORS.FOOD_ITEM_ALREADY_EXISTS,
  details: `A food item with name "${existingItem.singularName}" or "${existingItem.pluralName}" already exists`
}, { status: 409 });
```

### Status Code Summary

| Code | Usage |
|------|-------|
| 200 | Successful GET, PUT, DELETE |
| 201 | Successful POST (resource created) |
| 400 | Validation error, invalid ID |
| 401 | Missing or invalid session |
| 403 | Insufficient permissions (not admin, not owner) |
| 404 | Resource not found |
| 409 | Conflict (duplicate name, date overlap) |
| 500 | Unhandled exception (catch block) |

## 4. Validation

Validation happens after authentication and before any database writes. There are no schema validation libraries -- all checks are explicit.

### ObjectId Validation

Always validate IDs before passing them to MongoDB:

```ts
import { ObjectId } from 'mongodb';

if (!ObjectId.isValid(id)) {
  return NextResponse.json({ error: FOOD_ITEM_ERRORS.INVALID_FOOD_ITEM_ID }, { status: 400 });
}
```

The `src/lib/validation.ts` module also provides `isValidObjectId()` which uses a regex check:

```ts
export const isValidObjectId = (id: string): boolean => {
  if (!id || typeof id !== 'string') return false;
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(id);
};
```

### Body Validation (Field-by-Field)

Request bodies are validated field by field. From the food items POST handler:

```ts
const body = await request.json();
const { name, singularName, pluralName, unit, isGlobal } = body;

if (!name || typeof name !== 'string' || name.trim().length === 0) {
  return NextResponse.json({ error: FOOD_ITEM_ERRORS.NAME_REQUIRED }, { status: 400 });
}

if (!singularName || typeof singularName !== 'string' || singularName.trim().length === 0) {
  return NextResponse.json({ error: FOOD_ITEM_ERRORS.SINGULAR_NAME_REQUIRED }, { status: 400 });
}

if (!unit || typeof unit !== 'string' || !VALID_UNITS.includes(unit)) {
  return NextResponse.json({ error: FOOD_ITEM_ERRORS.UNIT_REQUIRED }, { status: 400 });
}

if (typeof isGlobal !== 'boolean') {
  return NextResponse.json({ error: FOOD_ITEM_ERRORS.IS_GLOBAL_REQUIRED }, { status: 400 });
}
```

### Date Validation

Use `isValidDateString()` from `@/lib/validation` for YYYY-MM-DD format strings:

```ts
import { isValidDateString } from '@/lib/validation';

if (!isValidDateString(startDate)) {
  return NextResponse.json({ error: MEAL_PLAN_ERRORS.START_DATE_REQUIRED }, { status: 400 });
}
```

The function checks format with a regex (`/^\d{4}-\d{2}-\d{2}$/`) and verifies the date is parseable.

### Nested Structure Validation

For complex bodies like recipes, validate nested arrays and their contents:

```ts
if (!body.title || !body.instructions || !body.ingredients || body.ingredients.length === 0) {
  return NextResponse.json({ error: RECIPE_ERRORS.TITLE_REQUIRED }, { status: 400 });
}

for (const ingredientList of body.ingredients) {
  if (!ingredientList.ingredients) {
    return NextResponse.json({ error: RECIPE_ERRORS.INGREDIENT_LIST_REQUIRED }, { status: 400 });
  }

  for (const ingredient of ingredientList.ingredients) {
    if (!ingredient.id || ingredient.quantity <= 0 || (ingredient.type === 'foodItem' && !ingredient.unit)) {
      return NextResponse.json({ error: RECIPE_ERRORS.INVALID_INGREDIENT_DATA }, { status: 400 });
    }
  }
}
```

### Validation Helpers in `src/lib/validation.ts`

| Function | Purpose |
|----------|---------|
| `isValidDateString(dateString)` | Checks YYYY-MM-DD format and parseability |
| `isValidObjectId(id)` | Regex check for 24-char hex string |
| `isValidDayOfWeek(day)` | Checks against valid day-of-week enum |
| `isValidMealsConfig(meals)` | Validates `{ breakfast, lunch, dinner }` booleans |
| `validateRequiredFields(obj, fields)` | Returns `{ isValid, missingFields }` for an object |

## 5. Response Formats

### Single Resource

Return the raw MongoDB document directly. Used for GET-by-id and POST (with 201):

```ts
// POST - created resource
const result = await foodItemsCollection.insertOne(newFoodItem);
const createdItem = await foodItemsCollection.findOne({ _id: result.insertedId });
return NextResponse.json(createdItem, { status: 201 });

// Alternative POST pattern (spread without re-fetch)
const result = await recipesCollection.insertOne(recipe);
return NextResponse.json({ ...recipe, _id: result.insertedId }, { status: 201 });
```

### Paginated List

Routes that use `paginatedResponse()` or manual pagination return this shape:

```ts
{
  data: Document[],    // Array of results for the current page
  total: number,       // Total matching documents across all pages
  page: number,        // Current page number (1-indexed)
  limit: number,       // Items per page
  totalPages: number   // Ceiling of total / limit (0 if no results)
}
```

Example from the food items GET handler:

```ts
const result = await paginatedResponse(foodItemsCollection, filter, paginationParams);
return NextResponse.json({ ...result, data: annotatedData });
```

### Unpaginated List

Some routes (like meal plans GET) return a plain array when pagination is not needed:

```ts
return NextResponse.json(mealPlansWithTemplates);
```

### Action Confirmation

For updates and deletes, return a message or success indicator:

```ts
// Update
return NextResponse.json({ message: 'Resource updated successfully' });

// Delete
return NextResponse.json({ message: 'Food item deleted successfully' });
```

## 6. Database Access

### Connection Singleton

The MongoDB connection is managed as a singleton in `src/lib/mongodb.ts`. In development, the client promise is stored on `globalThis` to survive HMR reloads:

```ts
import { getMongoClient } from '@/lib/mongodb';

const client = await getMongoClient();
const db = client.db();
const collection = db.collection('foodItems');
```

Key details:
- `getMongoClient()` returns a connected `MongoClient` (awaits the cached promise)
- `client.db()` is called with **no arguments** -- the database name comes from the `MONGODB_URI` connection string
- No connection pooling configuration is needed; the native driver handles it

### Collection Names

The project uses these MongoDB collections:

| Collection | Description |
|------------|-------------|
| `foodItems` | Food item definitions |
| `recipes` | Recipe documents |
| `recipeUserData` | Per-user recipe metadata (tags, ratings) |
| `mealPlans` | Weekly meal plans |
| `mealPlanTemplates` | User meal plan templates |
| `pantry` | User pantry items |
| `users` | User accounts |
| `stores` | Grocery stores |
| `storeItemPositions` | Item aisle/position ordering per store |
| `shoppingLists` | Shopping lists per store |
| `purchaseHistory` | Purchase history records |

### Common Access Patterns

**Single collection query:**
```ts
const client = await getMongoClient();
const db = client.db();
const foodItemsCollection = db.collection('foodItems');
const item = await foodItemsCollection.findOne({ _id: new ObjectId(id) });
```

**Multiple collections in one handler:**
```ts
const client = await getMongoClient();
const db = client.db();
const mealPlansCollection = db.collection('mealPlans');
const foodItemsCollection = db.collection('foodItems');
const recipesCollection = db.collection('recipes');
```

**Parallel queries with `Promise.all`:**
```ts
const [foodItemDocs, recipeDocs] = await Promise.all([
  foodItemsCollection.find({ _id: { $in: foodItemIds } }).toArray(),
  recipesCollection.find({ _id: { $in: recipeIds } }).toArray(),
]);
```

## 7. Pagination

### Parsing Parameters

Use `parsePaginationParams()` from `@/lib/pagination-utils` to normalize query string values:

```ts
import { parsePaginationParams } from '@/lib/pagination-utils';

const paginationParams = parsePaginationParams(searchParams, {
  defaultSortBy: 'name',
  defaultSortOrder: 'asc',
});
```

The function reads these query parameters and applies defaults:

| Parameter | Default | Constraints |
|-----------|---------|-------------|
| `page` | `1` | Minimum 1 |
| `limit` | `10` | Clamped to 1-100 |
| `sortBy` | `'updatedAt'` | Overridable via `defaultSortBy` |
| `sortOrder` | `'desc'` | `'asc'` maps to `1`, `'desc'` maps to `-1` |

Returns a `PaginationParams` object:

```ts
interface PaginationParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 1 | -1;
}
```

### Executing Paginated Queries

The `paginatedResponse()` helper runs `find()` and `countDocuments()` in parallel:

```ts
import { paginatedResponse } from '@/lib/pagination-utils';

const result = await paginatedResponse(foodItemsCollection, filter, paginationParams);
return NextResponse.json(result);
```

Under the hood:

```ts
export async function paginatedResponse<T extends Document>(
  collection: Collection<T>,
  filter: Filter<T>,
  params: PaginationParams
): Promise<PaginatedResult<WithId<T>>> {
  const { page, limit, sortBy, sortOrder } = params;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
```

### Manual Pagination (Aggregation Pipeline)

When `paginatedResponse()` is insufficient (e.g., joins, computed sort fields), build pagination manually. The recipes route uses `$facet` for this:

```ts
const skip = (page - 1) * limit;

const pipeline = [
  { $match: filter },
  { $lookup: { from: 'recipeUserData', /* ... */ } },
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
  },
];

const results = await recipesCollection.aggregate(pipeline).toArray();
const result = results[0] || { data: [], total: 0 };
```

The response shape matches the `PaginatedResult` interface regardless of which approach is used:

```ts
return NextResponse.json({
  data: dataWithAccessLevel,
  total,
  page,
  limit,
  totalPages: total === 0 ? 0 : Math.ceil(total / limit),
});
```
