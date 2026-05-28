# Weekly Eats — Design Redesign Migration

**Date:** 2026-05-28
**Branch:** `claude-design-redesign`
**Status:** Approved design; ready for implementation planning

---

## Summary

Migrate the Weekly Eats app to a complete dark-first visual + interaction redesign delivered as a Claude Design handoff bundle (`weekly-eats-redesign`). The redesign covers all eight app surfaces plus nav chrome and a design-system token set. It is **purely visual + interaction** — no schema changes, no new collections, no new API endpoints. Every surface maps to existing model fields (verified in the bundle's HANDOFF against `src/types/`).

Work happens on a long-lived `claude-design-redesign` branch deployed to a beta subdomain for dogfooding, landing surface-by-surface, with a test-hardening phase first. The branch merges to `main` as a single squash at the end.

---

## Goals

- Recreate the redesign pixel-faithfully in the existing Next.js 15 / React 19 / MUI v7 stack.
- Preserve all current behavior in the data layer (utils, API routes, hooks) — no logic drift.
- Keep the suite green at every chunk boundary; strengthen the data-layer safety net before starting.
- Ship incrementally to a beta deployment so the redesign can be used in a real environment as it lands.

## Non-goals (locked)

- `FoodItem.category` and grouped-by-category views (Pantry / Food Items render flat).
- Default-meal-plan-owner setting (dropped per product decision).
- Privacy / Terms / Contact links in the landing footer.
- Pricing, testimonials, or product screenshots in the marketing hero.
- Light mode (dropped for now — plumbing preserved, see §2).
- Any schema or API change.

---

## 1. Migration architecture & beta deployment

### Branch lifecycle

- `claude-design-redesign` stays open until the redesign is complete and signed off via the beta deployment.
- **Direct commits to the branch** — no per-chunk sub-PRs. One long-lived **draft PR** (`claude-design-redesign → main`) is opened at the start of Chunk 1 as the vehicle for CI, per-chunk manual-test comments, and the eventual merge. It stays in draft until the end.
- Merge `main` → `claude-design-redesign` between chunks (whenever main moves) to keep the final merge tractable. Resolve conflicts toward the redesign (those files are being rewritten anyway).
- Final integration: one squash merge of the draft PR into `main`, closing the branch.

### Beta deployment (Vercel, branch alias)

- Add `beta.weekly-eats.zamilyfam.com` in Vercel → Project Settings → Domains; set its Git Branch to `claude-design-redesign`. Every push to the branch deploys and updates the beta domain.
- DNS: CNAME `beta` → Vercel at the `zamilyfam.com` registrar.

### Environment variables (beta deployment)

- `NEXTAUTH_URL=https://beta.weekly-eats.zamilyfam.com` (must match origin or auth callbacks 404). Scope to the branch via Vercel's Preview-environment branch filter.
- `MONGODB_URI` — **shared prod DB** (see safety rails below).
- `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ABLY_API_KEY` — same as prod.

### Google OAuth (one-time)

On the existing OAuth client (Google Cloud Console → Credentials), **before the first beta deploy**:

- Add Authorized JavaScript origin: `https://beta.weekly-eats.zamilyfam.com`
- Add Authorized redirect URI: `https://beta.weekly-eats.zamilyfam.com/api/auth/callback/google`

Same client → same users → same approval status (shared DB).

### Ably

No config change. Same key; channels are user-scoped already.

### CI

Add `claude-design-redesign` to the GitHub Actions workflow's branch triggers so lint + test run on pushes / the draft PR the same way they do for `main`.

### Shared-DB safety rails

Beta reads/writes the **production** database. Destructive paths to watch: shopping-list "Finish shop" (writes purchase history, can clear list), pantry delete, food-item delete (incl. the new `+ Add` reuse), recipe delete, meal-plan delete.

**Rule:** the redesign is visual + interaction shell only. **Do not restructure write logic.** Underlying mutations call the same APIs in the same shapes. Smoke-test destructive paths on each beta deploy.

### Beta access gating (server-side approval check)

Approval gating today is **client-side only**: `src/middleware.ts` only checks `if (!token)`, and data API routes check `session.user.id` but never `isApproved`. The sole barrier keeping an authenticated-but-unapproved Google account off real data is the client-side `useApprovalStatus` hook rendered from `AuthenticatedLayout.tsx` — which Chunk 2 rewrites. On a **public beta against the shared prod DB**, any Google account can sign in, and a direct API call with a valid session cookie bypasses the client gate.

Mitigation (lands in Chunk 1 one-time setup, independent of the layout rewrite): add an interim **server-side check in `src/middleware.ts`** reading `token.isApproved` (already cached in the JWT) and redirecting unapproved users to `/pending-approval`. Additionally, treat the client approval-gate mount as load-bearing with a test so the Chunk 2 `AuthenticatedLayout` rewrite can't silently drop it.

---

## 2. Token + theme foundation

### Tokens

New `src/lib/design-tokens.ts` — canonical source for the values in the bundle's `design-system.md` (surfaces, text, border, section accents, semantic states, meal domain colors, spacing, radii, shadows). Dark values only (light dropped). Importable directly for cases that don't map cleanly to MUI palette keys (per-section accents, meal colors).

**Precedence rule (avoid token/palette drift):** the MUI palette is the _derived_ surface — components consume the section accent via `palette.primary` (rebound per section, below), not by importing `tokens.section.*` directly. Direct token imports are reserved for values with no palette home (meal colors, spacing/radii/shadow constants). This keeps a single resolution path for the section accent.

Token groups (dark):

- `surface`: base `#0f1115`, raised `#181b21`, elevated `#1e222a`, sunken `#141619`, sheet `#1a1e26`
- `text`: primary `#e7e9ee`, secondary `#9097a6`, muted `#5b6170`, past `#7b818f`
- `border`: subtle `rgba(255,255,255,0.07)`, strong `rgba(255,255,255,0.13)`
- `section`: plans `#7aa7ff`, shop `#6fcf97`, recipes `#e8a86b`, pantry `#c79bff`
- `accentUtility`: `#9aa4b3` (Food Items, Settings, User Management)
- `state`: success `#8edcb4`, danger `#e87a8a`, warn `#f0c674` (+ muted variants)
- `meal`: breakfast `#e8c97a`, lunch `#8edcb4`, dinner `#f0a08a`, staples `#c4a7e7`
- `space`: 4/8/12/14/16/18/22/24/32
- `radius`: 4/6/8/10/12/14/16/18/999
- `shadow`: soft / card (today halo) / sheet / modal

### Theme bridge

Rewrite `src/lib/theme.ts` to map tokens onto MUI's palette: `background.default` ← `surface.base`, `background.paper` ← `surface.raised`, `text.*` ← token text, `divider` ← `border.subtle`, `primary.main` ← `section.plans` (default; rebound per section), `success`/`error`/`warning` ← state tokens. Update `MuiButton` / `MuiCard` / `MuiPaper` / `MuiAppBar` overrides to consume tokens.

**Preserve the `responsiveDialogStyle` export** — `theme.ts` currently exports it and it has 16 consumers. The rewrite must keep it (retokenized) so those call sites don't break; it's not just a palette change.

### Per-section accent plumbing

Each top-level surface knows its section. A thin `<SectionThemeProvider section="plans">` rebinds `palette.primary.main` to that section's accent, so MUI components using `color="primary"` resolve correctly. System pages bind `accentUtility`. Verify SSR has no hydration mismatch (emotion is already wired via `@mui/material-nextjs`).

**Nesting constraint:** the per-feature `layout.tsx` files are server components that `export const metadata`. A client `ThemeProvider` cannot _be_ the layout module (client components can't export `metadata`). So `SectionThemeProvider` (a client component) wraps `{children}` **inside** each server layout — the layout stays a server component and renders `<SectionThemeProvider>{children}</SectionThemeProvider>`.

### Drop light mode (plumbing preserved)

- `theme.ts` exports a single `darkTheme` (no `mode` branching for now), but keep the function shape so re-adding light is a tokens-only change.
- `src/lib/theme-context.tsx` simplifies to always-dark, no toggle.
- `User.theme` field left intact (no schema change).
- `ThemeColorMeta` hard-codes the dark surface color.
- Theme toggle UI removed. The **Settings route stays** (`src/app/settings/page.tsx`) rendering a placeholder ("Nothing to settle right now — light mode will return"); direct URL still works. The **avatar menu omits the Settings link** until a real setting returns.
- Clean up the now-orphaned theme-toggle wiring (the `themeChange` event / `/api/user/settings` write path) when the toggle goes — don't leave dead event coupling behind.

### Typography

Load via `next/font/google` in `src/app/layout.tsx`:

- Display: Bricolage Grotesque (weights 500/600/700) → `--font-display`
- Body: Outfit (weights 400/500/600/700) → `--font-body`

`theme.ts` references the CSS vars. The `design-system.md` scale (`display.xl`…`label.xs`) becomes MUI typography variant overrides plus a few custom variants via module augmentation. Tabular-nums via a `MuiTypography` global override on numeric variants.

### Icons

Material Symbols Outlined webfont via `next/font/google`. New `src/components/ui/Icon.tsx` wraps `<span className="material-symbols-outlined">`, exposing `name`, `size`, `color`, `fill`, `weight`. Ligature names match `@mui/icons-material` import names 1:1 (snake_case ↔ PascalCase). Migrate call-site by call-site (`<KitchenIcon />` → `<Icon name="kitchen" />`); keep `@mui/icons-material` installed until the cleanup chunk.

**Accessible-names rule (don't regress on the swap):** the ligature renders as text content, which screen readers would announce. So `Icon` defaults to `aria-hidden` and decorative by default; **icon-only buttons must supply their own accessible name** (`aria-label` on the button/`IconButton`, not the `Icon`). The previous `@mui/icons-material` SVGs were already `aria-hidden` with labels on the buttons, so this preserves parity rather than adding burden. `review-code`'s `a11y-reviewer` enforces accessible names on icon-only controls each chunk, catching any call-site that loses one during migration.

### TypeScript

Module augmentation in `src/types/mui.d.ts` for custom palette keys (`section`, `mealColor`, `accentUtility`) and custom typography variants.

---

## 3. Nav chrome

`nav-chrome.jsx` in the bundle is canonical. New files under `src/components/nav/`:

- `TopNav.tsx` — desktop top bar: AppIcon + "Weekly Eats" wordmark (Bricolage 18/700) left; 4 section buttons (icon + label, 50px tall, 2.5px bottom-border in section color when active); avatar+name pill right (opens dropdown).
- `BottomNav.tsx` — mobile bottom bar, 4 slots: **Plans / Shop / Recipes / Avatar**. **Pantry is NOT a slot** — it lives in the avatar menu. Active slot uses section color on icon + label. Avatar slot opens a bottom sheet.
- `AppIcon.tsx` — BM-α SVG (bowl + four colored meal blocks). `squircled` prop adds the black-squircle background (marketing/home); logomark (no squircle) in nav.
- `NavAvatar.tsx` — initials avatar.
- `AvatarMenu.tsx` — menu: Pantry (mobile only), Manage food items (`/food-items`), Manage users (`/user-management`, admin-only via `session.user.isAdmin`), Sign out. **No Settings link.**

**Active-section detection** via `usePathname()`: `/meal-plans/*`→plans, `/shopping-lists/*`→shop, `/recipes/*`→recipes, `/pantry/*`→pantry. System sub-pages → no active section; avatar shows active. This logic is consumed by `TopNav`, `BottomNav`, `AvatarMenu`, and `SectionThemeProvider` — collapse it into a **single shared `getSectionForPath` helper + `useActiveSection` hook** rather than re-deriving it in each (it's already duplicated twice today in `Header.tsx`/`BottomNav.tsx`).

All new `nav/*` and `ui/Icon` files use **named exports** (per CLAUDE.md) — the `Header.tsx`/`BottomNav.tsx` files being replaced use `export default`; don't carry that pattern forward.

`AuthenticatedLayout.tsx` rewires to render `TopNav` (desktop) / `BottomNav` (mobile) with the derived section. Old `Header.tsx` and `src/components/BottomNav.tsx` are removed; per-page headers (title + accent-colored count + back) become inline in each surface.

OS-level icons (`public/web-app-manifest-*.png`) stay as-is.

**Interim state:** nav lands before surfaces, so beta shows new chrome wrapping old screens for a few days — accepted.

---

## 4. Surface migration order & scope

Each chunk is its own set of commits direct to the branch. Order: foundations first, riskiest interaction rewrites once component vocabulary exists.

| #   | Chunk                            | Key touches                                                                                                                                                                                                                                   | Notes                                                                                                                                                                                                   |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | **Test baseline + hardening**    | See §6                                                                                                                                                                                                                                        | Green baseline, audit-debt sweep, data-layer hardening. No UI.                                                                                                                                          |
| 1   | **Foundation**                   | `theme.ts`, `design-tokens.ts`, `theme-context.tsx`, font/icon loaders, `ThemeColorMeta`, `mui.d.ts`, `Icon`, settings placeholder, light-mode removal; open draft PR; `review-code` base-override extension; CI branch trigger; local dev DB | Existing screens render with new tokens/fonts (will look rough — expected).                                                                                                                             |
| 2   | **Nav chrome**                   | `nav/*`, `AuthenticatedLayout`, remove old `Header`/`BottomNav`, avatar menu                                                                                                                                                                  | New chrome on every page.                                                                                                                                                                               |
| 3   | **Meal Plans**                   | `src/app/meal-plans/*`, `MealEditor`, `IngredientGroup`, `IngredientInput`, `MealPlanBrowser`, `MealPlanCreateDialog`, `MealPlanViewDialog`                                                                                                   | B3 editor rewrite (see edit-decisions below), desktop today-hero + week strip, TODAY sliver, staples bar. Largest chunk.                                                                                |
| 4   | **Recipes**                      | `src/app/recipes/*`, `RecipeEditorDialog`, `RecipeFilterBar`, `RecipeIngredients`, `RecipeInstructionsView`, `RecipeSharingSection`, `RecipeStarRating`, `RecipeTagsEditor`, `RecipeViewDialog`                                               | Full-page recipe view on desktop (was 980px modal — routing change), per-invitee share toggles, inline prep instructions.                                                                               |
| 5   | **Shopping Lists**               | `src/app/shopping-lists/*`, `src/components/shopping-list/*`                                                                                                                                                                                  | Two-pane desktop route (sidebar + working list, no modal), presence pill, KEEP/SKIP toggle in pantry check, solid finish-shop bar, flat emoji picker. Visual only on realtime/presence — no API change. |
| 6   | **Pantry**                       | `src/app/pantry/*`                                                                                                                                                                                                                            | Lavender accent, trash icons, flat list.                                                                                                                                                                |
| 7   | **Food Items**                   | `src/app/food-items/*`, `AddFoodItemDialog` (visual)                                                                                                                                                                                          | Cool-slate utility accent; `+ Add` header reuses `AddFoodItemDialog`; filter UI.                                                                                                                        |
| 8   | **User Mgmt & Pending Approval** | `src/app/user-management/*`, `src/app/pending-approval/*`                                                                                                                                                                                     | Color-tinted action chips; personalized pending greeting.                                                                                                                                               |
| 9   | **Settings (placeholder)**       | `src/app/settings/*`                                                                                                                                                                                                                          | Placeholder per §2.                                                                                                                                                                                     |
| 10  | **Marketing / signed-out home**  | `src/app/page.tsx`                                                                                                                                                                                                                            | Dark hero, hero feature card, beta badge, trimmed footer.                                                                                                                                               |
| 11  | **Cleanup**                      | remove `@mui/icons-material` once unused; delete dead light-mode + old components                                                                                                                                                             | One commit.                                                                                                                                                                                             |

**Cross-cutting (done within each surface chunk, not separately):** the section `SectionThemeProvider` (chunks 3–6), incremental icon migration, page title + accent count treatment, dialog→full-page recipe conversion (chunk 4).

**Recipe dialog → full-page route (chunk 4 — the one real routing change).** Target shape: `src/app/recipes/[id]/page.tsx` (async params per Next 15) with its own `loading.tsx` + `error.tsx`. This replaces the current query-param deep-link mechanism (`usePersistentDialog('viewRecipe')`); the chunk must migrate that mechanism and handle **old `?viewRecipe=<id>` URLs** (redirect to the new path) so existing links and any beta-user bookmarks don't break.

### Locked meal-plan edit-flow decisions (B3)

Full-screen editor, numpad qty, sticky combined search at bottom, flat group headers (no nesting box). Resolved decisions:

1. Validation: Done disabled + inline warn borders + helper text. No banner.
2. Cancel when dirty: confirm dialog ("Discard changes?"); clean cancel closes immediately.
3. Per-meal notes: dropped (no UI; schema field untouched).
4. Recipe ×qty: `[× 2]` inside the chip; no outside label.
5. Skip toggle: always available; toggling on with items present prompts "Skip will clear N items"; toggling off leaves the meal empty.
6. Empty states: "No ingredients in this group" / "No items planned" + faint Add hint.
7. Remove-group: ✕ in group header → confirm dialog ("Remove group? N items will be removed.").
8. Group container: flat section headers always; items are siblings; no enclosing box.

### Per-chunk test lists for the rewritten flows (chunks 3–5)

The standing "rewritten components get rewritten tests" rule (§6 0e) is not enough for the three interaction-heavy rewrites — enumerate the cases so coverage doesn't lean on manual testing alone:

- **Chunk 3 — B3 meal-plan editor:** one test per locked edit-decision above — Done-disabled + warn borders on invalid (1), dirty-cancel confirm vs clean-cancel close (2), recipe `[× n]` chip qty (4), skip toggle clear-confirm + empty-on-untoggle (5), empty-group / empty-meal states (6), remove-group confirm (7), flat group structure (8). Plus staples bar expand/collapse and numpad qty entry.
- **Chunk 4 — recipe full-page route:** `loading.tsx` / `error.tsx` render, async-params resolution, deep-link to `/recipes/[id]`, and the old `?viewRecipe=` redirect path.
- **Chunk 5 — two-pane shopping:** store-pane ↔ working-list selection, KEEP/SKIP pantry-check filtering, finish-shop bar behavior. (Realtime/presence stays visual-only — no new logic tests.)

---

## 5. End-of-chunk loop

One-time setup is folded into Chunk 1: open the draft PR; extend `review-code` to accept a base-ref override (it currently hardcodes `main`/PR-base) without disturbing its `--post` / `--review-only` / loop paths; establish the `redesign-chunk-NN` tag convention; add the CI branch trigger; point local `.env.local` at a dedicated local dev DB (e.g. `weekly-eats-redesign-local`) so `manual-testing` seeds there, never prod.

Per chunk, in order:

1. **Implement** the chunk in logical commits. `npm run check` green locally.
2. **`review-code` (auto-fix loop), scoped to this chunk** — base = previous chunk tag (`redesign-chunk-(N-1)...HEAD`; Chunk 1 = `main...HEAD`). Review → triage → fix → re-review, committing fixes locally until no Critical/Important findings remain. Judgment calls surface via the skill's intervention prompts.
3. **`npm run check`** again after review fixes.
4. **`manual-testing`, per-chunk slot** (`chunk-NN-<surface>`) — reads CATALOG, analyzes the chunk diff, picks/creates scenario blocks, seeds the **local dev DB**, posts a **new** checklist comment (distinct slot marker) to the draft PR. New scenario blocks/manifests get committed.
5. **Push** → CI runs on the draft PR; Vercel deploys to beta.
6. **Execute the chunk-qualification plan locally** — localhost + local dev DB, via the `verify` skill / Chrome, checking off the PR checklist. **This is the gate, not beta.**
7. **Fold fixes** found during manual testing into the chunk; if substantial, re-run `review-code` (step 2) on the new delta.
8. **Tag** `redesign-chunk-NN` once the checklist passes — this becomes the next chunk's review base.
9. **Merge `main` → branch** (if main moved).
10. **Compact context** (see §9) — write a one-paragraph handoff, then compact; the next context starts clean and re-reads the spec + plan.

**Definition of done (per chunk):**

- `review-code` auto-fix loop exited clean (no Critical/Important remaining, or remaining ones explicitly skipped).
- `npm run check` green.
- Manual-test plan posted as its own slot comment **and** executed locally with the checklist passing.
- Chunk tagged `redesign-chunk-NN`.
- CI green on the draft PR.

**Beta (prod DB):** updated on every push for real-world dogfooding. Not a chunk gate; issues found there feed back as fixes into the current or a later chunk.

**Chunk 0 exception:** no UI to manually test → it runs the loop without step 4/6 (manual-testing), but still gets `review-code`, `npm run check`, a tag (`redesign-chunk-00`), and compaction.

**Rollback:** if a chunk breaks beta and can't be quickly fixed, roll the Vercel beta alias back to the prior deploy (one click), then push a revert commit. `main` is untouched throughout, so prod _deploys_ are never affected. **Caveat:** alias rollback reverts the running code, not data already written to the shared prod DB — the "no write-logic changes" rule (a discipline rule, not an enforced guarantee) is what keeps that blast radius near zero, so honor it strictly and lean on the destructive-path smoke tests.

---

## 6. Chunk 0 — test baseline + data-layer hardening

Runs before Foundation. Establishes the safety net before any pixel changes.

- **0a — Green baseline (blocker).** `npm install` (this workspace has no `node_modules`), then `npm run check`. Fix or de-flake **everything** red until fully green — fix root causes, don't tolerate flakiness. This is the trustworthy starting point.
- **0b — One `audit-debt` sweep.** Run `/audit-debt` on the pre-redesign codebase; save the report to `docs/debt-audit-2026-05-28.md` as a living backlog. Its `test-reviewer` flags untested files (API routes, `lib/` utils), low-coverage paths, and weak assertions — the lens we want on the older suite.
- **0c — Act now (test-first, justified-only):**
  - Test-dimension findings worth acting on (weak assertions, untested data-layer files, low-coverage critical paths).
  - Data-layer hardening: backfill coverage on `lib/` utils, API routes, hooks — the behavior-preserving layer.
  - **Golden-master fixtures — only for genuinely pure transforms.** Correcting the target list:
    - `meal-plan-to-shopping-list` and `unit-conversion` are pure but **already have ~20 and ~22 `it` blocks** — only add golden-master fixtures if they capture input/output combinations the existing assertions don't; otherwise skip.
    - `meal-plan-utils` overlap/next-date logic (incl. the unexercised skip-advance loop) is the genuinely **under-tested pure transform** — add it, using `vi.setSystemTime` for determinism. This is the highest-value golden-master target.
    - `shopping-list-utils`, `recipe-sharing-utils`, `meal-plan-sharing-utils` are **async `fetch` wrappers, not pure transforms** — golden-master doesn't fit. Cover them with **MSW success/error-path tests** (the pattern `shopping-list-utils.test.ts` already uses). Note the merge/conflict logic actually lives in `meal-plan-to-shopping-list.ts`, not `shopping-list-utils`.
  - Cheap Critical security wins the audit surfaces (e.g. a missing `userId` filter — see also the server-side approval check in §1).
- **0d — Non-goals (keep Chunk 0 from ballooning):**
  - **No new tests for UI being replaced** (`MealEditor`, shopping components, `RecipeViewDialog` interaction tests, etc.). audit-debt will flag these as untested; consciously skip — replacements get fresh tests in their chunks.
  - **Non-test debt is triaged, not fixed here** (architecture refactors, a11y on soon-replaced UI, dep bumps, doc drift) — saved to the backlog doc, optionally filed as issues, pulled from opportunistically or scheduled separately.
- **0e — Standing rule for later chunks:** each chunk adds/updates tests for the code it changes — new flows get new tests, rewritten components get rewritten tests, the untouched data layer stays green. `review-code`'s `test-reviewer` enforces this per chunk. **Ordering:** within a chunk, delete the old component's tests and add the replacements in the same chunk — never ship an interactive component with stale tests (asserting gone behavior) or zero tests mid-rewrite.
- **0f — Close:** `review-code` (base `main`), `npm run check` green, tag `redesign-chunk-00`, compact.

### Test setup reference

- Vitest + React Testing Library + MSW; jsdom; forks pool, single fork, isolated (`vitest.config.ts`).
- No coverage thresholds enforced (reporting only) — but the full suite must pass for `npm run check`.
- 80 test files at baseline; 24 components import `@mui/icons-material`; ~7 test files query by icon/testId/aria-label (so the icon swap breaks little directly).
- Conventions (CLAUDE.md): colocated `__tests__/`, `userEvent.setup()`, `waitFor()`, mock next-auth + mongodb, include ALL error-constant groups when mocking `@/lib/errors`, `vi.stubGlobal('fetch', …)` not module-scope assignment.
- No DOM snapshot tests for redesigned components — behavioral assertions only.

---

## 7. Risks & mitigations

| Risk                                        | Mitigation                                                                                                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared prod DB + destructive paths          | Visual/interaction shell only; no write-logic changes; smoke-test destructive paths each deploy.                                                                                                                                                  |
| Public beta + client-only approval gating   | Add interim server-side `token.isApproved` check in `middleware.ts`; test the client gate mount (see §1 "Beta access gating").                                                                                                                    |
| OAuth breaks on first beta sign-in          | Register beta origin + callback URI and set `NEXTAUTH_URL` before first beta deploy.                                                                                                                                                              |
| Long-lived branch drift                     | Merge `main` → branch between chunks; resolve toward redesign.                                                                                                                                                                                    |
| Mixed-look interim on beta                  | Accepted; beta is for dogfooding.                                                                                                                                                                                                                 |
| Icon name mismatch (no 1:1 Material Symbol) | Spot-check each migrated icon; keep `@mui/icons-material` until cleanup chunk.                                                                                                                                                                    |
| Font load / layout shift                    | `next/font/google` self-hosts + handles `font-display`; confirm weights resolve.                                                                                                                                                                  |
| Light-mode removal regressions              | Keep `theme-context`, `User.theme`, mode-shaped theme fn; force dark; hide toggle + menu link.                                                                                                                                                    |
| Per-section nested ThemeProvider (SSR)      | Thin palette overrides at route-layout level; verify no hydration mismatch.                                                                                                                                                                       |
| Recipe view dialog → full page              | Verify deep links, browser back, `loading.tsx`/`error.tsx`.                                                                                                                                                                                       |
| `review-code` base-override extension       | Surgical change; don't disturb other paths.                                                                                                                                                                                                       |
| `manual-testing` seeding wrong DB           | Primary safeguard is `.env.local` → dedicated `weekly-eats-redesign-local`. The CLI main-DB refusal is only a conditional backstop (keys off a remote URI or the name `weekly-eats`; a localhost prod clone could slip it) — don't over-trust it. |
| Tests drift from rewritten UI               | Tests rewritten within the same chunk; data-layer tests stay green untouched.                                                                                                                                                                     |

---

## 8. Architecture & data model

No schema, collection, or API changes. Surface → existing model mapping (from the bundle's HANDOFF, audited against `src/types/`):

| Surface                                      | Shows                                                                    | Backing model                   |
| -------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------- |
| Recipes — tags + stars                       | per-user tags, optional rating                                           | `RecipeUserData`                |
| Recipes — per-invitee Tags + Ratings sharing | `shareTags`/`shareRatings`, `sharingTypes`                               | existing `RecipeSharingSection` |
| Recipes — groups, prep instructions          | `ingredients: RecipeIngredientList[]`, per-ingredient `prepInstructions` | `Recipe`                        |
| Pantry — flat checklist                      | per-user `foodItemId`                                                    | `PantryItem`                    |
| Food Items — Private/Shared                  | `isGlobal` + sharing relationships                                       | FoodItem + sharing              |
| Shopping — drag-reorder                      | per-store float `position`                                               | `StoreItemPosition`             |
| Shopping — finish shop                       | one record per item per trip                                             | `PurchaseHistoryRecord`         |
| Shopping — sharing + presence                | `Store.invitations[]`, `useShoppingSync` states + `activeUsers`          | existing                        |
| Shopping — pantry check (KEEP/SKIP)          | client filter: `PantryItem.foodItemId` ∩ `ShoppingListItem.foodItemId`   | existing, no new field          |
| Meal plans — B3 edit                         | `MealPlan` (template, staples, day/meal)                                 | existing                        |
| Settings — theme                             | `User.theme`                                                             | existing (UI hidden)            |
| Users + pending approval                     | `User.approvalStatus`, `User.isAdmin`                                    | existing                        |

---

## 9. Context management across chunks

**Principle: no critical state lives only in conversation context.** Durable artifacts that allow any chunk to resume cold:

- this spec
- the implementation plan (written next via writing-plans)
- git tags `redesign-chunk-NN` (chunk boundaries + review bases)
- the draft PR's per-chunk manual-test comments
- the audit backlog (`docs/debt-audit-2026-05-28.md`)

Because of this, the conversation is compacted at each chunk boundary (step 10 of the loop): write a one-paragraph handoff (chunk just finished, next chunk, branch/tag state, pointers to spec + plan), then compact. The next context starts clean and re-reads the spec + plan.

**Mid-chunk safety:** `review-code` and `audit-debt` are compaction-resumable by design — they re-read their session-dir `meta.json` + round artifacts from disk. The boundary handoff note covers the implementation work, which lacks that built-in.

**Why manual compaction at boundaries:** deterministic clean breaks at a tagged, pushed, green seam beat an auto-compaction firing mid-edit.

---

## Open question for the implementer

- **Light-mode contrast pass** — deferred. When light mode returns, the `design-system.md` light values need a contrast audit before shipping.
