# API Patterns

> Detected from codebase analysis (Confidence: HIGH)

## Overview

- **Style:** REST API using Next.js Route Handlers
- **Total Routes:** 40+ `route.ts` files
- **Auth:** NextAuth session-based on every endpoint
- **Database:** MongoDB native driver

## Route Structure

```
/api/[resource]              → GET (list), POST (create)
/api/[resource]/[id]         → GET (single), PUT (update), DELETE (remove)
/api/[resource]/[id]/[action] → Nested resource operations
```

### Examples
- `/api/recipes` - GET list, POST create
- `/api/recipes/[id]` - GET, PUT, DELETE
- `/api/recipes/[id]/rating` - POST rating (upsert)
- `/api/recipes/[id]/tags` - GET/POST tags
- `/api/stores/[id]/invite` - POST invitation

## Request Handling

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
  }
  // ... handle request
}
```

## Response Format

**Success:**
```typescript
// Collection
NextResponse.json(items);
// Created
NextResponse.json({ ...item, _id: result.insertedId }, { status: 201 });
// Updated/Deleted
NextResponse.json({ message: 'Resource updated successfully' });
```

**Error:**
```typescript
NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
NextResponse.json({ error: RECIPE_ERRORS.INVALID_RECIPE_ID }, { status: 400 });
```

## Error Handling

Centralized error constants in `src/lib/errors.ts`:

| Category | Constants |
|----------|-----------|
| `AUTH_ERRORS` | UNAUTHORIZED, FORBIDDEN, SESSION_EXPIRED |
| `RECIPE_ERRORS` | INVALID_RECIPE_ID, RECIPE_NOT_FOUND |
| `MEAL_PLAN_ERRORS` | overlap, validation errors |
| `API_ERRORS` | INTERNAL_SERVER_ERROR, BAD_REQUEST |

All errors logged via `logError(context, error)`.

## Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET, PUT, DELETE |
| 201 | Successful POST (resource created) |
| 400 | Validation error, invalid ID |
| 401 | Missing/invalid session |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (duplicate, overlap) |
| 500 | Unhandled exception |

## Query Parameters

```
?query=search_term    # Text search
?limit=100            # Result limit
?userOnly=true        # Filter to user's items
?globalOnly=true      # Filter to global items
?startDate=YYYY-MM-DD # Date filter
```

## Validation Pattern

1. Check authentication: `session?.user?.id`
2. Validate IDs: `ObjectId.isValid(id)`
3. Validate required fields: manual checks
4. Check business rules: duplicates, overlaps, permissions
5. Return specific error constant + status code

## Client-Side Data Fetching

- **Native Fetch API** (no SWR, React Query, or Axios)
- Utility modules in `src/lib/*-utils.ts` wrap fetch calls
- Custom hooks in `src/lib/hooks/` manage state + loading + errors
- `Promise.all` for parallel requests
