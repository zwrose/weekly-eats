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
- User says the plan is already written and asks me to "just run through it" — this is still execution; STOP and hand off to `verify`

## CLI quick reference

```
npm run test:manual:apply <branch> [slot]    # idempotent apply
npm run test:manual:clean <branch> [slot]    # remove tagged docs
npm run test:manual:status <branch> [slot]   # show state, drift, failures
npm run test:manual:unlock <branch> [slot]   # force-release a stale lock
npm run test:manual:gen-catalog              # regenerate CATALOG.md
npm run seed:demo                            # apply the demo manifest

# Flags: --json --dry-run --verbose --yes --force <id> --allow-main-db --allow-remote
```

## PR comment template

See `pr-comment-template.md` in this directory.
