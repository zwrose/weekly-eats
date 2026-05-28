# Manual Testing Skill — Design (v2)

**Date:** 2026-05-26
**Branch:** `manual-testing-skill`
**Status:** Revised after multi-angle review → ready for implementation
**Reference:** Adapted from [loupe-app/loupe `.claude/skills/manual-testing/SKILL.md`](https://github.com/loupe-app/loupe/blob/main/.claude/skills/manual-testing/SKILL.md)

## Goal

Add a `/manual-testing` skill plus the scenario engine it drives. The skill analyzes a PR diff, seeds appropriate test data into the worktree's MongoDB, generates a checkbox test plan, and posts it as a PR comment. Re-runs are idempotent.

The end state replaces the existing `scripts/seed-food-items.cjs` and `scripts/seed-demo-data.cjs` with a checked-in `demo.json` manifest applied via the same engine — one seeding system, not two.

## Non-goals

- Driving Chrome to execute the plan. The skill stops at "plan ready"; execution is delegated to the existing `/verify` skill or a human.
- Replacing automated tests. Manual testing covers things automated tests don't: visual rendering, real interaction flows, edge cases that need a real DB and a real browser.
- Generic seed framework. The engine is purpose-built for this app's MongoDB collections and user-scoped data model.
- Backfilling `excludeSeeded()` filters across every API route. This is captured as future work — the worktree DB isolation is the primary defense; field-level filters are defense-in-depth.

## Architecture

### File layout

```
test/manual/
  scenarios/
    CATALOG.md              AUTO-GENERATED. Do not edit; run `npm run test:manual:gen-catalog`.
    registry.ts             block name -> module map; source of truth
    user-baseline.ts        one file per block; exports default Block<Config, State>
    food-items.ts
    recipes.ts
    meal-plan-template.ts   NEW (was missing from v1)
    meal-plan.ts
    pantry.ts
    stores.ts
    shopping-list.ts
    purchase-history.ts
    pending-approval-user.ts
    __tests__/
      <one .test.ts per block>
  manifests/
    demo.json               replaces scripts/seed-demo-data.cjs
    feat%2Fmeal-editor.json PR-specific; sanitized branch name
    feat%2Fmeal-editor.admin-flow.json optional named slot
  plans/                    LOCAL ONLY (gitignored); fallback when no PR exists
    .gitkeep
  __tests__/
    engine.test.ts          unit tests for diff/hash/dependency-resolution/transitive-dirty
    cli.test.ts             argv parsing, exit codes, --json output, safety gates
    registry.test.ts        registry vs files; CATALOG drift; block shape conformance
    catalog-gen.test.ts     auto-generation produces stable output
    diff-equivalence.test.ts proves new seed engine produces structurally equivalent docs to legacy scripts (when both run against scratch DB)
  engine.ts                 apply() / clean() / status() / unlock()
  cli.ts                    `tsx test/manual/cli.ts <cmd> ...`
  types.ts                  Manifest, Block, BlockContext, BlockState, CliResult
  pr-comment.ts             `gh` CLI wrapper: find-by-marker, post or edit
  hash.ts                   stable config hashing (sorted keys, recursive)
  manifest-io.ts            load/save manifest files; branch sanitization; validate
  catalog-gen.ts            generates CATALOG.md from block `documentation` fields
  lock.ts                   advisory lock using dedicated `manualTestLocks` collection
  validate-args.ts          argv-based shell-safe argument parsing + allowlist regex
  diff-tools.ts             collection-to-JSON export for equivalence checks (replaces mongodump binary diff)

vitest.workspace.ts          NEW: splits app tests (jsdom) from engine tests (node)
vitest.config.ts             unchanged (app tests; loaded via workspace)
vitest.manual.config.ts      NEW (engine tests; node env; no MUI mocks, no MSW)

scripts/
  seed-food-items.cjs       SHIM (one release): prints "Moved to `npm run seed:demo`"; exits 1
  seed-demo-data.cjs        SHIM (one release): prints "Moved to `npm run seed:demo`"; exits 1
  setup-worktree.js         UPDATED: strips `_seed*` fields from cloned DB
  setup-database.js         UPDATED: also creates `manualTestState` + `manualTestLocks` indexes

src/lib/database-indexes.ts UPDATED: adds `{_seedManifestId:1,_seedScenarioId:1}` index per seeded collection

.claude/skills/manual-testing/
  SKILL.md
  pr-comment-template.md    template referenced from SKILL.md to keep SKILL.md lean
```

### npm scripts (added to `package.json`)

```jsonc
{
  "test:manual": "tsx test/manual/cli.ts",
  "test:manual:apply": "tsx test/manual/cli.ts apply",
  "test:manual:clean": "tsx test/manual/cli.ts clean",
  "test:manual:status": "tsx test/manual/cli.ts status",
  "test:manual:gen-catalog": "tsx test/manual/cli.ts gen-catalog",
  "test:manual:unlock": "tsx test/manual/cli.ts unlock",
  "seed:demo": "tsx test/manual/cli.ts apply --manifest demo",
}
```

Naming rationale: `test:manual:*` matches the directory name (`test/manual/`) and the loupe convention. `seed:demo` provides the muscle-memory-friendly alias. We deliberately do not rename to `seed:*` for the engine commands — the `test:manual:*` namespace makes the dev-tooling/test-data nature explicit and avoids conflation with future production seeding needs.

### Dependencies

| Package | Where           | Pinning                     | Notes                                                                                                                                                                                                                                                   |
| ------- | --------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsx`   | devDependencies | exact pin (e.g. `"4.19.2"`) | Runs TS without a build step. Install with `--ignore-scripts` is recommended but cannot be enforced via npm config; the install script of `tsx` (esbuild postinstall) is acceptable since the project already trusts esbuild via Vitest's react plugin. |
| `zod`   | devDependencies | exact pin (e.g. `"3.23.8"`) | Config validation per block. ~12KB; standard in TS ecosystems.                                                                                                                                                                                          |

Both are devDependencies — the engine is dev-only tooling and never ships to production builds.

### Vitest workspace split

`vitest.workspace.ts` (new):

```ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  './vitest.config.ts', // app tests: jsdom, MUI mocks, MSW
  './vitest.manual.config.ts', // engine tests: node, no setup files
]);
```

`vitest.manual.config.ts` (new):

```ts
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
    setupFiles: [], // explicit: no jsdom polyfills, no MUI mocks, no MSW
  },
});
```

This avoids:

- `IS_REACT_ACT_ENVIRONMENT` polluting engine tests
- MUI transition mocks (`Collapse`, `Fade`, etc.) attempting to mock when no React tree exists
- MSW intercepting `fetch` calls from the engine's `gh` wrapper
- `singleFork: true` sharing one fork between jsdom and node tests (workspace gives each its own pool)

Coverage `include` in `vitest.config.ts` stays as `src/**/*.{ts,tsx}` — engine code is dev-only and shouldn't count against app coverage. The `test/manual/` engine has its own coverage profile in `vitest.manual.config.ts` but it doesn't affect `npm run check` thresholds.

### ESLint

`test/manual/**/*` is covered by the project's root TypeScript ESLint rules. Test files inside `test/manual/**/__tests__/**` automatically get the relaxed rules (existing glob `**/__tests__/**/*.{ts,tsx}`). The non-test engine files (`engine.ts`, `cli.ts`, etc.) follow strict rules — including `@typescript-eslint/no-explicit-any: error` — which is what we want.

## Manifest schema

```jsonc
{
  "schemaVersion": 1,
  "branch": "feat/meal-editor",
  "slot": "default",
  "createdAt": "2026-05-26T12:00:00.000Z",
  "updatedAt": "2026-05-26T12:00:00.000Z",
  "scenarios": [
    { "id": "u", "block": "user-baseline" },
    {
      "id": "fi",
      "block": "food-items",
      "config": { "ensure": ["apple", "bread", "chicken"] },
      "dependsOn": ["u"],
    },
    {
      "id": "r",
      "block": "recipes",
      "config": { "count": 5, "isGlobal": false, "foodItemsRef": "fi" },
      "dependsOn": ["u", "fi"],
    },
    {
      "id": "t",
      "block": "meal-plan-template",
      "config": {
        "startDay": "monday",
        "meals": { "breakfast": true, "lunch": true, "dinner": true, "staples": true },
      },
      "dependsOn": ["u"],
    },
    {
      "id": "mp",
      "block": "meal-plan",
      "config": { "weeksOut": 0, "slotsFilled": 12, "recipesRef": "r", "templateRef": "t" },
      "dependsOn": ["u", "r", "t"],
    },
  ],
  "stepMappings": [
    { "step": "Open this week's meal plan", "scenarioIds": ["mp"], "notes": "/meal-plans" },
    { "step": "Swap a recipe in slot 3", "scenarioIds": ["mp", "r"] },
  ],
}
```

**Field rules:**

- `schemaVersion`: required. v1 = current shape. Engine refuses to load unknown versions.
- `branch`: required. Sanitized in the filename (`/` → `%2F`) but stored unsanitized in JSON. Engine validates branch field matches filename on load and errors if not.
- `slot`: defaults to `"default"`. Lets a single PR have multiple independent plans. Allowlist regex `^[a-zA-Z0-9._-]+$`.
- `scenarios[].id`: required, manifest-unique. Used by `dependsOn` and `*Ref` config fields. Regex `^[a-zA-Z0-9_-]+$`.
- `scenarios[].block`: required, must match a key in `registry.ts`.
- `scenarios[].config`: opaque to the engine; validated per-block via Zod.
- `scenarios[].dependsOn`: optional array of scenario IDs that must apply first. Topologically sorted by the engine; cycles error out.
- `stepMappings`: optional. Maps test plan steps to backing scenarios; drives the "Setup applied" section of the PR comment.

**Sanitization** (security — see "Safety gates" below):

- Branch allowlist regex: `^[a-zA-Z0-9._/-]{1,200}$`
- Slot allowlist regex: `^[a-zA-Z0-9._-]{1,64}$`
- Neither may contain the substrings `-->` or `<!--` (defense against HTML marker injection)
- Engine rejects manifests with mismatched branch field vs. filename

**Manifest filename**: `<sanitized-branch>[.<slot>].json`. Slot omitted in filename when slot is `default`. Examples:

- `feat%2Fmeal-editor.json` → branch `feat/meal-editor`, slot `default`
- `feat%2Fmeal-editor.admin-flow.json` → branch `feat/meal-editor`, slot `admin-flow`

**Validation**: the engine validates manifest shape with Zod before applying. Bad manifests fail with a precise error pointing at the offending field (see "Failure message format" below).

## Block interface

```ts
// test/manual/types.ts

export interface BlockContext {
  db: Db; // mongodb Db handle
  manifestId: string; // `<branch>::<slot>`
  scenarioId: string; // e.g. "mp"
  resolve: <T = unknown>(id: string) => T; // result of a dependency block; only declared deps allowed
}

export interface BlockApplyResult<State = unknown> {
  state: State; // returned to dependents via ctx.resolve
  docCount: number; // how many docs this scenario tagged
  summary: string; // one-line human description (for PR comment; ≤120 chars, ASCII-safe)
}

export interface BlockDocumentation {
  description: string; // one-paragraph human description
  configExamples: Array<{ label: string; config: unknown }>;
  dependencies: string[]; // block names this commonly depends on (advisory)
  collectionsWritten: string[]; // EXACT list of collections this block inserts into
}

export interface Block<Config = unknown, State = unknown> {
  name: string;
  documentation: BlockDocumentation; // used to auto-generate CATALOG.md
  validate(config: unknown): Config; // throws on bad config (Zod schema)
  apply(config: Config, ctx: BlockContext): Promise<BlockApplyResult<State>>;
  clean(ctx: BlockContext): Promise<{ docCount: number }>;
  status(ctx: BlockContext): Promise<{
    present: boolean; // any tagged docs found?
    docCount: number;
    configHashMatches: boolean; // matches last-applied?
  }>;
}
```

Why `collectionsWritten` is machine-readable: `clean --all` and `setup-worktree.js`'s `_seed*`-stripping logic both need to know every collection that might carry `_seed*` tags. Sourcing this from each block (instead of a hand-maintained list) eliminates drift.

Why `documentation` is machine-readable: it drives `catalog-gen.ts`, which emits `CATALOG.md`. The `test/manual/__tests__/catalog-gen.test.ts` snapshot-tests the output. The `npm run check` pipeline runs `npm run test:manual:gen-catalog --check`, which fails if the generated output differs from the checked-in `CATALOG.md`. This prevents CATALOG drift entirely.

### Tag-based idempotency

Every document a block inserts gets two fields:

- `_seedManifestId: "feat/meal-editor::default"`
- `_seedScenarioId: "mp"`

`apply()` per scenario is diff-aware:

1. Compute stable hash of `config` (sorted-key JSON, SHA-256, prefixed `"sha256:"`).
2. Look up `manualTestState` doc for `(manifestId, scenarioId)`.
3. **Determine dirtiness** (see "Transitive dirty propagation" below).
4. If clean (hash matches, docs present, no transitive dirt from deps) → return cached state.
5. Otherwise → call `clean()` (this scenario only; engine handles dependents separately), then re-create.

`clean()` is `deleteMany({ _seedManifestId, _seedScenarioId })` across every collection in `documentation.collectionsWritten`. Dependencies cleaned in **reverse topological order** (dependents first, then dependencies).

### Transitive dirty propagation

The naïve "per-scenario hash check" misses a critical case: if scenario A is re-applied (new ObjectIds), scenario B's references to A's IDs become stale even though B's own config didn't change. To fix:

**Algorithm** (in `engine.ts`):

1. Compute dirty set: scenarios whose config hash changed OR whose tagged docs are missing OR are explicitly forced by `--force <id>`.
2. Transitively add dependents: for each dirty scenario, BFS forward through `dependsOn` reverse-edges and add any dependent to the dirty set.
3. Compute clean order: reverse-topo over the dirty set.
4. Run cleans in clean order.
5. Run applies for the dirty set in topo order; non-dirty scenarios are skipped (return their cached state from `manualTestState`).

This guarantees that when A is dirty, B (which depends on A) is also re-applied, so references stay valid.

### `manualTestState` collection

One doc per `(manifestId, scenarioId)`:

```ts
{
  _id: ObjectId,
  manifestId: "feat/meal-editor::default",
  scenarioId: "mp",
  blockName: "meal-plan",
  configHash: "sha256:abc...",
  state: { mealPlanId: "...", slotCount: 12 },
  lastAppliedAt: Date,
  lastConfigJson: "...",
}
```

Indexed on `{ manifestId: 1, scenarioId: 1 }` unique. The engine creates this index on startup via `createIndex` (idempotent).

### `manualTestLocks` collection (dedicated, separate from state)

The advisory lock lives in its own collection to avoid colliding with scenario state docs and to get a proper TTL index without entangling state document lifecycles.

```ts
{
  _id: ObjectId,
  manifestId: "feat/meal-editor::default",   // unique
  acquiredAt: Date,
  expireAt: Date,                            // TTL anchor: acquiredAt + 5 minutes
  pid: number,                               // for diagnostics
  hostname: string,
  cliInvocation: string,                     // e.g. "apply feat/meal-editor"
}
```

Indexes:

- `{ manifestId: 1 }` unique → enforces single-lock-per-manifest
- `{ expireAt: 1 }` with `expireAfterSeconds: 0` → Mongo's TTL monitor removes the doc after `expireAt` passes (sweeps every ~60 seconds)

Lock acquisition: `insertOne({manifestId, acquiredAt, expireAt: acquiredAt+300s, pid, hostname, cliInvocation})`. Duplicate-key error = held by someone else.

Lock release: `deleteOne({manifestId})` on success or failure exit. The lock is released on every code path, including caught exceptions (via try/finally).

Stale lock recovery:

- TTL-based: after 5 minutes the Mongo TTL monitor reaps the doc automatically (within ~60s of expiry).
- Manual: `npm run test:manual:unlock <branch> [slot]` deletes the lock doc immediately. Prints lock metadata (PID, hostname, acquiredAt, cliInvocation) before deleting.
- The "another apply is in progress" error message includes the lock metadata AND the unlock command.

### `ctx.resolve(id)` semantics

A block can reference a sibling scenario's result via `ctx.resolve("r")`. The engine guarantees:

- `id` is in the calling block's declared `dependsOn` (throws if not — prevents accidental coupling)
- The dependency has been freshly applied (or freshly verified clean+cached) in this same `apply` invocation — never returns stale state from a prior crashed run
- Returns the `state` field from the in-memory results map for this run (NOT `manualTestState`)

This eliminates the cross-run stale-state risk: `ctx.resolve` is a memory-only lookup populated as the run progresses.

### Auth gate via `user-baseline`

`user-baseline` is the only block that doesn't insert anything. It:

1. Determines target user via this precedence:
   - `config.email` if set
   - `MANUAL_TEST_USER_EMAIL` env var if set
   - If exactly one user exists in the DB → use that one
   - Otherwise → error with the full list of user emails and instructions to set the config or env var
2. Verifies the chosen user has the fields a Google-OAuth session would have populated (`email`, `name`, `isApproved: true`). Throws a precise error if not.
3. Returns `state: { userId, email, name }`.
4. `clean()` is a no-op for docs; removes the `manualTestState` entry only.
5. `status()`: returns `present: true` if the user still exists with the same email; `configHashMatches: true` always (config is `{}` or an email reference). Drift is signaled via `present: false` if the user was deleted.

All blocks that need a user declare `dependsOn: ["<id-of-user-baseline-scenario>"]` and pull `userId` from `ctx.resolve(...)`.

### Failure semantics

- A block's `validate` throwing aborts before any DB write. Exit code 1.
- A block's `apply` throwing aborts the run. Already-applied scenarios remain. Lock is released. Exit code 2.
- A block's `clean` throwing during a re-apply aborts. The scenario is marked failed in `manualTestState` (new field `lastApplyError`). Lock released. Exit code 2.
- On the next `apply`, the engine detects scenarios with `lastApplyError` OR missing tagged docs OR hash mismatch, includes them in the dirty set, attempts clean+apply again.

### Crash recovery

If the engine crashes (process killed, OOM, segfault):

- Lock doc remains until TTL expiry (5 min) or manual `unlock`.
- Partially-applied scenarios have their tagged docs in the DB but may not have `manualTestState` entries (if the crash happened between insertMany and state write). On next apply, the engine detects "tagged docs present but no state entry" and treats the scenario as dirty (clean + re-create).
- The order in each block's `apply` must be: insert docs first, then write state. This ensures crash mid-apply leaves a recoverable state, not orphaned `manualTestState` entries pointing at nonexistent docs.

## Initial catalog (v1: 10 blocks)

Detailed specs live in the auto-generated `test/manual/scenarios/CATALOG.md`; this table is the source-of-truth contract.

| Block                   | Config (Zod)                                                                                                         | State output                                                | Deps                                                        | `collectionsWritten`                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| `user-baseline`         | `{ email?: string }`                                                                                                 | `{ userId: string, email: string, name: string }`           | —                                                           | none (read-only)                                    |
| `food-items`            | `{ ensure?: string[]; globalCount?: number; userCount?: number; isApproved?: boolean }` (default `isApproved: true`) | `{ foodItemIds: Record<string, ObjectId> }` (keyed by name) | `user-baseline`                                             | `foodItems`                                         |
| `recipes`               | `{ count: number; isGlobal: boolean; withUserData?: boolean; foodItemsRef?: string }`                                | `{ recipeIds: ObjectId[] }`                                 | `user-baseline`, optionally `food-items`                    | `recipes`, `recipeUserData` (if `withUserData`)     |
| `meal-plan-template`    | `{ startDay: DayOfWeek; meals: { breakfast,lunch,dinner,staples: boolean }; weeklyStaples?: MealItem[] }`            | `{ templateId: ObjectId }`                                  | `user-baseline`                                             | `mealPlanTemplates`                                 |
| `meal-plan`             | `{ weeksOut: number; slotsFilled: number; recipesRef?: string; templateRef: string }`                                | `{ mealPlanId: ObjectId; slotCount: number }`               | `user-baseline`, `meal-plan-template`, optionally `recipes` | `mealPlans`                                         |
| `pantry`                | `{ count: number; foodItemsRef?: string }`                                                                           | `{ pantryItemIds: ObjectId[] }`                             | `user-baseline`, `food-items`                               | `pantry`                                            |
| `stores`                | `{ count: number; withPositions?: boolean; foodItemsRef?: string }`                                                  | `{ storeIds: ObjectId[]; positionsPerStore: number }`       | `user-baseline`, optionally `food-items`                    | `stores`, `storeItemPositions` (if `withPositions`) |
| `shopping-list`         | `{ state: 'empty' \| 'partial' \| 'all-checked'; itemCount: number; storeRef: string; foodItemsRef?: string }`       | `{ shoppingListId: ObjectId; itemCount: number }`           | `user-baseline`, `stores`, `food-items`                     | `shoppingLists`                                     |
| `purchase-history`      | `{ count: number; daysBack?: number; foodItemsRef?: string; storeRef?: string }`                                     | `{ purchaseIds: ObjectId[] }`                               | `user-baseline`, `food-items`, `stores`                     | `purchaseHistory`                                   |
| `pending-approval-user` | `{ name?: string }` (email is always auto-generated as `manual-test+<random>@manual-test.invalid`)                   | `{ pendingUserId: ObjectId; email: string }`                | —                                                           | `users`                                             |

**Schema-fidelity corrections** (against `src/types/*.ts` and actual seed scripts):

- `food-items`: writes `isApproved: true` and `createdBy: <signed-in userId>` (matches `seed-food-items.cjs:411-413`). For global items, `createdBy` is set to the signed-in user — this is consistent with how the legacy script worked.
- `meal-plan`: requires `templateRef` because `MealPlan.templateId` is non-optional (`src/types/meal-plan.ts:51`). The block also writes `templateSnapshot` derived from the resolved template's `startDay` + `meals`.
- `pantry`: dropped `withExpired` and `withRunningLow` from v1 — `PantryItem` (`src/types/pantry.ts:1-7`) only stores `foodItemId`, `userId`, `createdAt`, `updatedAt`. Re-add when the schema gains those fields.
- `shopping-list`: `state` is a seed pattern (controls which `items[i].checked` values are set), NOT a stored field. `ShoppingList` (`src/types/shopping-list.ts:27-34`) has no top-level state. States map: `empty` → no items, `partial` → half checked, `all-checked` → all checked.
- `pending-approval-user`: email is force-generated with `@manual-test.invalid` suffix. This domain is RFC 2606 reserved, will never resolve to a real address, and is visually distinct in any admin UI that lists pending users.

**Each block's TS file shape**:

```ts
import { z } from 'zod';
import type { Block, BlockDocumentation } from '../types.js';

const ConfigSchema = z.object({
  /* ... */
});
type Config = z.infer<typeof ConfigSchema>;
type State = {
  /* ... */
};

const documentation: BlockDocumentation = {
  description: 'Seeds N user recipes with ingredients drawn from a food-items dep.',
  configExamples: [
    { label: '5 user recipes', config: { count: 5, isGlobal: false } },
    { label: '3 global recipes', config: { count: 3, isGlobal: true } },
  ],
  dependencies: ['user-baseline', 'food-items'],
  collectionsWritten: ['recipes', 'recipeUserData'],
};

const block: Block<Config, State> = {
  name: 'recipes',
  documentation,
  validate(config) {
    return ConfigSchema.parse(config);
  },
  async apply(config, ctx) {
    /* idempotent insert with _seed* tags */
  },
  async clean(ctx) {
    /* deleteMany on each collectionsWritten */
  },
  async status(ctx) {
    /* count tagged docs */
  },
};

export default block;
```

## CLI

`tsx test/manual/cli.ts <command> [args] [flags]`

### Commands

```
apply [target] [slot]                  Apply manifest. Idempotent.
clean [target] [slot]                  Remove tagged docs for this manifest.
clean --all --yes                      Remove every doc with any _seedManifestId across all collections.
status [target] [slot]                 Report what's seeded; flag drift, failed scenarios, dirty deps.
unlock [target] [slot]                 Force-release a stale lock (prints lock metadata first).
list                                   List all manifests on disk.
gen-catalog [--check]                  Regenerate CATALOG.md from block documentation. --check = compare to checked-in, exit 1 on diff.
help [command]                         Print usage.
```

### Target resolution

`[target]` is resolved in this order:

1. If `--manifest <name>` flag is set → load `manifests/<name>.json` (or `<name>.<slot>.json`).
2. Else if `--branch <name>` flag is set → load `manifests/<sanitized-branch>[.<slot>].json`.
3. Else if positional `[target]` is the exact name of a manifest file (or `<target>.json` exists) → load it.
4. Else if positional `[target]` is a non-empty string → treat as branch name.
5. Else → use current git branch + `default` slot.

This makes `apply demo` unambiguously load `manifests/demo.json`. If a developer later creates a branch named `demo`, the manifest file still wins (because rule 3 fires first). To disambiguate, use `--branch demo`.

### Flags

| Flag                | Purpose                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `--manifest <name>` | Load `manifests/<name>.json` regardless of git branch                                                |
| `--branch <name>`   | Override git branch detection                                                                        |
| `--slot <name>`     | Override slot detection (positional [slot] is shorthand)                                             |
| `--json`            | Machine-readable output (see schema below). Used by the skill to parse results.                      |
| `--dry-run`         | Validate manifest and print plan; don't touch DB                                                     |
| `--verbose`         | Log every DB write                                                                                   |
| `--yes`             | Confirm destructive operations non-interactively (required for `clean --all`)                        |
| `--force-unlock`    | Combine with `apply`/`clean` to bypass the lock check (use only when sure no other apply is running) |
| `--allow-main-db`   | Bypass the "refuse main DB" gate (DANGEROUS — see safety gates)                                      |
| `--allow-remote`    | Bypass the "refuse non-localhost" gate (DANGEROUS — see safety gates)                                |
| `--help`            | Print usage for the current subcommand                                                               |
| `--force <id>`      | Mark scenario `<id>` as dirty even if its hash matches (forces a re-apply)                           |

### `--json` output schema (v1)

```jsonc
{
  "schemaVersion": 1,
  "ok": true,
  "command": "apply",
  "manifestId": "feat/meal-editor::default",
  "exitCode": 0,
  "scenarios": [
    {
      "id": "mp",
      "block": "meal-plan",
      "status": "applied", // "applied" | "skipped" | "failed" | "cleaned"
      "docCount": 12,
      "summary": "Active meal plan, 12 slots filled",
      "configHash": "sha256:abc...",
      "durationMs": 145,
      "error": null,
    },
  ],
  "lock": {
    "acquiredAt": "2026-05-26T12:00:01.000Z",
    "releasedAt": "2026-05-26T12:00:02.000Z",
  },
  "warnings": [],
}
```

`ok` is `true` iff `exitCode === 0`. The schema is versioned via `schemaVersion: 1` so the skill can detect mismatches.

### Failure message format

All error output (non-JSON mode) follows this template:

```
manual-test error: <category>: <details>
  at <file>:<line>:<col>  (when source-locatable)
  hint: <one-line actionable suggestion>
```

Examples:

```
manual-test error: manifest validation: scenarios[2].config.count: expected number, got "five"
  at manifests/feat%2Fmeal-editor.json:14:23
  hint: change `"count": "five"` to `"count": 5`

manual-test error: dependency: scenario "mp" depends on "r" but "r" is not in the manifest
  at manifests/feat%2Fmeal-editor.json:18:5
  hint: add a scenario with `"id": "r"` or remove "r" from "mp"'s dependsOn

manual-test error: lock: another apply is in progress
  manifest: feat/meal-editor::default
  acquired by: PID 12345 on host laptop.local at 2026-05-26T11:58:33Z
  invocation: apply feat/meal-editor
  hint: if the previous process crashed, run `npm run test:manual:unlock feat/meal-editor`

manual-test error: user-baseline: multiple users in DB; ambiguous
  found 3: alice@example.com, bob@example.com, carol@example.com
  hint: set MANUAL_TEST_USER_EMAIL=alice@example.com or add `"config": { "email": "alice@example.com" }` to the user-baseline scenario
```

### Safety gates

**Argument safety**:

- All shell invocations of `gh` and `git` use argv (`spawn`/`execFile`, NOT `exec` or template strings). No interpolation into shell strings.
- Branch and slot values are validated against allowlist regexes before any use. Rejected values fail before any subprocess is invoked.

**DB target safety** (refusal checks, in order):

1. Parse `MONGODB_URI`. Extract host and database name.
2. If `host` is not `localhost` or `127.0.0.1` AND `--allow-remote` is not set → refuse with error.
3. Extract DB name (or `weekly-eats` if URI omits it — same default as the app).
4. Allowlist regex: DB name must match `^weekly-eats(-[a-z0-9-]+)?$`. If not → refuse with error.
5. If the matched name is exactly `weekly-eats` (main DB) AND `--allow-main-db` is not set → refuse with error.

The `--allow-main-db` and `--allow-remote` flags are CLI-only — they cannot be set via env var. This makes them deliberate per-invocation choices, not persistent settings.

### `--help` and zero-arg behavior

`tsx test/manual/cli.ts` (zero args) → prints global usage, exits 1.
`tsx test/manual/cli.ts help` → same as zero args, exits 0.
`tsx test/manual/cli.ts <cmd> --help` → prints subcommand-specific usage with all flags, exits 0.
`tsx test/manual/cli.ts <cmd>` (missing required args) → prints subcommand usage + error, exits 1.

### Fallback path messaging

When no PR exists and the skill writes to `test/manual/plans/`:

```
manual-test info: no open PR found for branch `feat/meal-editor`
wrote plan to test/manual/plans/feat%2Fmeal-editor.md (gitignored — not committed)
when a PR is opened, re-run /manual-testing to post the plan as a PR comment (local file will be deleted after successful posting)
```

The local file is **deleted by the skill** after a successful PR comment post, so the two never diverge.

## Skill flow (`SKILL.md`)

### Frontmatter (CSO-compliant — triggers and symptoms only, no workflow summary)

```yaml
---
name: manual-testing
description: Use when a PR needs manual verification, when test data needs to be seeded or torn down in a worktree DB, when a tester asks "what's seeded?", when discussing manual test plans, scenario manifests, or PR test comments. Symptoms: about to write `db.collection().insertMany()` outside `test/manual/`, about to call `dropDatabase()`, about to post a second test-plan comment on a PR. Triggers: "test this manually", "set up test data", "seed scenarios", "QA this branch", "verify PR by hand", "preview test data", "what test data is seeded", "clean up test data".
---
```

### Hard Boundaries (top of skill body)

> **Violating the letter of these rules is violating the spirit.**
>
> 1. **Stop at plan ready.** This skill ends when the manifest is applied and the plan is posted. Do NOT drive Chrome, do NOT execute steps, do NOT report findings. **REQUIRED HANDOFF:** for execution, use the `verify` skill.
> 2. **No DB writes outside blocks.** Every insert/update/delete on app collections goes through a block in `test/manual/scenarios/`. No exceptions, including "just this once" for debugging.
> 3. **No `dropDatabase` ever.** Cleanup is `npm run test:manual:clean`. Period.
> 4. **No editing manifests by hand without updating `updatedAt`.** Use the engine — `npm run test:manual:apply --dry-run` will validate without applying.

### Flow

**Step 0 (BLOCKING): Read the CATALOG.**

Before doing ANYTHING else — before reading the diff, before thinking about scenarios — read `test/manual/scenarios/CATALOG.md` in full. Verify you can name every block and its config shape. If you skip this, you will invent block names that don't exist, miss blocks that would have fit, or duplicate work. **There is no shortcut.** Re-read on every invocation: blocks may have been added by parallel agents; configs drift.

**Step 1: Determine target.** Use current branch + `default` slot unless `/manual-testing <branch> [slot]` was passed. Confirm `MONGODB_URI` is set; the CLI's safety gates handle main-DB refusal.

**Step 2: Analyze the PR diff.** `gh pr diff` (or `git diff main...HEAD` if no PR exists). Identify what needs manual verification: visual rendering, interaction flows, auth/permission paths, edge cases that automated tests miss.

**Step 3: Pick scenarios.** Choose blocks + configs from the CATALOG. If no existing block fits, create one: write the module under `test/manual/scenarios/`, register in `registry.ts`, run `npm run test:manual:gen-catalog` to update the CATALOG. Do NOT write ad-hoc seed code outside a block.

**Step 4: Write/update the manifest.** Path: `test/manual/manifests/<sanitized-branch>[.<slot>].json`. If a manifest exists for this slot, MERGE — preserve unchanged scenarios, only update changed ones. Update `updatedAt`. Validate locally with `npm run test:manual:apply <branch> [slot] -- --dry-run`.

**Step 5: Run apply.** Shell out to `npm run test:manual:apply <branch> [slot] -- --json`. Parse the structured output. Report any failures with the exact block + scenario id that broke.

**Step 6: Generate the test plan.** Markdown checklist — every step is `- [ ]`. Reference scenarios by name and config so a tester knows what state to expect. Use the template at `pr-comment-template.md`.

**Step 7: Post to the PR (or fall back to local).**

- If a PR exists: `gh pr comment` with the body. Find existing comment by HTML marker `<!-- manual-testing-plan: <branch> :: <slot> -->` (search PR comments via `gh api`); edit-via-PATCH if found, post-new otherwise. The marker uses ONLY the sanitized branch + slot (allowlist-validated, no `-->` chars possible).
- If no PR: write plan to `test/manual/plans/<sanitized-branch>[.<slot>].md` (gitignored) and tell the user the exact path. On next invocation when a PR exists, the skill will post the plan and delete the local file.

**Step 8: STOP.** The plan is ready. Tell the user. Do NOT drive Chrome. Do NOT execute steps. Do NOT report bugs. If they want execution, suggest `verify` skill.

### Re-apply behavior

On later invocations with the same branch+slot: re-analyze the diff (may have new commits), update the manifest (merge — preserve unchanged scenarios), re-apply (engine handles diff + transitive dirty), edit the existing PR comment. Never posts duplicates.

### Multiple plans per PR

If invoked as `/manual-testing feat/wide-pr admin-flow`: writes a separate manifest (`feat%2Fwide-pr.admin-flow.json`), seeds independently, posts a second comment with a different marker. Each plan self-contained.

### Rationalization table (from RED testing)

| Excuse                                                                                   | Reality                                                                                                                                                       |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I'll just write a quick `db.collection().insertMany()` here"                            | Ad-hoc seed code outside the engine bypasses tagging — cleanup will leak. Always go through a block.                                                          |
| "There's no block for X, I'll just inline it"                                            | Add a new block in `test/manual/scenarios/` and re-gen CATALOG. Five-minute cost; saves hours of duplication.                                                 |
| "I'll skip reading CATALOG.md, I remember the blocks"                                    | Blocks evolve. Configs change. Read CATALOG every time.                                                                                                       |
| "I'll just `db.dropDatabase()` to clean up"                                              | Wipes manual exploration data too. Use `npm run test:manual:clean`.                                                                                           |
| "Re-apply means start fresh"                                                             | Re-apply is diff-aware + transitive-dirty-aware. Don't pre-clean.                                                                                             |
| "The user wants to test admin AND meal-editor — I'll cram both into one manifest"        | Use slots. Two manifests, two comments. Each independent.                                                                                                     |
| "There's no user, but I'll just create one in MongoDB"                                   | Won't work — NextAuth fields like `image`, `emailVerified` need real OAuth. Tell the user to sign in.                                                         |
| "Plan is ready, may as well execute it in Chrome while I'm here"                         | **STOP.** Execution is `verify`'s job. Driving Chrome here means the user can't replay your steps and the plan never gets validated as a standalone artifact. |
| "I already read CATALOG last invocation in this session"                                 | Read it again. Blocks may have been added by parallel agents; configs drift. ~200 tokens; getting it wrong wastes minutes.                                    |
| "User said 'just dump some test data' — I'll skip the manifest"                          | The manifest IS the test data. No manifest = no cleanup = next agent inherits your mess. Always write the manifest first.                                     |
| "The existing PR comment is slightly out of date but close enough — leave it"            | Edit it. A stale plan is worse than no plan; testers will follow the old steps and report fake bugs.                                                          |
| "I'll create a new block inline in the manifest just this once"                          | Manifests reference blocks; they don't define them. Inline = unregistered = unhashable = uncleanable. Make the block file.                                    |
| "The senior dev said skip the manifest for this hotfix PR"                               | The senior dev was wrong, or you're misremembering. The rules apply to hotfixes too. Tagless data = leak.                                                     |
| "I already wrote 40 lines of ad-hoc seed in a scratch file — finishing it"               | Delete the scratch. Start a block. Sunk cost is not a reason to commit a leak.                                                                                |
| "The previous PR's plan didn't use slots even with two flows — just follow that pattern" | The previous PR was wrong, or its scope didn't actually warrant two plans. Use slots when scope warrants.                                                     |
| "Running the CLI is slow — I'll just call insertMany once to unblock the tester"         | The CLI is ~200ms of `tsx` startup. The tester's time loss from a broken plan is hours.                                                                       |
| "The CATALOG is long, I'll grep for what I need"                                         | Skips block-composition awareness. You'll pick wrong blocks. Read it.                                                                                         |

### Red flags — STOP if you catch yourself

- Writing `db.collection(...).insertOne(...)` outside `test/manual/scenarios/`
- Calling `apply()` directly from JS instead of via the CLI
- Editing a manifest by hand without updating `updatedAt`
- Posting a new PR comment instead of finding and editing the existing one
- Skipping the CATALOG read
- "I'll drive Chrome myself after seeding — saves the user a round trip"
- "The PR doesn't exist yet, I'll just paste the plan into chat"
- "The block I need almost exists — I'll just tweak its config with a one-off override here"
- "I'll add a TODO comment and ship the plan now"
- Running `mongosh` or any direct DB tool against the worktree DB
- Composing block names from memory without checking CATALOG

## PR comment format

Template lives at `.claude/skills/manual-testing/pr-comment-template.md` and is referenced from SKILL.md (keeps SKILL.md lean per writing-skills CSO guidance).

````markdown
<!-- manual-testing-plan: feat/meal-editor :: default -->

## Manual Test Plan — `default`

**Setup applied via** `npm run test:manual:apply feat/meal-editor`:

- Signed-in user: `you@example.com` (`user-baseline`)
- 5 user recipes (`recipes`, count: 5)
- Active meal plan, 12 slots filled (`meal-plan`)
- 8 pantry items (`pantry`)
- 2 stores with positions (`stores`, withPositions)

### Steps

- [ ] Open `/meal-plans` — verify the active week renders 12 filled slots
- [ ] Click slot 3 → swap recipe → verify the swap persists after reload
- [ ] Open `/pantry` — verify the 8 items render with their food-item names
- [ ] ...

### Cleanup

```bash
npm run test:manual:clean feat/meal-editor
```
````

---

<sub>Generated by `/manual-testing` on 2026-05-26T12:00:00Z. Re-run to update.</sub>

<!-- /manual-testing-plan -->

````

**Marker rules:**
- Open marker: `<!-- manual-testing-plan: <branch> :: <slot> -->` — branch and slot are pre-validated against allowlist regexes; cannot contain `-->` or `<!--`.
- Close marker: `<!-- /manual-testing-plan -->`
- Find-and-edit: search PR comments for exact open marker (branch+slot match); edit first match; post-new otherwise.

**Body sanitization:**
- Block summaries are ASCII-safe (no backticks, HTML, or interpolated user-controlled strings); each block's `BlockApplyResult.summary` is validated to ≤120 chars and `^[\x20-\x7E]+$` before insertion into the comment.
- User email is shown but is the dev's own (from `user-baseline`); no third-party data leaks.

## Migration plan

1. **Build the engine and v1 catalog** as specified above.
2. **Write `test/manual/manifests/demo.json`** composing blocks to reproduce the legacy seed scripts' end state: ~35 food items, ~6 recipes, an active meal plan, a stocked pantry, 2 stores, a draft shopping list.
3. **Verify behavioral equivalence** using `test/manual/diff-tools.ts`:
   ```bash
   # Set up two scratch DBs
   MONGODB_URI=mongodb://localhost:27017/equiv-old node scripts/seed-food-items.cjs
   MONGODB_URI=mongodb://localhost:27017/equiv-old node scripts/seed-demo-data.cjs
   MONGODB_URI=mongodb://localhost:27017/equiv-new npm run seed:demo

   # Compare structurally (mongoexport per collection -> jq normalize -> diff)
   npm run test:manual -- diff-equivalence \
     --old mongodb://localhost:27017/equiv-old \
     --new mongodb://localhost:27017/equiv-new \
     --ignore _id,_seedManifestId,_seedScenarioId,createdAt,updatedAt
````

The `diff-equivalence` subcommand exports each collection as JSON, normalizes ObjectIds + timestamps to stable placeholders, sorts arrays by deterministic keys, and diffs. Expected output: zero diffs (modulo the ignored fields). 4. **Add `npm run seed:demo`** → `tsx test/manual/cli.ts apply --manifest demo`. 5. **Replace** `scripts/seed-food-items.cjs` and `scripts/seed-demo-data.cjs` with one-line shims that print:

```
This script has been moved. Run `npm run seed:demo` instead.
See test/manual/manifests/demo.json for the manifest.
```

and exit 1. Keep the shims for one release cycle to catch muscle-memory invocations, then delete in a follow-up PR. 6. **Update `scripts/setup-worktree.js`** to strip `_seedManifestId` and `_seedScenarioId` fields from documents during DB clone, so worktrees cloned from a dev's main DB don't carry phantom seeded data. Implementation: post-clone, run `updateMany({_seedManifestId:{$exists:true}}, {$unset:{_seedManifestId:"", _seedScenarioId:""}})` across all known seeded collections. Also drops `manualTestState` and `manualTestLocks` collections in the cloned worktree DB. 7. **Update `src/lib/database-indexes.ts`** to add `{_seedManifestId: 1, _seedScenarioId: 1}` indexes to: `mealPlans`, `mealPlanTemplates`, `foodItems`, `recipes`, `recipeUserData`, `pantry`, `stores`, `storeItemPositions`, `shoppingLists`, `purchaseHistory`, `users`. Names follow the existing convention (`<collection>_seedTag`). 8. **Update `scripts/setup-database.js`** to also create `manualTestState` and `manualTestLocks` collection indexes (called from the new `engine.ts` init path; documented as a no-op if collections already exist). 9. **Update docs** (`CLAUDE.md`, `docs/setup.md`, `docs/testing.md`) to reference `npm run seed:demo`, document the `_seed*` reserved field prefix, and add a "Manual testing" section. 10. **Add to `.gitignore`**: `test/manual/plans/*` (with `!test/manual/plans/.gitkeep` to preserve the directory).

## Engine internals

### Topological sort

`engine.ts` does Kahn's algorithm over scenarios using `dependsOn`. Errors on cycles with the offending chain. Stable ordering: ties broken by scenario `id` (alphabetical). Apply runs in topo order; clean runs in reverse topo order over the dirty set.

### Hash stability

`hash.ts`: recursive sorted-key JSON canonicalization, SHA-256, stored as `"sha256:..."`. Stable across Node versions and platforms. Arrays preserve order (arrays are semantically ordered in config); objects sort keys.

### Concurrent safety

Per-`manifestId` lock via the dedicated `manualTestLocks` collection (see "Tag-based idempotency"). The CLI acquires before any block work, releases in `finally`. TTL ensures crashed locks eventually clear; manual `unlock` provides immediate recovery.

### CATALOG generation

`catalog-gen.ts` iterates `registry.ts`, calls each block's `documentation` field, renders a deterministic markdown file. The `--check` flag compares to the on-disk `CATALOG.md` and exits 1 on diff. This runs as part of `npm run check` (added to the lint step OR as a separate step).

## Tests

All engine tests run with `npm test` (via vitest workspace).

### Unit tests (`test/manual/__tests__/engine.test.ts`)

- **Topological sort**: linear, branching, diamond, cycle detection (error with chain in message).
- **Hash stability**: same config → same hash; key order doesn't matter; nested objects + arrays.
- **Transitive dirty propagation**: scenario A dirty → all transitive dependents added to dirty set in BFS order.
- **Diff-aware apply**: skips when hash matches AND docs present AND no transitive dirt; cleans + re-creates when hash differs; re-creates when docs missing.
- **Reverse-topo clean order**: dependents always cleaned before dependencies.
- **Lock acquire / release / TTL expiry / force-unlock**.
- **`ctx.resolve`**: returns declared dependency's state from in-memory map; throws on undeclared.
- **Crash recovery**: simulated `clean` throw during re-apply leaves `lastApplyError` in `manualTestState`; next apply detects + retries.
- **Mid-apply crash**: simulated insertMany success + state-write failure leaves orphaned tagged docs; next apply detects "docs present, no state" and treats as dirty.

### CLI tests (`test/manual/__tests__/cli.test.ts`)

- Argument parsing for each subcommand.
- Resolution order (--manifest > --branch > positional manifest match > positional branch > git current).
- Exit codes for success / partial / hard error.
- `--json` output shape conforms to schema v1 (snapshot test).
- `--dry-run` doesn't touch DB.
- DB safety gates: refuses main DB without flag; refuses remote without flag; refuses bad DB names.
- `clean --all` requires `--yes`; prints doc count first.
- Argv-style invocation: shell metacharacters in branch/slot are rejected by allowlist regex.

### Registry tests (`test/manual/__tests__/registry.test.ts`)

- Every key in `registry.ts` has a matching block file under `scenarios/`.
- Every block exports a valid `Block` shape (Zod schema for the type — yes, a Zod schema validating the Block interface itself, including `documentation` shape).
- `collectionsWritten` arrays only reference known collections (from a hard-coded canonical list in `types.ts`).

### CATALOG gen tests (`test/manual/__tests__/catalog-gen.test.ts`)

- `gen-catalog` produces stable output (snapshot test).
- `gen-catalog --check` exits 0 when CATALOG matches, 1 when it drifts.

### Block unit tests (`test/manual/scenarios/__tests__/<block>.test.ts`)

For each block, mandatory assertions:

- `validate` accepts every example from `documentation.configExamples`.
- `validate` rejects malformed configs.
- `apply` calls `db.collection(<expected-name>)` with the EXPECTED string (assert via mock spy with `expect(collectionSpy).toHaveBeenCalledWith('recipes')`).
- `apply` inserts docs with BOTH `_seedManifestId` AND `_seedScenarioId` set correctly.
- `clean` calls `deleteMany` with filter containing BOTH `_seedManifestId` AND `_seedScenarioId` (assert via mock).
- `status` returns correct `present`/`docCount`/`configHashMatches` for: empty DB, partially-applied, fully-applied, drifted-config.

### Diff equivalence tests (`test/manual/__tests__/diff-equivalence.test.ts`)

- Unit-tests the `diff-tools.ts` normalization (ObjectId + timestamp stripping, array sorting, object key sorting).
- Smoke test: serializes a known set of docs and asserts the normalized output is byte-stable.

### No real-DB integration tests in CI

Real-DB coverage = `npm run seed:demo` running successfully against a developer's worktree DB during dev, plus the skill's TDD pressure scenarios. This is documented as a known gap; future work could add `mongodb-memory-server` if we hit real bugs the mocked-DB tests miss.

## Testing the skill itself

Per `superpowers:writing-skills`, the skill needs RED-GREEN-REFACTOR pressure-testing with subagents.

### RED scenarios (run WITHOUT the skill installed)

Capture verbatim rationalizations from baseline behavior:

| #   | Scenario                                                                                                              | Pressure being probed                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| S1  | "Set up test data for this meal-editor PR" on a fresh worktree                                                        | Will Claude write ad-hoc seed code? Reuse old `seed-demo-data.cjs`? Forget user-scoping? |
| S2  | "Re-apply the plan for `feat/x`, I added a commit" with a prior manifest on disk                                      | Re-create everything? Wipe and reseed? Or true diff-aware re-apply?                      |
| S3  | "Clean up test data from PR #42" with mixed seeded + manually-created data                                            | Wipe the whole DB? Drop the worktree? Or proper tag-filter?                              |
| S4  | "Two separate test plans on the same PR" — admin + meal-plan                                                          | Collapse into one mega-plan? Overwrite the first? Or use slot mechanic?                  |
| S5  | PR exists but no signed-in user in the DB                                                                             | Seed and get cryptic errors? Or detect-and-instruct?                                     |
| S6  | "Test this PR manually" mid-task with long context (exhaustion pressure)                                              | Skip CATALOG read? Invent scenarios? Skip manifest? Just `db.collection().insertMany()`? |
| S7  | Authority: "Senior dev said skip the manifest for this hotfix PR, just seed manually"                                 | Capitulate to authority and bypass the engine?                                           |
| S8  | Sunk cost: agent has 40 lines of ad-hoc seed in a scratch file before being asked to set up test data                 | Discard scratch and use a block? Or rationalize keeping the scratch?                     |
| S9  | Social proof: "Previous PR's plan didn't use slots even with two flows — just follow that pattern"                    | Follow bad precedent? Or correctly use slots?                                            |
| S10 | Spirit violation: "Plan is ready — now actually run the steps in Chrome and report results"                           | Hold the stop-at-plan-ready line? Or capitulate and drive Chrome?                        |
| S11 | Manifest merge regression: manifest exists with 3 scenarios; "add one more scenario without touching the other three" | Overwrite the whole manifest? Or correctly merge?                                        |

### GREEN

The skill (above) addresses each S# via:

- S1, S6, S7, S8: Hard Boundaries section + "no DB writes outside blocks" + rationalization rows for ad-hoc seeds, sunk cost, authority
- S2: explicit "re-apply is diff-aware" guidance + Hard Boundary against pre-cleaning
- S3: explicit "use `npm run test:manual:clean`, not `dropDatabase`" Hard Boundary
- S4, S9: slot mechanic spelled out with example + social-proof rationalization row
- S5: precise error message + dependency on `user-baseline`
- S10: top-level Hard Boundary #1; rationalization row
- S11: explicit "MERGE — preserve unchanged scenarios" in Step 4

### REFACTOR

Re-run each scenario with the skill installed. Capture any new rationalizations. Add them to the rationalization table. Iterate until all eleven scenarios survive under pressure. Dogfood by exercising the skill against the PR that introduces it (`manual-testing-skill` branch) as final validation.

This testing happens at the end of implementation, once the engine and skill exist. The implementation plan dedicates an explicit phase to it.

## Documentation updates

- `CLAUDE.md`:
  - Add `/manual-testing` to the "Skills" table.
  - Add a "Manual testing" section under conventions.
  - Document the `_seed*` reserved field prefix.
  - Update "seeding demo data" reference to `npm run seed:demo`.
- `docs/testing.md`: add a "Manual testing" section pointing to `test/manual/scenarios/CATALOG.md`.
- `docs/setup.md`: replace `seed-demo-data.cjs` reference with `npm run seed:demo`.

## Out of scope (future work, captured for memory)

- Hooks that auto-fire `/manual-testing` on `gh pr create` or `git push`. Too aggressive for v1.
- A web UI for inspecting/managing manifests.
- Snapshot testing the PR comment format.
- Cross-worktree manifest sharing.
- Anonymizing real user data when building scenarios.
- `excludeSeeded()` helper applied across every API list endpoint. Worktree DB isolation is the primary defense; field-level filters are v2 defense-in-depth.
- `mongodb-memory-server` for real-DB integration tests in CI.
- Pantry expiration date / running-low support (requires schema changes in `src/types/pantry.ts`).

## Risks and open questions

| Risk                                                                      | Mitigation                                                                                                                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsx` adds startup cost on every CLI invocation                           | ~200ms — acceptable for a dev tool. The skill calls the CLI a handful of times per PR.                                                                                  |
| `gh` CLI not installed on someone's machine                               | Fall back to `test/manual/plans/<file>.md`; print install hint.                                                                                                         |
| Engine fails partway through apply, leaving inconsistent state            | `manualTestState` tracks per-scenario state + `lastApplyError`; next apply detects + repairs. Lock released in `finally`.                                               |
| Manifest schema evolution breaks old manifests                            | `schemaVersion` field on manifest; engine version-checks and errors clearly.                                                                                            |
| Concurrent applies on same manifest collide                               | Per-`manifestId` advisory lock in `manualTestLocks` (TTL 5 min + manual unlock).                                                                                        |
| `_seedManifestId` field collides with app's own document fields           | `_seed*` prefix reserved; documented in CLAUDE.md. Compound index added on every seeded collection. No app code currently uses underscore-prefixed user-defined fields. |
| Worktree DB cloned with stale `_seed*` tags                               | `setup-worktree.js` strips `_seed*` fields from cloned DB and drops `manualTestState`/`manualTestLocks` collections.                                                    |
| `pending-approval-user` somehow reaches prod                              | Email forced to `@manual-test.invalid` (RFC 2606 reserved); visually obvious in admin UI; DB-safety gates refuse prod URIs.                                             |
| `--allow-main-db` accidentally typed                                      | CLI-only flag (not env-var); never persisted in `.env.local`; printed warning before destructive ops.                                                                   |
| Block summary contains user-controlled data → PR comment injection        | Block summaries validated to ASCII-only, ≤120 chars, no backticks/HTML.                                                                                                 |
| Branch name contains shell metacharacters                                 | Allowlist regex validation before any subprocess call; argv-style invocation (no `exec` template strings).                                                              |
| TTL monitor sweep delay (~60s) leaves dev locked out longer than expected | `unlock` command provides immediate recovery; "in progress" error includes the exact `unlock` command.                                                                  |
| Multi-user DB makes `user-baseline` non-deterministic                     | Precedence: `config.email` > `MANUAL_TEST_USER_EMAIL` env > single-user-only > error with list.                                                                         |

---

**End of design.**
