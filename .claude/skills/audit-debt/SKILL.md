---
name: audit-debt
description: Periodic full-repo sweep for accumulated technical, security, and architectural debt. Produces a prioritized backlog you can act on.
user-invocable: true
---

# Audit Debt

Periodic full-repo sweep for accumulated technical, security, and architectural debt. The main context is an orchestrator: it gathers sweep-prep artifacts (npm audit, TODO census, file list, recent dependency churn), dispatches the same four specialist agents `/review-code` uses in **sweep mode** (no diff scope) in parallel, computes three additional dimensions itself (dependency staleness/vulns, TODO/FIXME accumulation, documentation drift), compiles the results into a backlog sorted by severity × inverse-effort, attaches its own point of view to each Critical/Important finding, and offers to save the report and/or file approved findings as GitHub issues.

This skill is **not a sibling of `/review-code`**. `/review-code` finds bugs in new code; `/audit-debt` finds bugs in old code that has rotted. The diff-scope rule does NOT apply — every line in `src/` is in scope. The trade-off is that it is **slow and thorough by design** — meant to be run occasionally (suggest monthly), not before every PR. Running it weekly will drown you in nits you have already triaged; running it never will let real debt accumulate to "rewrite this feature" levels.

Read `REVIEW.md` first for the severity rubric — the tier definitions get a debt-context recalibration in §Severity Recalibration for Debt Context below.

## Invocation

| Form          | Behavior                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/audit-debt` | Sweep the whole repo. No flags. After the report is produced, the skill offers (interactively) to save the report to a file and/or file Critical/Important findings as GitHub issues. |

## Session Directory

All audit artifacts live in a per-invocation temp directory so parallel runs don't collide:

```bash
SESSION_DIR=$(mktemp -d /tmp/audit-debt-XXXXXXXX)
```

| Path                                      | Written by   | Purpose                                                                    |
| ----------------------------------------- | ------------ | -------------------------------------------------------------------------- |
| `$SESSION_DIR/meta.json`                  | orchestrator | Repo, branch, head SHA, session dir, file count                            |
| `$SESSION_DIR/sweep-prep/`                | orchestrator | Directory of prep artifacts (npm audit, TODO census, file list, dep churn) |
| `$SESSION_DIR/findings-architecture.json` | arch agent   | Architecture-reviewer findings array                                       |
| `$SESSION_DIR/findings-code.json`         | code agent   | Code-reviewer findings array                                               |
| `$SESSION_DIR/findings-security.json`     | sec agent    | Security-reviewer findings array                                           |
| `$SESSION_DIR/findings-test.json`         | test agent   | Test-reviewer findings array                                               |
| `$SESSION_DIR/orchestrator-findings.json` | orchestrator | Deps + TODO accumulation + doc-drift findings                              |
| `$SESSION_DIR/compiled.json`              | orchestrator | Sorted, prioritized backlog + totals + summary                             |
| `$SESSION_DIR/report.md`                  | orchestrator | Final markdown report (optionally saved by user)                           |

## Workflow

### 1. Sweep Prep

Generate the artifacts every specialist (and the orchestrator) will read:

```bash
mkdir -p "$SESSION_DIR/sweep-prep"

# Dependency audit (CVEs, advisories)
npm audit --json > "$SESSION_DIR/sweep-prep/npm-audit.json" 2>&1 || true

# TODO/FIXME/XXX/HACK census across the TS/TSX surface
rg "TODO|FIXME|XXX|HACK" --type ts --type tsx -n src/ > "$SESSION_DIR/sweep-prep/todos.txt" 2>&1 || true

# Full file list for sweep dispatch
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) > "$SESSION_DIR/sweep-prep/files.txt"

# Recently churned dependencies (last 90 days) — used to flag low-trust recent adds
git log --since="90 days ago" --pretty=format: --name-only -- package.json | sort -u > "$SESSION_DIR/sweep-prep/dep-changes.txt"
```

Then read `CLAUDE.md` and extract specific factual claims the orchestrator will later verify in §4 (e.g., "all error constants in `@/lib/errors`", "auth uses JWT strategy with `isAdmin` cached in the token", named module paths under `src/lib/`). Save the extracted claims to `$SESSION_DIR/sweep-prep/claude-md-claims.txt` so the doc-drift checks in §4 don't re-read the whole file.

Write metadata:

```bash
FILE_COUNT=$(wc -l < "$SESSION_DIR/sweep-prep/files.txt")
HEAD_SHA=$(git rev-parse HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || echo "local")

cat > "$SESSION_DIR/meta.json" <<EOF
{
  "repo": "$REPO",
  "branch": "$BRANCH",
  "headSha": "$HEAD_SHA",
  "sessionDir": "$SESSION_DIR",
  "fileCount": $FILE_COUNT
}
EOF
```

### 2. Plan Dispatch

Enter plan mode via `EnterPlanMode`. Show the user:

- **Skill:** `audit-debt`
- **Scope:** the whole repo — `$FILE_COUNT` files under `src/`
- **Specialists to dispatch (all four, in parallel):**
  - `architecture-reviewer` → `findings-architecture.json`
  - `code-reviewer` → `findings-code.json`
  - `security-reviewer` → `findings-security.json`
  - `test-reviewer` → `findings-test.json`
- **Orchestrator-driven dimensions (run in parallel with specialists):** dependency staleness + vulnerabilities, TODO/FIXME accumulation, documentation drift
- **Session directory:** `$SESSION_DIR`
- **Note:** this is a slow run by design — expect ~minutes, not seconds.

Exit plan mode via `ExitPlanMode` and wait for approval before dispatching.

### 3. Dispatch Specialists in Parallel

Launch all four specialists in a **single message with four `Agent` tool calls** so they run in parallel. Each gets the same sweep-mode prompt template, parameterized by agent name and findings filename:

```
You are sweeping the codebase for accumulated debt, NOT reviewing a diff.

## Your assignment
Apply the methodology in `.claude/agents/<agent>.md`, but instead of focusing
on changed lines, sweep the entire codebase under src/ (and other paths as
relevant) for accumulated issues. REVIEW.md applies.

## Context files
- File list: $SESSION_DIR/sweep-prep/files.txt
- REVIEW.md: REVIEW.md
- CLAUDE.md: CLAUDE.md
- Agent methodology: .claude/agents/<agent>.md

## Sweep-mode framing
The diff-scope rule does NOT apply — you are auditing existing code. But the
do-NOT-flag list in REVIEW.md and your agent file STILL applies. Pattern
violations that are *consistent across the codebase* are pre-existing
convention, not debt — consistency > novelty.

## Per-agent focus at audit time
- architecture-reviewer: layering violations (e.g., `getMongoClient` called from
  a component), file-size monsters (>500 lines), abstraction creep (3+ duplicate
  patterns without a shared util, OR utils that are used in only 1 place),
  cross-feature import smells.
- code-reviewer: CLAUDE.md drift (docs say X, code does Y), pattern
  inconsistency (some routes use error constants, others hardcode), naming /
  convention drift, missing `@/` aliases, dead exports. Also the narrow
  self-usability cases per REVIEW.md (a control reachable by no available
  interaction, a focus bug that blocks a flow, text too low-contrast to read) —
  NOT general accessibility, which is out of scope for this app.
- security-reviewer: missing ownership filters in EXISTING routes (high-priority
  sweep — apply the IDOR methodology to every route that touches a userId-scoped
  collection), missing `ObjectId.isValid` checks, share/invite paths without
  the canonical auth verification.
- test-reviewer: untested files (especially API routes and `lib/` utilities —
  flag what does NOT have a matching `__tests__/<file>.test.ts`), low-coverage
  code paths, weak assertions (tests that pass without exercising behavior).

## Effort estimate (REQUIRED on every finding)
For each finding, estimate effort:
- "Quick" (<30 min): rename, hardcoded → constant, `npm audit fix`
- "Medium" (30 min – 4 hours): refactor a hook, add tests for a route, fix an IDOR
- "Big-job" (multi-session): restructure a feature, migrate a collection, replace a dependency

## Output
Write findings to $SESSION_DIR/findings-<agent>.json as a JSON array per
REVIEW.md's "Findings Output Format" section, with an additional "effort"
field: "Quick" | "Medium" | "Big-job". Set `dimension` to "<dimension>" on
every entry. If you have nothing to flag, write `[]` — do not skip writing
the file.
```

Per-agent substitutions match `/review-code` (architecture-reviewer / Architecture, code-reviewer / Code, security-reviewer / Security, test-reviewer / Test).

### 4. Orchestrator-Driven Dimensions (main context, in parallel with §3)

While the specialists run, the main context computes three additional dimensions itself. These don't need a subagent — they're rule-based passes over the sweep-prep artifacts.

**Dependency staleness + vulnerabilities.**

- Parse `$SESSION_DIR/sweep-prep/npm-audit.json`. For each advisory, emit a finding with severity mapped from advisory severity: `critical` / `high` → Critical / Important; `moderate` → Minor; `low` → Nit. Include the dep name, advisory URL, and recommended fix (`npm audit fix`, or the version range). Effort: `Quick` for `npm audit fix`-able, `Medium` if a major bump is required, `Big-job` for breaking changes that require code edits.
- For deps listed in `$SESSION_DIR/sweep-prep/dep-changes.txt` (recently added in the last 90 days): note any with low weekly download counts (`npm view <name> --json` and inspect `dist-tags`/`time`; if available, use `npm view <name> downloads`). Flag as Minor "recently added, low-trust dep" with effort `Quick`.
- Scan `package.json` for `dependencies` or `devDependencies` entries whose source declares a `postinstall` or `preinstall` script (`npm view <name> scripts`). Flag as Minor "supply-chain risk vector — review what this script does" with effort `Quick`.

**TODO/FIXME accumulation.**

- Read `$SESSION_DIR/sweep-prep/todos.txt`. Count total. For the 5 oldest, find the introducing commit with `git log --reverse --pretty=format:"%ai %H %s" -S "TODO" -- <file>` (heuristic — the `-S` flag picks the commit that added the token). Emit a **single** finding: `"Accumulated <N> TODO/FIXME markers across the codebase; oldest dated <YYYY-MM-DD> in <file>."` Severity: Minor if N < 20, Important if N >= 20. Effort: `Medium` (triage + close).

**Documentation drift.**

- Read `$SESSION_DIR/sweep-prep/claude-md-claims.txt`. For each path/file reference in `CLAUDE.md` (`@/foo`, `src/...`, `.claude/...`): verify it exists on disk. Missing references → Minor "CLAUDE.md drift: references nonexistent `<path>`" with effort `Quick`.
- Repeat for `docs/architecture.md`, `docs/api-patterns.md`, `docs/setup.md`, `docs/testing.md`, `docs/product.md` if they exist. Same check — every file path mentioned in prose should resolve.
- If `CLAUDE.md` claims a script or command (e.g., `npm run check`), verify it exists in `package.json` scripts. Missing → Minor.

Write all orchestrator-derived findings to `$SESSION_DIR/orchestrator-findings.json` using the same schema as the agent findings (including the `effort` field). Use ids like `orchestrator-deps-001`, `orchestrator-todo-001`, `orchestrator-docs-001` so they don't collide with subagent ids.

### 5. Compile + Prioritize + Present

Once all four specialist files and `orchestrator-findings.json` exist on disk, read them all. Apply:

1. **Citation check.** Drop any finding with `file == null` or `line == null` (matches `REVIEW.md` §Verification Rules — citations are required even in sweep mode). Exception: the single aggregate "Accumulated TODO/FIXME markers" finding may cite the oldest file/line.
2. **Existence check.** For every cited file, confirm it exists. Subagents occasionally hallucinate file paths under a sweep — drop findings whose `file` does not resolve on disk.
3. **Dedupe by `(file, line)`.** Merge bodies with a separator, keep the higher severity, list both dimensions.
4. **Nit cap.** Keep at most 5 Nits in the presentation; replace the rest with a single summary count.
5. **Orchestrator POV (Critical/Important only).** Per REVIEW.md "Orchestrator POV", for each Critical/Important finding that survives the above, open the cited file at the cited line and form a **Fix / Skip / Defer + one-sentence rationale + High/Low confidence** take. In a debt sweep, "Defer" is common and legitimate — a Big-job finding is usually real-but-schedule-it, not fix-now. "Skip" means the debt isn't worth paying down (consistent-by-convention, or cost > benefit in this single-user app). Attach `recommendation`, `rationale`, and `confidence` to each such finding in `compiled.json`. Skip the POV for Minor/Nit — the backlog stays lean.

Then **sort by severity × inverse-effort** (high-impact + low-effort first) into these presentation buckets:

1. Critical (any effort)
2. Important + Quick
3. Important + Medium
4. Important + Big-job
5. Minor + Quick
6. Minor + Medium or Big-job
7. Nit (cap at 5 + count of rest)

Write `$SESSION_DIR/compiled.json`:

```json
{
  "summary": "<1 paragraph: N findings across <C> categories; top concerns are X, Y, Z>",
  "totals": { "Critical": N, "Important": N, "Minor": N, "Nit": N },
  "findings": [<sorted array, in bucket order above; Critical/Important entries carry recommendation, rationale, confidence>]
}
```

Render `$SESSION_DIR/report.md`: a markdown report grouped by category (Architecture / Code / Security / Test / Dependencies / TODOs / Docs), with the priority order above applied within each category. Under each Critical/Important finding, render its **POV** on its own line (e.g. `→ POV: Defer (High confidence) — real debt, but a multi-session restructure; schedule it, don't fix it now`). Print the report to the terminal.

**Interactive offers at the end** (apply in order):

1. `AskUserQuestion`: _"Save this report to a file?"_ Options:
   - **Yes, default location** — `cp "$SESSION_DIR/report.md" "docs/debt-audit-$(date +%Y-%m-%d).md"`
   - **Yes, custom path** — prompt for the path, then `cp`.
   - **No** — skip.
2. If `compiled.json` contains any Critical or Important findings, `AskUserQuestion`: _"File any Critical/Important findings as GitHub issues?"_ Options:
   - **Yes — go through them one by one** — iterate Critical+Important findings; for each, `AskUserQuestion` _"File this as an issue?"_ — lead with the orchestrator **POV** (recommendation + rationale + confidence) so you can decide whether it's even worth an issue, then show the auto-drafted title and body. On Yes, run `gh issue create --title "<title>" --body "<body>"`. Title format: `"<severity>: <finding title>"`. Body: finding text + `file:line` + suggestion + effort estimate + `_Surfaced by /audit-debt on <date>_`. (The POV guides your filing decision; it is not written into the issue body.)
   - **No, I'll do this manually** — skip.

End of skill — no posting to PRs, no further checks.

## Severity Recalibration for Debt Context

Restated for this skill (the `REVIEW.md` table is calibrated for diff review; debt review needs slightly different anchors):

| Tier          | Definition (debt context)                                                                                                     | Examples                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Critical**  | Active security risk in shipped code — exploitable today, not "theoretical if X."                                             | An API route returning userId-scoped data without a `userId` filter; mutation without ownership check; missing admin gate on `/api/admin/*` |
| **Important** | Bug waiting to happen (will trigger under normal use) OR significant architecture violation that is making future work harder | A handler that throws on bad ObjectId and surfaces as 500; a 900-line component with 8 responsibilities; an untested route handler          |
| **Minor**     | Real issue, small impact — consistency, missing test on a low-risk path, small refactor, minor abstraction creep              | Magic number; one route hardcodes error strings while others use `@/lib/errors`; a util used by only one caller                             |
| **Nit**       | Cleanup / naming / dead code that doesn't change behavior or risk                                                             | Unused export; inconsistent comment style; outdated TODO that's no longer relevant                                                          |

Apply this rubric in §5 compile + prioritization. The diff-scope tier (`Pre-existing`) does **not** apply in debt mode — pre-existing IS the point.

## Effort Labels

Required on every finding. Subagents are told to emit this in §3; orchestrator-derived findings include it in §4.

| Label       | Range                | Examples                                                                                                                                             |
| ----------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quick**   | <30 minutes          | Rename a misleading variable; replace a hardcoded string with an error constant; swap a hardcoded color for a theme token; `npm audit fix`           |
| **Medium**  | 30 minutes – 4 hours | Refactor a hook to remove a duplicate pattern; write tests for an existing API route; fix an IDOR with a dual-filter; close a TODO with a small impl |
| **Big-job** | Multi-session        | Restructure a feature directory; migrate a MongoDB collection schema; replace a transitive dependency; rewrite a 900-line component                  |

The `severity × inverse-effort` sort means a `Important + Quick` finding ranks above an `Important + Big-job`. Big-jobs aren't deprioritized because they don't matter — they're presented later because they need scheduling, not a same-day fix.

## Common Mistakes

| Mistake                                                            | Fix                                                                                                                                                                        |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flagging pre-existing code as "debt" when it's working as designed | Debt = rotted, not just unfamiliar. If the pattern is intentional and consistent across the codebase, it's convention, not debt.                                           |
| Over-counting Nits and burying the real findings                   | Nit cap (5) applies the same as in `/review-code`. A Nit avalanche in a debt audit is signal that the auditor is reaching — dedupe or drop.                                |
| Missing the difference between "could improve" and "is broken"     | `could improve` is Minor at best; only flag Important if you can name what will actually break. Critical is reserved for active security risk in shipped code.             |
| Citing files that don't exist                                      | `§5 step 2` (existence check) drops these at compile time. Subagents under sweep dispatch sometimes hallucinate paths — the orchestrator catches it.                       |
| Treating consistent patterns as drift                              | Consistency > novelty. If 12 of 13 routes use the same pattern, the 13th matching is **consistency**, not debt. If 6 use pattern A and 7 use pattern B, THAT is drift.     |
| Mapping every npm-audit advisory to Critical                       | Advisory severity is a hint, not a verdict — `moderate` maps to Minor in this skill. If the vulnerable code path isn't reachable in our usage, the advisory is even lower. |
| Running this before every PR                                       | This skill is slow and broad by design. Run it monthly. For PR review, use `/review-code`.                                                                                 |
| Treating the GitHub-issue offer as automatic                       | Every issue created is a chore for the author. The interactive offer in §5 step 2 is one-finding-at-a-time on purpose — don't bulk-create issues.                          |
