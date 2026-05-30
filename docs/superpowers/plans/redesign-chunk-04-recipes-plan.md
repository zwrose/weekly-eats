# Chunk 4 — Recipes Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Recipes surface to the dark-first redesign — a redesigned list (dark cards/table + chip filter bar + sharing button), a **full-page recipe view route** `/recipes/[id]` (replacing the old `?viewRecipe=` query-param dialog), a full-page recipe **editor takeover** (create + edit) with grouped ingredients, inline prep instructions, per-recipe tags + star rating, a redesigned **sharing sheet/dialog** with per-invitee tags/ratings toggles, a flat **emoji picker**, and **re-added tap-a-recipe-to-open** navigation from meal plans (in-PWA `router.push`).

**Architecture:** The recipe _view_ becomes a **real route** — `src/app/recipes/[id]/page.tsx` (with its own `loading.tsx` + `error.tsx`) and a **`‹ Recipes` back button** — the one routing change the spec (§4) names. The list (`/recipes`) navigates to `/recipes/<id>` (`router.push`); the old `?viewRecipe=true&viewRecipe_recipeId=<id>` deep-links **redirect** to the new path. The **editor is a full-page in-page takeover** (a `RecipeEditor` component rendered _in place of_ the list or the detail's read body — NOT a MUI Dialog, NOT a new route), matching the artboards' full-page edit takeover and honoring the spec's "view is the **one** real routing change." Create mounts on the list (`+ New`); edit mounts inside `RecipeDetail` (`✎ Edit`). All recipe mutations call the **same** existing APIs in the same shapes (`createRecipe` / `updateRecipe` / `deleteRecipe`, `updateRecipeTags` / `updateRecipeRating` / `deleteRecipeRating`, the recipe-sharing utils) — **no write-logic changes** (spec §1). Tapping a recipe inside a meal-plan editor row navigates client-side via `router.push('/recipes/<id>')` — never `window.open` / `target="_blank"` (spec §4 PWA constraint).

**Tech Stack:** Next.js 15 App Router (async route params), React 19, MUI v7 (`sx` + `tokens` from `@/lib/design-tokens`), `Icon` (Material Symbols) from `@/components/ui/Icon`, `react-markdown` + `remark-gfm` (instructions), Vitest + RTL + MSW. Section accent = `palette.primary` (already rebound to recipes-orange `#e8a86b` centrally by `SectionThemeProvider` in `AuthenticatedLayout` — **do NOT re-wire it**; consume `color="primary"` / `theme.palette.primary.main`, or `tokens.section.recipes` for non-palette spots).

---

## Design references (read before implementing)

| Reference                                                        | What it locks                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/design/weekly-eats-redesign/project/artboards-recipes.jsx` | **The canonical reference.** All recipe surfaces: mobile + desktop list, view, edit, sharing sheet/dialog, emoji picker. Inline-styled mockups — translate literal hex/px to `tokens.*` + `sx`.             |
| `…/design-system.md`                                             | Token values (surfaces, text, border, `section.recipes` `#e8a86b`, state colors, radii, spacing).                                                                                                           |
| `…/HANDOFF.md` §"Recipes"                                        | Field→model mapping (tags+stars ← `RecipeUserData`; per-invitee sharing ← `RecipeSharingSection`; groups+prep ← `Recipe`).                                                                                  |
| `docs/superpowers/plans/redesign-chunk-03-meal-plans-plan.md`    | **The pattern precedent** — the `[id]` route shape, `loading`/`error` conventions, `ConfirmDialog`, sheet/dialog responsive pattern (`ShareMealPlansDialog`), tokens usage, the color-map convention below. |

**The artboards are inline-styled mockups.** Translate their literal hex/px to `tokens.*` + MUI `sx`. Color map (mockup `C.*` → token):

| Mockup `C.*` | Hex                      | Token                                                                                     |
| ------------ | ------------------------ | ----------------------------------------------------------------------------------------- |
| `bg`         | `#0f1115`                | `tokens.surface.base`                                                                     |
| `paper`      | `#181b21`                | `tokens.surface.raised`                                                                   |
| `paperHi`    | `#1e222a`                | `tokens.surface.elevated`                                                                 |
| `paperPast`  | `#141619`                | `tokens.surface.sunken`                                                                   |
| `sheet`      | `#1a1e26`                | `tokens.surface.sheet`                                                                    |
| `ink`        | `#e7e9ee`                | `tokens.text.primary`                                                                     |
| `dim`        | `#9097a6`                | `tokens.text.secondary`                                                                   |
| `mute`       | `#5b6170`                | `tokens.text.muted`                                                                       |
| `edge`       | `rgba(255,255,255,0.07)` | `tokens.border.subtle`                                                                    |
| `edgeHi`     | `rgba(255,255,255,0.13)` | `tokens.border.strong`                                                                    |
| `accent`     | `#e8a86b`                | `tokens.section.recipes` (or `primary.main`)                                              |
| `accentDim`  | `rgba(232,168,107,0.16)` | **`RECIPE_ACCENT_MUTED`** (Task 1) — NOT `tokens.accent.muted`, which is **blue** (plans) |
| `success`    | `#8edcb4`                | `tokens.state.success`                                                                    |
| `successDim` | `rgba(142,220,180,0.14)` | `tokens.state.successMuted`                                                               |
| `danger`     | `#e87a8a`                | `tokens.state.danger`                                                                     |
| `warn`       | `#f0c674`                | `tokens.state.warn` (★ star color)                                                        |
| `staples`    | `#c4a7e7`                | `tokens.meal.staples` (not used in recipes)                                               |

> Verify the exact token key names in `src/lib/design-tokens.ts` before use (e.g. `state.successMuted` vs `state.dangerMuted`); the chunk-3 components are the source of truth for which keys exist. Where the mockup uses `'#0c1118'` for text-on-accent (the dark ink on the orange primary button), use a literal `'#0c1118'` (it has no token home) — matches chunk-3's primary-button ink.
>
> **`accentDim` has NO token (review-plan fix):** `tokens.accent.muted` is `rgba(122,167,255,0.16)` — the **blue** plans accent, NOT recipe orange. `tokens.section.recipes` (`#e8a86b`) has no muted variant. So Task 1 exports `RECIPE_ACCENT_MUTED = 'rgba(232,168,107,0.16)'` and every recipe component imports it for selected-state backgrounds (filter chips, selected emoji, radio/checkbox rows). Never use `tokens.accent.muted` in recipe components.

---

## Locked architecture decisions (chunk-4 deviations / clarifications — each recorded in the ledger at close)

1. **View = the one real route; edit + create = in-page full-page takeovers (not routes).** Spec §4: "the recipe view dialog → full-page route … the **one real routing change**." So `/recipes/[id]` is a real route; **edit and create are NOT routes** — they render `RecipeEditor` as a full-page takeover of the content area (under the persistent nav chrome), matching the artboards (`DesktopEdit`/`MobileEdit` show TopNav/BottomNav still present, a sticky sub-header, and Cancel/Save — i.e. a takeover, not a centered modal). Create is toggled on `/recipes`; edit is toggled inside `RecipeDetail`. This parallels chunk-3, where the meal editor was a layer over the route rather than its own route.

2. **Old deep-link redirect.** `/recipes?viewRecipe=true&viewRecipe_recipeId=<id>` (and the bare `?viewRecipe=true`) → the list page detects the param on mount and `router.replace('/recipes/<id>')` (or strips it if no id). Preserves beta-user bookmarks (spec §4).

3. **Tap-a-recipe-to-open placement = `EditorItemRow` (meal-plan editor) recipe rows.** Spec §4 (2026-05-29 carryover) requires re-adding tap-to-open with **in-PWA `router.push`**, and flags that read-mode meal taps now open the editor (so the recipe affordance "can't simply wrap the meal row"). Decision: the conflict-free placement is the **editor** — in `EditorItemRow`, a recipe's emoji+name is a tap target → `router.push('/recipes/<id>')`; the qty/unit/remove controls `stopPropagation`. Read-mode `MealItemLine` is left as-is (its whole meal row already opens the editor — adding a nested recipe tap there would be ambiguous). Documented as the chunk-4 placement decision.

4. **Editor qty/unit controls reuse chunk-3's `QtyEditor` + `UnitEditor`** (`src/components/meal-plans/`) — verified value-based (review-plan). Exact props: `QtyEditor` = `{ open, anchorEl, value: number, onCommit: (qty: number) => void, onClose }`; `UnitEditor` = `{ open, anchorEl, value: string, quantity: number, onCommit: (unit: string) => void, onClose }` (note: the callback is **`onCommit`**, not `onChange`, and `UnitEditor` **requires `quantity`** to pluralize via `getUnitForm`). These are surface-agnostic primitives — a cross-folder import is acceptable for this chunk (a later cleanup chunk may relocate them to `ui/`). Recipe ingredient `quantity` is a `number` (fractions allowed, e.g. `0.25`), `unit` a string from `getUnitOptions()`.

5. **Instructions stay markdown.** The artboard view renders instructions as plain pre-wrap text, but the real feature is markdown (`RecipeInstructionsView` uses `react-markdown`+`remark-gfm`, and the editor labels "Markdown supported"). Keep markdown rendering; **retheme only**. The editor's instructions input stays a plain multiline text field (raw markdown), as today.

---

## Deliberate fidelity compromises (document, don't gold-plate)

- **Unit picker is a flat searchable list** (from `getUnitOptions()`), not category headers — same compromise as chunk-3 (the data model has no unit categories; spec non-goal). Reuse chunk-3's `UnitEditor`.
- **Emoji set** uses the **existing `EmojiPicker` food-emoji source** (`FOOD_EMOJIS`), restyled to the artboard's flat grid — NOT the artboard's hard-coded `EMOJI_FLAT` literal (which is a mockup sample). Keep the app's real emoji list + search.
- **List "count" + sharing dot badge** are real: count = `total` from the recipes API; the sharing button's dot shows when `pendingInvitations.length > 0` (today's `Badge`). The artboard's "34 recipes" is sample data.
- **Filter chips** map to the existing filter state (`selectedTags`, `selectedRatings`, sort). The "★ 4+" chip in the artboard is shorthand; keep the existing **multi-select ratings** filter (the model supports `ratings` as comma-separated multi-select) but present it as the artboard's rating chip → a small popover/sheet of 1–5 (or a "4+" quick toggle). Keep it behaviorally identical to today's `RecipeFilterBar` (same emitted `selectedRatings`/`selectedTags`/sort) — **restyle, don't re-spec the filter semantics.**
- **Access radio** (`Personal` / `Global`) maps to `isGlobal` (false/true) exactly as today. Label "Personal" ⇒ `isGlobal=false`; "Global" ⇒ `isGlobal=true`.
- **Sub-recipe ingredients** (`type: 'recipe'`) remain supported in the ingredients editor (the search includes recipes via `useFoodItemSelector({ allowRecipes: true })`); a recipe-type ingredient shows its name (no unit). Self-reference is excluded via `currentRecipeId`.
- **No schema/API change.** Same payloads. The `accessLevel` shown on the view is the server-computed field already returned by the list/detail endpoints.

---

## File Structure

### New — `src/components/recipes/` (the redesigned surface — named exports)

| File                          | Responsibility                                                                                                                                                                                                                                                                                                                                   | Export                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| `recipe-display-utils.ts`     | Pure helpers + shared tiny presentational atoms: `accessLevelMeta(access)` → `{label, color}`; `formatIngredientQty(qty, unit)` (tabular, omit `each`); `recipeIngredientCount(lists)`; `RECIPE_SECTION` accent token ref.                                                                                                                       | named                                      |
| `Stars.tsx`                   | Read/edit star rating (★ `state.warn`; dim empties). Edit: hover preview, click-same-to-clear, `Clear` button. View: shows user rating + optional shared-ratings summary.                                                                                                                                                                        | named `Stars`                              |
| `TagChip.tsx`                 | One read-only tag pill (border + `text.secondary`). `AccessChip.tsx` co-located: access pill (label+color per `accessLevelMeta`).                                                                                                                                                                                                                | named `TagChip`, `AccessChip`              |
| `RecipeTagsEditor.tsx`        | **Rewrite.** Edit-mode tag pills (each with ✕) + `+ Add tag` affordance (autocomplete over the user's existing tags, create-on-Enter). Emits `string[]`.                                                                                                                                                                                         | named `RecipeTagsEditor`                   |
| `RecipeFilterBar.tsx`         | **Rewrite.** Search input + filter chips: `Tags` (→ tag sheet/dropdown), rating chip, `Sort` chip. Emits search/tags/ratings/sort exactly as today.                                                                                                                                                                                              | named `RecipeFilterBar`                    |
| `RecipeInstructionsView.tsx`  | **Retheme.** Markdown (`react-markdown`+`remark-gfm`) → dark tokens.                                                                                                                                                                                                                                                                             | named `RecipeInstructionsView`             |
| `EmojiPicker.tsx`             | **Rewrite.** Flat grid (8-col sheet xs / 10-col dialog md+) + search + `Clear`/`Done`, over `FOOD_EMOJIS`.                                                                                                                                                                                                                                       | named `EmojiPicker`                        |
| `RecipeIngredientsView.tsx`   | Read-mode ingredient display: grouped (uppercase group titles) or flat; qty column (tabular) + name + italic prep. Used by `RecipeDetail`.                                                                                                                                                                                                       | named `RecipeIngredientsView`              |
| `RecipeIngredientRow.tsx`     | **Editor** ingredient row: name (flex) + qty button (→ `QtyEditor`) + unit button (→ `UnitEditor`) + delete; inline `+ prep instructions` → prep text field. Sub-recipe rows hide the unit.                                                                                                                                                      | named `RecipeIngredientRow`                |
| `RecipeIngredientsEditor.tsx` | **Editor** ingredients block: `+ Group` / group cards (`GROUP` label + title field + delete-group + rows + `+ Add ingredient` via combined search) / all-or-nothing group validation / standalone mode. Wraps `useFoodItemSelector`+`useFoodItemCreator`.                                                                                        | named `RecipeIngredientsEditor`            |
| `RecipeEditor.tsx`            | **The editor takeover** (create + edit): sticky header (Cancel / title / Save-disabled-when-invalid), emoji button, Title, Access radios, `RecipeTagsEditor`, `Stars` (your rating), `RecipeIngredientsEditor`, instructions field, Delete (edit only). Dirty→discard confirm. Persists via `createRecipe`/`updateRecipe` (+ tags/rating utils). | named `RecipeEditor`                       |
| `RecipeDetail.tsx`            | **The view route component** (client): `‹ Recipes` back + header (emoji, `Recipe` eyebrow, title, `Stars`, `AccessChip`, tags, `✎ Edit`, `⋯` menu) + two-column `RecipeIngredientsView` / `RecipeInstructionsView`. Fetches recipe + user-data; owns edit mode (renders `RecipeEditor`) + delete-confirm.                                        | named `RecipeDetail`                       |
| `RecipeSharingDialog.tsx`     | **Rewrite.** Responsive sheet (xs) / dialog (md+): pending-invite cards (accept/reject), `What to share` checkboxes, invite-by-email, `Shared with` rows (remove). Same sharing util payloads.                                                                                                                                                   | named `RecipeSharingDialog`                |
| `RecipeRow.tsx`               | List row atoms: `RecipeCardMobile` (mobile card) + `RecipeTableRow` (desktop grid row). Render emoji + title + stars + tags + updated; whole row → `onOpen()`.                                                                                                                                                                                   | named `RecipeCardMobile`, `RecipeTableRow` |

### New — view route `src/app/recipes/[id]/`

- `page.tsx` — server component: `const { id } = await params` (Next 15 async params), renders `<AuthenticatedLayout><RecipeDetail recipeId={id} /></AuthenticatedLayout>`.
- `loading.tsx` — dark skeleton (back button + header + two-column skeleton), **wrapped in `AuthenticatedLayout`** (matches `src/app/recipes/loading.tsx`).
- `error.tsx` — `'use client'` boundary with `reset()`; dark tokens; **NOT** wrapped in `AuthenticatedLayout` (mirror `src/app/recipes/error.tsx` exactly — an `Alert` + "Try Again" → `reset()`).
- `__tests__/loading.test.tsx` + `__tests__/error.test.tsx` — mirror `src/app/recipes/__tests__/{loading,error}.test.tsx`.

### Rewritten — `src/app/recipes/`

- `page.tsx` — list redesign (header + count + sharing button w/ dot badge + `+ New`; `RecipeFilterBar`; desktop table / mobile cards; rows `router.push('/recipes/<id>')`; `+ New` → `RecipeEditor` create takeover; sharing → `RecipeSharingDialog`; **old `?viewRecipe=` redirect**). **Removes** all view/edit dialog plumbing (`usePersistentDialog('viewRecipe')`, `selectedRecipe`/`editMode`/`editingRecipe`, `RecipeViewDialog`, `RecipeEditorDialog`, the whole-page CRUD/user-data handlers that move into `RecipeDetail`/`RecipeEditor`). Keeps the list-level concerns: pagination/sort/filter state, the recipes-user-data batch (for list tags/ratings), sharing-data load.
- `loading.tsx` — dark skeleton matching the new list.
- `error.tsx` — dark tokens (keep structure).
- `layout.tsx` — unchanged (server metadata wrapper; leave as-is).

### Modified — meal-plan tap-to-open

- `src/components/meal-plans/EditorItemRow.tsx` — recipe rows: emoji+name become a tap target → `router.push('/recipes/<id>')`; qty/unit/remove `stopPropagation`. Add `useRouter` from `next/navigation`.

### Deleted (orphaned after this chunk)

- `src/components/RecipeViewDialog.tsx` — replaced by the `[id]` route + `RecipeDetail`. (No standalone test file today.)
- `src/components/RecipeEditorDialog.tsx` — replaced by `RecipeEditor`.
- `src/components/RecipeFilterBar.tsx` + `__tests__/RecipeFilterBar.test.tsx` — replaced by `src/components/recipes/RecipeFilterBar.tsx` (+ new test).
- `src/components/RecipeStarRating.tsx` + `__tests__/RecipeStarRating.test.tsx` — replaced by `recipes/Stars.tsx` (+ new test).
- `src/components/RecipeTagsEditor.tsx` + `__tests__/RecipeTagsEditor.test.tsx` — replaced by `recipes/RecipeTagsEditor.tsx` (+ new test).
- `src/components/RecipeIngredients.tsx` + `__tests__/RecipeIngredients.test.tsx` — replaced by `recipes/RecipeIngredientsEditor.tsx` + `RecipeIngredientsView.tsx`.
- `src/components/RecipeInstructionsView.tsx` + `__tests__/RecipeInstructionsView.test.tsx` — moved to `recipes/RecipeInstructionsView.tsx` (retheme; rewrite test under new path).
- `src/components/RecipeSharingSection.tsx` — replaced by `recipes/RecipeSharingDialog.tsx`.
- `src/components/EmojiPicker.tsx` + `__tests__/EmojiPicker.test.tsx` — replaced by `recipes/EmojiPicker.tsx` (+ new test). **Check for other importers first** (`grep -rl "components/EmojiPicker" src`): food-items / pantry may import it. If so, **keep the old `EmojiPicker` until its chunk** and have recipes import the new one; do NOT break other surfaces. (Likely-safe: only recipes uses it today — verify in Task 6.)
- `src/components/IngredientInput.tsx`, `src/components/IngredientGroup.tsx` (+ their tests) — **only delete if no remaining importers** after `RecipeIngredientsEditor` lands. `grep -rl "IngredientInput\|IngredientGroup" src` first. If anything else uses them, keep them. (Chunk-3 deliberately left them for recipes; chunk-4 replaces their recipe usage — confirm nothing else depends on them before deleting.)

> **DO NOT** change any file under `src/app/api/recipes/**`, `src/lib/recipe-utils.ts`, `src/lib/recipe-sharing-utils.ts`, `src/lib/recipe-user-data-utils.ts`, or `src/types/recipe*.ts` — read-only contracts. Same payloads (spec §1).

---

## Shared types (already exist — do not redefine; import from `@/types/recipe` + `@/types/recipe-user-data`)

```ts
// Recipe: { _id?: string; title: string; emoji?: string; ingredients: RecipeIngredientList[];
//           instructions: string; isGlobal: boolean; createdBy: string; createdAt; updatedAt }
// RecipeIngredientList: { title?: string; ingredients: RecipeIngredient[]; isStandalone?: boolean }
// RecipeIngredient: { type: 'foodItem'|'recipe'; id: string; quantity: number; unit?: string;
//                     name?: string;            // populated server-side on GET /api/recipes/[id]
//                     prepInstructions?: string }
// CreateRecipeRequest / UpdateRecipeRequest: { title; emoji?; ingredients; instructions; isGlobal }
// RecipeUserDataResponse: { tags: string[]; rating?: number; sharedTags?: string[];
//                           sharedRatings?: Array<{userId; userName?; userEmail; rating}> }
// RecipeWithAccessLevel extends Recipe { accessLevel: 'private'|'shared-by-you'|'shared-by-others' }
```

Data utils (already exist — call, never modify):

```ts
// recipe-utils:            fetchRecipe(id), createRecipe(req), updateRecipe(id, req), deleteRecipe(id)
// recipe-user-data-utils:  fetchRecipeUserData(recipeId) -> RecipeUserDataResponse,
//                          fetchRecipeUserDataBatch(ids) -> Map<id, RecipeUserDataResponse>,
//                          updateRecipeTags(id, tags), updateRecipeRating(id, n), deleteRecipeRating(id),
//                          fetchUserTags() -> string[]
// recipe-sharing-utils:    inviteUserToRecipeSharing(email, ('tags'|'ratings')[]),
//                          respondToRecipeSharingInvitation(userId, 'accept'|'reject'),
//                          removeUserFromRecipeSharing(userId),
//                          fetchPendingRecipeSharingInvitations() -> PendingRecipeInvitation[],
//                          fetchSharedRecipeUsers() -> SharedUser[]
//   SharedUser: { userId; email; name?; sharingTypes: ('tags'|'ratings')[] }
//   PendingRecipeInvitation: { invitation: { userId; userEmail; userName?; status; invitedBy; invitedAt; sharingTypes } }
// food-items-utils:        fetchFoodItems(query?) -> {_id;name;singularName;pluralName;unit}[]
// hooks (editor search):   useFoodItemSelector({ allowRecipes, excludeIds, currentRecipeId, autoLoad, onCreateRequested }),
//                          useFoodItemCreator({ onFoodItemAdded, onItemCreated })
// food-items-utils:       getUnitOptions() -> { value: string; label: string }[]  (used internally by UnitEditor; Tasks 8/9 don't call it directly), getUnitForm(unit, qty)
```

---

## Task list

| #   | Task                                                              | Heaviness |
| --- | ----------------------------------------------------------------- | --------- |
| 1   | `recipe-display-utils.ts` — pure helpers                          | S         |
| 2   | `Stars.tsx` — read/edit star rating                               | M         |
| 3   | `TagChip.tsx` + `AccessChip.tsx` — read-only pills                | S         |
| 4   | `RecipeTagsEditor.tsx` — editable tag pills                       | M         |
| 5   | `RecipeInstructionsView.tsx` — retheme markdown                   | S         |
| 6   | `EmojiPicker.tsx` — flat grid sheet/dialog                        | M         |
| 7   | `RecipeIngredientsView.tsx` — read-mode ingredient display        | M         |
| 8   | `RecipeIngredientRow.tsx` — editor row (qty/unit/prep)            | M         |
| 9   | `RecipeIngredientsEditor.tsx` — groups + add + all-or-nothing     | L         |
| 10  | `RecipeFilterBar.tsx` — search + chip filters                     | M         |
| 11  | `RecipeSharingDialog.tsx` — sheet/dialog sharing                  | L         |
| 12  | `RecipeRow.tsx` — list row atoms (mobile card / desktop grid)     | M         |
| 13  | `RecipeEditor.tsx` — full-page editor takeover (create+edit)      | L         |
| 14  | `RecipeDetail.tsx` — view component + edit mode + delete          | L         |
| 15  | `[id]` route — `page`/`loading`/`error` + tests                   | M         |
| 16  | List `page.tsx` rewrite — header/filter/list/redirect/takeover    | L         |
| 17  | Tap-a-recipe-to-open in `EditorItemRow` + test                    | S         |
| 18  | List `loading.tsx`/`error.tsx` retheme + delete orphans + cleanup | M         |

Each task is TDD: write the failing test → run it red → implement → run green → commit. Run vitest per-task with:
`MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run <file>`

> Tasks 1–12 are leaf components with no cross-dependencies beyond 1–3; build them first so 13/14/16 can assemble. Within a task, follow the exact step order. **Do not run `npm run check` while a dev server is running** (Turbopack/`.next` collision) — that's the final-validation step after Task 18, not per-task. All git commit messages end with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (omitted from the snippets below for brevity).

---

## Task 1: `recipe-display-utils.ts` — pure helpers

**Files:**

- Create: `src/components/recipes/recipe-display-utils.ts`
- Test: `src/components/recipes/__tests__/recipe-display-utils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/recipes/__tests__/recipe-display-utils.test.ts
import { describe, it, expect } from 'vitest';
import {
  accessLevelMeta,
  formatIngredientQty,
  recipeIngredientCount,
} from '../recipe-display-utils';
import { tokens } from '@/lib/design-tokens';

describe('accessLevelMeta', () => {
  it('maps each access level to a label + token color', () => {
    expect(accessLevelMeta('private')).toEqual({ label: 'Private', color: tokens.text.secondary });
    expect(accessLevelMeta('shared-by-you')).toEqual({
      label: 'Shared by you',
      color: tokens.state.success,
    });
    expect(accessLevelMeta('shared-by-others')).toEqual({
      label: 'Shared by others',
      color: tokens.section.recipes,
    });
  });
});

describe('formatIngredientQty', () => {
  it('omits the unit when it is "each" or missing', () => {
    expect(formatIngredientQty(2, 'each')).toBe('2');
    expect(formatIngredientQty(3, undefined)).toBe('3');
  });
  it('renders qty + unit otherwise, keeping fractions', () => {
    expect(formatIngredientQty(0.5, 'cup')).toBe('0.5 cup');
    expect(formatIngredientQty(1, 'lb')).toBe('1 lb');
  });
});

describe('recipeIngredientCount', () => {
  it('sums ingredients across all lists', () => {
    expect(
      recipeIngredientCount([
        { title: 'A', ingredients: [{ type: 'foodItem', id: 'x', quantity: 1 }] },
        {
          title: 'B',
          ingredients: [
            { type: 'foodItem', id: 'y', quantity: 1 },
            { type: 'recipe', id: 'z', quantity: 1 },
          ],
        },
      ])
    ).toBe(3);
  });
  it('handles empty / missing ingredient arrays', () => {
    expect(recipeIngredientCount([])).toBe(0);
    expect(recipeIngredientCount([{ title: '', ingredients: [] }])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/recipes/__tests__/recipe-display-utils.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/components/recipes/recipe-display-utils.ts
import { tokens } from '@/lib/design-tokens';
import type { RecipeIngredientList } from '@/types/recipe';

export type AccessLevel = 'private' | 'shared-by-you' | 'shared-by-others';

/**
 * Semi-transparent recipe orange for selected-state backgrounds (chips, selected emoji, radio rows).
 * NOT a token: `tokens.accent.muted` is the BLUE plans accent, and `tokens.section.recipes` has no
 * muted variant. Every recipe component imports THIS for selected backgrounds.
 */
export const RECIPE_ACCENT_MUTED = 'rgba(232,168,107,0.16)';

/** Label + token color for the access pill shown on the recipe view + list. */
export function accessLevelMeta(access: AccessLevel): { label: string; color: string } {
  switch (access) {
    case 'shared-by-you':
      return { label: 'Shared by you', color: tokens.state.success };
    case 'shared-by-others':
      return { label: 'Shared by others', color: tokens.section.recipes };
    case 'private':
    default:
      return { label: 'Private', color: tokens.text.secondary };
  }
}

/** Quantity + unit for an ingredient row; "each"/missing units render bare (matches the artboard). */
export function formatIngredientQty(qty: number, unit?: string): string {
  if (!unit || unit === 'each') return String(qty);
  return `${qty} ${unit}`;
}

/** Total ingredient count across all groups/lists. */
export function recipeIngredientCount(lists: RecipeIngredientList[]): number {
  return lists.reduce((sum, list) => sum + (list.ingredients?.length ?? 0), 0);
}
```

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS (8 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/recipe-display-utils.ts src/components/recipes/__tests__/recipe-display-utils.test.ts
git commit -m "feat(recipes): add recipe display helpers (access/qty/count)"
```

---

## Task 2: `Stars.tsx` — read/edit star rating

**Files:**

- Create: `src/components/recipes/Stars.tsx`
- Test: `src/components/recipes/__tests__/Stars.test.tsx`

**Design:** ★ glyphs in `state.warn`; filled stars opacity 1, empties 0.22. View mode = plain spans (decorative). Edit mode = 5 star buttons (each an accessible `aria-label` like `"3 stars"`); clicking star `n` calls `onChange(n)`; clicking the **currently-selected** star calls `onChange(0)` (clear). The parent renders any separate "Clear" text button (calls `onChange(0)`). Optional `sharedRatings` renders a small summary line in view mode.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/recipes/__tests__/Stars.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Stars } from '../Stars';

afterEach(cleanup);

describe('Stars', () => {
  it('renders five stars in view mode (no buttons)', () => {
    render(<Stars rating={3} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    // five glyphs present
    expect(screen.getAllByText('★')).toHaveLength(5);
  });

  it('editable: clicking a star sets that rating', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Stars rating={0} editable onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '4 stars' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('editable: clicking the current rating clears it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Stars rating={3} editable onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '3 stars' }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('shows a shared-ratings summary in view mode when provided', () => {
    render(
      <Stars
        rating={5}
        sharedRatings={[{ userId: 'u', userEmail: 'a@b.com', userName: 'Avery', rating: 4 }]}
      />
    );
    expect(screen.getByText(/Avery/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run red** — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/recipes/Stars.tsx
'use client';

import { useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import { tokens } from '@/lib/design-tokens';

export interface SharedRating {
  userId: string;
  userName?: string;
  userEmail: string;
  rating: number;
}

export interface StarsProps {
  rating?: number;
  editable?: boolean;
  onChange?: (rating: number) => void;
  size?: number;
  sharedRatings?: SharedRating[];
}

const STARS = [1, 2, 3, 4, 5];

export function Stars({
  rating = 0,
  editable = false,
  onChange,
  size = 13,
  sharedRatings,
}: StarsProps) {
  const [hover, setHover] = useState(0);
  const shown = editable && hover > 0 ? hover : rating;

  const glyph = (filled: boolean) => (
    <Box
      component="span"
      sx={{ color: tokens.state.warn, fontSize: size, opacity: filled ? 1 : 0.22, lineHeight: 1 }}
    >
      ★
    </Box>
  );

  if (!editable) {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
        {STARS.map((n) => (
          <Box key={n} component="span">
            {glyph(n <= shown)}
          </Box>
        ))}
        {sharedRatings && sharedRatings.length > 0 && (
          <Box component="span" sx={{ fontSize: 11, color: tokens.text.secondary, ml: 1 }}>
            {sharedRatings.map((s) => `${s.userName ?? s.userEmail}: ${s.rating}`).join(', ')}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      {STARS.map((n) => (
        <ButtonBase
          key={n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange?.(n === rating ? 0 : n)}
          sx={{ borderRadius: '4px', p: '1px' }}
        >
          {glyph(n <= shown)}
        </ButtonBase>
      ))}
    </Box>
  );
}
```

- [ ] **Step 4: Run green** — Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/Stars.tsx src/components/recipes/__tests__/Stars.test.tsx
git commit -m "feat(recipes): add Stars rating (view + editable, clear-on-resave)"
```

---

## Task 3: `TagChip.tsx` + `AccessChip.tsx` — read-only pills

**Files:**

- Create: `src/components/recipes/TagChip.tsx` (exports `TagChip` and `AccessChip`)
- Test: `src/components/recipes/__tests__/TagChip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/recipes/__tests__/TagChip.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TagChip, AccessChip } from '../TagChip';

afterEach(cleanup);

describe('TagChip / AccessChip', () => {
  it('renders a tag label', () => {
    render(<TagChip>weeknight</TagChip>);
    expect(screen.getByText('weeknight')).toBeInTheDocument();
  });

  it('renders the access label for each level', () => {
    const { rerender } = render(<AccessChip access="private" />);
    expect(screen.getByText('Private')).toBeInTheDocument();
    rerender(<AccessChip access="shared-by-you" />);
    expect(screen.getByText('Shared by you')).toBeInTheDocument();
    rerender(<AccessChip access="shared-by-others" />);
    expect(screen.getByText('Shared by others')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement**

```tsx
// src/components/recipes/TagChip.tsx
'use client';

import { Box } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { accessLevelMeta, type AccessLevel } from './recipe-display-utils';

export function TagChip({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        fontSize: small ? 10 : 11,
        color: tokens.text.secondary,
        px: small ? '6px' : '8px',
        py: small ? '1px' : '2px',
        border: `1px solid ${tokens.border.subtle}`,
        borderRadius: `${tokens.radius.pill}px`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Box>
  );
}

export function AccessChip({ access }: { access: AccessLevel }) {
  const { label, color } = accessLevelMeta(access);
  return (
    <Box
      component="span"
      sx={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color,
        px: '8px',
        py: '3px',
        border: `1px solid ${tokens.border.subtle}`,
        borderRadius: `${tokens.radius.pill}px`,
      }}
    >
      {label}
    </Box>
  );
}
```

- [ ] **Step 4: Run green** — PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/TagChip.tsx src/components/recipes/__tests__/TagChip.test.tsx
git commit -m "feat(recipes): add TagChip + AccessChip pills"
```

---

## Task 4: `RecipeTagsEditor.tsx` — editable tag pills

**Files:**

- Create: `src/components/recipes/RecipeTagsEditor.tsx`
- Test: `src/components/recipes/__tests__/RecipeTagsEditor.test.tsx`

**Design:** edit-mode pills (each with a ✕ remove control) + a `+ Add tag` button that reveals an inline text input; Enter adds the trimmed value (dedup) and re-focuses for the next; blank/duplicate is ignored; Escape/blur hides the input. `availableTags` powers a native `<datalist>` for suggestions (no heavy Autocomplete needed).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/recipes/__tests__/RecipeTagsEditor.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeTagsEditor } from '../RecipeTagsEditor';

afterEach(cleanup);

describe('RecipeTagsEditor', () => {
  it('renders existing tags with remove controls', () => {
    render(<RecipeTagsEditor value={['italian', 'quick']} onChange={vi.fn()} />);
    expect(screen.getByText('italian')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove italian' })).toBeInTheDocument();
  });

  it('removing a tag emits the remaining tags', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecipeTagsEditor value={['italian', 'quick']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Remove italian' }));
    expect(onChange).toHaveBeenCalledWith(['quick']);
  });

  it('adds a new tag on Enter and ignores duplicates/blanks', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecipeTagsEditor value={['italian']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /add tag/i }));
    const input = screen.getByPlaceholderText(/add a tag/i);
    await user.type(input, 'vegan{Enter}');
    expect(onChange).toHaveBeenCalledWith(['italian', 'vegan']);
    onChange.mockClear();
    await user.type(input, 'italian{Enter}'); // duplicate
    await user.type(input, '   {Enter}'); // blank
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement**

```tsx
// src/components/recipes/RecipeTagsEditor.tsx
'use client';

import { useId, useRef, useState } from 'react';
import { Box, ButtonBase, InputBase } from '@mui/material';
import { tokens } from '@/lib/design-tokens';

export interface RecipeTagsEditorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  availableTags?: string[];
}

export function RecipeTagsEditor({ value, onChange, availableTags = [] }: RecipeTagsEditorProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const tag = draft.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft('');
  };

  return (
    <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
      {value.map((tag) => (
        <Box
          key={tag}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: 11,
            color: tokens.text.primary,
            pl: '10px',
            pr: '8px',
            py: '4px',
            bgcolor: tokens.surface.elevated,
            borderRadius: `${tokens.radius.pill}px`,
          }}
        >
          {tag}
          <ButtonBase
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            sx={{ color: tokens.text.secondary, fontSize: 11, borderRadius: '50%', px: '2px' }}
          >
            ✕
          </ButtonBase>
        </Box>
      ))}

      {adding ? (
        <>
          <InputBase
            inputRef={inputRef}
            autoFocus
            value={draft}
            placeholder="Add a tag…"
            inputProps={{ list: listId, 'aria-label': 'Add a tag' }}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                setAdding(false);
                setDraft('');
              }
            }}
            onBlur={() => {
              commit();
              setAdding(false);
            }}
            sx={{
              fontSize: 11,
              color: tokens.text.primary,
              px: '10px',
              py: '3px',
              border: `1px dashed ${tokens.border.strong}`,
              borderRadius: `${tokens.radius.pill}px`,
            }}
          />
          <datalist id={listId}>
            {availableTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </>
      ) : (
        <ButtonBase
          onClick={() => setAdding(true)}
          sx={{
            fontSize: 11,
            color: tokens.text.secondary,
            px: '10px',
            py: '4px',
            border: `1px dashed ${tokens.border.subtle}`,
            borderRadius: `${tokens.radius.pill}px`,
          }}
        >
          + Add tag
        </ButtonBase>
      )}
    </Box>
  );
}
```

> Note: the `onBlur` commit + the Enter commit both call `commit()`. In the test, the duplicate/blank `{Enter}` paths assert no `onChange`; the final unmount (`cleanup`) does not fire React blur synchronously, so the assertions hold. If a future flake appears, drop the `onBlur` commit and keep Enter-only.

- [ ] **Step 4: Run green** — PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/RecipeTagsEditor.tsx src/components/recipes/__tests__/RecipeTagsEditor.test.tsx
git commit -m "feat(recipes): add editable tag pills (RecipeTagsEditor)"
```

---

## Task 5: `RecipeInstructionsView.tsx` — retheme markdown

**Files:**

- Create: `src/components/recipes/RecipeInstructionsView.tsx`
- Test: `src/components/recipes/__tests__/RecipeInstructionsView.test.tsx`

**Design:** port the existing `src/components/RecipeInstructionsView.tsx` markdown renderer (react-markdown + remark-gfm) to dark tokens. Keep the element→Typography mapping; recolor text to `tokens.text.primary`, links to `primary.main`, code/blockquote backgrounds to `surface.elevated`. (Lift the existing component's `components={{…}}` map; only swap colors.)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/recipes/__tests__/RecipeInstructionsView.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RecipeInstructionsView } from '../RecipeInstructionsView';

afterEach(cleanup);

describe('RecipeInstructionsView', () => {
  it('renders markdown headings, paragraphs, and lists', () => {
    render(
      <RecipeInstructionsView instructions={'# Step one\n\nBoil water.\n\n- salt\n- pasta'} />
    );
    expect(screen.getByText('Step one')).toBeInTheDocument();
    expect(screen.getByText('Boil water.')).toBeInTheDocument();
    expect(screen.getByText('salt')).toBeInTheDocument();
    expect(screen.getByText('pasta')).toBeInTheDocument();
  });

  it('renders nothing meaningful for empty instructions', () => {
    const { container } = render(<RecipeInstructionsView instructions="" />);
    expect(container).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement** — copy `src/components/RecipeInstructionsView.tsx`'s structure (ReactMarkdown + remarkGfm + the `components` element map), exporting a **named** `RecipeInstructionsView({ instructions }: { instructions: string })`, with token colors. Reference the existing file for the full element map; recolor:
  - headings/paragraph/list text → `tokens.text.primary`
  - `a` → `color: 'primary.main'`, `target="_blank"`, `rel="noopener noreferrer"`
  - inline `code` / `pre` → `bgcolor: tokens.surface.elevated`, `color: tokens.text.primary`, `borderRadius: tokens.radius.sm`
  - `blockquote` → left border `tokens.border.strong`, `color: tokens.text.secondary`

```tsx
// src/components/recipes/RecipeInstructionsView.tsx
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Typography, Link } from '@mui/material';
import { tokens } from '@/lib/design-tokens';

export function RecipeInstructionsView({ instructions }: { instructions: string }) {
  return (
    <Box sx={{ color: tokens.text.primary, fontSize: 15, lineHeight: 1.65 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <Typography variant="h6" sx={{ color: tokens.text.primary, mt: 2, mb: 1 }}>
              {children}
            </Typography>
          ),
          h2: ({ children }) => (
            <Typography variant="subtitle1" sx={{ color: tokens.text.primary, mt: 2, mb: 1 }}>
              {children}
            </Typography>
          ),
          h3: ({ children }) => (
            <Typography variant="subtitle2" sx={{ color: tokens.text.primary, mt: 1.5, mb: 0.75 }}>
              {children}
            </Typography>
          ),
          p: ({ children }) => (
            <Typography sx={{ color: tokens.text.primary, mb: 1.25, lineHeight: 1.65 }}>
              {children}
            </Typography>
          ),
          ul: ({ children }) => (
            <Box component="ul" sx={{ pl: 3, mb: 1.25 }}>
              {children}
            </Box>
          ),
          ol: ({ children }) => (
            <Box component="ol" sx={{ pl: 3, mb: 1.25 }}>
              {children}
            </Box>
          ),
          li: ({ children }) => (
            <Box component="li" sx={{ color: tokens.text.primary, mb: 0.5 }}>
              {children}
            </Box>
          ),
          a: ({ href, children }) => (
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: 'primary.main' }}
            >
              {children}
            </Link>
          ),
          code: ({ children }) => (
            <Box
              component="code"
              sx={{
                bgcolor: tokens.surface.elevated,
                color: tokens.text.primary,
                px: 0.75,
                py: 0.25,
                borderRadius: `${tokens.radius.sm}px`,
                fontSize: '0.9em',
              }}
            >
              {children}
            </Box>
          ),
          blockquote: ({ children }) => (
            <Box
              sx={{
                borderLeft: `3px solid ${tokens.border.strong}`,
                pl: 2,
                color: tokens.text.secondary,
                my: 1.5,
              }}
            >
              {children}
            </Box>
          ),
        }}
      >
        {instructions}
      </ReactMarkdown>
    </Box>
  );
}
```

- [ ] **Step 4: Run green** — PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/RecipeInstructionsView.tsx src/components/recipes/__tests__/RecipeInstructionsView.test.tsx
git commit -m "feat(recipes): retheme markdown instructions view to dark tokens"
```

---

## Task 6: `EmojiPicker.tsx` — flat grid sheet/dialog

**Files:**

- Create: `src/components/recipes/EmojiPicker.tsx`
- Modify: `src/components/EmojiPicker.tsx` — add `export const FOOD_EMOJIS = […]` (export the existing internal array; do NOT otherwise change it — shopping-lists still imports the default).
- Test: `src/components/recipes/__tests__/EmojiPicker.test.tsx`

**Design:** responsive — `Drawer` (anchor bottom) on xs / `Dialog` on md+ (gate with `useMediaQuery(theme.breakpoints.up('md'))`, the chunk-3 sheet/dialog pattern). Flat grid (`repeat(8,1fr)` xs / `repeat(10,1fr)` md+) of emoji buttons from `FOOD_EMOJIS` (shape `{ emoji, description }[]`); a search field filters on `description`; header has `Clear` (→ `onSelect('')` then `onClose()`) + `Done` (→ `onClose`). Selecting an emoji calls `onSelect(emoji)` and closes.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/recipes/__tests__/EmojiPicker.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmojiPicker } from '../EmojiPicker';

afterEach(cleanup);

describe('EmojiPicker (recipes)', () => {
  it('does not render content when closed', () => {
    render(<EmojiPicker open={false} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/search emoji/i)).not.toBeInTheDocument();
  });

  it('selecting an emoji fires onSelect + onClose', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<EmojiPicker open onSelect={onSelect} onClose={onClose} currentEmoji="🍝" />);
    // 🍝 is in FOOD_EMOJIS; click the first emoji button
    const buttons = screen.getAllByRole('button', { name: /emoji / i });
    await user.click(buttons[0]);
    expect(onSelect).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Clear emits an empty selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<EmojiPicker open onSelect={onSelect} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(onSelect).toHaveBeenCalledWith('');
  });
});
```

> The emoji buttons get `aria-label={`emoji ${e}`}` so the test can query them; the search input gets `placeholder="Search emoji"`.

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement** — bottom `Drawer` (xs) / `Dialog` (md+); both share a `body`:

```tsx
// src/components/recipes/EmojiPicker.tsx
'use client';

import { useMemo, useState } from 'react';
import { Box, Drawer, Dialog, InputBase, ButtonBase, useMediaQuery, useTheme } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { FOOD_EMOJIS } from '@/components/EmojiPicker';
import { RECIPE_ACCENT_MUTED } from './recipe-display-utils';

export interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  currentEmoji?: string;
}

export function EmojiPicker({ open, onClose, onSelect, currentEmoji }: EmojiPickerProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return FOOD_EMOJIS;
    // FOOD_EMOJIS is `{ emoji: string; description: string }[]` (verified in src/components/EmojiPicker.tsx).
    return FOOD_EMOJIS.filter((e) => e.description.toLowerCase().includes(needle));
  }, [q]);

  const emojiOf = (e: { emoji: string }) => e.emoji;

  const body = (
    <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: isDesktop ? '80vh' : '78vh' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.75,
          borderBottom: `1px solid ${tokens.border.subtle}`,
        }}
      >
        <Box
          sx={{ fontFamily: 'var(--font-display)', fontSize: isDesktop ? 18 : 15, fontWeight: 700 }}
        >
          Pick an emoji
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <ButtonBase
            onClick={() => {
              onSelect('');
              onClose();
            }}
            sx={{ color: tokens.text.secondary, fontSize: 14 }}
          >
            Clear
          </ButtonBase>
          <ButtonBase
            onClick={onClose}
            sx={{ color: 'primary.main', fontSize: 14, fontWeight: 600 }}
          >
            Done
          </ButtonBase>
        </Box>
      </Box>
      <Box sx={{ px: 2.5, pt: 1.5 }}>
        <InputBase
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search emoji"
          inputProps={{ 'aria-label': 'Search emoji' }}
          sx={{
            width: '100%',
            height: 38,
            px: 1.5,
            bgcolor: tokens.surface.elevated,
            border: `1px solid ${tokens.border.strong}`,
            borderRadius: `${tokens.radius.lg}px`,
            color: tokens.text.primary,
            fontSize: 13,
          }}
        />
      </Box>
      <Box sx={{ overflowY: 'auto', p: 2.5 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${isDesktop ? 10 : 8}, 1fr)`,
            gap: '4px',
          }}
        >
          {filtered.map((e, i) => {
            const em = emojiOf(e);
            const selected = em === currentEmoji;
            return (
              <ButtonBase
                key={`${i}-${em}`}
                aria-label={`emoji ${em}`}
                onClick={() => {
                  onSelect(em);
                  onClose();
                }}
                sx={{
                  height: isDesktop ? 40 : 38,
                  fontSize: 22,
                  borderRadius: `${tokens.radius.sm}px`,
                  bgcolor: selected ? RECIPE_ACCENT_MUTED : 'transparent',
                  border: `1px solid ${selected ? tokens.section.recipes : 'transparent'}`,
                }}
              >
                {em}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>
    </Box>
  );

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: {
              width: 520,
              bgcolor: tokens.surface.raised,
              borderRadius: `${tokens.radius.xxxl}px`,
              border: `1px solid ${tokens.border.subtle}`,
            },
          },
        }}
      >
        {body}
      </Dialog>
    );
  }
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            bgcolor: tokens.surface.sheet,
            borderTopLeftRadius: `${tokens.radius.sheet}px`,
            borderTopRightRadius: `${tokens.radius.sheet}px`,
          },
        },
      }}
    >
      {body}
    </Drawer>
  );
}
```

> Before implementing: open `src/components/EmojiPicker.tsx` and export its existing `const FOOD_EMOJIS` (shape `{ emoji: string; description: string }[]`) by adding `export`. Do not change the default export or its other behavior — shopping-lists depends on it.

- [ ] **Step 4: Run green** — PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/EmojiPicker.tsx src/components/EmojiPicker.tsx src/components/recipes/__tests__/EmojiPicker.test.tsx
git commit -m "feat(recipes): flat-grid emoji picker (sheet/dialog) reusing FOOD_EMOJIS"
```

---

## Task 7: `RecipeIngredientsView.tsx` — read-mode ingredient display

**Files:**

- Create: `src/components/recipes/RecipeIngredientsView.tsx`
- Test: `src/components/recipes/__tests__/RecipeIngredientsView.test.tsx`

**Design (artboard MobileView/DesktopView):** for each ingredient list, render an uppercase group title (only when `title` is set, i.e. grouped mode), then each ingredient as a row: a fixed-width qty column (`formatIngredientQty`, tabular nums, `text.secondary`) + the name (`text.primary`) with an optional italic `, {prep}` suffix (`text.secondary`). Standalone (single untitled list) shows no group header. The card wrapper (paper bg) is the caller's; this renders the inner content.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/recipes/__tests__/RecipeIngredientsView.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RecipeIngredientsView } from '../RecipeIngredientsView';
import type { RecipeIngredientList } from '@/types/recipe';

afterEach(cleanup);

const grouped: RecipeIngredientList[] = [
  {
    title: 'Pasta',
    ingredients: [
      { type: 'foodItem', id: 'a', quantity: 1, unit: 'lb', name: 'spaghetti' },
      {
        type: 'foodItem',
        id: 'b',
        quantity: 2,
        unit: 'each',
        name: 'lemons',
        prepInstructions: 'zest + juice',
      },
    ],
  },
];

describe('RecipeIngredientsView', () => {
  it('renders group titles, qty+unit, names, and prep', () => {
    render(<RecipeIngredientsView ingredients={grouped} />);
    expect(screen.getByText('Pasta')).toBeInTheDocument();
    expect(screen.getByText('1 lb')).toBeInTheDocument();
    expect(screen.getByText('spaghetti')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // 'each' unit omitted
    expect(screen.getByText(/zest \+ juice/)).toBeInTheDocument();
  });

  it('omits the group header for a standalone (untitled) list', () => {
    render(
      <RecipeIngredientsView
        ingredients={[
          {
            isStandalone: true,
            ingredients: [{ type: 'foodItem', id: 'a', quantity: 1, name: 'salt' }],
          },
        ]}
      />
    );
    expect(screen.getByText('salt')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement**

```tsx
// src/components/recipes/RecipeIngredientsView.tsx
'use client';

import { Box } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import type { RecipeIngredientList } from '@/types/recipe';
import { formatIngredientQty } from './recipe-display-utils';

export function RecipeIngredientsView({ ingredients }: { ingredients: RecipeIngredientList[] }) {
  return (
    <Box>
      {ingredients.map((group, gi) => (
        <Box key={gi} sx={{ mb: gi < ingredients.length - 1 ? 2.5 : 0 }}>
          {group.title && (
            <Box
              sx={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: tokens.text.secondary,
                mb: 1.25,
              }}
            >
              {group.title}
            </Box>
          )}
          {group.ingredients.map((it, ii) => (
            <Box
              key={ii}
              sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, py: '6px', fontSize: 15 }}
            >
              <Box
                component="span"
                sx={{
                  width: 80,
                  flexShrink: 0,
                  color: tokens.text.secondary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatIngredientQty(it.quantity, it.unit)}
              </Box>
              <Box component="span" sx={{ flex: 1, color: tokens.text.primary }}>
                {it.name ?? ''}
                {it.prepInstructions && (
                  <Box component="span" sx={{ color: tokens.text.secondary, fontStyle: 'italic' }}>
                    , {it.prepInstructions}
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 4: Run green** — PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/RecipeIngredientsView.tsx src/components/recipes/__tests__/RecipeIngredientsView.test.tsx
git commit -m "feat(recipes): read-mode grouped ingredients view"
```

---

## Task 8: `RecipeIngredientRow.tsx` — editor ingredient row (qty/unit/prep)

**Files:**

- Create: `src/components/recipes/RecipeIngredientRow.tsx`
- Test: `src/components/recipes/__tests__/RecipeIngredientRow.test.tsx`

**Reuse:** `QtyEditor` (`{ open, anchorEl, value: number, onCommit: (qty: number) => void, onClose }`) and `UnitEditor` (`{ open, anchorEl, value: string, quantity: number, onCommit: (unit: string) => void, onClose }`) from `@/components/meal-plans/` — signatures verified at review-plan time (callback is **`onCommit`**, not `onChange`; `UnitEditor` **requires `quantity`** to pluralize via `getUnitForm`).

**Design (artboard `DesktopIngredientRow`/`MobileIngredientRow`):** name (flex, ellipsis) + qty button (tabular, opens `QtyEditor` anchored to itself) + unit button with ▾ (opens `UnitEditor`; **hidden for `type === 'recipe'`**) + delete (Material Symbol). Below: if `prepInstructions` set → a `Prep` label + italic prep field (editable) + delete-prep; else a faint `+ prep instructions` button that adds an empty prep field. All edits emit `onChange(updatedIngredient)`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/recipes/__tests__/RecipeIngredientRow.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeIngredientRow } from '../RecipeIngredientRow';
import type { RecipeIngredient } from '@/types/recipe';

afterEach(cleanup);

const base: RecipeIngredient = {
  type: 'foodItem',
  id: 'a',
  quantity: 1,
  unit: 'cup',
  name: 'flour',
};

describe('RecipeIngredientRow', () => {
  it('renders name, qty, and unit; hides unit for recipe ingredients', () => {
    const { rerender } = render(
      <RecipeIngredientRow ingredient={base} onChange={vi.fn()} onRemove={vi.fn()} />
    );
    expect(screen.getByText('flour')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quantity/i })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /unit/i })).toBeInTheDocument();

    rerender(
      <RecipeIngredientRow
        ingredient={{ type: 'recipe', id: 'r', quantity: 2, name: 'pesto' }}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /unit/i })).not.toBeInTheDocument();
  });

  it('remove fires onRemove', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<RecipeIngredientRow ingredient={base} onChange={vi.fn()} onRemove={onRemove} />);
    await user.click(screen.getByRole('button', { name: /remove flour/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('adds a prep field and edits emit onChange with prepInstructions', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecipeIngredientRow ingredient={base} onChange={onChange} onRemove={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /prep instructions/i }));
    const prep = screen.getByPlaceholderText(/sifted/i);
    await user.type(prep, 'sifted');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ prepInstructions: 'sifted' })
    );
  });
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement**

```tsx
// src/components/recipes/RecipeIngredientRow.tsx
'use client';

import { useState } from 'react';
import { Box, ButtonBase, InputBase } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { Icon } from '@/components/ui/Icon';
import { QtyEditor } from '@/components/meal-plans/QtyEditor';
import { UnitEditor } from '@/components/meal-plans/UnitEditor';
import type { RecipeIngredient } from '@/types/recipe';

export interface RecipeIngredientRowProps {
  ingredient: RecipeIngredient;
  onChange: (next: RecipeIngredient) => void;
  onRemove: () => void;
}

const ctrlBtn = {
  height: 30,
  px: 1.25,
  border: `1px solid ${tokens.border.strong}`,
  borderRadius: `${tokens.radius.sm}px`,
  color: tokens.text.primary,
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
} as const;

export function RecipeIngredientRow({ ingredient, onChange, onRemove }: RecipeIngredientRowProps) {
  const [qtyAnchor, setQtyAnchor] = useState<HTMLElement | null>(null);
  const [unitAnchor, setUnitAnchor] = useState<HTMLElement | null>(null);
  const [prepOpen, setPrepOpen] = useState(Boolean(ingredient.prepInstructions));
  const isRecipe = ingredient.type === 'recipe';
  const name = ingredient.name ?? '';

  return (
    <Box sx={{ borderTop: `1px solid ${tokens.border.subtle}`, py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: 14,
            color: tokens.text.primary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </Box>
        <ButtonBase
          aria-label={`quantity for ${name}`}
          onClick={(e) => setQtyAnchor(e.currentTarget)}
          sx={{ ...ctrlBtn, fontWeight: 600 }}
        >
          {ingredient.quantity}
        </ButtonBase>
        {!isRecipe && (
          <ButtonBase
            aria-label={`unit for ${name}`}
            onClick={(e) => setUnitAnchor(e.currentTarget)}
            sx={{
              ...ctrlBtn,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              borderColor: tokens.border.subtle,
            }}
          >
            {ingredient.unit || 'unit'}
            <Box component="span" sx={{ fontSize: 9, color: tokens.text.muted }}>
              ▾
            </Box>
          </ButtonBase>
        )}
        <ButtonBase
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          sx={{ color: tokens.text.muted, px: 0.5 }}
        >
          <Icon name="delete" size={16} />
        </ButtonBase>
      </Box>

      {prepOpen ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
          <Box
            sx={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: tokens.text.secondary,
            }}
          >
            Prep
          </Box>
          <InputBase
            value={ingredient.prepInstructions ?? ''}
            placeholder="e.g. sifted"
            inputProps={{ 'aria-label': `prep for ${name}` }}
            onChange={(e) => onChange({ ...ingredient, prepInstructions: e.target.value })}
            sx={{
              flex: 1,
              height: 28,
              px: 1.25,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: `${tokens.radius.sm}px`,
              fontSize: 12,
              color: tokens.text.primary,
              fontStyle: 'italic',
            }}
          />
          <ButtonBase
            aria-label={`Remove prep for ${name}`}
            onClick={() => {
              setPrepOpen(false);
              onChange({ ...ingredient, prepInstructions: undefined });
            }}
            sx={{ color: tokens.text.muted, px: 0.5 }}
          >
            <Icon name="delete" size={15} />
          </ButtonBase>
        </Box>
      ) : (
        <ButtonBase
          onClick={() => setPrepOpen(true)}
          sx={{ mt: 0.5, color: tokens.text.secondary, fontSize: 11 }}
        >
          + prep instructions
        </ButtonBase>
      )}

      <QtyEditor
        open={Boolean(qtyAnchor)}
        anchorEl={qtyAnchor}
        value={ingredient.quantity}
        onCommit={(n: number) => onChange({ ...ingredient, quantity: n })}
        onClose={() => setQtyAnchor(null)}
      />
      {!isRecipe && (
        <UnitEditor
          open={Boolean(unitAnchor)}
          anchorEl={unitAnchor}
          value={ingredient.unit || ''}
          quantity={ingredient.quantity}
          onCommit={(u: string) => onChange({ ...ingredient, unit: u })}
          onClose={() => setUnitAnchor(null)}
        />
      )}
    </Box>
  );
}
```

> The qty button's accessible name is `quantity for <name>` (test queries `/quantity/i`); unit is `unit for <name>` (`/unit/i`). `QtyEditor`/`UnitEditor` emit via `onCommit` (the row re-renders from the committed value).

- [ ] **Step 4: Run green** — PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/RecipeIngredientRow.tsx src/components/recipes/__tests__/RecipeIngredientRow.test.tsx
git commit -m "feat(recipes): editor ingredient row (qty/unit/prep) reusing chunk-3 editors"
```

---

## Task 9: `RecipeIngredientsEditor.tsx` — groups + add + all-or-nothing

**Files:**

- Create: `src/components/recipes/RecipeIngredientsEditor.tsx`
- Test: `src/components/recipes/__tests__/RecipeIngredientsEditor.test.tsx`

**Reference behavior (port from the old `src/components/RecipeIngredients.tsx`):** standalone mode = one `isStandalone` list with no title; grouped mode = ≥1 titled list. `+ Group` converts standalone→grouped (the first list gets an editable title) or appends a new empty group. Each group: `GROUP` label + title field + delete-group (with the artboard's delete icon) + `RecipeIngredientRow`s + `+ Add ingredient`. **All-or-nothing:** in grouped mode every group must have a non-empty `title` (the editor surfaces an invalid border + the parent's Save is disabled via `validateRecipeIngredients`, Task 13). Adding an ingredient uses `useFoodItemSelector({ allowRecipes: true, currentRecipeId, autoLoad: true })` + `useFoodItemCreator({ onFoodItemAdded, onItemCreated })`: selecting an option appends a `RecipeIngredient` (`{type, id, quantity: 1, unit: <default>, name}`); duplicate `id`s within the recipe are rejected (port the old dedup). Emits `onChange(RecipeIngredientList[])`.

**Exported helper (pure, also used by `RecipeEditor` Task 13):**

```ts
// in RecipeIngredientsEditor.tsx
export function validateRecipeIngredients(lists: RecipeIngredientList[]): boolean {
  const total = lists.reduce((n, l) => n + l.ingredients.length, 0);
  if (total === 0) return false;
  return lists.every((l) => l.isStandalone || (l.title?.trim() ?? '') !== '');
}
```

- [ ] **Step 1: Write the failing test** (covers the data logic — the add-search UI is exercised in the page/editor integration tests, Tasks 13/16):

```tsx
// src/components/recipes/__tests__/RecipeIngredientsEditor.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeIngredientsEditor, validateRecipeIngredients } from '../RecipeIngredientsEditor';
import type { RecipeIngredientList } from '@/types/recipe';

afterEach(cleanup);

// Stub the search hooks so the editor mounts without network.
vi.mock('@/lib/hooks/use-food-item-selector', () => ({
  useFoodItemSelector: () => ({
    inputValue: '',
    options: [],
    selectedItem: null,
    isLoading: false,
    selectedIndex: -1,
    setInputValue: vi.fn(),
    handleSelect: vi.fn(),
    handleInputChange: vi.fn(),
    handleKeyDown: vi.fn(),
    autocompleteRef: { current: null },
    quantityRef: { current: null },
  }),
}));
vi.mock('@/lib/hooks/use-food-item-creator', () => ({
  useFoodItemCreator: () => ({
    isDialogOpen: false,
    prefillName: '',
    error: null,
    lastError: { current: null },
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    handleCreate: vi.fn(),
    clearError: vi.fn(),
  }),
}));

const standalone: RecipeIngredientList[] = [
  {
    isStandalone: true,
    ingredients: [{ type: 'foodItem', id: 'a', quantity: 1, unit: 'cup', name: 'flour' }],
  },
];

describe('validateRecipeIngredients', () => {
  it('requires ≥1 ingredient and a title on every non-standalone group', () => {
    expect(validateRecipeIngredients([])).toBe(false);
    expect(validateRecipeIngredients(standalone)).toBe(true);
    expect(
      validateRecipeIngredients([
        { title: '', ingredients: [{ type: 'foodItem', id: 'a', quantity: 1 }] },
      ])
    ).toBe(false);
    expect(
      validateRecipeIngredients([
        { title: 'Sauce', ingredients: [{ type: 'foodItem', id: 'a', quantity: 1 }] },
      ])
    ).toBe(true);
  });
});

describe('RecipeIngredientsEditor', () => {
  it('renders existing ingredients and a + Group control', () => {
    render(<RecipeIngredientsEditor value={standalone} onChange={vi.fn()} />);
    expect(screen.getByText('flour')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ group/i })).toBeInTheDocument();
  });

  it('+ Group converts a standalone list to a titled group', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecipeIngredientsEditor value={standalone} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /\+ group/i }));
    // first call: the standalone list becomes grouped (isStandalone cleared, title editable)
    const next = onChange.mock.calls.at(-1)![0] as RecipeIngredientList[];
    expect(next.every((l) => !l.isStandalone)).toBe(true);
  });

  it('editing a group title emits the new title', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RecipeIngredientsEditor
        value={[
          {
            title: 'Sauce',
            ingredients: [{ type: 'foodItem', id: 'a', quantity: 1, name: 'oil' }],
          },
        ]}
        onChange={onChange}
      />
    );
    const titleInput = screen.getByDisplayValue('Sauce');
    await user.type(titleInput, 'X');
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement.** Build the editor against the `RecipeIngredientList[]` model. Structure (reference the old `RecipeIngredients.tsx` for the exact convert/dedup logic; recreate its handlers with the new dark UI):
  - **Mode:** `grouped = value.length > 1 || value.some((l) => !l.isStandalone && l.title !== undefined)`. Standalone default = `[{ isStandalone: true, ingredients: [] }]`.
  - **`+ Group`:** if standalone, map the single list to `{ title: '', ingredients }` (drop `isStandalone`); else append `{ title: '', ingredients: [] }`. Emit.
  - **Group card** (`surface.raised`, radius 12): `GROUP` label + title `InputBase` (grouped only; `onChange` → update that list's `title`; warn border when blank) + delete-group `ButtonBase` (Icon `delete`) → remove that list (if removing the last group, fall back to a standalone empty list) + the list's `RecipeIngredientRow`s (each `onChange` replaces that ingredient; `onRemove` drops it) + `+ Add ingredient` (dashed) that reveals the combined-search autocomplete.
  - **Add ingredient:** wire `useFoodItemSelector({ allowRecipes: true, currentRecipeId, autoLoad: true, onCreateRequested })` + `useFoodItemCreator`. On `handleSelect(option)`: reject if the `id` already exists anywhere in `value`; else append `{ type: option.type, id: option._id, quantity: 1, unit: option.type === 'foodItem' ? option.unit : undefined, name: option.singularName ?? option.title }` to the target list. (Follow the existing `IngredientInput`/`RecipeIngredients` wiring for the autocomplete render + create-new-food-item dialog.)
  - Render the `AddFoodItemDialog` (driven by `useFoodItemCreator`'s `isDialogOpen`/`closeDialog`/`handleCreate`/`prefillName`) following **`CombinedSearch.tsx`** (`src/components/meal-plans/CombinedSearch.tsx` lines 58–61 + the dialog render ~300–307). **CRITICAL — wire `onItemCreated`** so a newly-created food item is appended to the active group as a `RecipeIngredient` (`{ type: 'foodItem', id: item._id, quantity: 1, unit: item.unit, name: item.singularName }`). The `onFoodItemAdded` callback alone does **not** append — without `onItemCreated` the create-new-food-item dialog closes successfully but the new item silently vanishes from the ingredient list.

  Provide the full data-handler implementation; the autocomplete render may reuse the existing `IngredientInput` internals as a reference (do not import the old component — recreate its search field with `useFoodItemSelector`). Keep the emitted `RecipeIngredientList[]` shape identical to today's so the API payload is unchanged.

- [ ] **Step 4: Run green** — PASS (validate: 1 test; editor: 3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/RecipeIngredientsEditor.tsx src/components/recipes/__tests__/RecipeIngredientsEditor.test.tsx
git commit -m "feat(recipes): grouped ingredients editor (add/convert/all-or-nothing)"
```

> **Implementation note for the executor:** Task 9 is the chunk's most intricate component because it recreates the food-item search + create-new flow. Read the old `src/components/RecipeIngredients.tsx` + `src/components/IngredientInput.tsx` **and `src/components/meal-plans/CombinedSearch.tsx`** (the canonical `onFoodItemAdded` + `onItemCreated` wiring precedent) first; preserve their selection/dedup/convert semantics exactly (no write-logic change), only swapping the presentation to the dark artboard. If the autocomplete render balloons, split the per-group add-search into a small private `AddIngredientSearch` subcomponent within the same file.

---

## Task 10: `RecipeFilterBar.tsx` — search + chip filters

**Files:**

- Create: `src/components/recipes/RecipeFilterBar.tsx`
- Test: `src/components/recipes/__tests__/RecipeFilterBar.test.tsx`

**Design:** keep the **exact same props + emitted semantics** as the old `src/components/RecipeFilterBar.tsx` (search, multi-select tags, multi-select ratings, sort) — restyle only. Search `InputBase`; a `Tags` chip (shows `Tags · N` when selected) opening a `Popover`/`Menu` of selectable tags from `availableTags`; a rating chip opening a 1–5 multi-select; a `Sort` chip opening a menu (Updated / Title / Rating × asc/desc). `hasActiveFilters` shows a `Clear` affordance.

**Props (mirror today's):**

```ts
export interface RecipeFilterBarProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[];
  selectedRatings: number[];
  onRatingsChange: (ratings: number[]) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}
```

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/recipes/__tests__/RecipeFilterBar.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeFilterBar } from '../RecipeFilterBar';

afterEach(cleanup);

const baseProps = {
  searchTerm: '',
  onSearchChange: vi.fn(),
  selectedTags: [] as string[],
  onTagsChange: vi.fn(),
  availableTags: ['italian', 'quick'],
  selectedRatings: [] as number[],
  onRatingsChange: vi.fn(),
  sortBy: 'updatedAt',
  sortOrder: 'desc' as const,
  onSortChange: vi.fn(),
  hasActiveFilters: false,
  onClearFilters: vi.fn(),
};

describe('RecipeFilterBar', () => {
  it('typing in search emits onSearchChange', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<RecipeFilterBar {...baseProps} onSearchChange={onSearchChange} />);
    await user.type(screen.getByPlaceholderText(/search recipes/i), 'pasta');
    expect(onSearchChange).toHaveBeenCalled();
  });

  it('opening the Tags menu and selecting a tag emits onTagsChange', async () => {
    const user = userEvent.setup();
    const onTagsChange = vi.fn();
    render(<RecipeFilterBar {...baseProps} onTagsChange={onTagsChange} />);
    await user.click(screen.getByRole('button', { name: /tags/i }));
    await user.click(screen.getByRole('button', { name: 'italian' }));
    expect(onTagsChange).toHaveBeenCalledWith(['italian']);
  });

  it('shows Clear when filters are active and emits onClearFilters', async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    render(<RecipeFilterBar {...baseProps} hasActiveFilters onClearFilters={onClearFilters} />);
    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClearFilters).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement** — search `InputBase` (placeholder `Search recipes, tags…`) + filter chips. Use MUI `Popover` anchored to each chip. Tag rows are `SelectableTag` buttons (reuse the artboard's selected/▢ style: `RECIPE_ACCENT_MUTED` bg + `section.recipes` border when selected) toggling membership in `selectedTags` → `onTagsChange`. Rating popover = 1–5 buttons toggling `selectedRatings`. Sort menu = `MenuItem`s calling `onSortChange`. `Clear` button visible when `hasActiveFilters`. Chips styled per the artboard `FilterChip` (selected → `RECIPE_ACCENT_MUTED`/`section.recipes`). Tabular/token styling throughout.

```tsx
// src/components/recipes/RecipeFilterBar.tsx — shape (fill in the popovers)
'use client';

import { useState } from 'react';
import { Box, InputBase, ButtonBase, Popover, MenuItem, MenuList } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { RECIPE_ACCENT_MUTED } from './recipe-display-utils';
import type { RecipeFilterBarProps } from './filter-types'; // or inline the interface above

const chipSx = (selected: boolean) => ({
  height: 30,
  px: 1.5,
  borderRadius: `${tokens.radius.pill}px`,
  fontSize: 12,
  fontWeight: 500,
  bgcolor: selected ? RECIPE_ACCENT_MUTED : 'transparent',
  border: `1px solid ${selected ? tokens.section.recipes : tokens.border.subtle}`,
  color: selected ? tokens.section.recipes : tokens.text.secondary,
});

export function RecipeFilterBar(props: RecipeFilterBarProps) {
  const {
    searchTerm,
    onSearchChange,
    selectedTags,
    onTagsChange,
    availableTags,
    selectedRatings,
    onRatingsChange,
    sortBy,
    sortOrder,
    onSortChange,
    hasActiveFilters,
    onClearFilters,
  } = props;
  const [tagAnchor, setTagAnchor] = useState<HTMLElement | null>(null);
  const [ratingAnchor, setRatingAnchor] = useState<HTMLElement | null>(null);
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  const toggleTag = (t: string) =>
    onTagsChange(
      selectedTags.includes(t) ? selectedTags.filter((x) => x !== t) : [...selectedTags, t]
    );
  const toggleRating = (n: number) =>
    onRatingsChange(
      selectedRatings.includes(n) ? selectedRatings.filter((x) => x !== n) : [...selectedRatings, n]
    );

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: { xs: 'wrap', md: 'nowrap' } }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 200,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          height: 38,
          px: 1.5,
          bgcolor: tokens.surface.elevated,
          border: `1px solid ${tokens.border.strong}`,
          borderRadius: `${tokens.radius.lg}px`,
        }}
      >
        <Box component="span" sx={{ color: tokens.text.secondary, fontSize: 14 }}>
          ⌕
        </Box>
        <InputBase
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search recipes, tags…"
          inputProps={{ 'aria-label': 'Search recipes' }}
          sx={{ flex: 1, fontSize: 13, color: tokens.text.primary }}
        />
      </Box>

      <ButtonBase
        onClick={(e) => setTagAnchor(e.currentTarget)}
        sx={chipSx(selectedTags.length > 0)}
      >
        {selectedTags.length ? `Tags · ${selectedTags.length}` : 'Tags'}
      </ButtonBase>
      <ButtonBase
        onClick={(e) => setRatingAnchor(e.currentTarget)}
        sx={chipSx(selectedRatings.length > 0)}
      >
        ★ {selectedRatings.length ? selectedRatings.slice().sort().join(',') : 'Rating'}
      </ButtonBase>
      <ButtonBase onClick={(e) => setSortAnchor(e.currentTarget)} sx={chipSx(false)}>
        Sort ▾
      </ButtonBase>
      {hasActiveFilters && (
        <ButtonBase
          onClick={onClearFilters}
          sx={{ fontSize: 12, color: tokens.section.recipes, px: 1 }}
        >
          Clear
        </ButtonBase>
      )}

      {/* Tags popover */}
      <Popover
        open={Boolean(tagAnchor)}
        anchorEl={tagAnchor}
        onClose={() => setTagAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: tokens.surface.sheet,
              border: `1px solid ${tokens.border.subtle}`,
              p: 1.5,
              maxWidth: 360,
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {availableTags.map((t) => (
            <ButtonBase key={t} onClick={() => toggleTag(t)} sx={chipSx(selectedTags.includes(t))}>
              {t}
            </ButtonBase>
          ))}
        </Box>
      </Popover>

      {/* Rating popover */}
      <Popover
        open={Boolean(ratingAnchor)}
        anchorEl={ratingAnchor}
        onClose={() => setRatingAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: tokens.surface.sheet,
              border: `1px solid ${tokens.border.subtle}`,
              p: 1.5,
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {[5, 4, 3, 2, 1].map((n) => (
            <ButtonBase
              key={n}
              onClick={() => toggleRating(n)}
              sx={chipSx(selectedRatings.includes(n))}
            >
              {n}★
            </ButtonBase>
          ))}
        </Box>
      </Popover>

      {/* Sort menu */}
      <Popover
        open={Boolean(sortAnchor)}
        anchorEl={sortAnchor}
        onClose={() => setSortAnchor(null)}
        slotProps={{
          paper: {
            sx: { bgcolor: tokens.surface.sheet, border: `1px solid ${tokens.border.subtle}` },
          },
        }}
      >
        <MenuList>
          {[
            ['updatedAt', 'Updated'],
            ['title', 'Title'],
            ['rating', 'Rating'],
          ].map(([key, label]) => (
            <MenuItem
              key={key}
              onClick={() => {
                onSortChange(key, key === 'title' ? 'asc' : 'desc');
                setSortAnchor(null);
              }}
              sx={{ color: tokens.text.primary, fontSize: 13 }}
            >
              {label}
              {sortBy === key ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}
            </MenuItem>
          ))}
        </MenuList>
      </Popover>
    </Box>
  );
}
```

> Inline the `RecipeFilterBarProps` interface in this file (drop the `./filter-types` import) — it's shown separately above only for clarity. The test queries `getByRole('button', { name: 'italian' })` inside the Tags popover; MUI `Popover` renders into a portal but RTL finds it. Keep the props 1:1 with the old bar so `page.tsx` wiring is a drop-in swap.

- [ ] **Step 4: Run green** — PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/RecipeFilterBar.tsx src/components/recipes/__tests__/RecipeFilterBar.test.tsx
git commit -m "feat(recipes): chip-based filter bar (search/tags/rating/sort)"
```

---

## Task 11: `RecipeSharingDialog.tsx` — sheet/dialog sharing

**Files:**

- Create: `src/components/recipes/RecipeSharingDialog.tsx`
- Test: `src/components/recipes/__tests__/RecipeSharingDialog.test.tsx`

**Reference:** `src/components/meal-plans/ShareMealPlansDialog.tsx` (chunk-3) is the structural precedent — responsive `Drawer` (xs) / `Dialog` (md+), pending-invite cards, invite-by-email row, shared-with rows. Adapt to **recipe** sharing (per-invitee `tags`/`ratings` via the existing `What to share` checkboxes). **Same payloads** as today's `RecipeSharingSection` — data + callbacks come from the list page (do not move sharing state here).

**Props (data + callbacks, mirroring today's `RecipeSharingSection` usage in `page.tsx`):**

```ts
export interface RecipeSharingDialogProps {
  open: boolean;
  onClose: () => void;
  pendingInvitations: PendingRecipeInvitation[];
  onAcceptInvitation: (userId: string) => void;
  onRejectInvitation: (userId: string) => void;
  shareTags: boolean;
  onShareTagsChange: (v: boolean) => void;
  shareRatings: boolean;
  onShareRatingsChange: (v: boolean) => void;
  shareEmail: string;
  onShareEmailChange: (v: string) => void;
  onInviteUser: () => void;
  sharedUsers: SharedUser[];
  onRemoveUser: (userId: string) => void;
}
// PendingRecipeInvitation + SharedUser imported from '@/lib/recipe-sharing-utils'
```

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/recipes/__tests__/RecipeSharingDialog.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeSharingDialog } from '../RecipeSharingDialog';

afterEach(cleanup);

const baseProps = {
  open: true,
  onClose: vi.fn(),
  pendingInvitations: [
    {
      invitation: {
        userId: 'p1',
        userEmail: 'sara@x.com',
        userName: 'Sara',
        status: 'pending',
        invitedBy: 'me',
        invitedAt: '2026-05-01',
        sharingTypes: ['tags', 'ratings'],
      },
    },
  ],
  onAcceptInvitation: vi.fn(),
  onRejectInvitation: vi.fn(),
  shareTags: true,
  onShareTagsChange: vi.fn(),
  shareRatings: true,
  onShareRatingsChange: vi.fn(),
  shareEmail: '',
  onShareEmailChange: vi.fn(),
  onInviteUser: vi.fn(),
  sharedUsers: [
    {
      userId: 's1',
      email: 'casey@x.com',
      name: 'Casey',
      sharingTypes: ['tags'] as ('tags' | 'ratings')[],
    },
  ],
  onRemoveUser: vi.fn(),
};

describe('RecipeSharingDialog', () => {
  it('renders pending invitations and shared users', () => {
    render(<RecipeSharingDialog {...baseProps} />);
    expect(screen.getByText('Sara')).toBeInTheDocument();
    expect(screen.getByText('Casey')).toBeInTheDocument();
  });

  it('accept / reject fire with the invitee userId', async () => {
    const user = userEvent.setup();
    const onAcceptInvitation = vi.fn();
    render(<RecipeSharingDialog {...baseProps} onAcceptInvitation={onAcceptInvitation} />);
    await user.click(screen.getByRole('button', { name: /accept sara/i }));
    expect(onAcceptInvitation).toHaveBeenCalledWith('p1');
  });

  it('Invite fires onInviteUser; remove fires onRemoveUser', async () => {
    const user = userEvent.setup();
    const onInviteUser = vi.fn();
    const onRemoveUser = vi.fn();
    render(
      <RecipeSharingDialog
        {...baseProps}
        shareEmail="new@x.com"
        onInviteUser={onInviteUser}
        onRemoveUser={onRemoveUser}
      />
    );
    await user.click(screen.getByRole('button', { name: /^invite$/i }));
    expect(onInviteUser).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /remove casey/i }));
    expect(onRemoveUser).toHaveBeenCalledWith('s1');
  });
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement** — model on `ShareMealPlansDialog`. Sections: **Pending invitations · N** (cards: avatar initial, `{name} wants to share their {types}`, accept ✓ → `onAcceptInvitation(userId)` / reject ✕ → `onRejectInvitation(userId)`; accept button `aria-label={`Accept ${name}`}`); **What to share** (two `CheckboxRow`s bound to `shareTags`/`shareRatings`); **Invite by email** (`InputBase` bound to `shareEmail` + `Invite` button → `onInviteUser`); **Shared with · N** (rows: initial, `{name}`, `sharing {types}`, remove → `onRemoveUser(userId)` with `aria-label={`Remove ${name}`}`). Responsive `Drawer`/`Dialog` per `useMediaQuery(up('md'))`. Tokens per the artboard (`RecipeInviteCard`, `CheckboxRow`, `SharedPersonRecipe`).

- [ ] **Step 4: Run green** — PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/RecipeSharingDialog.tsx src/components/recipes/__tests__/RecipeSharingDialog.test.tsx
git commit -m "feat(recipes): redesigned sharing sheet/dialog (per-invitee tags/ratings)"
```

---

## Task 12: `RecipeRow.tsx` — list row atoms

**Files:**

- Create: `src/components/recipes/RecipeRow.tsx` (exports `RecipeCardMobile` + `RecipeTableRow`)
- Test: `src/components/recipes/__tests__/RecipeRow.test.tsx`

**Design:** `RecipeCardMobile` (artboard `RecipeRowMobile`): emoji tile + title + `Stars` + `· updated {date}` + up-to-3 `TagChip`s + chevron; whole card clickable → `onOpen()`. `RecipeTableRow` (artboard desktop grid `1fr 240px 100px 110px`): emoji+title | tags (2 + `+N`) | stars | updated; row clickable → `onOpen()`.

**Props:**

```ts
export interface RecipeRowProps {
  recipe: { _id?: string; title: string; emoji?: string; updatedAt: string | Date };
  tags: string[];
  rating?: number;
  onOpen: () => void;
}
```

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/recipes/__tests__/RecipeRow.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeCardMobile, RecipeTableRow } from '../RecipeRow';

afterEach(cleanup);

const recipe = { _id: 'r1', title: 'Lemon pasta', emoji: '🍝', updatedAt: '2026-05-04T00:00:00Z' };

describe('RecipeRow atoms', () => {
  it('RecipeCardMobile renders title + tags and opens on click', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<RecipeCardMobile recipe={recipe} tags={['italian']} rating={5} onOpen={onOpen} />);
    expect(screen.getByText('Lemon pasta')).toBeInTheDocument();
    expect(screen.getByText('italian')).toBeInTheDocument();
    await user.click(screen.getByText('Lemon pasta'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('RecipeTableRow renders title and opens on click', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<RecipeTableRow recipe={recipe} tags={['a', 'b', 'c']} rating={4} onOpen={onOpen} />);
    await user.click(screen.getByText('Lemon pasta'));
    expect(onOpen).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement** — both atoms use `Stars` (Task 2), `TagChip` (Task 3), tokens, and `new Date(recipe.updatedAt).toLocaleDateString()`. Wrap each in a `ButtonBase`/clickable `Box` (`role="button"`/`onClick={onOpen}`, `cursor: pointer`). Emoji tile = `surface.elevated`, radius 10/12. Desktop row = a `Box` with the `display:'grid'` template; mobile card = `surface.raised` rounded card with `mb`.

- [ ] **Step 4: Run green** — PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/RecipeRow.tsx src/components/recipes/__tests__/RecipeRow.test.tsx
git commit -m "feat(recipes): list row atoms (mobile card + desktop grid row)"
```

---

## Task 13: `RecipeEditor.tsx` — full-page editor takeover (create + edit)

**Files:**

- Create: `src/components/recipes/RecipeEditor.tsx`
- Test: `src/components/recipes/__tests__/RecipeEditor.test.tsx`

**Design (artboard `DesktopEdit`/`MobileEdit`):** a full-width takeover of the content area (under the persistent nav). Sticky sub-header: `‹ Recipes`/`Cancel` + title (`New recipe` / `Editing recipe`) + `Cancel` (md+ `btnGhost`) + `Save` (disabled until valid). Body: emoji button (→ `EmojiPicker`), `Title` field, `Access` radios (`Personal`=`isGlobal:false` / `Global`=`isGlobal:true`), `RecipeTagsEditor`, `Your rating` (`Stars editable` + `Clear`), `RecipeIngredientsEditor`, `Instructions` multiline field + "Markdown supported", and (edit mode) a `🗑 Delete recipe` button → confirm.

**State + persistence:**

- Draft: `{ title, emoji, isGlobal, ingredients: RecipeIngredientList[], instructions }` seeded from `recipe` (edit) or defaults (create: `isGlobal: true`, `ingredients: [{ isStandalone: true, ingredients: [] }]`).
- Tags + rating: seeded from `userData`; persisted **after** the recipe save via `updateRecipeTags` / (`updateRecipeRating` | `deleteRecipeRating`).
- `valid = title.trim() !== '' && validateRecipeIngredients(draft.ingredients)`.
- `dirty` = draft/tags/rating differ from the seed → `Cancel` shows the `ConfirmDialog` ("Discard changes?").
- **Same payloads:** create → `createRecipe({title,emoji,ingredients,instructions,isGlobal})`; edit → `updateRecipe(id, {…})`. After the recipe resolves, sync tags/rating, then `onSaved(savedRecipe)`. Delete → `deleteRecipe(id)` → `onDeleted()`.

**Props:**

```ts
export interface RecipeEditorProps {
  mode: 'create' | 'edit';
  recipe?: Recipe; // required for edit
  userData?: RecipeUserDataResponse; // tags + rating seed (edit)
  availableTags?: string[];
  currentRecipeId?: string; // exclude self from sub-recipe search (edit)
  onClose: () => void; // Cancel (after discard-confirm if dirty)
  onSaved: (recipe: Recipe) => void;
  onDeleted?: () => void; // edit only
}
```

- [ ] **Step 1: Write the failing test** (mock the data utils + the heavy ingredients editor so the test targets the editor shell + save flow):

```tsx
// src/components/recipes/__tests__/RecipeEditor.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeEditor } from '../RecipeEditor';
import type { Recipe } from '@/types/recipe';

vi.mock('@/lib/recipe-utils', () => ({
  createRecipe: vi.fn(async (r) => ({ ...r, _id: 'new1' })),
  updateRecipe: vi.fn(async (id, r) => ({ ...r, _id: id })),
  deleteRecipe: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/lib/recipe-user-data-utils', () => ({
  updateRecipeTags: vi.fn(async () => ({})),
  updateRecipeRating: vi.fn(async () => ({})),
  deleteRecipeRating: vi.fn(async () => ({})),
}));
// Keep the ingredients editor light — exercised in its own test (Task 9).
vi.mock('../RecipeIngredientsEditor', () => ({
  validateRecipeIngredients: (lists: { ingredients: unknown[] }[]) =>
    lists.some((l) => l.ingredients.length > 0),
  RecipeIngredientsEditor: () => <div data-testid="ingredients-editor" />,
}));

import { createRecipe, updateRecipe, deleteRecipe } from '@/lib/recipe-utils';

const existing: Recipe = {
  _id: 'r1',
  title: 'Lemon pasta',
  emoji: '🍝',
  isGlobal: false,
  ingredients: [
    {
      title: 'Pasta',
      ingredients: [{ type: 'foodItem', id: 'a', quantity: 1, unit: 'lb', name: 'spaghetti' }],
    },
  ],
  instructions: 'Boil.',
  createdBy: 'me',
  createdAt: new Date().toISOString() as unknown as Date,
  updatedAt: new Date().toISOString() as unknown as Date,
};

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('RecipeEditor', () => {
  it('edit mode seeds the title and saves via updateRecipe', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <RecipeEditor
        mode="edit"
        recipe={existing}
        userData={{ tags: [], rating: undefined }}
        onSaved={onSaved}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('Lemon pasta')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() =>
      expect(updateRecipe).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({ title: 'Lemon pasta' })
      )
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('create mode disables Save until a title + an ingredient exist', async () => {
    render(<RecipeEditor mode="create" onSaved={vi.fn()} onClose={vi.fn()} />);
    // No title, no ingredients (mock validate returns false) → disabled
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('Cancel with edits prompts a discard confirmation', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <RecipeEditor
        mode="edit"
        recipe={existing}
        userData={{ tags: [], rating: undefined }}
        onSaved={vi.fn()}
        onClose={onClose}
        onDeleted={vi.fn()}
      />
    );
    await user.clear(screen.getByDisplayValue('Lemon pasta'));
    await user.type(screen.getByLabelText(/title/i), 'Changed');
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByText(/discard changes/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Delete confirms then calls deleteRecipe + onDeleted', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    render(
      <RecipeEditor
        mode="edit"
        recipe={existing}
        userData={{ tags: [], rating: undefined }}
        onSaved={vi.fn()}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />
    );
    await user.click(screen.getByRole('button', { name: /delete recipe/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i })); // confirm
    await waitFor(() => expect(deleteRecipe).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement.** Assemble the takeover. Key logic (write in full):

```tsx
// core of RecipeEditor.tsx
const seed = useMemo(
  () => ({
    title: recipe?.title ?? '',
    emoji: recipe?.emoji ?? '',
    isGlobal: recipe?.isGlobal ?? true,
    ingredients: recipe?.ingredients ?? [{ isStandalone: true, ingredients: [] }],
    instructions: recipe?.instructions ?? '',
  }),
  [recipe]
);
const [draft, setDraft] = useState(seed);
const [tags, setTags] = useState<string[]>(userData?.tags ?? []);
const [rating, setRating] = useState<number | undefined>(userData?.rating);
const [saving, setSaving] = useState(false);
const [discardOpen, setDiscardOpen] = useState(false);
const [deleteOpen, setDeleteOpen] = useState(false);
const [emojiOpen, setEmojiOpen] = useState(false);

const valid = draft.title.trim() !== '' && validateRecipeIngredients(draft.ingredients);
const dirty =
  JSON.stringify(draft) !== JSON.stringify(seed) ||
  JSON.stringify([...tags].sort()) !== JSON.stringify([...(userData?.tags ?? [])].sort()) ||
  rating !== userData?.rating;

const cancel = () => (dirty ? setDiscardOpen(true) : onClose());

const save = async () => {
  setSaving(true);
  try {
    const payload = {
      title: draft.title.trim(),
      emoji: draft.emoji,
      ingredients: filterBlankIngredients(draft.ingredients),
      instructions: draft.instructions,
      isGlobal: draft.isGlobal,
    };
    const saved =
      mode === 'create' ? await createRecipe(payload) : await updateRecipe(recipe!._id!, payload);
    const id = saved._id!;
    // Sync per-user tags/rating (only when changed) — same utils as today.
    if (JSON.stringify([...tags].sort()) !== JSON.stringify([...(userData?.tags ?? [])].sort()))
      await updateRecipeTags(id, tags);
    if (rating !== userData?.rating) {
      if (rating && rating > 0) await updateRecipeRating(id, rating);
      else await deleteRecipeRating(id);
    }
    onSaved(saved);
  } finally {
    setSaving(false);
  }
};

const doDelete = async () => {
  if (!recipe?._id) return;
  await deleteRecipe(recipe._id);
  setDeleteOpen(false);
  onDeleted?.();
};
```

- `filterBlankIngredients` = port the old `page.tsx` helper (strips ingredients with empty `id`).
- Layout: sticky header (`position: sticky, top: 0, zIndex, bgcolor surface.base, borderBottom`) with `Cancel`/title/`Save` (`<Button disabled={!valid || saving}>`). Body in a `maxWidth: 1280, mx:auto` container; desktop two-column grid (`1fr 1fr`) for ingredients|instructions, single column on xs (artboard).
- Title field: `InputBase` with `inputProps={{ 'aria-label': 'Title' }}` and `value={draft.title}`.
- Access radios: two `RadioRow`-style labels (reuse the artboard's pattern) toggling `draft.isGlobal`.
- `<RecipeTagsEditor value={tags} onChange={setTags} availableTags={availableTags} />`.
- `<Stars editable rating={rating ?? 0} onChange={(n) => setRating(n === 0 ? undefined : n)} size={20} />` + a `Clear` button (`setRating(undefined)`).
- `<RecipeIngredientsEditor value={draft.ingredients} onChange={(ings) => setDraft((d) => ({ ...d, ingredients: ings }))} currentRecipeId={currentRecipeId} />`.
- Instructions: MUI `TextField multiline` bound to `draft.instructions` + caption "Markdown supported."
- `<EmojiPicker open={emojiOpen} onSelect={(e) => setDraft((d) => ({ ...d, emoji: e }))} onClose={() => setEmojiOpen(false)} currentEmoji={draft.emoji} />`.
- `<ConfirmDialog open={discardOpen} title="Discard changes?" body="Your edits won't be saved." confirmLabel="Discard" cancelLabel="Keep editing" onConfirm={() => { setDiscardOpen(false); onClose(); }} onCancel={() => setDiscardOpen(false)} />` (reuse `@/components/meal-plans/ConfirmDialog`).
- Delete (edit only): `🗑 Delete recipe` button (danger outline) → `setDeleteOpen(true)`; `<ConfirmDialog open={deleteOpen} title="Delete recipe?" body={`"${recipe?.title}" will be permanently removed.`} confirmLabel="Delete" onConfirm={doDelete} onCancel={() => setDeleteOpen(false)} />`.

- [ ] **Step 4: Run green** — PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/RecipeEditor.tsx src/components/recipes/__tests__/RecipeEditor.test.tsx
git commit -m "feat(recipes): full-page recipe editor takeover (create + edit + delete)"
```

---

## Task 14: `RecipeDetail.tsx` — view component + edit mode + delete

**Files:**

- Create: `src/components/recipes/RecipeDetail.tsx`
- Test: `src/components/recipes/__tests__/RecipeDetail.test.tsx`

**Design (artboard `DesktopView`/`MobileView`):** `‹ Recipes` back link → `router.push('/recipes')`. Header: emoji tile + `RECIPE` eyebrow (`section.recipes`) + title (Bricolage) + `Stars` (view, with `sharedRatings`) + `AccessChip` + `TagChip`s + (creator only) `✎ Edit` + `⋯` menu (Delete). Body: two-column `RecipeIngredientsView` (left) / `RecipeInstructionsView` (right) on md+, stacked on xs. Edit (`✎`) flips to `RecipeEditor mode="edit"` in place; `onSaved` → refetch + back to view; `onClose` → back to view. Delete (⋯) → `ConfirmDialog` → `deleteRecipe` → `router.push('/recipes')`.

**Data:** on mount fetch `fetchRecipe(recipeId)` (populated names + `accessLevel`?) + `fetchRecipeUserData(recipeId)` + `fetchUserTags()` (for the editor's tag suggestions). Loading → spinner; fetch error → throw (the route's `error.tsx` catches) or inline `Alert`. `canEdit = recipe.createdBy === session.user.id`.

> Note on `accessLevel`: `GET /api/recipes/[id]` returns the recipe; verify whether it includes `accessLevel`. If not, derive it client-side the same way the list does (`createdBy === userId ? (isGlobal ? 'shared-by-you' : 'private') : 'shared-by-others'`) using a small local `computeAccessLevel(recipe, userId)` helper (do **not** change the API).

**Props:** `{ recipeId: string }`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/recipes/__tests__/RecipeDetail.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeDetail } from '../RecipeDetail';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'me' } }, status: 'authenticated' }),
}));
vi.mock('@/lib/recipe-utils', () => ({
  fetchRecipe: vi.fn(async () => ({
    _id: 'r1',
    title: 'Lemon pasta',
    emoji: '🍝',
    isGlobal: false,
    createdBy: 'me',
    ingredients: [
      {
        title: 'Pasta',
        ingredients: [{ type: 'foodItem', id: 'a', quantity: 1, unit: 'lb', name: 'spaghetti' }],
      },
    ],
    instructions: 'Boil the pasta.',
    createdAt: '',
    updatedAt: '',
  })),
  deleteRecipe: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/lib/recipe-user-data-utils', () => ({
  fetchRecipeUserData: vi.fn(async () => ({ tags: ['italian'], rating: 5 })),
  fetchUserTags: vi.fn(async () => ['italian', 'quick']),
}));
// Render the editor as a stub so this test stays about the detail shell.
vi.mock('../RecipeEditor', () => ({ RecipeEditor: () => <div data-testid="recipe-editor" /> }));

import { deleteRecipe } from '@/lib/recipe-utils';

afterEach(cleanup);
beforeEach(() => push.mockClear());

describe('RecipeDetail', () => {
  it('renders the recipe after load', async () => {
    render(<RecipeDetail recipeId="r1" />);
    await waitFor(() => expect(screen.getByText('Lemon pasta')).toBeInTheDocument());
    expect(screen.getByText('spaghetti')).toBeInTheDocument();
    expect(screen.getByText('Boil the pasta.')).toBeInTheDocument();
    expect(screen.getByText('italian')).toBeInTheDocument();
  });

  it('back link navigates to the list', async () => {
    const user = userEvent.setup();
    render(<RecipeDetail recipeId="r1" />);
    await waitFor(() => screen.getByText('Lemon pasta'));
    await user.click(screen.getByRole('button', { name: /recipes/i }));
    expect(push).toHaveBeenCalledWith('/recipes');
  });

  it('Edit enters the editor; the creator sees Edit', async () => {
    const user = userEvent.setup();
    render(<RecipeDetail recipeId="r1" />);
    await waitFor(() => screen.getByText('Lemon pasta'));
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByTestId('recipe-editor')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement** — fetch on mount (`useEffect`), hold `recipe`/`userData`/`availableTags`/`loading`/`editing`/`deleteOpen`. Render spinner while loading. View layout per the artboard using `RecipeIngredientsView`, `RecipeInstructionsView`, `Stars`, `AccessChip`, `TagChip`. `✎ Edit` → `setEditing(true)` rendering `<RecipeEditor mode="edit" recipe={recipe} userData={userData} availableTags={availableTags} currentRecipeId={recipeId} onSaved={(r) => { setRecipe(r); setEditing(false); /* refetch userData */ }} onClose={() => setEditing(false)} onDeleted={() => router.push('/recipes')} />`. `⋯` menu → Delete → `ConfirmDialog` → `deleteRecipe(recipeId)` → `router.push('/recipes')`. Back button `aria-label`/text `‹ Recipes` → `router.push('/recipes')`. `canEdit` gates the `✎ Edit` + `⋯`.

- [ ] **Step 4: Run green** — PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/RecipeDetail.tsx src/components/recipes/__tests__/RecipeDetail.test.tsx
git commit -m "feat(recipes): full-page recipe view + in-place edit + delete"
```

---

## Task 15: `[id]` route — `page` / `loading` / `error` + tests

**Files:**

- Create: `src/app/recipes/[id]/page.tsx`
- Create: `src/app/recipes/[id]/loading.tsx`
- Create: `src/app/recipes/[id]/error.tsx`
- Create: `src/app/recipes/[id]/__tests__/loading.test.tsx`
- Create: `src/app/recipes/[id]/__tests__/error.test.tsx`

**Mirror** `src/app/meal-plans/[id]/*` (chunk-3) + the existing `src/app/recipes/{loading,error}.tsx` conventions.

- [ ] **Step 1: Write the failing tests** — copy `src/app/recipes/__tests__/loading.test.tsx` and `error.test.tsx` verbatim, changing the imports to `../loading` / `../error` and the describe names to `RecipeDetailLoading` / `RecipeDetailError`. (Loading mocks `@/components/AuthenticatedLayout`; error renders `RecipesError`-style.)

```tsx
// src/app/recipes/[id]/__tests__/error.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecipeDetailError from '../error';

afterEach(cleanup);

describe('RecipeDetailError', () => {
  it('displays the error message', () => {
    render(<RecipeDetailError error={new Error('Boom')} reset={vi.fn()} />);
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });
  it('calls reset when Try Again is clicked', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<RecipeDetailError error={new Error('x')} reset={reset} />);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
```

```tsx
// src/app/recipes/[id]/__tests__/loading.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import RecipeDetailLoading from '../loading';

vi.mock('@/components/AuthenticatedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('RecipeDetailLoading', () => {
  it('renders skeleton elements', () => {
    const { container } = render(<RecipeDetailLoading />);
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement**

```tsx
// src/app/recipes/[id]/page.tsx
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { RecipeDetail } from '@/components/recipes/RecipeDetail';

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AuthenticatedLayout>
      <RecipeDetail recipeId={id} />
    </AuthenticatedLayout>
  );
}
```

```tsx
// src/app/recipes/[id]/loading.tsx  — wrap AuthenticatedLayout, dark Skeletons (back + header + 2-col)
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { Box, Container, Skeleton } from '@mui/material';

export default function RecipeDetailLoading() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Skeleton variant="text" width={90} />
        <Box sx={{ display: 'flex', gap: 2, mt: 2, mb: 3 }}>
          <Skeleton variant="rounded" width={72} height={72} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="40%" height={40} />
            <Skeleton variant="text" width="30%" />
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
          <Skeleton variant="rounded" height={240} />
          <Skeleton variant="rounded" height={240} />
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
```

```tsx
// src/app/recipes/[id]/error.tsx — mirror src/app/recipes/error.tsx EXACTLY (do NOT wrap AuthenticatedLayout)
'use client';
import { Alert, Box, Button, Container } from '@mui/material';

export default function RecipeDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Alert severity="error" sx={{ mb: 2 }}>
        {error.message || 'Failed to load recipe'}
      </Alert>
      <Box>
        <Button variant="contained" onClick={reset}>
          Try Again
        </Button>
      </Box>
    </Container>
  );
}
```

> Read the existing `src/app/recipes/error.tsx` first and match its exact structure/props (it already renders the message + a "Try Again" → `reset()`); copy it to the `[id]` folder rather than hand-rolling, to keep parity.

- [ ] **Step 4: Run green** — PASS (loading: 1; error: 2).

- [ ] **Step 5: Commit**

```bash
git add src/app/recipes/[id]
git commit -m "feat(recipes): recipe detail route (page/loading/error)"
```

---

## Task 16: List `page.tsx` rewrite

**Files:**

- Modify: `src/app/recipes/page.tsx` (rewrite the render + drop the view/edit-dialog plumbing)
- Modify: `src/app/recipes/__tests__/page.test.tsx` (rewrite to the new surface)

**Keep** (list-level concerns): `useServerPagination` + filter/search/sort state, `recipesUserData` batch load (list tags/ratings), sharing-data load (`pendingRecipeInvitations`, `sharedRecipeUsers`, `shareEmail`/`shareTags`/`shareRatings` + invite/accept/reject/remove handlers), `availableTags` load, snackbar.

**Remove** (moved into `RecipeDetail`/`RecipeEditor`): `usePersistentDialog('viewRecipe')`, `selectedRecipe`/`selectedAccessLevel`/`recipeUserData`/`editMode`/`editingRecipe`, `handleViewRecipe`/`handleEditRecipe`/`handleUpdateRecipe`/`handleDeleteRecipe`/`handleCreateRecipe`/`handleTagsChange`/`handleRatingChange`/`handleIngredientsChange`/`getIngredientName`/`hasValidIngredients`/`canEditRecipe`/`filterBlankIngredients`, the `RecipeViewDialog`, `RecipeEditorDialog`, the standalone `EmojiPicker` (the editor owns its own), `foodItems`/`foodItemsList` load (the editor self-loads via `useFoodItemSelector`).

**New render:**

- Header: `Your recipes` (Bricolage) + `<accent>{total}</accent> recipes` + a sharing icon button (`PeopleIcon`/`Icon name="group"`) with a dot when `pendingRecipeInvitations.length > 0` (artboard `DotBadge`; keep today's `Badge` semantics) + `+ New recipe` button → `setCreating(true)`.
- `<RecipeFilterBar … />` (Task 10) — same props as before.
- List: desktop `Box display={{xs:'none', md:'block'}}` → header grid + `RecipeTableRow`s; mobile `Box display={{xs:'block', md:'none'}}` → `RecipeCardMobile`s. Each row's `onOpen={() => router.push(`/recipes/${recipe.\_id}`)}`. Empty/`Alert` state preserved. Pagination preserved.
- `+ New` takeover: when `creating`, render `<RecipeEditor mode="create" availableTags={availableTags} onSaved={(r) => { setCreating(false); router.push(`/recipes/${r.\_id}`); }} onClose={() => setCreating(false)} />` **in place of** the list (early return inside the authenticated layout), matching the full-page-takeover artboard.
- Sharing: `<RecipeSharingDialog open={shareOpen} … />` (Task 11) wired to the kept sharing handlers.
- **Old deep-link redirect:** on mount, read `useSearchParams()`; if `viewRecipe === 'true'` and `viewRecipe_recipeId` present → `router.replace(`/recipes/${id}`)`; if `viewRecipe` present without an id → `router.replace('/recipes')` (strip the param). Keep the `Suspense` wrapper (the page already uses `useSearchParams`).

- [ ] **Step 1: Write the failing tests** (rewrite `page.test.tsx`; mock navigation + the editor; use MSW for `/api/recipes`). Minimum cases:

```tsx
// src/app/recipes/__tests__/page.test.tsx (key cases — port the rest from the old file where still relevant)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../vitest.setup';
import RecipesPage from '../page';

const push = vi.fn();
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock('next/navigation', async (orig) => ({
  ...(await orig<typeof import('next/navigation')>()),
  useRouter: () => ({ push, replace, back: vi.fn() }),
  useSearchParams: () => searchParams,
  usePathname: () => '/recipes',
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'me' } }, status: 'authenticated' }),
}));
vi.mock('@/components/recipes/RecipeEditor', () => ({
  RecipeEditor: () => <div data-testid="recipe-editor" />,
}));

const recipesPayload = {
  data: [
    {
      _id: 'r1',
      title: 'Lemon pasta',
      emoji: '🍝',
      isGlobal: false,
      createdBy: 'me',
      updatedAt: '2026-05-04T00:00:00Z',
      accessLevel: 'private',
      ingredients: [],
      instructions: '',
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

afterEach(() => {
  cleanup();
  push.mockClear();
  replace.mockClear();
  searchParams = new URLSearchParams();
});

describe('RecipesPage (list)', () => {
  it('renders recipes and navigates to the detail route on row click', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () => HttpResponse.json(recipesPayload)),
      http.post('/api/recipes/user-data/batch', () => HttpResponse.json({ data: {} })),
      http.get('/api/recipes/tags', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/invitations', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/shared-users', () => HttpResponse.json([]))
    );
    render(<RecipesPage />);
    await waitFor(() => expect(screen.getByText('Lemon pasta')).toBeInTheDocument());
    await user.click(screen.getByText('Lemon pasta'));
    expect(push).toHaveBeenCalledWith('/recipes/r1');
  });

  it('+ New recipe opens the editor takeover', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () => HttpResponse.json(recipesPayload)),
      http.post('/api/recipes/user-data/batch', () => HttpResponse.json({ data: {} })),
      http.get('/api/recipes/tags', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/invitations', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/shared-users', () => HttpResponse.json([]))
    );
    render(<RecipesPage />);
    await waitFor(() => screen.getByText('Lemon pasta'));
    await user.click(screen.getByRole('button', { name: /new recipe/i }));
    expect(screen.getByTestId('recipe-editor')).toBeInTheDocument();
  });

  it('redirects the legacy ?viewRecipe deep-link to the new route', async () => {
    searchParams = new URLSearchParams('viewRecipe=true&viewRecipe_recipeId=r9');
    server.use(
      http.get('/api/recipes', () => HttpResponse.json({ ...recipesPayload, data: [] })),
      http.post('/api/recipes/user-data/batch', () => HttpResponse.json({ data: {} })),
      http.get('/api/recipes/tags', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/invitations', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/shared-users', () => HttpResponse.json([]))
    );
    render(<RecipesPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/recipes/r9'));
  });

  it('strips a bare ?viewRecipe (no id) to /recipes', async () => {
    searchParams = new URLSearchParams('viewRecipe=true');
    server.use(
      http.get('/api/recipes', () => HttpResponse.json({ ...recipesPayload, data: [] })),
      http.post('/api/recipes/user-data/batch', () => HttpResponse.json({ data: {} })),
      http.get('/api/recipes/tags', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/invitations', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/shared-users', () => HttpResponse.json([]))
    );
    render(<RecipesPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/recipes'));
  });
});
```

> Check the exact endpoint paths (`fetchRecipeUserDataBatch`, `fetchUserTags`, sharing utils) the page calls and stub each in MSW so the page settles. Reference the OLD `page.test.tsx` for the established MSW handler set; reuse what's still valid.

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement** the rewrite per the spec above. Keep the `Suspense` + `RecipesPageContent` split. Default export stays `RecipesPage`.

- [ ] **Step 4: Run green** — PASS. Also run the full recipes route test file.

- [ ] **Step 5: Commit**

```bash
git add src/app/recipes/page.tsx src/app/recipes/__tests__/page.test.tsx
git commit -m "feat(recipes): redesign list (cards/table + chip filters + detail-route nav)"
```

---

## Task 17: Tap-a-recipe-to-open in `EditorItemRow` + test

**Files:**

- Modify: `src/components/meal-plans/EditorItemRow.tsx`
- Modify/Create: `src/components/meal-plans/__tests__/EditorItemRow.test.tsx` (add the nav case; create the file if absent)

**Design (spec §4, decision #3):** in `EditorItemRow`, when `item.type === 'recipe'`, the emoji+name region becomes a tap target → `router.push(`/recipes/${item.id}`)` (`useRouter` from `next/navigation`). The qty/unit/remove controls call `e.stopPropagation()` so editing still works. **Never** `window.open` / `target="_blank"` / a plain `<a href>` (PWA constraint — `router.push` stays in the standalone window). Food-item rows are unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/meal-plans/__tests__/EditorItemRow.test.tsx (add this case)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorItemRow } from '../EditorItemRow';
import { RecipeEmojiProvider } from '../recipe-emoji';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
// APPEND these cases to the EXISTING src/components/meal-plans/__tests__/EditorItemRow.test.tsx.
// Do NOT mock '../recipe-emoji' — the existing tests render the real RecipeEmojiProvider (importing
// a real export). Mocking the module would strip RecipeEmojiProvider and break those tests. Wrap the
// new renders in <RecipeEmojiProvider value={{}}> too (the recipe id needs no emoji here — we only assert push).
// The next/navigation mock above is module-scoped; the existing tests don't use the router, so it's safe.

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe('EditorItemRow recipe navigation', () => {
  it('tapping a recipe row navigates to the recipe via router.push (no target=_blank)', async () => {
    const user = userEvent.setup();
    render(
      <RecipeEmojiProvider value={{}}>
        <EditorItemRow
          item={{ type: 'recipe', id: 'r1', name: 'Pesto', quantity: 1 }}
          onQtyClick={vi.fn()}
          onUnitClick={vi.fn()}
          onRemove={vi.fn()}
        />
      </RecipeEmojiProvider>
    );
    await user.click(screen.getByText('Pesto'));
    expect(push).toHaveBeenCalledWith('/recipes/r1');
  });

  it('the remove control does not trigger navigation', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <RecipeEmojiProvider value={{}}>
        <EditorItemRow
          item={{ type: 'recipe', id: 'r1', name: 'Pesto', quantity: 1 }}
          onQtyClick={vi.fn()}
          onUnitClick={vi.fn()}
          onRemove={onRemove}
        />
      </RecipeEmojiProvider>
    );
    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
```

> Verify the exact `EditorItemRow` props + how it gets the recipe emoji (it uses `useRecipeEmoji`); align the test's `item` shape + mocks to the real component. If a meal-plan editor test already exists, append these cases rather than overwriting.

- [ ] **Step 2: Run red** — navigation not wired.

- [ ] **Step 3: Implement** — add `const router = useRouter();` (`next/navigation`). Wrap the recipe branch's emoji+name in a clickable `Box`/`ButtonBase` (`role="button"`, `cursor: 'pointer'`) with `onClick={() => router.push(`/recipes/${item.id}`)}`. Add `onClick={(e) => { e.stopPropagation(); onRemove(); }}` (and likewise for qty/unit handlers) so control clicks don't bubble to the nav target. Do **not** alter the food-item branch.

- [ ] **Step 4: Run green** — PASS. Re-run the meal-plans editor test suite to confirm no regressions (`npx vitest run src/components/meal-plans/__tests__/`).

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-plans/EditorItemRow.tsx src/components/meal-plans/__tests__/EditorItemRow.test.tsx
git commit -m "feat(meal-plans): tap a recipe in the editor to open it (in-PWA router.push)"
```

---

## Task 18: List `loading`/`error` retheme + delete orphans + cleanup

**Files:**

- Modify: `src/app/recipes/loading.tsx`, `src/app/recipes/error.tsx` (dark tokens; keep structure + their tests green).
- Delete: `src/components/RecipeViewDialog.tsx`, `src/components/RecipeEditorDialog.tsx`, `src/components/RecipeSharingSection.tsx`.
- Delete: `src/components/RecipeFilterBar.tsx`, `src/components/RecipeStarRating.tsx`, `src/components/RecipeTagsEditor.tsx`, `src/components/RecipeIngredients.tsx`, `src/components/RecipeInstructionsView.tsx` (replaced under `recipes/`).
- Delete their tests: `src/components/__tests__/{RecipeFilterBar,RecipeStarRating,RecipeTagsEditor,RecipeIngredients,RecipeInstructionsView}.test.tsx`.
- Delete `src/components/IngredientInput.tsx`, `src/components/IngredientGroup.tsx` + tests **iff** `grep -rlE "IngredientInput|IngredientGroup" src` returns nothing after the above (it should — only the deleted dialogs + `RecipeIngredients` used them).
- **Keep** `src/components/EmojiPicker.tsx` (shopping-lists imports it — chunk 5).

- [ ] **Step 1: Pre-flight grep** — before deleting anything, run:

```bash
grep -rlE "RecipeViewDialog|RecipeEditorDialog|RecipeSharingSection|components/RecipeFilterBar|components/RecipeStarRating|components/RecipeTagsEditor|components/RecipeIngredients|components/RecipeInstructionsView|IngredientInput|IngredientGroup" src
```

Confirm the only remaining references are the files being deleted themselves. Any **other** importer → fix it to use the new `recipes/*` component (or keep the old file) before deleting.

- [ ] **Step 2: Retheme `loading.tsx`/`error.tsx`** — swap colors to tokens; keep the existing tests passing (`src/app/recipes/__tests__/{loading,error}.test.tsx` assert skeletons / message + Try-Again — don't break those contracts).

- [ ] **Step 3: Delete the orphaned files + tests** (per the grep result).

- [ ] **Step 4: Run the recipes + meal-plans suites**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/recipes src/app/recipes src/components/meal-plans/__tests__/EditorItemRow.test.tsx`
Expected: all green; no "module not found" from a dangling import.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/recipes src/components
git commit -m "chore(recipes): retheme list loading/error + remove old recipe dialogs/components"
```

---

## Self-Review (run before declaring the plan done)

**1. Spec coverage** (§4 chunk-4 row + §4 routing note + the 2026-05-29 tap-to-open carryover + §4 chunk-4 test list):

- [ ] Full-page recipe view route `/recipes/[id]` with `loading`/`error` → Tasks 14, 15.
- [ ] Old `?viewRecipe=` redirect → Task 16.
- [ ] Per-invitee Tags/Ratings sharing → Task 11.
- [ ] Inline prep instructions per ingredient → Tasks 7, 8.
- [ ] Tags + star rating (per-user, `RecipeUserData`) → Tasks 2, 4, 13, 14.
- [ ] Groups + standalone ingredients → Tasks 7, 9.
- [ ] Tap-a-recipe-from-a-meal-plan with `router.push` (NOT `target="_blank"`/`window.open`) → Task 17 (asserts `push('/recipes/<id>')`).
- [ ] Chunk-4 test list: `loading`/`error` render (15), deep-link to `/recipes/[id]` (14/16), old `?viewRecipe=` redirect — both the `+id` and bare-no-id branches (16), tap-to-open (17). **async-params resolution:** the `await params` in `[id]/page.tsx` is trivial Next plumbing and is **not** unit-tested — matching chunk-3's `[id]` route, which has no `page.test.tsx` (server async params aren't meaningfully testable in jsdom). ✔
- [ ] No schema/API change — only `recipe-*-utils` **calls**; no edits under `src/app/api/recipes/**` or `src/types/recipe*`.

**2. Placeholder scan** — every code step has real code or a precise port-from-X instruction with the exact source file. No "TBD"/"add validation"/"similar to Task N".

**3. Type consistency** — `RecipeIngredientList`/`RecipeIngredient`/`RecipeUserDataResponse`/`SharedUser`/`PendingRecipeInvitation` used identically across tasks; `validateRecipeIngredients` defined once (Task 9), imported by Task 13; `accessLevelMeta`/`formatIngredientQty`/`recipeIngredientCount` defined once (Task 1).

**4. Reuse correctness** — `ConfirmDialog`, `QtyEditor`, `UnitEditor` reused from `@/components/meal-plans/` with their verified props; `EmojiPicker` `FOOD_EMOJIS` exported from the kept `@/components/EmojiPicker`. Verify each import path resolves at implementation time.

---

## Post-implementation (the rest of the chunk loop — NOT part of this plan's tasks)

After Task 18, the executor returns control. The chunk then continues per spec §5:

1. **`/review-code --base redesign-chunk-03`** (auto-fix loop). **Base note:** the `b9be176` back-merge of `main` sits between the `redesign-chunk-03` tag and chunk-4 work — re-base the review on the **post-merge commit** (the chunk-3 ledger entry records this) so the tag diff isn't polluted by the main merge. If `redesign-chunk-03...HEAD` shows main's files, use `--base <post-merge-commit>` instead.
2. **`npm run check`** (only with NO dev server running — Turbopack/`.next` collision).
3. **`/manual-testing chunk-04-recipes`** → seeds the local dev DB, posts a checklist comment to PR #89.
4. **Push** → CI + beta deploy.
5. **Execute the manual checklist locally via Chrome** (the gate). Use chrome-devtools-mcp for mobile-viewport checks (390px) per the established workflow.
6. **HARD STOP — do not tag or mark done.** Present a summary; leave the chunk **in-progress** for the user's review. Only after approval: tag `redesign-chunk-04`, flip the ledger row to `done` (record tag/PR-comment/date + any mid-impl carryovers), back-merge `main` if it moved, compact.

**Manual-test focus (destructive paths on the shared prod DB — smoke each):** recipe **delete** (editor + detail ⋯), create, edit-save (verify same payload shape), sharing invite/accept/reject/remove. And the PWA-critical case: **tap a recipe inside a meal-plan editor → opens `/recipes/<id>` within the installed PWA** (test on an installed beta PWA, not just desktop Chrome).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/redesign-chunk-04-recipes-plan.md`.**

Per spec §5 step 0, Recipes is one of the three interaction-heavy chunks (3/4/5) that get **`/review-plan` before implementing**. Recommended sequence:

1. **`/review-plan`** this plan (red-team it; fold revisions).
2. Then execute via **`superpowers:subagent-driven-development`** — fresh subagent per task, two-stage review between tasks, Tasks 1→18 in order.

Two execution options for the build itself:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks.
2. **Inline Execution** — `superpowers:executing-plans`, batched with checkpoints.
