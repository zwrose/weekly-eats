# Design Redesign — Progress Ledger

Living dashboard for the dark-first redesign migration. This is the **compaction resume-anchor**: a freshly-compacted context reads the spec + this file to know where things stand. Git tags are the objective truth; this is the readable narrative.

- **Spec (roadmap):** `docs/superpowers/specs/2026-05-28-design-redesign-migration-design.md`
- **Design bundle (reference):** `docs/design/weekly-eats-redesign/`
- **Branch:** `claude-design-redesign` · **Beta:** `https://beta.weekly-eats.zamilyfam.com` (set up in Chunk 1)
- **Draft PR:** _(opened in Chunk 1 — link here)_
- **Audit backlog:** `docs/debt-audit-2026-05-28.md` _(created in Chunk 0)_

## Chunk status

| #   | Chunk                        | Status  | Tag | Plan doc          | PR test comment | Done |
| --- | ---------------------------- | ------- | --- | ----------------- | --------------- | ---- |
| 0   | Test baseline + hardening    | pending | —   | §6 of spec        | n/a (no UI)     | —    |
| 1   | Foundation                   | pending | —   | —                 | —               | —    |
| 2   | Nav chrome                   | pending | —   | —                 | —               | —    |
| 3   | Meal Plans                   | pending | —   | — _(review-plan)_ | —               | —    |
| 4   | Recipes                      | pending | —   | — _(review-plan)_ | —               | —    |
| 5   | Shopping Lists               | pending | —   | — _(review-plan)_ | —               | —    |
| 6   | Pantry                       | pending | —   | —                 | —               | —    |
| 7   | Food Items                   | pending | —   | —                 | —               | —    |
| 8   | User Mgmt & Pending Approval | pending | —   | —                 | —               | —    |
| 9   | Settings (placeholder)       | pending | —   | —                 | —               | —    |
| 10  | Marketing / home             | pending | —   | —                 | —               | —    |
| 11  | Cleanup                      | pending | —   | —                 | —               | —    |

Status values: `pending` → `in-progress` → `done`. Per-chunk plans live at `docs/superpowers/plans/redesign-chunk-NN-<surface>-plan.md`.

## Next up

**Chunk 0** — test baseline + data-layer hardening. Start: `npm install`, then `npm run check` for the baseline (workspace currently has no `node_modules`).

## Decisions & carryovers

Dated entries for things decided mid-flight that affect later chunks but aren't worth a spec rewrite.

- **2026-05-28 — A11y scope deferred (from `/review-plan`).** Consciously skipped for this single-family app, do not re-litigate: dark-mode muted-text contrast retune (`text.muted` #5b6170 / `text.past` #7b818f are sub-AA on dark surfaces by deliberate design choice), broad keyboard/focus rework for new surfaces, `@dnd-kit` `KeyboardSensor` for shopping reorder, mobile nav `aria-current`. **Kept:** accessible names on icon-only buttons (cheap, enforced by review-code each chunk).
- **2026-05-28 — Beta approval gating.** Approval is client-only today (`middleware.ts` checks only `if (!token)`). Chunk 1 adds an interim server-side `token.isApproved` check in `middleware.ts` before the public beta goes live; Chunk 2's `AuthenticatedLayout` rewrite must not drop the client gate mount (test it).
- **2026-05-28 — Golden-master targets corrected (Chunk 0).** Only genuinely pure transforms get golden-master fixtures; `meal-plan-utils` overlap/next-date is the real target. The three sharing/shopping `*-utils` are async fetch wrappers → MSW path coverage instead. See spec §6 0c.
