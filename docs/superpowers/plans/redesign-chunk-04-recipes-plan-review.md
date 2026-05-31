# Chunk 4 — Recipes Plan Review (`/review-plan`)

**Reviewed:** `docs/superpowers/plans/redesign-chunk-04-recipes-plan.md` (2927 lines, 18 tasks)
**Date:** 2026-05-30
**Touches:** API, UI, data, auth, tests, architecture
**Specialists:** architecture, security, test, code (all four, parallel, read-only)

## Verdict

- **Round 1:** REVISE BEFORE IMPLEMENTING — 0 Critical, **5 Important**, 3 Minor → all fixed.
- **Round 2** (re-review of the revised plan, targeting 0 Important): 0 Critical, **3 Important**, 1 Minor — all new (no round-1 regressions), all fixed.
- **After round 2:** 0 Critical / 0 Important after fixes.
- **Round 3** (confirmation pass — architecture, test, code, security): **all clean, `[]` from every specialist — 0 findings at any severity.** Round-2 fixes verified landed (batch stub `{ data: {} }` → empty Map, no throw; `RecipeEmojiProvider value={{}}` type-checks; `onItemCreated` wiring matches `CombinedSearch.tsx`).
- **Converged: PLAN READY — 0 Critical / 0 Important, confirmed by a clean pass.**

> One sub-threshold note (test agent, confidence 72, not actioned): Task 16's `fetchUserTags` stub returns a bare `[]` rather than `{ tags: [] }`; the util's `data.tags || []` fallback absorbs it (no throw, test passes), so it was left as-is.

## Round 2 findings + resolutions (all Fixed)

- **[Arch] Task 9 omitted `useFoodItemCreator`'s `onItemCreated`** — `onFoodItemAdded` alone does NOT append a newly-created food item; the create-new dialog would close and the item silently vanish. (Verified against `CombinedSearch.tsx:58-61`.) → Fixed: Task 9 now wires `onItemCreated` (append as a `RecipeIngredient`), references `CombinedSearch.tsx` as the precedent, and the shared-types comment + executor note updated.
- **[Test] Task 16 batch MSW stub returned `{}`** — `fetchRecipeUserDataBatch` does `Object.entries(data)` on the `{ data }` envelope; `{}` → `Object.entries(undefined)` throws, crashing all four page tests. → Fixed: all four stubs now `{ data: {} }`.
- **[Test] Task 17 `<RecipeEmojiProvider>` missing required `value` prop** — `tsc --noEmit` (typecheck hook) would reject it, blocking the commit. → Fixed: `<RecipeEmojiProvider value={{}}>`.
- **[Code, Minor] Shared-types comment misattributed `getUnitOptions`** (wrong module + `string[]` vs `{value,label}[]`). → Fixed.

**Security: clean in both rounds.** Re-verified the tags/rating routes scope writes to the caller's own `recipeUserData` (no IDOR), tap-to-open 404s for non-owners, and `canEdit` is UI-only with independent server enforcement.

---

## Round 1 findings + resolutions

## Verdict (round 1)

- **Initial:** REVISE BEFORE IMPLEMENTING — 0 Critical, **5 Important**, 3 Minor.
- **After fixes (all folded into the plan):** PLAN READY.

Every finding was a verified correction (specialists read the real source), so all were **Fixed in the plan** rather than deferred. Security came back **clean** — the plan correctly relies on the existing server-side auth (`requireApprovedSession`, creator-only delete, `$or` access scope on `GET /api/recipes/[id]`) and introduces no new API surface.

## Findings + resolutions

### Important (all Fixed)

1. **[Arch+Code] `QtyEditor`/`UnitEditor` prop mismatch** — plan's Task 8 sample used `onChange`; real props are **`onCommit`**, and `UnitEditor` **requires `quantity`** (pluralizes via `getUnitForm`). → Fixed: decision #4 + Task 8 reuse line + both code sites (`onCommit`, `quantity={ingredient.quantity}`) + the note.
2. **[Arch+Code] EmojiPicker search field** — filtered on `keywords`; `FOOD_EMOJIS` items are `{ emoji, description }`. Search would silently return nothing. → Fixed: Task 6 filter uses `e.description`; dead dual-shape guard removed; note corrected.
3. **[Code] Color-map `accentDim` → `tokens.accent.muted` is BLUE (plans), not recipe-orange** — would render blue selected-states on filter chips + selected emoji. → Fixed: Task 1 now exports `RECIPE_ACCENT_MUTED = 'rgba(232,168,107,0.16)'`; color-map row + EmojiPicker + RecipeFilterBar + prose all reference it; added a standing "never use `tokens.accent.muted` in recipe components" warning.
4. **[Test] Task 17 `vi.mock('../recipe-emoji')` breaks the existing `EditorItemRow.test.tsx`** — that file imports the real `RecipeEmojiProvider`; mocking the module strips it. → Fixed: Task 17 drops the mock, wraps the new renders in the real `<RecipeEmojiProvider>`, and notes the cases are **appended** to the existing file.
5. **[Test] Self-review falsely claimed async-params test coverage** (`15 page`) that Task 15 doesn't write. → Fixed: self-review now states async params are trivial Next plumbing, not unit-tested (matches chunk-3's `[id]` route, which has no `page.test.tsx`).

### Minor (all Fixed)

- **[Arch] Dirty-check order-sensitive on the tags array** (spurious discard prompt). → Fixed: both Task 13 comparisons sort before stringifying.
- **[Arch, tradeoff] EmojiPicker `Clear` didn't close the picker.** → Fixed: `Clear` now `onSelect('')` then `onClose()` (consistent with selecting an emoji); design text clarified.
- **[Test] Bare `?viewRecipe` (no id) strip branch untested.** → Fixed: added a fourth Task 16 redirect test asserting `router.replace('/recipes')`.

## Net effect

8 corrections, all in plan text/sample code. The plan's architecture was endorsed by all four specialists: view-as-route / editor-as-takeover fits spec §4 + chunk-3 precedent; cross-folder primitive reuse is justified; new components are non-duplicative replacements (old ones deleted after a grep guard); no schema/API change. **Ready to implement via `superpowers:subagent-driven-development`.**
