---
status: approved
date: 2026-05-27
author: zwrose
---

# Review-Code Auto-Fix Loop Design

Evolve `/review-code` from an interactive, one-finding-at-a-time approval tool into an autonomous review → fix → re-review loop. The loop fixes everything that doesn't need human judgment, re-reviews, and repeats until no Critical/Important findings remain — handing control back only for genuine tradeoffs, UX judgment calls, or a stuck loop.

## Context

`/review-code` (shipped in PR #74) runs five specialist agents in parallel, compiles their findings, and walks the user through an **interactive tiered approval** — Critical/Important findings one at a time, Minor/Nit batched. This presentation model was ported from loupe's `review-pr`.

For this user it is too hands-on. Their actual workflow on any PR is: **fix everything that doesn't have a good reason not to fix, then if Importants or Criticals remain, review again — and loop until they're gone.** Today that loop is manual: run `/review-code`, approve findings, fix them by hand or in a follow-up, run `/review-code` again, repeat. The skill should automate the loop and pull the user in only when their judgment actually matters.

This **reverses a Non-Goal** from the original review-suite design (`2026-05-27-review-suite-design.md`), which listed "Auto-fix mode" as explicitly out of scope. That stance was correct for the suite's first cut; the user has since decided auto-fix-with-loop is their default, and this spec supersedes that Non-Goal for `/review-code` specifically.

The other two skills in the suite (`/review-plan`, `/audit-debt`) and the five specialist agents are unchanged except for one small additive field on the findings JSON (`tradeoff`). `REVIEW.md` gains a triage rubric section.

## Goals

1. **Automate the fix/re-review loop.** Running `/review-code` should drive findings to zero Critical/Important without the user shepherding each round.
2. **Fix everything mechanical by default.** Determinate fixes (missing `userId` filter, missing `ObjectId.isValid`, hardcoded error string, missing `aria-label`, missing test) get applied without asking.
3. **Pull the user in only for judgment.** Genuine tradeoffs and UX design calls are surfaced; everything else proceeds autonomously.
4. **Detect stuck loops without being twitchy.** A circuit breaker halts churn but tolerates normal multi-round convergence.
5. **Never layer fixes on a broken tree.** Each round's fixes must pass `npm run check` before the next review.
6. **Stay resumable.** All loop state lives on disk so the skill survives context compaction mid-loop.
7. **Preserve the existing read-only and GitHub-posting behaviors** as explicit opt-outs.

## Non-Goals

- Auto-**push**. The loop commits locally; pushing stays a deliberate user action after the loop exits.
- Modifying the five specialist agents' review methodology (beyond adding the additive `tradeoff` field).
- Changing `/review-plan` or `/audit-debt`.
- Modifying superpowers' brainstorm / writing-plans / subagent-driven-development flow.
- A separate `/fix` or `/simplify` skill. The loop lives inside `/review-code` (one skill, one mental model — per the user's decision).
- Nested worktree management. The loop commits on whatever branch/worktree the user invoked it from.

## Audience and Calibration

Same as the review suite: solo PM-coder, personal single-user app, stack-fixed (Next.js 15 / React 19 / MUI v7 / MongoDB / NextAuth / Vitest + Testing Library + MSW). The loop's autonomy bias exists _because_ this user trusts mechanical fixes and wants to spend their attention only on judgment calls.

## Architecture & Loop Workflow

`/review-code` becomes an autonomous loop. The main context is the **orchestrator**; subagents do all heavy reading and the fixing. State lives under `$SESSION_DIR/round-N/` so the loop is resumable.

### Modes (invocation surface unchanged)

| Form                           | Behavior                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `/review-code`                 | **NEW default:** auto-fix loop (auto-detects PR vs branch mode for the _review_ step; fixes commit locally either way). |
| `/review-code --review-only`   | Old interactive tiered presentation. Review, present findings, no commits.                                              |
| `/review-code pr <N> --post`   | Read-only. Post findings as inline GitHub comments. Never touches the tree. (Unchanged.)                                |
| `/review-code --focus <notes>` | As today; combinable with the above.                                                                                    |

`--review-only` and `--post` are the two escape hatches from auto-fix. Everything else loops.

### Per-round workflow

1. **Review.** Dispatch the five specialists in parallel (unchanged prompts + the new `tradeoff` field). Each writes `round-N/findings-<agent>.json`.
2. **Compile + dedupe.** Existing pipeline: citation check, diff-scope verification, reachability pre-check on Importants, dedupe by `(file, line)`, author-justification filter (PR mode), Nit cap. Writes `round-N/compiled.json` with verdict.
3. **Triage.** Dispatch a single triage subagent. It reads `compiled.json` (findings + suggested fixes + cited code) and classifies each finding `auto_fix` or `needs_user` per the rubric in `REVIEW.md`. Writes `round-N/triage.json`.
4. **User interventions (only if `needs_user` is non-empty).** One consolidated `AskUserQuestion` prompt. Per deferred finding: **Fix as suggested** / **Fix with my guidance** (free text) / **Skip**. Auto-fix findings are listed as an FYI, no per-item action. Resolutions saved to `round-N/resolutions.json`. If `needs_user` is empty, no prompt — the round just proceeds.
5. **Fix.** Dispatch a single fixer subagent with the union of `auto_fix` findings + user-approved `needs_user` findings (with any user guidance). The fixer applies all changes, runs `npm run check`, retries once on failure, and commits in **one commit**: `Auto-fix round N: <count> findings (<dimensions>)`. It reports what it fixed, what it couldn't, and any new issues it noticed.
6. **Verification.** Orchestrator independently re-runs `npm run check`. **If it fails, the loop halts** and surfaces the failure — never re-review on a broken tree.
7. **Circuit-breaker check.** Deterministic comparison of round-N findings vs round-(N−1). Halt if a stuck criterion trips (see below).
8. **Loop or exit.** If any Critical/Important findings remain and no halt condition fired, regenerate the diff locally (`git diff <baseRef>...HEAD`, see PR Mode below) and go to round N+1. Otherwise exit.

### Exit conditions

| Condition                             | Outcome                                                           |
| ------------------------------------- | ----------------------------------------------------------------- |
| 0 Critical, 0 Important after a round | **SUCCESS** — print final verdict + diff summary + offer to push. |
| `npm run check` fails after fix       | **HALT** — surface failure output; loop stops.                    |
| Circuit breaker trips                 | **HALT** — surface which criterion + open findings + diff so far. |
| Max iterations (7) reached            | **HALT** — surface remaining findings + diff so far.              |

### State on disk

```
$SESSION_DIR/
  meta.json                      # mode, pr, repo, branch, baseRef, headSha, focusNotes, maxRounds
  round-1/
    findings-architecture.json   # ... and code/security/a11y/test
    compiled.json
    triage.json
    resolutions.json             # only if interventions occurred
  round-2/
    ...
```

`diff.txt` is regenerated per round (the tree changes between rounds) and lives at `round-N/diff.txt`. After compaction the orchestrator re-reads `meta.json` + the highest-numbered `round-N/` to resume. The orchestrator never `cat`s a diff — only `wc -l`.

## Triage Rubric

Lives in `REVIEW.md` (new section), applied by the triage subagent. **Bias toward `auto_fix`.** A finding is `needs_user` only when the _fix_ — not merely the surface area — involves judgment.

A finding → `needs_user` when **any** of:

- An agent set `tradeoff: true` (multiple valid fix approaches identified). Treated as authoritative.
- The fix is a **UX judgment call**: user-visible copy/wording, layout or visual change, interaction-model choice, empty/error-state design — _and more than one reasonable design exists_.
- The fix would **change established product behavior** in a way the user might have an opinion on.

A finding → `auto_fix` when the fix is **mechanical / determinate**, e.g.:

- Add a missing `userId` filter; add an `ObjectId.isValid()` guard; replace a hardcoded string with an error constant from `@/lib/errors`.
- Add an `aria-label` to an icon button; add a `KeyboardSensor`; fix a focus-order bug with one correct answer.
- Add a missing test; fix a clear logic bug.

The decisive UX example: **"add an aria-label to this icon button"** is mechanical → `auto_fix`. **"this modal's focus trap fights the drawer — pick an interaction model"** is a judgment call → `needs_user`. A triage _subagent_ (not a static flag) is required precisely because it can read the finding and the cited code to tell those apart.

### `tradeoff` field

New **optional boolean** on the findings JSON, settable by any specialist agent when it spots multiple valid approaches mid-review. It's a cheap explicit hint that forces `needs_user`. The triage agent also catches tradeoffs the specialists missed — the flag is additive, not the only path.

## Circuit Breaker

Deterministic orchestrator logic between rounds (no subagent). **Finding-identity comparison, not just counts.** Intentionally **un-sensitive** — normal 2-3 round convergence must never trip it. Halts only when:

1. **Recurring finding (2 rounds).** A finding with the same `(file, normalized-title)` appears in two consecutive rounds despite a fix being committed for it. The fix isn't landing.
2. **No net progress (2 rounds).** Critical+Important count fails to decrease across two consecutive rounds (and isn't zero). Churn.
3. **Max iterations.** Default **7** rounds.

Plus the hard `npm run check`-failure halt (separate from the breaker).

**Explicitly NOT a halt trigger:** a single round where a fix introduces a new Critical/Important finding. Fixing one issue often surfaces a legitimately adjacent one — that's progress, not stuck. New findings introduced by a fix are **noted in the round summary as informational** so the user can see them, but they don't halt on their own. (If a bad fix truly persists, criterion 1 catches it; if the fixer can't get ahead, criterion 2 catches it.)

`normalized-title` = finding title lowercased, trimmed, punctuation-stripped — enough to match "the same finding" across rounds even if line numbers shifted.

## PR Mode, Commits & Verification

**PR-mode behavior.** When `/review-code` auto-detects an open PR on the current branch (no `--post`), it runs the **same auto-fix loop** — the PR is on the user's branch, so fixes are commits they'd make anyway. It does **not** auto-push. `--post` is the explicit read-only path for reviewing a PR you don't intend to modify.

**Auto-fix requires the PR's branch checked out locally.** You can only commit fixes onto a branch you have. Before looping in PR mode the orchestrator verifies the current branch matches the PR's `headRefName` (and HEAD matches, or the local branch is ahead of, the PR head). If it doesn't — detached HEAD, or you're reviewing someone else's PR you don't have checked out — auto-fix is invalid; the orchestrator stops and tells the user to use `--post` (post comments) or `--review-only` (read-only terminal report). No detached `git worktree` is created in the auto-fix path.

**Diff source per round.** The diff is computed **locally** as `git diff <baseRef>...HEAD` every round, in both branch and PR mode (`baseRef` is `main` in branch mode, the PR's `baseRefName` in PR mode, stored in `meta.json`). This matters because rounds 2+ have local fix commits that aren't on the remote — `gh pr diff` would show a stale diff that omits the fixes. PR-specific data (`prior-comments.json` for author-justification) is fetched once at setup and reused; it's stable because the loop never pushes mid-run.

**Where fixes land.** Commits go on the **current branch directly**. No nested worktree — the user invokes `/review-code` from whatever worktree/branch they're on. One commit per round (`Auto-fix round N: …`); per-round granularity keeps loop progress legible and the eventual squash-merge collapses them.

**Verification gate.** The fixer self-runs `npm run check` and retries once on failure. The orchestrator independently re-runs `check` after the fixer reports. Failure halts the loop before the next review.

## Intervention UX

At the top of each round, _after_ triage, if `needs_user` is non-empty:

- **One consolidated prompt.** Not one-per-finding, not mid-fix interruptions.
- Per deferred finding, via `AskUserQuestion`:
  - **Fix as suggested** — apply the agent's suggested fix.
  - **Fix with my guidance** — free text; the user tells the fixer how to approach it.
  - **Skip** — don't fix; won't block the verdict; recorded as deliberately skipped (and not re-raised in later rounds).
- Auto-fix findings appear in the same prompt as an FYI list ("will auto-fix these N") with no per-item action required.

If a round has zero `needs_user` findings, there is **no prompt** — the loop runs unattended.

**End-of-loop summary:** final verdict, rounds run, commits created, findings fixed by severity, anything skipped, and any informational regressions noted along the way. Then — because fixes are local-only — an offer to push (or, for a PR being reviewed for someone else, a pointer to `--post`).

## Deliverables

### 1. `.claude/skills/review-code/SKILL.md` (rewrite)

The big change. Restructure the workflow from "review → compile → interactive presentation → output" into the per-round loop above. New sections: Loop Workflow, Triage step, Fixer dispatch, Circuit Breaker, per-round session layout. Preserve `--review-only` (old interactive presentation) and `--post` (GitHub posting + `resolve-diff-lines.ts`, unchanged). Update the Common Mistakes table.

### 2. `REVIEW.md` (additive)

New **Triage Rubric** section (auto_fix vs needs_user, the UX distinction, the `tradeoff` field). New row in Findings Output Format documenting the optional `tradeoff` boolean. No changes to severity tiers or verdict mapping.

### 3. `.claude/agents/*.md` (minimal, all five)

Add a short instruction to each specialist: "If a finding has multiple valid fix approaches, set `tradeoff: true`." One or two sentences each; methodology unchanged.

### 4. Fixer + triage subagent prompts

Two new dispatch prompt templates, embedded in SKILL.md (consistent with how the five specialist prompts are templated there today). The fixer prompt enforces: apply only the given findings, follow project conventions, run `npm run check`, retry once, commit with the round message, report structured results. The triage prompt enforces the rubric and emits `triage.json`.

### 5. Tests

Unit tests for any new deterministic helper (circuit-breaker finding-identity comparison, `normalized-title` derivation) if extracted to a `.ts` module alongside `resolve-diff-lines.ts`. Reuse the existing `.claude/**/*.{test,spec}.ts` vitest include.

### 6. `CLAUDE.md` (doc touch-up)

Update the `/review-code` row in the skills table and the Review Workflow section to describe the auto-fix loop default and the `--review-only` opt-out.

## Rollout Sequence

1. `REVIEW.md` triage rubric + `tradeoff` field doc.
2. Specialist agents: add `tradeoff` instruction.
3. Extract circuit-breaker / normalized-title helper to a tested `.ts` module (if warranted) + tests.
4. Rewrite `SKILL.md`: loop workflow, triage dispatch, fixer dispatch, circuit breaker, per-round state, preserved `--review-only` / `--post`.
5. `CLAUDE.md` doc touch-up.
6. Self-review the rewritten skill against `REVIEW.md` rules; dogfood the loop on a trivial synthetic finding if feasible.
7. `npm run check`; open PR.

## Success Criteria

- `/review-code` with no flags runs review → triage → fix → re-review unattended on a branch with only mechanical findings, converging to READY without prompting.
- A branch containing one genuine tradeoff finding pauses exactly once, at the top of the relevant round, with a single consolidated prompt.
- The circuit breaker does **not** fire on a normal 2-3 round convergence.
- `--review-only` reproduces the current interactive behavior; `--post` reproduces current GitHub posting.
- The loop is resumable: deleting the orchestrator's memory of state mid-loop and re-reading `$SESSION_DIR` restores it.
- `npm run check` passes (lint + test + build).

## Out of Scope

- Auto-push and auto-merge.
- Parallelizing the fixer across dimensions (single fixer per round, for holistic reasoning and no file collisions).
- A "verifier agent" that re-reviews fixer output (violates single-pass discipline; the next round's full review _is_ the verification).
- Configurable per-project triage rubrics beyond editing `REVIEW.md`.
- Changing how `resolve-diff-lines.ts` works.

## Risks

- **Triage misclassification.** A UX judgment call slips through as `auto_fix`. Mitigation: the final diff is the user's to review before pushing; the loop never pushes.
- **Fixer thrash.** A fix that doesn't address the finding causes recurrence. Mitigation: circuit-breaker criterion 1 (recurring finding, 2 rounds).
- **Cost.** Each round is 5 specialists + 1 triage + 1 fixer = 7 subagent dispatches. Mitigation: max 7 rounds; most convergence is 2-3 rounds; specialists return `[]` cheaply when there's nothing to flag.
- **Compaction mid-loop.** Mitigation: all state on disk under `$SESSION_DIR/round-N/`; orchestrator resumes from the highest round.
