# REVIEW.md

This file is the source of truth for code-review severity, exclusions, and verification rules. Every review skill (`/review-code`, `/review-plan`, `/audit-debt`) and every reviewer agent reads it first. If a review finding contradicts this file, the file wins.

## Audience and Calibration

This project is built by a solo product manager with some technical chops, not a seasoned engineer. The app is single-user and runs personal data — no multi-tenant attack surface, no compliance regime. Review feedback should compensate for the user's intuition gaps in **security (especially IDOR/ownership-scope), architecture, testing, and accessibility** without drowning them in nits or theoretical risks.

**Bias hard toward approval.** Single warnings do not block merge. Only Critical or Important findings trigger a "needs fixes" verdict.

## Severity Tiers

| Tier             | Definition                                                                                                                                    | Examples                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Critical**     | Corrupts data, leaks user data, or breaks production. NEVER for tests or style.                                                               | API route missing `userId` filter returning other users' data; mutation without ownership check                    |
| **Important**    | Likely bug in normal use, OR security/correctness issue warranting fix before merge                                                           | Missing `ObjectId.isValid()` before query; component that crashes on empty data; auth missing on a new admin route |
| **Minor**        | Real issue, small impact                                                                                                                      | Magic number; missing index on a currently-fast query; inconsistent error message                                  |
| **Nit**          | Style preference, naming, take-it-or-leave-it                                                                                                 | "Variable name could be clearer"                                                                                   |
| **Pre-existing** | Issue exists only in lines the diff did not change (whether in unchanged files or in context lines of modified files) — SKIPPED, not reported | Bad pattern in code the PR didn't touch                                                                            |

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

If a prior `/review-code` flagged a finding and the PR author replied with substantive explanatory text, **do not re-raise** unless the justification contains a technical error. Substantive = explanation, not "ok" or emoji. Outdated comments (where `position == null`) are still scanned for justifications — the explanation may apply even if the code anchor moved.
If a justification is plausible but unverifiable (e.g., "this is intentional because of X" where X is a system you can't inspect), default to not re-raising — the author has more context than the reviewer.

## Severity Caps

- **Nits:** at most 5 reported per review. Remainder summarized as a count (e.g., "+ 12 more Nits"). Prevents Nit flooding.
- **Important / Critical:** no cap. These are load-bearing; cap them and you suppress signal.
- **Minor:** uncapped, but each finding must still pass verification rules. If you find yourself reporting >10 Minors, dedupe — they're often facets of the same underlying issue.

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
    "suggestion": "<what to do, or null>",
    "tradeoff": <true only if multiple valid fix approaches exist; omit otherwise>
  }
]
```

## Per-Skill Verdict Labels

- `/review-code` (branch mode): `READY FOR PR` / `FIX BEFORE PR` / `MAJOR FIXES NEEDED`
- `/review-plan`: `PLAN READY` / `REVISE BEFORE IMPLEMENTING` / `MAJOR GAPS — RECONSIDER DESIGN`
- `/audit-debt`: no single verdict; prioritized backlog instead

Verdict mapping:

- 0 Critical, 0 Important → READY / PLAN READY
- 0 Critical, 1+ Important → FIX BEFORE PR / REVISE BEFORE IMPLEMENTING
- 1+ Critical → MAJOR FIXES NEEDED / MAJOR GAPS
- Findings of only Minor and/or Nit severity do not change the verdict — those tiers are informational, not blocking.

## Single-Pass Discipline

Each specialist agent runs **once** per review. Do not dispatch a "verifier agent" that re-reviews specialist output — published research on multi-turn agentic review shows F1 degrades and agents fabricate findings in later rounds as real issues get exhausted. The main context is the coordinator: dedupes, ranks, drops out-of-scope, presents.
