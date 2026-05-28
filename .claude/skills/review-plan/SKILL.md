---
name: review-plan
description: Review a draft plan or design spec before implementation. Companion to superpowers' writing-plans skill.
user-invocable: true
---

# Review Plan

Run a multi-dimensional review on a draft plan or design spec **before any code is written**. The main context is an orchestrator: it locates the target plan, classifies what the design touches, dispatches the same five specialist agents `/review-code` uses (architecture, code, security, a11y, test) in parallel against the plan doc instead of a diff, compiles their findings under the `REVIEW.md` rubric, and runs an interactive tiered approval. This catches architecture pattern-fit issues, testing gaps, security implications of new data flows, and missing migration safety statements **before** they become rework.

This skill is a **companion to** superpowers' `writing-plans` skill — not a replacement. `writing-plans` helps you draft a plan; `/review-plan` red-teams the draft. Read `REVIEW.md` for severity calibration and the verification rules every finding must pass; if anything below contradicts `REVIEW.md`, `REVIEW.md` wins.

Plan-time review is intentionally narrower than code-time review. The agents are told they are reading a draft — their job is to flag what the plan **omits** (missing test list, unspecified ownership/auth, unjustified new abstractions, no migration story, no mobile/keyboard consideration) and what the plan **proposes that contradicts project patterns**, not to nitpick wording or pre-grade implementation details the plan reasonably defers.

## Invocation

| Form                  | Behavior                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `/review-plan`        | Find the most recent file in `docs/superpowers/specs/` or `docs/superpowers/plans/` and review it. |
| `/review-plan <path>` | Review the plan or spec at `<path>` (relative to repo root or absolute).                           |

If no spec/plan exists in either directory and no path was passed, ask the user for one via `AskUserQuestion` before continuing — there is nothing to review otherwise.

## Session Directory

All review artifacts live in a per-invocation temp directory so parallel reviews don't collide:

```bash
SESSION_DIR=$(mktemp -d /tmp/review-plan-XXXXXXXX)
```

| Path                                      | Written by   | Purpose                                                          |
| ----------------------------------------- | ------------ | ---------------------------------------------------------------- |
| `$SESSION_DIR/meta.json`                  | orchestrator | Plan path, session dir, classification (what the plan touches)   |
| `$SESSION_DIR/plan.md`                    | orchestrator | Stable copy of the target plan file — subagents read this        |
| `$SESSION_DIR/findings-architecture.json` | arch agent   | Architecture-reviewer findings array                             |
| `$SESSION_DIR/findings-code.json`         | code agent   | Code-reviewer findings array                                     |
| `$SESSION_DIR/findings-security.json`     | sec agent    | Security-reviewer findings array                                 |
| `$SESSION_DIR/findings-a11y.json`         | a11y agent   | A11y-reviewer findings array (often `[]` when no UI is proposed) |
| `$SESSION_DIR/findings-test.json`         | test agent   | Test-reviewer findings array                                     |
| `$SESSION_DIR/compiled.json`              | orchestrator | Deduplicated, verified findings + summary + verdict              |

## Workflow

### 1. Setup

Locate the target file:

```bash
if [ -n "$ARG_PATH" ]; then
  PLAN_PATH="$ARG_PATH"
else
  PLAN_PATH=$(ls -t docs/superpowers/specs/*.md docs/superpowers/plans/*.md 2>/dev/null | head -1)
fi
```

If `$PLAN_PATH` is empty or the file doesn't exist, use `AskUserQuestion` to ask the user for a path. Do not invent one.

Copy the plan to a stable artifact path and classify what it touches with simple regex heuristics over the plan content:

```bash
cp "$PLAN_PATH" "$SESSION_DIR/plan.md"

TOUCHES=()
grep -Eqi 'routes?|api/'                 "$SESSION_DIR/plan.md" && TOUCHES+=("API")
grep -Eqi 'component|UI|MUI'             "$SESSION_DIR/plan.md" && TOUCHES+=("UI")
grep -Eqi 'mongodb|collection'           "$SESSION_DIR/plan.md" && TOUCHES+=("data")
grep -Eqi 'auth|session|userId'          "$SESSION_DIR/plan.md" && TOUCHES+=("auth")
grep -Eqi 'test|vitest|MSW'              "$SESSION_DIR/plan.md" && TOUCHES+=("tests")
grep -Eqi 'architecture|layering|abstraction' "$SESSION_DIR/plan.md" && TOUCHES+=("architecture")
```

Write metadata:

```bash
cat > "$SESSION_DIR/meta.json" <<EOF
{
  "planPath": "$PLAN_PATH",
  "sessionDir": "$SESSION_DIR",
  "touches": $(printf '%s\n' "${TOUCHES[@]}" | jq -R . | jq -sc .)
}
EOF
```

The classification is informational — it appears in the dispatch plan and is passed to subagents as context, but **all five specialists still run**. Coverage uniformity beats saving one agent dispatch; a "no UI work proposed" guess is exactly when an a11y issue slips through.

### 2. Plan Dispatch

Enter plan mode via `EnterPlanMode`. Show the user:

- **Plan file:** `$PLAN_PATH` and its line count (`wc -l < $SESSION_DIR/plan.md`)
- **Classification:** the `touches` array (e.g. `["API", "data", "auth"]`)
- **Specialists to dispatch (all five, in parallel):**
  - `architecture-reviewer` → `findings-architecture.json` _(does the heaviest lifting at plan time)_
  - `security-reviewer` → `findings-security.json`
  - `test-reviewer` → `findings-test.json`
  - `code-reviewer` → `findings-code.json` _(lighter at plan time)_
  - `a11y-reviewer` → `findings-a11y.json` _(empty array unless UI is proposed)_
- **Session directory:** `$SESSION_DIR`

Exit plan mode via `ExitPlanMode` and wait for approval before dispatching.

### 3. Dispatch Specialists in Parallel

Launch all five specialists in a **single message with five `Agent` tool calls** so they run in parallel. Each gets the same prompt template:

```
You are reviewing a draft plan/spec document, NOT code.

## Your assignment
Apply the methodology in `.claude/agents/<agent>.md` to the plan at
$SESSION_DIR/plan.md. Read REVIEW.md for severity calibration.

## Context files
- Plan: $SESSION_DIR/plan.md
- REVIEW.md: REVIEW.md
- CLAUDE.md: CLAUDE.md
- Project structure: feel free to Read/Grep/Glob the current repo for
  pattern verification (existing modules, conventions, neighbors).
- <if focus notes> Focus: <focus notes>

## Plan-time framing
You are reviewing a DRAFT — it describes what WILL be built. Your job is
narrower than at code-review time:
- Architecture-reviewer: pattern fit (does this design fit existing
  patterns?), abstraction justification (is the proposed new util/hook/
  component duplicative of something that already exists?), module
  coupling implied by the design, complexity warnings derived from the
  shape of what's proposed.
- Security-reviewer: new user-data flows, auth changes, new API surface
  — are auth and ownership checks specified? Flag "we'll add validation
  later" red flags.
- Test-reviewer: what tests does this plan specify? What's missing? Are
  edge cases enumerated? Is the proposed code testable as designed?
- Code-reviewer (lighter at plan time): does the plan reference correct
  conventions? Does it propose anything that contradicts project rules
  (error constants, named exports, no `as` casts, etc.)?
- A11y-reviewer: only fires substantively if UI work is involved —
  keyboard, focus management, mobile, contrast. If the plan has no UI:
  return an empty array.

## Opinionated plan-content requirements (flag missing items)
- Explicit test list (not "we'll add tests")
- Explicit ownership / auth specification for new data flows
- Pattern-fit justification for proposed new abstractions
- Migration safety statement if schema changes are proposed
- Mobile + keyboard considerations if UI work is involved

## Out of scope at plan time
- Naming preferences ("call it Foo not Bar")
- Implementation details the plan reasonably defers
- Style / convention checks that only matter at code time

## Verification rules
- `file:line` citation required. Cite the plan-doc heading + line
  number, OR cite related project files if the finding references
  existing code.
- Before flagging "missing X", grep the project for X under variant
  names. Don't flag a missing helper that already exists.
- Before flagging "new abstraction is unjustified", check whether the
  plan articulates why (a justification in the plan itself defuses the
  finding).

## Output
Write findings to $SESSION_DIR/findings-<agent>.json as a JSON array per
REVIEW.md's "Findings Output Format" section. The `file` field may be
either the plan path OR a related project file path. Set `dimension` to
"<dimension>" on every entry. If you have nothing to flag, write `[]` —
do not skip writing the file.
```

Per-agent substitutions match `/review-code` (architecture-reviewer / Architecture, code-reviewer / Code, security-reviewer / Security, a11y-reviewer / A11y, test-reviewer / Test).

### 4. Compile Findings (main context)

Read the five `$SESSION_DIR/findings-*.json` files. Apply, in order:

1. **Citation check.** Drop any finding with `file == null` or `line == null` — `REVIEW.md` requires a `file:line` citation.
2. **Dedupe by plan section + topic.** When two findings target the same plan section heading and same topic (e.g. both flagging "no test list"), merge them: concatenate bodies with a separator, keep the higher severity, list both dimensions (e.g. `"Test + Architecture"`).
3. **Nit cap.** If more than 5 Nits remain after dedupe, keep the first 5 and summarize the rest as a count (e.g. `"+ 8 more Nits — see $SESSION_DIR/findings-*.json"`).

Determine the verdict per `REVIEW.md`:

- 0 Critical, 0 Important → **PLAN READY**
- 0 Critical, 1+ Important → **REVISE BEFORE IMPLEMENTING**
- 1+ Critical → **MAJOR GAPS — RECONSIDER DESIGN**
- Only Minor and/or Nit → **PLAN READY** (Minor/Nit are informational)

Write to `$SESSION_DIR/compiled.json`:

```json
{
  "summary": "<1-2 sentence overall summary>",
  "verdict": "PLAN READY" | "REVISE BEFORE IMPLEMENTING" | "MAJOR GAPS — RECONSIDER DESIGN",
  "findings": [<deduplicated, verified findings array>]
}
```

Order findings: Critical → Important → Minor → Nit, then by `file` then by `line`.

### 5. Present + Interactive Output

If context was compacted between dispatch and presentation, re-read `$SESSION_DIR/compiled.json` and `$SESSION_DIR/meta.json` to restore state.

Open with the verdict banner and the one-line summary, then tier the presentation:

- **Critical and Important — individually** via `AskUserQuestion`. Header includes severity tag, dimension(s), and `file:line`. Body shows the finding text and the suggested fix. For findings that propose specific plan text to rewrite, the body includes a `Suggested replacement:` block with the quoted source and the proposed text. Options:
  - **Approve** — keep at current severity.
  - **Modify** — open a free-text edit for the finding body before approval.
  - **Downgrade** — drop one tier (Critical → Important, Important → Minor). Important → Minor is auto-approved at Minor.
  - **Skip** — exclude entirely.
- **Minor and Nit — batched, multi-select** via `AskUserQuestion`, batches of 4. Show severity, `file:line`, and a 2-3 sentence summary per finding. Always offer **Include all** and **Skip all** at the bottom.

After all findings are reviewed, print a structured terminal report:

- Lead with the verdict label in bold.
- Group approved findings **by plan section heading** (this is the most useful organization at plan-review time — the author can walk through the plan top to bottom and address each section's concerns).
- End with a count summary (e.g. `"1 Critical, 3 Important, 2 Minor approved"`).

**Interactive offer at end.** Use `AskUserQuestion` to ask: _"Save annotations to `<plan-stem>-review.md`?"_ with options Yes / No. If Yes, write the approved findings (grouped by plan section, with verdict header) to a sibling file of the plan — `docs/superpowers/specs/my-feature-review.md` for a plan at `docs/superpowers/specs/my-feature.md`. The annotation file is the deliverable the plan author can paste back into their planning flow.

## Plan-Content Requirements (Opinionated)

Agents flag missing items in this list — the plan author should be able to point to each one in the plan, or explicitly note "not applicable":

- **Explicit test list** — what tests will be written, named at the test-case level. "We'll add tests" is not acceptable.
- **Ownership / auth specification** — for every new data flow or API route, the plan names which session field scopes the data and which checks the route performs (e.g. `userId` filter on all reads, `isAdmin` for admin-only paths).
- **Pattern-fit justification** — for every proposed new abstraction (util, hook, component), the plan articulates why it isn't a duplicate of an existing module and where the second caller will be.
- **Migration safety statement** — if the plan changes a schema, it names the migration strategy (backfill script, defaulted field, dual-write window) and the rollback plan.
- **Mobile + keyboard considerations** — if the plan introduces UI, it names how the UI behaves on a phone-width viewport and which interactions are keyboard-accessible.

## Out of Scope at Plan Time

These are out of scope; agents are told not to flag them in plan-time framing:

- **Naming preferences** — "call it `Foo` not `Bar`" is bikeshedding at plan time. Names can be revised when the code lands.
- **Implementation details the plan reasonably defers** — a plan that says "the route does the filter; details in code" is fine. Plans are not pseudocode.
- **Style / convention checks that only matter at code time** — Prettier, ESLint, TypeScript errors all fire on the eventual code via PostToolUse hooks. No need to pre-grade.

## Common Mistakes

| Mistake                                                                      | Fix                                                                                                                                                 |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flagging implementation details at plan time                                 | Those are code-time concerns. The plan is allowed to defer "how" as long as "what" and "why" are clear.                                             |
| Citing line numbers from the wrong file                                      | Plan-doc citations point at `$SESSION_DIR/plan.md`. Project-file citations point at repo paths. Don't mix them up — readers can't follow the trail. |
| Not classifying what the plan touches                                        | Skipping the `touches` classification leads to spurious findings (e.g. a11y findings on a backend-only plan). Run the regex heuristics every time.  |
| Re-running and re-raising the same findings without consulting prior reviews | If a prior `<plan>-review.md` exists, read it before dispatch. Authors shouldn't see the same finding twice without a new technical basis.          |
| Treating "we'll add tests" as acceptable                                     | Plans must enumerate the test list. "We'll add tests" is a Critical or Important miss depending on what the plan touches.                           |
| Skipping the all-five specialists rule based on classification               | The `touches` array is informational. All five agents always run — a11y-reviewer returns `[]` when no UI is involved, which is cheap and uniform.   |
