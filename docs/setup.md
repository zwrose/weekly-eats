# Environment & Development Setup

This guide covers everything needed to get Weekly Eats running locally, from first install through day-to-day development workflows.

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 20+ | CI uses Node 20; local dev works with 20 or later |
| MongoDB | 8.0 Community | Local install or Docker |
| Google OAuth credentials | -- | Required for authentication (Google Cloud Console) |
| Ably API key | -- | Required for real-time updates between clients |

## Environment Variables

Create a `.env.local` file in the project root. This file is git-ignored and must never be committed.

| Variable | Description | Example |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string including database name | `mongodb://localhost:27017/weekly-eats` |
| `NEXTAUTH_URL` | Canonical URL of the app (used by NextAuth) | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Random secret for signing JWT tokens | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console | `123456789.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret | `GOCSPX-xxxxxxxx` |
| `ABLY_API_KEY` | Ably API key for real-time messaging | `xxxxxx.xxxxxx:xxxxxxxxxxxx` |

Generate your `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

## First-Time Setup

### Ubuntu (automated)

The `scripts/setup-ubuntu.sh` script handles MongoDB installation, `.env.local` scaffolding, and initial database index creation:

```bash
./scripts/setup-ubuntu.sh
```

What it does:

1. Installs MongoDB 8.0 Community Edition (or starts it if already installed)
2. Creates a `.env.local` template if one does not exist
3. Runs `npm run setup-db` to create database indexes

After the script finishes, edit `.env.local` and fill in your Google OAuth credentials, Ably API key, and NEXTAUTH_SECRET.

### Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Navigate to **APIs & Services > Credentials**.
4. Click **Create Credentials > OAuth client ID**.
5. Choose **Web application** as the application type.
6. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
7. Copy the **Client ID** and **Client Secret** into your `.env.local`.

### Install Dependencies

```bash
npm install
```

The `postinstall` hook runs `scripts/setup-worktree.js`, which auto-detects whether you're in a worktree or the main repo. In the main repo it creates database indexes. In a worktree it also generates `.env.local` and clones the main database. If MongoDB is not running at install time, the script warns and exits gracefully -- the dev server will still start, and you can run `npm run setup-db` later once MongoDB is available.

## Database

### Index Creation

Indexes are created by two sources:

- **`src/lib/database-indexes.ts`** -- the authoritative, complete list of all indexes used by the application. This is a TypeScript module imported by the app.
- **`scripts/setup-database.js`** -- a standalone Node script that connects directly to MongoDB and creates indexes. It runs via `npm run setup-db` and as the `postinstall` hook.

The standalone script may be slightly out of sync with the TypeScript source if new indexes are added to the app but the script has not been updated. When in doubt, `src/lib/database-indexes.ts` is the source of truth.

Run index creation manually:

```bash
npm run setup-db
```

The script skips execution when `CI=true`, `NODE_ENV=test`, or `SKIP_DB_SETUP=true`, so it never tries to connect to a real database in CI or test environments.

### Collections

The database uses these collections: `mealPlans`, `mealPlanTemplates`, `foodItems`, `recipes`, `recipeUserData`, `pantry`, `users`, `stores`, `storeItemPositions`, `shoppingLists`, `purchaseHistory`.

## Dev Server

Three npm scripts for different scenarios:

```bash
# Full start: run worktree setup (or setup-db in main) then start Turbopack dev server
npm run dev

# Fast start: skip setup, just start Turbopack dev server
npm run dev:fast

# Clean start: delete .next cache, then run full dev
npm run dev:clean
```

All three use [Turbopack](https://turbo.build/pack) via `next dev --turbopack`. The dev server reads PORT from `.env.local` and passes it explicitly as `--port <N>`, ensuring worktrees always start on their assigned port.

### The `.next` Cache Gotcha

After running `npm run build` or `npm run check` (which runs a production build), the Turbopack dev server may crash with:

```
Cannot find module 'chunks/ssr/[turbopack]_runtime.js'
```

Fix: delete the `.next` directory and restart the dev server:

```bash
rm -rf .next
npm run dev
```

The `npm run dev:clean` script does this automatically.

## Linting

```bash
# Check for lint errors
npm run lint

# Auto-fix where possible
npm run lint -- --fix
```

### Configuration

The project uses ESLint v9 with the flat config format (`eslint.config.mjs`). It extends two Next.js presets:

- `next/core-web-vitals` -- performance and accessibility rules
- `next/typescript` -- TypeScript-specific rules

Test files (`**/__tests__/**/*.{ts,tsx}`, `**/*.{test,spec}.{ts,tsx}`) have relaxed rules:

- `@typescript-eslint/no-explicit-any` -- off
- `@typescript-eslint/no-unused-vars` -- off
- Vitest globals (`vi`, `describe`, `it`, `test`, `expect`, `beforeEach`, `afterEach`) are declared as read-only globals

## Worktree Workflow

Git worktrees allow running multiple development branches simultaneously with fully isolated ports, databases, and `node_modules`. Worktrees live inside the project at `.worktrees/`, which keeps them within the Claude Code sandbox and avoids permission/consent issues.

### Creating a Worktree

```bash
git worktree add .worktrees/<branch> -b <branch>
cd .worktrees/<branch>
npm install
```

The `postinstall` hook automatically detects the worktree context and:

1. Generates `.env.local` with a unique port and database name
2. Clones the main database (requires `mongodump`/`mongorestore`)
3. Creates database indexes

### Port Assignment

Each worktree gets a deterministic port derived from hashing the branch name (range 3001-3999). The same branch name always maps to the same port. The dev server reads PORT from `.env.local` and passes it explicitly via `next dev --turbopack --port <N>`, so the port is always reliable.

### Listing Worktrees

```bash
git worktree list
```

### Removing a Worktree

```bash
node scripts/worktree-remove.js <branch-name>
```

This command:

1. Drops the MongoDB database (`weekly-eats-<branch>`)
2. Runs `git worktree remove .worktrees/<branch>`
3. Runs `git worktree prune`

### Isolation

| Resource | Main worktree | Each new worktree |
|---|---|---|
| Port | 3000 | Deterministic 3001-3999 (hashed from branch name) |
| Database | from `.env.local` | `weekly-eats-<branch>` (cloned from main) |
| `node_modules` | Own copy | Own copy |
| `.env.local` | Manual | Auto-generated by postinstall |
| `.next/` build cache | Own | Own |

### Rules for Parallel Agents

- Never run two agents on the same worktree/branch -- file edits will collide.
- Always create a worktree before starting parallel work on a new branch.
- `npm test` and `npm run check` are safe in any worktree (they use fake DB URIs and `SKIP_DB_SETUP=true`).
- Clean up worktrees when done -- `node scripts/worktree-remove.js <branch>` drops the DB and removes the worktree.

## Database Migration

The `scripts/migrate-mongodb.sh` script handles exporting and importing MongoDB data between machines using `mongodump` and `mongorestore`.

### Export (source machine)

```bash
./scripts/migrate-mongodb.sh export
```

This creates a `mongodb-dump/` directory and compresses it to `mongodb-dump.tar.gz`. The script auto-detects the database name from `.env.local`.

### Import (target machine)

```bash
# Extract the archive
tar -xzf mongodb-dump.tar.gz

# Import into the local database (--drop replaces existing data)
./scripts/migrate-mongodb.sh import ./mongodb-dump

# Recreate indexes (not included in the dump)
npm run setup-db
```

You can override the database name with the `MONGODB_DB_NAME` environment variable:

```bash
MONGODB_DB_NAME=my-custom-db ./scripts/migrate-mongodb.sh export
```

If `mongodump` or `mongorestore` are not found, install the MongoDB database tools:

```bash
sudo apt-get install -y mongodb-database-tools
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes and pull requests to `main`.

### What CI Does

1. **Lint** -- `npm run lint -- --max-warnings=0` (zero warnings allowed)
2. **Test with coverage** -- `npm run test:coverage` with fake environment variables:
   ```yaml
   MONGODB_URI: mongodb://localhost:27017/fake
   GOOGLE_CLIENT_ID: fake
   GOOGLE_CLIENT_SECRET: fake
   NODE_ENV: test
   SKIP_DB_SETUP: true
   ```
3. **Build** -- not run in CI; use `npm run check` locally to validate production builds

CI does **not** run `next build`. The production build is tested locally via `npm run check`.

### Local Equivalent

Run the full validation suite locally before pushing:

```bash
npm run check
```

This runs lint (`--max-warnings=0`), test with coverage, and a production build, all with fake database environment variables so no real MongoDB connection is needed.

## Project Configuration

### `next.config.ts`

- **`eslint.ignoreDuringBuilds: true`** -- ESLint runs as a separate CI step, not during `next build`.
- **`images.remotePatterns`** -- Allows images from `lh3.googleusercontent.com` (Google profile photos).
- **`images.minimumCacheTTL`** -- 30-day cache TTL for optimized images (`60 * 60 * 24 * 30` seconds).

### `tsconfig.json`

- **`strict: true`** -- Full TypeScript strict mode.
- **`moduleResolution: "bundler"`** -- Modern resolution strategy for Next.js.
- **`paths: { "@/*": ["./src/*"] }`** -- The `@/` import alias maps to `src/`.
- **`noEmit: true`** -- TypeScript is used for type checking only; Next.js handles compilation.
- **`target: "ES2017"`**, **`module: "esnext"`** -- Modern JS output.

### `eslint.config.mjs`

ESLint v9 flat config format. Uses `@eslint/eslintrc`'s `FlatCompat` to bridge Next.js's legacy-format configs (`next/core-web-vitals`, `next/typescript`) into the flat config system. Test file overrides are defined as a separate config object in the array.

### `package.json`

- **`"type": "module"`** -- The project is ESM. Any standalone `.js` scripts use ESM imports. Scripts needing `require()` must use the `.cjs` extension.
