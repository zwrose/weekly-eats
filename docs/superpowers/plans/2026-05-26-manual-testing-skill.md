# Manual Testing Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a scenario-engine + `/manual-testing` skill that seeds idempotent test data into the worktree MongoDB, generates checkbox test plans, and posts them as PR comments — replacing the existing `seed-*.cjs` scripts with one unified system.

**Architecture:** A TypeScript engine under `test/manual/` defines composable "blocks" (one per app collection), each tagged with `_seedManifestId` and `_seedScenarioId` for clean idempotent diff-aware re-apply. A CLI runs the engine; a Claude Code skill orchestrates the CLI + PR comment posting. Two new collections (`manualTestState`, `manualTestLocks`) track per-scenario state and per-manifest advisory locks.

**Tech Stack:** TypeScript, Node 20+, `tsx` (CLI runner), `zod` (config validation), MongoDB driver, `gh` CLI, Vitest (with new workspace split), Next.js 15 / React 19 (existing project).

**Spec:** `docs/superpowers/specs/2026-05-26-manual-testing-skill-design.md`

---

## Phase 0 — Project Setup

### Task 0.1: Add dependencies + npm scripts

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Add `tsx` and `zod` to devDependencies**

Edit `package.json` — add to `devDependencies` (pinned exact versions, alphabetical):

```json
    "tsx": "4.19.2",
    "zod": "3.23.8",
```

- [ ] **Step 2: Add npm scripts**

Edit `package.json` `scripts` block — add after `"test:coverage"`:

```json
    "test:manual": "tsx test/manual/cli.ts",
    "test:manual:apply": "tsx test/manual/cli.ts apply",
    "test:manual:clean": "tsx test/manual/cli.ts clean",
    "test:manual:status": "tsx test/manual/cli.ts status",
    "test:manual:gen-catalog": "tsx test/manual/cli.ts gen-catalog",
    "test:manual:unlock": "tsx test/manual/cli.ts unlock",
    "seed:demo": "tsx test/manual/cli.ts apply --manifest demo",
```

- [ ] **Step 3: Run `npm install`**

Run: `npm install`
Expected: installs `tsx` and `zod` cleanly; updates `package-lock.json`. No errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add tsx + zod devDeps and test:manual npm scripts"
```

### Task 0.2: Directory structure + gitignore

**Files:**

- Create: `test/manual/scenarios/__tests__/.gitkeep`
- Create: `test/manual/__tests__/.gitkeep`
- Create: `test/manual/manifests/.gitkeep`
- Create: `test/manual/plans/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Create directory skeleton**

Run:

```bash
mkdir -p test/manual/scenarios/__tests__ test/manual/manifests test/manual/plans test/manual/__tests__
touch test/manual/scenarios/__tests__/.gitkeep test/manual/__tests__/.gitkeep test/manual/manifests/.gitkeep test/manual/plans/.gitkeep
```

- [ ] **Step 2: Update `.gitignore`**

Append to `.gitignore`:

```
# manual-testing local plans (when no PR exists)
test/manual/plans/*
!test/manual/plans/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add test/manual/ .gitignore
git commit -m "chore: scaffold test/manual directory structure"
```

### Task 0.3: Vitest workspace split

**Files:**

- Create: `vitest.workspace.ts`
- Create: `vitest.manual.config.ts`
- Modify: (none yet — `vitest.config.ts` unchanged)

- [ ] **Step 1: Write `vitest.workspace.ts`**

```ts
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace(['./vitest.config.ts', './vitest.manual.config.ts']);
```

- [ ] **Step 2: Write `vitest.manual.config.ts`**

```ts
// vitest.manual.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'manual-engine',
    environment: 'node',
    include: ['test/manual/**/*.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 20_000,
    hookTimeout: 20_000,
    setupFiles: [],
  },
});
```

- [ ] **Step 3: Sanity-run `npm test`**

Run: `npm test`
Expected: existing test suite still passes (workspace picks up `vitest.config.ts` as before, and the manual config has no test files yet so it's a no-op).

If `npm test` fails because vitest doesn't recognize workspaces, the project may need vitest workspace flag in the script. In that case, modify `test` script to add `--workspace vitest.workspace.ts`:

```json
"test": "vitest run --workspace vitest.workspace.ts --run --pool=forks --poolOptions.forks.singleFork=true --isolate",
```

Test again. If it still fails, the `--pool` flags conflict with workspace mode — drop them from the top-level script (each workspace config has its own pool settings).

Final acceptable form (only if needed):

```json
"test": "vitest run --workspace vitest.workspace.ts",
"test:coverage": "vitest run --workspace vitest.workspace.ts --coverage",
```

- [ ] **Step 4: Commit**

```bash
git add vitest.workspace.ts vitest.manual.config.ts package.json
git commit -m "build: split vitest into app (jsdom) + manual-engine (node) workspaces"
```

---

## Phase 1 — Engine Foundation (types, utilities)

### Task 1.1: `types.ts` — core interfaces

**Files:**

- Create: `test/manual/types.ts`

- [ ] **Step 1: Write `types.ts`**

```ts
// test/manual/types.ts
import type { Db, ObjectId } from 'mongodb';

// ─── Canonical collection names ─────────────────────────────────────────
// Used by registry tests to validate blocks only write to known collections.
export const KNOWN_COLLECTIONS = [
  'mealPlans',
  'mealPlanTemplates',
  'foodItems',
  'recipes',
  'recipeUserData',
  'pantry',
  'stores',
  'storeItemPositions',
  'shoppingLists',
  'purchaseHistory',
  'users',
] as const;

export type KnownCollection = (typeof KNOWN_COLLECTIONS)[number];

// ─── Manifest ───────────────────────────────────────────────────────────
export interface ManifestScenario {
  id: string;
  block: string;
  config?: unknown;
  dependsOn?: string[];
}

export interface ManifestStepMapping {
  step: string;
  scenarioIds: string[];
  notes?: string;
}

export interface Manifest {
  schemaVersion: 1;
  branch: string;
  slot: string;
  createdAt: string;
  updatedAt: string;
  scenarios: ManifestScenario[];
  stepMappings?: ManifestStepMapping[];
}

// ─── Block interface ────────────────────────────────────────────────────
export interface BlockContext {
  db: Db;
  manifestId: string;
  scenarioId: string;
  resolve: <T = unknown>(id: string) => T;
}

export interface BlockApplyResult<State = unknown> {
  state: State;
  docCount: number;
  summary: string;
}

export interface BlockDocumentation {
  description: string;
  configExamples: Array<{ label: string; config: unknown }>;
  dependencies: string[];
  collectionsWritten: KnownCollection[];
}

export interface Block<Config = unknown, State = unknown> {
  name: string;
  documentation: BlockDocumentation;
  validate(config: unknown): Config;
  apply(config: Config, ctx: BlockContext): Promise<BlockApplyResult<State>>;
  clean(ctx: BlockContext): Promise<{ docCount: number }>;
  status(ctx: BlockContext): Promise<{
    present: boolean;
    docCount: number;
    configHashMatches: boolean;
  }>;
}

// ─── Engine state ───────────────────────────────────────────────────────
export interface ManualTestStateDoc {
  _id?: ObjectId;
  manifestId: string;
  scenarioId: string;
  blockName: string;
  configHash: string;
  state: unknown;
  lastAppliedAt: Date;
  lastConfigJson: string;
  lastApplyError?: string | null;
}

export interface ManualTestLockDoc {
  _id?: ObjectId;
  manifestId: string;
  acquiredAt: Date;
  expireAt: Date;
  pid: number;
  hostname: string;
  cliInvocation: string;
}

// ─── CLI result ─────────────────────────────────────────────────────────
export type ScenarioStatus = 'applied' | 'skipped' | 'failed' | 'cleaned' | 'pending';

export interface CliScenarioResult {
  id: string;
  block: string;
  status: ScenarioStatus;
  docCount: number;
  summary: string;
  configHash: string;
  durationMs: number;
  error: string | null;
}

export interface CliResult {
  schemaVersion: 1;
  ok: boolean;
  command: string;
  manifestId: string | null;
  exitCode: number;
  scenarios: CliScenarioResult[];
  lock: { acquiredAt: string; releasedAt: string } | null;
  warnings: string[];
}
```

- [ ] **Step 2: Type-check it**

Run: `npx tsc --noEmit test/manual/types.ts`
Expected: passes (no errors).

- [ ] **Step 3: Commit**

```bash
git add test/manual/types.ts
git commit -m "feat(manual-testing): add core types (Block, Manifest, CliResult, state docs)"
```

### Task 1.2: `hash.ts` — stable config hashing (TDD)

**Files:**

- Create: `test/manual/hash.ts`
- Create: `test/manual/__tests__/hash.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// test/manual/__tests__/hash.test.ts
import { describe, it, expect } from 'vitest';
import { stableHash } from '../hash.js';

describe('stableHash', () => {
  it('produces a sha256-prefixed string', () => {
    expect(stableHash({ a: 1 })).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('produces identical hashes regardless of key order', () => {
    expect(stableHash({ a: 1, b: 2 })).toBe(stableHash({ b: 2, a: 1 }));
  });

  it('handles nested objects with stable key order', () => {
    expect(stableHash({ a: { b: 1, c: 2 }, d: 3 })).toBe(stableHash({ d: 3, a: { c: 2, b: 1 } }));
  });

  it('preserves array order (arrays are ordered)', () => {
    expect(stableHash([1, 2, 3])).not.toBe(stableHash([3, 2, 1]));
  });

  it('distinguishes string from number', () => {
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: '1' }));
  });

  it('handles null, undefined-elided, and empty objects', () => {
    expect(stableHash({ a: null })).not.toBe(stableHash({ a: 0 }));
    expect(stableHash({})).toMatch(/^sha256:/);
  });
});
```

- [ ] **Step 2: Verify it fails**

Run: `npx vitest run test/manual/__tests__/hash.test.ts`
Expected: FAIL — "Cannot find module '../hash.js'"

- [ ] **Step 3: Implement `hash.ts`**

```ts
// test/manual/hash.ts
import { createHash } from 'node:crypto';

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = canonicalize((value as Record<string, unknown>)[key]);
  }
  return result;
}

export function stableHash(value: unknown): string {
  const json = JSON.stringify(canonicalize(value));
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run test/manual/__tests__/hash.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add test/manual/hash.ts test/manual/__tests__/hash.test.ts
git commit -m "feat(manual-testing): add stable config hash utility with tests"
```

### Task 1.3: `validate-args.ts` — allowlist regex + branch sanitization (TDD)

**Files:**

- Create: `test/manual/validate-args.ts`
- Create: `test/manual/__tests__/validate-args.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// test/manual/__tests__/validate-args.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateBranch,
  validateSlot,
  sanitizeBranchForFilename,
  unsanitizeBranchFromFilename,
} from '../validate-args.js';

describe('validateBranch', () => {
  it('accepts safe branch names', () => {
    expect(() => validateBranch('main')).not.toThrow();
    expect(() => validateBranch('feat/meal-editor')).not.toThrow();
    expect(() => validateBranch('release-v1.2.3')).not.toThrow();
    expect(() => validateBranch('user/zach.rose/wip')).not.toThrow();
  });

  it('rejects empty', () => {
    expect(() => validateBranch('')).toThrow(/branch/i);
  });

  it('rejects shell metacharacters', () => {
    expect(() => validateBranch('feat;rm -rf .')).toThrow();
    expect(() => validateBranch('feat$(curl evil)')).toThrow();
    expect(() => validateBranch('feat`whoami`')).toThrow();
    expect(() => validateBranch('feat&echo')).toThrow();
    expect(() => validateBranch('feat|cat')).toThrow();
    expect(() => validateBranch('feat>out')).toThrow();
  });

  it('rejects HTML marker fragments', () => {
    expect(() => validateBranch('feat-->evil')).toThrow();
    expect(() => validateBranch('feat<!--')).toThrow();
  });

  it('rejects over-long names (>200 chars)', () => {
    expect(() => validateBranch('a'.repeat(201))).toThrow();
  });
});

describe('validateSlot', () => {
  it('accepts safe slot names', () => {
    expect(() => validateSlot('default')).not.toThrow();
    expect(() => validateSlot('admin-flow')).not.toThrow();
    expect(() => validateSlot('slot.1')).not.toThrow();
  });

  it('rejects slash (slots are flat — no path separators)', () => {
    expect(() => validateSlot('a/b')).toThrow();
  });

  it('rejects shell metachars and HTML markers', () => {
    expect(() => validateSlot('a;b')).toThrow();
    expect(() => validateSlot('a-->b')).toThrow();
  });

  it('rejects over-long (>64 chars)', () => {
    expect(() => validateSlot('a'.repeat(65))).toThrow();
  });
});

describe('sanitizeBranchForFilename', () => {
  it('replaces / with %2F', () => {
    expect(sanitizeBranchForFilename('feat/meal-editor')).toBe('feat%2Fmeal-editor');
  });
  it('passes through safe chars', () => {
    expect(sanitizeBranchForFilename('main')).toBe('main');
  });
});

describe('unsanitizeBranchFromFilename', () => {
  it('reverses sanitization', () => {
    expect(unsanitizeBranchFromFilename('feat%2Fmeal-editor')).toBe('feat/meal-editor');
  });
});
```

- [ ] **Step 2: Verify fails**

Run: `npx vitest run test/manual/__tests__/validate-args.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// test/manual/validate-args.ts
const BRANCH_RE = /^[a-zA-Z0-9._/-]{1,200}$/;
const SLOT_RE = /^[a-zA-Z0-9._-]{1,64}$/;
const HTML_MARKER_FRAGMENTS = ['-->', '<!--'];

function hasMarkerFragment(s: string): boolean {
  return HTML_MARKER_FRAGMENTS.some((f) => s.includes(f));
}

export function validateBranch(branch: string): string {
  if (!branch || typeof branch !== 'string') {
    throw new Error('branch: must be a non-empty string');
  }
  if (branch.length > 200) {
    throw new Error(`branch: too long (${branch.length} > 200)`);
  }
  if (!BRANCH_RE.test(branch)) {
    throw new Error(`branch: contains disallowed characters (allowed: a-zA-Z0-9._/-): ${branch}`);
  }
  if (hasMarkerFragment(branch)) {
    throw new Error(`branch: contains HTML marker fragment: ${branch}`);
  }
  return branch;
}

export function validateSlot(slot: string): string {
  if (!slot || typeof slot !== 'string') {
    throw new Error('slot: must be a non-empty string');
  }
  if (slot.length > 64) {
    throw new Error(`slot: too long (${slot.length} > 64)`);
  }
  if (!SLOT_RE.test(slot)) {
    throw new Error(`slot: contains disallowed characters (allowed: a-zA-Z0-9._-): ${slot}`);
  }
  if (hasMarkerFragment(slot)) {
    throw new Error(`slot: contains HTML marker fragment: ${slot}`);
  }
  return slot;
}

export function sanitizeBranchForFilename(branch: string): string {
  return branch.replace(/\//g, '%2F');
}

export function unsanitizeBranchFromFilename(name: string): string {
  return name.replace(/%2F/g, '/');
}

export function manifestId(branch: string, slot: string): string {
  return `${branch}::${slot}`;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run test/manual/__tests__/validate-args.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add test/manual/validate-args.ts test/manual/__tests__/validate-args.test.ts
git commit -m "feat(manual-testing): add branch/slot allowlist validation"
```

### Task 1.4: `manifest-io.ts` — load/save/validate manifests (TDD)

**Files:**

- Create: `test/manual/manifest-io.ts`
- Create: `test/manual/__tests__/manifest-io.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// test/manual/__tests__/manifest-io.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadManifest, saveManifest, manifestPath, validateManifest } from '../manifest-io.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mt-manifest-'));
  mkdirSync(join(tmpDir, 'manifests'), { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('manifestPath', () => {
  it('builds path with sanitized branch + default slot omits suffix', () => {
    expect(manifestPath(tmpDir, 'feat/x', 'default')).toBe(
      join(tmpDir, 'manifests', 'feat%2Fx.json')
    );
  });

  it('includes slot suffix for non-default slot', () => {
    expect(manifestPath(tmpDir, 'feat/x', 'admin')).toBe(
      join(tmpDir, 'manifests', 'feat%2Fx.admin.json')
    );
  });

  it('special-cases bare manifest names with no branch sanitization', () => {
    expect(manifestPath(tmpDir, 'demo', 'default')).toBe(join(tmpDir, 'manifests', 'demo.json'));
  });
});

describe('validateManifest', () => {
  const validManifest = {
    schemaVersion: 1,
    branch: 'feat/x',
    slot: 'default',
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
    scenarios: [
      { id: 'u', block: 'user-baseline' },
      { id: 'r', block: 'recipes', config: { count: 1, isGlobal: false }, dependsOn: ['u'] },
    ],
  };

  it('accepts a valid manifest', () => {
    expect(() => validateManifest(validManifest)).not.toThrow();
  });

  it('rejects unknown schemaVersion', () => {
    expect(() => validateManifest({ ...validManifest, schemaVersion: 99 })).toThrow(
      /schemaVersion/
    );
  });

  it('rejects missing scenarios array', () => {
    const bad = { ...validManifest, scenarios: undefined };
    expect(() => validateManifest(bad)).toThrow(/scenarios/);
  });

  it('rejects scenario with duplicate id', () => {
    const dup = {
      ...validManifest,
      scenarios: [
        { id: 'a', block: 'user-baseline' },
        { id: 'a', block: 'food-items' },
      ],
    };
    expect(() => validateManifest(dup)).toThrow(/duplicate.*id.*a/i);
  });

  it('rejects dependsOn pointing at non-existent scenario', () => {
    const broken = {
      ...validManifest,
      scenarios: [{ id: 'r', block: 'recipes', dependsOn: ['nope'] }],
    };
    expect(() => validateManifest(broken)).toThrow(/dependency.*nope/i);
  });

  it('rejects invalid branch (shell metachars)', () => {
    expect(() => validateManifest({ ...validManifest, branch: 'feat;rm' })).toThrow(/branch/);
  });

  it('rejects invalid slot', () => {
    expect(() => validateManifest({ ...validManifest, slot: 'bad/slot' })).toThrow(/slot/);
  });
});

describe('saveManifest + loadManifest round-trip', () => {
  it('writes JSON and reads back equal content', async () => {
    const m = {
      schemaVersion: 1 as const,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '2026-05-26T00:00:00.000Z',
      updatedAt: '2026-05-26T00:00:00.000Z',
      scenarios: [{ id: 'u', block: 'user-baseline' }],
    };
    await saveManifest(tmpDir, m);
    const loaded = await loadManifest(manifestPath(tmpDir, 'feat/x', 'default'));
    expect(loaded).toEqual(m);
  });

  it('errors clearly when branch field mismatches filename', async () => {
    const file = join(tmpDir, 'manifests', 'feat%2Fy.json');
    writeFileSync(
      file,
      JSON.stringify({
        schemaVersion: 1,
        branch: 'feat/x', // mismatch
        slot: 'default',
        createdAt: '2026-05-26T00:00:00.000Z',
        updatedAt: '2026-05-26T00:00:00.000Z',
        scenarios: [],
      })
    );
    await expect(loadManifest(file)).rejects.toThrow(/branch.*filename.*mismatch/i);
  });
});
```

- [ ] **Step 2: Verify fails**

Run: `npx vitest run test/manual/__tests__/manifest-io.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// test/manual/manifest-io.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { z } from 'zod';
import {
  validateBranch,
  validateSlot,
  sanitizeBranchForFilename,
  unsanitizeBranchFromFilename,
} from './validate-args.js';
import type { Manifest } from './types.js';

const ScenarioSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/),
  block: z.string().min(1),
  config: z.unknown().optional(),
  dependsOn: z.array(z.string()).optional(),
});

const StepMappingSchema = z.object({
  step: z.string().min(1),
  scenarioIds: z.array(z.string()),
  notes: z.string().optional(),
});

const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  branch: z.string().min(1),
  slot: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  scenarios: z.array(ScenarioSchema),
  stepMappings: z.array(StepMappingSchema).optional(),
});

export function validateManifest(input: unknown): Manifest {
  const parsed = ManifestSchema.parse(input);
  validateBranch(parsed.branch);
  validateSlot(parsed.slot);

  const ids = new Set<string>();
  for (const s of parsed.scenarios) {
    if (ids.has(s.id)) {
      throw new Error(`manifest: duplicate scenario id: ${s.id}`);
    }
    ids.add(s.id);
  }

  for (const s of parsed.scenarios) {
    for (const dep of s.dependsOn ?? []) {
      if (!ids.has(dep)) {
        throw new Error(`manifest: scenario "${s.id}" has unknown dependency: ${dep}`);
      }
    }
  }

  return parsed as Manifest;
}

export function manifestPath(rootDir: string, branchOrName: string, slot: string): string {
  // If branchOrName is a bare manifest name (no slashes and no special chars) and matches
  // a checked-in manifest filename, use it as-is (no sanitization, no slot suffix).
  // This is decided by the CLI caller passing pre-resolved names; here we just compute paths.
  const sanitized = sanitizeBranchForFilename(branchOrName);
  const filename = slot === 'default' ? `${sanitized}.json` : `${sanitized}.${slot}.json`;
  return join(rootDir, 'manifests', filename);
}

export async function loadManifest(filePath: string): Promise<Manifest> {
  const raw = await readFile(filePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`manifest: invalid JSON at ${filePath}: ${(e as Error).message}`);
  }
  const m = validateManifest(parsed);

  // Verify branch field matches filename
  const filename = basename(filePath, '.json');
  // strip optional `.<slot>` suffix to recover the sanitized branch
  const sanitizedFromFile = filename.includes('.')
    ? filename.split('.').slice(0, -1).join('.')
    : filename;
  // Special-case: bare manifest names (e.g. "demo") — the manifest may have any branch
  // value the author chose; only enforce when the filename uses a sanitized branch path.
  if (
    sanitizedFromFile.includes('%2F') ||
    sanitizedFromFile === sanitizeBranchForFilename(m.branch)
  ) {
    const reconstructed = unsanitizeBranchFromFilename(sanitizedFromFile);
    if (reconstructed !== m.branch && sanitizedFromFile !== m.branch) {
      throw new Error(
        `manifest: branch field "${m.branch}" mismatch with filename "${filename}" (expected branch "${reconstructed}")`
      );
    }
  }

  return m;
}

export async function saveManifest(rootDir: string, manifest: Manifest): Promise<string> {
  const path = manifestPath(rootDir, manifest.branch, manifest.slot);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return path;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run test/manual/__tests__/manifest-io.test.ts`
Expected: all tests pass. If `manifestPath` for bare names fails, fix the call sites later when CLI does explicit name resolution.

- [ ] **Step 5: Commit**

```bash
git add test/manual/manifest-io.ts test/manual/__tests__/manifest-io.test.ts
git commit -m "feat(manual-testing): add manifest IO (load/save/validate) with Zod schema"
```

### Task 1.5: `lock.ts` — advisory lock using dedicated collection (TDD with mocked Db)

**Files:**

- Create: `test/manual/lock.ts`
- Create: `test/manual/__tests__/lock.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// test/manual/__tests__/lock.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acquireLock, releaseLock, forceUnlock, readLock } from '../lock.js';
import type { Db } from 'mongodb';

function mockDb() {
  const insertOne = vi.fn();
  const deleteOne = vi.fn();
  const findOne = vi.fn();
  const createIndex = vi.fn().mockResolvedValue('ok');
  return {
    db: {
      collection: vi.fn(() => ({
        insertOne,
        deleteOne,
        findOne,
        createIndex,
      })),
    } as unknown as Db,
    insertOne,
    deleteOne,
    findOne,
    createIndex,
  };
}

describe('acquireLock', () => {
  let m: ReturnType<typeof mockDb>;
  beforeEach(() => {
    m = mockDb();
  });

  it('inserts a lock doc and returns metadata', async () => {
    m.insertOne.mockResolvedValue({ insertedId: 'id1' });
    const lock = await acquireLock(m.db, 'feat/x::default', 'apply feat/x');
    expect(lock.manifestId).toBe('feat/x::default');
    expect(lock.acquiredAt).toBeInstanceOf(Date);
    expect(lock.expireAt.getTime() - lock.acquiredAt.getTime()).toBe(300_000);
    expect(m.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        manifestId: 'feat/x::default',
        pid: expect.any(Number),
        hostname: expect.any(String),
        cliInvocation: 'apply feat/x',
      })
    );
  });

  it('throws a structured "lock held" error on duplicate-key', async () => {
    const dupErr: any = new Error('E11000 duplicate key');
    dupErr.code = 11000;
    m.insertOne.mockRejectedValue(dupErr);
    m.findOne.mockResolvedValue({
      manifestId: 'feat/x::default',
      acquiredAt: new Date('2026-05-26T11:58:33Z'),
      expireAt: new Date('2026-05-26T12:03:33Z'),
      pid: 12345,
      hostname: 'laptop.local',
      cliInvocation: 'apply feat/x',
    });
    await expect(acquireLock(m.db, 'feat/x::default', 'apply feat/x')).rejects.toThrow(
      /another apply is in progress/i
    );
  });

  it('ensures TTL index is created idempotently', async () => {
    m.insertOne.mockResolvedValue({ insertedId: 'id1' });
    await acquireLock(m.db, 'feat/x::default', 'apply feat/x');
    expect(m.createIndex).toHaveBeenCalledWith(
      { expireAt: 1 },
      expect.objectContaining({ expireAfterSeconds: 0 })
    );
    expect(m.createIndex).toHaveBeenCalledWith(
      { manifestId: 1 },
      expect.objectContaining({ unique: true })
    );
  });
});

describe('releaseLock', () => {
  it('deletes by manifestId', async () => {
    const m = mockDb();
    await releaseLock(m.db, 'feat/x::default');
    expect(m.deleteOne).toHaveBeenCalledWith({ manifestId: 'feat/x::default' });
  });
});

describe('forceUnlock', () => {
  it('returns lock metadata before deleting', async () => {
    const m = mockDb();
    const lockDoc = {
      manifestId: 'feat/x::default',
      acquiredAt: new Date(),
      expireAt: new Date(),
      pid: 1,
      hostname: 'h',
      cliInvocation: 'apply x',
    };
    m.findOne.mockResolvedValue(lockDoc);
    const result = await forceUnlock(m.db, 'feat/x::default');
    expect(result).toEqual(lockDoc);
    expect(m.deleteOne).toHaveBeenCalledWith({ manifestId: 'feat/x::default' });
  });

  it('returns null when no lock exists', async () => {
    const m = mockDb();
    m.findOne.mockResolvedValue(null);
    const result = await forceUnlock(m.db, 'feat/x::default');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Verify fails**

Run: `npx vitest run test/manual/__tests__/lock.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// test/manual/lock.ts
import type { Db } from 'mongodb';
import { hostname } from 'node:os';
import type { ManualTestLockDoc } from './types.js';

const LOCK_TTL_SECONDS = 300;
const COLLECTION = 'manualTestLocks';

async function ensureIndexes(db: Db): Promise<void> {
  const col = db.collection<ManualTestLockDoc>(COLLECTION);
  await col.createIndex({ manifestId: 1 }, { name: 'manualTestLocks_manifestId', unique: true });
  await col.createIndex(
    { expireAt: 1 },
    { name: 'manualTestLocks_expireAt_ttl', expireAfterSeconds: 0 }
  );
}

export interface AcquiredLock {
  manifestId: string;
  acquiredAt: Date;
  expireAt: Date;
}

export async function acquireLock(
  db: Db,
  manifestId: string,
  cliInvocation: string
): Promise<AcquiredLock> {
  await ensureIndexes(db);
  const col = db.collection<ManualTestLockDoc>(COLLECTION);
  const acquiredAt = new Date();
  const expireAt = new Date(acquiredAt.getTime() + LOCK_TTL_SECONDS * 1000);
  const doc: ManualTestLockDoc = {
    manifestId,
    acquiredAt,
    expireAt,
    pid: process.pid,
    hostname: hostname(),
    cliInvocation,
  };
  try {
    await col.insertOne(doc);
    return { manifestId, acquiredAt, expireAt };
  } catch (e: unknown) {
    const err = e as { code?: number };
    if (err?.code === 11000) {
      const held = await col.findOne({ manifestId });
      const heldBy = held
        ? `PID ${held.pid} on host ${held.hostname} at ${held.acquiredAt.toISOString()} (invocation: ${held.cliInvocation})`
        : 'unknown';
      throw new Error(
        `another apply is in progress\n  manifest: ${manifestId}\n  acquired by: ${heldBy}\n  hint: if the previous process crashed, run \`npm run test:manual:unlock\``
      );
    }
    throw e;
  }
}

export async function releaseLock(db: Db, manifestId: string): Promise<void> {
  const col = db.collection<ManualTestLockDoc>(COLLECTION);
  await col.deleteOne({ manifestId });
}

export async function forceUnlock(db: Db, manifestId: string): Promise<ManualTestLockDoc | null> {
  const col = db.collection<ManualTestLockDoc>(COLLECTION);
  const existing = await col.findOne({ manifestId });
  await col.deleteOne({ manifestId });
  return existing;
}

export async function readLock(db: Db, manifestId: string): Promise<ManualTestLockDoc | null> {
  const col = db.collection<ManualTestLockDoc>(COLLECTION);
  return col.findOne({ manifestId });
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run test/manual/__tests__/lock.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add test/manual/lock.ts test/manual/__tests__/lock.test.ts
git commit -m "feat(manual-testing): add advisory lock with dedicated collection + TTL"
```

---

## Phase 2 — Engine Core

### Task 2.1: `engine.ts` — topo sort + transitive dirty + apply/clean/status (TDD)

**Files:**

- Create: `test/manual/engine.ts`
- Create: `test/manual/__tests__/engine.test.ts`

- [ ] **Step 1: Write failing tests covering all engine behaviors**

```ts
// test/manual/__tests__/engine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { topoSort, computeDirty, Engine } from '../engine.js';
import type { Block, BlockContext, Manifest } from '../types.js';
import type { Db } from 'mongodb';

// ─── topoSort ───
describe('topoSort', () => {
  it('orders linear deps', () => {
    expect(
      topoSort([
        { id: 'a', block: 'x' },
        { id: 'b', block: 'x', dependsOn: ['a'] },
        { id: 'c', block: 'x', dependsOn: ['b'] },
      ])
    ).toEqual(['a', 'b', 'c']);
  });

  it('orders diamond deps', () => {
    const order = topoSort([
      { id: 'a', block: 'x' },
      { id: 'b', block: 'x', dependsOn: ['a'] },
      { id: 'c', block: 'x', dependsOn: ['a'] },
      { id: 'd', block: 'x', dependsOn: ['b', 'c'] },
    ]);
    expect(order[0]).toBe('a');
    expect(order[3]).toBe('d');
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
  });

  it('breaks ties alphabetically by id', () => {
    expect(
      topoSort([
        { id: 'z', block: 'x' },
        { id: 'a', block: 'x' },
        { id: 'm', block: 'x' },
      ])
    ).toEqual(['a', 'm', 'z']);
  });

  it('detects cycles', () => {
    expect(() =>
      topoSort([
        { id: 'a', block: 'x', dependsOn: ['b'] },
        { id: 'b', block: 'x', dependsOn: ['a'] },
      ])
    ).toThrow(/cycle/i);
  });
});

// ─── computeDirty ───
describe('computeDirty', () => {
  it('propagates dirtiness transitively to dependents', () => {
    const scenarios = [
      { id: 'a', block: 'x' },
      { id: 'b', block: 'x', dependsOn: ['a'] },
      { id: 'c', block: 'x', dependsOn: ['b'] },
      { id: 'd', block: 'x', dependsOn: ['a'] },
    ];
    const dirtyRoots = new Set(['a']);
    const dirty = computeDirty(scenarios, dirtyRoots);
    expect(dirty).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('does not mark unrelated siblings dirty', () => {
    const scenarios = [
      { id: 'a', block: 'x' },
      { id: 'b', block: 'x', dependsOn: ['a'] },
      { id: 'c', block: 'x' }, // unrelated
    ];
    expect(computeDirty(scenarios, new Set(['a']))).toEqual(new Set(['a', 'b']));
  });
});

// ─── Engine.apply ───
describe('Engine.apply', () => {
  function makeBlock(name: string, opts: Partial<Block> = {}): Block {
    const docCount = 1;
    return {
      name,
      documentation: {
        description: '',
        configExamples: [],
        dependencies: [],
        collectionsWritten: ['recipes'],
      },
      validate: vi.fn((c: unknown) => c) as any,
      apply: vi.fn(async () => ({
        state: { id: name },
        docCount,
        summary: `${name} applied`,
      })) as any,
      clean: vi.fn(async () => ({ docCount: 1 })) as any,
      status: vi.fn(async () => ({ present: true, docCount: 1, configHashMatches: true })) as any,
      ...opts,
    };
  }

  function mockDb() {
    const upserts: any[] = [];
    const states = new Map<string, any>();
    return {
      db: {
        collection: vi.fn((name: string) => {
          if (name === 'manualTestState') {
            return {
              findOne: vi.fn(async (filter: any) =>
                states.get(`${filter.manifestId}::${filter.scenarioId}`)
              ),
              updateOne: vi.fn(async (filter: any, update: any, opts: any) => {
                const k = `${filter.manifestId}::${filter.scenarioId}`;
                const existing = states.get(k) ?? {};
                const next = { ...existing, ...(update.$set ?? {}) };
                states.set(k, next);
                upserts.push({ filter, update, opts });
                return { upsertedId: null };
              }),
              deleteOne: vi.fn(async (filter: any) => {
                states.delete(`${filter.manifestId}::${filter.scenarioId}`);
              }),
              createIndex: vi.fn(),
            };
          }
          if (name === 'manualTestLocks') {
            return {
              insertOne: vi.fn(async () => ({ insertedId: 'id' })),
              deleteOne: vi.fn(),
              findOne: vi.fn().mockResolvedValue(null),
              createIndex: vi.fn(),
            };
          }
          return { insertOne: vi.fn(), deleteMany: vi.fn(async () => ({ deletedCount: 0 })) };
        }),
      } as unknown as Db,
      states,
      upserts,
    };
  }

  it('applies scenarios in topo order, writes state, returns results', async () => {
    const blocks = new Map([
      ['user-baseline', makeBlock('user-baseline')],
      ['recipes', makeBlock('recipes')],
    ]);
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [
        { id: 'r', block: 'recipes', config: { count: 1 }, dependsOn: ['u'] },
        { id: 'u', block: 'user-baseline' },
      ],
    };
    const m = mockDb();
    const engine = new Engine(m.db, blocks);
    const result = await engine.apply(manifest);
    expect(result.ok).toBe(true);
    const order = result.scenarios.map((s) => s.id);
    expect(order).toEqual(['u', 'r']);
    expect(result.scenarios.every((s) => s.status === 'applied')).toBe(true);
  });

  it('skips scenarios whose hash matches and docs are present', async () => {
    const block = makeBlock('user-baseline');
    block.status = vi
      .fn()
      .mockResolvedValue({ present: true, docCount: 1, configHashMatches: true }) as any;
    const blocks = new Map([['user-baseline', block]]);
    const m = mockDb();
    // Pre-populate state so engine thinks it's been applied with matching hash
    const { stableHash } = await import('../hash.js');
    m.states.set('feat/x::default::u', {
      manifestId: 'feat/x::default',
      scenarioId: 'u',
      blockName: 'user-baseline',
      configHash: stableHash(undefined),
      state: { id: 'user-baseline' },
      lastAppliedAt: new Date(),
      lastConfigJson: 'null',
    });
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [{ id: 'u', block: 'user-baseline' }],
    };
    const engine = new Engine(m.db, blocks);
    const result = await engine.apply(manifest);
    expect(result.scenarios[0].status).toBe('skipped');
    expect(block.apply).not.toHaveBeenCalled();
  });

  it('cleans + re-applies when config hash differs (transitive dirty)', async () => {
    const u = makeBlock('user-baseline');
    const r = makeBlock('recipes');
    r.status = vi
      .fn()
      .mockResolvedValue({ present: true, docCount: 1, configHashMatches: true }) as any;
    const blocks = new Map<string, Block>([
      ['user-baseline', u],
      ['recipes', r],
    ]);
    const m = mockDb();
    const { stableHash } = await import('../hash.js');
    // u's prior hash is different from current hash for undefined
    m.states.set('feat/x::default::u', {
      configHash: 'sha256:OLD',
      state: { id: 'user-baseline' },
      lastAppliedAt: new Date(),
      lastConfigJson: 'null',
      manifestId: 'feat/x::default',
      scenarioId: 'u',
      blockName: 'user-baseline',
    });
    // r's hash matches but r depends on u so r is transitively dirty
    m.states.set('feat/x::default::r', {
      configHash: stableHash({ count: 1 }),
      state: { id: 'recipes' },
      lastAppliedAt: new Date(),
      lastConfigJson: '{"count":1}',
      manifestId: 'feat/x::default',
      scenarioId: 'r',
      blockName: 'recipes',
    });
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [
        { id: 'u', block: 'user-baseline' },
        { id: 'r', block: 'recipes', config: { count: 1 }, dependsOn: ['u'] },
      ],
    };
    const engine = new Engine(m.db, blocks);
    const result = await engine.apply(manifest);
    expect(result.scenarios.find((s) => s.id === 'u')?.status).toBe('applied');
    expect(result.scenarios.find((s) => s.id === 'r')?.status).toBe('applied');
    expect(u.clean).toHaveBeenCalled();
    expect(r.clean).toHaveBeenCalled();
    // Clean order: dependents first (r before u)
    const uCleanOrder = (u.clean as any).mock.invocationCallOrder[0];
    const rCleanOrder = (r.clean as any).mock.invocationCallOrder[0];
    expect(rCleanOrder).toBeLessThan(uCleanOrder);
  });

  it('marks failed when apply throws; lock released; lastApplyError set', async () => {
    const u = makeBlock('user-baseline');
    u.apply = vi.fn().mockRejectedValue(new Error('boom')) as any;
    const blocks = new Map([['user-baseline', u]]);
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [{ id: 'u', block: 'user-baseline' }],
    };
    const m = mockDb();
    const engine = new Engine(m.db, blocks);
    const result = await engine.apply(manifest);
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.scenarios[0].status).toBe('failed');
    expect(result.scenarios[0].error).toMatch(/boom/);
    expect(m.states.get('feat/x::default::u')?.lastApplyError).toMatch(/boom/);
  });

  it('throws when ctx.resolve called for undeclared dep', async () => {
    const u = makeBlock('user-baseline');
    const r = makeBlock('recipes');
    r.apply = vi.fn(async (_c: unknown, ctx: BlockContext) => {
      ctx.resolve('undeclared');
      return { state: {}, docCount: 0, summary: '' };
    }) as any;
    const blocks = new Map<string, Block>([
      ['user-baseline', u],
      ['recipes', r],
    ]);
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [
        { id: 'u', block: 'user-baseline' },
        { id: 'r', block: 'recipes', dependsOn: ['u'] }, // r doesn't declare 'undeclared'
      ],
    };
    const m = mockDb();
    const engine = new Engine(m.db, blocks);
    const result = await engine.apply(manifest);
    expect(result.scenarios.find((s) => s.id === 'r')?.error).toMatch(/undeclared/);
  });
});

// ─── Engine.clean ───
describe('Engine.clean', () => {
  it('cleans in reverse-topo order; clears state', async () => {
    // Similar mock setup; verify clean called on dependents first, then deps
    // (kept brief to avoid duplicating test scaffolding)
    expect(true).toBe(true); // placeholder; replace with actual assertions during implementation
  });
});

// ─── Engine.status ───
describe('Engine.status', () => {
  it('reports drift, missing-docs, and failed states', async () => {
    expect(true).toBe(true); // placeholder
  });
});
```

(The `Engine.clean` and `Engine.status` tests are intentionally placeholders here — they should be fleshed out by the implementing agent once `Engine` has its concrete signatures. The placeholder test calls should be replaced with real assertions covering: clean called in reverse topo order, `manualTestState` entries deleted, status output schema.)

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run test/manual/__tests__/engine.test.ts`
Expected: FAIL — `../engine.js` not found.

- [ ] **Step 3: Implement `engine.ts`**

```ts
// test/manual/engine.ts
import type { Db, Collection } from 'mongodb';
import type {
  Block,
  BlockContext,
  CliResult,
  CliScenarioResult,
  Manifest,
  ManifestScenario,
  ManualTestStateDoc,
} from './types.js';
import { stableHash } from './hash.js';

const STATE_COLLECTION = 'manualTestState';

export function topoSort(scenarios: ManifestScenario[]): string[] {
  const ids = scenarios.map((s) => s.id).sort();
  const deps = new Map<string, Set<string>>();
  for (const s of scenarios) deps.set(s.id, new Set(s.dependsOn ?? []));

  const result: string[] = [];
  const ready: string[] = ids.filter((id) => deps.get(id)!.size === 0);
  ready.sort();

  while (ready.length > 0) {
    const next = ready.shift()!;
    result.push(next);
    for (const id of ids) {
      const d = deps.get(id)!;
      if (d.delete(next) && d.size === 0 && !result.includes(id) && !ready.includes(id)) {
        ready.push(id);
        ready.sort();
      }
    }
  }

  if (result.length !== ids.length) {
    const remaining = ids.filter((i) => !result.includes(i));
    throw new Error(`cycle detected among scenarios: ${remaining.join(', ')}`);
  }
  return result;
}

export function computeDirty(scenarios: ManifestScenario[], roots: Set<string>): Set<string> {
  const dependents = new Map<string, Set<string>>();
  for (const s of scenarios) dependents.set(s.id, new Set());
  for (const s of scenarios) for (const d of s.dependsOn ?? []) dependents.get(d)?.add(s.id);

  const dirty = new Set<string>(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const dep of dependents.get(id) ?? []) {
      if (!dirty.has(dep)) {
        dirty.add(dep);
        queue.push(dep);
      }
    }
  }
  return dirty;
}

export class Engine {
  constructor(
    private db: Db,
    private blocks: Map<string, Block>
  ) {}

  private async ensureStateIndex(): Promise<void> {
    const col = this.db.collection<ManualTestStateDoc>(STATE_COLLECTION);
    await col.createIndex(
      { manifestId: 1, scenarioId: 1 },
      { unique: true, name: 'manualTestState_manifest_scenario' }
    );
  }

  private async readState(
    manifestId: string,
    scenarioId: string
  ): Promise<ManualTestStateDoc | null> {
    return this.db
      .collection<ManualTestStateDoc>(STATE_COLLECTION)
      .findOne({ manifestId, scenarioId });
  }

  private async writeState(doc: ManualTestStateDoc): Promise<void> {
    await this.db
      .collection<ManualTestStateDoc>(STATE_COLLECTION)
      .updateOne(
        { manifestId: doc.manifestId, scenarioId: doc.scenarioId },
        { $set: doc },
        { upsert: true }
      );
  }

  private async deleteState(manifestId: string, scenarioId: string): Promise<void> {
    await this.db
      .collection<ManualTestStateDoc>(STATE_COLLECTION)
      .deleteOne({ manifestId, scenarioId });
  }

  async apply(manifest: Manifest, options: { force?: string[] } = {}): Promise<CliResult> {
    await this.ensureStateIndex();
    const manifestId = `${manifest.branch}::${manifest.slot}`;
    const command = 'apply';

    // 1. Resolve order
    let order: string[];
    try {
      order = topoSort(manifest.scenarios);
    } catch (e) {
      return failResult(command, manifestId, 1, (e as Error).message);
    }
    const scenById = new Map(manifest.scenarios.map((s) => [s.id, s]));

    // 2. Compute dirty roots
    const dirtyRoots = new Set<string>(options.force ?? []);
    for (const id of order) {
      const s = scenById.get(id)!;
      const block = this.blocks.get(s.block);
      if (!block) {
        return failResult(command, manifestId, 1, `unknown block: ${s.block} (scenario ${s.id})`);
      }
      const cfg = block.validate(s.config);
      const hash = stableHash(cfg);
      const prior = await this.readState(manifestId, id);
      const docsStatus = await block.status({
        db: this.db,
        manifestId,
        scenarioId: id,
        resolve: () => {
          throw new Error('resolve unavailable in status');
        },
      });
      const dirty =
        !prior || prior.configHash !== hash || !docsStatus.present || prior.lastApplyError != null;
      if (dirty) dirtyRoots.add(id);
    }

    // 3. Transitive dirty
    const dirty = computeDirty(manifest.scenarios, dirtyRoots);

    // 4. Clean dirty in reverse topo
    const cleanOrder = [...order].reverse().filter((id) => dirty.has(id));
    const scenarios: CliScenarioResult[] = [];
    for (const id of cleanOrder) {
      const s = scenById.get(id)!;
      const block = this.blocks.get(s.block)!;
      try {
        await block.clean({
          db: this.db,
          manifestId,
          scenarioId: id,
          resolve: () => {
            throw new Error('resolve unavailable in clean');
          },
        });
        await this.deleteState(manifestId, id);
      } catch (e) {
        // partial failure during clean; mark scenario failed, continue
        const msg = (e as Error).message;
        await this.writeState({
          manifestId,
          scenarioId: id,
          blockName: s.block,
          configHash: stableHash(block.validate(s.config)),
          state: null,
          lastAppliedAt: new Date(),
          lastConfigJson: JSON.stringify(s.config ?? null),
          lastApplyError: `clean failed: ${msg}`,
        });
      }
    }

    // 5. Apply in topo order. Track in-memory states for resolve().
    const memState = new Map<string, unknown>();
    let hadFailure = false;
    for (const id of order) {
      const s = scenById.get(id)!;
      const block = this.blocks.get(s.block)!;
      const cfg = block.validate(s.config);
      const hash = stableHash(cfg);
      const start = Date.now();

      if (!dirty.has(id)) {
        const prior = await this.readState(manifestId, id);
        memState.set(id, prior?.state);
        scenarios.push({
          id,
          block: s.block,
          status: 'skipped',
          docCount: 0,
          summary: '',
          configHash: hash,
          durationMs: Date.now() - start,
          error: null,
        });
        continue;
      }

      const declaredDeps = new Set(s.dependsOn ?? []);
      const ctx: BlockContext = {
        db: this.db,
        manifestId,
        scenarioId: id,
        resolve: <T>(depId: string): T => {
          if (!declaredDeps.has(depId)) {
            throw new Error(
              `scenario "${id}" called resolve("${depId}") but did not declare it in dependsOn`
            );
          }
          if (!memState.has(depId)) {
            throw new Error(
              `scenario "${id}" tried to resolve "${depId}" but it has no state (apply order bug)`
            );
          }
          return memState.get(depId) as T;
        },
      };

      try {
        const result = await block.apply(cfg, ctx);
        memState.set(id, result.state);
        await this.writeState({
          manifestId,
          scenarioId: id,
          blockName: s.block,
          configHash: hash,
          state: result.state,
          lastAppliedAt: new Date(),
          lastConfigJson: JSON.stringify(s.config ?? null),
          lastApplyError: null,
        });
        scenarios.push({
          id,
          block: s.block,
          status: 'applied',
          docCount: result.docCount,
          summary: result.summary,
          configHash: hash,
          durationMs: Date.now() - start,
          error: null,
        });
      } catch (e) {
        hadFailure = true;
        const msg = (e as Error).message;
        await this.writeState({
          manifestId,
          scenarioId: id,
          blockName: s.block,
          configHash: hash,
          state: null,
          lastAppliedAt: new Date(),
          lastConfigJson: JSON.stringify(s.config ?? null),
          lastApplyError: msg,
        });
        scenarios.push({
          id,
          block: s.block,
          status: 'failed',
          docCount: 0,
          summary: '',
          configHash: hash,
          durationMs: Date.now() - start,
          error: msg,
        });
        break; // abort run on first failure
      }
    }

    return {
      schemaVersion: 1,
      ok: !hadFailure,
      command,
      manifestId,
      exitCode: hadFailure ? 2 : 0,
      scenarios,
      lock: null,
      warnings: [],
    };
  }

  async clean(manifest: Manifest): Promise<CliResult> {
    await this.ensureStateIndex();
    const manifestId = `${manifest.branch}::${manifest.slot}`;
    let order: string[];
    try {
      order = topoSort(manifest.scenarios);
    } catch (e) {
      return failResult('clean', manifestId, 1, (e as Error).message);
    }

    const scenById = new Map(manifest.scenarios.map((s) => [s.id, s]));
    const cleanOrder = [...order].reverse();
    const scenarios: CliScenarioResult[] = [];
    let hadFailure = false;
    for (const id of cleanOrder) {
      const s = scenById.get(id)!;
      const block = this.blocks.get(s.block);
      if (!block) {
        scenarios.push({
          id,
          block: s.block,
          status: 'failed',
          docCount: 0,
          summary: '',
          configHash: '',
          durationMs: 0,
          error: `unknown block: ${s.block}`,
        });
        hadFailure = true;
        continue;
      }
      const start = Date.now();
      try {
        const r = await block.clean({
          db: this.db,
          manifestId,
          scenarioId: id,
          resolve: () => {
            throw new Error('resolve unavailable in clean');
          },
        });
        await this.deleteState(manifestId, id);
        scenarios.push({
          id,
          block: s.block,
          status: 'cleaned',
          docCount: r.docCount,
          summary: '',
          configHash: '',
          durationMs: Date.now() - start,
          error: null,
        });
      } catch (e) {
        hadFailure = true;
        scenarios.push({
          id,
          block: s.block,
          status: 'failed',
          docCount: 0,
          summary: '',
          configHash: '',
          durationMs: Date.now() - start,
          error: (e as Error).message,
        });
      }
    }
    return {
      schemaVersion: 1,
      ok: !hadFailure,
      command: 'clean',
      manifestId,
      exitCode: hadFailure ? 2 : 0,
      scenarios,
      lock: null,
      warnings: [],
    };
  }

  async status(manifest: Manifest): Promise<CliResult> {
    await this.ensureStateIndex();
    const manifestId = `${manifest.branch}::${manifest.slot}`;
    const order = topoSort(manifest.scenarios);
    const scenById = new Map(manifest.scenarios.map((s) => [s.id, s]));
    const scenarios: CliScenarioResult[] = [];
    for (const id of order) {
      const s = scenById.get(id)!;
      const block = this.blocks.get(s.block);
      if (!block) {
        scenarios.push({
          id,
          block: s.block,
          status: 'failed',
          docCount: 0,
          summary: `unknown block`,
          configHash: '',
          durationMs: 0,
          error: `unknown block: ${s.block}`,
        });
        continue;
      }
      const cfg = block.validate(s.config);
      const hash = stableHash(cfg);
      const prior = await this.readState(manifestId, id);
      const ds = await block.status({
        db: this.db,
        manifestId,
        scenarioId: id,
        resolve: () => {
          throw new Error('resolve unavailable in status');
        },
      });
      const status: CliScenarioResult['status'] = prior?.lastApplyError
        ? 'failed'
        : !ds.present
          ? 'pending'
          : prior?.configHash === hash
            ? 'applied'
            : 'pending';
      scenarios.push({
        id,
        block: s.block,
        status,
        docCount: ds.docCount,
        summary: '',
        configHash: hash,
        durationMs: 0,
        error: prior?.lastApplyError ?? null,
      });
    }
    return {
      schemaVersion: 1,
      ok: true,
      command: 'status',
      manifestId,
      exitCode: 0,
      scenarios,
      lock: null,
      warnings: [],
    };
  }
}

function failResult(
  command: string,
  manifestId: string,
  exitCode: number,
  error: string
): CliResult {
  return {
    schemaVersion: 1,
    ok: false,
    command,
    manifestId,
    exitCode,
    scenarios: [],
    lock: null,
    warnings: [error],
  };
}
```

- [ ] **Step 4: Run tests, verify pass; flesh out the two placeholder tests**

Run: `npx vitest run test/manual/__tests__/engine.test.ts`
Expected: the non-placeholder tests pass. Replace the two `expect(true).toBe(true)` placeholders with actual assertions against the implemented `Engine.clean` and `Engine.status` (using the same mockDb pattern; assert call order of `block.clean` for clean tests; assert correct `status` field for various prior states for the status test). Re-run until all pass.

- [ ] **Step 5: Commit**

```bash
git add test/manual/engine.ts test/manual/__tests__/engine.test.ts
git commit -m "feat(manual-testing): add engine (topo sort, transitive dirty, apply/clean/status)"
```

### Task 2.2: `diff-tools.ts` — collection export + normalization (TDD)

**Files:**

- Create: `test/manual/diff-tools.ts`
- Create: `test/manual/__tests__/diff-tools.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// test/manual/__tests__/diff-tools.test.ts
import { describe, it, expect } from 'vitest';
import { ObjectId } from 'mongodb';
import { normalizeDoc, normalizeCollection, diffCollections } from '../diff-tools.js';

describe('normalizeDoc', () => {
  it('replaces ObjectIds with stable placeholder', () => {
    const d = { _id: new ObjectId(), name: 'x', ref: new ObjectId() };
    const out = normalizeDoc(
      d,
      ['_id', '_seedManifestId', '_seedScenarioId'],
      ['createdAt', 'updatedAt']
    );
    expect(out._id).toBe('<OBJECTID>');
    expect(out.ref).toBe('<OBJECTID>');
    expect(out.name).toBe('x');
  });

  it('drops ignored fields entirely', () => {
    const d = {
      _id: 'x',
      _seedManifestId: 'a',
      _seedScenarioId: 'b',
      name: 'foo',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const out = normalizeDoc(d, ['_seedManifestId', '_seedScenarioId'], ['createdAt', 'updatedAt']);
    expect(out._seedManifestId).toBeUndefined();
    expect(out._seedScenarioId).toBeUndefined();
    expect(out.createdAt).toBeUndefined();
    expect(out.updatedAt).toBeUndefined();
    expect(out._id).toBe('x');
    expect(out.name).toBe('foo');
  });

  it('normalizes nested ObjectIds', () => {
    const d = { items: [{ id: new ObjectId() }, { id: new ObjectId() }] };
    const out = normalizeDoc(d, [], []);
    expect((out.items as any)[0].id).toBe('<OBJECTID>');
  });
});

describe('normalizeCollection', () => {
  it('sorts docs by a deterministic key for stable diff', () => {
    const docs = [
      { _id: 'b', name: 'banana' },
      { _id: 'a', name: 'apple' },
    ];
    const out = normalizeCollection(docs, { sortKey: 'name' });
    expect((out[0] as any).name).toBe('apple');
  });
});

describe('diffCollections', () => {
  it('returns empty array when collections match (modulo ignored fields)', () => {
    const a = [{ _id: new ObjectId(), name: 'x', _seedManifestId: 'a::default' }];
    const b = [{ _id: new ObjectId(), name: 'x' }];
    const diffs = diffCollections(a, b, {
      ignoreObjectId: true,
      ignoreFields: ['_seedManifestId', '_seedScenarioId'],
      sortKey: 'name',
    });
    expect(diffs).toEqual([]);
  });

  it('returns diffs when content actually differs', () => {
    const a = [{ name: 'x' }];
    const b = [{ name: 'y' }];
    expect(
      diffCollections(a, b, { ignoreObjectId: true, ignoreFields: [], sortKey: 'name' })
    ).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verify fails**

Run: `npx vitest run test/manual/__tests__/diff-tools.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// test/manual/diff-tools.ts
import { ObjectId } from 'mongodb';

function isObjectId(v: unknown): boolean {
  return (
    v instanceof ObjectId ||
    (typeof v === 'object' && v !== null && (v as any)._bsontype === 'ObjectID')
  );
}

export function normalizeDoc(
  doc: Record<string, unknown>,
  dropFields: string[],
  dropTimestampFields: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (dropFields.includes(k)) continue;
    if (dropTimestampFields.includes(k)) continue;
    result[k] = normalizeValue(v);
  }
  return result;
}

function normalizeValue(v: unknown): unknown {
  if (isObjectId(v)) return '<OBJECTID>';
  if (v instanceof Date) return '<DATE>';
  if (Array.isArray(v)) return v.map(normalizeValue);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = normalizeValue(x);
    return o;
  }
  return v;
}

export function normalizeCollection(
  docs: Array<Record<string, unknown>>,
  opts: { sortKey?: string; dropFields?: string[]; dropTimestampFields?: string[] } = {}
): Array<Record<string, unknown>> {
  const normalized = docs.map((d) =>
    normalizeDoc(d, opts.dropFields ?? [], opts.dropTimestampFields ?? [])
  );
  if (opts.sortKey) {
    normalized.sort((a, b) => {
      const va = String(a[opts.sortKey!] ?? '');
      const vb = String(b[opts.sortKey!] ?? '');
      return va.localeCompare(vb);
    });
  }
  return normalized;
}

export interface DiffOptions {
  ignoreObjectId?: boolean;
  ignoreFields: string[];
  ignoreTimestampFields?: string[];
  sortKey?: string;
}

export function diffCollections(
  a: Array<Record<string, unknown>>,
  b: Array<Record<string, unknown>>,
  opts: DiffOptions
): string[] {
  const na = normalizeCollection(a, {
    dropFields: opts.ignoreFields,
    dropTimestampFields: opts.ignoreTimestampFields ?? ['createdAt', 'updatedAt'],
    sortKey: opts.sortKey,
  });
  const nb = normalizeCollection(b, {
    dropFields: opts.ignoreFields,
    dropTimestampFields: opts.ignoreTimestampFields ?? ['createdAt', 'updatedAt'],
    sortKey: opts.sortKey,
  });

  const diffs: string[] = [];
  const max = Math.max(na.length, nb.length);
  for (let i = 0; i < max; i++) {
    const sa = JSON.stringify(na[i] ?? null);
    const sb = JSON.stringify(nb[i] ?? null);
    if (sa !== sb) diffs.push(`doc ${i}: ${sa} !== ${sb}`);
  }
  return diffs;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/manual/__tests__/diff-tools.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add test/manual/diff-tools.ts test/manual/__tests__/diff-tools.test.ts
git commit -m "feat(manual-testing): add collection normalization + diff utility"
```

### Task 2.3: `pr-comment.ts` — gh CLI wrapper (TDD with mocked exec)

**Files:**

- Create: `test/manual/pr-comment.ts`
- Create: `test/manual/__tests__/pr-comment.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// test/manual/__tests__/pr-comment.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildMarker, findPrAndComment, postOrEditPrComment } from '../pr-comment.js';

const exec = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: (cmd: string, args: string[], opts: any, cb: any) => exec(cmd, args, opts, cb),
}));

beforeEach(() => exec.mockReset());

describe('buildMarker', () => {
  it('builds open/close marker pair', () => {
    expect(buildMarker('feat/x', 'default')).toEqual({
      open: '<!-- manual-testing-plan: feat/x :: default -->',
      close: '<!-- /manual-testing-plan -->',
    });
  });

  it('throws on branch with -->', () => {
    expect(() => buildMarker('feat-->evil', 'default')).toThrow();
  });
});

// Additional tests for findPrAndComment + postOrEditPrComment — see implementation;
// stub gh output as JSON arrays, assert find logic + edit branch.
```

- [ ] **Step 2: Verify fails**

Run: `npx vitest run test/manual/__tests__/pr-comment.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement (concise)**

```ts
// test/manual/pr-comment.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateBranch, validateSlot } from './validate-args.js';

const execFileAsync = promisify(execFile);

export interface Marker {
  open: string;
  close: string;
}

export function buildMarker(branch: string, slot: string): Marker {
  validateBranch(branch);
  validateSlot(slot);
  return {
    open: `<!-- manual-testing-plan: ${branch} :: ${slot} -->`,
    close: `<!-- /manual-testing-plan -->`,
  };
}

export async function findPrForBranch(
  branch: string
): Promise<{ number: number; url: string } | null> {
  validateBranch(branch);
  try {
    const { stdout } = await execFileAsync('gh', [
      'pr',
      'list',
      '--head',
      branch,
      '--json',
      'number,url',
      '--limit',
      '1',
    ]);
    const arr = JSON.parse(stdout);
    return arr.length > 0 ? { number: arr[0].number, url: arr[0].url } : null;
  } catch {
    return null;
  }
}

export async function findExistingComment(
  prNumber: number,
  marker: Marker
): Promise<number | null> {
  const { stdout } = await execFileAsync('gh', [
    'api',
    `repos/{owner}/{repo}/issues/${prNumber}/comments`,
    '--paginate',
  ]);
  const comments: Array<{ id: number; body: string }> = JSON.parse(stdout);
  for (const c of comments) if (c.body.includes(marker.open)) return c.id;
  return null;
}

export async function findPrAndComment(
  branch: string,
  slot: string
): Promise<{ pr: { number: number; url: string }; commentId: number | null } | null> {
  const pr = await findPrForBranch(branch);
  if (!pr) return null;
  const marker = buildMarker(branch, slot);
  const commentId = await findExistingComment(pr.number, marker);
  return { pr, commentId };
}

export async function postOrEditPrComment(
  prNumber: number,
  body: string,
  existingCommentId: number | null
): Promise<{ commentId: number }> {
  if (existingCommentId == null) {
    const { stdout } = await execFileAsync('gh', [
      'api',
      `repos/{owner}/{repo}/issues/${prNumber}/comments`,
      '-f',
      `body=${body}`,
    ]);
    return { commentId: JSON.parse(stdout).id };
  }
  await execFileAsync('gh', [
    'api',
    '--method',
    'PATCH',
    `repos/{owner}/{repo}/issues/comments/${existingCommentId}`,
    '-f',
    `body=${body}`,
  ]);
  return { commentId: existingCommentId };
}

export function sanitizeBlockSummary(s: string): string {
  if (s.length > 120) throw new Error(`summary too long (${s.length} > 120): ${s.slice(0, 60)}…`);
  if (!/^[\x20-\x7E]+$/.test(s))
    throw new Error(`summary contains non-ASCII or control chars: ${JSON.stringify(s)}`);
  if (s.includes('`')) throw new Error(`summary contains backtick: ${s}`);
  return s;
}
```

- [ ] **Step 4: Flesh out tests + verify pass**

Add to the test file: tests for `findExistingComment` (uses mocked exec returning JSON with marker in one body), `postOrEditPrComment` (posts when null, PATCHes when ID given), and `sanitizeBlockSummary` (length cap, ASCII-only, no backticks).

Run: `npx vitest run test/manual/__tests__/pr-comment.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add test/manual/pr-comment.ts test/manual/__tests__/pr-comment.test.ts
git commit -m "feat(manual-testing): add PR comment helper (gh CLI wrapper, marker, sanitize)"
```

---

## Phase 3 — CLI

### Task 3.1: `cli.ts` — argument parsing, safety gates, subcommands (TDD)

**Files:**

- Create: `test/manual/cli.ts`
- Create: `test/manual/__tests__/cli.test.ts`

- [ ] **Step 1: Write failing tests covering arg parsing + safety gates**

```ts
// test/manual/__tests__/cli.test.ts
import { describe, it, expect, vi } from 'vitest';
import { parseArgs, resolveDbSafety, resolveTarget } from '../cli.js';

describe('parseArgs', () => {
  it('parses subcommand + positional', () => {
    const r = parseArgs(['apply', 'feat/x', 'default']);
    expect(r.command).toBe('apply');
    expect(r.positional).toEqual(['feat/x', 'default']);
  });

  it('parses --manifest and --branch flags', () => {
    const r = parseArgs(['apply', '--manifest', 'demo']);
    expect(r.flags.manifest).toBe('demo');
  });

  it('parses boolean flags', () => {
    const r = parseArgs(['apply', '--json', '--dry-run', '--yes']);
    expect(r.flags.json).toBe(true);
    expect(r.flags['dry-run']).toBe(true);
    expect(r.flags.yes).toBe(true);
  });

  it('--help', () => {
    expect(parseArgs(['--help']).flags.help).toBe(true);
    expect(parseArgs(['apply', '--help']).flags.help).toBe(true);
  });
});

describe('resolveDbSafety', () => {
  it('allows worktree DB on localhost', () => {
    expect(() => resolveDbSafety('mongodb://localhost:27017/weekly-eats-feat-x', {})).not.toThrow();
  });

  it('refuses main DB without --allow-main-db', () => {
    expect(() => resolveDbSafety('mongodb://localhost:27017/weekly-eats', {})).toThrow(/main DB/i);
  });

  it('allows main DB with --allow-main-db', () => {
    expect(() =>
      resolveDbSafety('mongodb://localhost:27017/weekly-eats', { 'allow-main-db': true })
    ).not.toThrow();
  });

  it('refuses non-localhost without --allow-remote', () => {
    expect(() =>
      resolveDbSafety('mongodb://prod.atlas.example.com:27017/weekly-eats-x', {})
    ).toThrow(/remote|localhost/i);
  });

  it('refuses DB name outside allowlist', () => {
    expect(() => resolveDbSafety('mongodb://localhost:27017/something-else', {})).toThrow(
      /DB name/i
    );
  });
});

describe('resolveTarget', () => {
  it('--manifest wins over branch', () => {
    expect(
      resolveTarget({ flags: { manifest: 'demo' }, positional: ['feat/x'] }, () => 'main')
    ).toEqual({
      kind: 'manifest',
      name: 'demo',
      slot: 'default',
    });
  });

  it('--branch + slot positional', () => {
    expect(
      resolveTarget({ flags: { branch: 'feat/x' }, positional: ['admin-flow'] }, () => 'main')
    ).toEqual({
      kind: 'branch',
      name: 'feat/x',
      slot: 'admin-flow',
    });
  });

  it('positional manifest match wins over branch fallback', () => {
    // resolveTarget will look up manifest existence via a passed-in predicate
    expect(
      resolveTarget(
        { flags: {}, positional: ['demo'] },
        () => 'main',
        (name) => name === 'demo'
      )
    ).toEqual({ kind: 'manifest', name: 'demo', slot: 'default' });
  });

  it('falls back to current git branch when no positional', () => {
    expect(resolveTarget({ flags: {}, positional: [] }, () => 'feat/current')).toEqual({
      kind: 'branch',
      name: 'feat/current',
      slot: 'default',
    });
  });
});
```

- [ ] **Step 2: Verify fails, then implement**

Run: `npx vitest run test/manual/__tests__/cli.test.ts`
Expected: FAIL.

Implement `test/manual/cli.ts`:

```ts
// test/manual/cli.ts
#!/usr/bin/env -S npx tsx
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { validateBranch, validateSlot } from './validate-args.js';
import { loadManifest, manifestPath, validateManifest } from './manifest-io.js';
import { Engine } from './engine.js';
import { acquireLock, releaseLock, forceUnlock, readLock } from './lock.js';
import type { CliResult, Block } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename));

export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean | undefined>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith('--') ? args.shift()! : 'help';
  const positional: string[] = [];
  const flags: Record<string, string | boolean | undefined> = {};
  while (args.length > 0) {
    const a = args.shift()!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[0];
      if (next != null && !next.startsWith('--')) {
        flags[key] = next;
        args.shift();
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { command, positional, flags };
}

export interface Target {
  kind: 'manifest' | 'branch';
  name: string;
  slot: string;
}

export function resolveTarget(
  parsed: { flags: Record<string, unknown>; positional: string[] },
  getCurrentBranch: () => string,
  manifestExists: (name: string) => boolean = () => false,
): Target {
  const slotFlag = parsed.flags.slot as string | undefined;
  if (parsed.flags.manifest) {
    return { kind: 'manifest', name: String(parsed.flags.manifest), slot: slotFlag ?? parsed.positional[0] ?? 'default' };
  }
  if (parsed.flags.branch) {
    return { kind: 'branch', name: String(parsed.flags.branch), slot: slotFlag ?? parsed.positional[0] ?? 'default' };
  }
  if (parsed.positional.length > 0) {
    const first = parsed.positional[0];
    if (manifestExists(first)) {
      return { kind: 'manifest', name: first, slot: parsed.positional[1] ?? 'default' };
    }
    return { kind: 'branch', name: first, slot: parsed.positional[1] ?? 'default' };
  }
  return { kind: 'branch', name: getCurrentBranch(), slot: 'default' };
}

const DB_ALLOWLIST = /^weekly-eats(-[a-z0-9-]+)?$/;

export function resolveDbSafety(uri: string, flags: Record<string, unknown>): { dbName: string } {
  const u = new URL(uri.replace(/^mongodb\+srv/, 'https').replace(/^mongodb/, 'http'));
  const host = u.hostname;
  const dbName = u.pathname.replace(/^\//, '') || 'weekly-eats';
  if (host !== 'localhost' && host !== '127.0.0.1' && !flags['allow-remote']) {
    throw new Error(`db safety: host "${host}" is not localhost; refusing without --allow-remote`);
  }
  if (!DB_ALLOWLIST.test(dbName)) {
    throw new Error(`db safety: DB name "${dbName}" not in allowlist (must match ^weekly-eats(-[a-z0-9-]+)?$)`);
  }
  if (dbName === 'weekly-eats' && !flags['allow-main-db']) {
    throw new Error(`db safety: refusing to operate on main DB "weekly-eats" without --allow-main-db`);
  }
  return { dbName };
}

function getCurrentGitBranch(): string {
  return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
}

function readMongoUri(): string {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  // Read from .env.local — same pattern as the old seed scripts
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    throw new Error('MONGODB_URI not set and no .env.local found');
  }
  const content = readFileSync(envPath, 'utf8');
  const match = content.match(/^MONGODB_URI=(.+)$/m);
  if (!match) throw new Error('MONGODB_URI not found in .env.local');
  return match[1].trim();
}

async function loadBlocks(): Promise<Map<string, Block>> {
  const { registry } = await import('./scenarios/registry.js');
  return registry;
}

function printUsage(): void {
  process.stderr.write(`Usage: tsx test/manual/cli.ts <command> [args] [flags]

Commands:
  apply [target] [slot]         Apply manifest (idempotent)
  clean [target] [slot]         Remove tagged docs for this manifest
  clean --all --yes             Remove every _seedManifestId doc
  status [target] [slot]        Report what's seeded
  unlock [target] [slot]        Force-release a stale lock
  list                          List all manifests on disk
  gen-catalog [--check]         Regenerate CATALOG.md
  help [command]                Print this help

Flags:
  --manifest <name>             Load manifests/<name>.json directly
  --branch <name>               Override git branch detection
  --slot <name>                 Set slot (positional [slot] is shorthand)
  --json                        Machine-readable output
  --dry-run                     Validate without DB writes
  --verbose                     Log every DB write
  --yes                         Confirm destructive ops (required for clean --all)
  --force <id>                  Force a scenario to re-apply
  --force-unlock                Bypass lock check
  --allow-main-db               Operate on main DB (DANGEROUS)
  --allow-remote                Allow non-localhost (DANGEROUS)
  --help                        Show this help
`);
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.command === 'help' || parsed.flags.help) {
    printUsage();
    return parsed.command === 'help' ? 0 : 0;
  }

  // ─── Subcommands ────────────────────────────────────────────────────
  if (parsed.command === 'list') {
    const { readdirSync } = await import('node:fs');
    const dir = join(ROOT, 'manifests');
    if (!existsSync(dir)) return 0;
    for (const f of readdirSync(dir).sort()) if (f.endsWith('.json')) console.log(f);
    return 0;
  }

  if (parsed.command === 'gen-catalog') {
    const { generateCatalog, writeCatalog, readCatalog } = await import('./catalog-gen.js');
    const blocks = await loadBlocks();
    const generated = generateCatalog(blocks);
    const catalogPath = join(ROOT, 'scenarios', 'CATALOG.md');
    if (parsed.flags.check) {
      const current = await readCatalog(catalogPath);
      if (current !== generated) {
        process.stderr.write('CATALOG.md is stale. Run `npm run test:manual:gen-catalog`.\n');
        return 1;
      }
      return 0;
    }
    await writeCatalog(catalogPath, generated);
    return 0;
  }

  const uri = readMongoUri();
  resolveDbSafety(uri, parsed.flags);
  const client = await MongoClient.connect(uri);
  try {
    const db = client.db();

    if (parsed.command === 'unlock') {
      const target = resolveTarget(parsed, getCurrentGitBranch);
      if (target.kind !== 'branch') throw new Error('unlock requires a branch target');
      validateBranch(target.name);
      validateSlot(target.slot);
      const manifestId = `${target.name}::${target.slot}`;
      const removed = await forceUnlock(db, manifestId);
      if (removed) {
        process.stdout.write(`unlocked: ${manifestId}\n  was held by PID ${removed.pid} on host ${removed.hostname}\n  acquired at ${removed.acquiredAt.toISOString()}\n  invocation: ${removed.cliInvocation}\n`);
      } else {
        process.stdout.write(`no lock found for ${manifestId}\n`);
      }
      return 0;
    }

    // apply/clean/status: need a manifest
    const target = resolveTarget(
      parsed, getCurrentGitBranch,
      (name) => existsSync(join(ROOT, 'manifests', `${name}.json`)),
    );
    const filePath = target.kind === 'manifest'
      ? join(ROOT, 'manifests', target.slot === 'default' ? `${target.name}.json` : `${target.name}.${target.slot}.json`)
      : manifestPath(ROOT, target.name, target.slot);
    if (!existsSync(filePath)) {
      throw new Error(`manifest not found: ${filePath}`);
    }
    const manifest = await loadManifest(filePath);
    const manifestId = `${manifest.branch}::${manifest.slot}`;
    const blocks = await loadBlocks();
    const engine = new Engine(db, blocks);

    if (parsed.flags['dry-run']) {
      const r = await engine.status(manifest);
      output(r, parsed);
      return 0;
    }

    if (parsed.command === 'apply') {
      if (!parsed.flags['force-unlock']) {
        const existing = await readLock(db, manifestId);
        if (existing) {
          throw new Error(`lock: ${manifestId} is held by PID ${existing.pid}`);
        }
      }
      const lock = await acquireLock(db, manifestId, `apply ${manifest.branch}`);
      const releasedAt = { value: null as Date | null };
      try {
        const force = parsed.flags.force ? [String(parsed.flags.force)] : [];
        const result = await engine.apply(manifest, { force });
        releasedAt.value = new Date();
        result.lock = { acquiredAt: lock.acquiredAt.toISOString(), releasedAt: releasedAt.value.toISOString() };
        output(result, parsed);
        return result.exitCode;
      } finally {
        await releaseLock(db, manifestId);
      }
    }

    if (parsed.command === 'clean') {
      if (parsed.flags.all) {
        if (!parsed.flags.yes) {
          throw new Error('clean --all requires --yes (destructive)');
        }
        // ─── Clean across all manifests ────────────────────────────
        const { KNOWN_COLLECTIONS } = await import('./types.js');
        let totalDeleted = 0;
        for (const col of KNOWN_COLLECTIONS) {
          const r = await db.collection(col).deleteMany({ _seedManifestId: { $exists: true } });
          totalDeleted += r.deletedCount ?? 0;
        }
        await db.collection('manualTestState').deleteMany({});
        process.stdout.write(`cleaned ${totalDeleted} docs across all manifests\n`);
        return 0;
      }
      const result = await engine.clean(manifest);
      output(result, parsed);
      return result.exitCode;
    }

    if (parsed.command === 'status') {
      const result = await engine.status(manifest);
      output(result, parsed);
      return result.exitCode;
    }

    throw new Error(`unknown command: ${parsed.command}`);
  } finally {
    await client.close();
  }
}

function output(result: CliResult, parsed: ParsedArgs): void {
  if (parsed.flags.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(`${result.command} ${result.manifestId}: ${result.ok ? 'OK' : 'FAILED'} (exit ${result.exitCode})\n`);
    for (const s of result.scenarios) {
      process.stdout.write(`  ${s.id} (${s.block}): ${s.status}${s.summary ? ` — ${s.summary}` : ''}${s.error ? ` [${s.error}]` : ''}\n`);
    }
    for (const w of result.warnings) process.stdout.write(`  warning: ${w}\n`);
  }
}

// Run when invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`manual-test error: ${(e as Error).message}\n`);
      process.exit(1);
    },
  );
}
```

- [ ] **Step 3: Run unit tests**

Run: `npx vitest run test/manual/__tests__/cli.test.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add test/manual/cli.ts test/manual/__tests__/cli.test.ts
git commit -m "feat(manual-testing): add CLI with safety gates, arg parsing, all subcommands"
```

---

## Phase 4 — First Block: `user-baseline` (TDD)

### Task 4.1: `user-baseline` block

**Files:**

- Create: `test/manual/scenarios/user-baseline.ts`
- Create: `test/manual/scenarios/__tests__/user-baseline.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// test/manual/scenarios/__tests__/user-baseline.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userBaseline from '../user-baseline.js';

function mockDb(users: Array<{ _id: string; email: string; name: string; isApproved: boolean }>) {
  return {
    collection: vi.fn((name: string) => {
      if (name === 'users') {
        return {
          findOne: vi.fn(async (filter: any) => {
            if (filter.email) return users.find((u) => u.email === filter.email) ?? null;
            return users[0] ?? null;
          }),
          find: vi.fn(() => ({
            toArray: vi.fn(async () => users),
          })),
          countDocuments: vi.fn(async () => users.length),
        };
      }
      return {};
    }),
  } as any;
}

const ctx = (db: any) => ({
  db,
  manifestId: 'feat/x::default',
  scenarioId: 'u',
  resolve: () => {
    throw new Error('no');
  },
});

describe('user-baseline.validate', () => {
  it('accepts empty config', () => {
    expect(userBaseline.validate({})).toEqual({});
  });
  it('accepts config with email', () => {
    expect(userBaseline.validate({ email: 'a@b.c' })).toEqual({ email: 'a@b.c' });
  });
  it('rejects malformed', () => {
    expect(() => userBaseline.validate({ email: 123 })).toThrow();
  });
});

describe('user-baseline.apply', () => {
  beforeEach(() => delete process.env.MANUAL_TEST_USER_EMAIL);

  it('errors when no users exist', async () => {
    const db = mockDb([]);
    await expect(userBaseline.apply({}, ctx(db))).rejects.toThrow(/no.*user.*found/i);
  });

  it('uses single user when only one exists', async () => {
    const db = mockDb([{ _id: 'u1', email: 'only@a.com', name: 'Only', isApproved: true }]);
    const r = await userBaseline.apply({}, ctx(db));
    expect(r.state).toEqual({ userId: 'u1', email: 'only@a.com', name: 'Only' });
    expect(r.docCount).toBe(0);
    expect(r.summary).toMatch(/only@a\.com/);
  });

  it('errors with full list when multiple users and no email', async () => {
    const db = mockDb([
      { _id: 'u1', email: 'a@a.com', name: 'A', isApproved: true },
      { _id: 'u2', email: 'b@b.com', name: 'B', isApproved: true },
    ]);
    await expect(userBaseline.apply({}, ctx(db))).rejects.toThrow(
      /multiple users.*a@a\.com.*b@b\.com/i
    );
  });

  it('uses config.email when provided', async () => {
    const db = mockDb([
      { _id: 'u1', email: 'a@a.com', name: 'A', isApproved: true },
      { _id: 'u2', email: 'b@b.com', name: 'B', isApproved: true },
    ]);
    const r = await userBaseline.apply({ email: 'b@b.com' }, ctx(db));
    expect(r.state).toEqual({ userId: 'u2', email: 'b@b.com', name: 'B' });
  });

  it('uses MANUAL_TEST_USER_EMAIL when no config.email', async () => {
    process.env.MANUAL_TEST_USER_EMAIL = 'b@b.com';
    const db = mockDb([
      { _id: 'u1', email: 'a@a.com', name: 'A', isApproved: true },
      { _id: 'u2', email: 'b@b.com', name: 'B', isApproved: true },
    ]);
    const r = await userBaseline.apply({}, ctx(db));
    expect(r.state).toEqual({ userId: 'u2', email: 'b@b.com', name: 'B' });
  });

  it('errors when chosen user is not approved', async () => {
    const db = mockDb([{ _id: 'u1', email: 'a@a.com', name: 'A', isApproved: false }]);
    await expect(userBaseline.apply({}, ctx(db))).rejects.toThrow(/isApproved/i);
  });
});

describe('user-baseline.clean / status', () => {
  it('clean is a no-op for docs (returns docCount: 0)', async () => {
    const db = mockDb([]);
    const r = await userBaseline.clean(ctx(db));
    expect(r.docCount).toBe(0);
  });
  it('status returns present=true when user exists', async () => {
    const db = mockDb([{ _id: 'u1', email: 'a@a.com', name: 'A', isApproved: true }]);
    const s = await userBaseline.status(ctx(db));
    expect(s.present).toBe(true);
  });
});
```

- [ ] **Step 2: Verify fails, then implement**

Run: `npx vitest run test/manual/scenarios/__tests__/user-baseline.test.ts`
Expected: FAIL (module not found).

Implement:

```ts
// test/manual/scenarios/user-baseline.ts
import { z } from 'zod';
import type { Block, BlockDocumentation } from '../types.js';

const ConfigSchema = z.object({ email: z.string().email().optional() });
type Config = z.infer<typeof ConfigSchema>;
type State = { userId: string; email: string; name: string };

const documentation: BlockDocumentation = {
  description:
    'Verifies a signed-in user exists in the worktree DB. Returns the userId for downstream blocks. Use precedence: config.email > MANUAL_TEST_USER_EMAIL env > single user.',
  configExamples: [
    { label: 'auto (single user in DB)', config: {} },
    { label: 'explicit email', config: { email: 'me@example.com' } },
  ],
  dependencies: [],
  collectionsWritten: [],
};

const block: Block<Config, State> = {
  name: 'user-baseline',
  documentation,
  validate(c) {
    return ConfigSchema.parse(c ?? {});
  },

  async apply(config, ctx) {
    const users = ctx.db.collection('users');
    const all = await users.find({}).toArray();
    if (all.length === 0) {
      throw new Error(
        'no signed-in user found in worktree DB.\n  Run `npm run dev`, open http://localhost:<PORT>, sign in with Google, then re-run.'
      );
    }
    const email = config.email ?? process.env.MANUAL_TEST_USER_EMAIL;
    let chosen: any;
    if (email) {
      chosen = all.find((u: any) => u.email === email);
      if (!chosen) {
        throw new Error(
          `user not found with email "${email}". DB has: ${all.map((u: any) => u.email).join(', ')}`
        );
      }
    } else if (all.length === 1) {
      chosen = all[0];
    } else {
      throw new Error(
        `multiple users in DB; ambiguous.\n  found ${all.length}: ${all.map((u: any) => u.email).join(', ')}\n  hint: set MANUAL_TEST_USER_EMAIL=<email> or add config.email to the user-baseline scenario`
      );
    }
    if (chosen.isApproved !== true) {
      throw new Error(
        `user ${chosen.email} is not approved (isApproved !== true). Approve via admin UI first.`
      );
    }
    return {
      state: { userId: String(chosen._id), email: chosen.email, name: chosen.name ?? '(no name)' },
      docCount: 0,
      summary: `Signed-in user: ${chosen.email}`,
    };
  },

  async clean() {
    return { docCount: 0 };
  },

  async status(ctx) {
    const count = await ctx.db.collection('users').countDocuments({});
    return { present: count > 0, docCount: 0, configHashMatches: true };
  },
};

export default block;
```

- [ ] **Step 3: Run tests, verify pass**

Run: `npx vitest run test/manual/scenarios/__tests__/user-baseline.test.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add test/manual/scenarios/user-baseline.ts test/manual/scenarios/__tests__/user-baseline.test.ts
git commit -m "feat(manual-testing): add user-baseline block (auth gate)"
```

---

## Phase 5 — Remaining Catalog Blocks

Each block follows the same TDD pattern as `user-baseline`. Define the Zod schema from the spec's catalog table, implement apply/clean/status with tagged docs, write tests that assert: (a) correct collection name, (b) both `_seedManifestId` AND `_seedScenarioId` tags on inserts, (c) correct deleteMany filter on clean. The remaining tasks below give file paths and the per-block specifics; the test scaffolding and commit step are identical to Task 4.1.

### Task 5.1: `food-items` block

**Files:**

- Create: `test/manual/scenarios/food-items.ts`
- Create: `test/manual/scenarios/__tests__/food-items.test.ts`

- [ ] **Step 1: Implement following the user-baseline TDD pattern**

Block specifics (from spec catalog):

- Config Zod: `{ ensure?: string[], globalCount?: number, userCount?: number, isApproved?: boolean (default true) }`
- State: `{ foodItemIds: Record<string, ObjectId> }` (keyed by `name`)
- Deps: `user-baseline`
- `apply`: For each name in `ensure`, upsert (find by name; if missing, insert) with `{ isGlobal: true, isApproved: <config.isApproved ?? true>, createdBy: <user-baseline.userId>, singularName, pluralName, unit: 'each', _seedManifestId, _seedScenarioId }`. For `globalCount` and `userCount`, generate N items with predictable names (`Manual Test Food 1`, etc.). Look at `scripts/seed-food-items.cjs` for the canonical shape.
- `clean`: `deleteMany({ _seedManifestId, _seedScenarioId })` on `foodItems` only.
- `status`: count tagged docs in `foodItems`.
- `summary`: `"<N> food items"` (ASCII-safe ≤120 chars per `sanitizeBlockSummary`).
- `collectionsWritten`: `['foodItems']`

Test assertions (per spec's mandatory checks):

- `db.collection` called with exactly `'foodItems'`
- Inserted docs have BOTH `_seedManifestId` AND `_seedScenarioId`
- `clean` calls `deleteMany` with filter containing both tag fields

- [ ] **Step 2: Commit**

```bash
git add test/manual/scenarios/food-items.ts test/manual/scenarios/__tests__/food-items.test.ts
git commit -m "feat(manual-testing): add food-items block"
```

### Task 5.2: `recipes` block

**Files:**

- Create: `test/manual/scenarios/recipes.ts`
- Create: `test/manual/scenarios/__tests__/recipes.test.ts`

- [ ] **Step 1: Implement**

Block specifics:

- Config Zod: `{ count: number ≥ 1, isGlobal: boolean, withUserData?: boolean, foodItemsRef?: string }`
- State: `{ recipeIds: ObjectId[] }`
- Deps: `user-baseline`, optionally `food-items` (when `foodItemsRef` set)
- `apply`: Generate N recipes. If `foodItemsRef`, pull `foodItemIds` from `ctx.resolve(foodItemsRef)` and use as ingredient `id`s. Recipe shape per `src/types/recipe.ts` (open the file to verify exact shape). Tag with both `_seed*` fields. `createdBy` = user-baseline.userId. `isGlobal` from config. If `withUserData`, also insert into `recipeUserData` (one doc per recipe, both tags).
- `clean`: `deleteMany` on `recipes` AND `recipeUserData`.
- `collectionsWritten`: `['recipes', 'recipeUserData']`
- `summary`: e.g. `"5 recipes (user-scoped)"`.

Read `src/types/recipe.ts` and `scripts/seed-demo-data.cjs` (lines for recipes section) to copy the canonical shape.

- [ ] **Step 2: Commit**

```bash
git add test/manual/scenarios/recipes.ts test/manual/scenarios/__tests__/recipes.test.ts
git commit -m "feat(manual-testing): add recipes block"
```

### Task 5.3: `meal-plan-template` block (NEW — was missing from v1)

**Files:**

- Create: `test/manual/scenarios/meal-plan-template.ts`
- Create: `test/manual/scenarios/__tests__/meal-plan-template.test.ts`

- [ ] **Step 1: Implement**

Block specifics:

- Config Zod: `{ startDay: enum DayOfWeek; meals: { breakfast,lunch,dinner,staples: boolean }; weeklyStaples?: MealItem[] }`
- State: `{ templateId: ObjectId }`
- Deps: `user-baseline`
- `apply`: Insert into `mealPlanTemplates` with `userId` from `ctx.resolve`. UNIQUE INDEX on `userId` means there's already at most one template per user — handle by: check if a tagged template exists for `(userId, _seedManifestId, _seedScenarioId)`; if yes, return its id; if no, check if `userId` has any template (untagged manual one) — if yes, throw a clear error "user already has a template; manual testing template would conflict" with a hint to delete the manual one or use a different user. This is critical because of the unique constraint.
- `clean`: `deleteMany` on `mealPlanTemplates` with tag filter.
- `collectionsWritten`: `['mealPlanTemplates']`
- `summary`: `"meal plan template (<startDay>, <enabled-meals>)"`.

- [ ] **Step 2: Commit**

```bash
git add test/manual/scenarios/meal-plan-template.ts test/manual/scenarios/__tests__/meal-plan-template.test.ts
git commit -m "feat(manual-testing): add meal-plan-template block"
```

### Task 5.4: `meal-plan` block

**Files:**

- Create: `test/manual/scenarios/meal-plan.ts`
- Create: `test/manual/scenarios/__tests__/meal-plan.test.ts`

- [ ] **Step 1: Implement**

Block specifics:

- Config Zod: `{ weeksOut: number ≥ 0; slotsFilled: number ≥ 0; recipesRef?: string; templateRef: string }`
- State: `{ mealPlanId: ObjectId; slotCount: number }`
- Deps: `user-baseline`, `meal-plan-template`, optionally `recipes`
- `apply`: Compute `startDate`/`endDate` from `weeksOut` and the template's `startDay`. Build `items` array with `slotsFilled` slots populated by recipes from `ctx.resolve(recipesRef).recipeIds` (cycle through). Insert into `mealPlans` with `templateId` from `ctx.resolve(templateRef).templateId`, `templateSnapshot` derived from the template doc (read it back from DB to get `startDay`+`meals`), both `_seed*` tags. Use `src/types/meal-plan.ts` for exact shape.
- `clean`: `deleteMany` on `mealPlans` with tag filter.
- `collectionsWritten`: `['mealPlans']`
- `summary`: `"meal plan, <N> slots filled"`.

- [ ] **Step 2: Commit**

```bash
git add test/manual/scenarios/meal-plan.ts test/manual/scenarios/__tests__/meal-plan.test.ts
git commit -m "feat(manual-testing): add meal-plan block (depends on meal-plan-template)"
```

### Task 5.5: `pantry` block

**Files:**

- Create: `test/manual/scenarios/pantry.ts`
- Create: `test/manual/scenarios/__tests__/pantry.test.ts`

- [ ] **Step 1: Implement**

Block specifics:

- Config Zod: `{ count: number ≥ 1; foodItemsRef?: string }`
- State: `{ pantryItemIds: ObjectId[] }`
- Deps: `user-baseline`, optionally `food-items` (recommended)
- `apply`: Pick `count` foodItem IDs (from `ctx.resolve(foodItemsRef).foodItemIds` or first N from `foodItems` collection). For each, insert into `pantry` with `{ foodItemId, userId, createdAt, updatedAt, _seedManifestId, _seedScenarioId }`. The unique index `(userId, foodItemId)` means duplicate inserts will fail — handle by checking existence and skipping (idempotent on `clean+re-apply` because clean removes ours first).
- `clean`: `deleteMany` on `pantry`.
- `collectionsWritten`: `['pantry']`
- `summary`: `"<N> pantry items"`.

- [ ] **Step 2: Commit**

```bash
git add test/manual/scenarios/pantry.ts test/manual/scenarios/__tests__/pantry.test.ts
git commit -m "feat(manual-testing): add pantry block"
```

### Task 5.6: `stores` block

**Files:**

- Create: `test/manual/scenarios/stores.ts`
- Create: `test/manual/scenarios/__tests__/stores.test.ts`

- [ ] **Step 1: Implement**

Block specifics:

- Config Zod: `{ count: number ≥ 1; withPositions?: boolean; foodItemsRef?: string }`
- State: `{ storeIds: ObjectId[]; positionsPerStore: number }`
- Deps: `user-baseline`, optionally `food-items` (required when `withPositions: true`)
- `apply`: Insert N stores with `{ userId, name: "Manual Test Store <N>", emoji: '🛒', createdAt, updatedAt, _seed*}`. If `withPositions`, insert into `storeItemPositions` one doc per (store, foodItem) pair with deterministic `position` values; both `_seed*` tags.
- `clean`: deleteMany on `stores` AND `storeItemPositions`.
- `collectionsWritten`: `['stores', 'storeItemPositions']`
- `summary`: `"<N> stores (with positions: <bool>)"`.

- [ ] **Step 2: Commit**

```bash
git add test/manual/scenarios/stores.ts test/manual/scenarios/__tests__/stores.test.ts
git commit -m "feat(manual-testing): add stores block"
```

### Task 5.7: `shopping-list` block

**Files:**

- Create: `test/manual/scenarios/shopping-list.ts`
- Create: `test/manual/scenarios/__tests__/shopping-list.test.ts`

- [ ] **Step 1: Implement**

Block specifics:

- Config Zod: `{ state: 'empty' | 'partial' | 'all-checked'; itemCount: number ≥ 0; storeRef: string; foodItemsRef?: string }`
- State: `{ shoppingListId: ObjectId; itemCount: number }`
- Deps: `user-baseline`, `stores`, `food-items`
- `apply`: Build `items` array of `itemCount` ShoppingListItems. `state` controls `checked`: `empty` → no items, `partial` → first half checked, `all-checked` → all checked. Insert into `shoppingLists` with `{ storeId: stores.storeIds[0], userId, items, _seed*}`. Unique index on `storeId` — handle by checking existing (similar to pantry).
- `clean`: deleteMany on `shoppingLists`.
- `collectionsWritten`: `['shoppingLists']`
- `summary`: `"shopping list (<state>, <N> items)"`.

- [ ] **Step 2: Commit**

```bash
git add test/manual/scenarios/shopping-list.ts test/manual/scenarios/__tests__/shopping-list.test.ts
git commit -m "feat(manual-testing): add shopping-list block"
```

### Task 5.8: `purchase-history` block

**Files:**

- Create: `test/manual/scenarios/purchase-history.ts`
- Create: `test/manual/scenarios/__tests__/purchase-history.test.ts`

- [ ] **Step 1: Implement**

Block specifics:

- Config Zod: `{ count: number ≥ 1; daysBack?: number (default 30); foodItemsRef?: string; storeRef?: string }`
- State: `{ purchaseIds: ObjectId[] }`
- Deps: `user-baseline`, `food-items`, `stores`
- `apply`: Insert N purchase docs into `purchaseHistory` with `{ storeId, foodItemId, name, quantity: 1, unit: 'each', lastPurchasedAt: <date in past>, _seed*}`. Unique on `(storeId, foodItemId)` — handle by selecting unique pairs.
- `clean`: deleteMany on `purchaseHistory`.
- `collectionsWritten`: `['purchaseHistory']`
- `summary`: `"<N> purchases over last <D> days"`.

- [ ] **Step 2: Commit**

```bash
git add test/manual/scenarios/purchase-history.ts test/manual/scenarios/__tests__/purchase-history.test.ts
git commit -m "feat(manual-testing): add purchase-history block"
```

### Task 5.9: `pending-approval-user` block

**Files:**

- Create: `test/manual/scenarios/pending-approval-user.ts`
- Create: `test/manual/scenarios/__tests__/pending-approval-user.test.ts`

- [ ] **Step 1: Implement**

Block specifics:

- Config Zod: `{ name?: string (default 'Manual Test Pending User') }`
- State: `{ pendingUserId: ObjectId; email: string }`
- Deps: (none — independent)
- `apply`: Generate `email = 'manual-test+' + randomHex(8) + '@manual-test.invalid'`. Insert into `users` with `{ email, name, isApproved: false, _seed*}`. The email's `@manual-test.invalid` suffix is FORCED (RFC 2606 reserved) — no config can override.
- `clean`: deleteMany on `users` with both tag fields.
- `collectionsWritten`: `['users']`
- `summary`: `"pending user <email>"`.

Critical test: assert the generated email ENDS WITH `@manual-test.invalid` regardless of config.

- [ ] **Step 2: Commit**

```bash
git add test/manual/scenarios/pending-approval-user.ts test/manual/scenarios/__tests__/pending-approval-user.test.ts
git commit -m "feat(manual-testing): add pending-approval-user block (forced @manual-test.invalid)"
```

---

## Phase 6 — Registry + CATALOG generation

### Task 6.1: `registry.ts` + tests

**Files:**

- Create: `test/manual/scenarios/registry.ts`
- Create: `test/manual/__tests__/registry.test.ts`

- [ ] **Step 1: Write `registry.ts`**

```ts
// test/manual/scenarios/registry.ts
import type { Block } from '../types.js';
import userBaseline from './user-baseline.js';
import foodItems from './food-items.js';
import recipes from './recipes.js';
import mealPlanTemplate from './meal-plan-template.js';
import mealPlan from './meal-plan.js';
import pantry from './pantry.js';
import stores from './stores.js';
import shoppingList from './shopping-list.js';
import purchaseHistory from './purchase-history.js';
import pendingApprovalUser from './pending-approval-user.js';

export const registry = new Map<string, Block>([
  [userBaseline.name, userBaseline],
  [foodItems.name, foodItems],
  [recipes.name, recipes],
  [mealPlanTemplate.name, mealPlanTemplate],
  [mealPlan.name, mealPlan],
  [pantry.name, pantry],
  [stores.name, stores],
  [shoppingList.name, shoppingList],
  [purchaseHistory.name, purchaseHistory],
  [pendingApprovalUser.name, pendingApprovalUser],
]);
```

- [ ] **Step 2: Write registry tests**

```ts
// test/manual/__tests__/registry.test.ts
import { describe, it, expect } from 'vitest';
import { registry } from '../scenarios/registry.js';
import { KNOWN_COLLECTIONS } from '../types.js';

describe('registry', () => {
  it('contains 10 blocks', () => {
    expect(registry.size).toBe(10);
  });

  it('every block has a unique name matching its registry key', () => {
    for (const [key, block] of registry.entries()) {
      expect(block.name).toBe(key);
    }
  });

  it('every block has valid documentation', () => {
    for (const [, b] of registry.entries()) {
      expect(b.documentation.description).toBeTruthy();
      expect(Array.isArray(b.documentation.configExamples)).toBe(true);
      expect(Array.isArray(b.documentation.collectionsWritten)).toBe(true);
    }
  });

  it('every collectionsWritten entry is a known collection', () => {
    for (const [, b] of registry.entries()) {
      for (const c of b.documentation.collectionsWritten) {
        expect(KNOWN_COLLECTIONS).toContain(c);
      }
    }
  });

  it('every block exports apply/clean/status/validate functions', () => {
    for (const [, b] of registry.entries()) {
      expect(typeof b.apply).toBe('function');
      expect(typeof b.clean).toBe('function');
      expect(typeof b.status).toBe('function');
      expect(typeof b.validate).toBe('function');
    }
  });
});
```

- [ ] **Step 3: Run tests, verify pass**

Run: `npx vitest run test/manual/__tests__/registry.test.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add test/manual/scenarios/registry.ts test/manual/__tests__/registry.test.ts
git commit -m "feat(manual-testing): add scenario registry + integrity tests"
```

### Task 6.2: `catalog-gen.ts` + auto-generated CATALOG.md (TDD)

**Files:**

- Create: `test/manual/catalog-gen.ts`
- Create: `test/manual/__tests__/catalog-gen.test.ts`
- Create: `test/manual/scenarios/CATALOG.md` (via `npm run test:manual:gen-catalog`)

- [ ] **Step 1: Write failing tests**

```ts
// test/manual/__tests__/catalog-gen.test.ts
import { describe, it, expect } from 'vitest';
import { generateCatalog } from '../catalog-gen.js';
import { registry } from '../scenarios/registry.js';

describe('generateCatalog', () => {
  it('renders deterministic markdown', () => {
    const a = generateCatalog(registry);
    const b = generateCatalog(registry);
    expect(a).toBe(b);
  });

  it('includes every block name', () => {
    const md = generateCatalog(registry);
    for (const name of registry.keys()) expect(md).toContain(`### \`${name}\``);
  });

  it('includes each block description', () => {
    const md = generateCatalog(registry);
    for (const block of registry.values()) expect(md).toContain(block.documentation.description);
  });

  it('includes config examples', () => {
    const md = generateCatalog(registry);
    for (const block of registry.values()) {
      for (const ex of block.documentation.configExamples) {
        expect(md).toContain(ex.label);
      }
    }
  });

  it('includes collectionsWritten', () => {
    const md = generateCatalog(registry);
    for (const block of registry.values()) {
      for (const c of block.documentation.collectionsWritten) {
        expect(md).toContain(c);
      }
    }
  });
});
```

- [ ] **Step 2: Implement**

````ts
// test/manual/catalog-gen.ts
import { readFile, writeFile } from 'node:fs/promises';
import type { Block } from './types.js';

export function generateCatalog(registry: Map<string, Block>): string {
  const blocks = [...registry.values()].sort((a, b) => a.name.localeCompare(b.name));
  const lines: string[] = [];
  lines.push('# Manual Testing — Scenario Catalog');
  lines.push('');
  lines.push('> AUTO-GENERATED by `npm run test:manual:gen-catalog`. Do not edit by hand.');
  lines.push('> Source: `test/manual/scenarios/<block>.ts` `documentation` fields.');
  lines.push('');
  lines.push('| Block | Dependencies | Collections written |');
  lines.push('|---|---|---|');
  for (const b of blocks) {
    const deps = b.documentation.dependencies.length
      ? b.documentation.dependencies.join(', ')
      : '—';
    const cols = b.documentation.collectionsWritten.length
      ? b.documentation.collectionsWritten.join(', ')
      : '—';
    lines.push(`| \`${b.name}\` | ${deps} | ${cols} |`);
  }
  lines.push('');
  for (const b of blocks) {
    lines.push(`### \`${b.name}\``);
    lines.push('');
    lines.push(b.documentation.description);
    lines.push('');
    if (b.documentation.configExamples.length) {
      lines.push('**Config examples:**');
      lines.push('');
      for (const ex of b.documentation.configExamples) {
        lines.push(`- **${ex.label}**`);
        lines.push('  ```json');
        lines.push('  ' + JSON.stringify(ex.config, null, 2).split('\n').join('\n  '));
        lines.push('  ```');
      }
      lines.push('');
    }
    lines.push(`**Dependencies:** ${b.documentation.dependencies.join(', ') || '—'}`);
    lines.push('');
    lines.push(`**Collections written:** ${b.documentation.collectionsWritten.join(', ') || '—'}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

export async function readCatalog(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

export async function writeCatalog(path: string, content: string): Promise<void> {
  await writeFile(path, content, 'utf8');
}
````

- [ ] **Step 3: Run tests, verify pass**

Run: `npx vitest run test/manual/__tests__/catalog-gen.test.ts`
Expected: all pass.

- [ ] **Step 4: Generate the CATALOG.md**

Run: `npm run test:manual:gen-catalog`
Expected: creates `test/manual/scenarios/CATALOG.md`. Inspect to confirm it lists all 10 blocks.

- [ ] **Step 5: Commit**

```bash
git add test/manual/catalog-gen.ts test/manual/__tests__/catalog-gen.test.ts test/manual/scenarios/CATALOG.md
git commit -m "feat(manual-testing): add catalog auto-generation; commit initial CATALOG.md"
```

### Task 6.3: CATALOG drift test + `npm run check` integration

**Files:**

- Modify: `test/manual/__tests__/catalog-gen.test.ts`
- Modify: `package.json` (add `gen-catalog --check` to `check` script)

- [ ] **Step 1: Add drift test to `catalog-gen.test.ts`**

Add after the existing tests:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

it('matches the committed CATALOG.md (drift detection)', () => {
  const committed = readFileSync(resolve(__dirname, '../scenarios/CATALOG.md'), 'utf8');
  const generated = generateCatalog(registry);
  expect(committed.trim()).toBe(generated.trim());
});
```

- [ ] **Step 2: Update `check` npm script to validate CATALOG**

Edit `package.json` `check` script — add `&& npm run test:manual:gen-catalog -- --check` BEFORE the test step:

```jsonc
"check": "npm run lint -- --max-warnings=0 && npm run test:manual:gen-catalog -- --check && cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npm run test:coverage && cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npm run build",
```

- [ ] **Step 3: Run drift test**

Run: `npx vitest run test/manual/__tests__/catalog-gen.test.ts`
Expected: all pass including drift test.

Run: `npm run test:manual:gen-catalog -- --check`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add test/manual/__tests__/catalog-gen.test.ts package.json
git commit -m "build: enforce CATALOG.md freshness in npm run check"
```

---

## Phase 7 — Migration: replace seed scripts with `demo.json` manifest

### Task 7.1: Write `demo.json` manifest

**Files:**

- Create: `test/manual/manifests/demo.json`

- [ ] **Step 1: Compose manifest reproducing the legacy seed end-state**

Inspect `scripts/seed-food-items.cjs` and `scripts/seed-demo-data.cjs` to see what they create:

- ~35 global food items
- ~6 user-scoped recipes
- 1 meal plan template + 1 active meal plan with slots filled
- ~6-8 pantry items
- 2 stores with item positions
- 1 draft shopping list

Write `test/manual/manifests/demo.json`:

```json
{
  "schemaVersion": 1,
  "branch": "demo",
  "slot": "default",
  "createdAt": "2026-05-26T00:00:00.000Z",
  "updatedAt": "2026-05-26T00:00:00.000Z",
  "scenarios": [
    { "id": "u", "block": "user-baseline" },
    { "id": "fi", "block": "food-items", "config": { "globalCount": 35 }, "dependsOn": ["u"] },
    {
      "id": "r",
      "block": "recipes",
      "config": { "count": 6, "isGlobal": false, "foodItemsRef": "fi" },
      "dependsOn": ["u", "fi"]
    },
    {
      "id": "t",
      "block": "meal-plan-template",
      "config": {
        "startDay": "monday",
        "meals": { "breakfast": true, "lunch": true, "dinner": true, "staples": true }
      },
      "dependsOn": ["u"]
    },
    {
      "id": "mp",
      "block": "meal-plan",
      "config": { "weeksOut": 0, "slotsFilled": 14, "recipesRef": "r", "templateRef": "t" },
      "dependsOn": ["u", "r", "t"]
    },
    {
      "id": "p",
      "block": "pantry",
      "config": { "count": 8, "foodItemsRef": "fi" },
      "dependsOn": ["u", "fi"]
    },
    {
      "id": "s",
      "block": "stores",
      "config": { "count": 2, "withPositions": true, "foodItemsRef": "fi" },
      "dependsOn": ["u", "fi"]
    },
    {
      "id": "sl",
      "block": "shopping-list",
      "config": { "state": "partial", "itemCount": 5, "storeRef": "s", "foodItemsRef": "fi" },
      "dependsOn": ["u", "s", "fi"]
    }
  ],
  "stepMappings": []
}
```

- [ ] **Step 2: Commit**

```bash
git add test/manual/manifests/demo.json
git commit -m "feat(manual-testing): add demo.json manifest replacing seed-demo-data.cjs"
```

### Task 7.2: Update `setup-worktree.js` to strip `_seed*` fields on clone

**Files:**

- Modify: `scripts/setup-worktree.js`

- [ ] **Step 1: Add post-clone cleanup step**

Read `scripts/setup-worktree.js` first. After the DB-clone step (look for the section that performs `mongodump`/`mongorestore` or driver-based copy), add:

```js
// After DB clone — strip seed tags + drop manual-testing state/lock collections
// so the worktree DB starts clean from a manual-testing perspective.
const seededCollections = [
  'mealPlans',
  'mealPlanTemplates',
  'foodItems',
  'recipes',
  'recipeUserData',
  'pantry',
  'stores',
  'storeItemPositions',
  'shoppingLists',
  'purchaseHistory',
  'users',
];
for (const col of seededCollections) {
  await db
    .collection(col)
    .updateMany(
      { _seedManifestId: { $exists: true } },
      { $unset: { _seedManifestId: '', _seedScenarioId: '' } }
    );
}
await db
  .collection('manualTestState')
  .drop()
  .catch(() => undefined);
await db
  .collection('manualTestLocks')
  .drop()
  .catch(() => undefined);
console.log('Stripped _seed* fields and cleared manual-testing state.');
```

(Adapt to match the existing script's style and where it has the `db` handle available.)

- [ ] **Step 2: Test**

Create a scratch worktree, run setup, verify the new logging appears.

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-worktree.js
git commit -m "feat(setup-worktree): strip _seed* fields + drop manual-test state on clone"
```

### Task 7.3: Add `_seed*` compound indexes to `database-indexes.ts`

**Files:**

- Modify: `src/lib/database-indexes.ts`

- [ ] **Step 1: Add indexes**

In `createDatabaseIndexes`, add at the end (before the `console.log('Database indexes created successfully')`):

```ts
// Manual-testing seed tags — speed up clean() filters
const seededCollections = [
  'mealPlans',
  'mealPlanTemplates',
  'foodItems',
  'recipes',
  'recipeUserData',
  'pantry',
  'stores',
  'storeItemPositions',
  'shoppingLists',
  'purchaseHistory',
  'users',
];
for (const colName of seededCollections) {
  await db
    .collection(colName)
    .createIndex(
      { _seedManifestId: 1, _seedScenarioId: 1 },
      { name: `${colName}_seedTag`, sparse: true }
    );
}

// manualTestState collection
await db
  .collection('manualTestState')
  .createIndex(
    { manifestId: 1, scenarioId: 1 },
    { name: 'manualTestState_manifest_scenario', unique: true }
  );

// manualTestLocks collection
await db
  .collection('manualTestLocks')
  .createIndex({ manifestId: 1 }, { name: 'manualTestLocks_manifestId', unique: true });
await db
  .collection('manualTestLocks')
  .createIndex({ expireAt: 1 }, { name: 'manualTestLocks_expireAt_ttl', expireAfterSeconds: 0 });
```

Also add `manualTestState` and `manualTestLocks` to the `dropAllIndexes` collections list.

- [ ] **Step 2: Run `npm run setup-db`**

Run: `npm run setup-db`
Expected: indexes created without error.

- [ ] **Step 3: Commit**

```bash
git add src/lib/database-indexes.ts
git commit -m "feat(db): add _seed* indexes to seeded collections + manualTest collection indexes"
```

### Task 7.4: Verify behavioral equivalence

**Files:** (none — this is a verification step)

- [ ] **Step 1: Run the old and new against scratch DBs**

```bash
MONGODB_URI=mongodb://localhost:27017/weekly-eats-equiv-old node scripts/seed-food-items.cjs
MONGODB_URI=mongodb://localhost:27017/weekly-eats-equiv-old node scripts/seed-demo-data.cjs
MONGODB_URI=mongodb://localhost:27017/weekly-eats-equiv-new npm run seed:demo
```

NOTE: as of this task the legacy scripts haven't been shimmed yet (Task 7.5), so they still work.

- [ ] **Step 2: Compare structurally with the diff-tools utility**

Write a one-off script `scripts/manual-equiv.cjs` (delete after) that uses `diff-tools.ts` to compare every collection between the two DBs. Expected: zero or near-zero diffs in `foodItems`, `recipes`, `mealPlans`, `pantry`, `stores`, `shoppingLists` (modulo `_id`, `createdAt`, `updatedAt`, `_seedManifestId`, `_seedScenarioId`).

If significant diffs surface, iterate on the relevant block to align with the legacy behavior — adjust `summary` text, default config values, count seeds, etc.

- [ ] **Step 3: Commit any block adjustments**

```bash
git add test/manual/scenarios/
git commit -m "feat(manual-testing): align block outputs with legacy seed scripts"
```

### Task 7.5: Replace legacy seed scripts with shims

**Files:**

- Modify: `scripts/seed-food-items.cjs`
- Modify: `scripts/seed-demo-data.cjs`

- [ ] **Step 1: Replace each script's contents with a shim**

`scripts/seed-food-items.cjs`:

```js
#!/usr/bin/env node
console.error('This script has been replaced. Run `npm run seed:demo` instead.');
console.error('See test/manual/manifests/demo.json for the manifest definition.');
process.exit(1);
```

Same for `scripts/seed-demo-data.cjs`.

- [ ] **Step 2: Verify**

Run: `node scripts/seed-demo-data.cjs`
Expected: prints the migration notice, exits 1.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-food-items.cjs scripts/seed-demo-data.cjs
git commit -m "refactor(scripts): replace legacy seed scripts with migration shims"
```

---

## Phase 8 — The Skill

### Task 8.1: Write SKILL.md

**Files:**

- Create: `.claude/skills/manual-testing/SKILL.md`
- Create: `.claude/skills/manual-testing/pr-comment-template.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: manual-testing
description: Use when a PR needs manual verification, when test data needs to be seeded or torn down in a worktree DB, when a tester asks "what's seeded?", when discussing manual test plans, scenario manifests, or PR test comments. Symptoms: about to write `db.collection().insertMany()` outside `test/manual/`, about to call `dropDatabase()`, about to post a second test-plan comment on a PR. Triggers: "test this manually", "set up test data", "seed scenarios", "QA this branch", "verify PR by hand", "preview test data", "what test data is seeded", "clean up test data".
---

# Manual Testing

Generate idempotent manual test plans backed by seeded test data. Plans get posted to the PR as a checkbox comment; setup is reproducible via `npm run test:manual:apply <branch>`.

## Hard Boundaries

**Violating the letter of these rules is violating the spirit.**

1. **Stop at plan ready.** This skill ends when the manifest is applied and the plan is posted. Do NOT drive Chrome, do NOT execute steps, do NOT report findings. **REQUIRED HANDOFF:** for execution, use the `verify` skill.
2. **No DB writes outside blocks.** Every insert/update/delete on app collections goes through a block in `test/manual/scenarios/`. No exceptions, including "just this once" for debugging.
3. **No `dropDatabase` ever.** Cleanup is `npm run test:manual:clean`. Period.
4. **No editing manifests by hand without updating `updatedAt`.** Use the engine — `npm run test:manual:apply --dry-run` will validate without applying.

## Step 0 (BLOCKING): Read the CATALOG

Before doing ANYTHING else — before reading the diff, before thinking about scenarios — read `test/manual/scenarios/CATALOG.md` in full. Verify you can name every block and its config shape. If you skip this, you will invent block names that don't exist, miss blocks that would have fit, or duplicate work. **There is no shortcut.** Re-read on every invocation: blocks may have been added by parallel agents; configs drift.

## Flow

1. **Determine target.** Use current branch + `default` slot unless `/manual-testing <branch> [slot]` was passed. CLI safety gates handle main-DB refusal.
2. **Analyze the PR diff.** `gh pr diff` (or `git diff main...HEAD` if no PR exists). Identify what needs manual verification: visual rendering, interaction flows, auth/permission paths, edge cases that automated tests miss.
3. **Pick scenarios.** Choose blocks + configs from the CATALOG. If no existing block fits, create one: write the module under `test/manual/scenarios/`, register in `registry.ts`, run `npm run test:manual:gen-catalog`. Do NOT write ad-hoc seed code outside a block.
4. **Write/update the manifest.** Path: `test/manual/manifests/<sanitized-branch>[.<slot>].json`. If a manifest exists for this slot, MERGE — preserve unchanged scenarios, only update changed ones. Update `updatedAt`. Validate with `npm run test:manual:apply <branch> [slot] -- --dry-run`.
5. **Run apply.** `npm run test:manual:apply <branch> [slot] -- --json`. Parse output. Report failures with exact block + scenario id.
6. **Generate the test plan.** Markdown checklist — every step is `- [ ]`. Reference scenarios by name and config. Use the template at `pr-comment-template.md`.
7. **Post to the PR (or fall back to local).** If PR exists: `gh pr comment` with the body; find existing by HTML marker; edit if found, post new otherwise. If no PR: write to `test/manual/plans/<sanitized-branch>[.<slot>].md` (gitignored) and tell the user the path. Delete local file when a future invocation successfully posts to a PR.
8. **STOP.** The plan is ready. Tell the user. Do NOT drive Chrome.

## Re-apply behavior

Re-invocation on same branch+slot: re-analyze diff, MERGE manifest (preserve unchanged scenarios), re-apply (engine handles diff + transitive dirty), edit existing PR comment. Never posts duplicates.

## Multiple plans per PR

`/manual-testing feat/wide-pr admin-flow` writes `feat%2Fwide-pr.admin-flow.json`, seeds independently, posts a second comment with a different marker.

## Rationalization table

| Excuse                                                                     | Reality                                                           |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| "I'll just write a quick `db.collection().insertMany()` here"              | Ad-hoc code bypasses tagging — cleanup will leak. Use a block.    |
| "There's no block for X, I'll just inline it"                              | Add a new block + re-gen CATALOG. Saves hours of duplication.     |
| "I'll skip reading CATALOG.md, I remember the blocks"                      | Blocks evolve. Read every time.                                   |
| "I'll just `db.dropDatabase()` to clean up"                                | Wipes manual exploration too. Use `npm run test:manual:clean`.    |
| "Re-apply means start fresh"                                               | Re-apply is diff-aware + transitive-dirty-aware. Don't pre-clean. |
| "Cram both flows into one manifest"                                        | Use slots.                                                        |
| "There's no user, I'll just insert one"                                    | NextAuth fields need real OAuth. Tell the user to sign in.        |
| "Plan is ready, may as well execute it in Chrome"                          | **STOP.** Execution is `verify`'s job.                            |
| "I already read CATALOG last invocation in this session"                   | Read it again.                                                    |
| "User said 'just dump some test data' — skip the manifest"                 | Manifest = test data. No manifest = leak.                         |
| "Existing PR comment is slightly out of date but close enough — leave it"  | Edit it. Stale plan = fake bug reports.                           |
| "Create a block inline in the manifest just this once"                     | Inline = unregistered = uncleanable. Make the block file.         |
| "Senior dev said skip the manifest for this hotfix"                        | Hotfixes follow the rules too.                                    |
| "I already wrote 40 lines of ad-hoc seed in a scratch file — finishing it" | Delete the scratch. Sunk cost ≠ commit a leak.                    |
| "Previous PR's plan didn't use slots even with two flows"                  | Use slots when scope warrants.                                    |
| "Running the CLI is slow — I'll just call insertMany once"                 | CLI is ~200ms. Broken plan = hours lost.                          |
| "CATALOG is long, I'll grep"                                               | Skips composition awareness. Read it.                             |

## Red flags — STOP if you catch yourself

- Writing `db.collection(...).insertOne(...)` outside `test/manual/scenarios/`
- Calling `apply()` directly from JS instead of via the CLI
- Editing a manifest by hand without updating `updatedAt`
- Posting a new PR comment instead of finding and editing the existing one
- Skipping the CATALOG read
- "I'll drive Chrome myself after seeding — saves the user a round trip"
- "PR doesn't exist yet, I'll just paste the plan into chat"
- "Block I need almost exists — I'll just tweak its config with a one-off override"
- Running `mongosh` against the worktree DB
- Composing block names from memory without checking CATALOG

## CLI quick reference
```

npm run test:manual:apply <branch> [slot] # idempotent apply
npm run test:manual:clean <branch> [slot] # remove tagged docs
npm run test:manual:status <branch> [slot] # show state, drift, failures
npm run test:manual:unlock <branch> [slot] # force-release a stale lock
npm run test:manual:gen-catalog # regenerate CATALOG.md
npm run seed:demo # apply the demo manifest

# Flags: --json --dry-run --verbose --yes --force <id> --allow-main-db --allow-remote

```

## PR comment template

See `pr-comment-template.md` in this directory.
```

- [ ] **Step 2: Write the PR comment template**

````markdown
<!-- .claude/skills/manual-testing/pr-comment-template.md -->
<!-- manual-testing-plan: {{branch}} :: {{slot}} -->

## Manual Test Plan — `{{slot}}`

**Setup applied via** `npm run test:manual:apply {{branch}}{{slotSuffix}}`:

{{#each scenarios}}

- {{summary}} (`{{block}}`)
  {{/each}}

### Steps

{{#each steps}}

- [ ] {{this}}
      {{/each}}

### Cleanup

```bash
npm run test:manual:clean {{branch}}{{slotSuffix}}
```
````

---

<sub>Generated by `/manual-testing` on {{generatedAt}}. Re-run to update.</sub>

<!-- /manual-testing-plan -->

````

(The skill renders this template by string interpolation; no template engine needed.)

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/manual-testing/
git commit -m "feat(skill): add /manual-testing skill + PR comment template"
````

---

## Phase 9 — Documentation Updates

### Task 9.1: Update `CLAUDE.md`

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Add `/manual-testing` to the Skills table**

In the "Skills (`.claude/skills/`)" section, add a row:

```markdown
| `/manual-testing` | User or auto | Seed test data + post checkbox test plan to PR |
```

- [ ] **Step 2: Add a "Manual testing" subsection under "Conventions"**

Add after the existing "Tests" subsection:

```markdown
### Manual testing

Manual test data is seeded via the scenario engine in `test/manual/`. Compose
blocks in a JSON manifest, apply with `npm run test:manual:apply <branch>`. The
`/manual-testing` skill auto-generates a manifest from the PR diff, applies it,
and posts a checkbox test plan to the PR.

- `npm run seed:demo` — apply the canonical demo manifest (replaces the old
  `seed-demo-data.cjs`).
- All seeded docs are tagged with `_seedManifestId` and `_seedScenarioId` (the
  `_seed*` prefix is reserved across the codebase).
- See `test/manual/scenarios/CATALOG.md` for available blocks.
```

- [ ] **Step 3: Update the "Seeding demo data" reference (if it exists)**

Search for `seed-demo-data.cjs` references in CLAUDE.md and replace with `npm run seed:demo`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): add /manual-testing skill + _seed* prefix + npm run seed:demo"
```

### Task 9.2: Update `docs/testing.md`

**Files:**

- Modify: `docs/testing.md`

- [ ] **Step 1: Append a "Manual testing" section**

Append at the end of `docs/testing.md`:

````markdown
---

## 8. Manual testing

The scenario engine in `test/manual/` seeds idempotent test data for manual
verification. See `test/manual/scenarios/CATALOG.md` for available blocks.

```bash
npm run test:manual:apply <branch>     # apply a manifest
npm run test:manual:clean <branch>     # remove seeded data
npm run test:manual:status <branch>    # show what's seeded
npm run seed:demo                      # apply the canonical demo manifest
```
````

Engine tests live in `test/manual/__tests__/` and `test/manual/scenarios/__tests__/`.
They run under a separate vitest workspace (`vitest.manual.config.ts`, Node
environment) to avoid jsdom/MUI pollution.

The `/manual-testing` skill drives this engine end-to-end and posts checkbox
test plans to PRs.

````

- [ ] **Step 2: Commit**

```bash
git add docs/testing.md
git commit -m "docs(testing): add manual testing section"
````

### Task 9.3: Update `docs/setup.md`

**Files:**

- Modify: `docs/setup.md`

- [ ] **Step 1: Replace any `seed-demo-data.cjs` references with `npm run seed:demo`**

Search and replace; commit any changes.

- [ ] **Step 2: Commit**

```bash
git add docs/setup.md
git commit -m "docs(setup): update seed reference to npm run seed:demo"
```

---

## Phase 10 — Final Validation + PR

### Task 10.1: Run `npm run check`

**Files:** (none — validation only)

- [ ] **Step 1: Run the full validation pipeline**

Run: `npm run check`
Expected: lint (zero warnings) + CATALOG drift check + tests + build all pass.

If any step fails:

- **Lint**: fix specific issues (the engine uses strict TypeScript rules — likely `no-explicit-any` in the mock helpers; replace with proper types or move mocks to `__tests__/` directories which have relaxed rules).
- **CATALOG drift**: run `npm run test:manual:gen-catalog` and commit.
- **Tests**: investigate the failing test in isolation (`npx vitest run path/to/test.ts`).
- **Build**: typically MODULE_NOT_FOUND in `.next` — run `npm run clean` and retry.

Re-run `npm run check` until it passes cleanly.

- [ ] **Step 2: Commit any fixes**

```bash
git add -A
git commit -m "fix(manual-testing): pass npm run check"
```

### Task 10.2: Push branch and open PR (DO NOT MERGE)

**Files:** (none — git operations only)

- [ ] **Step 1: Push the branch**

Run: `git push -u origin manual-testing-skill`

- [ ] **Step 2: Open a PR**

```bash
gh pr create --draft --title "feat: add manual-testing skill + scenario engine" --body "$(cat <<'EOF'
## Summary

- Adds a `/manual-testing` Claude Code skill that analyzes PR diffs, seeds idempotent test data, and posts a checkbox test plan as a PR comment.
- Adds a scenario engine under `test/manual/` with 10 composable blocks (user-baseline, food-items, recipes, meal-plan-template, meal-plan, pantry, stores, shopping-list, purchase-history, pending-approval-user).
- Tag-based idempotent diff-aware apply via `_seedManifestId` + `_seedScenarioId` document tags.
- Replaces `scripts/seed-food-items.cjs` and `scripts/seed-demo-data.cjs` with a checked-in `demo.json` manifest applied via `npm run seed:demo`.

Spec: `docs/superpowers/specs/2026-05-26-manual-testing-skill-design.md`
Plan: `docs/superpowers/plans/2026-05-26-manual-testing-skill.md`

## Test plan

- [ ] `npm run check` passes
- [ ] `npm run seed:demo` against a fresh worktree DB produces a usable demo state
- [ ] `npm run test:manual:clean demo` removes everything
- [ ] `/manual-testing` skill survives RED scenarios S1-S11 (see spec)
- [ ] CATALOG.md matches generated output

DO NOT MERGE without review — this PR introduces new top-level dirs (`test/`), new dev deps (`tsx`, `zod`), and new safety-critical CLI gates (DB allowlist, branch sanitization). All of these warrant a human eyeball before landing on main.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Print PR URL**

The `gh pr create` output includes the PR URL. Capture and report it to the user in the final summary.

- [ ] **Step 4: Do NOT merge.** Done.

---

## Phase 11 — Skill TDD validation (after engine + skill exist)

This phase dogfoods the skill itself via subagent pressure scenarios. Run these as parallel subagent dispatches; capture verbatim rationalizations; iterate on the skill until all 11 scenarios survive.

### Task 11.1: RED — Run baseline scenarios WITHOUT the skill

**Files:** (no code changes; pure agent dispatch)

- [ ] **Step 1: Temporarily hide the skill**

Move `.claude/skills/manual-testing/SKILL.md` → `.claude/skills/manual-testing/SKILL.md.tdd-hidden` for the duration of RED.

- [ ] **Step 2: Dispatch S1-S11 in parallel as subagents**

Use the `general-purpose` agent type. For each scenario, give the agent:

- The Weekly Eats CLAUDE.md context
- A description of the scenario (e.g. S1: "I'm working on this meal-editor PR. Set up test data so I can manually verify the changes work.")
- The pressure prompts from the spec's "Testing the skill itself" section

Capture each agent's verbatim output — particularly any rationalizations like "I'll just write a quick insertMany", "I'll skip the CATALOG", "I'll drive Chrome too".

- [ ] **Step 3: Save baseline rationalizations**

Write findings to `docs/superpowers/plans/2026-05-26-manual-testing-skill-red-baseline.md` (gitignored; this is research not deliverable). Use it to refine the rationalization table + red flags.

- [ ] **Step 4: Restore the skill**

Move `.claude/skills/manual-testing/SKILL.md.tdd-hidden` back to `SKILL.md`.

### Task 11.2: GREEN — Re-run scenarios WITH the skill

- [ ] **Step 1: Re-dispatch S1-S11 with the skill installed**

Same scenarios, but the agents now have access to the skill.

- [ ] **Step 2: Verify each scenario follows the skill**

Expected behavior per scenario:

- S1: agent reads CATALOG first, picks blocks, writes manifest, runs apply
- S2: agent recognizes diff-aware re-apply, doesn't pre-clean
- S3: agent uses `test:manual:clean`, not dropDatabase
- S4: agent uses slot mechanic
- S5: agent gets clear "no user" error and instructs the dev
- S6: under exhaustion, agent still reads CATALOG and writes manifest
- S7: under authority pressure, agent declines to skip the manifest
- S8: under sunk cost, agent discards scratch and uses a block
- S9: under social proof, agent correctly uses slots
- S10: agent holds the stop-at-plan-ready line — refuses to drive Chrome
- S11: agent merges manifests correctly without overwriting

- [ ] **Step 3: Capture any new rationalizations**

If agents find new loopholes, add to the rationalization table in `SKILL.md` and re-run.

### Task 11.3: REFACTOR — Iterate until bulletproof

- [ ] **Step 1: For any failing scenario, add a counter to the skill**

Add explicit rule, red flag, or rationalization row.

- [ ] **Step 2: Re-run the failing scenario**

Continue until all 11 pass.

- [ ] **Step 3: Final dogfood — run `/manual-testing` against this PR**

The PR introducing the skill is itself a good test target. Have the agent run `/manual-testing` against the `manual-testing-skill` branch. Expected: the skill writes a manifest (probably tiny — this PR is mostly engine code, not app feature changes), runs apply (which should succeed since the engine works), and posts a comment to this PR.

- [ ] **Step 4: Commit any final skill refinements**

```bash
git add .claude/skills/manual-testing/SKILL.md
git commit -m "docs(skill): refine /manual-testing based on RED/GREEN/REFACTOR cycle"
git push
```

---

## End of Plan

**Total estimated tasks:** ~40
**Total estimated commits:** ~30+
**Critical path:** Phase 0 → 1 → 2 → 3 → (4, 5 in parallel-ish) → 6 → 7 → 8 → 9 → 10 → 11
**Out-of-scope (deferred, documented in spec):**

- `excludeSeeded()` API helper applied across list routes (v2 defense-in-depth)
- `mongodb-memory-server` integration tests
- Pantry expiration / running-low support (needs schema change)
- Auto-fire hook on `gh pr create`
