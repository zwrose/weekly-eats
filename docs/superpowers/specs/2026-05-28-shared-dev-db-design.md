# Shared dev DB + worktree-clear manual-test data

**Issues:** #93 (shared dev DB) + #92 (manual-test clean hygiene). #91 is out of scope (separate PR).
**Date:** 2026-05-28
**Status:** Approved design — ready for implementation plan.

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

---

## Section 1 — Infra: stop cloning, share the DB

### `scripts/setup-worktree.js`

- Delete `cloneDatabase()`, `stripSeedTags()`, and the `mongodb` import.
- `generateEnvLocal`: keep main's `MONGODB_URI` line **unchanged** (no DB-name rewrite).
  Only rewrite `NEXTAUTH_URL` port and `PORT`. → every worktree points at the same DB
  as main.
- Still run `setup-database.js` (idempotent index creation against the shared DB).

### `scripts/worktree-remove.js`

- Remove the `mongosh dropDatabase` block (dropping would nuke the shared DB).
- Keep `git worktree remove` + `git worktree prune`.
- Before removing, attempt a best-effort `clean --manifest-id <branch::*>` (see §3) and
  print a reminder that seeded data is shared. Never silently drop a DB.

### Startup DB logging ("which DB?" footgun)

- `scripts/dev-server.js` and `test/manual/cli.ts` log the resolved DB name on startup
  (e.g. `▶ DB: weekly-eats-dev`).

### Docs

- CLAUDE.md "How Isolation Works" table: Database row → "shared (same as main)".
- Remove the `mongodump`/`mongorestore` + Windows-fallback gotchas.
- Update the worktree-remove description (no longer drops a DB).

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
2. **Stale-branch docs** — `_seedManifestId` whose branch **no longer exists in git**
   (`git rev-parse --verify <branch>` fails). Delete the docs **and** their
   `manualTestState` rows. This is the "loupe removed the worktree, branch is gone"
   case.
3. **Legacy untagged seed-shaped docs** — naming-heuristic scan (titles matching known
   seed patterns) → **report only**, never auto-deleted. Removing the clone stops new
   untagged docs; this just surfaces what is already in the shared DB for human
   confirmation.

`clean` and `status` also gain a **warning** when orphan/untagged seed-shaped docs are
detected — fixes the silent `docCount: 0` from #92.

Default behavior is `--dry-run` (report); deletion requires `--yes`.

### `clean --manifest-id <branch::slot>`

File-independent targeted clean: `deleteMany({ _seedManifestId })` across seedable
collections + remove its `manualTestState` rows, **without** needing the manifest file.
This is what `worktree-remove.js` and loupe call to purge a branch's data pre-removal.

---

## Section 4 — Skill + template updates

- **`pr-comment-template.md` / SKILL.md flow:** the generated test plan states the
  branch/manifestId up front and notes that seeded docs are name-stamped `[branch]` — so
  a tester knows exactly which rows are theirs in a shared DB. Add a CLI-reference line
  for `status --all`, `clean --orphans`, `clean --manifest-id`.
- **SKILL.md "Hard Boundaries":** the "No `dropDatabase`" rule gains "and never drop the
  shared dev DB"; note that `clean --all` now spans **every** branch (still `--yes`-gated).

---

## Section 5 — Testing

- **Engine/CLI:** `ctx.label` derivation (incl. slot suffix), `status --all` grouping,
  `clean --orphans` (untracked + stale-branch + dry-run; git-gone detection mocked),
  `clean --manifest-id`, `seedTag` throws on empty ids.
- **Blocks:** update title/name assertions for the `[label]` stamp.
- **`setup-worktree.js`:** no clone path; `.env.local` preserves main's `MONGODB_URI`,
  rewrites only port.
- Final `npm run check` (lint + test:coverage + build).

## Affected files (inventory)

- `scripts/setup-worktree.js` — remove clone/strip; share URI.
- `scripts/worktree-remove.js` — remove DB drop; call `clean --manifest-id`.
- `scripts/dev-server.js` — log DB name.
- `test/manual/cli.ts` — log DB name; `status --all`; `clean --orphans`;
  `clean --manifest-id`.
- `test/manual/engine.ts` — `ctx.label`; orphan/stale detection helpers.
- `test/manual/types.ts` — `BlockContext.label`.
- `test/manual/seedTag.ts` (new) — tag helper + assertion.
- `test/manual/scenarios/*.ts` — adopt `seedTag`; stamp display names (~6 blocks).
- `test/manual/scenarios/__tests__/*` — assertion updates.
- `.claude/skills/manual-testing/SKILL.md`, `pr-comment-template.md` — doc updates.
- `CLAUDE.md` — isolation table + gotchas.
