# Review Skills: More Autonomy, Leaner Review

**Date:** 2026-05-30
**Status:** Approved (pending spec review)
**Skills affected:** `review-code`, `review-plan`, `audit-debt`

## Motivation

The review skills stop for two kinds of approval that add little value:

1. **Up-front dispatch gate.** Each skill enters plan mode, shows a dispatch
   summary, and waits for the user to approve before dispatching the specialist
   agents. The user always accepts — the skill is already doing what they want.
   The gate is pure ceremony.

2. **Over-broad per-finding review.** The skills ask the user about findings the
   agent already knows it should just fix. The user only wants to weigh in where
   there's a genuine decision: when the agent recommends _not_ fixing, or when it
   wants to fix something but there's a real choice in _how_.

Separately, the autonomous "loop until no Criticals/Importants remain" behavior
exists only in `review-code`'s default path. The user wants the autonomous
spirit extended to the other two skills — adapted to what each skill actually
does (`review-plan` reviews a document; `audit-debt` documents debt and never
touches code).

## Change A — Remove the up-front dispatch gate

Applies identically to all three skills. Each has a `### 2. Plan Dispatch`
section shaped:

> Enter plan mode via `EnterPlanMode`. Show the user: [summary bullets]
> Exit plan mode via `ExitPlanMode` and wait for approval before dispatching.

Replace with: **print the same summary bullets as a plain status message (no
approval prompt), then dispatch the specialists immediately.**

Edits:

- Rename the section `### 2. Plan Dispatch` → `### 2. Dispatch Summary`.
- Reword the opening line (e.g. `Enter plan mode via EnterPlanMode. The dispatch
plan shows the user:`) → `Print this dispatch summary, then dispatch the
specialists immediately:`.
- Delete the closing `Exit plan mode via ExitPlanMode and wait for approval…`
  line in each skill.
- **review-code only:** trim the entangled parenthetical on the `Skill:`
  bullet (`(so the orchestrator can reload the skill via the Skill tool if plan
mode is re-entered)`) — the re-entry rationale dies with plan mode. Leave the
  bullet as plain `**Skill:** review-code`.

The bulleted summary content (target, diff/file count, specialists, session dir,
focus notes, etc.) is kept verbatim — it is informative, just no longer gated.

**Not touched:** the historical record at
`docs/superpowers/plans/2026-05-27-review-suite.md:660` mentions entering plan
mode, but it documents an already-executed plan; editing it would rewrite
history for no behavioral benefit.

## Change B — Unified review gate (POV-driven)

**Principle:** _Only stop to ask the user about a finding when the agent's
recommendation leaves a genuine decision._ The agent's point of view (POV:
**Fix** / **Skip** / **Defer**, already defined in `REVIEW.md`) drives the gate.

This requires the POV step to emit a POV for **every** finding under
consideration — not just the judgment-call ones, as `review-code`'s triage does
today.

The gate instantiates slightly differently per context, because the
"auto-handled" action differs (fix vs. include-in-report vs. propose-as-issue):

| Context                                                 | Auto-handle (no question)                                      | Stop and ask the user                                                                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fix loops** (`review-code` default, `review-plan`)    | POV=Fix **and** the fix is mechanical                          | POV=Skip, POV=Defer, **or** POV=Fix with a judgment call on _how_ (multiple valid approaches / `tradeoff` / UX design / changes product behavior) |
| **`review-code` read-only** (`--review-only`, `--post`) | POV=Fix → auto-include in report / auto-select for posting     | POV=Skip, POV=Defer                                                                                                                               |
| **`audit-debt`** (proposes GitHub issues)               | POV=Fix **and** POV=Defer → auto-include in proposed issue set | POV=Skip / borderline                                                                                                                             |

Rationale for the per-context differences:

- The **judgment-call-on-how** exception only matters where an actual fix is
  applied (the fix loops). In read-only/posting/issue contexts nothing is being
  fixed, so the only decision is include-or-not.
- For **`audit-debt`**, filing an issue _is_ deferring work to a backlog, so
  POV=**Defer** ("real debt, schedule it") belongs in the proposed set just as
  much as POV=Fix. Only POV=Skip ("not worth paying down") is a real
  should-we-even-track-this question.

### `review-code` specifics

Today: triage classifies `auto_fix` vs `needs_user` and emits a POV only for
`needs_user` findings; the fix batch is `auto_fix ∪ user-approved`.

After:

- Triage emits, for **every** effective finding: a mechanical-vs-judgment
  classification **and** a POV (Fix/Skip/Defer).
- **Auto-fix batch** = findings with POV=Fix **and** mechanical.
- **Presented to the user** = findings with POV∈{Skip, Defer} **or** (POV=Fix
  **and** judgment call). Same consolidated `AskUserQuestion` presentation and
  `resolutions.json` recording as today; same skip-set / skipped-blocking
  bookkeeping; same fixer/escalation contract (the fixer escalates a finding it
  genuinely can't decide — the safety valve for auto-fixed judgment-adjacent
  cases).
- **Net behavior change:** a mechanically-fixable finding the agent recommends
  _skipping_ is now surfaced to the user instead of being blindly fixed; and the
  `--review-only` / `--post` paths stop presenting _every_ Critical/Important —
  they auto-include/auto-select the POV=Fix ones and only ask about Skip/Defer.

`review-code`'s disk artifacts under `$SESSION_DIR` are **unchanged** — its long
autonomous loop needs compaction-resumability.

## Change C — `review-plan` becomes an auto-revise loop

Today `review-plan` is a single pass that compiles findings and, on a final
"Save annotations?" prompt, writes a `<plan-stem>-review.md` file into the repo.

After:

- **Loop:** dispatch the 4 reviewers on the plan → compile → **print the
  findings in chat** → auto-apply the mechanical POV=Fix revisions **directly to
  the plan document** → ask the user on the gated findings (judgment-call Fix,
  Skip, Defer) per Change B → re-review the revised plan → repeat **until no
  Critical/Important findings remain** (mirrors `review-code`'s exit condition).
- **No findings markdown written into the repo.** The old
  `<plan-stem>-review.md` annotations deliverable is removed; findings are
  printed in chat each round, and the deliverable is the **revised plan doc
  itself**. The session-dir subagent JSON plumbing (`$SESSION_DIR/findings-*.json`,
  `compiled.json`, `meta.json`, etc.) is **kept as-is** — it lives in the session
  dir, not the repo, and preserves compaction-resumability.
- The final terminal report (verdict + summary) is printed in chat, not saved.

## Change D — `audit-debt` becomes a discovery loop, never touches code

Today `audit-debt` is a single sweep producing a prioritized backlog, with
opt-in "save report" and "file issues one by one" offers.

After:

- **Discovery loop (not a fix loop):** repeat sweep passes, accumulating findings
  by identity across rounds, **until a pass surfaces no new Critical/Important
  findings** (loop-until-dry — catches what a single stochastic pass misses).
  **Hard cap: 7 rounds.** Log when the cap is hit so coverage truncation isn't
  silent.
- **Never edits code.** No fixer subagent, no commits, no working-tree changes.
  Remove any fix/commit/code-edit language. (`audit-debt` has none today beyond
  the shared templates — verify nothing fix-oriented leaks in.)
- **Consolidate at the end:** roll the surviving findings — **across all tiers,
  including Minor and Nit** — into a **proposed set of GitHub issues**. For
  Critical/Important, apply the Change B gate (auto-include POV=Fix and POV=Defer;
  ask only about Skip/borderline). Minor/Nit carry no POV today, so include them
  by default. **Do not mix tiers within a single issue** — a Critical/Important
  finding gets its own issue (or is grouped only with closely-related same-tier
  findings), and Minor/Nit findings are consolidated into their own separate
  lower-tier issue(s) rather than folded into a higher-tier one. Present the
  proposed set, then `gh issue create` the approved ones (existing title/body
  format and the `_Surfaced by /audit-debt_` footer are kept).
- The opt-in **"save report to a file?"** offer is **kept** (it's a deliberate,
  user-initiated save, not auto-pollution).
- `audit-debt`'s `$SESSION_DIR` artifacts are kept (resumable long loop).

## Out of scope

- Changing the specialist agents (`architecture-reviewer`, `code-reviewer`,
  `security-reviewer`, `test-reviewer`) or `REVIEW.md`'s severity/POV
  definitions.
- The per-finding `AskUserQuestion` presentation _format_ (severity tags,
  `file:line`, POV line, Modify/Downgrade/Skip options) — unchanged; only _which_
  findings reach it changes.
- `review-code`'s circuit breaker, fixer/escalation contract, and resumability
  tables — unchanged.

## Verification

- `grep -rniE "plan ?mode|EnterPlanMode|ExitPlanMode"` across the three
  `SKILL.md` files returns nothing.
- `review-plan/SKILL.md` contains no write of a `-review.md` / annotations
  markdown into the repo.
- `audit-debt/SKILL.md` contains no fixer/commit/code-edit language and caps the
  discovery loop at 7 rounds.
- The three skills' triage/POV instructions emit a POV for every finding, and the
  gate presents only Skip/Defer (+ judgment-call Fix in the fix loops).
