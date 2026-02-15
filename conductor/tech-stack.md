# Tech Stack

<!-- Auto-detected from codebase with HIGH confidence -->

## Primary Language

- **TypeScript** (strict mode, with JavaScript where needed)

## Frameworks

- **Next.js 15** (App Router with Turbopack dev server)
- **React 19** (client components with "use client" directive)
- **Material UI (MUI) v7** (component library + icons + date pickers)

## Database

- **MongoDB** (via native `mongodb` Node.js driver v6)
- **@auth/mongodb-adapter** for NextAuth session storage

## Authentication

- **NextAuth v4** with MongoDB adapter
- Session-based authentication with role-based authorization (admin, approved)

## Real-time

- **Ably** (WebSocket-based real-time messaging for shopping list collaboration)

## Build & Development

- **Turborepo** (build orchestration via `turbo.json`)
- **Turbopack** (Next.js dev server bundler)
- **ESLint 9** with `eslint-config-next`
- **ES Modules** (`"type": "module"` in package.json)

## Testing

- **Vitest 3** (test runner with jsdom environment)
- **React Testing Library** (component testing)
- **MSW 2** (Mock Service Worker for API mocking)
- **@vitest/coverage-v8** (code coverage)
- Test command: `vitest run --pool=forks --poolOptions.forks.singleFork=true --isolate`

## Key Libraries

| Library | Purpose |
|---------|---------|
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag-and-drop for meal plans and ingredient ordering |
| `date-fns` | Date manipulation and formatting |
| `@mui/x-date-pickers` | Calendar/date picker components |
| `react-markdown` + `remark-gfm` | Markdown rendering (likely for recipe instructions) |
| `@wei/pluralize` | Singular/plural word forms for food units |
| `@emotion/react` + `@emotion/styled` | CSS-in-JS (MUI styling engine) |

## Development Environment

### Prerequisites

- Node.js 20+
- MongoDB instance (local or remote)
- npm (package manager)

### Setup

```bash
npm install          # Installs deps + runs postinstall (setup-db)
npm run dev          # Starts dev server with Turbopack + DB setup
npm run dev:fast     # Starts dev server without DB setup
npm run test         # Runs test suite
npm run check        # Lint + coverage + build (CI-style check)
```

### Key Scripts

| Script | Description |
|--------|-------------|
| `dev` | Setup DB + start Next.js dev with Turbopack |
| `dev:fast` | Start dev without DB setup |
| `dev:clean` | Clean `.next` cache + full dev start |
| `test` | Run Vitest with fork isolation |
| `test:watch` | Vitest in watch mode |
| `test:coverage` | Vitest with coverage report |
| `check` | Full CI check: lint + coverage + build |
| `setup-db` | Run database setup script |
