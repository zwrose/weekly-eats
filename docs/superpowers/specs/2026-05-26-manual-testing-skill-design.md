# Manual Testing Skill — Design

**Date:** 2026-05-26
**Branch:** `manual-testing-skill`
**Status:** Draft → ready for implementation
**Reference:** Adapted from [loupe-app/loupe `.claude/skills/manual-testing/SKILL.md`](https://github.com/loupe-app/loupe/blob/main/.claude/skills/manual-testing/SKILL.md)

## Goal

Add a `/manual-testing` skill plus the scenario engine it drives. The skill analyzes a PR diff, seeds appropriate test data into the worktree's MongoDB, generates a checkbox test plan, and posts it as a PR comment. Re-runs are idempotent.

The end state replaces the existing `scripts/seed-food-items.cjs` and `scripts/seed-demo-data.cjs` with a checked-in `demo.json` manifest applied via the same engine — one seeding system, not two.

## Non-goals

- Driving Chrome to execute the plan. The skill stops at "plan ready"; execution is delegated to the existing `/verify` skill or a human.
- Replacing automated tests. Manual testing covers things automated tests don't: visual rendering, real interaction flows, edge cases that need a real DB and a real browser.
- Generic seed framework. The engine is purpose-built for this app's MongoDB collections and user-scoped data model.

## Architecture

### File layout

```
test/manual/
  scenarios/
    CATALOG.md              Human-readable: every block, config schema, dependencies
    registry.ts             block name -> module map
    user-baseline.ts        one file per block; exports default Block<Config, State>
    food-items.ts
    recipes.ts
    meal-plan.ts
    pantry.ts
    stores.ts
    shopping-list.ts
    purchase-history.ts
    pending-approval-user.ts
  manifests/
    demo.json               replaces scripts/seed-demo-data.cjs
    feat%2Fmeal-editor.json PR-specific; sanitized branch name
    feat%2Fmeal-editor.admin-flow.json optional named slot
  plans/                    local-only fallback when no PR exists; gitignored
    feat%2Fmeal-editor.md
  __tests__/
    engine.test.ts          unit tests for diff/hash/dependency-resolution
    cli.test.ts             CLI argument parsing, exit codes, --json output
    registry.test.ts        every block in registry has matching CATALOG entry
  engine.ts                 apply() / clean() / status()
  cli.ts                    tsx test/manual/cli.ts <cmd> ...
  types.ts                  Manifest, Block, BlockContext, BlockState
  pr-comment.ts             gh CLI wrapper: find-by-marker, post or edit
  hash.ts                   stable config hashing
  manifest-io.ts            load/save manifest files; branch-name sanitization

scripts/
  (seed-food-items.cjs and seed-demo-data.cjs DELETED in this PR)

.claude/skills/manual-testing/
  SKILL.md
```

### npm scripts (added to `package.json`)

```jsonc
{
  "test:manual": "tsx test/manual/cli.ts",
  "test:manual:apply": "tsx test/manual/cli.ts apply",
  "test:manual:clean": "tsx test/manual/cli.ts clean",
  "test:manual:status": "tsx test/manual/cli.ts status",
  "seed:demo": "tsx test/manual/cli.ts apply demo",
}
```

### Dependencies

- **`tsx`** (devDep): runs TypeScript directly without a build step. Standard, well-supported.
- No `mongodb-memory-server`. Engine unit tests use a mocked `Db`; end-to-end coverage comes from `npm run seed:demo` running against a real worktree DB plus the skill's TDD pressure scenarios.

### Vitest config update

Extend `vitest.config.ts`:

```ts
test: {
  include: [
    'src/**/*.{test,spec}.{ts,tsx}',
    'test/manual/**/*.test.ts',      // NEW
  ],
}
```

Coverage `include` stays as `src/**/*.{ts,tsx}` — engine code is dev-only tooling and shouldn't count against app coverage.

## Manifest schema

```jsonc
{
  "branch": "feat/meal-editor",
  "slot": "default",
  "createdAt": "2026-05-26T12:00:00.000Z",
  "updatedAt": "2026-05-26T12:00:00.000Z",
  "scenarios": [
    { "id": "u", "block": "user-baseline" },
    { "id": "fi", "block": "food-items", "config": { "ensure": ["apple", "bread", "chicken"] } },
    {
      "id": "r",
      "block": "recipes",
      "config": { "count": 5, "isGlobal": false },
      "dependsOn": ["u", "fi"],
    },
    {
      "id": "mp",
      "block": "meal-plan",
      "config": { "weeksOut": 0, "slotsFilled": 12, "recipesRef": "r" },
      "dependsOn": ["u", "r"],
    },
  ],
  "stepMappings": [
    { "step": "Open this week's meal plan", "scenarioIds": ["mp"], "notes": "/meal-plans" },
    { "step": "Swap a recipe in slot 3", "scenarioIds": ["mp", "r"] },
  ],
}
```

**Field rules:**

- `branch`: the git branch the manifest is for. Sanitized in the filename (`/` → `%2F`) but stored unsanitized in JSON.
- `slot`: defaults to `"default"`. Lets a single PR have multiple independent plans (e.g. `admin-flow` + `meal-editor` on a wide PR).
- `scenarios[].id`: short, manifest-unique. Used by `dependsOn` and `*Ref` config fields.
- `scenarios[].block`: must match a key in `registry.ts`.
- `scenarios[].config`: opaque to the engine; validated per-block.
- `scenarios[].dependsOn`: scenario IDs that must apply first. Topologically sorted by the engine; cycles error out.
- `stepMappings`: maps test plan steps to the scenarios that back them. Drives the "Setup applied" section of the PR comment.

**Manifest filename**: `<sanitized-branch>[.<slot>].json`. Slot omitted in filename when slot is `default`. Examples:

- `feat%2Fmeal-editor.json` → branch `feat/meal-editor`, slot `default`
- `feat%2Fmeal-editor.admin-flow.json` → branch `feat/meal-editor`, slot `admin-flow`

**Manifest validation**: the engine validates manifest shape with a Zod-style or hand-rolled checker before applying. Bad manifests fail with a clear pointer to the offending field, not a runtime crash deep in a block.

## Block interface

```ts
// test/manual/types.ts

export interface BlockContext {
  db: Db; // mongodb Db handle
  manifestId: string; // `<branch>::<slot>`
  scenarioId: string; // e.g. "mp"
  resolve: <T = unknown>(id: string) => T; // result of a dependency block
}

export interface BlockApplyResult<State = unknown> {
  state: State; // returned to dependents via ctx.resolve
  docCount: number; // how many docs this scenario tagged
  summary: string; // one-line human description (for PR comment)
}

export interface Block<Config = unknown, State = unknown> {
  name: string;
  validate(config: unknown): Config; // throws on bad config
  apply(config: Config, ctx: BlockContext): Promise<BlockApplyResult<State>>;
  clean(ctx: BlockContext): Promise<{ docCount: number }>;
  status(ctx: BlockContext): Promise<{
    present: boolean; // any tagged docs found?
    docCount: number;
    configHashMatches: boolean; // matches last-applied?
  }>;
}
```

### Tag-based idempotency

Every document a block inserts gets two fields:

- `_seedManifestId: "feat/meal-editor::default"`
- `_seedScenarioId: "mp"`

`apply()` is diff-aware:

1. Compute stable hash of `config` (sorted-key JSON).
2. Look up `manualTestState` doc for `(manifestId, scenarioId)`.
3. If hash unchanged AND tagged docs still exist → **skip** (return cached state).
4. If hash changed → call `clean()`, then re-create.
5. If state missing or tagged docs missing → re-create.

`clean()` is a straight `deleteMany({ _seedManifestId, _seedScenarioId })` across every collection the block writes to. Dependencies cleaned in **reverse topological order** (dependents first, then dependencies).

### `manualTestState` collection

One doc per `(manifestId, scenarioId)`:

```ts
{
  _id: ObjectId,
  manifestId: "feat/meal-editor::default",
  scenarioId: "mp",
  blockName: "meal-plan",
  configHash: "sha256:abc...",
  state: { mealPlanId: "...", slotCount: 12 },   // block's apply result, used by dependents
  lastAppliedAt: Date,
  lastConfigJson: "...",                          // for debugging drift
}
```

Indexed on `{ manifestId: 1, scenarioId: 1 }` unique. The engine creates this index lazily on first apply.

### `ctx.resolve(id)` semantics

A block can reference a sibling scenario's result via `ctx.resolve("r")`. The engine guarantees `id` is in the block's `dependsOn`, and returns the `state` field from `manualTestState`. Refs in config (e.g. `recipesRef: "r"`) are resolved by the block itself, not the engine — the engine only ensures the dependency has been applied first.

### Auth gate via `user-baseline`

`user-baseline` is the only block that doesn't insert anything. It:

1. Finds the first user in the `users` collection.
2. Verifies the user has the fields a Google-OAuth session would have populated (`email`, `name`).
3. Returns `state: { userId, email, name }`.
4. Throws a structured error if no user exists. Error message includes:
   ```
   No signed-in user found in the worktree DB.
   Run `npm run dev`, open http://localhost:<PORT>, sign in with Google, then re-run.
   ```

All other blocks declare `dependsOn: ["<id-of-user-baseline-scenario>"]` and pull `userId` from `ctx.resolve(...)`.

## Initial catalog (v1: 9 blocks)

Detailed specs live in `test/manual/scenarios/CATALOG.md`; summary here.

| Block                   | Config                                                                                                          | State output                                          | Deps                                              | Collections written                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| `user-baseline`         | `{}`                                                                                                            | `{ userId, email, name }`                             | —                                                 | none (read-only)                       |
| `food-items`            | `{ ensure?: string[]; globalCount?: number; userCount?: number }`                                               | `{ foodItemIds: Record<string, ObjectId> }`           | —                                                 | `foodItems`                            |
| `recipes`               | `{ count: number; isGlobal: boolean; withUserData?: boolean; foodItemsRef?: string }`                           | `{ recipeIds: ObjectId[] }`                           | `user-baseline`, optionally `food-items`          | `recipes`, optionally `recipeUserData` |
| `meal-plan`             | `{ weeksOut: number; slotsFilled: number; recipesRef?: string; includeLeftovers?: boolean }`                    | `{ mealPlanId: ObjectId; slotCount: number }`         | `user-baseline`, optionally `recipes`             | `mealPlans`                            |
| `pantry`                | `{ count: number; withExpired?: boolean; withRunningLow?: boolean; foodItemsRef?: string }`                     | `{ pantryItemIds: ObjectId[] }`                       | `user-baseline`, `food-items`                     | `pantry`                               |
| `stores`                | `{ count: number; withPositions?: boolean }`                                                                    | `{ storeIds: ObjectId[]; positionsPerStore: number }` | `user-baseline`                                   | `stores`, `storeItemPositions`         |
| `shopping-list`         | `{ state: 'draft' \| 'in-progress' \| 'complete'; itemCount: number; storeRef?: string; mealPlanRef?: string }` | `{ shoppingListId: ObjectId; itemCount: number }`     | `user-baseline`, `stores`, optionally `meal-plan` | `shoppingLists`                        |
| `purchase-history`      | `{ count: number; daysBack?: number; foodItemsRef?: string }`                                                   | `{ purchaseIds: ObjectId[] }`                         | `user-baseline`, `food-items`                     | `purchaseHistory`                      |
| `pending-approval-user` | `{ email?: string; name?: string }`                                                                             | `{ pendingUserId: ObjectId; email: string }`          | —                                                 | `users` (unapproved)                   |

**Each block's TS file structure**:

```ts
import { z } from 'zod'; // or hand-rolled validation
import type { Block } from '../types.js';

const ConfigSchema = z.object({
  /* ... */
});
type Config = z.infer<typeof ConfigSchema>;
type State = {
  /* ... */
};

const block: Block<Config, State> = {
  name: 'food-items',
  validate(config) {
    return ConfigSchema.parse(config);
  },
  async apply(config, ctx) {
    /* idempotent insert with tags */
  },
  async clean(ctx) {
    /* deleteMany by tag */
  },
  async status(ctx) {
    /* count tagged docs */
  },
};

export default block;
```

**Decision: use Zod for config validation.** It's a small dep, already used in the React/Next.js ecosystem, and gives us free error messages. If we don't already have it, add it as a devDep (it's tiny — ~12KB).

## CLI

`tsx test/manual/cli.ts <command> [args] [flags]`

```
apply <branch-or-manifest-name> [slot]    Apply manifest. Idempotent.
clean <branch-or-manifest-name> [slot]    Remove tagged docs.
clean --all                                Remove every doc with any _seedManifestId.
status <branch-or-manifest-name> [slot]   Report what's seeded; flag drift.
list                                       List all manifests on disk.
```

**Argument resolution**:

- `apply` / `clean` / `status` accept a branch name (`feat/meal-editor`), a slot-qualified branch (`feat/meal-editor admin-flow`), or a bare manifest name like `demo` (loads `manifests/demo.json`).
- If no positional arg, defaults to the current git branch + `default` slot.

**Flags**:

- `--json`: machine-readable output (used by the skill to parse results).
- `--dry-run`: validate manifest and print plan; don't touch DB.
- `--verbose`: log every DB write.

**Exit codes**:

- `0` success
- `1` hard error (bad manifest, no DB, etc.)
- `2` partial (some scenarios failed; others applied)

**DB safety**: CLI reads `MONGODB_URI` from `.env.local`. Refuses to run if URI points at a database named `weekly-eats` (the main DB) unless `WEEKLY_EATS_MANUAL_TEST_ALLOW_MAIN_DB=1` is set. Worktree DBs (`weekly-eats-<branch>`) are always allowed.

## Skill flow (`SKILL.md`)

**Frontmatter:**

```yaml
---
name: manual-testing
description: Use when setting up test data for a PR, creating or updating a manual test plan, cleaning up test data, or checking what test data is seeded. Triggers on phrases like "test this PR manually", "set up test data", "seed scenarios", "manual test plan", "post a test plan".
---
```

**Invocation:** `/manual-testing [branch] [slot]` or auto-triggered by the description.

**Flow:**

1. **Prerequisite check.** Read `test/manual/scenarios/CATALOG.md` _before picking scenarios_. This is a hard gate — agents must see what blocks exist before composing.
2. **Determine target.** Use current branch + `default` slot unless overridden. Confirm `MONGODB_URI` is set; warn if it points at the main DB.
3. **Analyze the PR diff.** `gh pr diff` (or `git diff main...HEAD` if no PR exists). Identify what needs manual verification: visual rendering, interaction flows, auth/permission paths, edge cases that automated tests miss.
4. **Pick scenarios.** Choose blocks + configs from the CATALOG. If no existing block fits, create one: write the module, register in `registry.ts`, document in `CATALOG.md`. Do NOT write ad-hoc seed code outside a block.
5. **Write/update the manifest.** Path: `test/manual/manifests/<sanitized-branch>[.<slot>].json`. If a manifest already exists for this slot, merge — preserve unchanged scenarios, update changed ones.
6. **Run apply.** Shell out to `npm run test:manual:apply <branch> [slot] -- --json`. Parse output. Report any failures with the exact block that broke.
7. **Generate the test plan.** Markdown checklist — every step is `- [ ]`. Reference scenarios by name and config so a tester knows what state to expect.
8. **Post to the PR (or fall back to local).**
   - If a PR exists: `gh pr comment`. Find existing comment by HTML marker `<!-- manual-testing-plan: <branch> :: <slot> -->`; edit if found, post new otherwise.
   - If no PR: write plan to `test/manual/plans/<sanitized-branch>[.<slot>].md` and tell the user the path.
9. **Stop.** Tell the user the plan is ready. Do NOT drive Chrome. Suggest `/verify` if they want Claude to execute the plan.

**Re-apply behavior**: on later invocations with the same branch+slot, the skill re-analyzes the diff, updates the manifest, re-applies (diff-aware), and edits the existing PR comment. Never posts duplicates.

**Multiple plans per PR**: if the user invokes `/manual-testing feat/wide-pr admin-flow`, the skill writes a separate manifest (`feat%2Fwide-pr.admin-flow.json`), seeds independently, and posts a second comment with a different marker. Each plan is self-contained.

### Rationalization table (drawn from RED testing — see "Testing the skill" below)

| Excuse                                                                            | Reality                                                                                               |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "I'll just write a quick `db.collection().insertMany()` here"                     | Ad-hoc seed code outside the engine bypasses tagging — cleanup will leak. Always go through a block.  |
| "There's no block for X, I'll just inline it"                                     | Add a new block in `test/manual/scenarios/`. Five-minute cost; saves hours of duplication.            |
| "I'll skip reading CATALOG.md, I remember the blocks"                             | Blocks evolve. Configs change. Read CATALOG every time.                                               |
| "I'll just `db.dropDatabase()` to clean up"                                       | Wipes manual exploration data too. Use `npm run test:manual:clean`.                                   |
| "Re-apply means start fresh"                                                      | Re-apply is diff-aware. The engine handles it. Don't pre-clean.                                       |
| "The user wants to test admin AND meal-editor — I'll cram both into one manifest" | That's what slots are for. Two manifests, two comments. Each independent.                             |
| "There's no user, but I'll just create one in MongoDB"                            | Won't work — NextAuth fields like `image`, `emailVerified` need real OAuth. Tell the user to sign in. |

### Red flags — STOP if you catch yourself

- Writing `db.collection(...).insertOne(...)` outside `test/manual/scenarios/`
- Calling `apply()` directly from JS instead of via the CLI
- Editing a manifest by hand without updating `updatedAt`
- Posting a new PR comment instead of finding and editing the existing one
- Skipping the CATALOG read

## PR comment format

````markdown
<!-- manual-testing-plan: feat/meal-editor :: default -->

## Manual Test Plan — `default`

**Setup applied via** `npm run test:manual:apply feat/meal-editor`:

- Signed-in user: `you@example.com` (`user-baseline`)
- 5 user recipes (`recipes`, count: 5)
- Active meal plan, 12 slots filled (`meal-plan`)
- 8 pantry items, 2 expired (`pantry`)

### Steps

- [ ] Open `/meal-plans` — verify the active week renders 12 filled slots
- [ ] Click slot 3 → swap recipe → verify the swap persists after reload
- [ ] Open `/pantry` — verify expired items show the warning chip
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
- Open marker: `<!-- manual-testing-plan: <branch> :: <slot> -->`
- Close marker: `<!-- /manual-testing-plan -->`
- Find-and-edit logic: search PR comments for the open marker (exact match including branch+slot); edit the first match. If none, post new.

## Migrating existing seed scripts

1. **Build the engine and v1 catalog** as specified above.
2. **Write `test/manual/manifests/demo.json`** composing blocks to reproduce today's `seed-demo-data.cjs` end state: ~35 food items, ~6 recipes, an active meal plan, a stocked pantry, 2 stores, a draft shopping list.
3. **Verify behavioral equivalence.** Run both old and new against scratch databases:
   ```bash
   # baseline (old)
   node scripts/seed-food-items.cjs && node scripts/seed-demo-data.cjs
   mongodump --uri=$MONGODB_URI --out=/tmp/old-seed

   # new
   npm run test:manual:clean demo && npm run seed:demo
   mongodump --uri=$MONGODB_URI --out=/tmp/new-seed

   # diff (ignore _id and _seed* fields)
   diff -r /tmp/old-seed /tmp/new-seed  # expect only _id / _seedManifestId / _seedScenarioId diffs
````

4. **Add `npm run seed:demo`** → `tsx test/manual/cli.ts apply demo`.
5. **Delete** `scripts/seed-food-items.cjs` and `scripts/seed-demo-data.cjs`.
6. **Update docs** (`CLAUDE.md`, `docs/setup.md`, any READMEs) to reference `npm run seed:demo`.

## Engine internals

### Topological sort

`engine.ts` does a topological sort over scenarios using `dependsOn`. Errors on cycles. Stable ordering: ties broken by scenario `id` (alphabetical). Apply runs in topo order; clean runs in reverse topo order.

### Hash stability

`hash.ts`: sorts object keys recursively, JSON.stringifies, takes SHA-256. Stable across Node versions and platforms. Stored as `"sha256:..."` for forward compatibility.

### Failure semantics

- A block's `apply` throwing aborts the whole apply run. Already-applied scenarios stay applied (their state is in `manualTestState`). Exit code 2.
- A block's `validate` throwing aborts before any DB write. Exit code 1.
- A block's `clean` throwing during a re-apply (config-changed case) aborts; the scenario is left in an inconsistent state. The next `clean` or `apply` retries.

### Concurrent safety

The engine acquires a per-`manifestId` advisory lock by inserting a doc into `manualTestState` with key `(manifestId, "__lock__")` and TTL 5 minutes. Concurrent invocations on the same manifest fail fast with "another apply is in progress." Different manifests can apply in parallel.

## Tests

All engine tests live in `test/manual/__tests__/` and run with `npm test`.

**Unit tests (`engine.test.ts`):**

- Topological sort: handles linear, branching, diamond; errors on cycles
- Hash stability: same config → same hash; key order doesn't matter; nested objects work
- Diff-aware apply: skips when hash matches and docs present; cleans + re-creates when hash differs; re-creates when docs missing
- Reverse-topo clean order
- Lock acquire / release / TTL expiry
- `ctx.resolve` only returns declared dependencies; throws on undeclared

**CLI tests (`cli.test.ts`):**

- Argument parsing for each subcommand
- Exit codes for success / partial / hard error
- `--json` output shape
- `--dry-run` doesn't touch DB
- Main-DB refusal (uses `WEEKLY_EATS_MANUAL_TEST_ALLOW_MAIN_DB` override)

**Registry tests (`registry.test.ts`):**

- Every key in `registry.ts` has a `CATALOG.md` entry
- Every `CATALOG.md` entry has a registry key
- Every registered block exports a valid `Block` shape

**Block unit tests** (one file per block, in `test/manual/scenarios/__tests__/`):

- `validate` accepts valid configs, rejects invalid
- `apply` produces correct tagged docs (mocked Db, asserts insertMany args)
- `clean` issues correct deleteMany filter

**No integration tests against a real DB** in CI. Real-DB coverage = `npm run seed:demo` working in the developer's worktree + the skill's TDD scenarios.

## Testing the skill itself

Per `superpowers:writing-skills`, the skill needs RED-GREEN-REFACTOR pressure-testing with subagents.

### RED scenarios (run WITHOUT the skill installed)

Capture verbatim rationalizations from baseline behavior:

| #   | Scenario                                                                         | Pressure being probed                                                                        |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| S1  | "Set up test data for this meal-editor PR" on a fresh worktree                   | Will Claude write ad-hoc seed code? Reuse the old `seed-demo-data.cjs`? Forget user-scoping? |
| S2  | "Re-apply the plan for `feat/x`, I added a commit" with a prior manifest on disk | Re-create everything? Wipe and reseed? Or true diff-aware re-apply?                          |
| S3  | "Clean up test data from PR #42" with mixed seeded + manually-created data       | Wipe the whole DB? Drop the worktree? Or proper tag-filter?                                  |
| S4  | "Two separate test plans on the same PR" — admin + meal-plan                     | Collapse into one mega-plan? Overwrite the first? Or use slot mechanic?                      |
| S5  | PR exists but no signed-in user in the DB                                        | Seed and get cryptic errors? Or detect-and-instruct?                                         |
| S6  | "Test this PR manually" mid-task with long context (exhaustion pressure)         | Skip CATALOG read? Invent scenarios? Skip manifest? Just `db.collection().insertMany()`?     |

### GREEN

The skill (above) must address each S#:

- S1, S6: explicit "no ad-hoc seeds outside the engine" rule + rationalization table
- S2: explicit "re-apply is diff-aware, don't pre-clean" guidance
- S3: explicit "use `npm run test:manual:clean`, not `dropDatabase`"
- S4: slot mechanic spelled out with example
- S5: precise error message and what to tell the user

### REFACTOR

Re-run each scenario with the skill installed. Capture any new rationalizations. Add them to the rationalization table. Iterate until all six survive under pressure.

This testing happens at the end of implementation, once the engine and skill exist. Documented as the final phase of the implementation plan.

## Documentation updates

- `CLAUDE.md`: add `/manual-testing` to the "Skills" table; update "Seeding demo data" reference; add a "Manual testing" section under conventions.
- `docs/testing.md`: add a "Manual testing" section pointing to `test/manual/scenarios/CATALOG.md`.
- `docs/setup.md`: replace any `seed-demo-data.cjs` reference with `npm run seed:demo`.

## Out of scope (future work, captured for memory)

- Hooks that auto-fire `/manual-testing` on `gh pr create` or `git push`. Too aggressive for v1.
- A web UI for inspecting/managing manifests.
- Snapshot testing the PR comment format.
- Cross-worktree manifest sharing.
- Anonymizing real user data when building scenarios.

## Risks and open questions

| Risk                                                            | Mitigation                                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `tsx` adds startup cost on every CLI invocation                 | ~200ms — acceptable for a dev tool                                                        |
| `gh` CLI not installed on someone's machine                     | Fall back to writing plan to `test/manual/plans/`; print install hint                     |
| Engine fails partway through apply, leaving inconsistent state  | `manualTestState` tracks per-scenario state; next apply detects + repairs                 |
| Manifest schema evolution breaks old manifests                  | Manifest includes implicit version (file shape); engine version-checks and errors clearly |
| Concurrent applies on same manifest collide                     | Per-`manifestId` advisory lock (5-minute TTL)                                             |
| `_seedManifestId` field collides with app's own document fields | Prefix `_seed*` is reserved; documented in CLAUDE.md after this lands                     |

---

**End of design.**
