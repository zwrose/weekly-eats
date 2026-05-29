# Shared dev DB + worktree-clear manual-test data

**Issues:** #93 (shared dev DB) + #92 (manual-test clean hygiene). #91 is out of scope (separate PR).
**Date:** 2026-05-28
**Status:** Approved design — revised after `/review-plan` (12 findings folded in) — ready for implementation plan.

## Problem

Each git worktree currently gets its own cloned database `weekly-eats-<branch>`
(`scripts/setup-worktree.js` clones main's dev DB via `mongodump`/`mongorestore`,
then strips `_seed*` tags). This introduced three footguns hit during real testing:

1. **"Which DB?" ambiguity** — dev server + CLI sometimes operate on a different DB
   than the one being queried. Real debugging time lost.
2. **Clones inherit stale/orphaned seed data** — cloned untagged "Manual Test Recipe"
   docs that the manifest-scoped `clean` cannot remove (#92).
3. **Setup cost + Windows drift** — clone needs `mongodump`/`mongorestore`, absent on
   Windows, so the clone is silently skipped there.

The manual-test engine already provides **logical isolation** via `_seedManifestId`
(`branch::slot`) + `_seedScenarioId` tags. The physical clone is redundant with that
and is the source of all three footguns.

## Goals

- All worktrees share one dev DB (main's existing `MONGODB_URI`, copied verbatim).
  Remove the clone path entirely.
- Seeded data is **visibly and queryably tied to its originating branch**, so parallel
  agents never manipulate each other's docs.
- Cleanup works **without a script and without the manifest file** (worktree removal
  often happens via an external tool, e.g. loupe), with an **orphan sweep** as the
  backstop (#92).

## Non-goals

- No dogfood-protection / test-user scoping — the shared dev DB holds only disposable
  data; anything an agent breaks can be re-seeded.
- No #91 API-route `ObjectId.isValid` guards — different layer, separate PR.
- Port and `node_modules` isolation stay per-worktree, unchanged.

## Decisions (locked with user)

| Decision            | Choice                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Isolation model     | Fully shared dev DB; all data disposable                                                         |
| Scope               | #93 + #92 together; #91 separate                                                                 |
| Cleanup trigger     | Proactive + file-independent; never rely on `worktree-remove.js`; orphan sweep is the safety net |
| Worktree clarity    | **Both** — visible branch stamp in names + `status --all` + plan-template callout                |
| Orphan sweep        | Auto-cleans docs whose `_seedManifestId` branch is **gone from git**, plus untracked docs        |
| Branch stamp format | First ~8 chars of the branch (`branch.slice(0, 8)`)                                              |
| Shared DB name      | Canonical = `weekly-eats-dev` (suffixed — passes the allowlist, never trips the bare-name guard) |

---

## Section 1 — Infra: stop cloning, share the DB

### `scripts/setup-worktree.js`

- Delete `cloneDatabase()`, `stripSeedTags()`, and the `mongodb` import.
- **Delete the `MONGODB_URI` rewrite regex inside `generateEnvLocal`** (currently
  `scripts/setup-worktree.js:108-111`, which rewrites the DB-name segment). This lives
  separately from `cloneDatabase`/`stripSeedTags`; leaving it in would silently re-break
  the shared-DB goal. (Finding M4.) Keep main's `MONGODB_URI` line **verbatim**; only the
  `NEXTAUTH_URL` port and `PORT` rewrites remain. → every worktree points at the same DB
  as main (`weekly-eats-dev`).
- Still run `setup-database.js` (idempotent index creation against the shared DB).

### `scripts/worktree-remove.js`

- Remove the `mongosh dropDatabase` block (dropping would nuke the shared DB).
- Keep `git worktree remove` + `git worktree prune`.
- Before removing, attempt a best-effort `clean --manifest-id <branch>` (branch-prefix
  delete — purges every slot for the branch; see §3) and print a reminder that seeded
  data is shared. Never silently drop a DB.

### Startup DB logging ("which DB?" footgun)

- `scripts/dev-server.js` and `test/manual/cli.ts` log the resolved DB name on startup
  (e.g. `▶ DB: weekly-eats-dev`).

### Docs

- CLAUDE.md "How Isolation Works" table: Database row → "shared (same as main)".
- Remove the `mongodump`/`mongorestore` + Windows-fallback gotchas.
- Update the worktree-remove description (no longer drops a DB).
- **`docs/setup.md:20`** currently documents the bare `MONGODB_URI=…/weekly-eats`
  example — correct it to `…/weekly-eats-dev` so the documented dev DB matches the
  allowlist and never trips the reserved-name guard. (Finding M6.)

> **DB-name guard (no code change).** `resolveDbSafety` (`test/manual/cli.ts:96`) still
> refuses the bare `weekly-eats` without `--allow-main-db`, and `cli.test.ts:35` stays
> as-is. With the canonical dev DB named `weekly-eats-dev`, the guard never fires in
> normal operation — bare `weekly-eats` remains a deliberately reserved/guarded name.

---

## Section 2 — Manual-test clarity: visible branch stamp + cross-branch status

### `ctx.label` (engine)

Add `label: string` to `BlockContext`. The engine derives it alongside `manifestId`:

```
label = manifest.branch.slice(0, 8)            // + "·" + slot when slot !== "default"
```

**Caveat (accepted):** two branches sharing an 8-char prefix
(`feature/foo` vs `feature/bar`) produce the same visual stamp. This is cosmetic only —
the full `branch::slot` stays in `_seedManifestId`, so logical isolation, `clean`, and
`status --all` are unaffected.

### Blocks fold the label into their display field

Each block with a human-facing name appends `[${ctx.label}]`:

- `recipes` → `Manual Test Recipe [fix/93-s] 1` (stamp = `"fix/93-shared-dev-db".slice(0, 8)`)
- `food-items`, `stores`, `shopping-list`, `meal-plan-template`, `meal-plan` → same on
  their name/title field.

**Skipped:**

- `user-baseline` — auth-critical identity fields; do not mutate emails/identity.
- `pantry`, `purchase-history`, `recipeUserData` — no own display name; they ride the
  parent's.
- `pending-approval-user` — may stamp display name, leave email intact.

Touches ~6 blocks plus their `__tests__` (title/name assertions update for the stamp).

### `status --all` (new CLI mode)

Ignores the single manifest; reports the whole shared-DB landscape: for each distinct
`_seedManifestId`, the per-collection doc counts. An agent runs it and sees the full
collision map ("branch X: 4 recipes; branch Y: 2 stores").

**Output type (Finding M1).** The existing `CliResult`/`CliScenarioResult`
(`test/manual/types.ts:107`) is per-scenario and doesn't fit a cross-manifest scan.
Define a dedicated `StatusAllResult` in `types.ts`:

```
interface StatusAllResult {
  command: 'status-all';
  manifests: Array<{ manifestId: string; collections: Record<string, number>; hasOrphans: boolean }>;
}
```

`output()` in `cli.ts` dispatches on the result's `command` (discriminated union).

**Dispatch point (Finding I4).** `status --all` and `clean --manifest-id` are
**file-independent** — they must short-circuit in `main()` **before** the
`resolveTarget` + manifest-file-existence check (`cli.ts:212-229`, which throws
`manifest not found` when no file is on disk). Handle them as early-return branches
keyed on `parsed.command` + their flags, right after the DB connection is opened and
before target resolution.

---

## Section 3 — Manual-test hygiene (#92): orphan sweep + write-time guarantee

### Shared tag helper + assertion

Introduce `seedTag(ctx)` in `test/manual/` returning
`{ _seedManifestId, _seedScenarioId }` and **throwing if either is empty**. Migrate
blocks from inline `tagFilter` literals to `...seedTag(ctx)`. Single enforced place →
satisfies #92's "assert non-empty tag at write time."

### `clean --orphans [--dry-run] [--yes]`

**Cross-branch-safe** because it keys off the shared `manualTestState` collection and
global `git` state — never off on-disk manifests (which only show the current branch).
Three targets:

1. **Untracked docs** — `_seedManifestId` set but **no matching `manualTestState` row**
   (interrupted apply, wiped state). Safe to delete.
2. **Stale-branch docs** — `_seedManifestId` whose branch **no longer exists in git**.
   Delete the docs **and** their `manualTestState` rows. This is the "loupe removed the
   worktree, branch is gone" case.
3. **Legacy untagged seed-shaped docs** — naming-heuristic scan (titles matching known
   seed patterns) → **report only**, never auto-deleted (even under `--yes`). Removing
   the clone stops new untagged docs; this just surfaces what is already in the shared DB
   for human confirmation.

`clean` and `status` also gain a **warning** when orphan/untagged seed-shaped docs are
detected — fixes the silent `docCount: 0` from #92.

Default behavior is `--dry-run` (report); deletion requires `--yes`.

#### Git-check injection seam (Findings I1 + M3)

The `Engine` (`test/manual/engine.ts:63`) is pure DB-logic today — zero OS calls, and
its tests never mock `node:child_process`. **Do not** put `git` execution in the engine.
Inject a `branchExists: (branch: string) => boolean` callback into the `Engine`
constructor (or as a parameter to the orphan-sweep method), defaulting in `cli.ts` to a
wrapper around `execFileSync('git', ['rev-parse', '--verify', '--quiet', branch])` — the
same injection pattern as `getCurrentGitBranch` (`cli.ts:104`) and the `getCurrentBranch`
callback already threaded through `resolveTarget`. `execFileSync` with an args array (no
shell) is required: the branch comes from `_seedManifestId`, i.e. DB content.

#### Git failure modes (Finding I2)

`branchExists` must distinguish the two non-zero outcomes:

- **branch genuinely gone** — `git rev-parse` exit 128 / `unknown revision` → return
  `false` (doc is a stale orphan, eligible for deletion).
- **command failure** — `ENOENT` (no git), not-a-repo, Windows spawn error, any other
  exit → **throw**. The orphan sweep must **abort with a clear error**, never treat
  branches as gone.

Rationale: a swallowed git error would flag _every_ branch as gone and `deleteMany` would
wipe every parallel agent's in-flight seed data — the exact collision this work prevents.
Safety backstop: if a single sweep would flag a large fraction of known manifests as gone
(e.g. >50%), print a warning and require explicit re-confirmation before deleting.

### `clean --manifest-id <branch>` (branch-prefix; Finding M2)

File-independent targeted clean, **without** needing the manifest file. Takes a **branch**
(not `branch::slot`, and no `::*` wildcard — `*` is invalid per `SLOT_RE`,
`validate-args.ts:3`). Validates the branch via `validateBranch`, then deletes every slot
for it via a prefix match — `deleteMany({ _seedManifestId: { $regex: '^<branch>::' } })`
across seedable collections + the matching `manualTestState` rows. This is what
`worktree-remove.js` and loupe call to purge a branch's data pre-removal. (A future
`--slot` flag can narrow to one slot if needed; not required now.)

---

## Section 4 — Skill + template updates

- **`pr-comment-template.md` / SKILL.md flow:** the generated test plan states the
  branch/manifestId up front and notes that seeded docs are name-stamped `[branch]` — so
  a tester knows exactly which rows are theirs in a shared DB. Add a CLI-reference line
  for `status --all`, `clean --orphans`, `clean --manifest-id`.
- **SKILL.md "Hard Boundaries":** the "No `dropDatabase`" rule gains "and never drop the
  shared dev DB"; note that `clean --all` now spans **every** branch (still `--yes`-gated).
- **`clean --all` preview (Finding M5).** On the shared DB this wipes every branch's seed
  data, so before deleting, print a summary — distinct `_seedManifestId` branches +
  total doc count (via `distinct('_seedManifestId')`) — then proceed under `--yes`.
  Additive to the existing flag gate.

---

## Section 5 — Testing

Named cases (not "we'll add tests"):

- **`ctx.label` (Finding M7 + N1):**
  - slot = `default` → `branch.slice(0, 8)`, no suffix.
  - slot ≠ `default` → `branch.slice(0, 8) + '·' + slot`.
  - two branches sharing an 8-char prefix produce identical labels — collision is
    cosmetic and accepted (locks in the §2 caveat).
- **`status --all`:** grouping returns a `StatusAllResult` with one entry per distinct
  `_seedManifestId` and correct per-collection counts (Finding M1 shape).
- **`clean --orphans` (Finding I3) — by target, with `branchExists` stubbed:**
  1. `--yes` deletes **untracked** docs (tagged, no `manualTestState` row).
  2. `--yes` deletes **stale-branch** docs **and** their `manualTestState` rows
     (`branchExists` stub returns `false`).
  3. `--yes` does **NOT** `deleteMany` **legacy-untagged** docs (assert zero deleteMany
     calls for that candidate set — report-only guarantee).
  4. `--dry-run` reports all three targets and deletes nothing.
- **`clean --orphans` git failure (Finding I2):** when `branchExists` **throws**
  (command failure, not branch-not-found), the sweep aborts with an error and deletes
  nothing.
- **`clean --manifest-id <branch>` (Finding M2):** branch-prefix delete removes docs +
  state across **multiple slots** for the branch; invalid/`::*` input is rejected.
- **`seedTag`:** throws when `manifestId` or `scenarioId` is empty.
- **Blocks:** update title/name assertions for the `[label]` stamp.
- **`setup-worktree.js`:** no clone path; the `MONGODB_URI` rewrite regex is gone;
  `.env.local` preserves main's `MONGODB_URI` verbatim and rewrites only `PORT` /
  `NEXTAUTH_URL`.
- **`resolveDbSafety`:** unchanged — existing tests (`cli.test.ts:32-47`) stay green;
  `weekly-eats-dev` passes, bare `weekly-eats` still refused. No new test needed.
- Final `npm run check` (lint + test:coverage + build).

## Affected files (inventory)

- `scripts/setup-worktree.js` — remove clone/strip + the URI-rewrite regex; share URI.
- `scripts/worktree-remove.js` — remove DB drop; call `clean --manifest-id <branch>`.
- `scripts/dev-server.js` — log DB name.
- `test/manual/cli.ts` — log DB name; `status --all`; `clean --orphans` (+ default
  `branchExists` git wrapper via `execFileSync`); `clean --manifest-id`; early-return
  dispatch for file-independent commands; `clean --all` preview.
- `test/manual/engine.ts` — `ctx.label`; `branchExists` injection seam; orphan/stale
  detection (pure-logic, no OS calls).
- `test/manual/types.ts` — `BlockContext.label`; `StatusAllResult`.
- `test/manual/seedTag.ts` (new) — tag helper + non-empty assertion.
- `test/manual/scenarios/*.ts` — adopt `seedTag`; stamp display names (~6 blocks).
- `test/manual/scenarios/__tests__/*`, `test/manual/__tests__/*` — assertion + new-case
  updates.
- `.claude/skills/manual-testing/SKILL.md`, `pr-comment-template.md` — doc updates.
- `CLAUDE.md` — isolation table + gotchas.
- `docs/setup.md` — fix the `MONGODB_URI` example (`weekly-eats` → `weekly-eats-dev`).
