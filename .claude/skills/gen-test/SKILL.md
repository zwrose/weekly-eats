---
name: gen-test
description: Generate tests following project conventions (Vitest + Testing Library + MSW)
---

Generate tests for the specified file or component. Follow these project conventions exactly:

## Test File Location

- Place tests in a `__tests__/` folder next to the source file
- Name: `ComponentName.test.tsx` for components, `route.test.ts` for API routes

## API Route Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth and DB at top level
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

// Create mock functions for DB operations
const findMock = vi.fn();
const insertOneMock = vi.fn();
// ... other operations as needed

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        // Return appropriate mocks per collection
        return { find: findMock, insertOne: insertOneMock };
      },
    }),
  })),
}));

// Import AFTER mocks
const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');

// Helper for creating mock requests
const makeReq = (url: string, body?: unknown) => ({ url, json: async () => body }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  // Reset all DB mocks
});
```

**Always test**: auth (401 for no session), validation (400 for bad input), success path, error handling.

## Component Tests

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next-auth/react
const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/current-path',
}));

afterEach(() => cleanup());
```

**Always use**: `userEvent.setup()` (not fireEvent), `waitFor()` for async, `screen.getByRole`/`getByLabelText` for queries.

## Rules

- Use `vi.mock` at top level, import mocked modules AFTER with `await import()`
- Test auth states: logged in, logged out, admin vs regular user
- Test error states and edge cases
- Use error constants from `@/lib/errors` in assertions
- Run `npm test` after generating to verify tests pass
