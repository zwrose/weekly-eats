# Chunk 4 — implementation deviations / notes (for morning review)

Running log of anything that deviated from the plan or is worth a human decision.
Delete this file (or fold into the ledger) once the chunk is approved.

## RESUME CHECKPOINT (autonomous run progress)

Subagent-driven-development of the 18-task plan, each task TDD + 2-stage review, committed locally on `claude-design-redesign`.

- **Tasks 1–18: ALL DONE + reviewed/approved.** (Tasks 8/9/10/11 required a fix round — all fixed: prep-field control, group keys + onItemCreated test, sort-direction restore, pending-invite display bug. Tasks 14/15 had tiny direct cleanups.)
- Head at 18/18 = `fc7f0ab`. 26 commits since base `b9be176` (24 chunk-4 + 2 docs). Plan/review/ledger docs at `4f37a2b`. All LOCAL (ahead of origin — push at the push step).
- **Post-implementation progress:**
  - ✅ `/review-code --base b9be176` (branch mode) DONE — round 1: 0 Crit / 2 Important (test gaps) / 5 Minor / 8 Nit, security clean. Fixed both Importants + safe Minors/Nits (`8130a7a` + `e3c5b01`); skipped 4 non-blocking (no-touch-types type move, intentional cross-folder import, planned helper, 500-line split). Round-2 verify clean.
  - ✅ `npm run check` GREEN (1441 tests, lint, build) — ran inside the fixers.
  - ✅ `/manual-testing chunk-04-recipes` DONE — seeded dev DB (16 food items, 6 user recipes + data, 3 global recipes); checklist posted to PR #89 (issuecomment-4582031118).
  - ✅ Pushed `e9a4558..e3c5b01` (27 commits). CI **green** (lint + tests w/ coverage, 1m54s). Beta deploy **READY** (`dpl_7BEECToZte9d1DcPumixyzoB5XEQ`, commit e3c5b01) → `beta.weekly-eats.zamilyfam.com`.
  - ⏳ **HARD STOP reached.** Remaining = the Chrome 390px manual-verification gate (needs the user's signed-in browser) + user review. **NOT tagged** `redesign-chunk-04`; ledger row stays in-progress until the user approves.
- Chrome-gate visual checks: DotBadge color (`tokens.state.danger` pink-red, matches today's Badge semantics — confirm vs artboard "orange dot"); instruction markdown tables/fenced-code unstyled fallback (Task 5 note); tags/rating now persist at Save (Task 13 note).
- If resuming cold: `git log --oneline`; if all 18 commits are in, continue from the next un-done post-implementation step above.

## Task 5 — RecipeInstructionsView markdown element coverage

- The rethemed component styles `h1–h3`, `p`, `ul/ol/li`, `a`, inline `code`, `blockquote` — exactly the element map in the plan's Task-5 code block (which was 0/0-reviewed).
- The OLD `src/components/RecipeInstructionsView.tsx` additionally styled `h4–h6`, `hr`, fenced `pre`/block-code (separate from inline), and full GFM `table/*` markup.
- Net: a recipe whose instructions use a markdown **table**, fenced code block, `hr`, or `h4+` heading will render via react-markdown defaults — functional and readable, but not dark-token-styled.
- **Decision:** honored the plan's simpler map (no gold-plating mid-implementation). Flag if any real recipe on the prod DB uses instruction tables/fenced code and the unstyled fallback looks wrong; if so, port the old element map (mechanical: copy old `components={{…}}`, swap colors → tokens).

## Task 13 — tags/rating now persist at SAVE-time (was real-time) [spec-intended]

- Today's recipe editor persists tag and star-rating changes **immediately** on each interaction (`updateRecipeTags`/`updateRecipeRating` fire on change). The redesigned `RecipeEditor` **batches** them: it writes the recipe, then conditionally calls `updateRecipeTags` / `updateRecipeRating` / `deleteRecipeRating` only if they changed, at **Save** time.
- This is the plan's explicit documented choice (0/0-reviewed), NOT accidental drift. Payload shapes are unchanged.
- **Manual-test focus:** confirm editing tags + star rating and hitting Save persists them (and that Cancel/discard does NOT persist tag/rating edits — the new batched model means abandoning the editor now correctly discards tag/rating edits too, which differs from today where they'd already be saved).
- Also: title is now `.trim()`-ed on save (was not) — harmless improvement.
