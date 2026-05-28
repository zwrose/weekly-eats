---
name: review-code
description: Run a multi-agent code review on a PR or local branch. Auto-detects mode. Optionally posts inline findings to GitHub.
user-invocable: true
---

# Review Code

Run a multi-dimensional code review on either an open pull request or a local branch (vs `main`), then **autonomously fix what it finds**. The main context is an **orchestrator** — it fetches metadata, dispatches five specialist agents in parallel, compiles their findings, triages each into auto-fixable vs needs-your-judgment, applies fixes via a fixer subagent, and re-reviews — looping until no Critical/Important findings remain or a circuit breaker halts. It never loads the full diff or any agent's raw output into its own conversation; subagents do all heavy reading and write structured results to disk.

This skill **replaces the legacy `/review-pr` skill.** Unlike the old version, it auto-detects whether you're reviewing a PR or a local branch, always dispatches the full set of specialists (architecture, code, security, a11y, test) so coverage is uniform across reviews, enforces the severity and verification rules in `REVIEW.md` at compile time (not just by hope), and — by default — drives an auto-fix loop that commits fixes locally (never pushes). Two read-only behaviors are preserved as flags.

There are three top-level paths, chosen at invocation:

- **`--post`** → one review pass, then read-only GitHub posting (push approved findings to GitHub through `resolve-diff-lines.ts` so out-of-hunk anchors never trigger 422 errors). Never touches the working tree.
- **`--review-only`** → one review pass, then a read-only interactive terminal presentation. No commits.
- **otherwise (default)** → the auto-fix loop: review → triage → fix → re-review, committing locally until clean or halted.

The five specialist agents live under `.claude/agents/` and read `REVIEW.md` (severity rubric, exclusions, verification rules) plus `CLAUDE.md` (project conventions) before producing findings. Every finding they emit must cite a `file:line` and target a `+`/`-` line in the diff — context-line and unchanged-code findings are dropped at compile time. Each specialist runs once per round; the orchestrator does not chain a "verifier agent" or run a specialist twice within a round, because multi-turn agentic review within a single pass degrades F1 and fabricates findings as real ones get exhausted. The loop re-reviews from scratch each round on a fresh diff, which is different from re-running a specialist on its own output.

## Invocation

| Form                             | Behavior                                                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/review-code`                   | **Auto-fix loop (default).** Review → triage → fix → re-review until no Critical/Important findings remain, or a halt condition fires. Commits locally; never pushes. |
| `/review-code --review-only`     | One review pass, interactive tiered presentation, no commits. (The pre-loop behavior.)                                                                                |
| `/review-code pr <N> --post`     | One review pass, read-only, post inline findings to GitHub. Never touches the tree.                                                                                   |
| `/review-code branch` / `pr <N>` | Force branch or PR mode; still runs the auto-fix loop unless combined with `--review-only`/`--post`.                                                                  |
| `/review-code --focus <notes>`   | Pass focus notes to every specialist. Combinable with any form.                                                                                                       |

The three top-level paths: `--post` → read-only GitHub posting; `--review-only` → read-only terminal presentation; otherwise → auto-fix loop.

**Auto-detection rule.** Run `gh pr list --head "$(git rev-parse --abbrev-ref HEAD)" --json number,headRefOid,headRefName --limit 1`. If the result is non-empty, default to PR mode. Otherwise default to branch mode. If the user passed `branch` explicitly, skip the lookup. If the user passed `pr <N>` explicitly, use `<N>` and don't auto-detect.

**`--post` only applies to PR mode.** If the user passes `--post` without a PR (and auto-detection finds none), stop and tell them — branch mode has nothing to post against.

## Session Directory

All review artifacts live in a per-invocation temp directory so parallel reviews don't collide:

```bash
SESSION_DIR=$(mktemp -d /tmp/review-XXXXXXXX)
```

Files written during the review. **Per-round artifacts live under `$SESSION_DIR/round-<N>/`** in the auto-fix loop (round 1, 2, …); the read-only paths (`--review-only`, `--post`) run a single pass and write that pass's artifacts under `round-1/` as well. Only `meta.json` lives at the session-dir root.

| Path                                                | Written by     | Purpose                                                                                     |
| --------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `$SESSION_DIR/meta.json`                            | orchestrator   | Mode, PR number (if any), repo, branch, head SHA, base ref, focus notes                     |
| `$SESSION_DIR/repo/`                                | orchestrator   | `--post`/`--review-only` PR paths only: detached `git worktree` at the PR head SHA          |
| `$SESSION_DIR/prior-comments.json`                  | orchestrator   | PR-mode only: prior review comments + threads (for author justifications)                   |
| `$SESSION_DIR/round-<N>/diff.txt`                   | orchestrator   | Round `<N>` unified diff (`git diff <baseRef>...HEAD`). **Never read by the main context.** |
| `$SESSION_DIR/round-<N>/findings-architecture.json` | arch agent     | Architecture-reviewer findings array                                                        |
| `$SESSION_DIR/round-<N>/findings-code.json`         | code agent     | Code-reviewer findings array                                                                |
| `$SESSION_DIR/round-<N>/findings-security.json`     | sec agent      | Security-reviewer findings array                                                            |
| `$SESSION_DIR/round-<N>/findings-a11y.json`         | a11y agent     | A11y-reviewer findings array                                                                |
| `$SESSION_DIR/round-<N>/findings-test.json`         | test agent     | Test-reviewer findings array                                                                |
| `$SESSION_DIR/round-<N>/compiled.json`              | orchestrator   | Deduplicated, verified findings + summary + verdict (read by `circuit-breaker.ts`)          |
| `$SESSION_DIR/round-<N>/triage.json`                | triage agent   | Per-finding `auto_fix`/`needs_user` classification (loop only)                              |
| `$SESSION_DIR/round-<N>/resolutions.json`           | orchestrator   | User decisions on `needs_user` findings (loop only; read by `circuit-breaker.ts`)           |
| `$SESSION_DIR/round-<N>/fix-batch.json`             | orchestrator   | Findings handed to the fixer this round (loop only)                                         |
| `$SESSION_DIR/round-<N>/review.json`                | orchestrator   | `--post` only: review body + approved comments (pre-resolve)                                |
| `$SESSION_DIR/round-<N>/review-resolved.json`       | resolve script | `--post` only: comments after line-anchor resolution                                        |

**CRITICAL:** The main context only ever runs `wc -l < $SESSION_DIR/round-<N>/diff.txt` to size the diff. It never `cat`s the diff, never reads the full thing, never echoes it back. Subagents read the diff from disk and write structured findings; the orchestrator reads the findings JSON, not the diff.

## Workflow

### 1. Setup

Decide mode (auto-detected or explicit, per `## Invocation`). Create the session directory.

**PR mode:**

```bash
# Resolve PR number — either provided or auto-detected from current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ -z "$PR_NUMBER" ]; then
  PR_NUMBER=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number')
fi

# Metadata: small JSON only — do NOT load the diff yet
gh pr view "$PR_NUMBER" --json number,title,author,headRefName,headRefOid,baseRefName,url > "$SESSION_DIR/pr.json"
HEAD_SHA=$(jq -r .headRefOid "$SESSION_DIR/pr.json")
PR_BRANCH=$(jq -r .headRefName "$SESSION_DIR/pr.json")
BASE_REF=$(jq -r .baseRefName "$SESSION_DIR/pr.json")   # PR base branch — used as the diff base
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

# Prior review comments — used for author-justification handling
gh api "repos/$REPO/pulls/$PR_NUMBER/comments" \
  --jq '[.[] | {id, in_reply_to_id, path, line, position, body, user: .user.login}]' \
  > "$SESSION_DIR/prior-comments.json"

# Read-only paths ONLY (--post / --review-only): a detached worktree at the PR head
# gives subagents a clean source of truth to verify against. NOT used on the
# auto-fix path — that path edits and commits on the current branch directly.
git fetch origin "$PR_BRANCH"
git worktree add --detach "$SESSION_DIR/repo" "$HEAD_SHA"   # --post / --review-only ONLY
```

**Auto-fix branch guard (PR mode, default loop only).** Before entering the loop, the orchestrator must be standing on the PR's own branch so fix commits land where they belong:

```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$PR_BRANCH" ]; then
  echo "Auto-fix needs PR branch '$PR_BRANCH' checked out (currently on '$CURRENT_BRANCH')."
  echo "Check out the branch, or re-run with --post (read-only GitHub) or --review-only (read-only terminal)."
  exit 1
fi
```

If the guard fails (detached HEAD, or you're reviewing someone else's PR), STOP — do not create the detached worktree and do not enter the loop. Tell the user to use `--post` or `--review-only`. The detached `git worktree add --detach` step above is for the `--post`/`--review-only` PR paths ONLY, never for the auto-fix path.

**Branch mode:**

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
HEAD_SHA=$(git rev-parse HEAD)
BASE_REF=main   # branch mode always diffs against main
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || echo "local")

# No worktree, no prior comments — subagents verify against the current working tree
```

**Per-round diff is ALWAYS local.** Do NOT use `gh pr diff` to fetch the diff. Each round computes the diff locally from `<baseRef>` (PR mode: the PR's `baseRefName`; branch mode: `main`), because rounds 2+ have local fix commits that are not on the remote — `gh pr diff` would miss them. The per-round command (run inside the loop, see `## Auto-Fix Loop`) is:

```bash
git diff "$BASE_REF"...HEAD > "$SESSION_DIR/round-<round>/diff.txt"
```

The read-only paths run a single pass and compute the same local diff into `round-1/diff.txt`.

Then write `meta.json` in both modes:

```bash
cat > "$SESSION_DIR/meta.json" <<EOF
{
  "mode": "${MODE}",
  "path": "${REVIEW_PATH}",
  "pr": ${PR_NUMBER:-null},
  "repo": "${REPO}",
  "branch": "${BRANCH}",
  "headSha": "${HEAD_SHA}",
  "baseRef": "${BASE_REF}",
  "sessionDir": "${SESSION_DIR}",
  "focusNotes": ${FOCUS_JSON:-null}
}
EOF
```

`REVIEW_PATH` is `loop` (default), `review-only`, or `post`, decided from the flags at invocation. It is written to `meta.json` so a cold-resumed orchestrator (after compaction) knows which top-level flow to continue.

Size the round-1 diff for the dispatch plan (after writing it to `round-1/diff.txt` per the command above):

```bash
DIFF_LINES=$(wc -l < "$SESSION_DIR/round-1/diff.txt")
```

**CRITICAL:** Do not `cat`, `head`, `tail`, or otherwise read any `diff.txt` from the main context. The line count is the only thing the orchestrator needs to know about its contents.

### 2. Plan Dispatch

Enter plan mode via `EnterPlanMode`. The dispatch plan shows the user:

- **Skill:** `review-code` (so the orchestrator can reload the skill via the `Skill` tool if plan mode is re-entered)
- **Mode:** PR or branch
- **Target:** `PR #<N> "<title>"` (PR mode) or `<branch> vs main` (branch mode)
- **Repo:** `<owner>/<repo>`
- **Head SHA:** short hash
- **Diff size:** `<DIFF_LINES>` lines
- **Specialists to dispatch (all five, in parallel):**
  - `architecture-reviewer` → `findings-architecture.json`
  - `code-reviewer` → `findings-code.json`
  - `security-reviewer` → `findings-security.json`
  - `a11y-reviewer` → `findings-a11y.json`
  - `test-reviewer` → `findings-test.json`
- **Session directory:** `$SESSION_DIR` (round 1 artifacts under `round-1/`)
- **Focus notes:** the `--focus` argument, if any
- **Path:** default → auto-fix loop (compile + dedupe → triage → fix → re-review, committing locally); `--review-only` → one pass + interactive presentation; `--post` → one pass + post to GitHub
- **What happens after dispatch (default loop):** compile + dedupe → triage → user interventions on judgment calls → fixer subagent commits → `npm run check` → circuit-breaker → re-review or exit

Do **not** tier or skip specialists based on which files changed. Coverage uniformity matters more than saving an agent dispatch — a "no UI files changed" guess is exactly when an a11y issue slips through. All five always run. The agents themselves return an empty findings array when there's nothing in their dimension, which is cheap.

Exit plan mode via `ExitPlanMode` and wait for user approval before dispatching.

### 3. Dispatch Specialists in Parallel

Launch all five specialists in a **single message with five `Agent` tool calls** so they run in parallel. Each gets the same prompt template, parameterized by agent name, dimension label, and findings filename:

```
You are reviewing <mode> for repo <repo>, target <pr-or-branch>.

## Your assignment
Apply the methodology in `.claude/agents/<agent>.md` to the diff at
$SESSION_DIR/round-<round>/diff.txt. Read REVIEW.md (repo root) for severity
calibration and verification rules. Apply the diff-scope rule: only flag code in
`+` or `-` lines.

## Context files
- Diff: $SESSION_DIR/round-<round>/diff.txt
- REVIEW.md: REVIEW.md
- CLAUDE.md: CLAUDE.md
- Agent methodology: .claude/agents/<agent>.md
- <PR read-only paths only> PR branch checkout: $SESSION_DIR/repo/
- <PR mode only> Prior comments + author justifications: $SESSION_DIR/prior-comments.json
- <if focus notes> Focus: <focus notes>

## PR branch checkout (--post / --review-only PR paths only)
On the read-only PR paths the PR branch is checked out at $SESSION_DIR/repo/.
This is the ONLY source of truth for verifying code. Use Read, Grep, and Glob
against this directory, NOT the main repo working directory — it may be on a
different branch with stale or missing code. (On the auto-fix loop there is no
detached checkout: the PR branch IS the current working tree, so verify against
the working tree directly.)

## Diff-scope rule — CRITICAL
You are reviewing CHANGES MADE BY THIS PR/BRANCH. Do NOT flag pre-existing
issues. Only flag code in `+` or `-` lines of the diff. Context lines
(no prefix) and unchanged code in modified files are pre-existing — SKIP
them, even if they violate conventions. That's the #1 source of false
findings.

## Verification rules
- `file:line` citation required. No citation → drop your own finding
  before writing it out.
- Before flagging "missing X", grep the codebase (PR checkout, in PR mode)
  for X under different names. Don't flag a missing helper that exists
  under a slightly different name.
- For Important findings, check callers / reachability before asserting.
  If the only caller already guards the edge case, downgrade or drop.
- For docs/spec changes, spot-check factual claims (function signatures,
  error types, file paths) against actual source.

## Author-justification rule (PR mode only)
$SESSION_DIR/prior-comments.json contains prior review comments and their
threads. If a previous review flagged a finding and the author replied
with substantive explanatory text (not just "ok" or an emoji) explaining
why it's intentional, do NOT re-raise the same finding unless the
justification contains a technical error. Outdated comments (where
`position == null`) still count — the explanation may apply even if the
code anchor moved.

## Output
Write findings to $SESSION_DIR/round-<round>/findings-<agent>.json as a JSON
array per REVIEW.md's "Findings Output Format" section. Each finding has:
  { id, severity, dimension, title, file, line, body, suggestion, tradeoff? }
Set `tradeoff: true` only when a finding has multiple valid fix approaches (a
judgment call). Omit it otherwise. See REVIEW.md "Triage Rubric".
Set `dimension` to "<dimension>" on every entry. Severity caps from
REVIEW.md apply: Nits at most 5 reported per agent. If you have nothing
to flag, write an empty array (`[]`) — do not skip writing the file.
```

Per-agent substitutions:

| Agent slug            | `<agent>`             | `<dimension>` |
| --------------------- | --------------------- | ------------- |
| architecture-reviewer | architecture-reviewer | Architecture  |
| code-reviewer         | code-reviewer         | Code          |
| security-reviewer     | security-reviewer     | Security      |
| a11y-reviewer         | a11y-reviewer         | A11y          |
| test-reviewer         | test-reviewer         | Test          |

After dispatch, wait for all five agents to return. Each writes its findings file to `$SESSION_DIR/round-<round>/`. The orchestrator does not read agent transcripts — only the JSON files.

### 4. Compile + Dedupe (main context)

Read the five `$SESSION_DIR/round-<round>/findings-*.json` files. Apply, in order:

1. **Citation check.** Drop any finding with `file == null` or `line == null`. `REVIEW.md` requires a `file:line` citation.
2. **Diff-scope verification.** Parse `$SESSION_DIR/round-<round>/diff.txt` to identify, for each file, the set of line numbers on `+` or `-` lines (use the same hunk-walking logic that `resolve-diff-lines.ts` uses). Drop findings whose `(file, line)` pair isn't in that set. This is the same rule the subagents are supposed to enforce — duplicating it at compile time catches the cases they slip up on, especially context-line flags.
3. **Reachability pre-check on Important findings.** For each remaining `severity == "Important"` finding, open the cited file (in `$SESSION_DIR/repo/` for the read-only PR paths, working tree otherwise), find the call sites of the affected symbol, and confirm the edge case is reachable. **When in doubt, downgrade to Minor rather than drop** — the user can still see and approve it, but it isn't blocking the verdict.
4. **Dedupe by `(file, line)`.** When two findings target the same `(file, line)`, merge them: concatenate bodies with a separator, keep the higher severity, list both dimensions (e.g. `"Security + Code"`). This prevents the visual clutter of two GitHub comments on the same line.
5. **Author-justification filter (PR mode).** Cross-reference `prior-comments.json`. If a prior comment thread on the same `(file, line)` (or with the same finding topic on an outdated anchor) shows a substantive author justification, drop the new finding unless its body identifies a technical error in the justification.
6. **Nit cap.** After dedupe, if more than 5 Nits remain, keep the first 5 and replace the rest with a single summary entry like `"+ 12 more Nits — see $SESSION_DIR/round-<round>/findings-*.json for details"`.

Determine the verdict per `REVIEW.md`'s mapping (count post-dedupe, post-filter findings):

- 0 Critical, 0 Important → **READY FOR PR**
- 0 Critical, 1+ Important → **FIX BEFORE PR**
- 1+ Critical → **MAJOR FIXES NEEDED**
- Only Minor and/or Nit → **READY FOR PR** (Minor/Nit are informational)

Write the result to `$SESSION_DIR/round-<round>/compiled.json` (preserve each finding's `tradeoff` field through dedupe so triage can read it):

```json
{
  "summary": "<1-2 sentence overall summary>",
  "verdict": "READY FOR PR" | "FIX BEFORE PR" | "MAJOR FIXES NEEDED",
  "findings": [<deduplicated, verified findings array>]
}
```

Order findings: Critical → Important → Minor → Nit, then by file path, then by line.

## Auto-Fix Loop (default path)

Runs when neither `--post` nor `--review-only` is set. The orchestrator keeps a **skip-set** of finding identities the user chose to skip (identity = `file::normalized-title`, matching `circuit-breaker.ts`). Initialize `round = 1`, `skip-set = {}`.

**If context was compacted mid-loop**, re-read `$SESSION_DIR/meta.json` (its `path` field says whether the loop, `--review-only`, or `--post` is active), the highest-numbered `round-N/` files, and every `round-*/resolutions.json` (to rebuild the skip-set, and the **skipped-blocking** set from each entry's `severity`). Then resume mid-round by inspecting which `round-<highest>/` artifacts already exist:

| Present in `round-<N>/`                                       | Resume at                            |
| ------------------------------------------------------------- | ------------------------------------ |
| no `compiled.json`                                            | step 1 (restart the round)           |
| `compiled.json`, no `triage.json`                             | step 6                               |
| `triage.json`, no `fix-batch.json`                            | step 7                               |
| `fix-batch.json`, no `Auto-fix round <N>` commit in `git log` | step 11 (re-dispatch the fixer)      |
| `Auto-fix round <N>` commit present                           | step 12 (re-run check, then breaker) |

Each round:

1. `mkdir -p $SESSION_DIR/round-<round>`. Regenerate the diff locally: `git diff <baseRef>...HEAD > $SESSION_DIR/round-<round>/diff.txt`. Size it with `wc -l` only — never `cat` it.
2. **Review.** Dispatch the five specialists in parallel (same prompt template as `## Dispatch Specialists in Parallel`), writing `round-<round>/findings-<agent>.json`. Point them at `round-<round>/diff.txt`.
3. **Compile + dedupe** into `round-<round>/compiled.json` with verdict (same pipeline as `## Compile + Dedupe`).
4. **Effective findings** = `compiled.findings` whose identity is NOT in the skip-set.
5. If `effective` is empty → **EXIT SUCCESS** (jump to End-of-Loop Summary).
6. **Triage.** Dispatch the triage subagent (template below) over `effective`, writing `round-<round>/triage.json`.
7. **Interventions.** `needs_user` = effective findings classified `needs_user`.
   - If non-empty: present ONE consolidated `AskUserQuestion`. For each deferred finding offer **Fix as suggested** / **Fix with my guidance** (free text) / **Skip**. List the `auto_fix` findings in the same prompt as an FYI (no per-item action). Write `round-<round>/resolutions.json`:
     ```json
     { "round": <N>, "resolutions": [
       { "id": "<finding id>", "file": "<file>", "title": "<title>", "severity": "<severity>", "action": "fix" | "fix-with-guidance" | "skip", "guidance": "<text or omitted>" }
     ] }
     ```
     Add every `skip` identity to the skip-set; if a skipped finding is Critical or Important, also remember it as a **skipped-blocking** finding (its `severity` is recorded in `resolutions.json` so this survives compaction). `approved` = entries with action `fix`/`fix-with-guidance` (carry `guidance`).
   - If empty: `approved = []`, write no resolutions file.
8. **Fix batch.** `auto_fix` = effective findings classified `auto_fix`. `fix-batch` = `auto_fix ∪ approved`. Write `round-<round>/fix-batch.json` (full finding objects; attach `userGuidance` to any with guidance).
9. **Blocking-to-fix** = count of `fix-batch` findings with severity Critical or Important.
10. If `fix-batch` is empty (everything this round was skipped) → **EXIT** with a "remaining findings deliberately skipped" note (list them).
11. **Fix.** Dispatch the fixer subagent (template below) with `fix-batch.json`.
    - Status `CHECK_FAILED` → **HALT**; surface the failing `npm run check` output.
    - Status `ESCALATED` → for each escalated finding, present it as a `needs_user` intervention now (same prompt shape as step 7), then re-dispatch the fixer with the user's decisions folded in. The follow-up dispatch uses this same `CHECK_FAILED`/`ESCALATED` contract; a finding the user has already decided on is no longer eligible to escalate, so it cannot ping-pong. Do NOT add an escalated finding to the skip-set unless the user skips it. After escalation handling resolves the final `fix-batch`, recompute **blocking-to-fix** (step 9) before evaluating step 14.
12. **Verify.** Orchestrator independently runs `npm run check`. Fail → **HALT**; surface output. (Do not re-review on a broken tree.)
13. **Circuit breaker.** Run `npx tsx .claude/skills/review-code/circuit-breaker.ts "$SESSION_DIR" 7`. Parse its JSON. If `halt: true` → **HALT**; surface `reason` + `detail` + still-open findings + the commit range (`git log <baseRef>..HEAD --oneline`). Do NOT read or `cat` the diff into the orchestrator context.
14. If `blocking-to-fix > 0` → `round += 1` and repeat from step 1. If `blocking-to-fix == 0`:
    - and there is **no** skipped-blocking finding → **EXIT SUCCESS** (no blocking findings remain; any Minor/Nit are now fixed).
    - and one or more blocking findings were deliberately skipped → **EXIT — CLEAN EXCEPT FOR SKIPPED**: the tree is clean except for the skipped blocking finding(s). List them; do not report a plain SUCCESS verdict.

### Triage subagent prompt

```
You are triaging code-review findings for one round of an auto-fix loop.

## Input
- Findings to classify: $SESSION_DIR/round-<N>/compiled.json (use only the
  findings whose ids are in this list: <ids of effective findings>)
- Triage rubric: REVIEW.md, "Triage Rubric (auto-fix loop)" section
- Project conventions: CLAUDE.md
- Code to inspect: the current working tree (read the cited files to judge
  whether a fix is mechanical or a judgment call)

## Your job
Classify EACH listed finding as "auto_fix" or "needs_user" per the rubric.
Bias hard toward auto_fix. Mark needs_user ONLY when the FIX involves judgment:
- finding.tradeoff === true  → always needs_user
- UX judgment call (copy, layout, interaction model, empty/error-state design)
  AND more than one reasonable design exists → needs_user
- the fix would change established product behavior the user may have an
  opinion on → needs_user
Everything else (mechanical/determinate fix) → auto_fix.

Read the cited file before deciding. "Add aria-label to icon button" =
mechanical = auto_fix. "Modal focus trap fights drawer, pick interaction
model" = judgment = needs_user.

## Output
Write $SESSION_DIR/round-<N>/triage.json — every listed finding id exactly once:
[ { "id": "<id>", "classification": "auto_fix" | "needs_user", "reason": "<one sentence>" } ]
```

### Fixer subagent prompt

```
You are the fixer for one round of an auto-fix code-review loop.

## Input
- Findings to fix: $SESSION_DIR/round-<N>/fix-batch.json (array; each has
  id, severity, dimension, file, line, body, suggestion, and optional
  userGuidance)
- Conventions: CLAUDE.md and REVIEW.md
- Work in the current branch's working tree at <cwd>

## Your job
1. Apply a fix for EACH finding. Follow CLAUDE.md conventions. When a finding
   has userGuidance, follow it over the original suggestion.
2. Fix ONLY what the findings call for. No unrelated refactors (YAGNI).
3. Run `npm run check`. If it fails, fix the failure and retry ONCE. If it
   still fails, STOP and report CHECK_FAILED with the failing output — never
   commit broken code.
4. If check passes, commit ALL changes in ONE commit:
   `git commit -m "Auto-fix round <N>: <count> findings (<dimensions>)"`
5. Report back.

## Escalation
If a finding you were told to auto-fix actually requires a judgment call you
cannot make (multiple valid approaches, ambiguous intent), do NOT guess.
Report it under "escalated" with the id and why.

## Report format
- Status: DONE | CHECK_FAILED | ESCALATED
- fixed: [ids]
- escalated: [ { id, why } ]
- newIssuesNoticed: [brief notes on anything seen but not fixed]
- commit: <sha or "none">
- checkOutput: <tail of npm run check, only if CHECK_FAILED>
```

### End-of-Loop Summary

Print: final verdict, rounds run, commits created (one per round), findings fixed by severity, any findings deliberately skipped, and any new findings the fixer noticed/introduced along the way (informational). Because fixes are local-only, offer to push the branch (or, if this was a PR you don't own, point to `--post`). Do not push without explicit confirmation.

## Read-Only Paths

These two paths run a **single review pass** (loop steps 1-3, writing artifacts under `round-1/`) and then diverge. Neither triages, fixes, commits, or loops.

### `--review-only`

After the single pass, run the interactive tiered presentation and a terminal report. No commits.

**If context was compacted between dispatch and presentation**, re-read `$SESSION_DIR/round-1/compiled.json` and `$SESSION_DIR/meta.json` to restore state. The skill is resumable from disk.

Open with the verdict banner and the one-line summary, then run the tiered presentation:

- **Critical and Important findings — individually.** For each, use `AskUserQuestion`. Header includes severity tag, dimension(s), and `file:line`. Body shows the finding text and the suggested fix. Options:
  - **Approve** — include at current severity.
  - **Modify** — open a free-text edit for the comment body before approval.
  - **Downgrade** — drop one severity tier (Critical → Important, Important → Minor). A downgraded Important → Minor is **auto-approved at Minor** and not re-presented in the Minor batch.
  - **Skip** — exclude entirely.
  - The user may use "Other" to push back, ask a clarifying question, or request a targeted re-verification. Engage. If they question a specific finding, read the relevant file from `$SESSION_DIR/repo/` (or working tree) to re-check that one location — this is a small, targeted read, not loading the full diff.

- **Minor and Nit findings — batched, multi-select.** Present in batches of 4 via `AskUserQuestion` with multi-select. For each finding, show severity, `file:line`, and a 2-3 sentence summary (enough to decide include/skip without follow-up). Always offer **Include all** and **Skip all** as alternatives at the bottom of the batch.

After the last batch, summarize how many of each severity were approved, then print a terminal report grouped by severity. Lead with the verdict label in bold. For each approved finding: severity tag, `file:line`, title, and body. End with the count summary (e.g. `"3 Critical, 5 Important, 2 Minor approved"`). Save nothing else to disk — `compiled.json` already has the full record.

### `--post`

After the single pass (PR mode only), post approved findings to GitHub. No triage, no fix, no loop, no commits to the tree. Run the interactive tiered presentation above to select which findings to post, then ask the user the review event type via `AskUserQuestion`:

- **COMMENT** — findings without approval/rejection
- **REQUEST_CHANGES** — blocks merge until resolved
- **APPROVE** — approve with comments

Then build the review JSON from approved findings:

```bash
cat > "$SESSION_DIR/round-1/review.json" <<EOF
{
  "commit_id": "<HEAD_SHA from meta.json>",
  "body": "<summary from compiled.json + verdict label>",
  "event": "<user's choice>",
  "comments": [
    {"path": "<file>", "line": <N>, "side": "RIGHT", "body": "<severity tag + finding body + suggestion>"}
  ]
}
EOF
```

Run `resolve-diff-lines.ts` to validate every comment anchor against the diff. This is non-optional — GitHub returns 422 "Line could not be resolved" for any inline comment whose `(file, line)` doesn't land on a `+` or context line inside a hunk, and the script moves out-of-hunk comments to the nearest valid line (prefixing the body with `(Re: line N)`) and drops comments for files not in the diff:

```bash
npx tsx .claude/skills/review-code/resolve-diff-lines.ts \
  "$SESSION_DIR/round-1/diff.txt" \
  "$SESSION_DIR/round-1/review.json" \
  --output "$SESSION_DIR/round-1/review-resolved.json"
```

Surface the script's stderr to the user — any `MOVED:` or `DROPPED:` lines mean a finding got relocated or excluded, and the user should know before the review goes out.

Post the review:

```bash
gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
  --input "$SESSION_DIR/round-1/review-resolved.json"
```

**Post-submit verification — non-optional.** Fetch the last review to confirm it actually landed (silent failures and accidental duplicates have burned us before):

```bash
gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
  --jq '.[-1] | {id, state, submitted_at, html_url}'
```

If the post returns 422 "Line could not be resolved" despite running `resolve-diff-lines.ts`, the script's stderr will have logged which comments were moved or dropped — re-check those, fix manually in `review-resolved.json`, and retry the `gh api ... reviews` call. Do **not** test line validity by posting real reviews iteratively; submitted reviews cannot be deleted via API.

Report the review URL (`html_url` from the verification call) to the user.

## Verification Rules (for subagents)

These are restated in every subagent prompt and enforced again at compile time. Subagents that violate them produce findings that get dropped before the user ever sees them.

1. **`file:line` citation required.** No citation → finding is dropped at compile time, before presentation. (`REVIEW.md` §Verification Rules)
2. **Diff-scope rule.** Only `+` and `-` lines of `$SESSION_DIR/round-<N>/diff.txt` are in scope. Context lines (no prefix) and unchanged code in modified files are pre-existing — flagging them is the #1 source of false findings.
3. **Grep-before-flag.** Before flagging "missing X", search for X under variant names (e.g. `rightAriaLabel` vs `rightZoneAriaLabel`). In PR mode, grep `$SESSION_DIR/repo/`, not the main working tree.
4. **Reachability check on Important findings.** Read the caller(s) of the affected symbol. If the only caller already guards the edge case, downgrade or drop.
5. **Worktree-as-source-of-truth (PR mode).** All code verification reads go through `$SESSION_DIR/repo/`. The main working tree may be on a different branch with stale or missing code; using it for verification produces false findings against code that doesn't exist on the PR.
6. **Trust nothing from project docs without spot-checking.** Project docs (`CLAUDE.md`, `docs/*`) can be outdated. If a finding's rationale depends on a doc claim, verify against source code or flag uncertainty.
7. **Single-pass discipline.** Each specialist runs once per review. The orchestrator does not chain a verifier agent or re-run a specialist — published research on multi-turn agentic review shows F1 degrades and agents fabricate findings as real ones get exhausted.

## Common Mistakes

| Mistake                                                 | Fix                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Flagging pre-existing code as a PR issue**            | **The #1 mistake.** Diff-scope rule: only flag `+`/`-` lines. Context lines and unchanged code are out of scope even if they violate conventions.                  |
| Loading the full diff into main context                 | The orchestrator only ever runs `wc -l < $SESSION_DIR/round-<N>/diff.txt`. Subagents read the diff from disk; the orchestrator reads JSON findings.                |
| Finding based on assumed code state                     | Subagents must verify against `$SESSION_DIR/repo/` (PR mode) or the working tree (branch mode). No "I think this calls X" — open the file and confirm.             |
| Marking test issues as Critical                         | Critical is reserved for production bugs, data loss, security vulns. Test anti-patterns are Important at most — `REVIEW.md` §Severity Tiers spells this out.       |
| Severity miscalibrated to deployment context            | Weekly-eats is a single-user app. Theoretical multi-tenant attacks and "what if 10k users" scalability concerns aren't in scope.                                   |
| Posting without interactive approval                    | Every finding goes through `AskUserQuestion` (individually for Critical/Important, batched for Minor/Nit). Never auto-post anything from raw subagent output.      |
| Not using `resolve-diff-lines.ts` before posting        | Always run the script before `gh api ... reviews`. It moves out-of-hunk comments to valid lines and drops comments for files not in the diff. Skipping it → 422.   |
| Not verifying the review was actually posted            | After `gh api ... reviews` returns success, fetch the last review and confirm `state` and `submitted_at`. Silent failures and duplicate posts have happened.       |
| Re-flagging issues the author already justified         | PR mode: check `prior-comments.json` for substantive author replies. If the explanation is sound, don't re-raise. Outdated comments still count.                   |
| Using diff.txt line numbers as file line numbers        | Diff line numbers and file line numbers are different. `resolve-diff-lines.ts` parses `@@` hunk headers to map between them; trust the script.                     |
| Dropping resolved Important findings silently           | If the reachability check or author-justification filter drops an Important, mention it to the user — they may want to see what was filtered.                      |
| Skipping `--post` verification when GH returns success  | `gh api` can return 200 on a malformed body that GitHub silently treats as a no-op. Always run the post-submit verify call.                                        |
| Trying to delete a bad review via API                   | Submitted reviews cannot be deleted via the GitHub API. Never iterate by re-posting — fix `review-resolved.json` and retry only after the resolve script is clean. |
| Tiering or skipping specialists based on "what changed" | All five specialists always run. Coverage uniformity beats saving one agent dispatch — the agent returns `[]` if there's nothing to flag.                          |
| Using `gh pr diff` inside the loop                      | Rounds 2+ have local fix commits not on the remote. Always recompute `git diff <baseRef>...HEAD` locally each round.                                               |
| Auto-fixing a PR you don't have checked out             | Auto-fix needs the PR's branch as the current branch. If it isn't, stop and direct the user to `--post` or `--review-only`.                                        |
| Re-reviewing on a broken tree                           | If `npm run check` fails after a fix, HALT. Never run the next review round on code that doesn't build/test.                                                       |
| Re-raising a finding the user skipped                   | Skipped identities go in the skip-set and are excluded from every later round's effective findings AND the circuit breaker.                                        |
| Eyeballing "are we stuck?" by hand                      | Always call `circuit-breaker.ts`. Finding-identity comparison across rounds is deterministic; manual judgment drifts after compaction.                             |
| Pushing automatically at loop end                       | The loop commits locally only. Pushing is always a separate, user-confirmed step.                                                                                  |
