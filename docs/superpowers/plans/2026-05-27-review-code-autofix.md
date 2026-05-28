# Review-Code Auto-Fix Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/review-code` into an autonomous review → triage → fix → re-review loop that fixes mechanical findings by default, defers genuine tradeoffs/UX calls to the user, and halts on a non-twitchy circuit breaker.

**Architecture:** The skill orchestrator runs a per-round loop. Each round dispatches the five existing specialist agents, compiles findings, dispatches a new triage subagent (auto_fix vs needs_user), optionally prompts the user for deferred findings, dispatches a single fixer subagent that applies + commits + runs `npm run check`, then a tested deterministic circuit breaker decides whether to continue. State lives under `$SESSION_DIR/round-N/` so the loop is resumable. `--review-only` and `--post` preserve today's read-only behaviors.

**Tech Stack:** Claude Code skills/agents (markdown), TypeScript + tsx (circuit-breaker helper, alongside the existing `resolve-diff-lines.ts`), Vitest (unit + IO tests), Node built-in `fs`/`path` (cross-platform per project rule).

---

## File Structure

| File                                                              | Responsibility                                                                | Action                                               |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| `REVIEW.md`                                                       | Severity + triage rubric, findings JSON schema                                | Modify: add Triage Rubric section + `tradeoff` field |
| `.claude/agents/architecture-reviewer.md`                         | Architecture review methodology                                               | Modify: add `tradeoff` flag instruction              |
| `.claude/agents/code-reviewer.md`                                 | Code-convention review                                                        | Modify: add `tradeoff` flag instruction              |
| `.claude/agents/security-reviewer.md`                             | Security/IDOR review                                                          | Modify: add `tradeoff` flag instruction              |
| `.claude/agents/a11y-reviewer.md`                                 | Accessibility review                                                          | Modify: add `tradeoff` flag instruction              |
| `.claude/agents/test-reviewer.md`                                 | Test-quality review                                                           | Modify: add `tradeoff` flag instruction              |
| `.claude/skills/review-code/circuit-breaker.ts`                   | Deterministic stuck-loop detection (pure fns + CLI)                           | Create                                               |
| `.claude/skills/review-code/__tests__/circuit-breaker.test.ts`    | Unit tests for pure functions                                                 | Create                                               |
| `.claude/skills/review-code/__tests__/circuit-breaker.io.test.ts` | IO tests for round/skip loading                                               | Create                                               |
| `.claude/skills/review-code/SKILL.md`                             | Orchestrator: loop, triage dispatch, fixer dispatch, breaker, preserved modes | Rewrite                                              |
| `CLAUDE.md`                                                       | Project docs                                                                  | Modify: skills table + Review Workflow rows          |

---

## Task 1: REVIEW.md — Triage Rubric + `tradeoff` field

**Files:**

- Modify: `REVIEW.md`

- [ ] **Step 1: Add the `tradeoff` field to the Findings Output Format**

In `REVIEW.md`, find the JSON block under `## Findings Output Format`. Replace the `"suggestion"` line so the object ends like this (add `tradeoff` as the last field):

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
    "suggestion": "<what to do, or null>",
    "tradeoff": <true only if multiple valid fix approaches exist; omit otherwise>
  }
]
```

- [ ] **Step 2: Add the Triage Rubric section**

Insert a new section immediately AFTER the `## Severity Caps` section and BEFORE `## Findings Output Format`:

```markdown
## Triage Rubric (auto-fix loop)

`/review-code`'s default auto-fix loop classifies every finding as `auto_fix` or `needs_user` via a triage subagent that reads this rubric. **Bias hard toward `auto_fix`** — the user's default is "fix everything that doesn't have a good reason not to fix." A finding is `needs_user` only when the _fix_ (not merely the surface area it touches) involves judgment.

A finding → **`needs_user`** when ANY of:

- `tradeoff: true` is set on the finding (multiple valid fix approaches). Authoritative — always defer.
- The fix is a **UX judgment call**: user-visible copy/wording, layout or visual change, interaction-model choice, empty/error-state design — AND more than one reasonable design exists.
- The fix would **change established product behavior** in a way the user may have an opinion on.

A finding → **`auto_fix`** when the fix is **mechanical / determinate**, e.g.:

- Add a missing `userId` filter; add an `ObjectId.isValid()` guard; replace a hardcoded string with an error constant from `@/lib/errors`.
- Add an `aria-label` to an icon button; add a `KeyboardSensor`; fix a focus-order bug with one correct answer.
- Add a missing test; fix a clear logic bug.

Decisive UX example: **"add an aria-label to this icon button"** is mechanical → `auto_fix`. **"this modal's focus trap fights the drawer — pick an interaction model"** is a judgment call → `needs_user`. Read the cited code to tell them apart.
```

- [ ] **Step 3: Verify**

Run: `grep -n "Triage Rubric" REVIEW.md && grep -n '"tradeoff"' REVIEW.md`
Expected: both grep hits print (one line each).

- [ ] **Step 4: Commit**

```bash
git add REVIEW.md
git commit -m "docs(review): add triage rubric and tradeoff field to REVIEW.md"
```

---

## Task 2: Specialist agents — `tradeoff` flag instruction

**Files:**

- Modify: `.claude/agents/architecture-reviewer.md`
- Modify: `.claude/agents/code-reviewer.md`
- Modify: `.claude/agents/security-reviewer.md`
- Modify: `.claude/agents/a11y-reviewer.md`
- Modify: `.claude/agents/test-reviewer.md`

Each agent file has an Output section: a bulleted list that ends immediately before the `## Examples of Good vs Bad Findings` heading. The list already contains bullets like "Severity caps from `REVIEW.md` apply…".

- [ ] **Step 1: Add the `tradeoff` bullet to all five agents**

In EACH of the five files, add this bullet as the LAST item of that Output bullet list (immediately before `## Examples of Good vs Bad Findings`). Use identical text in all five:

```markdown
- **Tradeoff flag.** If a finding has more than one reasonable fix and choosing between them is a judgment call (not a single obviously-correct fix), set `"tradeoff": true` on it. This routes the finding to the user instead of the auto-fixer. Omit the field otherwise (treated as `false`).
```

- [ ] **Step 2: Verify all five were updated**

Run: `grep -lc "Tradeoff flag" .claude/agents/architecture-reviewer.md .claude/agents/code-reviewer.md .claude/agents/security-reviewer.md .claude/agents/a11y-reviewer.md .claude/agents/test-reviewer.md`
Expected: all five paths listed (each containing the string once).

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/architecture-reviewer.md .claude/agents/code-reviewer.md .claude/agents/security-reviewer.md .claude/agents/a11y-reviewer.md .claude/agents/test-reviewer.md
git commit -m "docs(review): instruct specialists to set tradeoff flag"
```

---

## Task 3: circuit-breaker.ts — pure functions (TDD)

**Files:**

- Create: `.claude/skills/review-code/circuit-breaker.ts`
- Test: `.claude/skills/review-code/__tests__/circuit-breaker.test.ts`

This task implements ONLY the pure, IO-free functions. The CLI + filesystem loading come in Task 4.

- [ ] **Step 1: Write the failing unit tests**

Create `.claude/skills/review-code/__tests__/circuit-breaker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  normalizeTitle,
  findingIdentity,
  checkCircuitBreaker,
  type Finding,
  type RoundFindings,
} from '../circuit-breaker';

function round(num: number, findings: Finding[]): RoundFindings {
  return { round: num, findings };
}

const I = (title: string, file = 'src/a.ts'): Finding => ({
  id: 'x-001',
  severity: 'Important',
  dimension: 'Code',
  title,
  file,
  line: 1,
  body: '',
  suggestion: null,
});

const minor = (title: string, file = 'src/a.ts'): Finding => ({
  ...I(title, file),
  severity: 'Minor',
});

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeTitle('Missing userId Filter!')).toBe('missing userid filter');
    expect(normalizeTitle('  Extra   spaces  ')).toBe('extra spaces');
    expect(normalizeTitle('Punctuation, removed.')).toBe('punctuation removed');
  });
});

describe('findingIdentity', () => {
  it('combines file and normalized title', () => {
    expect(findingIdentity({ file: 'src/a.ts', title: 'Missing Filter' })).toBe(
      'src/a.ts::missing filter'
    );
  });
  it('treats null file as empty string', () => {
    expect(findingIdentity({ file: null, title: 'X' })).toBe('::x');
  });
});

describe('checkCircuitBreaker', () => {
  it('does not halt with no rounds', () => {
    expect(checkCircuitBreaker([], 7).halt).toBe(false);
  });

  it('does not halt on a single round still in progress', () => {
    expect(checkCircuitBreaker([round(1, [I('a'), I('b')])], 7).halt).toBe(false);
  });

  it('halts on a recurring finding across two consecutive rounds', () => {
    const r = [round(1, [I('Missing userId filter')]), round(2, [I('Missing userId filter')])];
    const res = checkCircuitBreaker(r, 7);
    expect(res.halt).toBe(true);
    expect(res.reason).toBe('recurring-finding');
  });

  it('ignores Minor/Nit recurrence (only blocking findings count)', () => {
    const r = [round(1, [minor('style x')]), round(2, [minor('style x')])];
    expect(checkCircuitBreaker(r, 7).halt).toBe(false);
  });

  it('does not halt when blocking findings strictly decrease', () => {
    const r = [round(1, [I('a'), I('b'), I('c')]), round(2, [I('d'), I('e')]), round(3, [I('f')])];
    expect(checkCircuitBreaker(r, 7).halt).toBe(false);
  });

  it('halts on no net progress over two transitions with distinct findings', () => {
    const r = [round(1, [I('a'), I('b')]), round(2, [I('c'), I('d')]), round(3, [I('e'), I('g')])];
    const res = checkCircuitBreaker(r, 7);
    expect(res.halt).toBe(true);
    expect(res.reason).toBe('no-net-progress');
  });

  it('does not halt on a single flat transition (needs two)', () => {
    const r = [round(1, [I('a'), I('b')]), round(2, [I('c'), I('d')])];
    expect(checkCircuitBreaker(r, 7).halt).toBe(false);
  });

  it('halts at max iterations when blocking findings remain', () => {
    const r = [round(1, [I('a')]), round(2, [I('a')])];
    // maxRounds = 2 reached, still 1 blocking finding open
    const res = checkCircuitBreaker(r, 2);
    expect(res.halt).toBe(true);
    expect(res.reason).toBe('max-iterations');
  });

  it('does not halt at max iterations once blocking findings are resolved', () => {
    const r = [round(1, [I('a')]), round(2, [])];
    expect(checkCircuitBreaker(r, 2).halt).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run .claude/skills/review-code/__tests__/circuit-breaker.test.ts`
Expected: FAIL — cannot resolve `../circuit-breaker` (module does not exist yet).

- [ ] **Step 3: Implement the pure functions**

Create `.claude/skills/review-code/circuit-breaker.ts`:

```typescript
export type Severity = 'Critical' | 'Important' | 'Minor' | 'Nit';

export interface Finding {
  id: string;
  severity: Severity;
  dimension: string;
  title: string;
  file: string | null;
  line: number | null;
  body: string;
  suggestion: string | null;
  tradeoff?: boolean;
}

export interface RoundFindings {
  round: number;
  findings: Finding[];
}

export type CircuitBreakerReason = 'recurring-finding' | 'no-net-progress' | 'max-iterations';

export interface CircuitBreakerResult {
  halt: boolean;
  reason: CircuitBreakerReason | null;
  detail: string;
}

const BLOCKING: ReadonlySet<Severity> = new Set<Severity>(['Critical', 'Important']);

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findingIdentity(finding: Pick<Finding, 'file' | 'title'>): string {
  return `${finding.file ?? ''}::${normalizeTitle(finding.title)}`;
}

function blockingFindings(round: RoundFindings): Finding[] {
  return round.findings.filter((f) => BLOCKING.has(f.severity));
}

/**
 * Decide whether the auto-fix loop is stuck and should halt.
 *
 * Contract: `rounds` are chronological (round 1 first). Each round's `findings`
 * are that round's compiled findings with deliberately-skipped findings already
 * removed by the caller — skipped findings must not count toward recurrence or
 * progress, or the loop would never converge.
 *
 * Un-sensitive by design: normal 2-3 round convergence never trips it.
 */
export function checkCircuitBreaker(
  rounds: RoundFindings[],
  maxRounds: number
): CircuitBreakerResult {
  const n = rounds.length;
  if (n === 0) {
    return { halt: false, reason: null, detail: 'no rounds yet' };
  }

  const latestBlocking = blockingFindings(rounds[n - 1]);

  // Criterion 3: max iterations (only halts while blocking findings remain).
  if (n >= maxRounds && latestBlocking.length > 0) {
    return {
      halt: true,
      reason: 'max-iterations',
      detail: `Reached ${maxRounds} rounds with ${latestBlocking.length} blocking finding(s) still open.`,
    };
  }

  // Criterion 1: recurring finding across the two most recent rounds.
  if (n >= 2) {
    const prevIds = new Set(blockingFindings(rounds[n - 2]).map(findingIdentity));
    const recurring = latestBlocking.filter((f) => prevIds.has(findingIdentity(f)));
    if (recurring.length > 0) {
      return {
        halt: true,
        reason: 'recurring-finding',
        detail: `${recurring.length} blocking finding(s) recurred after a fix was committed: ${recurring
          .map(findingIdentity)
          .join('; ')}`,
      };
    }
  }

  // Criterion 2: no net progress across two consecutive round-transitions.
  if (n >= 3) {
    const count = (i: number): number => blockingFindings(rounds[i]).length;
    const cN = count(n - 1);
    const cN1 = count(n - 2);
    const cN2 = count(n - 3);
    if (cN > 0 && cN >= cN1 && cN1 >= cN2) {
      return {
        halt: true,
        reason: 'no-net-progress',
        detail: `Blocking-finding count did not decrease over two rounds (${cN2} → ${cN1} → ${cN}).`,
      };
    }
  }

  return { halt: false, reason: null, detail: 'progressing' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run .claude/skills/review-code/__tests__/circuit-breaker.test.ts`
Expected: PASS — all describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/review-code/circuit-breaker.ts .claude/skills/review-code/__tests__/circuit-breaker.test.ts
git commit -m "feat(review): add circuit-breaker pure functions with tests"
```

---

## Task 4: circuit-breaker.ts — round loading + CLI (TDD)

**Files:**

- Modify: `.claude/skills/review-code/circuit-breaker.ts`
- Test: `.claude/skills/review-code/__tests__/circuit-breaker.io.test.ts`

Adds `loadRounds()` (reads `$SESSION_DIR/round-*/compiled.json`, excludes finding identities skipped in any `resolutions.json`) and a CLI entry the orchestrator invokes between rounds.

- [ ] **Step 1: Write the failing IO test**

Create `.claude/skills/review-code/__tests__/circuit-breaker.io.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRounds, type Finding } from '../circuit-breaker';

const I = (title: string, file = 'src/a.ts'): Finding => ({
  id: 'x-001',
  severity: 'Important',
  dimension: 'Code',
  title,
  file,
  line: 1,
  body: '',
  suggestion: null,
});

function writeRound(
  dir: string,
  n: number,
  findings: Finding[],
  resolutions?: Array<{ file: string; title: string; action: string }>
): void {
  const rd = join(dir, `round-${n}`);
  mkdirSync(rd, { recursive: true });
  writeFileSync(join(rd, 'compiled.json'), JSON.stringify({ findings }));
  if (resolutions) {
    writeFileSync(
      join(rd, 'resolutions.json'),
      JSON.stringify({ resolutions: resolutions.map((r) => ({ id: 'x', ...r })) })
    );
  }
}

describe('loadRounds', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cb-test-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads rounds in numeric order', () => {
    writeRound(dir, 2, [I('b')]);
    writeRound(dir, 1, [I('a')]);
    writeRound(dir, 10, [I('c')]);
    const { rounds } = loadRounds(dir);
    expect(rounds.map((r) => r.round)).toEqual([1, 2, 10]);
  });

  it('excludes findings whose identity was skipped in any round', () => {
    writeRound(
      dir,
      1,
      [I('Missing filter')],
      [{ file: 'src/a.ts', title: 'Missing filter', action: 'skip' }]
    );
    writeRound(dir, 2, [I('Missing filter'), I('Other bug')]);
    const { rounds } = loadRounds(dir);
    // Round 2's "Missing filter" is filtered out by the skip from round 1.
    expect(rounds[1].findings.map((f) => f.title)).toEqual(['Other bug']);
  });

  it('keeps findings for fix/fix-with-guidance resolutions', () => {
    writeRound(dir, 1, [I('Keep me')], [{ file: 'src/a.ts', title: 'Keep me', action: 'fix' }]);
    const { rounds } = loadRounds(dir);
    expect(rounds[0].findings).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the IO test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run .claude/skills/review-code/__tests__/circuit-breaker.io.test.ts`
Expected: FAIL — `loadRounds` is not exported from `../circuit-breaker`.

- [ ] **Step 3: Add imports at the TOP of circuit-breaker.ts**

At the very top of `.claude/skills/review-code/circuit-breaker.ts` (before the existing `export type Severity` line), add:

```typescript
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
```

- [ ] **Step 4: Append `loadRounds` + CLI to the BOTTOM of circuit-breaker.ts**

Append to the end of `.claude/skills/review-code/circuit-breaker.ts`:

```typescript
interface CompiledFile {
  findings: Finding[];
}

interface Resolution {
  id: string;
  file?: string | null;
  title?: string;
  action: 'fix' | 'fix-with-guidance' | 'skip';
  guidance?: string;
}

interface ResolutionsFile {
  resolutions: Resolution[];
}

/**
 * Read `<sessionDir>/round-N/compiled.json` for every round, in numeric order.
 * Finding identities that were deliberately skipped in ANY round's
 * `resolutions.json` are removed from every round, so the circuit breaker never
 * counts a finding the user chose to leave alone.
 */
export function loadRounds(sessionDir: string): {
  rounds: RoundFindings[];
  skipped: Set<string>;
} {
  const dirs = readdirSync(sessionDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^round-\d+$/.test(e.name))
    .map((e) => ({ name: e.name, num: Number(e.name.slice('round-'.length)) }))
    .sort((a, b) => a.num - b.num);

  const skipped = new Set<string>();
  for (const { name } of dirs) {
    const rp = join(sessionDir, name, 'resolutions.json');
    if (!existsSync(rp)) continue;
    const res = JSON.parse(readFileSync(rp, 'utf8')) as ResolutionsFile;
    for (const r of res.resolutions) {
      if (r.action === 'skip') {
        skipped.add(findingIdentity({ file: r.file ?? '', title: r.title ?? '' }));
      }
    }
  }

  const rounds: RoundFindings[] = [];
  for (const { name, num } of dirs) {
    const cp = join(sessionDir, name, 'compiled.json');
    if (!existsSync(cp)) continue;
    const compiled = JSON.parse(readFileSync(cp, 'utf8')) as CompiledFile;
    rounds.push({
      round: num,
      findings: compiled.findings.filter((f) => !skipped.has(findingIdentity(f))),
    });
  }
  return { rounds, skipped };
}

function main(): void {
  const [sessionDir, maxRoundsArg] = process.argv.slice(2);
  if (!sessionDir) {
    console.error('Usage: circuit-breaker.ts <session-dir> [max-rounds=7]');
    process.exit(2);
  }
  const maxRounds = Number(maxRoundsArg ?? '7');
  const { rounds } = loadRounds(sessionDir);
  const result = checkCircuitBreaker(rounds, maxRounds);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
```

- [ ] **Step 5: Run the IO test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run .claude/skills/review-code/__tests__/circuit-breaker.io.test.ts`
Expected: PASS — all three `loadRounds` cases green.

- [ ] **Step 6: Smoke-test the CLI**

```bash
SMOKE=$(mktemp -d /tmp/cb-smoke-XXXX)
mkdir -p "$SMOKE/round-1" "$SMOKE/round-2"
printf '{"findings":[{"id":"a","severity":"Important","dimension":"Code","title":"Bug X","file":"src/a.ts","line":1,"body":"","suggestion":null}]}' > "$SMOKE/round-1/compiled.json"
printf '{"findings":[{"id":"a","severity":"Important","dimension":"Code","title":"Bug X","file":"src/a.ts","line":1,"body":"","suggestion":null}]}' > "$SMOKE/round-2/compiled.json"
npx tsx .claude/skills/review-code/circuit-breaker.ts "$SMOKE" 7
rm -rf "$SMOKE"
```

Expected: JSON with `"halt": true` and `"reason": "recurring-finding"`.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/review-code/circuit-breaker.ts .claude/skills/review-code/__tests__/circuit-breaker.io.test.ts
git commit -m "feat(review): add round-loading and CLI to circuit-breaker"
```

---

## Task 5: SKILL.md rewrite — the auto-fix loop

**Files:**

- Rewrite: `.claude/skills/review-code/SKILL.md`

This restructures the workflow. The skill branches on flags at the top, then either runs the loop (default) or one of the two preserved read-only paths.

**Preserve verbatim from the current SKILL.md** (do not rewrite these — copy them across unchanged): the frontmatter, the `## Session Directory` "never read the diff" discipline, the **Setup** bash for PR/branch metadata, the **Dispatch Specialists in Parallel** prompt template + per-agent substitution table, the **Compile + Dedupe** pipeline (steps 1-6 + verdict mapping), the entire `--post` posting flow (review.json build, `resolve-diff-lines.ts` invocation, `gh api ... reviews`, post-submit verification), and the `## Verification Rules (for subagents)` section.

- [ ] **Step 1: Update the intro + Invocation table**

Replace the opening paragraphs and the Invocation table so the DEFAULT is the loop. The Invocation table must read:

```markdown
| Form                             | Behavior                                                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/review-code`                   | **Auto-fix loop (default).** Review → triage → fix → re-review until no Critical/Important findings remain, or a halt condition fires. Commits locally; never pushes. |
| `/review-code --review-only`     | One review pass, interactive tiered presentation, no commits. (The pre-loop behavior.)                                                                                |
| `/review-code pr <N> --post`     | One review pass, read-only, post inline findings to GitHub. Never touches the tree.                                                                                   |
| `/review-code branch` / `pr <N>` | Force branch or PR mode; still runs the auto-fix loop unless combined with `--review-only`/`--post`.                                                                  |
| `/review-code --focus <notes>`   | Pass focus notes to every specialist. Combinable with any form.                                                                                                       |
```

Add a sentence stating the three top-level paths: `--post` → read-only GitHub posting; `--review-only` → read-only terminal presentation; otherwise → auto-fix loop.

- [ ] **Step 2: Update Setup for local-diff + branch guard + baseRef in meta.json**

In the Setup section:

- Add `baseRef` to `meta.json` (`main` in branch mode; the PR's `baseRefName` in PR mode).
- State that the per-round diff is always computed locally as `git diff <baseRef>...HEAD` and written to `$SESSION_DIR/round-<round>/diff.txt` (NOT `gh pr diff`, because rounds 2+ have local fix commits not on the remote).
- Add the **auto-fix branch guard**: before entering the loop in PR mode, verify the current branch equals the PR's `headRefName`. If not (detached HEAD or reviewing someone else's PR), STOP and tell the user to use `--post` or `--review-only`. The detached `git worktree add` step is used ONLY in the `--post`/`--review-only` PR paths, NOT in the auto-fix path.

- [ ] **Step 3: Add the `tradeoff` field to the specialist dispatch prompt**

In the **Dispatch Specialists in Parallel** prompt template, in the `## Output` block, update the finding shape line to include `tradeoff` and add one sentence:

```
  { id, severity, dimension, title, file, line, body, suggestion, tradeoff? }
Set `tradeoff: true` only when a finding has multiple valid fix approaches (a
judgment call). Omit it otherwise. See REVIEW.md "Triage Rubric".
```

- [ ] **Step 4: Write the Loop Workflow section**

Replace the old `### 5. Interactive Tiered Presentation` and `### 6. Output` sections with a new `## Auto-Fix Loop (default path)` section containing this orchestration. Paste it verbatim:

````markdown
## Auto-Fix Loop (default path)

Runs when neither `--post` nor `--review-only` is set. The orchestrator keeps a **skip-set** of finding identities the user chose to skip (identity = `file::normalized-title`, matching `circuit-breaker.ts`). Initialize `round = 1`, `skip-set = {}`.

**If context was compacted mid-loop**, re-read `$SESSION_DIR/meta.json`, the highest-numbered `round-N/` files, and every `round-*/resolutions.json` (to rebuild the skip-set) before continuing.

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
       { "id": "<finding id>", "file": "<file>", "title": "<title>", "action": "fix" | "fix-with-guidance" | "skip", "guidance": "<text or omitted>" }
     ] }
     ```
     Add every `skip` identity to the skip-set. `approved` = entries with action `fix`/`fix-with-guidance` (carry `guidance`).
   - If empty: `approved = []`, write no resolutions file.
8. **Fix batch.** `auto_fix` = effective findings classified `auto_fix`. `fix-batch` = `auto_fix ∪ approved`. Write `round-<round>/fix-batch.json` (full finding objects; attach `userGuidance` to any with guidance).
9. **Blocking-to-fix** = count of `fix-batch` findings with severity Critical or Important.
10. If `fix-batch` is empty (everything this round was skipped) → **EXIT** with a "remaining findings deliberately skipped" note (list them).
11. **Fix.** Dispatch the fixer subagent (template below) with `fix-batch.json`.
    - Status `CHECK_FAILED` → **HALT**; surface the failing `npm run check` output.
    - Status `ESCALATED` → for each escalated finding, present it as a `needs_user` intervention now (same prompt shape as step 7) and fold the user's decision into a follow-up fixer dispatch this same round; do NOT add it to the skip-set unless the user skips it.
12. **Verify.** Orchestrator independently runs `npm run check`. Fail → **HALT**; surface output. (Do not re-review on a broken tree.)
13. **Circuit breaker.** Run `npx tsx .claude/skills/review-code/circuit-breaker.ts "$SESSION_DIR" 7`. Parse its JSON. If `halt: true` → **HALT**; surface `reason` + `detail` + still-open findings + the diff so far.
14. If `blocking-to-fix == 0` → **EXIT SUCCESS** (this round had no Critical/Important to fix; any Minor/Nit are now fixed). Otherwise `round += 1` and repeat from step 1.

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
````

- [ ] **Step 5: Add the read-only paths**

Add a short `## Read-Only Paths` section documenting:

- **`--review-only`:** run steps 1-3 of the loop ONCE (no triage/fix), then the interactive tiered presentation (the old `### 5` content — preserve it here) and terminal report. No commits.
- **`--post`:** run one review pass, then the preserved `--post` posting flow (review.json → `resolve-diff-lines.ts` → `gh api ... reviews` → post-submit verify). No triage, no fix, no loop.

- [ ] **Step 6: Update the Common Mistakes table**

Add these rows to the existing Common Mistakes table:

```markdown
| Using `gh pr diff` inside the loop | Rounds 2+ have local fix commits not on the remote. Always recompute `git diff <baseRef>...HEAD` locally each round. |
| Auto-fixing a PR you don't have checked out | Auto-fix needs the PR's branch as the current branch. If it isn't, stop and direct the user to `--post` or `--review-only`. |
| Re-reviewing on a broken tree | If `npm run check` fails after a fix, HALT. Never run the next review round on code that doesn't build/test. |
| Re-raising a finding the user skipped | Skipped identities go in the skip-set and are excluded from every later round's effective findings AND the circuit breaker. |
| Eyeballing "are we stuck?" by hand | Always call `circuit-breaker.ts`. Finding-identity comparison across rounds is deterministic; manual judgment drifts after compaction. |
| Pushing automatically at loop end | The loop commits locally only. Pushing is always a separate, user-confirmed step. |
```

- [ ] **Step 7: Verify structure**

Run: `grep -n -E "Auto-Fix Loop|Triage subagent prompt|Fixer subagent prompt|Read-Only Paths|circuit-breaker.ts" .claude/skills/review-code/SKILL.md`
Expected: hits for each of the five headings/references.

- [ ] **Step 8: Commit**

```bash
git add .claude/skills/review-code/SKILL.md
git commit -m "feat(review): rewrite review-code as an autonomous auto-fix loop"
```

---

## Task 6: CLAUDE.md doc touch-up

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the skills table row for `/review-code`**

In the `### Skills` table, replace the `/review-code` row's Purpose cell with:
`Auto-fix loop: review → triage → fix → re-review on a PR/branch until clean. --review-only or --post for read-only.`

- [ ] **Step 2: Update the Review Workflow section**

In the `## Review Workflow` table, update the two `/review-code` rows so the "End of subagent-driven-dev" and "PR open" rows note that the default now runs the auto-fix loop (commits locally), and that `--review-only` reproduces the old terminal report. Keep the `--post` description intact.

- [ ] **Step 3: Verify**

Run: `grep -n "Auto-fix loop\|--review-only" CLAUDE.md`
Expected: at least the two edited locations print.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe review-code auto-fix loop in CLAUDE.md"
```

---

## Task 7: Final validation

**Files:** none (validation only)

- [ ] **Step 1: Run the full check pipeline**

Run: `npm run check`
Expected: lint clean, all tests pass (including the two new circuit-breaker test files), build succeeds.

- [ ] **Step 2: Self-review against REVIEW.md**

Re-read the rewritten `SKILL.md` and confirm: every finding the loop emits still requires `file:line`; the diff-scope rule and single-pass discipline language survived the rewrite; `--post` posting flow + `resolve-diff-lines.ts` usage is byte-for-byte preserved; the triage/fixer prompts don't instruct agents to load the full diff into the orchestrator.

- [ ] **Step 3: Confirm no placeholders shipped**

Run: `grep -rn -E "TODO|TBD|FIXME|<placeholder>" .claude/skills/review-code/ REVIEW.md .claude/agents/ | grep -v node_modules || echo "clean"`
Expected: `clean` (or only pre-existing, unrelated matches).

---

## Self-Review (plan author)

**Spec coverage:**

- Loop workflow → Task 5 step 4. ✓
- Triage rubric + subagent → Task 1 step 2 (rubric), Task 5 step 4 (dispatch). ✓
- `tradeoff` field → Task 1 step 1 (schema), Task 2 (agents), Task 5 step 3 (dispatch prompt). ✓
- Circuit breaker (recurring / no-net-progress / max 7) → Task 3 (logic + tests). ✓
- Local-diff-per-round + branch guard → Task 5 step 2. ✓
- Verification gate (check halts loop) → Task 5 step 4 (steps 11-12). ✓
- Intervention UX (consolidated prompt, fix/guidance/skip) → Task 5 step 4 (step 7). ✓
- Modes (`--review-only`, `--post` preserved) → Task 5 steps 1, 5. ✓
- Resumability from disk → Task 5 step 4 (compaction note); skip-set rebuilt via `loadRounds` + orchestrator. ✓
- End-of-loop summary + offer to push → Task 5 step 4. ✓
- CLAUDE.md + deliverables → Task 6. ✓

**Placeholder scan:** No `TBD`/`TODO` in step bodies; every code step ships complete code; every prose insertion ships exact text. ✓

**Type consistency:** `Finding`, `RoundFindings`, `CircuitBreakerResult`, `normalizeTitle`, `findingIdentity`, `checkCircuitBreaker`, `loadRounds` are defined once (Tasks 3-4) and referenced consistently in tests and the SKILL.md CLI invocation. `resolutions.json` carries `file`+`title`+`action`(+`guidance`) in both the writer (Task 5 step 7) and the reader (Task 4 `Resolution` interface). ✓
