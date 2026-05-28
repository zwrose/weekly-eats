# Design Redesign — Progress Ledger

Living dashboard for the dark-first redesign migration. This is the **compaction resume-anchor**: a freshly-compacted context reads the spec + this file to know where things stand. Git tags are the objective truth; this is the readable narrative.

- **Spec (roadmap):** `docs/superpowers/specs/2026-05-28-design-redesign-migration-design.md`
- **Design bundle (reference):** `docs/design/weekly-eats-redesign/`
- **Branch:** `claude-design-redesign` · **Beta:** `https://beta.weekly-eats.zamilyfam.com` (set up in Chunk 1)
- **Draft PR:** _(opened in Chunk 1 — link here)_
- **Audit backlog:** `docs/debt-audit-2026-05-28.md` _(created in Chunk 0)_

## Chunk status

| #   | Chunk                        | Status      | Tag               | Plan doc                             | PR test comment | Done       |
| --- | ---------------------------- | ----------- | ----------------- | ------------------------------------ | --------------- | ---------- |
| 0   | Test baseline + hardening    | done        | redesign-chunk-00 | §6 of spec                           | n/a (no UI)     | 2026-05-28 |
| 1   | Foundation                   | in-progress | —                 | redesign-chunk-01-foundation-plan.md | —               | —          |
| 2   | Nav chrome                   | pending     | —                 | —                                    | —               | —          |
| 3   | Meal Plans                   | pending     | —                 | — _(review-plan)_                    | —               | —          |
| 4   | Recipes                      | pending     | —                 | — _(review-plan)_                    | —               | —          |
| 5   | Shopping Lists               | pending     | —                 | — _(review-plan)_                    | —               | —          |
| 6   | Pantry                       | pending     | —                 | —                                    | —               | —          |
| 7   | Food Items                   | pending     | —                 | —                                    | —               | —          |
| 8   | User Mgmt & Pending Approval | pending     | —                 | —                                    | —               | —          |
| 9   | Settings (placeholder)       | pending     | —                 | —                                    | —               | —          |
| 10  | Marketing / home             | pending     | —                 | —                                    | —               | —          |
| 11  | Cleanup                      | pending     | —                 | —                                    | —               | —          |

Status values: `pending` → `in-progress` → `done`. Per-chunk plans live at `docs/superpowers/plans/redesign-chunk-NN-<surface>-plan.md`.

## Next up

**Chunk 1 — Foundation.** Token + theme foundation (spec §2) and Vercel beta deployment setup (beta.weekly-eats.zamilyfam.com). The interim server-side `token.isApproved` check (#83) is being done **in parallel** on branch `fix/83-unapproved-users-access-issue` — Chunk 1 should **verify it landed via `main`** (merge main, confirm the middleware check + test exist) rather than re-implementing it. Start each chunk with a just-in-time `writing-plans` pass → `docs/superpowers/plans/redesign-chunk-01-foundation-plan.md`. Chunk 1 is NOT in the review-plan set (only chunks 3–5 are).

Baseline is established: full suite green (1306 tests / 125 files), `redesign-chunk-00` tagged. Per-chunk `review-code` should override base to `redesign-chunk-00` so it only reviews the new chunk's diff.

## Decisions & carryovers

Dated entries for things decided mid-flight that affect later chunks but aren't worth a spec rewrite.

- **2026-05-28 — A11y scope deferred (from `/review-plan`).** Consciously skipped for this single-family app, do not re-litigate: dark-mode muted-text contrast retune (`text.muted` #5b6170 / `text.past` #7b818f are sub-AA on dark surfaces by deliberate design choice), broad keyboard/focus rework for new surfaces, `@dnd-kit` `KeyboardSensor` for shopping reorder, mobile nav `aria-current`. **Kept:** accessible names on icon-only buttons (cheap, enforced by review-code each chunk).
- **2026-05-28 — Beta approval gating.** Approval is client-only today (`middleware.ts` checks only `if (!token)`). Chunk 1 adds an interim server-side `token.isApproved` check in `middleware.ts` before the public beta goes live; Chunk 2's `AuthenticatedLayout` rewrite must not drop the client gate mount (test it).
- **2026-05-28 — Golden-master targets corrected (Chunk 0).** Only genuinely pure transforms get golden-master fixtures; `meal-plan-utils` overlap/next-date is the real target. The three sharing/shopping `*-utils` are async fetch wrappers → MSW path coverage instead. See spec §6 0c.
- **2026-05-28 — Chunk 0 closed.** Baseline green (`npm install` + `npm run check`: 1306 tests / 125 files). `tsconfig.json` now excludes `docs/` so the vendored design bundle isn't type-checked by `next build`. audit-debt sweep saved to `docs/debt-audit-2026-05-28.md` (58 findings). **Fixed in 0c** (behavior-preserving): Critical Ably token leak (now session-gated + capability scoped to the user's stores), 3× `ObjectId.isValid` guards, 2× mass-assignment allowlists (recipes/[id] PUT, user/settings POST), + data-layer test backfill (utils golden-master/MSW, 14 sharing/store route tests). **Backlog filed as issues #76–#86** (npm advisories, sharing-utils dup, a11y, monolith→Chunk 5, server-side approval→Chunk 1). `redesign-chunk-00` tag = the green base for Chunk 1's review-code override.
- **2026-05-28 — `next` high-severity npm advisory open (issue #76).** Dependency bumps were deliberately deferred in Chunk 0 (§0d triages, doesn't fix). Worth revisiting before the public beta deploy in Chunk 1.
- **2026-05-28 — #83 (server-side approval) reverts to Chunk 1 ownership.** The parallel fix never materialized: no `fix/83-*` branch (local or remote), no open PR, no approval commits on `main`, issue #83 still OPEN, and `src/middleware.ts` still only checks `if (!token)`. So Chunk 1 implements the interim server-side `token.isApproved` (+`isAdmin`) gate in `middleware.ts` as spec §1 originally specified — verified there is nothing to back-merge. Close #83 when Chunk 1's gate + tests land.
- **2026-05-28 — Chunk 0 hardening shipped to `main` separately (PR #87).** Extracted the 5 hardening commits onto `chunk-0-hardening` (off `main`), merged as #87 (squash), then back-merged `main` into this branch (merge commit `8fddab2`, clean no-op since the content was identical). The redesign-planning docs (spec, bundle, ledger) stayed on this branch only. Branch deleted local+remote. **Implication:** server-side approval (#83) is now being handled on its own branch in parallel — don't duplicate it in Chunk 1.
