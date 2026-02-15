# Testing Patterns

> Detected from codebase analysis (Confidence: HIGH)

## Framework & Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | ^3.2.4 | Test runner |
| @testing-library/react | ^16.3.0 | Component testing |
| @testing-library/user-event | ^14.6.1 | User interaction simulation |
| MSW | ^2.10.4 | API mocking (Mock Service Worker) |
| @vitest/coverage-v8 | ^3.2.4 | Code coverage |
| jsdom | ^26.1.0 | DOM environment |

## Test Organization

Tests are **co-located** in `__tests__/` directories adjacent to source code:

```
src/components/
├── Header.tsx
├── __tests__/
│   ├── SearchBar.test.tsx
│   └── MealEditor.test.tsx
src/lib/
├── meal-plan-utils.ts
├── __tests__/
│   ├── meal-plan-utils.test.ts
│   └── validation.test.ts
src/app/api/recipes/
├── route.ts
├── __tests__/
│   └── route.test.ts
```

## Test File Naming

- Standard: `ComponentName.test.tsx` or `module-name.test.ts`
- Descriptive suffixes for focused tests: `.core-behaviors.test.tsx`, `.behavior.test.tsx`, `-edit-mode-display.test.tsx`

## Test Structure

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('ComponentName', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  describe('Feature group', () => {
    it('should do expected behavior', async () => {
      const user = userEvent.setup();
      render(<Component />);
      // assertions
    });
  });
});
```

## Mocking Strategies

### Module Mocking (vi.mock)
```typescript
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
```

### MSW for API Mocking
- Global handlers in `vitest.setup.ts` for common endpoints
- Per-test overrides with `server.use(http.post(...))`
- Server lifecycle: `beforeAll(listen)`, `afterEach(reset)`, `afterAll(close)`

### Fetch Mocking
```typescript
const mockFetch = vi.fn();
global.fetch = mockFetch;
```

## Setup Files

- `react-act.setup.ts` - React act environment + ReadableStream polyfill
- `vitest.setup.ts` - jest-dom matchers, MSW server, default handlers, MUI transition mocks

## Running Tests

```bash
npm run test              # Single run with fork isolation
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
npm run check             # Lint + coverage + build
```

## Configuration

- Environment: `jsdom` with `http://localhost/` URL
- Timeout: 20000ms for tests and hooks
- Isolation: Fork pool with single fork
- Coverage: v8 provider, text/html/lcov reporters
