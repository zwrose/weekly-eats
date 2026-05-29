# Shared dev DB + worktree-clear manual-test data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch all git worktrees to one shared dev DB (#93) and harden the manual-test engine so seeded data is visibly branch-tagged and orphans are swept safely (#92).

**Architecture:** Drop the per-worktree DB clone in `scripts/setup-worktree.js` so every worktree inherits main's `MONGODB_URI` (`weekly-eats-dev`) verbatim. The manual-test engine already tags every seeded doc with `_seedManifestId` (`branch::slot`); add a visible `[branch]` stamp to display names, a `status --all` cross-branch view, and a `clean --orphans` / `clean --manifest-id` cleanup path that keys off the shared `manualTestState` collection + git branch existence (injected, never executed inside the pure-logic Engine).

**Tech Stack:** Node ESM scripts, TypeScript, MongoDB driver, Vitest. Spec: `docs/superpowers/specs/2026-05-28-shared-dev-db-design.md`.

**Conventions that apply (from CLAUDE.md):** named exports only; no `as` casts; `import type` for types; ESM (`.js` import specifiers); cross-platform Node APIs in scripts; `execFileSync` with an args array (never a shell). Run the whole suite once at the end with `npm run check`; per-task, run only the new/changed test file.

**Test env vars:** prefix vitest runs with `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true` (see CLAUDE.md gotchas).

---

## File Structure

| File                                                                                                                           | Responsibility                                                                                                                                                            | Action     |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `test/manual/seedTag.ts`                                                                                                       | Tag helper + `SEED_TITLE_PREFIX` constant (single owner of the recognizable seed shape)                                                                                   | **Create** |
| `test/manual/types.ts`                                                                                                         | Add `BlockContext.label`; add `StatusAllResult`                                                                                                                           | Modify     |
| `test/manual/engine.ts`                                                                                                        | `deriveLabel`; populate `ctx.label`; `statusAll`; `cleanOrphans`; `cleanByBranch` (pure-logic, git injected)                                                              | Modify     |
| `test/manual/cli.ts`                                                                                                           | DB-name log; `makeBranchExists` git wrapper; early-return dispatch for `status --all`, `clean --orphans`, `clean --manifest-id`; `clean --all` preview; `outputStatusAll` | Modify     |
| `test/manual/scenarios/*.ts`                                                                                                   | Adopt `seedTag(ctx)`; stamp display names with `[ctx.label]` (~6 blocks)                                                                                                  | Modify     |
| `test/manual/scenarios/__tests__/*`, `test/manual/__tests__/*`                                                                 | Assertion updates + new cases                                                                                                                                             | Modify     |
| `scripts/setup-worktree.js`                                                                                                    | Remove clone/strip/URI-rewrite; extract exported `rewriteWorktreeEnv`; entrypoint guard                                                                                   | Modify     |
| `scripts/worktree-remove.js`                                                                                                   | Remove DB drop; call `clean --manifest-id <branch>`                                                                                                                       | Modify     |
| `scripts/dev-server.js`                                                                                                        | Log resolved DB name                                                                                                                                                      | Modify     |
| `CLAUDE.md`, `docs/setup.md`, `.claude/skills/manual-testing/SKILL.md`, `.claude/skills/manual-testing/pr-comment-template.md` | Docs                                                                                                                                                                      | Modify     |

**Branch used in examples below:** the current branch is `fix/93-shared-dev-db`, so `branch.slice(0,8)` = `fix/93-s`. Tests use their own fixture branches (e.g. `feat/test`).

---

## Task 1: `seedTag` helper + `SEED_TITLE_PREFIX`

**Files:**

- Create: `test/manual/seedTag.ts`
- Test: `test/manual/__tests__/seedTag.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/manual/__tests__/seedTag.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { seedTag, SEED_TITLE_PREFIX } from '../seedTag.js';

describe('seedTag', () => {
  it('returns the two tag fields from ctx', () => {
    expect(seedTag({ manifestId: 'feat/x::default', scenarioId: 'r' })).toEqual({
      _seedManifestId: 'feat/x::default',
      _seedScenarioId: 'r',
    });
  });

  it('throws when manifestId is empty', () => {
    expect(() => seedTag({ manifestId: '', scenarioId: 'r' })).toThrow(/manifestId/);
  });

  it('throws when scenarioId is empty', () => {
    expect(() => seedTag({ manifestId: 'feat/x::default', scenarioId: '' })).toThrow(/scenarioId/);
  });
});

describe('SEED_TITLE_PREFIX', () => {
  it('is the shared recognizable seed prefix', () => {
    expect(SEED_TITLE_PREFIX).toBe('Manual Test ');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/seedTag.test.ts`
Expected: FAIL — cannot find module `../seedTag.js`.

- [ ] **Step 3: Write minimal implementation**

Create `test/manual/seedTag.ts`:

```typescript
// test/manual/seedTag.ts
import type { BlockContext } from './types.js';

/**
 * Shared recognizable prefix for seeded human-facing names. Owned here so the
 * display-name stamps (blocks) and the legacy-orphan heuristic (cli.ts) agree.
 */
export const SEED_TITLE_PREFIX = 'Manual Test ';

/**
 * Build the canonical seed tag for a doc, asserting both ids are non-empty.
 * Every block insert must spread `...seedTag(ctx)` so cleanup can always find it.
 */
export function seedTag(ctx: Pick<BlockContext, 'manifestId' | 'scenarioId'>): {
  _seedManifestId: string;
  _seedScenarioId: string;
} {
  if (!ctx.manifestId) throw new Error('seedTag: manifestId is empty');
  if (!ctx.scenarioId) throw new Error('seedTag: scenarioId is empty');
  return { _seedManifestId: ctx.manifestId, _seedScenarioId: ctx.scenarioId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/seedTag.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add test/manual/seedTag.ts test/manual/__tests__/seedTag.test.ts
git commit -m "feat(manual-test): add seedTag helper + SEED_TITLE_PREFIX (#92)"
```

---

## Task 2: `ctx.label` on BlockContext + engine derivation

**Files:**

- Modify: `test/manual/types.ts` (add `label` to `BlockContext`)
- Modify: `test/manual/engine.ts` (add `deriveLabel`, populate `label` in every ctx)
- Test: `test/manual/__tests__/engine.test.ts` (add `deriveLabel` tests + a ctx.label assertion)

- [ ] **Step 1: Write the failing test**

Add to `test/manual/__tests__/engine.test.ts` (import `deriveLabel` from `'../engine.js'` — extend the existing import line `import { topoSort, computeDirty, Engine } from '../engine.js';` to include `deriveLabel`):

```typescript
describe('deriveLabel', () => {
  it('is the first 8 chars of the branch when slot is default', () => {
    expect(deriveLabel('fix/93-shared-dev-db', 'default')).toBe('fix/93-s');
  });

  it('appends ·slot when slot is not default', () => {
    expect(deriveLabel('fix/93-shared-dev-db', 'admin')).toBe('fix/93-s·admin');
  });

  it('two branches sharing an 8-char prefix collide (cosmetic, accepted)', () => {
    expect(deriveLabel('feature/foo', 'default')).toBe(deriveLabel('feature/bar', 'default'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/engine.test.ts`
Expected: FAIL — `deriveLabel` is not exported.

- [ ] **Step 3a: Add `label` to `BlockContext`**

In `test/manual/types.ts`, the `BlockContext` interface currently is:

```typescript
export interface BlockContext {
  db: Db;
  manifestId: string;
  scenarioId: string;
  resolve: <T = unknown>(id: string) => T;
}
```

Add the `label` field:

```typescript
export interface BlockContext {
  db: Db;
  manifestId: string;
  scenarioId: string;
  /** Short human stamp for display names: branch.slice(0,8) [+ "·"+slot]. */
  label: string;
  resolve: <T = unknown>(id: string) => T;
}
```

- [ ] **Step 3b: Add `deriveLabel` to `engine.ts` and populate `label` in every ctx**

In `test/manual/engine.ts`, add this exported helper near the top (after the imports, before `topoSort`):

```typescript
/** Visible branch stamp for seeded display names. branch.slice(0,8) [+ "·"+slot]. */
export function deriveLabel(branch: string, slot: string): string {
  const base = branch.slice(0, 8);
  return slot && slot !== 'default' ? `${base}·${slot}` : base;
}
```

Then, in **each** of `apply`, `clean`, and `status`, derive the label once right after `manifestId` is computed and add `label` to every `BlockContext` object literal in that method. There are five ctx literals total. For example, in `apply` the manifestId line is:

```typescript
const manifestId = `${manifest.branch}::${manifest.slot}`;
```

Add immediately after it:

```typescript
const label = deriveLabel(manifest.branch, manifest.slot);
```

Then every ctx literal that today reads:

```typescript
const ctx: BlockContext = {
  db: this.db,
  manifestId,
  scenarioId: id,
  resolve: <T>(depId: string): T => {
    /* ... */
  },
};
```

gains `label,`:

```typescript
const ctx: BlockContext = {
  db: this.db,
  manifestId,
  label,
  scenarioId: id,
  resolve: <T>(depId: string): T => {
    /* ... */
  },
};
```

Apply the same `label,` addition to the inline `block.status({...})` ctx (in the dirty-detection loop), the `block.clean({...})` ctx (clean-in-apply loop), the standalone `clean` method's ctx, and the `status` method's ctx — each currently has `{ db: this.db, manifestId, scenarioId: id, resolve: ... }`. In `clean` and `status`, add `const label = deriveLabel(manifest.branch, manifest.slot);` after their own `manifestId` line first.

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/engine.test.ts`
Expected: PASS (existing tests + 3 new `deriveLabel` tests). TypeScript compiles (every ctx now has `label`).

- [ ] **Step 5: Commit**

```bash
git add test/manual/types.ts test/manual/engine.ts test/manual/__tests__/engine.test.ts
git commit -m "feat(manual-test): add ctx.label branch stamp to BlockContext (#93)"
```

---

## Task 3: Blocks adopt `seedTag(ctx)` + stamp display names

This task repeats one mechanical pattern across the scenario blocks. Do `recipes` fully (shown below), then apply the identical pattern to the others using the per-block table.

**Files:**

- Modify: `test/manual/scenarios/{recipes,food-items,stores,shopping-list,meal-plan,meal-plan-template,pantry,purchase-history,user-baseline,pending-approval-user}.ts`
- Modify: matching `test/manual/scenarios/__tests__/*.test.ts`

**The two changes per block:**

1. **Tag migration (all blocks that insert docs):** replace the inline `const tagFilter = { _seedManifestId: ctx.manifestId, _seedScenarioId: ctx.scenarioId };` literal with `import { seedTag, SEED_TITLE_PREFIX } from '../seedTag.js';` and `const tagFilter = seedTag(ctx);`. Keep the existing `...tagFilter` spreads and `clean`/`status` filters as-is.
2. **Display-name stamp (only blocks with a human-facing name/title field — see table):** build the name as `` `${SEED_TITLE_PREFIX}<Kind> [${ctx.label}] ${n}` ``.

**Per-block table:**

| Block                                          | Display field                        | New value                                                  | Notes                                                                                     |
| ---------------------------------------------- | ------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `recipes`                                      | `title`                              | `` `${SEED_TITLE_PREFIX}Recipe [${ctx.label}] ${i + 1}` `` | shown below                                                                               |
| `food-items`                                   | `name` (`singularName`/`pluralName`) | `` `${SEED_TITLE_PREFIX}Food [${ctx.label}] ${i}` ``       | both vars                                                                                 |
| `stores`                                       | `name`                               | `` `${SEED_TITLE_PREFIX}Store [${ctx.label}] ${i + 1}` ``  |                                                                                           |
| `shopping-list`                                | item `name`                          | `` `${SEED_TITLE_PREFIX}Item [${ctx.label}] ${i + 1}` ``   |                                                                                           |
| `meal-plan`                                    | `name`                               | `` `${SEED_TITLE_PREFIX}Meal Plan [${ctx.label}]` ``       | single doc                                                                                |
| `meal-plan-template`                           | —                                    | —                                                          | tag migration only; check for a `name`/`title` doc field — stamp it if present, else skip |
| `pantry`, `purchase-history`, `recipeUserData` | —                                    | —                                                          | tag migration only (no own display name)                                                  |
| `user-baseline`                                | —                                    | —                                                          | tag migration only; **do NOT** stamp email/identity                                       |
| `pending-approval-user`                        | display name only                    | stamp the display-name field; **leave email intact**       |                                                                                           |

- [ ] **Step 1: Update the recipes test for the new title shape**

In `test/manual/scenarios/__tests__/recipes.test.ts`, change the title assertion at line ~124 from:

```typescript
expect(doc.title).toMatch(/Manual Test Recipe/);
```

to assert the stamp is present:

```typescript
expect(doc.title).toMatch(/^Manual Test Recipe \[.+\] \d+$/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/scenarios/__tests__/recipes.test.ts`
Expected: FAIL — current title is `Manual Test Recipe 1` (no `[label]`), so the regex doesn't match.

- [ ] **Step 3: Implement the recipes changes**

In `test/manual/scenarios/recipes.ts`:

Add the import at the top (with the other imports):

```typescript
import { seedTag, SEED_TITLE_PREFIX } from '../seedTag.js';
```

Replace the inline tag literal in `apply` (currently lines ~84-87):

```typescript
const tagFilter = {
  _seedManifestId: ctx.manifestId,
  _seedScenarioId: ctx.scenarioId,
};
```

with:

```typescript
const tagFilter = seedTag(ctx);
```

Change the insert title (currently `title: \`Manual Test Recipe ${i + 1}\`,`) to:

```typescript
        title: `${SEED_TITLE_PREFIX}Recipe [${ctx.label}] ${i + 1}`,
```

Leave `clean` and `status` (which use their own `tagFilter` literal) as-is, OR optionally swap them to `seedTag(ctx)` too — both are correct; `clean`/`status` only need the two fields.

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/scenarios/__tests__/recipes.test.ts`
Expected: PASS.

- [ ] **Step 5: Apply the same pattern to the remaining blocks + their tests**

For each block in the table: add the `seedTag` import, replace the inline tag literal with `seedTag(ctx)`, and (where a display field exists) stamp it per the table. Then update that block's `__tests__` file: any assertion matching the old literal name (e.g. `/Manual Test Store/`, `Manual Test Food`, `Manual Test Item`, `Manual Test Meal Plan`) becomes the stamped form `/^Manual Test Store \[.+\] \d+$/` etc. For blocks with no name change (pantry, purchase-history, user-baseline, meal-plan-template if no field), only the tag-migration applies and existing tests should still pass.

Run the whole scenarios suite:

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/scenarios/`
Expected: PASS (all block tests).

- [ ] **Step 6: Regenerate the CATALOG (block docs may reference names)**

Run: `npm run test:manual:gen-catalog`
Then verify nothing else drifted: `npm run test:manual:gen-catalog -- --check` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add test/manual/scenarios/
git commit -m "feat(manual-test): tag via seedTag + stamp [branch] in seeded display names (#93)"
```

---

## Task 4: `StatusAllResult` type + `status --all` (engine + cli + dispatch)

**Files:**

- Modify: `test/manual/types.ts` (add `StatusAllResult`)
- Modify: `test/manual/engine.ts` (add `statusAll`)
- Modify: `test/manual/cli.ts` (early-return dispatch + `outputStatusAll`)
- Test: `test/manual/__tests__/engine.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `test/manual/__tests__/engine.test.ts`:

```typescript
describe('Engine.statusAll', () => {
  it('groups doc counts by distinct _seedManifestId across collections', async () => {
    // Mock db: recipes has 2 docs for branchA, 1 for branchB; stores has 1 for branchA.
    const distinctByCol: Record<string, string[]> = {
      recipes: ['a::default', 'b::default'],
      stores: ['a::default'],
    };
    const countByColAndId: Record<string, number> = {
      'recipes|a::default': 2,
      'recipes|b::default': 1,
      'stores|a::default': 1,
    };
    const db = {
      collection: vi.fn((name: string) => ({
        distinct: vi.fn(async () => distinctByCol[name] ?? []),
        countDocuments: vi.fn(
          async (q: { _seedManifestId: string }) =>
            countByColAndId[`${name}|${q._seedManifestId}`] ?? 0
        ),
      })),
    } as unknown as Db;

    const engine = new Engine(db, new Map());
    const result = await engine.statusAll();

    expect(result.command).toBe('status-all');
    const a = result.manifests.find((m) => m.manifestId === 'a::default');
    const b = result.manifests.find((m) => m.manifestId === 'b::default');
    expect(a?.collections.recipes).toBe(2);
    expect(a?.collections.stores).toBe(1);
    expect(b?.collections.recipes).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/engine.test.ts -t statusAll`
Expected: FAIL — `engine.statusAll` is not a function.

- [ ] **Step 3a: Add `StatusAllResult` to `types.ts`**

Append to `test/manual/types.ts`:

```typescript
// ─── status --all result ─────────────────────────────────────────────────
export interface StatusAllManifest {
  manifestId: string;
  collections: Record<string, number>;
  hasOrphans: boolean;
}

export interface StatusAllResult {
  command: 'status-all';
  manifests: StatusAllManifest[];
}
```

- [ ] **Step 3b: Add `statusAll` to `engine.ts`**

Add this method to the `Engine` class (import `KNOWN_COLLECTIONS` and the type at the top of `engine.ts`: `import { KNOWN_COLLECTIONS } from './types.js';` and add `StatusAllResult` to the existing `import type { ... } from './types.js';` line):

```typescript
  /** Cross-manifest landscape of the shared DB: per-collection counts grouped by _seedManifestId. */
  async statusAll(): Promise<StatusAllResult> {
    const byId = new Map<string, Record<string, number>>();
    for (const col of KNOWN_COLLECTIONS) {
      const ids = (await this.db.collection(col).distinct('_seedManifestId')) as string[];
      for (const id of ids) {
        if (!id) continue;
        const count = await this.db.collection(col).countDocuments({ _seedManifestId: id });
        if (count === 0) continue;
        const entry = byId.get(id) ?? {};
        entry[col] = count;
        byId.set(id, entry);
      }
    }
    return {
      command: 'status-all',
      manifests: [...byId.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([manifestId, collections]) => ({ manifestId, collections, hasOrphans: false })),
    };
  }
```

(`hasOrphans` is wired in Task 6 once the orphan detection exists; leave `false` here.)

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/engine.test.ts -t statusAll`
Expected: PASS.

- [ ] **Step 5: Wire the CLI dispatch + `outputStatusAll`**

In `test/manual/cli.ts`, add the `StatusAllResult` type to the `import type { CliResult, Block } from './types.js';` line. After the DB connection is opened (`const db = client.db();`, ~line 192) and **before** the `unlock` / `resolveTarget` blocks, add the file-independent early-return for `status --all`:

```typescript
// ── File-independent commands (no manifest file needed) ──
if (parsed.command === 'status' && parsed.flags.all) {
  const blocks = await loadBlocks();
  const engine = new Engine(db, blocks);
  const result = await engine.statusAll();
  outputStatusAll(result, parsed);
  return 0;
}
```

Add the dedicated output function near the existing `output()` function:

```typescript
function outputStatusAll(result: StatusAllResult, parsed: ParsedArgs): void {
  if (parsed.flags.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (result.manifests.length === 0) {
    process.stdout.write('status --all: no seeded data found\n');
    return;
  }
  for (const m of result.manifests) {
    const cols = Object.entries(m.collections)
      .map(([c, n]) => `${c}:${n}`)
      .join(', ');
    process.stdout.write(`${m.manifestId}${m.hasOrphans ? ' (orphans)' : ''}: ${cols}\n`);
  }
}
```

- [ ] **Step 6: Add a CLI test for the no-manifest-file path**

Add to `test/manual/__tests__/cli.test.ts` a unit test that `parseArgs(['status', '--all'])` yields `{ command: 'status', flags: { all: true } }` (this locks in that `--all` routes to the new branch):

```typescript
it('parses status --all', () => {
  const p = parseArgs(['status', '--all']);
  expect(p.command).toBe('status');
  expect(p.flags.all).toBe(true);
});
```

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/cli.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add test/manual/types.ts test/manual/engine.ts test/manual/cli.ts test/manual/__tests__/engine.test.ts test/manual/__tests__/cli.test.ts
git commit -m "feat(manual-test): add status --all cross-branch view (#93)"
```

---

## Task 5: `branchExists` git wrapper (`makeBranchExists`) with exit classification

**Files:**

- Modify: `test/manual/cli.ts` (export `makeBranchExists`)
- Test: `test/manual/__tests__/cli.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `test/manual/__tests__/cli.test.ts`. Mock `node:child_process` at the top of the file (if not already mocked):

```typescript
import { vi } from 'vitest';
vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
import { execFileSync } from 'node:child_process';
import { makeBranchExists } from '../cli.js';

describe('makeBranchExists', () => {
  const branchExists = makeBranchExists();

  it('returns true on exit 0 (branch exists)', () => {
    vi.mocked(execFileSync).mockReturnValueOnce(Buffer.from('sha\n'));
    expect(branchExists('feat/x')).toBe(true);
  });

  it('returns false on exit 1 (--quiet, ref absent)', () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      throw Object.assign(new Error('exit 1'), { status: 1 });
    });
    expect(branchExists('gone/branch')).toBe(false);
  });

  it('throws on exit 128 (not a git repo)', () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      throw Object.assign(new Error('fatal'), { status: 128 });
    });
    expect(() => branchExists('feat/x')).toThrow();
  });

  it('throws on ENOENT (git missing)', () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      throw Object.assign(new Error('spawn'), { code: 'ENOENT' });
    });
    expect(() => branchExists('feat/x')).toThrow();
  });
});
```

> Note: if `cli.test.ts` already imports the real `execFileSync` for other tests (it uses it indirectly via `getCurrentGitBranch`), keep those tests working by asserting on the mock per-test with `mockReturnValueOnce` / `mockImplementationOnce` and a `beforeEach(() => vi.mocked(execFileSync).mockReset())`. The existing `resolveDbSafety`/`parseArgs`/`resolveTarget` tests do not call git, so they are unaffected.

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/cli.test.ts -t makeBranchExists`
Expected: FAIL — `makeBranchExists` is not exported.

- [ ] **Step 3: Implement `makeBranchExists` in `cli.ts`**

`execFileSync` is already imported in `cli.ts`. Add this exported factory (near `getCurrentGitBranch`):

```typescript
/**
 * Build a branch-existence check for the orphan sweep. Injected into the engine
 * so engine.ts stays OS-free. With `--quiet`: exit 0 = exists, exit 1 = ref
 * absent (gone). Exit 128 (not a repo) or ENOENT (git missing) means the
 * environment is broken — THROW so the sweep aborts instead of nuking everything.
 */
export function makeBranchExists(): (branch: string) => boolean {
  return (branch: string): boolean => {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', branch], { stdio: 'pipe' });
      return true;
    } catch (e: unknown) {
      const err = e as { status?: number; code?: string };
      if (err.status === 1) return false; // ref absent
      throw new Error(
        `branchExists: git rev-parse failed for "${branch}" (status=${err.status}, code=${err.code}) — aborting orphan sweep`
      );
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/cli.test.ts -t makeBranchExists`
Expected: PASS (4 cases). Also re-run the whole file to confirm no regression: `... npx vitest run test/manual/__tests__/cli.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add test/manual/cli.ts test/manual/__tests__/cli.test.ts
git commit -m "feat(manual-test): branchExists git wrapper with exit-code classification (#92)"
```

---

## Task 6: `clean --orphans` (engine `cleanOrphans` + cli dispatch + plain-clean/status warning)

**Files:**

- Modify: `test/manual/engine.ts` (`cleanOrphans`; orphan-detection helper reused by `status`/`clean` warning + `statusAll.hasOrphans`)
- Modify: `test/manual/cli.ts` (`clean --orphans` early-return dispatch)
- Test: `test/manual/__tests__/engine.test.ts`

**Definitions (from spec §3):**

- **untracked** — a tagged doc whose `(manifestId, scenarioId)` has no row in `manualTestState`.
- **stale-branch** — a tagged doc whose branch (`manifestId.split('::')[0]`) returns `false` from `branchExists`.
- **legacy-untagged** — a doc in a seedable collection with a `title`/`name` starting with `SEED_TITLE_PREFIX` but **no** `_seedManifestId` field. **Report only**, never deleted.
- **Backstop:** denominator = count of all distinct branches among `_seedManifestId`. If stale branches > 50% of that, warn + require re-confirm before deleting.

- [ ] **Step 1: Write the failing test**

Add to `test/manual/__tests__/engine.test.ts`. Use a mock db that supports `distinct`, `find().toArray()`, and `deleteMany` per collection plus a `manualTestState` collection:

```typescript
describe('Engine.cleanOrphans', () => {
  function orphanDb(opts: {
    tagsByCol: Record<string, Array<{ _seedManifestId: string; _seedScenarioId: string }>>;
    stateRows: Array<{ manifestId: string; scenarioId: string }>;
    deletes: Record<string, ReturnType<typeof vi.fn>>;
  }) {
    return {
      collection: vi.fn((name: string) => {
        if (name === 'manualTestState') {
          return {
            find: vi.fn(() => ({ toArray: vi.fn(async () => opts.stateRows) })),
            deleteMany: opts.deletes['manualTestState'] ?? vi.fn(async () => ({ deletedCount: 0 })),
          };
        }
        const docs = opts.tagsByCol[name] ?? [];
        return {
          distinct: vi.fn(async () => [...new Set(docs.map((d) => d._seedManifestId))]),
          find: vi.fn(() => ({ toArray: vi.fn(async () => docs) })),
          deleteMany: opts.deletes[name] ?? vi.fn(async () => ({ deletedCount: docs.length })),
        };
      }),
    } as unknown as Db;
  }

  it('--yes deletes untracked docs (tagged, no manualTestState row)', async () => {
    const recipesDelete = vi.fn(async () => ({ deletedCount: 1 }));
    const db = orphanDb({
      tagsByCol: { recipes: [{ _seedManifestId: 'a::default', _seedScenarioId: 'r' }] },
      stateRows: [], // nothing tracked -> untracked
      deletes: { recipes: recipesDelete },
    });
    const engine = new Engine(db, new Map());
    await engine.cleanOrphans({ branchExists: () => true, dryRun: false });
    expect(recipesDelete).toHaveBeenCalled();
  });

  it('--yes deletes stale-branch docs AND their manualTestState rows', async () => {
    const recipesDelete = vi.fn(async () => ({ deletedCount: 1 }));
    const stateDelete = vi.fn(async () => ({ deletedCount: 1 }));
    const db = orphanDb({
      tagsByCol: { recipes: [{ _seedManifestId: 'gone::default', _seedScenarioId: 'r' }] },
      stateRows: [{ manifestId: 'gone::default', scenarioId: 'r' }], // tracked, but branch gone
      deletes: { recipes: recipesDelete, manualTestState: stateDelete },
    });
    const engine = new Engine(db, new Map());
    await engine.cleanOrphans({ branchExists: () => false, dryRun: false });
    expect(recipesDelete).toHaveBeenCalled();
    expect(stateDelete).toHaveBeenCalled();
  });

  it('--dry-run deletes nothing', async () => {
    const recipesDelete = vi.fn(async () => ({ deletedCount: 0 }));
    const db = orphanDb({
      tagsByCol: { recipes: [{ _seedManifestId: 'a::default', _seedScenarioId: 'r' }] },
      stateRows: [],
      deletes: { recipes: recipesDelete },
    });
    const engine = new Engine(db, new Map());
    const r = await engine.cleanOrphans({ branchExists: () => true, dryRun: true });
    expect(recipesDelete).not.toHaveBeenCalled();
    expect(r.untracked.length).toBeGreaterThan(0);
  });

  it('aborts (throws) when branchExists throws — never deletes', async () => {
    const recipesDelete = vi.fn(async () => ({ deletedCount: 0 }));
    const db = orphanDb({
      tagsByCol: { recipes: [{ _seedManifestId: 'a::default', _seedScenarioId: 'r' }] },
      stateRows: [{ manifestId: 'a::default', scenarioId: 'r' }],
      deletes: { recipes: recipesDelete },
    });
    const engine = new Engine(db, new Map());
    await expect(
      engine.cleanOrphans({
        branchExists: () => {
          throw new Error('git broken');
        },
        dryRun: false,
      })
    ).rejects.toThrow(/git broken/);
    expect(recipesDelete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/engine.test.ts -t cleanOrphans`
Expected: FAIL — `engine.cleanOrphans` is not a function.

- [ ] **Step 3: Implement `cleanOrphans` in `engine.ts`**

Add this method to the `Engine` class. (Resolve branch existence FIRST so an environment error aborts before any delete.)

```typescript
  /**
   * Sweep orphaned seed data on the shared DB. Cross-branch-safe: keys off the
   * shared manualTestState collection + injected branchExists, never on-disk manifests.
   * Targets: (1) untracked = tagged but no state row; (2) stale-branch = branch gone
   * from git (deletes docs + state rows); (3) legacy-untagged = SEED_TITLE_PREFIX docs
   * with no tag (report only). Throws (aborts) if branchExists throws — never mass-deletes.
   */
  async cleanOrphans(opts: {
    branchExists: (branch: string) => boolean;
    dryRun: boolean;
  }): Promise<{
    untracked: string[];
    staleBranch: string[];
    legacy: Array<{ collection: string; count: number }>;
    deleted: number;
    warnings: string[];
  }> {
    const { SEED_TITLE_PREFIX } = await import('./seedTag.js');

    // 1. Gather distinct manifestIds present on docs + the set of tracked (manifestId,scenarioId).
    const docIds = new Set<string>();
    for (const col of KNOWN_COLLECTIONS) {
      for (const id of (await this.db.collection(col).distinct('_seedManifestId')) as string[]) {
        if (id) docIds.add(id);
      }
    }
    const stateRows = await this.db
      .collection<ManualTestStateDoc>(STATE_COLLECTION)
      .find({}, { projection: { manifestId: 1, scenarioId: 1 } })
      .toArray();
    const trackedManifestIds = new Set(stateRows.map((s) => s.manifestId));

    // 2. Classify branches FIRST (throws abort the whole sweep before any delete).
    const branchesOnDocs = new Set([...docIds].map((id) => id.split('::')[0]));
    const goneBranches = new Set<string>();
    for (const branch of branchesOnDocs) {
      if (!this.branchExistsSafe(opts.branchExists, branch)) goneBranches.add(branch);
    }

    // 3. Partition manifestIds into untracked vs stale-branch.
    const untracked: string[] = [];
    const staleBranch: string[] = [];
    for (const id of docIds) {
      const branch = id.split('::')[0];
      if (goneBranches.has(branch)) staleBranch.push(id);
      else if (!trackedManifestIds.has(id)) untracked.push(id);
    }

    // 4. Legacy untagged (report only): SEED_TITLE_PREFIX in title/name, no _seedManifestId.
    const legacy: Array<{ collection: string; count: number }> = [];
    for (const col of KNOWN_COLLECTIONS) {
      const count = await this.db.collection(col).countDocuments({
        _seedManifestId: { $exists: false },
        $or: [
          { title: { $regex: `^${escapeRegExp(SEED_TITLE_PREFIX)}` } },
          { name: { $regex: `^${escapeRegExp(SEED_TITLE_PREFIX)}` } },
        ],
      });
      if (count > 0) legacy.push({ collection: col, count });
    }

    // 5. Backstop: > 50% of all doc branches gone -> warn (caller re-confirms).
    const warnings: string[] = [];
    if (branchesOnDocs.size > 0 && goneBranches.size > branchesOnDocs.size / 2) {
      warnings.push(
        `orphan sweep flagged ${goneBranches.size}/${branchesOnDocs.size} branches as gone — re-confirm before deleting`
      );
    }

    // 6. Delete (unless dry-run). untracked + staleBranch by exact $in; state rows for stale.
    let deleted = 0;
    const toDelete = [...untracked, ...staleBranch];
    if (!opts.dryRun && toDelete.length > 0) {
      for (const col of KNOWN_COLLECTIONS) {
        const r = await this.db.collection(col).deleteMany({ _seedManifestId: { $in: toDelete } });
        deleted += r.deletedCount ?? 0;
      }
      await this.db
        .collection(STATE_COLLECTION)
        .deleteMany({ manifestId: { $in: staleBranch } });
    }

    return { untracked, staleBranch, legacy, deleted, warnings };
  }

  private branchExistsSafe(fn: (b: string) => boolean, branch: string): boolean {
    return fn(branch); // fn throws on environment error; we let it propagate to abort.
  }
```

Add a tiny regex-escape helper at the bottom of `engine.ts` (module scope) for the legacy heuristic:

```typescript
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

> `branchExistsSafe` is a thin pass-through that documents intent; calling `opts.branchExists` directly is equivalent. Keep it inline if you prefer — the key property is that the loop in step 2 runs **before** any `deleteMany`, so a throw aborts cleanly.

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/engine.test.ts -t cleanOrphans`
Expected: PASS (4 cases).

- [ ] **Step 5: Wire `clean --orphans` dispatch + the plain clean/status warning**

In `cli.ts`, add another file-independent early-return branch (alongside the `status --all` branch from Task 4, before `resolveTarget`):

```typescript
if (parsed.command === 'clean' && parsed.flags.orphans) {
  const engine = new Engine(db, await loadBlocks());
  const dryRun = !parsed.flags.yes; // default dry-run; --yes deletes
  const r = await engine.cleanOrphans({ branchExists: makeBranchExists(), dryRun });
  process.stdout.write(
    `clean --orphans${dryRun ? ' (dry-run)' : ''}: ` +
      `${r.untracked.length} untracked, ${r.staleBranch.length} stale-branch, ` +
      `${r.legacy.reduce((n, l) => n + l.count, 0)} legacy-untagged (report only); ` +
      `${dryRun ? 'would delete' : 'deleted'} ${dryRun ? r.untracked.length + r.staleBranch.length : r.deleted}\n`
  );
  for (const w of r.warnings) process.stdout.write(`  warning: ${w}\n`);
  return 0;
}
```

For the **plain clean/status warning** (Finding R4): add a small exported helper to `engine.ts` that the existing `clean`/`status` methods call to populate `CliResult.warnings` when seed-shaped untagged docs exist. Add to `clean` and `status`, just before each `return { ... }`, replacing the empty `warnings: []`:

```typescript
const warnings = await this.orphanWarnings();
```

and use `warnings` in the returned object. Implement:

```typescript
  /** Detect orphan/untagged seed-shaped docs for a warning on plain clean/status. */
  private async orphanWarnings(): Promise<string[]> {
    const { SEED_TITLE_PREFIX } = await import('./seedTag.js');
    let legacy = 0;
    for (const col of KNOWN_COLLECTIONS) {
      legacy += await this.db.collection(col).countDocuments({
        _seedManifestId: { $exists: false },
        $or: [
          { title: { $regex: `^${escapeRegExp(SEED_TITLE_PREFIX)}` } },
          { name: { $regex: `^${escapeRegExp(SEED_TITLE_PREFIX)}` } },
        ],
      });
    }
    return legacy > 0
      ? [`${legacy} untagged seed-shaped doc(s) detected — run \`clean --orphans\` to review`]
      : [];
  }
```

- [ ] **Step 6: Add the plain-clean warning test**

Add to `test/manual/__tests__/engine.test.ts` a test that `clean`/`status` surface the warning when an untagged seed-shaped doc exists (mock `countDocuments` to return >0 for the legacy filter). Assert `result.warnings` is non-empty.

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/engine.test.ts`
Expected: PASS.

- [ ] **Step 7: Wire `hasOrphans` into `statusAll`**

Now that `orphanWarnings`/detection exists, in `statusAll` (Task 4) set `hasOrphans` per manifest: a manifest is "orphaned" if its branch is gone or it has no state row. Keep it simple — `statusAll` does not take `branchExists`, so set `hasOrphans` based on the absence of a `manualTestState` row for the manifestId (read `manualTestState` distinct manifestIds once and compare). Update the `statusAll` test's expectation accordingly (tracked vs untracked manifest).

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/engine.test.ts -t statusAll`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add test/manual/engine.ts test/manual/cli.ts test/manual/__tests__/engine.test.ts
git commit -m "feat(manual-test): clean --orphans sweep + orphan warning on clean/status (#92)"
```

---

## Task 7: `clean --manifest-id <branch>` (branch-prefix, no regex)

**Files:**

- Modify: `test/manual/engine.ts` (`cleanByBranch`)
- Modify: `test/manual/cli.ts` (`clean --manifest-id` dispatch, with `validateBranch`)
- Test: `test/manual/__tests__/engine.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `test/manual/__tests__/engine.test.ts`:

```typescript
describe('Engine.cleanByBranch', () => {
  it('deletes docs + state across multiple slots; does NOT over-match a .-adjacent sibling', async () => {
    const present = ['release/1.2::default', 'release/1.2::admin', 'release/1X2::default'];
    const recipesDelete = vi.fn(async () => ({ deletedCount: 2 }));
    const stateDelete = vi.fn(async () => ({ deletedCount: 2 }));
    const db = {
      collection: vi.fn((name: string) => {
        if (name === 'manualTestState') {
          return { distinct: vi.fn(async () => present), deleteMany: stateDelete };
        }
        return { distinct: vi.fn(async () => present), deleteMany: recipesDelete };
      }),
    } as unknown as Db;

    const engine = new Engine(db, new Map());
    const r = await engine.cleanByBranch('release/1.2');

    // Both release/1.2 slots match; release/1X2 must NOT.
    expect(r.matched.sort()).toEqual(['release/1.2::admin', 'release/1.2::default']);
    expect(recipesDelete).toHaveBeenCalledWith({
      _seedManifestId: { $in: ['release/1.2::default', 'release/1.2::admin'] },
    });
    expect(stateDelete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/engine.test.ts -t cleanByBranch`
Expected: FAIL — `engine.cleanByBranch` is not a function.

- [ ] **Step 3: Implement `cleanByBranch` in `engine.ts`**

```typescript
  /**
   * File-independent targeted clean: remove all docs + state for a branch (every slot).
   * No regex — enumerate exact _seedManifestId values and delete by $in, so a branch
   * containing '.' cannot over-match a sibling (e.g. release/1.2 vs release/1X2).
   */
  async cleanByBranch(branch: string): Promise<{ matched: string[]; deleted: number }> {
    const prefix = `${branch}::`;
    const ids = new Set<string>();
    for (const col of [...KNOWN_COLLECTIONS, STATE_COLLECTION]) {
      const colIds = (await this.db.collection(col).distinct(
        col === STATE_COLLECTION ? 'manifestId' : '_seedManifestId'
      )) as string[];
      for (const id of colIds) if (id && id.startsWith(prefix)) ids.add(id);
    }
    const matched = [...ids];
    let deleted = 0;
    if (matched.length > 0) {
      for (const col of KNOWN_COLLECTIONS) {
        const r = await this.db.collection(col).deleteMany({ _seedManifestId: { $in: matched } });
        deleted += r.deletedCount ?? 0;
      }
      await this.db.collection(STATE_COLLECTION).deleteMany({ manifestId: { $in: matched } });
    }
    return { matched, deleted };
  }
```

> The test asserts `deleteMany` was called with the `$in` array in the order the ids were discovered. If your `Set` iteration order differs, relax the test to `expect(recipesDelete).toHaveBeenCalledWith({ _seedManifestId: { $in: expect.arrayContaining([...]) } })` — but do assert `release/1X2::default` is NOT in the array.

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/engine.test.ts -t cleanByBranch`
Expected: PASS.

- [ ] **Step 5: Wire `clean --manifest-id` dispatch in `cli.ts`**

`validateBranch` is already imported in `cli.ts`. Add this file-independent early-return branch (alongside the others, before `resolveTarget`):

```typescript
if (parsed.command === 'clean' && parsed.flags['manifest-id']) {
  const branch = String(parsed.flags['manifest-id']);
  validateBranch(branch); // rejects '::*' and disallowed chars
  const engine = new Engine(db, await loadBlocks());
  const r = await engine.cleanByBranch(branch);
  process.stdout.write(
    `clean --manifest-id ${branch}: deleted ${r.deleted} docs across ${r.matched.length} manifest id(s)\n`
  );
  return 0;
}
```

- [ ] **Step 6: Add a CLI test that invalid manifest-id input is rejected**

Add to `test/manual/__tests__/validate-args.test.ts` (or `cli.test.ts`): `validateBranch('feat::*')` throws (the `:` and `*` are disallowed by `BRANCH_RE`).

```typescript
it('rejects a manifest-id wildcard / colon form', () => {
  expect(() => validateBranch('feat::*')).toThrow();
});
```

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/validate-args.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add test/manual/engine.ts test/manual/cli.ts test/manual/__tests__/
git commit -m "feat(manual-test): clean --manifest-id branch-prefix purge, no regex over-match (#92)"
```

---

## Task 8: `clean --all` pre-deletion preview

**Files:**

- Modify: `test/manual/cli.ts` (`clean --all` branch — print preview before deleting)
- Test: `test/manual/__tests__/cli.test.ts` (or a focused engine helper test)

The existing `clean --all` handler lives in `cli.ts` (~lines 267-282) inside the post-manifest block. Move/confirm it reaches without a manifest file (it's flag-gated). Add a preview before the destructive loop.

- [ ] **Step 1: Write the failing test**

The current `clean --all` only prints a total _after_ deleting. Add an engine helper `previewAll()` that returns the affected branch set + total, so it's unit-testable. Add to `test/manual/__tests__/engine.test.ts`:

```typescript
describe('Engine.previewAll', () => {
  it('returns distinct branches and total doc count', async () => {
    const ids = ['a::default', 'a::admin', 'b::default'];
    const db = {
      collection: vi.fn(() => ({
        distinct: vi.fn(async () => ids),
        countDocuments: vi.fn(async () => 4),
      })),
    } as unknown as Db;
    const engine = new Engine(db, new Map());
    const p = await engine.previewAll();
    expect(p.branches.sort()).toEqual(['a', 'b']);
    expect(p.total).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/engine.test.ts -t previewAll`
Expected: FAIL — `engine.previewAll` is not a function.

- [ ] **Step 3: Implement `previewAll` + use it in the cli `clean --all` branch**

Add to `engine.ts`:

```typescript
  /** Summarize what `clean --all` would wipe across the shared DB. */
  async previewAll(): Promise<{ branches: string[]; total: number }> {
    const ids = new Set<string>();
    let total = 0;
    for (const col of KNOWN_COLLECTIONS) {
      const colIds = (await this.db.collection(col).distinct('_seedManifestId')) as string[];
      for (const id of colIds) if (id) ids.add(id);
      total += await this.db.collection(col).countDocuments({ _seedManifestId: { $exists: true } });
    }
    return { branches: [...new Set([...ids].map((id) => id.split('::')[0]))].sort(), total };
  }
```

In `cli.ts`, inside the existing `if (parsed.flags.all)` clean block, before the delete loop, add:

```typescript
const engine = new Engine(db, await loadBlocks());
const preview = await engine.previewAll();
process.stdout.write(
  `clean --all: ${preview.total} doc(s) across ${preview.branches.length} branch(es): ${preview.branches.join(', ')}\n`
);
```

(The `--yes` gate already guards execution; this only adds the printed preview.)

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/engine.test.ts -t previewAll`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/manual/engine.ts test/manual/cli.ts test/manual/__tests__/engine.test.ts
git commit -m "feat(manual-test): clean --all prints pre-deletion preview on shared DB (#93)"
```

---

## Task 9: CLI startup DB-name log

**Files:**

- Modify: `test/manual/cli.ts` (log resolved DB name after `resolveDbSafety`)

- [ ] **Step 1: Change `resolveDbSafety` call to capture + log the DB name**

In `cli.ts`, the line `resolveDbSafety(uri, parsed.flags);` (~line 189) discards the return. Replace with:

```typescript
const { dbName } = resolveDbSafety(uri, parsed.flags);
process.stderr.write(`▶ manual-test DB: ${dbName}\n`);
```

(`stderr` so it never pollutes `--json` stdout.)

- [ ] **Step 2: Verify existing cli tests still pass**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run test/manual/__tests__/cli.test.ts`
Expected: PASS (the change is in `main()`, not in the unit-tested `resolveDbSafety`/`parseArgs`).

- [ ] **Step 3: Commit**

```bash
git add test/manual/cli.ts
git commit -m "feat(manual-test): log resolved DB name on CLI startup (#93)"
```

---

## Task 10: `setup-worktree.js` — stop cloning, share URI, extract `rewriteWorktreeEnv`

**Files:**

- Modify: `scripts/setup-worktree.js`
- Test: `scripts/__tests__/setup-worktree.test.ts` (new) — or `test/manual/__tests__/setup-worktree.test.ts` if `scripts/__tests__` doesn't fit vitest config

First confirm the vitest include globs so the new test is picked up:

- [ ] **Step 0: Check vitest test discovery**

Run: `grep -n "include\|test:" vitest.config.* 2>/dev/null; cat vitest.config.ts 2>/dev/null | head -40`
If `scripts/**` is not in the include globs, place the test at `test/manual/__tests__/setup-worktree.test.ts` and import via a relative path (`../../../scripts/setup-worktree.js`). Use whichever location vitest already covers.

- [ ] **Step 1: Write the failing test**

Create the test (path per Step 0). It imports the soon-to-be-exported pure helper:

```typescript
import { describe, it, expect } from 'vitest';
import { rewriteWorktreeEnv } from '../../../scripts/setup-worktree.js';

describe('rewriteWorktreeEnv', () => {
  const main = [
    'MONGODB_URI=mongodb://localhost:27017/weekly-eats-dev',
    'NEXTAUTH_URL=http://localhost:3000',
    'NEXTAUTH_SECRET=abc',
  ].join('\n');

  it('preserves the MONGODB_URI line verbatim (no DB-name rewrite)', () => {
    const out = rewriteWorktreeEnv(main, { port: 3456 });
    expect(out).toContain('MONGODB_URI=mongodb://localhost:27017/weekly-eats-dev');
  });

  it('rewrites NEXTAUTH_URL port and sets PORT', () => {
    const out = rewriteWorktreeEnv(main, { port: 3456 });
    expect(out).toContain('NEXTAUTH_URL=http://localhost:3456');
    expect(out).toMatch(/^PORT=3456$/m);
  });

  it('does not duplicate PORT when one already exists', () => {
    const out = rewriteWorktreeEnv(main + '\nPORT=9999', { port: 3456 });
    expect(out.match(/^PORT=/gm)?.length).toBe(1);
    expect(out).toMatch(/^PORT=3456$/m);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run <test-path>`
Expected: FAIL — `rewriteWorktreeEnv` is not exported (module currently runs side-effects at import).

- [ ] **Step 3: Refactor `setup-worktree.js`**

Make these edits to `scripts/setup-worktree.js`:

1. Remove the `import { MongoClient } from 'mongodb';` line.
2. Delete the `cloneDatabase(...)` function and the `stripSeedTags(...)` function entirely.
3. Replace `generateEnvLocal` so the env rewrite is a pure exported helper with **no `MONGODB_URI` rewrite**:

```javascript
/**
 * Pure env-rewrite: keep MONGODB_URI verbatim (shared DB), rewrite only the
 * NEXTAUTH_URL port and PORT. Exported for unit testing.
 */
export function rewriteWorktreeEnv(content, { port }) {
  let env = content;
  env = env.replace(/NEXTAUTH_URL=http:\/\/localhost:\d+/, 'NEXTAUTH_URL=http://localhost:' + port);
  env = env.replace(/^PORT=.*\n?/m, '');
  env = env.trimEnd() + '\nPORT=' + port + '\n';
  return env;
}

function generateEnvLocal(mainWorktreePath, branchName) {
  const mainEnvPath = resolve(mainWorktreePath, '.env.local');
  if (!existsSync(mainEnvPath)) {
    console.error('Error: Main worktree .env.local not found at ' + mainEnvPath);
    console.error('The main repo must have a .env.local for worktree setup.');
    process.exit(1);
  }
  const port = portFromBranchName(branchName);
  const envContent = rewriteWorktreeEnv(readFileSync(mainEnvPath, 'utf8'), { port });
  writeFileSync(resolve(projectRoot, '.env.local'), envContent);
  console.log(
    'Generated .env.local: port=' + port + ' (shared DB — MONGODB_URI inherited from main)'
  );
  return { port };
}
```

4. In the worktree branch of the main block, remove the `cloneDatabase(...)`, `stripSeedTags(...)`, and the URI-reading code that fed them. The worktree path becomes:

```javascript
await (async () => {
  console.log("Worktree detected: branch '" + context.branchName + "'");
  generateEnvLocal(context.mainWorktreePath, context.branchName);
  runSetupDb();
  console.log('Worktree setup complete (shared DB).');
})();
```

You may drop the `async` IIFE and `await` if nothing async remains; keeping it is harmless. `sanitizeBranchName` is now unused here — remove it if no other code references it (grep first).

5. **Entrypoint guard:** wrap the top-level side-effect block (the `const context = detectWorktreeContext(); if (!context.isWorktree) {...} else {...}`) so it only runs when the file is executed directly, matching the `cli.ts:317` pattern:

```javascript
if (import.meta.url === `file://${process.argv[1]}`) {
  const context = detectWorktreeContext();
  if (!context.isWorktree) {
    runSetupDb();
  } else {
    // ... worktree branch above ...
  }
}
```

This makes `import`-ing the module in a test run nothing.

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run <test-path>`
Expected: PASS (3 cases).

- [ ] **Step 5: Lint the script (ESM/no-unused)**

Run: `npx eslint scripts/setup-worktree.js`
Expected: clean (no unused `MongoClient`, `sanitizeBranchName`, `mkdtempSync`, etc. — remove any now-unused imports the linter flags).

- [ ] **Step 6: Commit**

```bash
git add scripts/setup-worktree.js <test-path>
git commit -m "feat(worktree): share dev DB — stop cloning, extract pure rewriteWorktreeEnv (#93)"
```

---

## Task 11: `worktree-remove.js` — stop dropping the DB, purge by branch instead

**Files:**

- Modify: `scripts/worktree-remove.js`

This script is invoked by humans/tooling, not unit-tested (it shells out to git). Changes are a deletion + a substitution; verify by reading the diff and a dry manual check.

- [ ] **Step 1: Remove the DB-drop block, add the branch purge**

In `scripts/worktree-remove.js`:

1. Delete the entire `mongosh dropDatabase` block (the `hasMongosh` check + `spawnSync('mongosh', ... dropDatabase ...)`).
2. Before the `git worktree remove` call, add a best-effort tagged-data purge that never drops a DB:

```javascript
// Best-effort: purge this branch's seeded data from the SHARED dev DB before
// removing the worktree. Never drops a database. Safe if it fails (orphan sweep
// is the backstop). Run from the worktree dir so .env.local resolves.
console.log("Purging seeded data for branch '" + branchName + "' (shared DB)...");
const purge = spawnSync(
  'npx',
  ['tsx', 'test/manual/cli.ts', 'clean', '--manifest-id', branchName],
  { cwd: worktreePath, encoding: 'utf8', stdio: 'inherit', shell: process.platform === 'win32' }
);
if (purge.status !== 0) {
  console.warn("Warning: could not purge seeded data for '" + branchName + "'.");
  console.warn('Seeded data is shared — run `npm run test:manual:clean --orphans` later to sweep.');
}
```

3. Update the script's top doc comment: it no longer drops a database; it purges the branch's seeded tags from the shared DB.

> `branchName` here is the raw arg (not `safeName`) so it matches the `_seedManifestId` branch component. The worktree dir may already be gone if invoked post-removal by external tooling; the `spawnSync` failing is handled gracefully.

- [ ] **Step 2: Smoke-check the script parses + usage works**

Run: `node scripts/worktree-remove.js`
Expected: prints the usage/error message (no branch arg) and exits non-zero — confirms no syntax error and the `mongosh` import/use is gone.

- [ ] **Step 3: Lint**

Run: `npx eslint scripts/worktree-remove.js`
Expected: clean (remove any now-unused `spawnSync`/`whichCmd` references only if truly unused — `spawnSync` is still used by the purge).

- [ ] **Step 4: Commit**

```bash
git add scripts/worktree-remove.js
git commit -m "feat(worktree): remove DB drop; purge branch tags from shared DB on remove (#93)"
```

---

## Task 12: `dev-server.js` startup DB-name log

**Files:**

- Modify: `scripts/dev-server.js`

- [ ] **Step 1: Log the DB name parsed from `.env.local`**

In `scripts/dev-server.js`, the block that reads `.env.local` for `PORT` (~lines 36-43) already has `envContent`. After the `port` is resolved, parse + log the DB name. Replace the `console.log('Starting dev server on port ' + port + '...');` line region with:

```javascript
let dbName = 'unknown';
if (existsSync(envPath)) {
  const uriMatch = readFileSync(envPath, 'utf8').match(/^MONGODB_URI=.*\/([^/\s?]+)(\?|$)/m);
  if (uriMatch) dbName = uriMatch[1];
}

console.log('Starting dev server on port ' + port + ' (DB: ' + dbName + ')...');
```

(Reuse the already-read `envContent` if you prefer one read; either is fine.)

- [ ] **Step 2: Smoke-check**

Run: `node -e "import('./scripts/dev-server.js')"` is not ideal (it spawns Next). Instead just confirm syntax: `node --check scripts/dev-server.js`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/dev-server.js
git commit -m "feat(dev): log resolved DB name on dev-server startup (#93)"
```

---

## Task 13: Docs — CLAUDE.md, docs/setup.md, SKILL.md, pr-comment-template.md

**Files:**

- Modify: `CLAUDE.md`, `docs/setup.md`, `.claude/skills/manual-testing/SKILL.md`, `.claude/skills/manual-testing/pr-comment-template.md`

- [ ] **Step 1: `docs/setup.md`** — change the `MONGODB_URI` example at line 20 from `mongodb://localhost:27017/weekly-eats` to `mongodb://localhost:27017/weekly-eats-dev`. Also update the worktree "Database" row (~line 197) and the worktree-remove description (~line 188, "Drops the MongoDB database") to reflect the shared DB + branch-tag purge (no DB drop).

- [ ] **Step 2: `CLAUDE.md`** — in "How Isolation Works" table, change the Database row for "Each new worktree" to `shared (same as main — weekly-eats-dev)`. Remove the two gotchas about `mongodump`/`mongorestore` + Windows DB-clone fallback. Update the worktree-remove bullet under "Commands" (no longer drops a DB; purges branch tags from the shared DB).

- [ ] **Step 3: `.claude/skills/manual-testing/SKILL.md`** — in "Hard Boundaries", extend the no-`dropDatabase` rule to "...and never drop the shared dev DB". In the CLI quick reference, add `status --all`, `clean --orphans [--yes]`, and `clean --manifest-id <branch>`. Add a note that `clean --all` now spans every branch (still `--yes`-gated, prints a preview).

- [ ] **Step 4: `.claude/skills/manual-testing/pr-comment-template.md`** — add a line stating the branch/manifestId the seeded data belongs to, and that seeded docs are name-stamped `[<branch-prefix>]` so testers know which rows are theirs on the shared DB.

- [ ] **Step 5: Verify no stale references remain**

Run: `grep -rn "mongodump\|mongorestore\|weekly-eats-<branch>\|cloned from main\|dropDatabase" CLAUDE.md docs/setup.md .claude/skills/manual-testing/`
Expected: no hits that describe the OLD clone/drop behavior (matches inside this plan or the spec are fine). Fix any that remain.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/setup.md .claude/skills/manual-testing/
git commit -m "docs: shared dev DB + new manual-test cleanup commands (#93, #92)"
```

---

## Task 14: Full validation

- [ ] **Step 1: Regenerate CATALOG and confirm it's current**

Run: `npm run test:manual:gen-catalog && npm run test:manual:gen-catalog -- --check`
Expected: second command exits 0 (no drift). Commit if the first regenerated it.

- [ ] **Step 2: Run the full check**

Run: `npm run check`
Expected: lint + test:coverage + build all pass. Investigate any failure with the specific test in verbose mode (`npx vitest run <path>`); do not stash/checkout other commits.

- [ ] **Step 3: Final commit (if CATALOG regenerated or any fixup)**

```bash
git add -A
git commit -m "chore: regenerate CATALOG + final validation for shared-dev-DB (#93, #92)"
```

---

## Verification (end-to-end, manual)

After the suite is green, verify the real behavior against a local Mongo (`weekly-eats-dev`):

1. **Shared DB:** in a worktree, `cat .env.local | grep MONGODB_URI` → shows `weekly-eats-dev` (same as main), not `weekly-eats-<branch>`. `npm run dev` startup log shows `(DB: weekly-eats-dev)`.
2. **Stamp + status:** `npm run test:manual:apply <branch>` then `npm run test:manual:status -- --all` → lists this branch's manifestId with per-collection counts; seeded recipe titles read `Manual Test Recipe [<branch-prefix>] N`.
3. **Orphan sweep dry-run:** `npm run test:manual:clean -- --orphans` → reports untracked / stale-branch / legacy counts, deletes nothing. Add `--yes` to delete.
4. **Branch purge:** `npm run test:manual:clean -- --manifest-id <branch>` → removes all of that branch's seeded docs + state; a sibling branch's data is untouched.
5. **Worktree remove:** `node scripts/worktree-remove.js <branch>` → prints the purge step, removes the worktree, and never drops a database (confirm `weekly-eats-dev` still has other branches' data via `status --all`).
