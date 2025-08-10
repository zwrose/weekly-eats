## Testing Guide

This project uses Vitest for unit and component tests with jsdom and React Testing Library.

### Stack
- **Test runner**: Vitest (ESM, TypeScript)
- **DOM env**: jsdom
- **React utils**: @testing-library/react, @testing-library/user-event, @testing-library/jest-dom
- **Vite plugin**: @vitejs/plugin-react (JSX transform)

Key config files:
- `vitest.config.ts`: Vitest and Vite config, React plugin, alias `@ → src`, jsdom, coverage
- `vitest.setup.ts`: Global test setup (jest-dom matchers)

### File locations and naming
- Tests live next to code or under `src/**/__tests__/**`
- File patterns: `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.spec.tsx`
- Examples:
  - `src/lib/__tests__/date-utils.test.ts`
  - `src/components/optimized/__tests__/SearchBar.test.tsx`

### Scripts
- Run all tests once: `npm run test`
- Watch mode (local dev): `npm run test:watch`
- Coverage report: `npm run test:coverage` (outputs to `coverage/` with HTML and lcov)

### Coverage
Configured via `vitest.config.ts` with V8 provider. Reports: text, html, lcov. Open `coverage/index.html` in a browser.

### Writing tests

#### Utilities (pure functions)
- Import functions directly and assert results.
- Prefer deterministic inputs; avoid time-based flakiness. If needed, freeze Date or pass dates explicitly.

#### React components
- Render with `@testing-library/react` and interact via `@testing-library/user-event`.
- Query elements by accessible roles/labels; avoid brittle selectors.

Example pattern:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Component from '../Component'

test('does something', async () => {
  const user = userEvent.setup()
  render(<Component prop="value" />)
  await user.click(screen.getByRole('button', { name: /save/i }))
  expect(screen.getByText(/saved/i)).toBeInTheDocument()
})
```

#### Mocking `fetch`
- Many helper functions call `/api/...`. In unit tests, mock `global.fetch`.

```ts
import { vi } from 'vitest'

beforeEach(() => {
  vi.restoreAllMocks()
})

vi.spyOn(global, 'fetch').mockResolvedValueOnce({
  ok: true,
  json: async () => ({ id: '1' })
} as any)
```

#### Mocking Next.js modules
If a test imports modules that use Next.js APIs, mock them to avoid framework coupling.

```ts
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))
```

### Server vs Client components
- Prefer testing logic in isolated utilities. Server Components should keep logic in testable helpers.
- For Client Components (with `"use client"`), jsdom + Testing Library is appropriate.

### Aliases and imports
- Import from `@/path` (alias to `src/`) is supported in tests via `vitest.config.ts`.

### Environment variables
- Use `.env.test` if tests require env vars. In a test, you can stub via `vi.stubEnv('KEY', 'value')` (Vitest ≥ 1.5) or set `process.env.KEY`.

### Troubleshooting
- "React is not defined": Ensure `@vitejs/plugin-react` is installed and enabled (already configured).
- Path alias errors: Confirm `@` alias exists in both `tsconfig.json` and `vitest.config.ts`.
- Act warnings: Prefer user-event; await interactions that schedule updates.

### CI usage
- Headless run: `npm run test` (no watch). CI runs `npm run test:coverage`.
- GitHub Actions workflow: `.github/workflows/ci.yml`
  - Uploads HTML coverage as an artifact
  - Optional Codecov upload when `CODECOV_TOKEN` is set in repo secrets

### Existing examples
- Utils: `src/lib/__tests__/date-utils.test.ts`, `src/lib/__tests__/food-items-utils.test.ts`, `src/lib/__tests__/meal-plan-utils.test.ts`
- Component: `src/components/optimized/__tests__/SearchBar.test.tsx`

### Recommendations
- Keep components small; move data/formatting logic to testable helpers.
- Mock network boundaries (`fetch`) and integration points; test rendering and interactions in components.

### Codecov setup (optional)
1. Create an account on Codecov and add the repository.
2. Add `CODECOV_TOKEN` to GitHub repo secrets.
3. The CI workflow will upload `coverage/lcov.info` automatically.
