# Review Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a 3-skill code-quality safety net (`/review`, `/review-plan`, `/audit-debt`) plus `REVIEW.md` rubric and 5 specialist agents, designed to compensate for solo PM-coder quality-intuition gaps without modifying superpowers' core workflow.

**Architecture:** Skills dispatch parallel specialist subagents (architecture, code, security, a11y, test) that read a shared `REVIEW.md` severity rubric. Each agent enforces file:line citations, do-NOT-flag exclusion lists, and diff-scope rules to suppress false positives. `/review` supports both PR mode (with worktree checkout + optional inline GitHub posting) and local branch mode.

**Tech Stack:** Markdown (skills + agents), TypeScript (one ported helper from loupe), Bash (gh CLI orchestration), Vitest (for the TS helper).

**Reference:** See spec at `docs/superpowers/specs/2026-05-27-review-suite-design.md` for design rationale and research grounding.

---

## File Structure

**New files:**

- `REVIEW.md` (repo root)
- `.claude/agents/architecture-reviewer.md`
- `.claude/skills/review/SKILL.md`
- `.claude/skills/review/resolve-diff-lines.ts`
- `.claude/skills/review/__tests__/resolve-diff-lines.test.ts`
- `.claude/skills/review-plan/SKILL.md`
- `.claude/skills/audit-debt/SKILL.md`

**Files to modify:**

- `.claude/agents/code-reviewer.md` (15 → ~120 lines)
- `.claude/agents/security-reviewer.md` (20 → ~180 lines)
- `.claude/agents/a11y-reviewer.md` (20 → ~100 lines)
- `.claude/agents/test-reviewer.md` (20 → ~130 lines)
- `CLAUDE.md` (Skills + Agents tables + new "Review workflow" section)

**Files to delete:**

- `.claude/skills/review-pr/SKILL.md`

**Dependencies between tasks:**

- Tasks 2-6 (agents) depend on Task 1 (REVIEW.md) for shared severity definitions
- Tasks 8-10 (skills) depend on Tasks 1-6 (REVIEW.md + agents)
- Task 11 (CLAUDE.md) depends on Tasks 8-10
- Task 12 (delete old) depends on Task 8 (new /review exists)
- Tasks 13-15 (dogfood) depend on all above

---

## Phase 1: Foundation

### Task 1: Write `REVIEW.md`

**Files:**

- Create: `REVIEW.md` (repo root, ~200 lines)

- [ ] **Step 1: Read spec section "1. `REVIEW.md`" for context**

Read `docs/superpowers/specs/2026-05-27-review-suite-design.md` lines covering "1. `REVIEW.md`" deliverable for full rationale.

- [ ] **Step 2: Write `REVIEW.md` with required sections**

Create `REVIEW.md` at repo root with these sections in order. Use the verbatim text below for opinionated content; expand examples to weekly-eats-specific code where noted.

````markdown
# REVIEW.md

This file is the source of truth for code-review severity, exclusions, and verification rules. Every review skill (`/review`, `/review-plan`, `/audit-debt`) and every reviewer agent reads it first. If a review finding contradicts this file, the file wins.

## Audience and Calibration

This project is built by a solo product manager with some technical chops, not a seasoned engineer. The app is single-user and runs personal data — no multi-tenant attack surface, no compliance regime. Review feedback should compensate for the user's intuition gaps in **security (especially IDOR/ownership-scope), architecture, testing, and accessibility** without drowning them in nits or theoretical risks.

**Bias hard toward approval.** Single warnings do not block merge. Only Critical or Important findings trigger a "needs fixes" verdict.

## Severity Tiers

| Tier             | Definition                                                                          | Examples                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Critical**     | Corrupts data, leaks user data, or breaks production. NEVER for tests or style.     | API route missing `userId` filter returning other users' data; mutation without ownership check                    |
| **Important**    | Likely bug in normal use, OR security/correctness issue warranting fix before merge | Missing `ObjectId.isValid()` before query; component that crashes on empty data; auth missing on a new admin route |
| **Minor**        | Real issue, small impact, OR pre-existing in a related area                         | Magic number; missing index on a currently-fast query; inconsistent error message                                  |
| **Nit**          | Style preference, naming, take-it-or-leave-it                                       | "Variable name could be clearer"                                                                                   |
| **Pre-existing** | Issue in unchanged lines/files — SKIPPED, not reported                              | Bad pattern in code the PR didn't touch                                                                            |

## Do NOT Flag (Global)

These are out of scope for all agents. PostToolUse hooks and other tooling cover them already, or the user's deployment context makes them not worth raising.

- **Style / formatting** — Prettier handles it (`.claude/hooks/format-on-edit`)
- **Lint-detectable issues** — ESLint handles it (`.claude/hooks/lint-on-edit`)
- **TypeScript errors** — `tsc --noEmit` handles it (`.claude/hooks/typecheck-on-edit`)
- **Theoretical risks requiring local filesystem access** — deployment is single-user; not in threat model
- **Defense-in-depth suggestions when primary defense is adequate** — no "also add CSRF" when NextAuth covers it
- **Performance optimizations without evidence the path is hot** — no premature optimization
- **"Could add JSDoc" / "could add a comment"** — comments only when WHY is non-obvious (see CLAUDE.md)
- **Refactoring opportunities not caused by the change** — stay focused on the diff
- **Test coverage of code the PR didn't touch** — not this PR's problem
- **Patterns already used elsewhere in the codebase** — consistency > novelty; if pattern X is repeated 5 times, don't flag the 6th

## Verification Rules (Binding)

Findings violating these rules MUST be dropped at compile time, before presentation:

1. **`file:line` citation required.** Every finding cites a file path and line number. No citation → drop.
2. **Diff-scope rule.** Only flag code in `+` or `-` lines of the diff. Context lines (no prefix) and unchanged code = pre-existing = SKIP.
3. **Grep-before-flag.** Before flagging "missing X", search the codebase for X under different names (e.g., `rightAriaLabel` vs `rightZoneAriaLabel`).
4. **Reachability check on Important findings.** Read the caller; if the only caller already guards the edge case, drop or downgrade.
5. **Docs/spec PRs:** Spot-check factual claims (function signatures, error types, file paths) against source code. Don't just review prose.

## Author-Justification Rule

If a prior `/review` flagged a finding and the PR author replied with substantive explanatory text, **do not re-raise** unless the justification contains a technical error. Substantive = explanation, not "ok" or emoji. Outdated comments (where `position == null`) are still scanned for justifications — the explanation may apply even if the code anchor moved.

## Severity Caps

- **Nits:** at most 5 reported per review. Remainder summarized as a count (e.g., "+ 12 more Nits"). Prevents Nit flooding.
- **Important / Critical:** no cap. These are load-bearing; cap them and you suppress signal.

## Findings Output Format

All agents emit findings as JSON arrays at the path specified by the dispatching skill:

```json
[
  {
    "id": "<agent-name>-001",
    "severity": "Critical" | "Important" | "Minor" | "Nit",
    "dimension": "Architecture" | "Code" | "Security" | "A11y" | "Test",
    "title": "<short descriptive title>",
    "file": "<path relative to repo root>",
    "line": <number or null>,
    "body": "<detailed explanation with code references>",
    "suggestion": "<what to do, or null>"
  }
]
```
````

## Per-Skill Verdict Labels

- `/review` (branch mode): `READY FOR PR` / `FIX BEFORE PR` / `MAJOR FIXES NEEDED`
- `/review-plan`: `PLAN READY` / `REVISE BEFORE IMPLEMENTING` / `MAJOR GAPS — RECONSIDER DESIGN`
- `/audit-debt`: no single verdict; prioritized backlog instead

Verdict mapping:

- 0 Critical, 0 Important → READY / PLAN READY
- 0 Critical, 1+ Important → FIX BEFORE PR / REVISE BEFORE IMPLEMENTING
- 1+ Critical → MAJOR FIXES NEEDED / MAJOR GAPS

## Single-Pass Discipline

Each specialist agent runs **once** per review. Do not dispatch a "verifier agent" that re-reviews specialist output — re-review degrades F1 and fabricates findings (ArXiv 2603.16244). The main context is the coordinator: dedupes, ranks, drops out-of-scope, presents.

````

- [ ] **Step 3: Verify file structure**

```bash
wc -l REVIEW.md
# Expected: ~200 lines (target ≤250)

grep -c "^##" REVIEW.md
# Expected: 9 H2 sections (Audience, Severity Tiers, Do NOT Flag, Verification Rules, Author-Justification Rule, Severity Caps, Findings Output Format, Per-Skill Verdict Labels, Single-Pass Discipline)
````

- [ ] **Step 4: Commit**

```bash
git add REVIEW.md
git commit -m "feat: add REVIEW.md severity rubric and policy"
```

---

## Phase 2: Agents

### Task 2: Create `architecture-reviewer` agent

**Files:**

- Create: `.claude/agents/architecture-reviewer.md` (~140 lines)

- [ ] **Step 1: Write the agent file**

Use the shared template structure (8 sections in order: scope, when invoked, priority categories, what to flag, do-NOT-flag, verification rules, output format, examples). For full per-section guidance see spec section "architecture-reviewer (new, ~140 lines)".

Required structural sections:

```markdown
You are an architecture reviewer for a Next.js 15 App Router app (React 19, MUI v7, MongoDB, NextAuth JWT). You focus on layering, abstractions, module boundaries, and complexity.

## When Invoked

Dispatched by `/review`, `/review-plan`, and `/audit-debt`. At PR/branch time you review diffs. At plan time you review the design doc. At audit time you sweep the codebase.

## Priority Categories (ordered)

1. **Layering violations** — direct DB access from components, business logic in route handlers, presentation logic in `lib/`
2. **Abstraction justification** — new util/hook/component that's duplicative or used in only one place
3. **Module coupling** — cross-feature imports of internals (e.g., `meal-plans/` reaching into `pantry/`)
4. **Complexity warnings** — file >500 lines, function >50 lines, component with >5 hooks, prop drilling >2 layers
5. **Pattern fit** — does this follow existing data access patterns (`getMongoClient()`, custom hooks, dynamic dialog imports)?
6. **Hook composition** — custom hooks layered correctly, no duplicate data fetching, proper cleanup
7. **API surface design** — route shape consistency, response format, error shape

## What to Flag (with examples)

[Include 8-10 concrete examples drawn from weekly-eats: a component reaching into `getMongoClient` directly = layering violation; a `useFooData` hook that only wraps a single fetch = unjustified abstraction; a `meal-plans/` page importing from `pantry/components/internal/` = cross-feature coupling; etc.]

## Do NOT Flag

- Architectural changes within existing patterns (e.g., adding a 6th custom hook in `lib/hooks/` is fine — that's the pattern)
- "Could be more abstract" when the current shape is clear
- Hypothetical scalability concerns (single-user app)
- Layering nits in test files (test setup can be pragmatic)
- Things already covered by `code-reviewer` (naming, exports, error constants)

## Verification Rules

- `file:line` citation required (REVIEW.md verification rule #1).
- Before flagging "unjustified abstraction": grep for callers — if used in 3+ places, NOT unjustified.
- Before flagging "layering violation": confirm the file's role from its location (`src/lib/` vs `src/components/` vs `src/app/api/`).
- For plan-time reviews: file:line cites the plan doc's section heading + line number.

## Output Format

[Findings JSON per REVIEW.md "Findings Output Format" section. `dimension: "Architecture"`.]

## Examples of Good vs Bad Findings

**Good:**

- `src/components/MealEditor.tsx:42 — Component imports getMongoClient directly. Move to a custom hook in src/lib/hooks/ following useRecipes pattern.` (Important — layering)

**Bad (do not write):**

- `Could consider extracting this into a reusable component.` (vague, no citation, no clear payoff)
- `This abstraction feels over-engineered.` (subjective, no specific replacement, no severity)
```

Full prose for each section should expand on the patterns above with weekly-eats specifics. Total target: ~140 lines.

- [ ] **Step 2: Verify structure**

```bash
wc -l .claude/agents/architecture-reviewer.md
# Expected: ~140 lines (target 100-180)

grep -c "^##" .claude/agents/architecture-reviewer.md
# Expected: 8 H2 sections
```

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/architecture-reviewer.md
git commit -m "feat(agents): add architecture-reviewer agent"
```

---

### Task 3: Expand `code-reviewer` agent

**Files:**

- Modify: `.claude/agents/code-reviewer.md` (15 → ~120 lines)

- [ ] **Step 1: Read current file and spec section**

Read `.claude/agents/code-reviewer.md` and spec section "code-reviewer (expand 15 → ~120 lines)".

- [ ] **Step 2: Rewrite with shared template structure**

Sections in order: scope; when invoked; priority categories; what to flag (with weekly-eats examples); do-NOT-flag; verification rules; output format; examples of good vs bad findings.

Priority categories for code-reviewer:

1. TypeScript hygiene (`interface` > `type`, `unknown` > `any`, no `as` casts)
2. Error handling (`@/lib/errors` constants, `logError('Context', error)` pattern)
3. API route conventions (auth-first, ObjectId validation, userId filtering, error constants)
4. Component conventions (`"use client"`, `sx` styling, hooks for data)
5. Next.js 15 specifics (`{ params }: { params: Promise<{ id: string }> }`, then `await params`)
6. Import hygiene (`@/` alias, no deep relative paths)
7. File naming (PascalCase components, kebab-case utilities)
8. Named exports for new code (existing files with default exports are pre-existing)
9. CLAUDE.md drift (if PR makes a CLAUDE.md statement outdated, flag as Nit)

Do-NOT-flag for code-reviewer (on top of REVIEW.md global):

- Existing default exports (pre-existing)
- Architectural concerns (architecture-reviewer's domain)
- Security implications of patterns (security-reviewer's domain; code-reviewer flags only the _pattern_, not the _security risk_)
- a11y attributes (a11y-reviewer's domain)

Examples block: include 3-4 concrete good findings + 3-4 bad ones drawn from weekly-eats patterns.

- [ ] **Step 3: Verify structure**

```bash
wc -l .claude/agents/code-reviewer.md
# Expected: ~120 lines

grep -c "^##" .claude/agents/code-reviewer.md
# Expected: 8 H2 sections
```

- [ ] **Step 4: Commit**

```bash
git add .claude/agents/code-reviewer.md
git commit -m "feat(agents): expand code-reviewer with methodology and exclusions"
```

---

### Task 4: Expand `security-reviewer` agent

**Files:**

- Modify: `.claude/agents/security-reviewer.md` (20 → ~180 lines, BIGGEST expansion)

This is the most important agent expansion. Per research, IDOR/ownership-scope is the #1 invisible bug class in vibe-coded apps, and weekly-eats has many `userId`-scoped queries.

- [ ] **Step 1: Read current file and spec section**

Read `.claude/agents/security-reviewer.md` and spec section "security-reviewer (expand 20 → ~180 lines, BIGGEST expansion)".

- [ ] **Step 2: Rewrite with explicit IDOR methodology**

Sections: scope; when invoked; **explicit IDOR methodology** (new, prominent); priority categories; what to flag; do-NOT-flag; verification rules; output format; examples.

The IDOR methodology section must include:

```markdown
## IDOR / Ownership-Scope Methodology (highest priority)

For EVERY changed query against `userId`-scoped collections, assert: is this filtered by `session.user.id`?

**Scoped collections in weekly-eats:** `mealPlans`, `mealPlanTemplates`, `foodItems`, `recipes`, `recipeUserData`, `pantry`, `stores`, `storeItemPositions`, `shoppingLists`, `purchaseHistory`.

For EVERY changed mutation (update/delete), confirm:

1. The resource is fetched by `{ _id, userId }` — not just `{ _id }`.
2. Ownership is verified BEFORE the write happens.
3. The update does not allow mass-assignment of `userId` (e.g., `$set: req.body` is risky; explicit field allowlist required).

For EVERY new API route, walk through three paths:

1. Unauthenticated request → returns 401 (`AUTH_ERRORS.UNAUTHORIZED`)
2. Authenticated-but-other-user request → returns 404 or filtered empty result
3. Admin-only route → returns 403 if `!session.user.isAdmin` (`AUTH_ERRORS.FORBIDDEN`)
```

Add sections for:

- Mongo injection patterns (no `$where`, no raw input in operators, `ObjectId.isValid` first)
- NextAuth JWT gotchas (`isAdmin`/`isApproved` read from session, not DB)
- Share/invite flow rules (target user matches session user; cross-user data requires explicit grant)
- Input validation (no trusting `req.body.userId`; allowlist on update)

Do-NOT-flag for security-reviewer:

- Theoretical XSS in places React already escapes
- "Add rate limiting" for personal app (out of threat model)
- "Use bcrypt" when NextAuth handles auth
- Defense-in-depth on adequately-protected primary
- CSRF concerns when NextAuth + same-site cookies cover it

Examples: include 4 concrete weekly-eats IDOR examples (good findings) + 3 bad-finding patterns to avoid (e.g., "this query could be vulnerable to NoSQL injection" without showing the unsanitized input path).

- [ ] **Step 3: Verify structure**

```bash
wc -l .claude/agents/security-reviewer.md
# Expected: ~180 lines (target 150-220)
```

- [ ] **Step 4: Commit**

```bash
git add .claude/agents/security-reviewer.md
git commit -m "feat(agents): expand security-reviewer with IDOR methodology"
```

---

### Task 5: Expand `a11y-reviewer` agent

**Files:**

- Modify: `.claude/agents/a11y-reviewer.md` (20 → ~100 lines)

- [ ] **Step 1: Read current file and spec section**

Read `.claude/agents/a11y-reviewer.md` and spec section "a11y-reviewer (expand 20 → ~100 lines)".

- [ ] **Step 2: Rewrite with shared template structure**

Priority categories:

1. ARIA (label/labelledby/describedby on interactives, especially icon-only buttons)
2. Keyboard navigation (tab order, Enter/Space, @dnd-kit `KeyboardSensor`)
3. Focus management (dialog trap, return on close, auto-focus first interactive, `DialogTitle` + `id` for `aria-labelledby`)
4. Color contrast (WCAG AA 4.5:1 text / 3:1 large; flag hardcoded `sx` colors)
5. Semantic HTML (MUI semantic components > Box+onClick; heading hierarchy)
6. Form labels (TextField, Select, Autocomplete, DatePicker all labelled)
7. Screen reader (aria-live for dynamic content)
8. Touch targets (44×44px minimum — mobile-first BottomNavigation app)

Do-NOT-flag for a11y-reviewer:

- `IconButton` already has `aria-label` from props (verify before flagging)
- MUI defaults that already provide ARIA (Button has implicit accessible name from children)
- Contrast on colors taken from theme palette (theme handles WCAG)
- "Consider keyboard shortcuts" when not requested

Examples: 3 concrete good findings + 3 bad-finding patterns.

- [ ] **Step 3: Verify and commit**

```bash
wc -l .claude/agents/a11y-reviewer.md
# Expected: ~100 lines

git add .claude/agents/a11y-reviewer.md
git commit -m "feat(agents): expand a11y-reviewer with MUI/dnd-kit specifics"
```

---

### Task 6: Expand `test-reviewer` agent

**Files:**

- Modify: `.claude/agents/test-reviewer.md` (20 → ~130 lines)

- [ ] **Step 1: Read current file and spec section**

Read `.claude/agents/test-reviewer.md` and spec section "test-reviewer (expand 20 → ~130 lines)".

- [ ] **Step 2: Rewrite with coverage strategy and claim/test alignment**

Priority categories:

1. **Coverage strategy (new)** — API routes need: 401 (no auth), 400 (bad input), success, error. Component tests need: happy path + 1 edge case (empty/loading/error).
2. **Claim/test alignment (new)** — a test named `handles empty input` MUST call with empty input. Tests passing without exercising the claimed behavior are a finding.
3. **User-flow vs implementation-detail** — `getByRole`/`getByLabelText`/`getByText` over `getByTestId`. Test what the user sees.
4. Mock patterns: `vi.stubGlobal('fetch', ...)` + `vi.unstubAllGlobals()`; never `global.fetch = ...` at module scope; MSW tests must NOT stub fetch.
5. `vi.mock('@/lib/errors')` must include ALL error groups the route uses (research finding — missing groups cause silent 500s).
6. Auth mock pattern: `vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))`, `vi.mock('@/lib/auth', () => ({ authOptions: {} }))`, `vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }))`.
7. User interactions: `userEvent.setup()` before render, never `fireEvent`.
8. Async assertions: `waitFor()` for any post-async assertion.
9. Mock placement: `vi.mock()` at top level (hoisted); imports of mocked modules use `await import()`.
10. Cleanup: `afterEach(() => cleanup())` + `vi.clearAllMocks()` or `vi.restoreAllMocks()` in beforeEach.

Do-NOT-flag for test-reviewer:

- 100% coverage targets (not the goal; meaningful coverage is)
- "Should use snapshot tests" (often noise; flag only if the test is asserting nothing else)
- Test file naming style (pre-existing convention)
- Mocks that look "excessive" but are necessary for isolation

Examples: 4 good findings (test claim mismatch, missing error path coverage, fetch-stubbing-while-using-MSW, missing error-constant mock) + 3 bad-finding patterns.

- [ ] **Step 3: Verify and commit**

```bash
wc -l .claude/agents/test-reviewer.md
# Expected: ~130 lines

git add .claude/agents/test-reviewer.md
git commit -m "feat(agents): expand test-reviewer with coverage strategy"
```

---

## Phase 3: Skill Infrastructure

### Task 7: Port `resolve-diff-lines.ts` from loupe

**Files:**

- Create: `.claude/skills/review/resolve-diff-lines.ts` (~150 lines)
- Create: `.claude/skills/review/__tests__/resolve-diff-lines.test.ts` (~80 lines)

- [ ] **Step 1: Fetch loupe's resolve-diff-lines.ts as reference**

```bash
mkdir -p .claude/skills/review/__tests__
gh api repos/loupe-app/loupe/contents/.claude/skills/review-pr/resolve-diff-lines.ts --jq .content | base64 -d > /tmp/loupe-resolve-diff-lines.ts
cat /tmp/loupe-resolve-diff-lines.ts | head -60
```

- [ ] **Step 2: Write failing test first (TDD)**

Create `.claude/skills/review/__tests__/resolve-diff-lines.test.ts` with these cases:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveCommentLines } from '../resolve-diff-lines.js';

describe('resolveCommentLines', () => {
  it('passes through comments anchored to lines inside a diff hunk', () => {
    const diff = `diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -1,3 +1,4 @@
 line1
+line2
 line3`;
    const comments = [{ path: 'foo.ts', line: 2, body: 'test' }];
    const result = resolveCommentLines(diff, comments);
    expect(result.resolved).toEqual(comments);
    expect(result.dropped).toEqual([]);
  });

  it('moves a comment outside any hunk to the nearest valid line with a Re: prefix', () => {
    // ... similar setup, comment line outside hunk, expect moved comment with "(Re: line N)" prefix
  });

  it('drops comments for files not in the diff', () => {
    // ... comment on missing.ts, expect drop with reason
  });

  it('handles new files (all + lines) correctly', () => {
    // ... new file, comment on any added line, expect pass-through
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run .claude/skills/review/__tests__/resolve-diff-lines.test.ts
# Expected: FAIL — module not found or no exports
```

- [ ] **Step 4: Implement `resolve-diff-lines.ts`**

Adapt loupe's implementation. Required exports:

```typescript
export interface Comment {
  path: string;
  line: number;
  body: string;
  side?: 'RIGHT' | 'LEFT';
}

export interface ResolveResult {
  resolved: Comment[];
  dropped: Array<{ comment: Comment; reason: string }>;
  moved: Array<{ comment: Comment; originalLine: number; newLine: number }>;
}

export function resolveCommentLines(diff: string, comments: Comment[]): ResolveResult;
```

Behavior (mirror loupe):

1. Parse the diff into per-file hunks. Each hunk has a start line (post-diff) and a count.
2. For each comment:
   - If file not in diff → drop with reason `"file not in diff"`.
   - If line is within any hunk's post-diff range → pass through.
   - Else find the nearest valid line in the same file; move and prefix body with `(Re: line N) `.
3. Also provide a CLI entry point that reads diff from a path, reads comments from a JSON file, writes resolved JSON to an output path.

CLI form:

```bash
npx tsx .claude/skills/review/resolve-diff-lines.ts <diff-path> <review-json-path> --output <output-path>
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run .claude/skills/review/__tests__/resolve-diff-lines.test.ts
# Expected: 4 passing
```

- [ ] **Step 6: Smoke-test the CLI**

```bash
# Construct a minimal diff and comment file
cat > /tmp/test.diff <<'EOF'
diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -1,3 +1,4 @@
 line1
+line2
 line3
EOF
echo '{"comments":[{"path":"foo.ts","line":2,"body":"test"}]}' > /tmp/test-review.json
npx tsx .claude/skills/review/resolve-diff-lines.ts /tmp/test.diff /tmp/test-review.json --output /tmp/test-resolved.json
cat /tmp/test-resolved.json
# Expected: same comment as input
```

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/review/resolve-diff-lines.ts .claude/skills/review/__tests__/resolve-diff-lines.test.ts
git commit -m "feat(review): port resolve-diff-lines.ts from loupe with tests"
```

---

## Phase 4: Skills

### Task 8: Build `/review` skill

**Files:**

- Create: `.claude/skills/review/SKILL.md` (~400 lines)

- [ ] **Step 1: Read spec section "3. `/review` skill (unified)"**

Read the spec for full orchestration details.

- [ ] **Step 2: Write SKILL.md with frontmatter and 6 orchestration sections**

Required structural sections:

```markdown
---
name: review
description: Run a multi-agent code review on a PR or local branch. Auto-detects mode. Optionally posts inline findings to GitHub.
user-invocable: true
---

# /review

Deep multi-dimensional code review. Dispatches 5 specialist agents in parallel against the diff, enforces REVIEW.md severity calibration and `file:line` citation discipline, presents tiered findings interactively, and optionally posts inline GitHub review comments.

**Replaces** the older `/review-pr` skill.

## Invocation

- `/review` — auto-detects mode: open PR on current branch → PR mode; else → branch mode (diff vs `main`)
- `/review pr <N>` — explicit PR mode against PR #N
- `/review branch` — explicit branch mode (diff vs `main`)
- `/review --post` — PR mode, post inline review comments to GitHub after approval
- `/review --focus <notes>` — focus notes passed to agents

## Session Directory

[Same pattern as loupe: SESSION_DIR=$(mktemp -d /tmp/review-XXXXXXXX); meta.json; diff.txt; findings-*.json; compiled.json]

## Workflow

### 1. Setup

[Detailed bash commands per spec section 3 step 1. PR mode: gh pr view, gh pr diff, gh api comments, head SHA, worktree-checkout to $SESSION_DIR/repo. Branch mode: git diff main...HEAD, skip checkout.]

### 2. Plan Dispatch

[Enter plan mode. Present 5-agent dispatch table. Wait for user approval.]

### 3. Dispatch Specialists in Parallel

[Subagent prompt template — diff scope rule, REVIEW.md required reading, file:line enforcement, output path.]

### 4. Compile + Dedupe (main context)

[Read findings-*.json. Apply REVIEW.md rubric. Diff-scope verification. Reachability pre-check. Dedupe on file:line. Cap Nits at 5. Write compiled.json.]

### 5. Interactive Tiered Presentation

[Critical+Important individually via AskUserQuestion; Minor+Nit batched. PR mode: ask review event type.]

### 6. Output

[Branch mode: terminal report + verdict. PR mode: build review JSON, run resolve-diff-lines.ts, post via gh api, verify post-submit.]

## Verification Rules (for subagents)

[REVIEW.md verification rules + diff-scope rule emphasized.]

## Common Mistakes

[Table mirroring loupe's common-mistakes table: pre-existing code flagged, full diff in main context, etc.]
```

Full SKILL.md should run ~400 lines. Use loupe's `.claude/skills/review-pr/SKILL.md` as a structural reference (NOT copy-paste — adapt to weekly-eats specifics):

- 5 specialist agents (architecture, code, security, a11y, test) instead of loupe's UX/Architecture/etc.
- REVIEW.md is the rubric (loupe doesn't have this)
- weekly-eats stack-specific verification doc paths (CLAUDE.md, docs/architecture.md, etc.)

- [ ] **Step 3: Verify structure**

```bash
wc -l .claude/skills/review/SKILL.md
# Expected: ~400 lines (target ≤500)

grep -c "^### " .claude/skills/review/SKILL.md
# Expected: 6 workflow steps + supporting subsections
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/review/SKILL.md
git commit -m "feat: add /review skill (unified PR + branch review)"
```

---

### Task 9: Build `/review-plan` skill

**Files:**

- Create: `.claude/skills/review-plan/SKILL.md` (~200 lines)

- [ ] **Step 1: Read spec section "4. `/review-plan` skill"**

- [ ] **Step 2: Write SKILL.md**

Required structure:

```markdown
---
name: review-plan
description: Review a draft plan or design spec before implementation. Companion to superpowers' writing-plans skill.
user-invocable: true
---

# /review-plan

Dispatches the 5 specialist agents against a plan/spec doc instead of a code diff. Catches architecture concerns, testing gaps, security implications of new data flows, and pattern-fit issues BEFORE implementation begins.

## Invocation

- `/review-plan` — finds the most recent file in `docs/superpowers/specs/` or `docs/superpowers/plans/`
- `/review-plan <path>` — review a specific file

## Workflow

### 1. Setup

Read the target file. Classify what it touches (UI / API / data layer / auth / tests / architecture) — pass classification as context to each agent. All 5 agents always dispatch.

### 2. Dispatch Specialists in Parallel

[Subagent prompt template — context is the plan doc, project CLAUDE.md, related code in src/. REVIEW.md verification rules apply. file:line citations point to plan doc section + line.]

[Per-agent focus at plan-time:

- architecture-reviewer: pattern fit, abstraction justification, module coupling, complexity warnings derived from design
- security-reviewer: new user-data flows; auth changes; new API surface (auth/ownership specified?); "we'll add validation later" red flags
- test-reviewer: what tests does this plan specify? what's missing? are edge cases enumerated? testable as designed?
- code-reviewer (lighter): does plan reference correct conventions? proposes anything against project rules?
- a11y-reviewer: only fires if plan involves UI — keyboard? focus? mobile?]

### 3. Compile Findings

[Same REVIEW.md rubric. Findings JSON with file:line pointing at plan doc OR related project files.]

### 4. Interactive Tiered Presentation

[Same as /review: Critical+Important individually; Minor+Nit batched.]

### 5. Output

[Findings list grouped by plan section, each citing section heading + line in plan. For Important/Critical findings on text to rewrite: "Suggested replacement:" block with quoted source + proposed text. Verdict: PLAN READY / REVISE BEFORE IMPLEMENTING / MAJOR GAPS — RECONSIDER DESIGN. Interactive offer: "Save annotations to <plan>-review.md?"]

## Opinionated Plan-Content Requirements

Agents flag missing items:

- Explicit test list (not "we'll add tests")
- Explicit ownership/auth specification for new data flows
- Pattern-fit justification for new abstractions
- Migration safety statement if schema changes
- Mobile + keyboard considerations if UI involved

## Out of Scope at Plan Time

- Naming preferences
- Implementation details the plan reasonably defers
- Style/convention checks that only matter at code-time

## Common Mistakes

[Table: flagging implementation details at plan time, not citing plan-doc line numbers, etc.]
```

- [ ] **Step 3: Verify and commit**

```bash
wc -l .claude/skills/review-plan/SKILL.md
# Expected: ~200 lines

git add .claude/skills/review-plan/SKILL.md
git commit -m "feat: add /review-plan skill (companion to writing-plans)"
```

---

### Task 10: Build `/audit-debt` skill

**Files:**

- Create: `.claude/skills/audit-debt/SKILL.md` (~250 lines)

- [ ] **Step 1: Read spec section "5. `/audit-debt` skill"**

- [ ] **Step 2: Write SKILL.md**

Required structure (5 workflow steps per spec):

```markdown
---
name: audit-debt
description: Periodic full-repo sweep for accumulated technical, security, and architectural debt. Produces a prioritized backlog you can act on.
user-invocable: true
---

# /audit-debt

Sweeps the codebase (not a diff) for accumulated debt. Returns a prioritized backlog scored by severity × inverse-effort.

## Invocation

`/audit-debt` (no flags)

## Workflow

### 1. Sweep Prep

[bash commands: collect file list across src/ scripts/ docs/; npm audit --json; grep TODO/FIXME/XXX/HACK; parse CLAUDE.md claims to verify.]

### 2. Dispatch Specialists in Parallel

[All 5 agents sweep their lens across the repo. Subagent prompt template includes: REVIEW.md required reading; this is sweep-mode, NOT diff-mode; file:line citation still required; effort estimate per finding (Quick / Medium / Big-job).]

[Per-agent sweep focus:

- architecture-reviewer: layering violations, file-size monsters (>500 lines), abstraction creep, cross-feature import smells
- code-reviewer: CLAUDE.md drift, pattern inconsistency, naming/convention drift, missing @/ aliases, dead exports
- security-reviewer: missing ownership filters in existing routes (priority sweep), missing ObjectId.isValid, share/invite paths without auth verification
- test-reviewer: untested files (especially API routes and lib/utils), low-coverage paths, weak assertions
- a11y-reviewer: missing aria-labels on icon buttons, focus gaps in dialogs, hardcoded sx colors with poor contrast, missing keyboard alternatives in @dnd-kit usage]

### 3. Orchestrator-Driven Dimensions (no specialist)

[Main context handles:

- Dependency staleness + vulnerabilities (parse npm audit output)
- TODO/FIXME accumulation (count + hot spots + oldest)
- Documentation drift (references to files/functions/paths that don't exist)]

### 4. Compile + Prioritize

[Apply REVIEW.md severity rubric recalibrated for debt:

- Critical: active security risk in shipped code
- Important: bug waiting to happen OR significant architecture violation
- Minor: consistency / missing test / small refactor
- Nit: cleanup / naming / dead code]

[Score each finding by effort (Quick / Medium / Big-job). Sort by severity × inverse-effort.]

### 5. Present + Interactive Output

[Markdown report grouped by category, sorted by priority. Each item: title, severity, effort, files, suggested fix, suggested issue title.]

[After report: interactive offer:

- "Save this report to a file? Where?" (writes markdown)
- "File any of these as GitHub issues? (I'll go finding-by-finding for Critical/Important)" — uses gh issue create]

## Severity Recalibration for Debt Context

[Definitions above. Examples per tier from weekly-eats: a route currently missing userId filter = Critical; a file at 800 lines = Important; etc.]

## Effort Labels

- **Quick** — <30 min: rename, add aria-label, hardcoded → constant
- **Medium** — 30 min - 4 hours: refactor a hook, add tests for a route, fix an IDOR
- **Big-job** — multi-session: restructure a feature, migrate a collection, replace a dependency

## Common Mistakes

[Table: flagging pre-existing code as "debt" when it's working as designed; over-counting nits; missing the difference between "could improve" and "is broken."]
```

- [ ] **Step 3: Verify and commit**

```bash
wc -l .claude/skills/audit-debt/SKILL.md
# Expected: ~250 lines

git add .claude/skills/audit-debt/SKILL.md
git commit -m "feat: add /audit-debt skill (periodic debt sweep)"
```

---

## Phase 5: Integration

### Task 11: Update `CLAUDE.md`

**Files:**

- Modify: `CLAUDE.md` (Skills table + Agents table + new "Review workflow" section)

- [ ] **Step 1: Read current `CLAUDE.md`**

Read lines around the "Claude Code Automations" section to locate the Skills and Agents tables.

- [ ] **Step 2: Update Skills table**

Remove `/review-pr` row. Add three new rows:

```markdown
| `/review` | User or auto | Run multi-agent review on PR or branch (replaces /review-pr) |
| `/review-plan` | User or auto | Review a draft plan/spec before implementing |
| `/audit-debt` | User or auto | Periodic full-repo debt sweep with prioritized backlog |
```

- [ ] **Step 3: Update Agents table**

Add `architecture-reviewer` row:

```markdown
| `architecture-reviewer` | Layering, abstractions, module boundaries, complexity warnings |
```

- [ ] **Step 4: Add "Review workflow" section**

After the Skills/Agents tables, add a new H2 section:

```markdown
## Review Workflow

All review skills read `REVIEW.md` (repo root) for severity calibration, do-NOT-flag exclusions, and verification rules.

| When                                   | Skill                         | Output                                                                 |
| -------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| Drafting a plan/spec                   | `/review-plan`                | Annotations on the plan doc, verdict: PLAN READY / REVISE / RECONSIDER |
| End of subagent-driven-dev (before PR) | `/review` (branch mode)       | Terminal report, verdict: READY FOR PR / FIX BEFORE PR / MAJOR FIXES   |
| PR open                                | `/review pr <N>` or `/review` | Terminal report; optional inline GitHub posting via `--post`           |
| Periodic (monthly)                     | `/audit-debt`                 | Prioritized backlog; optional save-to-file or file-as-issues           |

Each skill dispatches the same 5 specialist agents (architecture, code, security, a11y, test) in parallel. The agents enforce `file:line` citations and diff-scope rules to suppress false positives.
```

- [ ] **Step 5: Verify and commit**

```bash
git diff CLAUDE.md | head -60
# Sanity check the diff

git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for new review skill suite"
```

---

### Task 12: Delete old `/review-pr` skill

**Files:**

- Delete: `.claude/skills/review-pr/SKILL.md` (and parent dir if empty)

- [ ] **Step 1: Verify no references**

```bash
rg "review-pr" --type-not md --type-not txt -l
# Expected: no results in code (CLAUDE.md mention is OK — it's documentation, and Task 11 already removed it)

rg "review-pr" -l
# Expected: only this plan + spec + CHANGELOG-like docs
```

- [ ] **Step 2: Delete file and dir**

```bash
rm .claude/skills/review-pr/SKILL.md
rmdir .claude/skills/review-pr
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/review-pr
git commit -m "chore: remove /review-pr skill (replaced by /review)"
```

---

## Phase 6: Dogfood

### Task 13: Dogfood `/review-plan` on the spec

- [ ] **Step 1: Invoke `/review-plan`**

```
/review-plan docs/superpowers/specs/2026-05-27-review-suite-design.md
```

- [ ] **Step 2: Capture findings**

Note any Critical or Important findings about the spec itself. Apply fixes inline to the spec if any are valid; commit fixes.

- [ ] **Step 3: Acceptance check**

Success criterion: at least one actionable finding is produced (proves the skill runs end-to-end). Zero Critical/Important false positives (proves calibration is right).

If false positives appear at Critical/Important: this is a Skill Bug — return to Tasks 1, 2, 3, 4, 5, or 6 to tighten the relevant agent's do-NOT-flag list. Do not ship with miscalibrated agents.

---

### Task 14: Dogfood `/review` on the implementation branch

- [ ] **Step 1: Invoke `/review` in branch mode**

```
/review branch
```

- [ ] **Step 2: Capture findings + verify the worktree-checkout / file:line / diff-scope rules all work**

Walk through:

- All 5 agents dispatched? (check `$SESSION_DIR/findings-*.json` count)
- Every finding has a `file:line` citation? (any without should have been dropped at compile)
- Tiered presentation works (Critical+Important individually, Minor+Nit batched)?
- Verdict label shown?

- [ ] **Step 3: Acceptance check**

Success: skill runs end-to-end; verdict is `READY FOR PR` or `FIX BEFORE PR` with specific findings; no Critical/Important false positives.

If end-to-end issues: tighten the orchestration. If false positives: tighten REVIEW.md or agent do-NOT-flag lists.

---

### Task 15: Dogfood `/audit-debt` on weekly-eats

- [ ] **Step 1: Invoke `/audit-debt`**

```
/audit-debt
```

- [ ] **Step 2: Verify output**

Walk through:

- All 5 agents dispatched in sweep mode?
- Orchestrator-driven dimensions (deps / TODOs / doc drift) included?
- Findings sorted by severity × inverse-effort?
- Interactive offer at the end (save to file? file as issues?)?

- [ ] **Step 3: Acceptance check**

Success: produces a non-trivial backlog (at least 5 findings across multiple categories); top findings are plausibly actionable; no Critical false positives.

- [ ] **Step 4: Decide whether to save report and/or file issues**

If valuable: save to `docs/debt-audit-2026-05-27.md` and/or file Critical/Important as issues.

---

### Task 16: Final verification + open PR

- [ ] **Step 1: Run full validation suite**

```bash
npm run check
# Expected: lint + tests + build all pass
```

Note: skill markdown files don't affect this validation, but the new `resolve-diff-lines.ts` does. The test for it must be in the pass count.

- [ ] **Step 2: Verify all spec requirements implemented**

Cross-check against spec deliverables list. Every item should have a corresponding file at the expected path.

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin worktree-review-pr-overhaul
gh pr create --title "Code-review skill suite: /review, /review-plan, /audit-debt + REVIEW.md + 5 specialist agents" --body "$(cat <<'EOF'
## Summary

- Replaces the lightweight `/review-pr` skill with a 3-skill suite: `/review` (PR + branch modes), `/review-plan` (companion to superpowers writing-plans), `/audit-debt` (periodic full-repo sweep).
- Adds `REVIEW.md` at repo root: severity rubric, bias-toward-approval policy, global do-NOT-flag list, verification rules.
- Adds new `architecture-reviewer` agent; expands the four existing agents (code, security, a11y, test) ~5-10× with methodology, do-NOT-flag lists, file:line citation discipline.
- Ports `resolve-diff-lines.ts` from loupe with Vitest coverage.
- Dogfooded against this PR's own diff and spec.

Designed around 2025-2026 AI-code-review research findings on false-positive control, IDOR/auth-logic bug class, and LLM confabulation. Specifically tuned for a solo PM-coder building a personal app, not a multi-tenant SaaS.

## Test plan

- [ ] `/review-plan` produces actionable findings on the spec doc
- [ ] `/review branch` produces actionable findings on the implementation diff
- [ ] `/audit-debt` produces a non-trivial backlog on the current codebase
- [ ] Vitest run includes resolve-diff-lines.test.ts (all green)
- [ ] No Critical/Important false positives in any dogfood run

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

After plan completion (writing this section is itself part of the plan):

**1. Spec coverage:** Every spec deliverable maps to a task —

- REVIEW.md → Task 1
- architecture-reviewer (new) → Task 2
- 4 expanded agents → Tasks 3, 4, 5, 6
- resolve-diff-lines.ts → Task 7
- /review skill → Task 8
- /review-plan skill → Task 9
- /audit-debt skill → Task 10
- CLAUDE.md updates → Task 11
- Delete /review-pr → Task 12
- Dogfood → Tasks 13, 14, 15
- Open PR → Task 16

No spec requirements without a task.

**2. Placeholder scan:** No "TBD" / "TODO" / "implement later" in any step. Where the plan defers to spec for full prose (e.g., agent example sets), the verbatim required wording is in the plan and the spec is a committed file in this PR — accessible to any executing subagent.

**3. Type consistency:** Findings JSON shape is defined once in REVIEW.md (Task 1) and referenced consistently in `/review` (Task 8), `/review-plan` (Task 9), `/audit-debt` (Task 10). resolve-diff-lines.ts exports a `Comment` interface (Task 7) used by `/review` posting flow (Task 8). Verdict labels match between REVIEW.md and the three skill SKILL.md files.

**4. Execution caveats:**

- Tasks 2-6 (agents) can run in parallel after Task 1 — subagent-driven-dev should dispatch them concurrently.
- Tasks 9-10 (skills /review-plan and /audit-debt) can run in parallel with Task 8 once Tasks 1-7 complete.
- Tasks 13-15 (dogfood) must be sequential because each may surface a fix needed in earlier tasks.
