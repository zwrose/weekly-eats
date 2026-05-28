---
status: approved
date: 2026-05-27
author: zwrose
---

# Review Suite Design

A code-quality safety net for weekly-eats: three review skills + REVIEW.md rubric + five specialist agents. Designed to compensate for a solo PM-coder's lack of senior-engineer intuition without disrupting superpowers' brainstorm/plan/implement flow.

## Context

The user is a product manager with some technical chops, building weekly-eats (Next.js 15 / React 19 / MongoDB / NextAuth) primarily via Claude Code and superpowers' subagent-driven-development. They need quality gates that catch what they can't see: security gaps (especially IDOR / ownership-scope), architectural drift, weak tests, accessibility gaps, and accumulated debt.

The current `.claude/skills/review-pr/` is a thin 60-line orchestrator that dispatches four 15-20 line agents. The agents are convention lists, not methodologies. There is no severity calibration, no "do NOT flag" guidance, no file:line citation requirement, no diff-scope rule, no inline GitHub posting, and no companion review at design or end-of-implementation stages.

Research into 2025-2026 AI code review (Cloudflare, CodeRabbit, Greptile, Anthropic, loupe, awesome-skills, ArXiv 2603.16244, ArXiv 2603.11078, multiple vibe-coding incident postmortems) surfaces several load-bearing patterns:

- **False positives are the dominant failure mode.** Bias toward approval; calibrate Important strictly.
- **One pass per specialist, then a coordinator.** Multi-turn re-review degrades F1 by ~19% and fabricates findings.
- **Every finding needs a `file:line` citation.** Single most effective anti-confabulation rule.
- **Tell agents what NOT to flag, explicitly.** Exclusion lists outperform positive instructions.
- **The IDOR / auth-logic / ownership-scope bug class is invisible to generic AI review.** This is the user's #1 risk surface.
- **Pre-PR semantic gate catches what hooks miss.** Doc-vs-code drift, test-vs-claim, silent error suppression.
- **Honor prior author justifications on re-runs.** Don't re-raise resolved concerns.

## Goals

1. **Catch IDOR / ownership-scope bugs** before they ship. This is the bug class most invisible to generic review and most damaging to a personal app handling user data.
2. **Catch LLM confabulation** (docs vs code, tests vs claims, silent error swallows) before commit.
3. **Guide testing strategy** at design time, verify coverage at implementation time, surface gaps at audit time.
4. **Lift architectural intuition** at plan time and PR time — flag layering violations, unjustified abstractions, pattern drift.
5. **Track accumulated debt** so the user can prioritize maintenance with a real backlog.
6. **Minimize false-positive noise** so findings stay credible.
7. **Do not modify superpowers' core workflow.** Skills are companions, not replacements.

## Non-Goals

- Auto-fix mode. The user explicitly does not want bulk auto-modify capability.
- Modifying brainstorming, writing-plans, executing-plans, or subagent-driven-development.
- Inline-posting findings to GitHub by default. PR posting is opt-in via `--post` and gated by interactive approval.
- Replacing existing PostToolUse hooks (format-on-edit, lint-on-edit, typecheck-on-edit). Those handle the lint/format/type layer cleanly.
- Adding a dedicated `/dep-vet` or `/schema-review` skill. Dependency and schema concerns are folded into `audit-debt` and `security-reviewer` respectively.

## Audience and Calibration

- **Solo PM-coder** working with AI assistance. Not a team. No code-review-buddy to push back on findings.
- **Personal app**, not multi-tenant SaaS. Deployment context is "single user, low traffic, localhost-ish" — theoretical attacks requiring local filesystem access are nits.
- **Stack-fixed:** Next.js 15 App Router, React 19, MUI v7, MongoDB, NextAuth JWT, Vitest + Testing Library + MSW. Agents can be opinionated about this stack.

## Deliverables

### 1. `REVIEW.md` (new, repo root)

The severity rubric and policy file that every review agent reads first. Target: ~200 lines.

**Contents:**

- **Severity tiers** with explicit definitions and project-specific examples:
  - **Critical:** corrupts data, leaks user data, or breaks production. Never for tests or style.
  - **Important:** likely bug in normal use, OR security/correctness issue warranting fix before merge.
  - **Minor:** real issue, small impact, OR pre-existing in a related area.
  - **Nit:** style preference, naming, take-it-or-leave-it.
  - **Pre-existing:** issue in unchanged lines/files — SKIPPED, not reported.
- **Bias toward approval:** single warnings do not block; only Critical or Important findings trigger a "needs fixes" verdict. Verdict labels per skill (see below).
- **Do-NOT-flag list** (global, applies to all agents):
  - Style / formatting (Prettier handles it)
  - Lint-detectable issues (ESLint handles it)
  - TypeScript errors (`tsc --noEmit` handles it)
  - Theoretical risks requiring local filesystem access (deployment is single-user)
  - Defense-in-depth suggestions when primary defense is adequate
  - Performance optimizations without evidence the path is hot
  - "Could add JSDoc" / "could add a comment"
  - Refactoring opportunities not caused by the change
  - Test coverage of code the PR didn't touch
  - Patterns already used elsewhere in the codebase (consistency > novelty)
- **Verification rules (binding):**
  - Every finding MUST cite `file:line` from the diff (or, at audit time, from the file under sweep). Findings without citation are DROPPED at compile time.
  - Only flag code in `+` or `-` diff lines. Context lines and unchanged code = pre-existing = SKIP.
  - Before flagging a "missing X", grep the codebase for X under different names.
  - Before flagging an "unreachable case", check actual callers.
  - For docs PRs, spot-check factual claims against source code.
- **Author-justification rule:** if a prior `/review` flagged a finding and the author replied explaining intent, do not re-raise unless the explanation is wrong on technical grounds.
- **Severity caps:** at most 5 Nits reported per review; remainder summarized as a count. No cap on Important/Critical.
- **Output format contract:** findings JSON schema (used by all skills).

### 2. Specialist Agents

Keep four existing agents; expand them substantially. Add one new agent (`architecture-reviewer`). Total: five agents.

**Shared template** (every agent has these sections, in order):

1. Role + scope (1 sentence)
2. When invoked (which skills dispatch this agent)
3. Priority categories (ordered)
4. What to flag (with project-specific examples)
5. Do-NOT-flag (agent-specific exclusions on top of REVIEW.md)
6. Verification rules (file:line citation; grep-before-flag; reachability check)
7. Output format (severity / dimension / file / line / body / suggested fix)
8. Examples of good vs bad findings (concrete)

**Per-agent details:**

#### `code-reviewer` (expand 15 → ~120 lines)

- Focus: project conventions specific to weekly-eats.
- Add sections on:
  - TypeScript hygiene (interface > type, unknown > any, no `as` casts) with examples.
  - Error handling (error constants from `@/lib/errors`, `logError('Context', error)` pattern).
  - API route conventions (`getServerSession` first, `ObjectId.isValid`, userId filtering — flag at code-reviewer level if missing the _pattern_; security-reviewer handles the _security implication_).
  - Component conventions (`"use client"`, `sx` prop styling, custom hooks for data).
  - Next.js 15 specifics (async route params: `{ params }: { params: Promise<{ id: string }> }`).
  - `@/` path alias enforcement.
  - File naming (PascalCase components, kebab-case utilities).
  - Named exports only for new code.
  - CLAUDE.md drift detection (flag when PR makes a CLAUDE.md statement outdated).
- Examples of good vs bad findings (concrete code from weekly-eats).

#### `architecture-reviewer` (new, ~140 lines)

- Focus: layering, abstractions, module boundaries, complexity.
- Sections:
  - Layering rules: where data access belongs (lib/server), where business logic belongs (lib/), where UI logic belongs (components/). Flag direct DB access from components, business logic in route handlers, presentation logic in lib/.
  - Abstraction justification: when a new util/hook/component is proposed, is it duplicative? Is it used in only one place (premature)? Does it solve a real reuse problem?
  - Module coupling: cross-feature imports (e.g., `meal-plans/` importing from `pantry/`'s internals), leaky abstractions, missing types in `types/`.
  - Complexity warnings: file >500 lines, function >50 lines, component with >5 hooks, prop drilling >2 layers.
  - Pattern fit: does this follow existing data access patterns (`getMongoClient()`, custom hooks, dynamic dialog imports)? Does it follow MUI styling patterns?
  - Hook composition: custom hooks layered correctly, not duplicating data fetching, proper cleanup.
  - API surface design: route shape consistency, response format, error shape.
- Examples: a component reaching into `getMongoClient` directly = layering violation; a `useFooData` hook that only wraps a fetch = unjustified abstraction.

#### `security-reviewer` (expand 20 → ~180 lines, BIGGEST expansion)

- Focus: IDOR / ownership-scope, Mongo injection, auth flows, NextAuth gotchas.
- **Methodology section (new):**
  - For EVERY changed query against `userId`-scoped collections: assert filter on `session.user.id`. List the scoped collections: `mealPlans`, `mealPlanTemplates`, `foodItems`, `recipes`, `recipeUserData`, `pantry`, `stores`, `storeItemPositions`, `shoppingLists`, `purchaseHistory`.
  - For EVERY changed mutation: confirm ownership check BEFORE update/delete (read the resource, verify `userId === session.user.id`).
  - For EVERY new API route: walk through unauthenticated → authenticated-but-other-user → admin paths.
- IDOR checklist (concrete):
  - Route accepts an id from the URL — is the resource at that id owned by the session user?
  - Route updates by id — does it `findOneAndUpdate({ _id, userId })` or only `{ _id }`?
  - Route lists data — does the find query filter by userId, or does it return all?
- Mongo injection patterns:
  - No `$where` operator with user input.
  - No raw input in operators (`{ $regex: req.body.q }` is risky; require sanitization or use literal match).
  - `ObjectId.isValid` before any `new ObjectId(id)`.
- NextAuth gotchas:
  - JWT strategy caches `isAdmin`/`isApproved` — flag if code reads these from DB instead of from the session.
  - Admin routes check `session.user.isAdmin` (the JWT-cached value, not a DB lookup).
- Share/invite flow rules (specific to weekly-eats):
  - Invite accept routes verify target user matches session user.
  - Cross-user data access (sharing) requires explicit grant — flag if a query crosses userId boundaries without going through a sharing model.
- Input validation:
  - Request bodies validated before DB ops (no trusting `req.body.userId`).
  - Filter unknown fields on update (no mass-assignment).
- Examples of good vs bad findings.

#### `a11y-reviewer` (expand 20 → ~100 lines)

- Focus: ARIA, keyboard, focus, contrast, touch targets (mobile-first).
- Add sections on:
  - ARIA: aria-label/labelledby/describedby on interactive elements, especially icon-only buttons. MUI wrappers can lose these.
  - Keyboard navigation: tab order, Enter/Space for activation. @dnd-kit requires keyboard alternative (`KeyboardSensor`).
  - Focus management: dialogs trap focus, return focus on close, auto-focus first interactive element. `DialogTitle` paired with `id` for `aria-labelledby`.
  - Color contrast: WCAG AA (4.5:1 text, 3:1 large) — flag hardcoded colors in `sx` props that may not meet thresholds.
  - Semantic HTML: prefer MUI semantic components over Box with onClick. Proper heading hierarchy.
  - Form labels: TextField/Select/Autocomplete/DatePicker all need labels.
  - Screen reader: aria-live for dynamic content, MUI announcements for snackbar/toast.
  - Touch targets: 44×44px minimum (mobile-first app with BottomNavigation).
- Examples of good vs bad findings.

#### `test-reviewer` (expand 20 → ~130 lines)

- Focus: coverage strategy, mock patterns, claim/test alignment.
- Add sections on:
  - **Coverage strategy (new):** for API route tests, verify auth (401), validation (400), success, and error paths exist. For component tests, verify happy path + at least one edge case (empty/loading/error). Missing a path is a finding.
  - **Claim/test alignment (new):** test name says "handles empty input" — does the test actually call with empty input? Tests that pass without exercising the claimed behavior are a finding.
  - **User-flow vs implementation-detail:** prefer `getByRole`/`getByLabelText`/`getByText` over `getByTestId`. Test what the user sees, not implementation internals. Flag tests that assert on internal state shape.
  - Mock patterns:
    - `vi.stubGlobal('fetch', ...)` in `beforeEach` + `vi.unstubAllGlobals()` in `afterEach`. Never `global.fetch = ...` at module scope.
    - Tests using MSW (from `vitest.setup.ts`) MUST NOT stub `global.fetch`.
    - `vi.mock('@/lib/errors')` must include ALL error groups the route uses.
    - `vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))`.
    - `vi.mock('@/lib/auth', () => ({ authOptions: {} }))`.
    - `vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }))`.
  - User interactions: `userEvent.setup()` before render, never `fireEvent`.
  - Async assertions: `waitFor()` for any post-async assertion.
  - Mock placement: `vi.mock()` at top level (hoisted), import mocked modules with `await import()` after.
  - Cleanup: `afterEach(() => cleanup())` + `vi.clearAllMocks()` or `vi.restoreAllMocks()` in beforeEach.
- Examples of good vs bad findings.

### 3. `/review` skill (unified — replaces `/review-pr`)

**Location:** `.claude/skills/review/`

**Invocation:**

- `/review` — auto-detect: open PR for current branch → PR mode; else → branch mode (current branch vs `main`).
- `/review pr <N>` — explicit PR mode against PR #N.
- `/review branch` — explicit branch mode.
- `/review --post` — PR mode, post inline review comments to GitHub after approval.
- `/review --focus <notes>` — focus notes passed to agents.

**Orchestration (6 steps):**

1. **Setup**
   - `SESSION_DIR=$(mktemp -d /tmp/review-XXXXXXXX)`
   - Determine mode (PR or branch).
   - For PR mode: fetch metadata via `gh pr view`, fetch diff via `gh pr diff`, fetch prior comments via `gh api repos/.../pulls/N/comments` (for author-justification handling), get head SHA. Worktree-checkout the PR branch to `$SESSION_DIR/repo/`.
   - For branch mode: get diff with `git diff main...HEAD > $SESSION_DIR/diff.txt`. Skip the worktree checkout — agents read directly from the current working directory (no `$SESSION_DIR/repo/`).
   - Save metadata to `$SESSION_DIR/meta.json`.
   - **Main context never reads the full diff.** Only line count (`wc -l < diff.txt`).

2. **Plan dispatch**
   - All 5 agents dispatched in parallel. No diff-size tiering (per user request).
   - Enter plan mode, present the dispatch plan + assignment table, wait for user approval.

3. **Dispatch in parallel**
   - Each agent reads:
     - `$SESSION_DIR/diff.txt` (full diff)
     - `REVIEW.md` (severity + policy)
     - `CLAUDE.md`
     - `$SESSION_DIR/repo/` (the PR branch checkout — for verification reads)
     - Agent-specific docs (e.g., security-reviewer reads `src/lib/auth.ts`, security-relevant routes)
     - Prior comments + author justifications (PR mode only)
   - Each writes findings to `$SESSION_DIR/findings-<agent>.json`.
   - **file:line citations enforced; findings without citations are dropped at compile time.**

4. **Compile + dedupe** (main context)
   - Read all `findings-*.json` files.
   - Apply REVIEW.md severity rubric.
   - Diff-scope verification: only `+`/`-` lines.
   - Reachability pre-check on Important findings: read the file, check callers.
   - Dedupe overlapping findings on the same `file:line` (merge bodies if dimensions differ).
   - Cap Nits at 5 reported + count of rest.
   - Write `$SESSION_DIR/compiled.json` for resilience against context compaction.

5. **Interactive tiered presentation**
   - **Critical + Important** findings: individually via `AskUserQuestion`. Options: Approve / Modify / Downgrade / Skip.
   - **Minor + Nit** findings: batched, multi-select via `AskUserQuestion`. Show 4 per batch with 2-3 sentence summaries.
   - Downgraded Important → Minor is auto-approved at Minor (not re-presented).
   - PR mode only: ask review event type (COMMENT / REQUEST_CHANGES / APPROVE).

6. **Output**
   - **Branch mode:** terminal report grouped by severity, with verdict label:
     - `READY FOR PR` (no Critical, no Important)
     - `FIX BEFORE PR` (0 Critical, 1+ Important)
     - `MAJOR FIXES NEEDED` (1+ Critical)
   - **PR mode:** build review JSON, run `resolve-diff-lines.ts` to validate line anchors, post via `gh api repos/.../pulls/N/reviews --input <file>`. Verify post-submit by fetching the latest review. Report review URL to user.

**Supporting files:**

- `.claude/skills/review/SKILL.md` (~400 lines)
- `.claude/skills/review/resolve-diff-lines.ts` (ported from loupe — parses diff, validates each comment's `(file, line)` pair, moves out-of-hunk comments to nearest valid line with `(Re: line N)` prefix, drops comments for files not in the diff)

### 4. `/review-plan` skill

**Location:** `.claude/skills/review-plan/`

**Invocation:**

- `/review-plan` — finds the most recent file in `docs/superpowers/specs/` or `docs/superpowers/plans/`.
- `/review-plan <path>` — review a specific file.

**Orchestration (5 steps):**

1. **Setup** — read the plan/spec file. Classify what it touches: UI, API, data layer, auth, tests, architecture. This classification informs each agent's focus (passed as context); all 5 agents always dispatch, matching the no-tiering principle from `/review`. An agent with nothing relevant to flag returns an empty findings array.
2. **Dispatch agents in parallel:**
   - **architecture-reviewer** (heaviest user): pattern fit, abstraction justification, module coupling, complexity warnings derived from the design.
   - **security-reviewer:** new user-data flows, auth changes, new API surface (auth/ownership specified?), "we'll add validation later" red flags.
   - **test-reviewer:** what tests does this plan specify? What's missing? Are edge cases enumerated? Is the design testable as proposed?
   - **code-reviewer** (lighter at plan-time): does the plan reference correct conventions? Does it propose anything that contradicts project rules?
   - **a11y-reviewer**: only fires if the plan involves UI. Keyboard? Focus? Mobile?
3. **Compile findings** — same severity rubric. file:line citations point at the plan doc (section + line) or at related project files.
4. **Present tiered findings** — same as `/review`.
5. **Output:**
   - Findings list grouped by plan section, each citing the section heading + line number in the plan doc. For Important/Critical findings on text the agent suggests rewriting, include a "Suggested replacement:" block with quoted source + proposed text.
   - Verdict label:
     - `PLAN READY` (no Critical, no Important)
     - `REVISE BEFORE IMPLEMENTING` (0 Critical, 1+ Important)
     - `MAJOR GAPS — RECONSIDER DESIGN` (1+ Critical)
   - Interactive offer at the end: "Save annotations to `<plan>-review.md`?"

**Opinionated plan-content requirements** (agents flag missing items):

- Explicit test list (not "we'll add tests")
- Explicit ownership/auth specification for any new data flows
- Pattern-fit justification for any new abstractions (or explicit "this duplicates X — justified because Y")
- Migration safety statement if schema changes
- Mobile + keyboard considerations if UI involved

**Out of scope at plan-time:**

- Naming preferences ("call it Foo not Bar")
- Implementation details the plan reasonably defers
- Style/convention checks that only matter at code-time

### 5. `/audit-debt` skill

**Location:** `.claude/skills/audit-debt/`

**Invocation:**

- `/audit-debt` — full sweep.

(No flags. Optional outputs offered interactively at the end.)

**Orchestration (5 steps):**

1. **Sweep prep**
   - Collect file list across `src/`, `scripts/`, `docs/`.
   - Run `npm audit --json` (capture vulnerabilities + dep ages).
   - Grep for `TODO|FIXME|XXX|HACK`.
   - Parse CLAUDE.md sections for claims to verify (e.g., "all error constants in `@/lib/errors`" — grep for hardcoded errors).
2. **Dispatch all 5 agents in parallel** — each gets a lens-specific brief, sweeps the relevant subset of the codebase (no diff to limit them), writes findings JSON:
   - **architecture-reviewer:** layering violations, file-size monsters (>500 lines), abstraction creep (3+ places doing the same thing without a util; or a util used in only 1 place), cross-feature import smells.
   - **code-reviewer:** CLAUDE.md drift, pattern inconsistency, naming/convention drift, missing `@/` aliases, dead exports.
   - **security-reviewer:** missing ownership filters in _existing_ routes (high-priority sweep), missing `ObjectId.isValid()` checks, share/invite paths without auth verification.
   - **test-reviewer:** untested files (especially API routes and lib/utils), low-coverage code paths, weak assertions (tests passing without exercising behavior).
   - **a11y-reviewer:** missing aria-labels on icon buttons, focus gaps in existing dialogs, hardcoded `sx` colors with poor contrast, missing keyboard alternatives in @dnd-kit usage.
3. **Orchestrator-driven dimensions** (not specialist agents):
   - Dependency staleness + vulnerabilities (from `npm audit`).
   - TODO/FIXME accumulation (count + hot spots + oldest).
   - Documentation drift (references to files/functions/paths that no longer exist).
4. **Compile + prioritize**
   - Apply REVIEW.md severity rubric, recalibrated for debt context:
     - Critical: active security risk in shipped code.
     - Important: bug waiting to happen in normal use, or significant architecture violation.
     - Minor: consistency issue, missing test, small refactor opportunity.
     - Nit: cleanup, naming, dead code.
   - Score each finding by **effort** (Quick / Medium / Big-job).
   - Sort by severity × inverse-effort (high-impact + low-effort first).
5. **Present + interactive output**
   - Markdown report grouped by category, sorted by priority.
   - Each item: title, severity, effort, files, suggested fix, suggested issue title.
   - After report shown, interactive offer:
     - "Save this report to a file? Where?"
     - "File any of these as GitHub issues? (I'll go finding-by-finding for Critical/Important)"

## Architecture Choices

### Worktree checkout for verification (PR mode)

Borrowed from loupe. The orchestrator runs `git worktree add --detach $SESSION_DIR/repo origin/<branch>`. Subagents verify findings against this checkout, never the main working tree (which may be on a different branch). This eliminates a real failure mode where findings get verified against stale code.

For branch mode, no checkout is needed — subagents read from the current working directory.

### Session directory pattern

All review artifacts (diff, findings JSONs, compiled.json, metadata) go in `$SESSION_DIR`. Prevents collision across parallel reviews and isolates the main context from large diffs. Pattern: `mktemp -d /tmp/review-XXXXXXXX`.

### file:line citation enforcement

Hard rule in REVIEW.md and every agent prompt: findings without `file:line` citation are dropped at compile time. Compile step verifies the line is within a `+`/`-` block in the diff. This single rule kills the largest class of LLM confabulation.

### Do-NOT-flag lists

Per Cloudflare's observation: explicit exclusions outperform positive instructions. Each agent has an agent-specific exclusion list on top of REVIEW.md's global list.

### Author-justification handling

On PR mode re-runs, orchestrator fetches `gh api repos/.../pulls/N/comments` first and passes prior threads to agents as context. A thread is treated as "justified" when the PR author replied with substantive explanatory text (not just "ok" or emoji). Subagents make the call per-thread when reading prior context: if the original concern is now justified, do not re-raise unless the justification contains a technical error. Outdated comments (where `position == null` because the diff hunk shifted) are still scanned for justifications — the explanation may still apply even if the code anchor moved.

### Severity caps

REVIEW.md caps Nits at 5 reported per review (remainder summarized as count). No cap on Important/Critical. Prevents Nit-flooding while preserving signal on real issues.

### Single-pass per specialist + coordinator

Per ArXiv 2603.16244. Each specialist runs once. Main context is the coordinator: dedupes, ranks, drops out-of-scope, presents. No "verifier agent" re-reviewing specialist output.

## Rollout Sequence

1. Write `REVIEW.md` at repo root. Foundation everything reads.
2. Create `.claude/agents/architecture-reviewer.md`.
3. Expand the four existing agents:
   - `.claude/agents/code-reviewer.md` → ~120 lines
   - `.claude/agents/security-reviewer.md` → ~180 lines
   - `.claude/agents/a11y-reviewer.md` → ~100 lines
   - `.claude/agents/test-reviewer.md` → ~130 lines
4. Port `resolve-diff-lines.ts` from loupe (`.claude/skills/review/resolve-diff-lines.ts`).
5. Build `/review` skill (`.claude/skills/review/SKILL.md`). Largest piece.
6. Build `/review-plan` skill (`.claude/skills/review-plan/SKILL.md`).
7. Build `/audit-debt` skill (`.claude/skills/audit-debt/SKILL.md`).
8. Update `CLAUDE.md`:
   - Skills table: add `/review`, `/review-plan`, `/audit-debt`. Remove `/review-pr`.
   - Agents table: add `architecture-reviewer`.
   - Add a "Review workflow" section briefly describing the suite.
9. Delete `.claude/skills/review-pr/SKILL.md`.
10. **Dogfood** — run each skill against this very change:
    - `/review-plan` on this design doc.
    - `/review` on the implementation diff.
    - `/audit-debt` on the project.
11. Open PR.

## Success Criteria

- `/review` finds at least one finding that the old `/review-pr` would have missed (or surfaces meaningful do-NOT-flag exclusions on a noisy old run) — verified by dogfood comparison.
- `/review-plan` produces at least one actionable finding on the design doc itself (self-review).
- `/audit-debt` produces a non-trivial backlog on the existing weekly-eats codebase.
- No false positive lands as Critical or Important in dogfooding. (Nits and Minors with noise are OK; Critical/Important must be load-bearing.)
- All five expanded agents include the shared template sections (scope, when invoked, priority categories, what to flag, do-NOT-flag, verification rules, output format, examples).
- `REVIEW.md` is under 250 lines.
- `/review` SKILL.md is under 500 lines.
- The new skills do not modify or reference superpowers' brainstorming, writing-plans, executing-plans, or subagent-driven-development files.

## Out of Scope / Future

- `/dep-vet` as a dedicated skill (folded into audit-debt's orchestrator-driven dimensions for now).
- `/schema-review` as a dedicated skill (folded into security-reviewer's methodology for now).
- Coordinator agent (Cloudflare-style separate dedup/rank agent). Current design uses main context as coordinator; if it proves too noisy, add a coordinator subagent later.
- MCP for codegraph / "find callers of X". Current design uses `rg` for poor-man's codegraph in agents; if that proves insufficient, build a custom MCP later.
- Auto-fix mode (explicitly out per user preference).
- Opus-tier security-reviewer. Sonnet for all specialists initially; A/B test later if security findings miss things.
- Cross-repo skill portability. Skills are weekly-eats-specific; if loupe or future projects need them, port and adjust.

## References

Internet research (May 2026):

- [Best AI Code Reviewer in 2026 (146 PRs benchmark) — dev.to](https://dev.to/_vjk/best-ai-code-reviewer-in-2026-we-ran-4-in-parallel-for-3-weeks-146-prs-679-findings-1c0f)
- [Orchestrating AI Code Review at scale — Cloudflare](https://blog.cloudflare.com/ai-code-review/)
- [Code Review — Claude Code Docs](https://code.claude.com/docs/en/code-review)
- [More Rounds, More Noise (ArXiv 2603.16244)](https://arxiv.org/pdf/2603.16244)
- [CR-Bench (ArXiv 2603.11078)](https://arxiv.org/abs/2603.11078)
- [The Pre-Commit Review Gate — imti.co](https://imti.co/pre-commit-review-gate/)
- [loupe-app/loupe `/review-pr` skill](https://github.com/loupe-app/loupe/blob/main/.claude/skills/review-pr/SKILL.md)
- [awesome-skills/code-review-skill](https://github.com/awesome-skills/code-review-skill)
- [Auto-Reviewing Claude's Code — Nick Tune](https://medium.com/nick-tune-tech-strategy-blog/auto-reviewing-claudes-code-cb3a58d0a3d0)
- [Greptile graph-based codebase context](https://www.greptile.com/docs/how-greptile-works/graph-based-codebase-context)
- [Why You Should Never Vibe Code Your Auth Stack — Security Boulevard](https://securityboulevard.com/2026/05/why-you-should-never-vibe-code-your-auth-stack-and-what-to-use-instead/)
- [Mass npm supply-chain attack — safedep](https://safedep.io/mass-npm-supply-chain-attack-tanstack-mistral/)
- [CISA axios supply-chain alert](https://www.cisa.gov/news-events/alerts/2026/04/20/supply-chain-compromise-impacts-axios-node-package-manager)
- [Next.js Security Best Practices 2026 — Authgear](https://www.authgear.com/post/nextjs-security-best-practices/)
