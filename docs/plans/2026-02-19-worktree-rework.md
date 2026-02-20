# Worktree Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace custom bash worktree scripts with a superpowers-native approach where worktrees live inside the project at `.worktrees/`, postinstall auto-detects worktree context and sets everything up, and the dev server explicitly passes `--port` for reliability.

**Architecture:** Three new Node.js scripts replace three old bash scripts. `setup-worktree.js` runs as `postinstall` and auto-detects whether it's in a worktree or the main repo — if worktree, it generates `.env.local` with a deterministic port (hashed from branch name), clones the main DB, and runs setup-db. `dev-server.js` reads PORT from `.env.local` and passes `--port` explicitly to Next.js. `worktree-remove.js` drops the worktree's DB and runs `git worktree remove`.

**Tech Stack:** Node.js (ESM), MongoDB (`mongodump`/`mongorestore` CLI tools, `mongosh`), Next.js Turbopack dev server, git worktrees

---

### Task 1: Add `.worktrees/` to `.gitignore`

**Files:**
- Modify: `.gitignore`

**Step 1: Add `.worktrees/` to `.gitignore`**

Add this line after the existing `.playwright-mcp/` entry in the `# misc` section:

```
.worktrees/
```

The full `# misc` section should become:

```
# misc
.DS_Store
*.pem
.playwright-mcp/
.worktrees/
```

**Step 2: Verify it's ignored**

Run: `git check-ignore .worktrees/`
Expected: `.worktrees/` printed (confirms git will ignore it)

**Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: add .worktrees/ to .gitignore for in-project worktrees"
```

---

### Task 2: Create `scripts/setup-worktree.js`

This is the core script. It runs as `postinstall` and handles both main-repo and worktree contexts.

**Files:**
- Create: `scripts/setup-worktree.js`

**Step 1: Create the script**

Create `scripts/setup-worktree.js` with this content:

```js
#!/usr/bin/env node

/**
 * Worktree-aware postinstall script.
 *
 * When run in the main repo: delegates to setup-database.js (existing behavior).
 * When run in a worktree: generates .env.local (deterministic port + unique DB),
 * clones the main DB, then runs setup-database.js.
 *
 * Usage: node scripts/setup-worktree.js
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Skip in CI/test environments
if (process.env.CI === 'true' || process.env.NODE_ENV === 'test' || process.env.SKIP_DB_SETUP === 'true') {
  console.log('Skipping worktree setup (CI/test/disabled).');
  process.exit(0);
}

/**
 * Detect whether we're in a worktree or the main repo.
 * Returns { isWorktree, mainWorktreePath, branchName }
 */
function detectWorktreeContext() {
  try {
    const commonDir = execSync('git rev-parse --git-common-dir', { encoding: 'utf8', cwd: projectRoot }).trim();
    const gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf8', cwd: projectRoot }).trim();

    const resolvedCommon = resolve(projectRoot, commonDir);
    const resolvedGit = resolve(projectRoot, gitDir);
    const isWorktree = resolvedCommon !== resolvedGit;

    if (!isWorktree) {
      return { isWorktree: false, mainWorktreePath: null, branchName: null };
    }

    // The common dir is <main-repo>/.git — its parent is the main worktree
    const mainWorktreePath = resolve(resolvedCommon, '..');
    const branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', cwd: projectRoot }).trim();

    return { isWorktree: true, mainWorktreePath, branchName };
  } catch {
    return { isWorktree: false, mainWorktreePath: null, branchName: null };
  }
}

/**
 * Deterministic port from branch name. Hashes the name to a port in 3001-3999.
 */
function portFromBranchName(branchName) {
  const hash = createHash('sha256').update(branchName).digest();
  const num = hash.readUInt32BE(0);
  return 3001 + (num % 999);
}

/**
 * Sanitize branch name for use as a database name suffix.
 */
function sanitizeBranchName(branchName) {
  return branchName.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Generate .env.local for a worktree from the main repo's .env.local.
 */
function generateEnvLocal(mainWorktreePath, branchName) {
  const mainEnvPath = resolve(mainWorktreePath, '.env.local');
  if (!existsSync(mainEnvPath)) {
    console.error('Error: Main worktree .env.local not found at ' + mainEnvPath);
    console.error('The main repo must have a .env.local for worktree setup.');
    process.exit(1);
  }

  const port = portFromBranchName(branchName);
  const safeName = sanitizeBranchName(branchName);
  const dbName = 'weekly-eats-' + safeName;

  let envContent = readFileSync(mainEnvPath, 'utf8');

  // Replace MONGODB_URI database name
  envContent = envContent.replace(
    /MONGODB_URI=mongodb:\/\/localhost:27017\/[^\s]*/,
    'MONGODB_URI=mongodb://localhost:27017/' + dbName
  );

  // Replace NEXTAUTH_URL port
  envContent = envContent.replace(
    /NEXTAUTH_URL=http:\/\/localhost:\d+/,
    'NEXTAUTH_URL=http://localhost:' + port
  );

  // Remove any existing PORT= line, then add ours
  envContent = envContent.replace(/^PORT=.*\n?/m, '');
  envContent = envContent.trimEnd() + '\nPORT=' + port + '\n';

  writeFileSync(resolve(projectRoot, '.env.local'), envContent);

  console.log('Generated .env.local: port=' + port + ', database=' + dbName);
  return { port, dbName };
}

/**
 * Clone the main database to the worktree database using mongodump/mongorestore.
 */
function cloneDatabase(mainWorktreePath, dbName) {
  const hasMongodump = spawnSync('which', ['mongodump'], { encoding: 'utf8' }).status === 0;
  const hasMongorestore = spawnSync('which', ['mongorestore'], { encoding: 'utf8' }).status === 0;

  if (!hasMongodump || !hasMongorestore) {
    console.warn('Warning: mongodump/mongorestore not found. Skipping database clone.');
    console.warn('Install mongodb-database-tools to enable automatic database cloning.');
    return;
  }

  const mainEnvPath = resolve(mainWorktreePath, '.env.local');
  const mainEnv = readFileSync(mainEnvPath, 'utf8');
  const mainDbMatch = mainEnv.match(/MONGODB_URI=mongodb:\/\/localhost:27017\/([^\s]+)/);
  const mainDbName = mainDbMatch ? mainDbMatch[1] : 'weekly-eats-dev';

  console.log("Cloning database '" + mainDbName + "' -> '" + dbName + "'...");

  const tmpDir = execSync('mktemp -d', { encoding: 'utf8' }).trim();

  try {
    const dumpResult = spawnSync('mongodump', ['--db', mainDbName, '--out', tmpDir, '--quiet'], {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (dumpResult.status !== 0) {
      console.warn('Warning: mongodump failed (is MongoDB running?). Database will be empty.');
      return;
    }

    const restoreResult = spawnSync('mongorestore', ['--db', dbName, tmpDir + '/' + mainDbName, '--quiet', '--drop'], {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (restoreResult.status !== 0) {
      console.warn('Warning: mongorestore failed. Database may be empty.');
    } else {
      console.log('Database cloned successfully.');
    }
  } finally {
    try {
      execSync('rm -rf ' + JSON.stringify(tmpDir));
    } catch { /* ignore cleanup errors */ }
  }
}

/**
 * Run setup-database.js to create indexes.
 */
function runSetupDb() {
  console.log('Running database index setup...');
  try {
    execSync('node scripts/setup-database.js', { cwd: projectRoot, stdio: 'inherit' });
  } catch {
    // setup-database.js handles its own errors gracefully
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const context = detectWorktreeContext();

if (!context.isWorktree) {
  runSetupDb();
} else {
  console.log("Worktree detected: branch '" + context.branchName + "'");
  const { dbName } = generateEnvLocal(context.mainWorktreePath, context.branchName);
  cloneDatabase(context.mainWorktreePath, dbName);
  runSetupDb();
  console.log('Worktree setup complete.');
}
```

**Step 2: Verify the script runs in the main repo context**

Run: `node scripts/setup-worktree.js`
Expected: Should behave like `setup-database.js` — prints "Starting database setup..." and creates indexes (or warns about MongoDB not running).

**Step 3: Commit**

```bash
git add scripts/setup-worktree.js
git commit -m "feat: add setup-worktree.js for postinstall worktree auto-detection"
```

---

### Task 3: Create `scripts/dev-server.js`

Wrapper that reads PORT from `.env.local` and passes `--port` explicitly to `next dev`.

**Files:**
- Create: `scripts/dev-server.js`

**Step 1: Create the script**

Create `scripts/dev-server.js`:

```js
#!/usr/bin/env node

/**
 * Dev server wrapper that reads PORT from .env.local and passes it
 * explicitly to `next dev --turbopack --port <N>`.
 *
 * This is more reliable than relying on Next.js to load PORT from .env.local,
 * which sometimes doesn't work correctly and causes worktrees to start on
 * the wrong port.
 *
 * Usage: node scripts/dev-server.js [--skip-setup]
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const skipSetup = process.argv.includes('--skip-setup');

// Run setup first (unless skipped)
if (!skipSetup) {
  try {
    execSync('node scripts/setup-worktree.js', { cwd: projectRoot, stdio: 'inherit' });
  } catch {
    // setup-worktree.js handles its own errors gracefully
  }
}

// Read PORT from .env.local
let port = 3000;
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  const portMatch = envContent.match(/^PORT=(\d+)/m);
  if (portMatch) {
    port = parseInt(portMatch[1], 10);
  }
}

console.log('Starting dev server on port ' + port + '...');

const child = spawn('npx', ['next', 'dev', '--turbopack', '--port', String(port)], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env }
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
```

**Step 2: Test the script by running it briefly**

Run: `node scripts/dev-server.js --skip-setup`
Expected: Prints "Starting dev server on port 3000..." and starts Next.js. Kill with Ctrl+C after confirming it starts.

**Step 3: Commit**

```bash
git add scripts/dev-server.js
git commit -m "feat: add dev-server.js wrapper for explicit --port passing"
```

---

### Task 4: Create `scripts/worktree-remove.js`

Replaces the bash `worktree-remove.sh`. Non-interactive: takes a branch name and does DB drop + git worktree remove.

**Files:**
- Create: `scripts/worktree-remove.js`

**Step 1: Create the script**

Create `scripts/worktree-remove.js`:

```js
#!/usr/bin/env node

/**
 * Remove a git worktree and its associated MongoDB database.
 *
 * Usage: node scripts/worktree-remove.js <branch-name>
 *
 * What it does:
 * 1. Derives the DB name from the branch name
 * 2. Drops the MongoDB database (if mongosh is available)
 * 3. Runs `git worktree remove .worktrees/<safe-name>`
 * 4. Runs `git worktree prune`
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const branchName = process.argv[2];

if (!branchName) {
  console.error('Usage: node scripts/worktree-remove.js <branch-name>');
  console.error('');
  console.error('Removes the worktree at .worktrees/<branch> and drops its database.');
  process.exit(1);
}

function sanitizeBranchName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const safeName = sanitizeBranchName(branchName);
const worktreePath = resolve(projectRoot, '.worktrees', safeName);
const dbName = 'weekly-eats-' + safeName;

if (!existsSync(worktreePath)) {
  console.error('Error: No worktree found at ' + worktreePath);
  console.error('');
  try {
    const list = execSync('git worktree list', { encoding: 'utf8', cwd: projectRoot });
    console.error('Current worktrees:');
    console.error(list);
  } catch { /* ignore */ }
  process.exit(1);
}

if (resolve(worktreePath) === resolve(projectRoot)) {
  console.error('Error: Cannot remove the main worktree.');
  process.exit(1);
}

// Drop MongoDB database
const hasMongosh = spawnSync('which', ['mongosh'], { encoding: 'utf8' }).status === 0;
if (hasMongosh) {
  console.log("Dropping database '" + dbName + "'...");
  const dropResult = spawnSync('mongosh', ['--quiet', '--eval', "db.getSiblingDB('" + dbName + "').dropDatabase()"], {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  if (dropResult.status !== 0) {
    console.warn("Warning: Could not drop database. You may need to drop '" + dbName + "' manually.");
  } else {
    console.log('Database dropped.');
  }
} else {
  console.warn("Warning: mongosh not found. Database '" + dbName + "' was NOT dropped.");
  console.warn("To drop it manually: mongosh --eval \"db.getSiblingDB('" + dbName + "').dropDatabase()\"");
}

// Remove worktree
console.log('Removing worktree at ' + worktreePath + '...');
try {
  execSync('git worktree remove ' + JSON.stringify(worktreePath) + ' --force', { cwd: projectRoot, stdio: 'inherit' });
} catch {
  console.warn('Warning: git worktree remove failed. Cleaning up manually...');
  execSync('rm -rf ' + JSON.stringify(worktreePath), { cwd: projectRoot });
}

execSync('git worktree prune', { cwd: projectRoot });

console.log('Worktree removed successfully.');
```

**Step 2: Verify the script prints usage when called with no arguments**

Run: `node scripts/worktree-remove.js`
Expected: Prints usage message and exits with code 1.

**Step 3: Commit**

```bash
git add scripts/worktree-remove.js
git commit -m "feat: add worktree-remove.js for DB drop + worktree cleanup"
```

---

### Task 5: Update `package.json` scripts

Replace old worktree scripts with new ones. Update `postinstall` to use `setup-worktree.js`. Update `dev` and `dev:fast` to use `dev-server.js`.

**Files:**
- Modify: `package.json:6-23` (the `"scripts"` section)

**Step 1: Update the scripts section**

Make these specific changes to the `"scripts"` object:

| Key | Old value | New value |
|---|---|---|
| `dev` | `npm run setup-db && next dev --turbopack` | `node scripts/dev-server.js` |
| `dev:fast` | `next dev --turbopack` | `node scripts/dev-server.js --skip-setup` |
| `postinstall` | `npm run setup-db` | `node scripts/setup-worktree.js` |
| `worktree:create` | `./scripts/worktree-create.sh` | **DELETE this key** |
| `worktree:list` | `./scripts/worktree-list.sh` | **DELETE this key** |
| `worktree:remove` | `./scripts/worktree-remove.sh` | `node scripts/worktree-remove.js` |

All other scripts remain unchanged.

**Step 2: Verify npm scripts are valid**

Run: `npm run --list`
Expected: All scripts listed without errors. `worktree:create` and `worktree:list` should be absent.

**Step 3: Run `npm run check` to verify nothing is broken**

Run: `npm run check`
Expected: Lint passes, tests pass (651+), build succeeds. The 3 pre-existing convert test failures are expected.

**Step 4: Commit**

```bash
git add package.json
git commit -m "feat: update package.json scripts for new worktree system"
```

---

### Task 6: Delete old bash worktree scripts

**Files:**
- Delete: `scripts/worktree-create.sh`
- Delete: `scripts/worktree-list.sh`
- Delete: `scripts/worktree-remove.sh`

**Step 1: Delete the old scripts**

```bash
git rm scripts/worktree-create.sh scripts/worktree-list.sh scripts/worktree-remove.sh
```

**Step 2: Commit**

```bash
git commit -m "chore: remove old bash worktree scripts (replaced by Node.js equivalents)"
```

---

### Task 7: Update `CLAUDE.md` worktree section

Replace the current worktree section with the new approach.

**Files:**
- Modify: `CLAUDE.md:21-57` (the `## Worktree / Multi-Agent Workflow` section)
- Modify: `CLAUDE.md:145` (the `## Do Not Edit` section)

**Step 1: Replace the worktree section**

Replace everything from `## Worktree / Multi-Agent Workflow` up to (but not including) `## Project Structure` with:

```markdown
## Worktree / Multi-Agent Workflow

This project supports running multiple Claude Code agents (or developers) in parallel using git worktrees. Each worktree gets an isolated port, database, and `node_modules`.

### Commands

\`\`\`bash
# Create a new worktree
git worktree add .worktrees/<branch> -b <branch>
cd .worktrees/<branch> && npm install
# postinstall auto-detects worktree context: generates .env.local, clones DB, creates indexes

# List all worktrees
git worktree list

# Remove a worktree (drops DB + removes worktree)
node scripts/worktree-remove.js <branch-name>
\`\`\`

### How Isolation Works

| Resource | Main worktree | Each new worktree |
|----------|--------------|-------------------|
| Port | 3000 | Deterministic 3001-3999 (hashed from branch name) |
| Database | from `.env.local` | `weekly-eats-<branch>` (cloned from main) |
| `node_modules` | Own copy | Own copy |
| `.env.local` | Manual | Auto-generated by postinstall |
| `.next/` build cache | Own | Own |

Worktrees live at `.worktrees/<branch>/` inside the project directory.

### Dev Server

`npm run dev` uses a wrapper (`scripts/dev-server.js`) that reads PORT from `.env.local` and passes it explicitly as `next dev --turbopack --port <N>`. This ensures worktrees always start on their assigned port.

### Rules for Parallel Agents

- **Never run two agents on the same worktree/branch** — file edits will collide
- **Always create a worktree** before starting parallel work on a new branch
- **`npm test` and `npm run check` are safe** in any worktree (they use fake DB URIs)
- **Clean up worktrees when done** — `node scripts/worktree-remove.js <branch>` drops the DB and removes the worktree
```

**Step 2: Update the Do Not Edit section**

In the `## Do Not Edit` section, change:

```
- `.env.local` — contains secrets; auto-generated in worktrees by `worktree-create.sh`
```

to:

```
- `.env.local` — contains secrets; auto-generated in worktrees by postinstall
```

**Step 3: Verify CLAUDE.md is well-formed**

Read the file and confirm the markdown is valid and all sections are present.

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md worktree section for new in-project approach"
```

---

### Task 8: Update `docs/setup.md` worktree and related sections

Replace the worktree workflow section and update postinstall/dev server descriptions.

**Files:**
- Modify: `docs/setup.md:70` (postinstall description)
- Modify: `docs/setup.md:96-110` (dev server section)
- Modify: `docs/setup.md:156-196` (worktree workflow section)

**Step 1: Update the postinstall description**

Replace line 70:

```
The `postinstall` hook automatically runs `npm run setup-db`, so database indexes are created as part of the install step. If MongoDB is not running at install time, the script warns and exits gracefully -- the dev server will still start, and you can run `npm run setup-db` later once MongoDB is available.
```

with:

```
The `postinstall` hook runs `scripts/setup-worktree.js`, which auto-detects whether you're in a worktree or the main repo. In the main repo it creates database indexes. In a worktree it also generates `.env.local` and clones the main database. If MongoDB is not running at install time, the script warns and exits gracefully -- the dev server will still start, and you can run `npm run setup-db` later once MongoDB is available.
```

**Step 2: Update the dev server section**

Replace the dev server section (lines 96-110) with:

```markdown
## Dev Server

Three npm scripts for different scenarios:

\`\`\`bash
# Full start: run worktree setup (or setup-db in main) then start Turbopack dev server
npm run dev

# Fast start: skip setup, just start Turbopack dev server
npm run dev:fast

# Clean start: delete .next cache, then run full dev
npm run dev:clean
\`\`\`

All three use [Turbopack](https://turbo.build/pack) via `next dev --turbopack`. The dev server reads PORT from `.env.local` and passes it explicitly as `--port <N>`, ensuring worktrees always start on their assigned port.
```

**Step 3: Replace the worktree section**

Replace the `## Worktree Workflow` section (lines 156-196) with:

```markdown
## Worktree Workflow

Git worktrees allow running multiple development branches simultaneously with fully isolated ports, databases, and `node_modules`. Worktrees live inside the project at `.worktrees/`, which keeps them within the Claude Code sandbox and avoids permission/consent issues.

### Creating a Worktree

\`\`\`bash
git worktree add .worktrees/<branch> -b <branch>
cd .worktrees/<branch>
npm install
\`\`\`

The `postinstall` hook automatically detects the worktree context and:

1. Generates `.env.local` with a unique port and database name
2. Clones the main database (requires `mongodump`/`mongorestore`)
3. Creates database indexes

### Port Assignment

Each worktree gets a deterministic port derived from hashing the branch name (range 3001-3999). The same branch name always maps to the same port. The dev server reads PORT from `.env.local` and passes it explicitly via `next dev --turbopack --port <N>`, so the port is always reliable.

### Listing Worktrees

\`\`\`bash
git worktree list
\`\`\`

### Removing a Worktree

\`\`\`bash
node scripts/worktree-remove.js <branch-name>
\`\`\`

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
```

**Step 4: Commit**

```bash
git add docs/setup.md
git commit -m "docs: update setup.md for new worktree system"
```

---

### Task 9: Final validation

**Step 1: Run full validation**

Run: `npm run check`
Expected: Lint passes, tests pass (651+, with 3 pre-existing convert failures), build succeeds.

**Step 2: Verify the old scripts are gone**

Run: `ls scripts/worktree-*.sh 2>/dev/null || echo "No old bash scripts found (good)"`
Expected: "No old bash scripts found (good)"

**Step 3: Verify new scripts exist**

Run: `ls scripts/setup-worktree.js scripts/dev-server.js scripts/worktree-remove.js`
Expected: All three files listed.

**Step 4: Verify .worktrees/ is ignored**

Run: `git check-ignore .worktrees/`
Expected: `.worktrees/` printed.

**Step 5: Push to the PR branch**

```bash
git push
```
