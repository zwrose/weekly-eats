# Renovate Setup — Design Spec

**Date:** 2026-05-29
**Issue:** #96 (set up renovate)
**Branch:** feat/96-add-renovate

## Goal

Automate dependency updates for weekly-eats using the **Mend hosted Renovate
GitHub App**, configured entirely through a `renovate.json` at the repo root.
Safe updates merge themselves once CI is green; risky (major) updates come to
the maintainer as reviewable PRs.

## Constraints & context

- npm project (`package-lock.json`), ~30 prod deps + ~22 devDeps.
- CI is GitHub Actions (`.github/workflows/ci.yml`), job name **`test`**,
  Node 20, running lint + tests + build on PRs to `main`.
- `main` is branch-protected — every change must land via a PR with passing CI.
- No existing Renovate or Dependabot config.

## Run mode

**Mend hosted GitHub App** (free for this repo). No self-hosted Action, no PAT,
no GitHub Actions runner minutes consumed by Renovate itself. Renovate reads
`renovate.json` from the default branch.

## Behavior

| Update class                                              | Behavior                                                                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| npm **minor/patch** (deps + devDeps)                      | Auto-merge after CI passes                                                                                                                     |
| npm **major** (e.g. Next 15→16, MUI 7→8)                  | PR only, labeled `major-update`, manual review + merge                                                                                         |
| **GitHub Actions** versions (`actions/checkout@v4`, etc.) | Auto-merge after CI passes                                                                                                                     |
| **Lock file maintenance**                                 | Weekly (Monday, before 5am `America/New_York`); refreshes transitive deps in `package-lock.json`; auto-merged                                  |
| **Security / vulnerability**                              | PR raised immediately regardless of any schedule, labeled `security`; follows the same merge rules (patch → auto-merge, major → manual review) |
| **Cadence**                                               | Anytime (no schedule gate on regular updates)                                                                                                  |
| **Batching**                                              | One PR per package, **except** same-monorepo package families                                                                                  |

### Monorepo grouping exception

One-PR-per-package is the rule, with one deliberate exception: packages
published together from a single monorepo are grouped into one PR because they
must move in lockstep. Updating `@mui/material` without `@mui/icons-material`
(or `@dnd-kit/core` without its siblings) yields a PR that fails to build. This
grouping comes from `config:recommended`'s `group:monorepos` preset and is kept
intentionally. Affected families in this repo include `@mui/*`, `@dnd-kit/*`,
`@testing-library/*`, and `@emotion/*`. Unrelated packages still get their own
PRs.

### Why auto-merge is safe here

`platformAutomerge: true` delegates to GitHub's native auto-merge, which only
merges once **required status checks pass**. Combined with branch protection on
`main`, an auto-merge PR cannot land unless the `test` CI job is green. A small
test suite can't catch every breaking change, which is exactly why **major**
updates are excluded from auto-merge and routed to manual review.

## Deliverables

1. **`renovate.json`** at repo root with:
   - `$schema` pointer for editor validation
   - `extends`: `config:recommended` (base), `:dependencyDashboard`,
     `:semanticCommits`
   - `timezone`: `America/New_York`
   - `labels`: `["dependencies"]`
   - `platformAutomerge: true`
   - `packageRules`:
     - minor/patch npm → `automerge: true`
     - major npm → `automerge: false`, add `major-update` label
     - github-actions manager → `automerge: true`
   - `lockFileMaintenance`: enabled, weekly schedule, `automerge: true`
   - `vulnerabilityAlerts`: `security` label (merge behavior inherited from
     `packageRules`)
2. **This spec** documenting the design + the manual GitHub steps below.

No changes to `ci.yml`, no new npm dependencies, no PAT.

## Manual steps (maintainer, in GitHub UI — outside this PR)

These cannot be done from a config file and must be performed by the repo owner:

1. **Install the Mend Renovate app** on the `weekly-eats` repo (via GitHub
   Marketplace / github.com/apps/renovate). Renovate then opens an onboarding
   PR — but since `renovate.json` will already exist, it should detect the
   config and the onboarding PR will be minimal/auto-closed. Merge if one
   appears.
2. **Enable "Allow auto-merge"** in repo Settings → General. `platformAutomerge`
   is a no-op without this toggle.
3. **Confirm the `test` job is a required status check** in branch protection
   for `main`. If it is not required, GitHub auto-merge could merge before CI
   finishes. (Verify; adjust if needed.)

## Out of scope

- Pinning GitHub Action SHAs (more secure, noisier — declined for now).
- Self-hosted Renovate runner / scheduled Action.
- Auto-merging major versions.
- Grouping unrelated package families beyond monorepo lockstep groups.

## Verification

- `renovate.json` validates against the Renovate JSON schema (editor / `npx
renovate-config-validator`).
- After the app is installed and config merged, the Renovate **Dependency
  Dashboard** issue appears, listing detected updates.
- First few PRs confirm expected behavior: a patch PR auto-merges on green CI; a
  major PR stays open with the `major-update` label.
