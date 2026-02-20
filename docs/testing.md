# Testing Reference

Vitest + React Testing Library + MSW. Tests are colocated in `__tests__/` directories next to source files.

---

## 1. Configuration

**`vitest.config.ts`** sets up the entire test environment:

| Setting | Value | Why |
|---------|-------|-----|
| environment | `jsdom` | DOM simulation for component tests |
| globals | `true` | No need to import `describe`, `it`, `expect` (though files still can) |
| pool | `forks` with `singleFork: true` | Process isolation -- each test file gets a clean fork |
| testTimeout / hookTimeout | 20 000 ms | Generous limit for debounced UI and async DB mocks |
| coverage provider | `v8` | Fast native coverage; reporters: text, html, lcov |
| path alias `@/` | `./src` | Mirrors `tsconfig.json` so `@/lib/errors` works in tests |

Coverage only includes `src/**/*.{ts,tsx}`, excluding test files, type declarations, and build artifacts. The `css: false` flag skips CSS processing.

```ts
// vitest.config.ts (key excerpts)
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./react-act.setup.ts', './vitest.setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}', '!src/**/*.{test,spec}.{ts,tsx}', '!src/types/**', '!src/**/*.d.ts'],
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
});
```

---

## 2. Setup Files

**Order matters.** Vitest loads these sequentially before any test file runs:

### `react-act.setup.ts` (first)

Two responsibilities that must happen before any React or Next.js code is imported:

1. **`IS_REACT_ACT_ENVIRONMENT = true`** -- tells React it is running inside `act()` so it can batch updates correctly.
2. **`ReadableStream` polyfill** -- undici (used by Next.js internally) requires `ReadableStream` on `globalThis`. The setup imports the native Node.js `ReadableStream` from `stream/web` and attaches it to `globalThis`, `global`, and `window`.

```ts
// react-act.setup.ts
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { ReadableStream as NodeReadableStream } from 'stream/web';
import { ReadableStream as PolyfillReadableStream } from 'web-streams-polyfill';

(function setupReadableStream() {
  const ReadableStreamToUse = NodeReadableStream || PolyfillReadableStream;
  (globalThis as any).ReadableStream = ReadableStreamToUse;
  (global as any).ReadableStream = ReadableStreamToUse;
  if (typeof window !== 'undefined') {
    (window as any).ReadableStream = ReadableStreamToUse;
  }
})();
```

### `vitest.setup.ts` (second)

Five things happen here:

1. **jest-dom matchers** -- `import '@testing-library/jest-dom/vitest'` adds `toBeInTheDocument()`, `toHaveValue()`, etc.

2. **MUI transition mocks** -- Collapse, Fade, Grow, Slide, and Zoom are replaced with passthrough components that render children immediately. This eliminates async act warnings caused by MUI animation timers.

```ts
vi.mock('@mui/material/Collapse', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@mui/material/Fade', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@mui/material/Grow', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@mui/material/Slide', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@mui/material/Zoom', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
```

3. **Fake `MONGODB_URI`** -- prevents real database connections if any module checks for it:

```ts
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fake';
```

4. **MSW server** with baseline handlers for `/api/food-items` (GET, POST) and `/api/recipes` (GET). These return canned data so component tests that fetch food items or recipes work without per-test overrides.

```ts
const handlers = [
  http.get('/api/food-items', ({ request }) => {
    const url = new URL(request.url);
    const query = (url.searchParams.get('query') || '').toLowerCase();
    const all = [
      { _id: 'f1', name: 'Apple', singularName: 'apple', pluralName: 'apples', unit: 'each' },
      { _id: 'f2', name: 'Banana', singularName: 'banana', pluralName: 'bananas', unit: 'each' },
    ];
    const filtered = query
      ? all.filter((i) => `${i.name} ${i.singularName} ${i.pluralName}`.toLowerCase().includes(query))
      : all;
    return HttpResponse.json(filtered, { status: 200 });
  }),
  http.post('/api/food-items', async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({ _id: 'new-food-id', ...body }, { status: 201 });
  }),
  http.get('/api/recipes', ({ request }) => {
    const url = new URL(request.url);
    const query = (url.searchParams.get('query') || '').toLowerCase();
    const all = [
      { _id: 'r1', title: 'Pasta', emoji: '🍝', isGlobal: true },
      { _id: 'r2', title: 'Salad', emoji: '🥗', isGlobal: false },
    ];
    const filtered = query ? all.filter((i) => i.title.toLowerCase().includes(query)) : all;
    return HttpResponse.json(filtered, { status: 200 });
  }),
];

const server = setupServer(...handlers);
export { server };

beforeAll(() => { server.listen({ onUnhandledRequest: 'bypass' }); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });
```

5. **jsdom base URL** -- ensures `window.location.href` is `http://localhost/` so relative `fetch('/api/...')` calls resolve correctly.

---

## 3. Mocking Patterns

### 3a. MongoDB -- chainable cursor mock

API route tests mock `@/lib/mongodb` to return a fake client with a chainable cursor: `find() -> sort() -> skip() -> limit() -> toArray()`. Each link in the chain is a separate `vi.fn()` so you can assert what was passed.

```ts
// From src/app/api/recipes/__tests__/route.test.ts
const toArrayMock = vi.fn();
const countDocumentsMock = vi.fn();
const insertOneMock = vi.fn();
const findMock = vi.fn();
const sortMock = vi.fn();
const skipMock = vi.fn();
const limitMock = vi.fn();

let collectionName = '';
vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        collectionName = name;
        return {
          find: (...args: unknown[]) => {
            findMock(...args);
            return { sort: (...sArgs: unknown[]) => {
              sortMock(...sArgs);
              return { skip: (...skArgs: unknown[]) => {
                skipMock(...skArgs);
                return { limit: (...lArgs: unknown[]) => {
                  limitMock(...lArgs);
                  return { toArray: toArrayMock };
                }};
              }};
            }};
          },
          countDocuments: countDocumentsMock,
          insertOne: insertOneMock,
        };
      },
    }),
  })),
}));
```

**Multi-collection routing:** Track which collection is accessed via the `collectionName` variable or a `collectionMock` spy. This lets a single mock serve routes that touch multiple collections (e.g., `recipes` + `recipeUserData`).

**Reset the chain in `beforeEach`** to avoid stale return values bleeding between tests:

```ts
beforeEach(() => {
  vi.restoreAllMocks();
  findMock.mockReset();
  sortMock.mockReset();
  skipMock.mockReset();
  limitMock.mockReset();
  toArrayMock.mockReset();
  countDocumentsMock.mockReset();
  insertOneMock.mockReset();
});
```

**Verifying DB calls** -- inspect mock arguments to confirm the correct filter, sort order, pagination:

```ts
expect(sortMock).toHaveBeenCalledWith({ title: 1 });
expect(skipMock).toHaveBeenCalledWith(10);   // page 2, limit 10 -> skip 10
expect(limitMock).toHaveBeenCalledWith(10);

const filter = findMock.mock.calls[0][0];
expect(filter.$or).toContainEqual({ isGlobal: true });
expect(filter.$or).toContainEqual({ createdBy: 'user1' });
```

### 3b. NextAuth

**API routes** use `next-auth/next` (server-side `getServerSession`):

```ts
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

// In tests:
const { getServerSession } = await import('next-auth/next');
(getServerSession as any).mockResolvedValueOnce({ user: { id: 'u1', isAdmin: false, isApproved: true } });
```

**Components** use `next-auth/react` (client-side `useSession`):

```ts
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'u1', name: 'Test', isAdmin: false } },
    status: 'authenticated',
  })),
}));
```

### 3c. MSW -- baseline + per-test overrides

The global handlers in `vitest.setup.ts` cover the common case. For specific tests, override with `server.use()`:

```ts
import { server } from '../../../vitest.setup';
import { http, HttpResponse } from 'msw';

it('handles API error', async () => {
  server.use(
    http.get('/api/food-items', () => {
      return HttpResponse.json({ error: 'Server error' }, { status: 500 });
    })
  );
  // ... test error handling ...
});
```

`afterEach(() => server.resetHandlers())` in the setup file automatically removes per-test overrides after each test, restoring baselines.

### 3d. `@/lib/errors` -- mock ALL groups the route imports

This is a critical gotcha. When a route imports multiple error constant groups from `@/lib/errors`, the mock **must include every group**. If any are missing, accessing an undefined constant silently returns `undefined`, causing the route handler to crash with a 500 instead of the expected 400/401/403.

```ts
// CORRECT: mocks all three groups used by the food-items route
vi.mock('@/lib/errors', () => ({
  AUTH_ERRORS: { UNAUTHORIZED: 'Unauthorized' },
  FOOD_ITEM_ERRORS: {
    NAME_REQUIRED: 'Name is required',
    SINGULAR_NAME_REQUIRED: 'Singular name is required',
    PLURAL_NAME_REQUIRED: 'Plural name is required',
    UNIT_REQUIRED: 'Unit is required',
    IS_GLOBAL_REQUIRED: 'isGlobal is required',
    FOOD_ITEM_ALREADY_EXISTS: 'Food item already exists',
  },
  API_ERRORS: { INTERNAL_SERVER_ERROR: 'Internal server error' },
  logError: vi.fn(),
}));
```

**Symptom of a missing group:** Tests that should get 400 (validation error) instead get 500. The error log shows something like `Cannot read properties of undefined (reading 'NAME_REQUIRED')`. Always check the route's imports and mock every group it uses.

---

## 4. API Route Testing

### Pattern: declare mocks, then dynamic import

`vi.mock()` calls are hoisted to the top of the file by Vitest, but the route module must be imported **after** mocks are in place. Use dynamic `await import()`:

```ts
// 1. Declare all vi.mock() calls (hoisted automatically)
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb', () => ({ /* ... */ }));
vi.mock('@/lib/errors', () => ({ /* ... */ }));

// 2. Dynamic import AFTER mocks
const { getServerSession } = await import('next-auth/next');
const routes = await import('../route');
```

### Pattern: minimal request helper

```ts
const makeReq = (url: string, body?: unknown) =>
  ({ url, json: async () => body }) as any;
```

This satisfies the `NextRequest` interface enough for route handlers. The `url` must be a full URL string so `new URL(request.url)` can parse query params.

### Pattern: Next.js 15 async params

Dynamic route handlers in Next.js 15 receive params as a `Promise`. Wrap with `Promise.resolve()`:

```ts
const res = await routes.GET(
  makeReq('http://localhost/api/recipes/r1'),
  { params: Promise.resolve({ id: 'r1' }) }
);
```

### Pattern: auth check first

Every API test suite should start with the unauthenticated case:

```ts
describe('GET - authentication', () => {
  it('returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.GET(makeReq('http://localhost/api/food-items'));
    expect(res.status).toBe(401);
  });
});
```

### Pattern: paginated response verification

```ts
it('returns paginated response with defaults', async () => {
  (getServerSession as any).mockResolvedValueOnce(mockSession);
  toArrayMock.mockResolvedValue([
    { _id: 'r1', title: 'Pizza', createdBy: 'user1', isGlobal: false },
  ]);
  countDocumentsMock.mockResolvedValue(1);

  const res = await routes.GET(makeReq('http://localhost/api/recipes'));
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.total).toBe(1);
  expect(json.page).toBe(1);
  expect(json.limit).toBe(10);
  expect(json.totalPages).toBe(1);
  expect(json.data).toHaveLength(1);
});
```

---

## 5. Component Testing

### `userEvent.setup()`, not `fireEvent`

Always use `userEvent` for interactions. It fires realistic browser event sequences (focus, keydown, input, keyup, blur) unlike `fireEvent` which dispatches a single synthetic event.

```ts
const user = userEvent.setup();
render(<Component />);
await user.click(screen.getByRole('button', { name: /save/i }));
await user.type(screen.getByLabelText(/quantity/i), '1.5');
await user.clear(screen.getByLabelText(/quantity/i));
```

### `act()` for async state updates

Wrap render and interactions in `act()` when the component triggers async effects on mount or during interaction:

```ts
await act(async () => {
  render(<IngredientInput ingredient={ingredient} onIngredientChange={onChange} onRemove={() => {}} slotId="test" />);
});
```

### MUI Autocomplete testing

MUI Autocomplete has a specific interaction flow:

```ts
// 1. Type to trigger search
const input = screen.getByLabelText(/food item or recipe/i);
await act(async () => {
  await user.type(input, 'app');
});

// 2. Wait for the listbox to appear (debounced search)
await waitFor(() => {
  const listbox = screen.queryByRole('listbox');
  expect(listbox).toBeInTheDocument();
  const options = within(listbox!).getAllByRole('option');
  expect(options.length).toBeGreaterThan(0);
}, { timeout: 3000 });

// 3. Click an option
const appleOption = screen.getByText(/apple/i);
await act(async () => {
  await user.click(appleOption);
});

// 4. Verify dropdown closed and callback fired
await waitFor(() => {
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
expect(onIngredientChange).toHaveBeenCalledWith(
  expect.objectContaining({ type: 'foodItem', id: 'f1' })
);
```

### Debounced inputs

Components with debounced search need generous timeouts in `waitFor`:

```ts
await waitFor(() => {
  expect(screen.getByText(/apple/i)).toBeInTheDocument();
}, { timeout: 2000 });
```

### Strict Mode duplicate renders

React Strict Mode double-renders components in development. When querying for elements that may appear twice, use `queryAllBy` and check length:

```ts
const options = screen.queryAllByRole('option');
expect(options.length).toBeGreaterThan(0);
```

---

## 6. Hook Testing

Use a **TestComponent harness** that renders the hook and exposes its return value via a module-level variable. This avoids `renderHook` limitations and gives full control over props and re-renders.

```ts
// From src/lib/hooks/__tests__/use-food-items.test.tsx
let latestHookState: ReturnType<typeof useFoodItems> | null = null;

const TestComponent: React.FC = () => {
  latestHookState = useFoodItems();
  return null;
};

describe('useFoodItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestHookState = null;
    mockFetchFoodItems.mockResolvedValue(mockFoodItems);
  });

  afterEach(() => {
    cleanup();
  });

  it('should fetch food items on mount', async () => {
    render(<TestComponent />);

    await waitFor(() => {
      expect(latestHookState?.loading).toBe(false);
    });

    expect(mockFetchFoodItems).toHaveBeenCalledOnce();
    expect(latestHookState?.foodItems).toEqual(mockFoodItems);
  });

  it('should set loading state during fetch', async () => {
    render(<TestComponent />);
    expect(latestHookState?.loading).toBe(true);

    await waitFor(() => {
      expect(latestHookState?.loading).toBe(false);
    });
  });

  it('should handle fetch errors', async () => {
    mockFetchFoodItems.mockRejectedValue(new Error('Network error'));
    render(<TestComponent />);

    await waitFor(() => {
      expect(latestHookState?.loading).toBe(false);
    });

    expect(latestHookState?.error).toBe('Network error');
    expect(latestHookState?.foodItems).toEqual([]);
  });
});
```

For hooks that accept options (like `useShoppingSync`), pass them as props to the harness:

```ts
// From src/lib/__tests__/use-shopping-sync.test.tsx
const TestComponent: React.FC<{ options: UseShoppingSyncOptions }> = ({ options }) => {
  latestHookState = useShoppingSync(options);
  return null;
};

// Usage
render(
  <TestComponent
    options={{
      storeId: 'store-1',
      enabled: true,
      presenceUser: { email: 'user@example.com', name: 'User' },
      onPresenceUpdate,
    }}
  />
);
```

To test imperative methods returned by the hook (like `disconnect()`), call them from outside the component:

```ts
latestHookState?.disconnect();

await waitFor(() => {
  expect(mockPresenceLeave).toHaveBeenCalled();
  expect(latestHookState?.isConnected).toBe(false);
});
```

---

## 7. Running Tests

```bash
npm test              # Single run (forks mode, no watch)
npm run test:watch    # Watch mode for local development
npm run test:coverage # Single run with V8 coverage report
npm run check         # Lint + test with coverage + build (run before pushing)
```

Tests use fake environment variables (`MONGODB_URI='mongodb://localhost:27017/fake'` and `SKIP_DB_SETUP=true`) to prevent real database connections. These are set automatically via the setup files and `package.json` scripts.

**CI:** GitHub Actions runs lint + test with coverage on pushes and PRs to `main` and `develop`. Coverage output is uploaded as a build artifact. Codecov integration is available when `CODECOV_TOKEN` is set in repo secrets.

**Troubleshooting:**

- **"Cannot find module" after build** -- `npm run check` generates `.next/` build artifacts that confuse Turbopack. Fix: `rm -rf .next`.
- **Act warnings** -- Wrap renders and interactions in `act()` or `await act(async () => { ... })`. Use `userEvent.setup()` which handles act internally.
- **Path alias errors** -- Confirm the `@` alias exists in both `tsconfig.json` and `vitest.config.ts`.
- **Silent 500s in API tests** -- Almost always a missing error constant group in the `@/lib/errors` mock. Check the route's imports.
