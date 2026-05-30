# Review Skills Autonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three review skills more autonomous — drop the up-front plan-mode dispatch gate, only ask the user about findings the agent recommends _not_ fixing (plus judgment-call fixes), turn `review-plan` into an auto-revise loop with no repo-polluting findings file, and turn `audit-debt` into a code-untouching discovery loop that consolidates findings into proposed GitHub issues.

**Architecture:** All edits are to three `SKILL.md` prose files under `.claude/skills/` (`review-code`, `review-plan`, `audit-debt`). These files are _instructions to an orchestrator agent_, not executable code. There are no unit tests for them; verification is `grep` invariants plus reading the edited section back for coherence. The `.ts` helpers (`circuit-breaker.ts`, `resolve-diff-lines.ts`) and their tests are **not** touched. A PostToolUse hook runs Prettier on every `.md` edit — expect reformatting (line re-wrapping); this is benign.

**Tech Stack:** Markdown (Claude Code skill files), bash/grep for verification, `gh` CLI (referenced inside audit-debt prose only).

**Spec:** `docs/superpowers/specs/2026-05-30-review-skills-autonomy-design.md`

**Editing convention:** The artifacts being edited _are_ skill files, so preserve each `SKILL.md`'s existing structure, heading style, and voice (per superpowers:writing-skills). Change behavior, not house style.

---

## File Structure

| File                                  | Responsibility                                       | Changes                                                                               |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `.claude/skills/review-code/SKILL.md` | Diff/PR review orchestrator (loop + read-only paths) | Change A (§2), Change B (triage prompt, loop steps 7–8, read-only paths)              |
| `.claude/skills/review-plan/SKILL.md` | Plan-doc review orchestrator                         | Change A (§2), Change C (§5 → auto-revise loop; remove annotations file)              |
| `.claude/skills/audit-debt/SKILL.md`  | Full-repo debt sweep orchestrator                    | Change A (§2), Change D (§5 → discovery loop + consolidated issues, never edits code) |

Tasks are ordered: Task 1 = the uniform mechanical change across all three (Change A); Tasks 2–4 = the per-skill behavioral rewrites; Task 5 = whole-suite verification.

---

## Task 1: Change A — remove the up-front dispatch gate (all three skills)

**Files:**

- Modify: `.claude/skills/review-code/SKILL.md:160-182`
- Modify: `.claude/skills/review-plan/SKILL.md:86-99`
- Modify: `.claude/skills/audit-debt/SKILL.md:84-99`

- [ ] **Step 1: Edit `review-code` §2.** Replace this exact block:

```markdown
### 2. Plan Dispatch

Enter plan mode via `EnterPlanMode`. The dispatch plan shows the user:

- **Skill:** `review-code` (so the orchestrator can reload the skill via the `Skill` tool if plan mode is re-entered)
- **Mode:** PR or branch
```

with:

```markdown
### 2. Dispatch Summary

Print this dispatch summary as a plain status message, then dispatch the specialists immediately (no approval gate):

- **Skill:** `review-code`
- **Mode:** PR or branch
```

- [ ] **Step 2: Remove the `ExitPlanMode` line in `review-code` §2.** Delete this exact line (and the blank line immediately above it):

```markdown
Exit plan mode via `ExitPlanMode` and wait for user approval before dispatching.
```

(The preceding paragraph "Do **not** tier or skip specialists…" becomes the last paragraph of the section.)

- [ ] **Step 3: Edit `review-plan` §2.** Replace this exact block:

```markdown
### 2. Plan Dispatch

Enter plan mode via `EnterPlanMode`. Show the user:
```

with:

```markdown
### 2. Dispatch Summary

Print this dispatch summary as a plain status message, then dispatch the specialists immediately (no approval gate):
```

- [ ] **Step 4: Remove the `ExitPlanMode` line in `review-plan` §2.** Delete this exact line (and the blank line immediately above it):

```markdown
Exit plan mode via `ExitPlanMode` and wait for approval before dispatching.
```

- [ ] **Step 5: Edit `audit-debt` §2.** Replace this exact block:

```markdown
### 2. Plan Dispatch

Enter plan mode via `EnterPlanMode`. Show the user:
```

with:

```markdown
### 2. Dispatch Summary

Print this dispatch summary as a plain status message, then dispatch the specialists immediately (no approval gate):
```

- [ ] **Step 6: Remove the `ExitPlanMode` line in `audit-debt` §2.** Delete this exact line (and the blank line immediately above it):

```markdown
Exit plan mode via `ExitPlanMode` and wait for approval before dispatching.
```

- [ ] **Step 7: Verify no plan-mode references remain.**

Run: `grep -rniE "plan ?mode|EnterPlanMode|ExitPlanMode" .claude/skills/review-code/SKILL.md .claude/skills/review-plan/SKILL.md .claude/skills/audit-debt/SKILL.md`
Expected: no output (exit code 1).

- [ ] **Step 8: Verify the section was renamed in all three.**

Run: `grep -rn "### 2. Dispatch Summary" .claude/skills/review-code/SKILL.md .claude/skills/review-plan/SKILL.md .claude/skills/audit-debt/SKILL.md`
Expected: three matches, one per file.

- [ ] **Step 9: Commit.**

```bash
git add .claude/skills/review-code/SKILL.md .claude/skills/review-plan/SKILL.md .claude/skills/audit-debt/SKILL.md
git commit -m "refactor(review-skills): drop up-front plan-mode dispatch gate

Replace EnterPlanMode/ExitPlanMode + wait-for-approval with a plain
printed dispatch summary, then dispatch immediately. Rename the section
to 'Dispatch Summary' in all three skills.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Change B — POV-driven review gate in `review-code`

**Files:**

- Modify: `.claude/skills/review-code/SKILL.md` — triage subagent prompt (~336-382), Auto-Fix Loop steps 7–8 (~315-324), Read-Only `--review-only` / `--post` presentation (~429-458)

The gate principle: **auto-fix** ⟺ `recommendation == Fix` AND `classification == mechanical`; **present to the user** ⟺ `recommendation ∈ {Skip, Defer}` OR (`recommendation == Fix` AND `classification == judgment`). This requires the triage subagent to emit a POV for _every_ finding (today it emits one only for `needs_user` findings) and to rename its classification values from `auto_fix`/`needs_user` to `mechanical`/`judgment` (the classification is now purely about fix complexity; the route decision is POV-driven).

- [ ] **Step 1: Rewrite the triage subagent's "Your job" + "Orchestrator POV" + "Output" sections.** Replace this exact block:

```markdown
## Your job

Classify EACH listed finding as "auto_fix" or "needs_user" per the rubric.
Bias hard toward auto_fix. Mark needs_user ONLY when the FIX involves judgment:

- finding.tradeoff === true → always needs_user
- UX judgment call (copy, layout, interaction model, empty/error-state design)
  AND more than one reasonable design exists → needs_user
- the fix would change established product behavior the user may have an
  opinion on → needs_user
  Everything else (mechanical/determinate fix) → auto_fix.

Read the cited file before deciding. "Replace the hardcoded 'Not found'
string with FOOD_ITEM_ERRORS.FOOD_ITEM_NOT_FOUND" = mechanical = auto_fix.
"This empty-state needs copy and a layout decision" = judgment = needs_user.

## Orchestrator POV (needs_user findings only)

For EACH finding you classify "needs_user", also emit the orchestrator's point
of view — this is what the user will see when the loop stops to ask them. You
already read the cited code to classify; use it. Per REVIEW.md "Orchestrator
POV", emit:

- recommendation: "Fix" | "Skip" | "Defer"
  - Fix = correct and worth the change here.
  - Skip = good reason not to (correct-but-not-worth-it in this single-user
    app, cost > benefit, or borderline/likely-false-positive on a closer read).
  - Defer = real but not now/not here (big-job, out of scope for this change).
- rationale: one sentence saying why.
- confidence: "High" | "Low" (Low = genuinely unsure; flags it for scrutiny).
  Omit these three fields for auto_fix findings (their POV is implicitly Fix).

## Output

Write $SESSION_DIR/round-<N>/triage.json — every listed finding id exactly once:
[ { "id": "<id>", "classification": "auto_fix" | "needs_user", "reason": "<one sentence>",
"recommendation": "Fix" | "Skip" | "Defer", "rationale": "<one sentence>", "confidence": "High" | "Low" } ]
(recommendation/rationale/confidence present only on needs_user entries.)
```

with:

```markdown
## Your job

For EACH listed finding, emit TWO things — a fix-complexity classification AND an
orchestrator POV. Read the cited file before deciding; use what you read for both.

### 1. classification: "mechanical" or "judgment"

This is about the FIX, not whether to fix. Mark "judgment" ONLY when applying the
fix involves a real choice:

- finding.tradeoff === true → judgment
- UX judgment call (copy, layout, interaction model, empty/error-state design)
  AND more than one reasonable design exists → judgment
- the fix would change established product behavior the user may have an
  opinion on → judgment
  Everything else (one determinate, obviously-correct fix) → mechanical. Bias hard
  toward mechanical. "Replace the hardcoded 'Not found' string with
  FOOD_ITEM_ERRORS.FOOD_ITEM_NOT_FOUND" = mechanical. "This empty-state needs copy
  and a layout decision" = judgment.

### 2. recommendation (orchestrator POV) — EVERY finding

Per REVIEW.md "Orchestrator POV", emit for every finding (this drives whether the
loop fixes it silently or stops to ask the user):

- recommendation: "Fix" | "Skip" | "Defer"
  - Fix = correct and worth the change here.
  - Skip = good reason not to (correct-but-not-worth-it in this single-user
    app, cost > benefit, or borderline/likely-false-positive on a closer read).
  - Defer = real but not now/not here (big-job, out of scope for this change).
- rationale: one sentence saying why.
- confidence: "High" | "Low" (Low = genuinely unsure; flags it for scrutiny).

## Output

Write $SESSION_DIR/round-<N>/triage.json — every listed finding id exactly once:
[ { "id": "<id>", "classification": "mechanical" | "judgment", "reason": "<one sentence>",
"recommendation": "Fix" | "Skip" | "Defer", "rationale": "<one sentence>", "confidence": "High" | "Low" } ]
(All four POV-related fields are present on EVERY entry.)
```

- [ ] **Step 2: Rewrite Auto-Fix Loop step 7 (Interventions).** Replace this exact block:

```markdown
7. **Interventions.** `needs_user` = effective findings classified `needs_user`.
   - If non-empty: present ONE consolidated `AskUserQuestion`. For each deferred finding, **lead with the orchestrator POV** from `triage.json` (per REVIEW.md "Orchestrator POV") — show the recommendation, rationale, and confidence right under the finding, e.g. `→ POV: Skip (Low confidence) — correct in theory but this path is single-user and never hit concurrently`. Then offer **Fix as suggested** / **Fix with my guidance** (free text) / **Skip** — keep the options in this neutral order regardless of the POV; the POV informs, it does not pre-select. List the `auto_fix` findings in the same prompt as an FYI (no per-item action; their POV is implicitly Fix). Write `round-<round>/resolutions.json`:
```

with:

```markdown
7. **Interventions.** `present-set` = effective findings where `recommendation` is `Skip` or `Defer`, OR (`recommendation` is `Fix` AND `classification` is `judgment`). These are the only findings with a genuine decision left for the user; everything the agent recommends fixing mechanically is handled in step 8 without asking.
   - If non-empty: present ONE consolidated `AskUserQuestion`. For each finding, **lead with the orchestrator POV** from `triage.json` (per REVIEW.md "Orchestrator POV") — show the recommendation, rationale, and confidence right under the finding, e.g. `→ POV: Skip (Low confidence) — correct in theory but this path is single-user and never hit concurrently`. Then offer **Fix as suggested** / **Fix with my guidance** (free text) / **Skip** — keep the options in this neutral order regardless of the POV; the POV informs, it does not pre-select. List the auto-fix findings (`recommendation` Fix AND `classification` mechanical) in the same prompt as an FYI (no per-item action; they are fixed automatically). Write `round-<round>/resolutions.json`:
```

- [ ] **Step 3: Update the skip-set sentence at the end of step 7.** Replace this exact text:

```markdown
     Add every `skip` identity to the skip-set; if a skipped finding is Critical or Important, also remember it as a **skipped-blocking** finding (its `severity` is recorded in `resolutions.json` so this survives compaction). `approved` = entries with action `fix`/`fix-with-guidance` (carry `guidance`).
```

with:

```markdown
     Add every `skip` identity to the skip-set; if a skipped finding is Critical or Important, also remember it as a **skipped-blocking** finding (its `severity` is recorded in `resolutions.json` so this survives compaction). `approved` = `present-set` entries with action `fix`/`fix-with-guidance` (carry `guidance`).
```

- [ ] **Step 4: Rewrite Auto-Fix Loop step 8 (Fix batch).** Replace this exact block:

```markdown
8. **Fix batch.** `auto_fix` = effective findings classified `auto_fix`. `fix-batch` = `auto_fix ∪ approved`. Write `round-<round>/fix-batch.json` (full finding objects; attach `userGuidance` to any with guidance).
```

with:

```markdown
8. **Fix batch.** `auto-fix-set` = effective findings where `recommendation` is `Fix` AND `classification` is `mechanical`. `fix-batch` = `auto-fix-set ∪ approved`. Write `round-<round>/fix-batch.json` (full finding objects; attach `userGuidance` to any with guidance).
```

- [ ] **Step 5: Add the gate to the `--review-only` presentation.** Replace this exact block:

```markdown
Open with the verdict banner and the one-line summary, then run the tiered presentation:

- **Critical and Important findings — individually.** For each, use `AskUserQuestion`. Header includes severity tag, dimension(s), and `file:line`. Body shows the finding text, the suggested fix, and — on its own line — the **POV**: e.g. `→ POV: Skip (Low confidence) — correct in theory but this path is single-user and never hit concurrently`. Options (keep this neutral order; the POV informs but does not pre-select):
```

with:

```markdown
**Apply the review gate.** Partition findings by POV: `auto-include` = `recommendation == Fix` (these enter the report without asking); `ask-set` = `recommendation` is `Skip` or `Defer` (these need your call). Only the `ask-set` is presented below; the `auto-include` set is added to the approved findings silently.

Open with the verdict banner and the one-line summary. If the `ask-set` is empty, skip straight to the report. Otherwise run the tiered presentation over the `ask-set` only:

- **Critical and Important findings (ask-set) — individually.** For each, use `AskUserQuestion`. Header includes severity tag, dimension(s), and `file:line`. Body shows the finding text, the suggested fix, and — on its own line — the **POV**: e.g. `→ POV: Skip (Low confidence) — correct in theory but this path is single-user and never hit concurrently`. Options (keep this neutral order; the POV informs but does not pre-select):
```

- [ ] **Step 6: Update the `--review-only` Minor/Nit batch line + the summary line to respect the gate.** Replace this exact block:

```markdown
- **Minor and Nit findings — batched, multi-select.** Present in batches of 4 via `AskUserQuestion` with multi-select. For each finding, show severity, `file:line`, a 2-3 sentence summary, and a compact POV tag (e.g. `POV: Fix (High)`). Always offer **Include all** and **Skip all** as alternatives at the bottom of the batch.

After the last batch, summarize how many of each severity were approved, then print a terminal report grouped by severity.
```

with:

```markdown
- **Minor and Nit findings (ask-set) — batched, multi-select.** Present in batches of 4 via `AskUserQuestion` with multi-select. For each finding, show severity, `file:line`, a 2-3 sentence summary, and a compact POV tag (e.g. `POV: Skip (Low)`). Always offer **Include all** and **Skip all** as alternatives at the bottom of the batch.

The approved set = `auto-include` ∪ the findings approved from the `ask-set`. After the last batch, summarize how many of each severity were approved, then print a terminal report grouped by severity.
```

- [ ] **Step 7: Note the gate in the `--post` path.** Replace this exact text:

```markdown
After the single pass (PR mode only), post approved findings to GitHub. No triage, no fix, no loop, no commits to the tree. Run the interactive tiered presentation above to select which findings to post — the orchestrator POV is shown to **you** during selection, but is **not** included in the posted comment body (the public comment stays the finding + suggestion).
```

with:

```markdown
After the single pass (PR mode only), post approved findings to GitHub. No triage, no fix, no loop, no commits to the tree. Run the interactive tiered presentation above (including its **review gate**) to select which findings to post: `recommendation == Fix` findings are auto-selected for posting, and only `Skip`/`Defer` findings are presented for your call. The orchestrator POV is shown to **you** during selection, but is **not** included in the posted comment body (the public comment stays the finding + suggestion).
```

- [ ] **Step 8: Verify no stale classification vocabulary remains in `review-code`.**

Run: `grep -nE "auto_fix|needs_user" .claude/skills/review-code/SKILL.md`
Expected: no output (exit code 1). (All occurrences are renamed to `mechanical`/`judgment`/`auto-fix-set`/`present-set`.)

- [ ] **Step 9: Verify the new gate vocabulary is present.**

Run: `grep -nE "present-set|auto-fix-set|auto-include|ask-set" .claude/skills/review-code/SKILL.md`
Expected: multiple matches across the loop and read-only sections.

- [ ] **Step 10: Read-back coherence check.** Read `.claude/skills/review-code/SKILL.md` lines ~307-340 (loop steps) and ~429-460 (read-only paths). Confirm: step 5's "If `effective` is empty → EXIT SUCCESS" and step 10's "If `fix-batch` is empty … EXIT" still make sense with the new `present-set`/`auto-fix-set` definitions, and that no step still references a `needs_user`/`auto_fix` field. No edit if coherent.

- [ ] **Step 11: Commit.**

```bash
git add .claude/skills/review-code/SKILL.md
git commit -m "feat(review-code): POV-driven review gate

Triage now emits a POV (Fix/Skip/Defer) for every finding and a
mechanical/judgment fix-complexity classification. The loop auto-fixes
only mechanical Fix findings; it stops to ask the user about Skip/Defer
findings and judgment-call Fix findings. The --review-only/--post paths
auto-include Fix findings and present only Skip/Defer.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Change C — `review-plan` becomes an auto-revise loop

**Files:**

- Modify: `.claude/skills/review-plan/SKILL.md` — Session Directory table (~35,40), §5 "Present + Interactive Output" (~199-220)

The skill currently does one pass and (optionally) writes a `<plan-stem>-review.md` annotations file into the repo. After this task it loops: review → print findings in chat → auto-apply mechanical Fix revisions to the plan doc → ask on the gated findings → re-review → repeat until no Critical/Important remain. No findings markdown is written into the repo. Subagent JSON plumbing under `$SESSION_DIR` is unchanged. Because subagents read the copy at `$SESSION_DIR/plan.md`, each round must edit the original `$PLAN_PATH` then refresh that copy before re-review.

- [ ] **Step 1: Replace the entire §5 section.** Replace this exact block (from the `### 5.` heading through the end of the "Interactive offer at end" paragraph):

```markdown
### 5. Present + Interactive Output

If context was compacted between dispatch and presentation, re-read `$SESSION_DIR/compiled.json` and `$SESSION_DIR/meta.json` to restore state.

**Form the orchestrator POV before presenting.** Per REVIEW.md "Orchestrator POV", for each Critical/Important finding read the cited source — the plan section in `$SESSION_DIR/plan.md` and, when the finding references existing code, the cited project file — and form a **Fix / Skip / Defer + one-sentence rationale + High/Low confidence** take. At plan time, "Fix" means revise the plan, "Defer" means it's a real gap the author can address during implementation rather than now, and "Skip" means it's not worth a plan change. This is the coordinator's own judgment from a small targeted read — not a re-review. For batched Minor/Nit, derive the POV from the finding text.

Open with the verdict banner and the one-line summary, then tier the presentation:

- **Critical and Important — individually** via `AskUserQuestion`. Header includes severity tag, dimension(s), and `file:line`. Body shows the finding text, the suggested fix, and — on its own line — the **POV** (e.g. `→ POV: Defer (High confidence) — real gap, but fine to nail down the test names during implementation`). For findings that propose specific plan text to rewrite, the body includes a `Suggested replacement:` block with the quoted source and the proposed text. Options (keep this neutral order; the POV informs but does not pre-select):
  - **Approve** — keep at current severity.
  - **Modify** — open a free-text edit for the finding body before approval.
  - **Downgrade** — drop one tier (Critical → Important, Important → Minor). Important → Minor is auto-approved at Minor.
  - **Skip** — exclude entirely.
- **Minor and Nit — batched, multi-select** via `AskUserQuestion`, batches of 4. Show severity, `file:line`, a 2-3 sentence summary, and a compact POV tag (e.g. `POV: Fix (High)`) per finding. Always offer **Include all** and **Skip all** at the bottom.

After all findings are reviewed, print a structured terminal report:

- Lead with the verdict label in bold.
- Group approved findings **by plan section heading** (this is the most useful organization at plan-review time — the author can walk through the plan top to bottom and address each section's concerns). Include each finding's POV line.
- End with a count summary (e.g. `"1 Critical, 3 Important, 2 Minor approved"`).

**Interactive offer at end.** Use `AskUserQuestion` to ask: _"Save annotations to `<plan-stem>-review.md`?"_ with options Yes / No. If Yes, write the approved findings (grouped by plan section, with verdict header) to a sibling file of the plan — `docs/superpowers/specs/my-feature-review.md` for a plan at `docs/superpowers/specs/my-feature.md`. The annotation file is the deliverable the plan author can paste back into their planning flow.
```

with:

```markdown
### 5. Revise Loop

This skill **revises the plan in place** until it passes review, instead of producing a separate annotations file. The deliverable is the improved plan document at `$PLAN_PATH`. Findings are **printed in chat each round — never written to a markdown file in the repo.** (The subagent JSON under `$SESSION_DIR` is internal plumbing and stays.)

Initialize `round = 1` and an empty `skip-set` (finding identities the user chose not to act on; identity = `plan-section::normalized-title`). If context was compacted mid-loop, re-read `$SESSION_DIR/meta.json` and the latest `$SESSION_DIR/compiled.json` to restore state, and re-derive the `skip-set` from your chat record.

Each round:

1. **Review.** (Round 1: the four specialists dispatched in §3 have already written `$SESSION_DIR/findings-*.json`.) For round > 1, re-dispatch the four specialists per §3 against the freshly-copied `$SESSION_DIR/plan.md`.
2. **Compile** per §4 into `$SESSION_DIR/compiled.json` with verdict.
3. **Effective findings** = `compiled.findings` whose identity is NOT in the `skip-set`.
4. **Form POV + classification for every effective finding.** Per REVIEW.md "Orchestrator POV", from a targeted read of the cited plan section in `$SESSION_DIR/plan.md` (and any cited project file), emit for each finding a **recommendation** (`Fix` = revise the plan; `Defer` = real gap fine to nail down during implementation; `Skip` = not worth a plan change) + one-sentence rationale + High/Low confidence, and a **classification** (`mechanical` = one obvious plan edit, e.g. adding a named test to the test list; `judgment` = a real choice in wording or design among options).
5. **Print findings in chat** — grouped by plan section heading, each with its POV line (e.g. `→ POV: Defer (High confidence) — real gap, but fine to nail down the test names during implementation`). Do **not** write these to a file.
6. **Auto-revise.** For each effective finding where `recommendation == Fix` AND `classification == mechanical`, edit the plan document at `$PLAN_PATH` directly to address it (apply the finding's suggested replacement). Make these edits without asking.
7. **Interventions.** `present-set` = effective findings where `recommendation` is `Skip` or `Defer`, OR (`recommendation` is `Fix` AND `classification` is `judgment`). If non-empty, present ONE consolidated `AskUserQuestion`: lead with each finding's POV; offer **Apply as suggested** / **Apply with my guidance** (free text) / **Skip** in this neutral order. Apply the user's chosen revisions to `$PLAN_PATH`. Add every `Skip` identity to the `skip-set`.
8. **Refresh + exit check.** Re-copy the revised plan: `cp "$PLAN_PATH" "$SESSION_DIR/plan.md"`. If any edits were made this round AND one or more Critical/Important findings remain that are not in the `skip-set`, set `round += 1` and repeat from step 1 (re-review the revised plan). Otherwise **EXIT**.

After exit, print a terminal summary in chat:

- Lead with the final verdict label in bold.
- List, grouped by plan section heading, the revisions applied (auto + user-approved) and the findings the user chose to skip — each with its POV line.
- End with a count summary (e.g. `"2 auto-revised, 1 applied with guidance, 1 skipped; final verdict PLAN READY"`).

There is no annotations file and nothing else is written to the repo — the revised `$PLAN_PATH` is the deliverable.
```

- [ ] **Step 2: Drop the stale "interactive tiered approval" phrasing in the intro.** Replace this exact text in the opening paragraph (line ~9):

```markdown
compiles their findings under the `REVIEW.md` rubric, attaches its own point of view to each finding, and runs an interactive tiered approval.
```

with:

```markdown
compiles their findings under the `REVIEW.md` rubric, attaches its own point of view to each finding, and revises the plan in place — auto-applying the mechanical fixes it recommends and stopping to ask only about findings it would skip/defer or fixes that involve a judgment call.
```

- [ ] **Step 3: Verify no repo-bound findings markdown write remains.**

Run: `grep -nE "review\.md|annotation|Save annotations" .claude/skills/review-plan/SKILL.md`
Expected: no output (exit code 1).

- [ ] **Step 4: Verify the loop vocabulary is present.**

Run: `grep -nE "Revise Loop|skip-set|round \+= 1|Auto-revise" .claude/skills/review-plan/SKILL.md`
Expected: multiple matches.

- [ ] **Step 5: Read-back coherence check.** Read `.claude/skills/review-plan/SKILL.md` §3 (Dispatch Specialists) and the new §5. Confirm the §3 dispatch still writes `findings-*.json` (round 1) and that §5 step 1 correctly reuses them, and that `$PLAN_PATH` / `$SESSION_DIR/plan.md` are used consistently (edit original, re-copy before re-review). Confirm the Session Directory table (~32-40) still accurately describes what's written — `compiled.json` and `plan.md` are still written; no `-review.md` row was ever there, so no table edit is needed. No edit if coherent.

- [ ] **Step 6: Commit.**

```bash
git add .claude/skills/review-plan/SKILL.md
git commit -m "feat(review-plan): auto-revise loop, no repo annotations file

review-plan now revises the plan doc in place across rounds until no
Critical/Important findings remain: prints findings in chat, auto-applies
mechanical Fix revisions, asks only about Skip/Defer and judgment-call
fixes. Drops the <plan-stem>-review.md annotations file that polluted the
repo. Subagent JSON plumbing under SESSION_DIR is unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Change D — `audit-debt` becomes a code-untouching discovery loop

**Files:**

- Modify: `.claude/skills/audit-debt/SKILL.md` — §5 "Compile + Prioritize + Present" (~182-224), and the intro line (~9) that says it "offers to … file approved findings as GitHub issues"

After this task `audit-debt` (a) repeats the specialist sweep until a round surfaces no new Critical/Important findings (hard cap 7 rounds), (b) never edits code, and (c) consolidates surviving findings across **all** tiers into a proposed set of GitHub issues — auto-including `Fix` and `Defer`, asking only about `Skip`/borderline, and **never mixing tiers within one issue**. Sweep-prep (§1) and the orchestrator-derived dimensions (§4, deterministic) are computed once, not per round.

- [ ] **Step 1: Wrap the specialist sweep in a discovery loop.** At the very start of §5 (immediately after the `### 5. Compile + Prioritize + Present` heading and before its current first sentence "Once all four specialist files and `orchestrator-findings.json` exist on disk, read them all."), insert this block:

```markdown
**Discovery loop (specialists only — no code is ever edited).** A single stochastic sweep misses findings, so repeat the specialist sweep until it stops surfacing new blocking debt. Sweep-prep (§1) and the orchestrator-derived dimensions (§4) are deterministic — compute them once, not per round.

Initialize `round = 1` and an empty `seen` set (finding identities = `file::normalized-title`). Each round:

1. (Round 1: the specialists dispatched in §3 have already written `$SESSION_DIR/findings-*.json`.) For round > 1, re-dispatch the four specialists per §3 into `$SESSION_DIR/round-<round>/findings-*.json`.
2. Read this round's specialist findings. Compute `new-blocking` = findings with severity Critical or Important whose identity is not already in `seen`. Add every finding's identity to `seen` and accumulate every finding into the running pool `$SESSION_DIR/all-findings.json`.
3. If `new-blocking` is empty → **stop looping**. Else if `round == 7` → **stop looping** and `log` that the 7-round cap was reached (coverage may be incomplete — note it in the report). Else `round += 1` and repeat.

Then merge the accumulated specialist pool with `orchestrator-findings.json` and continue with the consolidation below.
```

- [ ] **Step 2: Reframe the consolidation + offers as proposed GitHub issues across all tiers.** Replace this exact block (the "**Interactive offers at the end**" list through "End of skill …"):

```markdown
**Interactive offers at the end** (apply in order):

1. `AskUserQuestion`: _"Save this report to a file?"_ Options:
   - **Yes, default location** — `cp "$SESSION_DIR/report.md" "docs/debt-audit-$(date +%Y-%m-%d).md"`
   - **Yes, custom path** — prompt for the path, then `cp`.
   - **No** — skip.
2. If `compiled.json` contains any Critical or Important findings, `AskUserQuestion`: _"File any Critical/Important findings as GitHub issues?"_ Options:
   - **Yes — go through them one by one** — iterate Critical+Important findings; for each, `AskUserQuestion` _"File this as an issue?"_ — lead with the orchestrator **POV** (recommendation + rationale + confidence) so you can decide whether it's even worth an issue, then show the auto-drafted title and body. On Yes, run `gh issue create --title "<title>" --body "<body>"`. Title format: `"<severity>: <finding title>"`. Body: finding text + `file:line` + suggestion + effort estimate + `_Surfaced by /audit-debt on <date>_`. (The POV guides your filing decision; it is not written into the issue body.)
   - **No, I'll do this manually** — skip.

End of skill — no posting to PRs, no further checks.
```

with:

```markdown
**Consolidate into proposed GitHub issues.** `audit-debt` never edits code — its output is a backlog. Roll the surviving findings **across all tiers, including Minor and Nit** into a proposed set of issues:

- **Critical / Important:** apply the review gate — auto-include findings with `recommendation` of `Fix` or `Defer` (filing an issue _is_ deferring real debt to a backlog), and ask the user only about `Skip`/borderline ones via `AskUserQuestion` (lead with the POV; **File** / **Drop**).
- **Minor / Nit:** these carry no POV; include them by default.
- **Do not mix tiers within a single issue.** A Critical/Important finding gets its own issue (or is grouped only with closely-related same-tier findings). Minor/Nit findings are consolidated into their own separate lower-tier issue(s) — never folded into a higher-tier issue.

Present the proposed issue set in chat (title + tier + the findings each issue covers). Then `AskUserQuestion`: _"File these as GitHub issues?"_ Options:

- **Yes, file all** — run `gh issue create` for each proposed issue.
- **Let me deselect some** — present the proposed issues multi-select, then file the kept ones.
- **No** — skip.

Issue title format: `"<severity>: <finding title>"` (for a multi-finding lower-tier issue, a summary title like `"Nit: 6 convention nits across src/"`). Body: each finding's text + `file:line` + suggestion + effort estimate, then `_Surfaced by /audit-debt on <date>_`. The POV guides filing decisions; it is not written into the issue body.

**Optionally save the report.** `AskUserQuestion`: _"Save this report to a file?"_ Options:

- **Yes, default location** — `cp "$SESSION_DIR/report.md" "docs/debt-audit-$(date +%Y-%m-%d).md"`
- **Yes, custom path** — prompt for the path, then `cp`.
- **No** — skip.

End of skill — no code edits, no commits, no posting to PRs, no further checks.
```

- [ ] **Step 3: Update the intro sentence to drop the "approved findings" framing and assert it never touches code.** Replace this exact text (line ~9):

```markdown
compiles the results into a backlog sorted by severity × inverse-effort, attaches its own point of view to each Critical/Important finding, and offers to save the report and/or file approved findings as GitHub issues.
```

with:

```markdown
loops the sweep until it stops surfacing new blocking debt, compiles the results into a backlog sorted by severity × inverse-effort, attaches its own point of view to each Critical/Important finding, and consolidates the findings into a proposed set of GitHub issues to file. It **never edits code** — its only output is the report and the issues.
```

- [ ] **Step 4: Verify the loop + no-code-edit invariants.**

Run: `grep -nE "Discovery loop|round == 7|seen|never edits code" .claude/skills/audit-debt/SKILL.md`
Expected: multiple matches.

- [ ] **Step 5: Verify no fix/commit/code-edit language leaked in.**

Run: `grep -niE "\bfix-batch\b|fixer subagent|git commit|auto-fix" .claude/skills/audit-debt/SKILL.md`
Expected: no output (exit code 1).

- [ ] **Step 6: Read-back coherence check.** Read `.claude/skills/audit-debt/SKILL.md` §3, §4, and the new §5. Confirm: §4's orchestrator dimensions are described as computed once (the new loop block says so — no contradiction); the cap-7 `log` message is present; the Session Directory table (~29-39) still matches (it lists `report.md` and `compiled.json`, both still produced — add a one-line row for `round-<N>/findings-*.json` / `all-findings.json` if you want the table exhaustive, optional). No behavioral edit if coherent.

- [ ] **Step 7: Commit.**

```bash
git add .claude/skills/audit-debt/SKILL.md
git commit -m "feat(audit-debt): discovery loop + consolidated issues, never edits code

audit-debt now repeats the specialist sweep until a round finds no new
Critical/Important debt (hard cap 7 rounds), and consolidates findings
across all tiers into a proposed set of GitHub issues — auto-including
Fix/Defer, asking only about Skip, and never mixing tiers within one
issue. It never touches code: output is the report plus the issues.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Whole-suite verification

**Files:** none modified (verification only).

- [ ] **Step 1: No plan-mode anywhere in the three skills.**

Run: `grep -rniE "plan ?mode|EnterPlanMode|ExitPlanMode" .claude/skills/review-code/SKILL.md .claude/skills/review-plan/SKILL.md .claude/skills/audit-debt/SKILL.md`
Expected: no output (exit code 1).

- [ ] **Step 2: No repo-bound findings markdown in `review-plan`.**

Run: `grep -nE "review\.md|annotation" .claude/skills/review-plan/SKILL.md`
Expected: no output (exit code 1).

- [ ] **Step 3: `audit-debt` never edits code.**

Run: `grep -niE "fix-batch|fixer|git commit|auto-fix|git add" .claude/skills/audit-debt/SKILL.md`
Expected: no output (exit code 1).

- [ ] **Step 4: Gate vocabulary consistent in `review-code`.**

Run: `grep -nE "auto_fix|needs_user" .claude/skills/review-code/SKILL.md`
Expected: no output (exit code 1) — all renamed to `mechanical`/`judgment`/`auto-fix-set`/`present-set`.

- [ ] **Step 5: Spec-coverage read-through.** Open `docs/superpowers/specs/2026-05-30-review-skills-autonomy-design.md` and confirm each of Changes A–D and the verification bullets maps to a committed task above. Note any gap; if found, add a follow-up task. No code change in this step.

- [ ] **Step 6 (optional smoke test):** If a throwaway plan doc exists (or create one under `docs/superpowers/specs/` with a deliberate gap, e.g. a feature with no test list), run `/review-plan <that file>` and confirm it (a) dispatches without a plan-mode approval prompt, (b) prints findings in chat, (c) auto-revises the plan and/or asks only about judgment/skip findings, (d) leaves no `-review.md` file. Delete the throwaway doc afterward. This exercises the most-rewritten skill end-to-end.

---

## Notes / risks

- **Prettier reformatting:** every `.md` Edit triggers a Prettier hook that may re-wrap lines. If a later Edit's `old_string` fails to match because of prior rewrapping, Read the file region first and re-derive the anchor. Edits in this plan are ordered so each touches a distinct region, minimizing this.
- **`review-code` resumability tables unchanged:** the loop's compaction-resume table (which keys off `triage.json`, `fix-batch.json`, etc.) still works — the file names and round structure are unchanged; only field _values_ inside `triage.json` changed. No edit to the resume table is required, but confirm during Task 2 Step 10.
- **`audit-debt` round artifacts:** the discovery loop introduces `round-<N>/findings-*.json` and `all-findings.json` under `$SESSION_DIR`. These are session-dir scratch (not repo), consistent with the user's "behind-the-scenes disk writes are fine."
