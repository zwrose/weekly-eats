---
name: new-api-route
description: Scaffold a new Next.js API route with auth, validation, and error handling
disable-model-invocation: true
---

Scaffold a new API route at the specified path under `src/app/api/`. Follow these project conventions exactly:

## Route Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { AUTH_ERRORS, API_ERRORS, logError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const client = await getMongoClient();
    const db = client.db();

    // Always filter by userId for user-scoped data
    const results = await db.collection('collectionName')
      .find({ userId: session.user.id })
      .sort({ updatedAt: -1 })
      .toArray();

    return NextResponse.json(results);
  } catch (error) {
    logError('RouteName GET', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.requiredField) {
      return NextResponse.json({ error: 'Field is required' }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();

    const now = new Date();
    const doc = {
      ...body,
      userId: session.user.id,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('collectionName').insertOne(doc);

    return NextResponse.json({ ...doc, _id: result.insertedId }, { status: 201 });
  } catch (error) {
    logError('RouteName POST', error);
    return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
```

## For Dynamic Routes (`[id]/route.ts`)

- Accept params as: `{ params }: { params: Promise<{ id: string }> }`
- Await params: `const { id } = await params;`
- Validate ObjectId: `if (!id || !ObjectId.isValid(id)) return 400`
- Verify ownership: `findOne({ _id: new ObjectId(id), userId: session.user.id })`

## For Admin Routes

- Add admin check after auth: `if (!currentUser?.isAdmin) return NextResponse.json({ error: AUTH_ERRORS.FORBIDDEN }, { status: 403 });`

## Checklist

After scaffolding, always:
1. Add domain-specific error constants to `src/lib/errors.ts` if needed
2. Add request/response types to `src/types/` if needed
3. Generate tests using `/gen-test`
