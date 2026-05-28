---
name: review-code
description: Run a multi-agent code review on a PR or local branch. Auto-detects mode. Optionally posts inline findings to GitHub.
user-invocable: true
---

# Review Code

Run a multi-dimensional code review on either an open pull request or a local branch (vs `main`). The main context is an **orchestrator** — it fetches metadata, dispatches five specialist agents in parallel, compiles their findings, runs an interactive tiered approval, and optionally posts approved findings as inline GitHub review comments. It never loads the full diff or any agent's raw output into its own conversation; subagents do all heavy reading and write structured results to disk.

This skill **replaces the legacy `/review-pr` skill.** Unlike the old version, it auto-detects whether you're reviewing a PR or a local branch, always dispatches the full set of specialists (architecture, code, security, a11y, test) so coverage is uniform across reviews, enforces the severity and verification rules in `REVIEW.md` at compile time (not just by hope), and exposes a `--post` mode that pushes approved findings to GitHub through `resolve-diff-lines.ts` so out-of-hunk anchors never trigger 422 errors.

The five specialist agents live under `.claude/agents/` and read `REVIEW.md` (severity rubric, exclusions, verification rules) plus `CLAUDE.md` (project conventions) before producing findings. Every finding they emit must cite a `file:line` and target a `+`/`-` line in the diff — context-line and unchanged-code findings are dropped at compile time. The orchestrator does not chain a "verifier agent" or run agents twice; single-pass discipline is enforced by `REVIEW.md` because multi-turn agentic review degrades F1 and fabricates findings as real ones get exhausted.

## Invocation

| Form                           | Behavior                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/review-code`                 | Auto-detect mode. If the current branch has an open PR on the remote, run PR mode against it; otherwise run branch mode vs `main`. |
| `/review-code pr <N>`          | Explicit PR mode against PR `<N>`.                                                                                                 |
| `/review-code branch`          | Explicit branch mode (diff `main...HEAD`), even if the current branch has an open PR.                                              |
| `/review-code --post`          | PR mode (auto-detected or explicit). After interactive approval, post approved findings as inline review comments to GitHub.       |
| `/review-code --focus <notes>` | Pass `<notes>` to every specialist as additional focus. Combinable with the other forms (e.g. `/review-code pr 42 --focus a11y`).  |

**Auto-detection rule.** Run `gh pr list --head "$(git rev-parse --abbrev-ref HEAD)" --json number,headRefOid,headRefName --limit 1`. If the result is non-empty, default to PR mode. Otherwise default to branch mode. If the user passed `branch` explicitly, skip the lookup. If the user passed `pr <N>` explicitly, use `<N>` and don't auto-detect.

**`--post` only applies to PR mode.** If the user passes `--post` without a PR (and auto-detection finds none), stop and tell them — branch mode has nothing to post against.

## Session Directory

All review artifacts live in a per-invocation temp directory so parallel reviews don't collide:

```bash
SESSION_DIR=$(mktemp -d /tmp/review-XXXXXXXX)
```

Files written during the review:

| Path                                      | Written by     | Purpose                                                                   |
| ----------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| `$SESSION_DIR/meta.json`                  | orchestrator   | Mode, PR number (if any), repo, branch, head SHA, focus notes             |
| `$SESSION_DIR/diff.txt`                   | orchestrator   | Full unified diff. **Never read by the main context.**                    |
| `$SESSION_DIR/repo/`                      | orchestrator   | PR-mode only: detached `git worktree` at the PR head SHA                  |
| `$SESSION_DIR/prior-comments.json`        | orchestrator   | PR-mode only: prior review comments + threads (for author justifications) |
| `$SESSION_DIR/findings-architecture.json` | arch agent     | Architecture-reviewer findings array                                      |
| `$SESSION_DIR/findings-code.json`         | code agent     | Code-reviewer findings array                                              |
| `$SESSION_DIR/findings-security.json`     | sec agent      | Security-reviewer findings array                                          |
| `$SESSION_DIR/findings-a11y.json`         | a11y agent     | A11y-reviewer findings array                                              |
| `$SESSION_DIR/findings-test.json`         | test agent     | Test-reviewer findings array                                              |
| `$SESSION_DIR/compiled.json`              | orchestrator   | Deduplicated, verified findings + summary + verdict                       |
| `$SESSION_DIR/review.json`                | orchestrator   | PR-mode posting: review body + approved comments (pre-resolve)            |
| `$SESSION_DIR/review-resolved.json`       | resolve script | PR-mode posting: comments after line-anchor resolution                    |

**CRITICAL:** The main context only ever runs `wc -l < $SESSION_DIR/diff.txt` to size the diff. It never `cat`s the diff, never reads the full thing, never echoes it back. Subagents read the diff from disk and write structured findings; the orchestrator reads the findings JSON, not the diff.

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
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

# Save the full diff to disk — never load into context
gh pr diff "$PR_NUMBER" > "$SESSION_DIR/diff.txt"

# Prior review comments — used for author-justification handling
gh api "repos/$REPO/pulls/$PR_NUMBER/comments" \
  --jq '[.[] | {id, in_reply_to_id, path, line, position, body, user: .user.login}]' \
  > "$SESSION_DIR/prior-comments.json"

# Worktree checkout at the PR head — subagents verify code against this tree
git fetch origin "$PR_BRANCH"
git worktree add --detach "$SESSION_DIR/repo" "$HEAD_SHA"
```

**Branch mode:**

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
HEAD_SHA=$(git rev-parse HEAD)
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || echo "local")

# Diff against main — same shape as gh pr diff so subagents can apply the diff-scope rule uniformly
git diff main...HEAD > "$SESSION_DIR/diff.txt"

# No worktree, no prior comments — subagents verify against the current working tree
```

Then write `meta.json` in both modes:

```bash
cat > "$SESSION_DIR/meta.json" <<EOF
{
  "mode": "${MODE}",
  "pr": ${PR_NUMBER:-null},
  "repo": "${REPO}",
  "branch": "${BRANCH}",
  "headSha": "${HEAD_SHA}",
  "sessionDir": "${SESSION_DIR}",
  "focusNotes": ${FOCUS_JSON:-null}
}
EOF
```

Size the diff for the dispatch plan:

```bash
DIFF_LINES=$(wc -l < "$SESSION_DIR/diff.txt")
```

**CRITICAL:** Do not `cat`, `head`, `tail`, or otherwise read `$SESSION_DIR/diff.txt` from the main context. The line count is the only thing the orchestrator needs to know about its contents.

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
- **Session directory:** `$SESSION_DIR`
- **Focus notes:** the `--focus` argument, if any
- **What happens after dispatch:** compile + dedupe → tiered interactive approval → (PR mode + `--post`) post to GitHub

Do **not** tier or skip specialists based on which files changed. Coverage uniformity matters more than saving an agent dispatch — a "no UI files changed" guess is exactly when an a11y issue slips through. All five always run. The agents themselves return an empty findings array when there's nothing in their dimension, which is cheap.

Exit plan mode via `ExitPlanMode` and wait for user approval before dispatching.

### 3. Dispatch Specialists in Parallel

Launch all five specialists in a **single message with five `Agent` tool calls** so they run in parallel. Each gets the same prompt template, parameterized by agent name, dimension label, and findings filename:

```
You are reviewing <mode> for repo <repo>, target <pr-or-branch>.

## Your assignment
Apply the methodology in `.claude/agents/<agent>.md` to the diff at
$SESSION_DIR/diff.txt. Read REVIEW.md (repo root) for severity calibration
and verification rules. Apply the diff-scope rule: only flag code in
`+` or `-` lines.

## Context files
- Diff: $SESSION_DIR/diff.txt
- REVIEW.md: REVIEW.md
- CLAUDE.md: CLAUDE.md
- Agent methodology: .claude/agents/<agent>.md
- <PR mode only> PR branch checkout: $SESSION_DIR/repo/
- <PR mode only> Prior comments + author justifications: $SESSION_DIR/prior-comments.json
- <if focus notes> Focus: <focus notes>

## PR branch checkout (PR mode only)
The PR branch is checked out at $SESSION_DIR/repo/. This is the ONLY
source of truth for verifying code. Use Read, Grep, and Glob against
this directory, NOT the main repo working directory — it may be on a
different branch with stale or missing code.

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
Write findings to $SESSION_DIR/findings-<agent>.json as a JSON array per
REVIEW.md's "Findings Output Format" section. Each finding has:
  { id, severity, dimension, title, file, line, body, suggestion }
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

After dispatch, wait for all five agents to return. Each writes its findings file to `$SESSION_DIR/`. The orchestrator does not read agent transcripts — only the JSON files.

### 4. Compile + Dedupe (main context)

Read the five `$SESSION_DIR/findings-*.json` files. Apply, in order:

1. **Citation check.** Drop any finding with `file == null` or `line == null`. `REVIEW.md` requires a `file:line` citation.
2. **Diff-scope verification.** Parse `$SESSION_DIR/diff.txt` to identify, for each file, the set of line numbers on `+` or `-` lines (use the same hunk-walking logic that `resolve-diff-lines.ts` uses). Drop findings whose `(file, line)` pair isn't in that set. This is the same rule the subagents are supposed to enforce — duplicating it at compile time catches the cases they slip up on, especially context-line flags.
3. **Reachability pre-check on Important findings.** For each remaining `severity == "Important"` finding, open the cited file (in `$SESSION_DIR/repo/` for PR mode, working tree for branch mode), find the call sites of the affected symbol, and confirm the edge case is reachable. **When in doubt, downgrade to Minor rather than drop** — the user can still see and approve it, but it isn't blocking the verdict.
4. **Dedupe by `(file, line)`.** When two findings target the same `(file, line)`, merge them: concatenate bodies with a separator, keep the higher severity, list both dimensions (e.g. `"Security + Code"`). This prevents the visual clutter of two GitHub comments on the same line.
5. **Author-justification filter (PR mode).** Cross-reference `prior-comments.json`. If a prior comment thread on the same `(file, line)` (or with the same finding topic on an outdated anchor) shows a substantive author justification, drop the new finding unless its body identifies a technical error in the justification.
6. **Nit cap.** After dedupe, if more than 5 Nits remain, keep the first 5 and replace the rest with a single summary entry like `"+ 12 more Nits — see $SESSION_DIR/findings-*.json for details"`.

Determine the verdict per `REVIEW.md`'s mapping (count post-dedupe, post-filter findings):

- 0 Critical, 0 Important → **READY FOR PR**
- 0 Critical, 1+ Important → **FIX BEFORE PR**
- 1+ Critical → **MAJOR FIXES NEEDED**
- Only Minor and/or Nit → **READY FOR PR** (Minor/Nit are informational)

Write the result to `$SESSION_DIR/compiled.json`:

```json
{
  "summary": "<1-2 sentence overall summary>",
  "verdict": "READY FOR PR" | "FIX BEFORE PR" | "MAJOR FIXES NEEDED",
  "findings": [<deduplicated, verified findings array>]
}
```

Order findings: Critical → Important → Minor → Nit, then by file path, then by line. This is the order they'll be presented in step 5.

### 5. Interactive Tiered Presentation

**If context was compacted between dispatch and presentation**, re-read `$SESSION_DIR/compiled.json` and `$SESSION_DIR/meta.json` to restore state. The skill is resumable from disk.

Open with the verdict banner and the one-line summary, then run the tiered presentation:

- **Critical and Important findings — individually.** For each, use `AskUserQuestion`. Header includes severity tag, dimension(s), and `file:line`. Body shows the finding text and the suggested fix. Options:
  - **Approve** — include at current severity.
  - **Modify** — open a free-text edit for the comment body before approval.
  - **Downgrade** — drop one severity tier (Critical → Important, Important → Minor). A downgraded Important → Minor is **auto-approved at Minor** and not re-presented in the Minor batch.
  - **Skip** — exclude entirely.
  - The user may use "Other" to push back, ask a clarifying question, or request a targeted re-verification. Engage. If they question a specific finding, read the relevant file from `$SESSION_DIR/repo/` (or working tree) to re-check that one location — this is a small, targeted read, not loading the full diff.

- **Minor and Nit findings — batched, multi-select.** Present in batches of 4 via `AskUserQuestion` with multi-select. For each finding, show severity, `file:line`, and a 2-3 sentence summary (enough to decide include/skip without follow-up). Always offer **Include all** and **Skip all** as alternatives at the bottom of the batch.

After the last batch, summarize how many of each severity were approved.

### 6. Output

**Branch mode (always) and PR mode without `--post`:** print a terminal report grouped by severity. Lead with the verdict label in bold. For each approved finding: severity tag, `file:line`, title, and body. End with the count summary (e.g. `"3 Critical, 5 Important, 2 Minor approved"`). Save nothing else to disk — `compiled.json` already has the full record.

**PR mode with `--post`:** ask the user the review event type via `AskUserQuestion`:

- **COMMENT** — findings without approval/rejection
- **REQUEST_CHANGES** — blocks merge until resolved
- **APPROVE** — approve with comments

Then build the review JSON from approved findings:

```bash
cat > "$SESSION_DIR/review.json" <<EOF
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
  "$SESSION_DIR/diff.txt" \
  "$SESSION_DIR/review.json" \
  --output "$SESSION_DIR/review-resolved.json"
```

Surface the script's stderr to the user — any `MOVED:` or `DROPPED:` lines mean a finding got relocated or excluded, and the user should know before the review goes out.

Post the review:

```bash
gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
  --input "$SESSION_DIR/review-resolved.json"
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
2. **Diff-scope rule.** Only `+` and `-` lines of `$SESSION_DIR/diff.txt` are in scope. Context lines (no prefix) and unchanged code in modified files are pre-existing — flagging them is the #1 source of false findings.
3. **Grep-before-flag.** Before flagging "missing X", search for X under variant names (e.g. `rightAriaLabel` vs `rightZoneAriaLabel`). In PR mode, grep `$SESSION_DIR/repo/`, not the main working tree.
4. **Reachability check on Important findings.** Read the caller(s) of the affected symbol. If the only caller already guards the edge case, downgrade or drop.
5. **Worktree-as-source-of-truth (PR mode).** All code verification reads go through `$SESSION_DIR/repo/`. The main working tree may be on a different branch with stale or missing code; using it for verification produces false findings against code that doesn't exist on the PR.
6. **Trust nothing from project docs without spot-checking.** Project docs (`CLAUDE.md`, `docs/*`) can be outdated. If a finding's rationale depends on a doc claim, verify against source code or flag uncertainty.
7. **Single-pass discipline.** Each specialist runs once per review. The orchestrator does not chain a verifier agent or re-run a specialist — published research on multi-turn agentic review shows F1 degrades and agents fabricate findings as real ones get exhausted.

## Common Mistakes

| Mistake                                                 | Fix                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Flagging pre-existing code as a PR issue**            | **The #1 mistake.** Diff-scope rule: only flag `+`/`-` lines. Context lines and unchanged code are out of scope even if they violate conventions.                  |
| Loading the full diff into main context                 | The orchestrator only ever runs `wc -l < $SESSION_DIR/diff.txt`. Subagents read the diff from disk; the orchestrator reads JSON findings.                          |
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
