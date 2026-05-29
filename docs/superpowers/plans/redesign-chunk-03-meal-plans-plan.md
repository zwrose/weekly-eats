# Chunk 3 — Meal Plans Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Meal Plans surface to the dark-first redesign — a view-only plan detail (desktop today-hero + week strip with TODAY sliver; mobile day-card stack; expandable staples bar) plus the locked **B3 per-meal editor** (full-screen on mobile / modal on desktop) with qty numpad, unit picker, sticky combined search, flat group sections, and the 8 locked edit-decisions.

**Architecture:** The plan _detail_ is a **real route** — `src/app/meal-plans/[id]/page.tsx` (with its own `loading.tsx` + `error.tsx`) — with a **`‹ Plans` back button**, NOT a dialog. (This **deviates from spec §4**, which named recipes as "the one real routing change"; the product owner chose the route here too, to avoid stacking a meal editor dialog on top of a plan-detail dialog and to match the recipes detail pattern. Recorded as a chunk-3 deviation.) The index (`/meal-plans`) navigates to `/meal-plans/<id>`; the old `?viewMealPlan=` query-param deep-links redirect to the new path. Tapping any meal on the detail page opens the **`MealEditorDialog`** (B3 editor) — a dialog **over the page** (no dialog-on-dialog). The B3 editor is **self-contained** under `src/components/meal-plans/` and does **NOT** reuse `IngredientInput`/`IngredientGroup` (those stay untouched for recipes/chunk 4). Search and food-item-creation _logic_ is reused verbatim via the existing `useFoodItemSelector` / `useFoodItemCreator` hooks (honoring "no write-logic changes"). `useQuantityInput` is **intentionally not used** — the numpad's digit-accumulation model differs from that hook's text-field model (Task 9). The save payload is unchanged: `updateMealPlan(id, { items: MealPlanItem[] })`.

**Tech Stack:** Next.js 15 App Router, React 19, MUI v7 (`sx` + `tokens` from `@/lib/design-tokens`), `Icon` (Material Symbols) from `@/components/ui/Icon`, Vitest + RTL + MSW. Section accent = `palette.primary` (already rebound to plans-blue `#7aa7ff` centrally by `SectionThemeProvider` in `AuthenticatedLayout` — **do NOT re-wire it**; just consume `color="primary"` / `theme.palette.primary.main`, or `tokens.section.plans` for non-palette spots).

---

## Design references (read before implementing)

| Reference                                                    | What it locks                                                                                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `docs/design/weekly-eats-redesign/project/edit-decisions.md` | The 8 locked B3 edit-decisions                                                                                                   |
| `…/artboards-b3-spec.jsx`                                    | **Mobile** B3 editor — 9 frames (default, qty-numpad, unit-sheet, search, empty, skipped, invalid, cancel-confirm, remove-group) |
| `…/artboards-b3-desktop.jsx`                                 | **Desktop** B3 editor — modal dialog, inline qty/unit **popovers** (not sheets), 10 frames                                       |
| `…/artboards-n1-final.jsx`                                   | **Desktop** plan view — today-hero (B/L/D columns) + week strip + 28px vertical "TODAY" sliver                                   |
| `…/artboards-v4.jsx`                                         | **Mobile** plan view — day-card stack + expandable staples card                                                                  |
| `…/artboards-mp-desktop.jsx` / `…-mp-mobile.jsx`             | Index list (Current / Shared with you / Past), create dialog, template, sharing, history                                         |
| `…/HANDOFF.md` §"Meal plans"                                 | "today hero" + "TODAY sliver" + "Staples bar expands inline" prose                                                               |

**The artboards are inline-styled mockups.** Translate their literal hex/px to `tokens.*` + MUI `sx`. Color map (mockup `C.*` → token): `bg`→`surface.base`, `paper`→`surface.raised`, `paperHi`→`surface.elevated`, `paperPast`→`surface.sunken`, `sheet`→`surface.sheet`, `ink`→`text.primary`, `dim`→`text.secondary`, `mute`→`text.muted`, `inkPast`→`text.past`, `edge`→`border.subtle`, `edgeHi`→`border.strong`, `accent`→`tokens.section.plans` (or `primary.main`), `accentDim`→`tokens.accent.muted`, `warn`→`state.warn`, `danger`→`state.danger`, `staples`→`meal.staples`, `SECTION.B/L/D`→`meal.breakfast/lunch/dinner`.

## Locked edit-decisions (B3) — each gets ≥1 test

1. **Validation:** Done **disabled** + inline warn borders + helper text on the offending field. **No banner.** (Invalid = an item with no `id`, or a group with empty `title`.)
2. **Cancel when dirty:** confirm dialog "Discard changes?" only if dirty; clean cancel closes immediately.
3. **Per-meal notes:** dropped — no UI (schema `notes` field left untouched, never written).
4. **Recipe ×qty:** `[× 2]` chip inside the row; recipes have **no unit chip**.
5. **Skip toggle:** always available; toggling **on** with items present → confirm "Skip will clear N items"; toggling **off** leaves the meal empty.
6. **Empty states:** empty group → "No items in this group" + faint Add hint; empty meal (no items, skip off) → "No items planned yet" + faint hint pointing at the search.
7. **Remove-group:** ✕ in the group header → confirm "Remove group? '<title>' and its N items will be removed."
8. **Group container:** flat section headers always (GROUP label + title row + items as siblings); **no enclosing box**.

## Deliberate fidelity compromises (document, don't gold-plate)

- **Unit picker is a flat searchable list** (from `getUnitOptions()`), not the mockup's Volume/Weight/Countable category headers — the data model has no unit categories (spec non-goal: no category grouping). Style as B3 radio rows.
- **Index sections are built as designed (Current / Shared with you / Past · last 6 weeks), but the dedicated History _route_ is not.** All three sections use the **existing** `GET /api/meal-plans` endpoint: Current/Shared from `fetchMealPlans({ minEndDate })` + owners data, and "Past · last 6 weeks" from `fetchMealPlans({ startDate: <42d ago>, endDate: <yesterday> })` (same endpoint, different params — a plain read, no write-logic change). The design's **"View older →"** points at the existing (restyled) **`MealPlanBrowser`** accordion rather than a new `/meal-plans/history` route — that full standalone History page/route is the only piece deliberately not built (the accordion already covers browsing all past plans).
- **Create dialog keeps the MUI `DatePicker`** (read-only, picker-only) rather than the mockup's date chips — chips would require a new "next N start dates" computation; the existing `findNextAvailableMealPlanStartDate` already drives the default. Restyle only.
- **Plan-view nav arrows (‹ ›)** from `n1-final` are **dropped** (prev/next-week navigation is new logic). Keep the `⋯` menu (Delete / Share / Template).

---

## File Structure

### New files — `src/components/meal-plans/` (the redesigned surface)

| File                     | Responsibility                                                                                                                                                                                                                                                                                            | Export                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `meal-display-utils.ts`  | Pure helpers: `getEnabledMeals(template)`, `mealItemCount(items)`, `MEAL_ORDER`, `MEAL_LABEL`, `MEAL_LETTER`, `mealColorToken(mealType)`                                                                                                                                                                  | named                      |
| `MealItemLine.tsx`       | Read-mode render of one `MealItem` (recipe `× n` / food `qty unit` / ingredientGroup title+count or expanded)                                                                                                                                                                                             | named `MealItemLine`       |
| `StaplesBar.tsx`         | Collapsible accent-tinted staples row (summary → expand groups/items, `✎` Edit)                                                                                                                                                                                                                           | named `StaplesBar`         |
| `PlanViewDesktop.tsx`    | Today-hero (B/L/D columns) + "This week" strip + vertical TODAY sliver (md+)                                                                                                                                                                                                                              | named `PlanViewDesktop`    |
| `PlanViewMobile.tsx`     | Day-card stack + per-card missing-meal `+Add` (xs)                                                                                                                                                                                                                                                        | named `PlanViewMobile`     |
| `EditorItemRow.tsx`      | B3 editor row: food (name + qty chip + unit chip + remove) / recipe (emoji + name + `Recipe` tag + `× n` chip + remove)                                                                                                                                                                                   | named `EditorItemRow`      |
| `EditorGroupSection.tsx` | B3 flat group: `GROUP` label + title field + `✕` + rows + empty state                                                                                                                                                                                                                                     | named `EditorGroupSection` |
| `QtyEditor.tsx`          | Quantity numpad — bottom-sheet (xs) / popover (md+): preset pills + digit grid + Done                                                                                                                                                                                                                     | named `QtyEditor`          |
| `UnitEditor.tsx`         | Unit picker — sheet (xs) / popover (md+): searchable flat list from `getUnitOptions()`                                                                                                                                                                                                                    | named `UnitEditor`         |
| `CombinedSearch.tsx`     | Sticky bottom combined search (recipes + food items + "create new" + "new group"); wraps `useFoodItemSelector` + `useFoodItemCreator`                                                                                                                                                                     | named `CombinedSearch`     |
| `MealEditorDialog.tsx`   | B3 editor shell: header (Cancel/title/Done-disabled), skip bar, item list, confirms (discard/remove-group/skip-clear), assembles the above, emits `onSave({items,skipped,skipReason})`                                                                                                                    | named `MealEditorDialog`   |
| `ConfirmDialog.tsx`      | Small reusable confirm (title/body/primary label+color/onConfirm/onCancel) used by the editor + the plan-detail page                                                                                                                                                                                      | named `ConfirmDialog`      |
| `PlanDetail.tsx`         | The plan-detail surface (client): back button + header + `⋯` Delete menu + `StaplesBar` + responsive `PlanViewDesktop`/`PlanViewMobile`; fetches the plan by id; owns the per-meal `MealEditorDialog`, the staples editor, and the delete-confirm; persists via `updateMealPlan`/`updateMealPlanTemplate` | named `PlanDetail`         |

### New — plan-detail route `src/app/meal-plans/[id]/`

- `page.tsx` — server component: `const { id } = await params` (Next 15 async params), renders `<PlanDetail planId={id} />`.
- `loading.tsx` — dark skeleton (back button + header + a hero/strip skeleton), wrapped in `AuthenticatedLayout`.
- `error.tsx` — `'use client'` error boundary with `reset()`; dark tokens.

### Rewritten in place (kept at `src/components/` — imported by `page.tsx`)

- `MealPlanCreateDialog.tsx` — restyle to dark tokens (keep `DatePicker` + owner select + overlap helper).
- `MealPlanBrowser.tsx` — restyle year/month accordion + plan rows to dark tokens; named export added (keep default for back-compat).

### Rewritten — `src/app/meal-plans/`

- `page.tsx` — index redesign (header, Current / Shared-with-you / Past-6-weeks sections, "View older →" → restyled `MealPlanBrowser`, restyled template + sharing dialogs). Rows **navigate** to `/meal-plans/<id>` (`router.push`). **Remove the whole view-dialog plumbing** (`usePersistentDialog('viewMealPlan')`, `selectedMealPlan`, `editMode`, `validateMealPlan` whole-plan pass, `mealPlanValidationErrors`, the rendered view dialog). **Redirect old `?viewMealPlan=…&viewMealPlan_mealPlanId=<id>` deep-links** → `router.replace('/meal-plans/<id>')`. Per-meal/staples persistence + delete move to `PlanDetail`.
- `loading.tsx` — dark skeleton matching the new index.
- `error.tsx` — fix `Container maxWidth` to `xl` to match page; dark tokens.

### Deleted (orphaned after this chunk; recipes does NOT use them)

- `src/components/MealPlanViewDialog.tsx` (+ test `MealPlanViewDialog-recipe-view.test.tsx`) — the dialog is replaced by the `[id]` route + `PlanDetail`.
- `src/components/MealEditor.tsx` (+ tests `MealEditor.test.tsx`, `MealEditor-name-display.test.tsx`)

> **DO NOT TOUCH** `IngredientInput.tsx`, `IngredientGroup.tsx`, `RecipeIngredients.tsx` or their tests — recipes (chunk 4) still depends on them.

---

## Shared type aliases (used across tasks)

These come from `@/types/meal-plan` and `@/types/recipe` (already exist — do not redefine):

```ts
// MealItem: { type: 'recipe'|'foodItem'|'ingredientGroup'; id: string; name: string;
//            quantity?: number; unit?: string; ingredients?: RecipeIngredientList[] }
// For an ingredientGroup MealItem, ingredients[0] = { title?: string; ingredients: RecipeIngredient[] }
// RecipeIngredient: { type:'foodItem'|'recipe'; id:string; quantity:number; unit?:string; name?:string; prepInstructions?:string }
// MealPlanItem: { _id, mealPlanId, dayOfWeek, mealType, items: MealItem[], skipped?, skipReason?, notes? }
// MealPlanWithTemplate extends MealPlan { template: MealPlanTemplate }
```

The B3 editor passes meal state around as this local shape (define in `MealEditorDialog.tsx`, exported):

```ts
export interface EditableMeal {
  items: MealItem[];
  skipped: boolean;
  skipReason: string;
}
```

---

## Task 1: Meal-display pure helpers

**Files:**

- Create: `src/components/meal-plans/meal-display-utils.ts`
- Test: `src/components/meal-plans/__tests__/meal-display-utils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
  getEnabledMeals,
  mealItemCount,
  MEAL_ORDER,
  MEAL_LABEL,
  MEAL_LETTER,
} from '../meal-display-utils';
import type { MealItem } from '@/types/meal-plan';

describe('getEnabledMeals', () => {
  it('returns B/L/D in order, filtered by the template toggles (staples excluded)', () => {
    expect(getEnabledMeals({ breakfast: true, lunch: false, dinner: true, staples: true })).toEqual(
      ['breakfast', 'dinner']
    );
  });
  it('returns empty array when no meals enabled', () => {
    expect(
      getEnabledMeals({ breakfast: false, lunch: false, dinner: false, staples: false })
    ).toEqual([]);
  });
});

describe('mealItemCount', () => {
  it('counts loose items once and a group as its ingredient count', () => {
    const items: MealItem[] = [
      { type: 'recipe', id: 'r1', name: 'Pasta', quantity: 1 },
      {
        type: 'ingredientGroup',
        id: '',
        name: 'Side salad',
        ingredients: [
          {
            title: 'Side salad',
            ingredients: [
              { type: 'foodItem', id: 'f1', quantity: 1, unit: 'head' },
              { type: 'foodItem', id: 'f2', quantity: 1, unit: 'pint' },
            ],
          },
        ],
      },
    ];
    // 1 recipe + 2 group ingredients = 3
    expect(mealItemCount(items)).toBe(3);
  });
  it('returns 0 for empty', () => {
    expect(mealItemCount([])).toBe(0);
  });
});

describe('constants', () => {
  it('MEAL_ORDER is B,L,D', () => {
    expect(MEAL_ORDER).toEqual(['breakfast', 'lunch', 'dinner']);
  });
  it('label + letter maps', () => {
    expect(MEAL_LABEL.dinner).toBe('Dinner');
    expect(MEAL_LETTER.breakfast).toBe('B');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/meal-display-utils.test.ts`
Expected: FAIL — "Failed to resolve import '../meal-display-utils'".

- [ ] **Step 3: Implement**

```ts
// src/components/meal-plans/meal-display-utils.ts
import type { DayOfWeek, MealItem, MealPlanItem, MealType } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';

/** Shared contract for the read-mode plan views (desktop + mobile). */
export interface PlanViewProps {
  mealsByDay: Record<string, Partial<Record<MealType, MealPlanItem>>>;
  daysInOrder: DayOfWeek[];
  dateLabelForDay: (dow: DayOfWeek) => string;
  enabledMeals: MealType[];
  todayDow: DayOfWeek | null;
  onEditMeal: (dow: DayOfWeek, mealType: MealType) => void;
}

export const MEAL_ORDER: Exclude<MealType, 'staples'>[] = ['breakfast', 'lunch', 'dinner'];

export const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export const MEAL_LETTER: Record<string, string> = {
  breakfast: 'B',
  lunch: 'L',
  dinner: 'D',
};

/** B/L/D the template enables, in canonical order. Staples is a sibling concept, never here. */
export function getEnabledMeals(meals: { [k in MealType]?: boolean }): MealType[] {
  return MEAL_ORDER.filter((m) => meals[m]);
}

/** Total shopping-relevant lines: loose items count 1, a group counts its ingredients. */
export function mealItemCount(items: MealItem[]): number {
  return items.reduce((n, it) => {
    if (it.type === 'ingredientGroup') {
      return n + (it.ingredients?.[0]?.ingredients?.length ?? 0);
    }
    return n + 1;
  }, 0);
}

/** Meal-domain accent token for a meal type (breakfast/lunch/dinner). */
export function mealColorToken(mealType: string): string {
  if (mealType === 'breakfast') return tokens.meal.breakfast;
  if (mealType === 'lunch') return tokens.meal.lunch;
  if (mealType === 'dinner') return tokens.meal.dinner;
  return tokens.meal.staples;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/meal-display-utils.test.ts`
Expected: PASS (8 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-plans/meal-display-utils.ts src/components/meal-plans/__tests__/meal-display-utils.test.ts
git commit -m "feat(meal-plans): meal-display pure helpers (chunk 3)"
```

---

## Task 2: `MealItemLine` — read-mode item renderer

Renders one `MealItem` as a single line, matching `n1-final`/`v4` `MealItemLine`: recipe = emoji + accent-blue name + `× n` when qty≠1 + optional italic note; food = name + muted `qty unit` (unit omitted when `each`); ingredientGroup = title + `(count)`, optionally expanded with its ingredients.

**Files:**

- Create: `src/components/meal-plans/MealItemLine.tsx`
- Test: `src/components/meal-plans/__tests__/MealItemLine.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MealItemLine } from '../MealItemLine';
import type { MealItem } from '@/types/meal-plan';

afterEach(cleanup);

describe('MealItemLine', () => {
  it('recipe with qty>1 shows the name and a × multiplier (no unit)', () => {
    const item: MealItem = { type: 'recipe', id: 'r1', name: 'Thai coconut curry', quantity: 2 };
    render(<MealItemLine item={item} />);
    expect(screen.getByText('Thai coconut curry')).toBeInTheDocument();
    expect(screen.getByText(/×\s*2/)).toBeInTheDocument();
  });

  it('recipe with qty 1 shows no multiplier', () => {
    const item: MealItem = { type: 'recipe', id: 'r1', name: 'Overnight oats', quantity: 1 };
    render(<MealItemLine item={item} />);
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it('food item shows name and "qty unit", omitting unit for each', () => {
    render(
      <MealItemLine
        item={{ type: 'foodItem', id: 'f1', name: 'chicken thighs', quantity: 1.5, unit: 'lb' }}
      />
    );
    expect(screen.getByText('chicken thighs')).toBeInTheDocument();
    expect(screen.getByText(/1\.5\s*lb/)).toBeInTheDocument();

    cleanup();
    render(
      <MealItemLine
        item={{ type: 'foodItem', id: 'f2', name: 'eggs', quantity: 2, unit: 'each' }}
      />
    );
    expect(screen.getByText('eggs')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText(/each/)).not.toBeInTheDocument();
  });

  it('ingredient group shows title and ingredient count', () => {
    const item: MealItem = {
      type: 'ingredientGroup',
      id: '',
      name: 'Side salad',
      ingredients: [
        {
          title: 'Side salad',
          ingredients: [
            { type: 'foodItem', id: 'a', quantity: 1, unit: 'head' },
            { type: 'foodItem', id: 'b', quantity: 1, unit: 'pint' },
            { type: 'foodItem', id: 'c', quantity: 1, unit: 'each' },
          ],
        },
      ],
    };
    render(<MealItemLine item={item} />);
    expect(screen.getByText('Side salad')).toBeInTheDocument();
    expect(screen.getByText(/\(?\s*3\s*\)?/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/MealItemLine.test.tsx`
Expected: FAIL — cannot resolve `../MealItemLine`.

- [ ] **Step 3: Implement**

```tsx
// src/components/meal-plans/MealItemLine.tsx
'use client';

import { Box } from '@mui/material';
import type { MealItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { getUnitForm } from '@/lib/food-items-utils';

export interface MealItemLineProps {
  item: MealItem;
  /** Mute colors for past days. */
  muted?: boolean;
  /** Show a group's ingredients beneath the title (used in staples expand). */
  expandGroup?: boolean;
}

const numSx = { fontVariantNumeric: 'tabular-nums' } as const;

export function MealItemLine({ item, muted, expandGroup }: MealItemLineProps) {
  const ink = muted ? tokens.text.past : tokens.text.primary;
  const dim = muted ? tokens.text.muted : tokens.text.secondary;

  if (item.type === 'recipe') {
    return (
      <Box
        sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontSize: 13, lineHeight: 1.4 }}
      >
        <Box
          component="span"
          sx={{
            color: tokens.section.plans,
            fontWeight: 600,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </Box>
        {item.quantity != null && item.quantity !== 1 && (
          <Box component="span" sx={{ fontSize: 11, color: dim, ...numSx }}>
            × {item.quantity}
          </Box>
        )}
      </Box>
    );
  }

  if (item.type === 'foodItem') {
    const unit =
      item.unit && item.unit !== 'each' ? ` ${getUnitForm(item.unit, item.quantity ?? 1)}` : '';
    return (
      <Box
        sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontSize: 13, lineHeight: 1.4 }}
      >
        <Box
          component="span"
          sx={{
            color: ink,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </Box>
        <Box component="span" sx={{ fontSize: 11, color: dim, ...numSx }}>
          {item.quantity}
          {unit}
        </Box>
      </Box>
    );
  }

  // ingredientGroup
  const group = item.ingredients?.[0];
  const count = group?.ingredients?.length ?? 0;
  return (
    <Box sx={{ fontSize: 13, lineHeight: 1.4 }}>
      <Box component="span" sx={{ color: ink, fontWeight: 500 }}>
        {item.name || group?.title}
      </Box>
      <Box component="span" sx={{ fontSize: 11, color: dim, ml: 0.5, ...numSx }}>
        ({count})
      </Box>
      {expandGroup && group && (
        <Box
          sx={{
            pl: 1.25,
            mt: 0.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
            borderLeft: `1px solid ${tokens.border.subtle}`,
          }}
        >
          {group.ingredients.map((ing, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontSize: 13 }}>
              <Box component="span" sx={{ color: ink }}>
                {ing.name}
              </Box>
              <Box component="span" sx={{ fontSize: 11, color: dim, ...numSx }}>
                {ing.quantity}
                {ing.unit && ing.unit !== 'each' ? ` ${getUnitForm(ing.unit, ing.quantity)}` : ''}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/MealItemLine.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-plans/MealItemLine.tsx src/components/meal-plans/__tests__/MealItemLine.test.tsx
git commit -m "feat(meal-plans): MealItemLine read-mode renderer (chunk 3)"
```

---

## Task 3: `StaplesBar` — collapsible staples row

Mirrors `v4` `StaplesCard`: a bordered row with `STAPLES` (lavender `meal.staples`) + a group/`N items` summary + total count + chevron; clicking the row toggles an expanded panel listing each group and its items; a left-bordered `✎` button (accessible name "Edit staples") fires `onEdit` without toggling.

**Files:**

- Create: `src/components/meal-plans/StaplesBar.tsx`
- Test: `src/components/meal-plans/__tests__/StaplesBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaplesBar } from '../StaplesBar';
import type { MealItem } from '@/types/meal-plan';

afterEach(cleanup);

const staples: MealItem[] = [
  {
    type: 'ingredientGroup',
    id: '',
    name: 'Breakfasts',
    ingredients: [
      {
        title: 'Breakfasts',
        ingredients: [
          { type: 'foodItem', id: 'a', quantity: 1, unit: 'package' },
          { type: 'foodItem', id: 'b', quantity: 1, unit: 'bag' },
        ],
      },
    ],
  },
  { type: 'foodItem', id: 'c', name: 'eggs', quantity: 12, unit: 'each' },
];

describe('StaplesBar', () => {
  it('shows the STAPLES label and total count, collapsed by default', () => {
    render(<StaplesBar staples={staples} onEdit={vi.fn()} />);
    expect(screen.getByText('Staples')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // 2 group + 1 loose
    // collapsed: the group's child item is not shown yet
    expect(screen.queryByText('eggs')).not.toBeInTheDocument();
  });

  it('expands to list groups and items when the summary row is clicked', async () => {
    const user = userEvent.setup();
    render(<StaplesBar staples={staples} onEdit={vi.fn()} />);
    await user.click(screen.getByText('Staples'));
    expect(screen.getByText('Breakfasts')).toBeInTheDocument();
    expect(screen.getByText('eggs')).toBeInTheDocument();
  });

  it('the edit button fires onEdit and does not expand', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<StaplesBar staples={staples} onEdit={onEdit} />);
    await user.click(screen.getByRole('button', { name: /edit staples/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('eggs')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/StaplesBar.test.tsx`
Expected: FAIL — cannot resolve `../StaplesBar`.

- [ ] **Step 3: Implement**

```tsx
// src/components/meal-plans/StaplesBar.tsx
'use client';

import { useState } from 'react';
import { Box, ButtonBase, IconButton } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import type { MealItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { mealItemCount } from './meal-display-utils';
import { getUnitForm } from '@/lib/food-items-utils';

export interface StaplesBarProps {
  staples: MealItem[];
  onEdit: () => void;
}

export function StaplesBar({ staples, onEdit }: StaplesBarProps) {
  const [open, setOpen] = useState(false);
  const groups = staples.filter((s) => s.type === 'ingredientGroup');
  const loose = staples.filter((s) => s.type !== 'ingredientGroup');
  const total = mealItemCount(staples);

  const summary =
    groups.length > 0
      ? groups
          .map(
            (g) =>
              `${g.name || g.ingredients?.[0]?.title} (${g.ingredients?.[0]?.ingredients.length ?? 0})`
          )
          .join(' · ') + (loose.length ? ` · Other (${loose.length})` : '')
      : `${total} items`;

  return (
    <Box
      sx={{
        border: `1px solid ${tokens.border.subtle}`,
        borderRadius: `${tokens.radius.xl}px`,
        mb: 2.25,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
        <ButtonBase
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 2,
            py: 1.25,
            textAlign: 'left',
            justifyContent: 'flex-start',
          }}
        >
          <Box
            component="span"
            sx={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: tokens.meal.staples,
            }}
          >
            Staples
          </Box>
          <Box
            component="span"
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              color: tokens.text.secondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {summary}
          </Box>
          <Box
            component="span"
            sx={{ fontSize: 12, color: tokens.text.muted, fontVariantNumeric: 'tabular-nums' }}
          >
            {total}
          </Box>
          <Icon
            name="expand_more"
            size={18}
            color={tokens.text.muted}
            sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
          />
        </ButtonBase>
        <IconButton
          aria-label="Edit staples"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          sx={{
            borderRadius: 0,
            borderLeft: `1px solid ${tokens.border.subtle}`,
            color: tokens.text.secondary,
            px: 1.5,
          }}
        >
          <Icon name="edit" size={18} />
        </IconButton>
      </Box>
      {open && (
        <Box sx={{ px: 2, pt: 0.5, pb: 1.5, borderTop: `1px solid ${tokens.border.subtle}` }}>
          {groups.map((g, gi) => (
            <Box key={gi} sx={{ mt: 1.25 }}>
              <Box sx={{ fontSize: 12, fontWeight: 600, color: tokens.text.primary, mb: 0.5 }}>
                {g.name || g.ingredients?.[0]?.title}
              </Box>
              <Box sx={{ pl: 1.25, display: 'flex', flexDirection: 'column', gap: 0.375 }}>
                {g.ingredients?.[0]?.ingredients.map((it, i) => (
                  <Box
                    key={i}
                    sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontSize: 13 }}
                  >
                    <Box component="span" sx={{ color: tokens.text.primary }}>
                      {it.name}
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        fontSize: 12,
                        color: tokens.text.muted,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {it.quantity}
                      {it.unit && it.unit !== 'each' ? ` ${getUnitForm(it.unit, it.quantity)}` : ''}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
          {loose.length > 0 && (
            <Box sx={{ mt: 1.25 }}>
              {groups.length > 0 && (
                <Box sx={{ fontSize: 12, fontWeight: 600, color: tokens.text.primary, mb: 0.5 }}>
                  Other
                </Box>
              )}
              <Box
                sx={{
                  pl: groups.length > 0 ? 1.25 : 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.375,
                }}
              >
                {loose.map((it, i) => (
                  <Box
                    key={i}
                    sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontSize: 13 }}
                  >
                    <Box component="span" sx={{ color: tokens.text.primary }}>
                      {it.name}
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        fontSize: 12,
                        color: tokens.text.muted,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {it.quantity}
                      {it.unit && it.unit !== 'each' ? ` ${getUnitForm(it.unit, it.quantity)}` : ''}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/StaplesBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-plans/StaplesBar.tsx src/components/meal-plans/__tests__/StaplesBar.test.tsx
git commit -m "feat(meal-plans): collapsible StaplesBar (chunk 3)"
```

---

## Task 4: `PlanViewMobile` — day-card stack

Mirrors `v4`: one card per day (in `getDaysInOrder()` order), `TODAY` badge + accent ring on today's card, each enabled meal that has content/skip rendered as a `B/L/D`-lettered row; empty enabled meals collapse into faint `+ Meal` chips in the card footer. Tapping a meal row (or a `+` chip) calls `onEditMeal(dayOfWeek, mealType)`.

**Files:**

- Create: `src/components/meal-plans/PlanViewMobile.tsx`
- Test: `src/components/meal-plans/__tests__/PlanViewMobile.test.tsx`

**Shared prop interface** — defined in `meal-display-utils.ts` (Task 1), imported by both `PlanViewMobile` and `PlanViewDesktop`:

```ts
export interface PlanViewProps {
  /** Day -> that day's MealPlanItem (already keyed by the page); missing = no items. */
  mealsByDay: Record<string, Partial<Record<MealType, MealPlanItem>>>;
  daysInOrder: DayOfWeek[];
  dateLabelForDay: (dow: DayOfWeek) => string; // e.g. "Mon, May 11"
  enabledMeals: MealType[];
  todayDow: DayOfWeek | null;
  onEditMeal: (dow: DayOfWeek, mealType: MealType) => void;
}
```

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanViewMobile } from '../PlanViewMobile';
import type { PlanViewProps } from '../meal-display-utils';
import type { MealPlanItem } from '@/types/meal-plan';

afterEach(cleanup);

function mk(partial: Partial<MealPlanItem>): MealPlanItem {
  return {
    _id: 'x',
    mealPlanId: 'p',
    dayOfWeek: 'monday',
    mealType: 'dinner',
    items: [],
    ...partial,
  } as MealPlanItem;
}

const base: PlanViewProps = {
  daysInOrder: ['monday', 'tuesday'],
  enabledMeals: ['breakfast', 'lunch', 'dinner'],
  dateLabelForDay: (d) => (d === 'monday' ? 'Mon, May 11' : 'Tue, May 12'),
  todayDow: 'monday',
  onEditMeal: vi.fn(),
  mealsByDay: {
    monday: {
      dinner: mk({
        dayOfWeek: 'monday',
        mealType: 'dinner',
        items: [{ type: 'recipe', id: 'r1', name: 'Lemon ricotta pasta', quantity: 1 }],
      }),
    },
    tuesday: {
      breakfast: mk({
        dayOfWeek: 'tuesday',
        mealType: 'breakfast',
        skipped: true,
        skipReason: 'coffee only',
        items: [],
      }),
    },
  },
};

describe('PlanViewMobile', () => {
  it('renders a card per day with the date label', () => {
    render(<PlanViewMobile {...base} />);
    expect(screen.getByText('Mon, May 11')).toBeInTheDocument();
    expect(screen.getByText('Tue, May 12')).toBeInTheDocument();
  });

  it('marks today with a TODAY badge', () => {
    render(<PlanViewMobile {...base} />);
    expect(screen.getByText('TODAY')).toBeInTheDocument();
  });

  it('renders a filled meal and shows a skipped reason', () => {
    render(<PlanViewMobile {...base} />);
    expect(screen.getByText('Lemon ricotta pasta')).toBeInTheDocument();
    expect(screen.getByText(/coffee only/)).toBeInTheDocument();
  });

  it('tapping a filled meal calls onEditMeal with its day + type', async () => {
    const user = userEvent.setup();
    const onEditMeal = vi.fn();
    render(<PlanViewMobile {...base} onEditMeal={onEditMeal} />);
    await user.click(screen.getByText('Lemon ricotta pasta'));
    expect(onEditMeal).toHaveBeenCalledWith('monday', 'dinner');
  });

  it('shows + chips for enabled-but-empty meals and they call onEditMeal', async () => {
    const user = userEvent.setup();
    const onEditMeal = vi.fn();
    render(<PlanViewMobile {...base} onEditMeal={onEditMeal} />);
    // Monday breakfast + lunch are enabled but empty -> + chips
    await user.click(screen.getByRole('button', { name: /add breakfast/i }));
    expect(onEditMeal).toHaveBeenCalledWith('monday', 'breakfast');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/PlanViewMobile.test.tsx`
Expected: FAIL — cannot resolve `../PlanViewMobile`.

- [ ] **Step 3: Implement**

```tsx
// src/components/meal-plans/PlanViewMobile.tsx
'use client';

import { Box, ButtonBase } from '@mui/material';
import type { DayOfWeek, MealType, MealPlanItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { MealItemLine } from './MealItemLine';
import { MEAL_LABEL, MEAL_LETTER, mealColorToken, type PlanViewProps } from './meal-display-utils';

function MealRow({
  dow,
  mealType,
  meal,
  onEditMeal,
}: {
  dow: DayOfWeek;
  mealType: MealType;
  meal: MealPlanItem;
  onEditMeal: PlanViewProps['onEditMeal'];
}) {
  const color = mealColorToken(mealType);
  return (
    <ButtonBase
      onClick={() => onEditMeal(dow, mealType)}
      sx={{
        display: 'flex',
        gap: 1.5,
        px: 1.75,
        py: 1.375,
        borderTop: `1px solid ${tokens.border.subtle}`,
        width: '100%',
        textAlign: 'left',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
      }}
    >
      <Box
        component="span"
        sx={{
          flex: '0 0 18px',
          fontSize: 13,
          color,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
        }}
      >
        {MEAL_LETTER[mealType]}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {meal.skipped ? (
          <Box sx={{ fontSize: 13, color: tokens.text.muted, fontStyle: 'italic' }}>
            Skipped{meal.skipReason ? ` · ${meal.skipReason}` : ''}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {meal.items.map((it, i) => (
              <MealItemLine key={i} item={it} />
            ))}
          </Box>
        )}
      </Box>
    </ButtonBase>
  );
}

export function PlanViewMobile({
  mealsByDay,
  daysInOrder,
  dateLabelForDay,
  enabledMeals,
  todayDow,
  onEditMeal,
}: PlanViewProps) {
  return (
    <Box>
      {daysInOrder.map((dow) => {
        const dayMeals = mealsByDay[dow] || {};
        const filled = enabledMeals.filter((mt) => {
          const m = dayMeals[mt];
          return m && (m.skipped || (m.items && m.items.length > 0));
        });
        const missing = enabledMeals.filter((mt) => {
          const m = dayMeals[mt];
          return !m || (!m.skipped && (!m.items || m.items.length === 0));
        });
        const isToday = dow === todayDow;
        return (
          <Box
            key={dow}
            sx={{
              bgcolor: 'background.paper',
              borderRadius: `${tokens.radius.xxl}px`,
              overflow: 'hidden',
              mb: 1.5,
              border: isToday ? `1px solid ${tokens.section.plans}55` : '1px solid transparent',
              boxShadow: isToday ? tokens.shadow.card : 'none',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.75, py: 1.25 }}>
              <Box
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 17,
                  fontWeight: 700,
                  color: isToday ? tokens.section.plans : tokens.text.primary,
                  letterSpacing: '-0.015em',
                }}
              >
                {dateLabelForDay(dow)}
              </Box>
              {isToday && (
                <Box
                  component="span"
                  sx={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.16em',
                    color: tokens.section.plans,
                    bgcolor: tokens.accent.muted,
                    px: 1,
                    py: '3px',
                    borderRadius: `${tokens.radius.pill}px`,
                  }}
                >
                  TODAY
                </Box>
              )}
            </Box>
            {filled.map((mt) => (
              <MealRow
                key={mt}
                dow={dow}
                mealType={mt}
                meal={mealsByDay[dow]![mt]!}
                onEditMeal={onEditMeal}
              />
            ))}
            {missing.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.75,
                  flexWrap: 'wrap',
                  px: 1.75,
                  py: 1.25,
                  borderTop: filled.length > 0 ? `1px solid ${tokens.border.subtle}` : 'none',
                }}
              >
                {missing.map((mt) => (
                  <ButtonBase
                    key={mt}
                    onClick={() => onEditMeal(dow, mt)}
                    aria-label={`Add ${MEAL_LABEL[mt].toLowerCase()}`}
                    sx={{
                      border: `1px dashed ${tokens.border.subtle}`,
                      color: tokens.text.muted,
                      borderRadius: `${tokens.radius.md}px`,
                      px: 1.25,
                      py: 0.5,
                      fontSize: 12,
                      gap: 0.75,
                    }}
                  >
                    + {MEAL_LABEL[mt]}
                  </ButtonBase>
                ))}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/PlanViewMobile.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-plans/PlanViewMobile.tsx src/components/meal-plans/__tests__/PlanViewMobile.test.tsx
git commit -m "feat(meal-plans): PlanViewMobile day-card stack (chunk 3)"
```

---

## Task 5: `PlanViewDesktop` — today-hero + week strip + TODAY sliver

Mirrors `n1-final`: a hero card for today (accent ring) with B/L/D as three columns; beneath, a "This week" strip of the other days as compact cells in **calendar order**, with a 28px vertical **TODAY pill** inserted at today's calendar position. Past days use `surface.sunken` + `text.past` + 0.72 opacity. Clicking a meal in the hero, or a strip cell, calls `onEditMeal`. Uses `PlanViewProps` from `meal-display-utils` (Task 1).

> **TODAY sliver placement:** build the calendar-ordered day list; find today's index; render days before it, then the `TodayPill`, then days after it. If the plan is not current (`todayDow === null`), render all 7 days in the strip with **no** hero and **no** pill (fallback — keeps non-current plans viewable). Grid columns adapt: `repeat(N_before,1fr) 28px repeat(N_after,1fr)` when a pill is shown, else `repeat(7,1fr)`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanViewDesktop } from '../PlanViewDesktop';
import type { PlanViewProps } from '../meal-display-utils';
import type { MealPlanItem } from '@/types/meal-plan';

afterEach(cleanup);

function mk(p: Partial<MealPlanItem>): MealPlanItem {
  return {
    _id: 'x',
    mealPlanId: 'p',
    dayOfWeek: 'wednesday',
    mealType: 'dinner',
    items: [],
    ...p,
  } as MealPlanItem;
}

const base: PlanViewProps = {
  daysInOrder: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  enabledMeals: ['breakfast', 'lunch', 'dinner'],
  dateLabelForDay: (d) => d.slice(0, 3),
  todayDow: 'wednesday',
  onEditMeal: vi.fn(),
  mealsByDay: {
    wednesday: {
      breakfast: mk({
        dayOfWeek: 'wednesday',
        mealType: 'breakfast',
        items: [{ type: 'foodItem', id: 'f', name: 'eggs', quantity: 2, unit: 'each' }],
      }),
      dinner: mk({
        dayOfWeek: 'wednesday',
        mealType: 'dinner',
        items: [{ type: 'recipe', id: 'r', name: 'Thai coconut curry', quantity: 2 }],
      }),
    },
    monday: {
      dinner: mk({
        dayOfWeek: 'monday',
        mealType: 'dinner',
        items: [{ type: 'recipe', id: 'r2', name: 'Lemon ricotta pasta', quantity: 1 }],
      }),
    },
  },
};

describe('PlanViewDesktop', () => {
  it('renders the today hero with TODAY and the meal-label columns', () => {
    render(<PlanViewDesktop {...base} />);
    expect(screen.getByText('TODAY')).toBeInTheDocument();
    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    expect(screen.getByText('Dinner')).toBeInTheDocument();
    expect(screen.getByText('Thai coconut curry')).toBeInTheDocument();
  });

  it('renders a vertical TODAY sliver pill in the strip', () => {
    render(<PlanViewDesktop {...base} />);
    // Two "TODAY" texts: the hero badge + the vertical sliver
    expect(screen.getAllByText('TODAY').length).toBeGreaterThanOrEqual(2);
  });

  it('clicking a hero meal column calls onEditMeal', async () => {
    const user = userEvent.setup();
    const onEditMeal = vi.fn();
    render(<PlanViewDesktop {...base} onEditMeal={onEditMeal} />);
    await user.click(screen.getByText('Thai coconut curry'));
    expect(onEditMeal).toHaveBeenCalledWith('wednesday', 'dinner');
  });

  it('non-current plan: no hero, all days in strip, no sliver', () => {
    render(<PlanViewDesktop {...base} todayDow={null} />);
    expect(screen.queryByText('TODAY')).not.toBeInTheDocument();
    expect(screen.getByText('Lemon ricotta pasta')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/PlanViewDesktop.test.tsx`
Expected: FAIL — cannot resolve `../PlanViewDesktop`.

- [ ] **Step 3: Implement**

```tsx
// src/components/meal-plans/PlanViewDesktop.tsx
'use client';

import { Box, ButtonBase } from '@mui/material';
import type { DayOfWeek, MealType, MealPlanItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { MealItemLine } from './MealItemLine';
import { MEAL_LABEL, mealColorToken } from './meal-display-utils';
import type { PlanViewProps } from './meal-display-utils';

function Hero({
  dow,
  dateLabel,
  dayMeals,
  enabledMeals,
  onEditMeal,
}: {
  dow: DayOfWeek;
  dateLabel: string;
  dayMeals: Partial<Record<MealType, MealPlanItem>>;
  enabledMeals: MealType[];
  onEditMeal: PlanViewProps['onEditMeal'];
}) {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: `${tokens.radius.xxxl}px`,
        p: '22px 26px',
        border: `1px solid ${tokens.section.plans}55`,
        boxShadow: tokens.shadow.card,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25 }}>
        <Box
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 32,
            fontWeight: 700,
            color: tokens.section.plans,
            letterSpacing: '-0.02em',
          }}
        >
          {dateLabel}
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: tokens.section.plans,
            bgcolor: tokens.accent.muted,
            px: 1,
            py: '3px',
            borderRadius: `${tokens.radius.pill}px`,
          }}
        >
          TODAY
        </Box>
      </Box>
      <Box sx={{ mt: 2.25, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
        {enabledMeals.map((mt) => {
          const meal = dayMeals[mt];
          const has = meal && (meal.skipped || (meal.items && meal.items.length > 0));
          return (
            <Box key={mt}>
              <Box
                sx={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  color: mealColorToken(mt),
                  textTransform: 'uppercase',
                  mb: 1,
                }}
              >
                {MEAL_LABEL[mt]}
              </Box>
              {has ? (
                <ButtonBase
                  onClick={() => onEditMeal(dow, mt)}
                  sx={{ display: 'block', textAlign: 'left', width: '100%' }}
                >
                  {meal!.skipped ? (
                    <Box sx={{ fontSize: 13, color: tokens.text.muted, fontStyle: 'italic' }}>
                      Skipped
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {meal!.items.map((it, i) => (
                        <MealItemLine key={i} item={it} />
                      ))}
                    </Box>
                  )}
                </ButtonBase>
              ) : (
                <ButtonBase
                  onClick={() => onEditMeal(dow, mt)}
                  aria-label={`Add ${MEAL_LABEL[mt].toLowerCase()}`}
                  sx={{
                    border: `1px dashed ${tokens.border.subtle}`,
                    color: tokens.text.muted,
                    borderRadius: `${tokens.radius.md}px`,
                    px: 1.25,
                    py: 0.5,
                    fontSize: 12,
                  }}
                >
                  + Add
                </ButtonBase>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function StripCell({
  dow,
  dateLabel,
  dayMeals,
  enabledMeals,
  past,
  onEditMeal,
}: {
  dow: DayOfWeek;
  dateLabel: string;
  dayMeals: Partial<Record<MealType, MealPlanItem>>;
  enabledMeals: MealType[];
  past: boolean;
  onEditMeal: PlanViewProps['onEditMeal'];
}) {
  const ink = past ? tokens.text.past : tokens.text.primary;
  const mute = past ? tokens.text.muted : tokens.text.secondary;
  const rows = enabledMeals
    .map((mt) => ({ mt, m: dayMeals[mt] }))
    .filter(({ m }) => m && (m.skipped || (m.items && m.items.length > 0)));
  return (
    <Box
      sx={{
        bgcolor: past ? tokens.surface.sunken : 'background.paper',
        borderRadius: `${tokens.radius.lg}px`,
        p: '10px 12px',
        opacity: past ? 0.72 : 1,
        minHeight: 130,
      }}
    >
      <Box
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: 14,
          fontWeight: 700,
          color: ink,
          mb: 0.75,
        }}
      >
        {dateLabel}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.375 }}>
        {rows.map(({ mt, m }) => (
          <ButtonBase
            key={mt}
            onClick={() => onEditMeal(dow, mt)}
            sx={{
              display: 'block',
              textAlign: 'left',
              width: '100%',
              fontSize: 11,
              color: ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <Box
              component="span"
              sx={{
                color: mealColorToken(mt),
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                mr: 0.5,
              }}
            >
              {MEAL_LETTER_LOCAL[mt]}
            </Box>
            {m!.skipped ? (
              <Box component="span" sx={{ color: mute, fontStyle: 'italic' }}>
                Skipped
              </Box>
            ) : (
              m!.items[0]?.name
            )}
            {!m!.skipped && m!.items.length > 1 && (
              <Box component="span" sx={{ color: mute }}>
                {' '}
                +{m!.items.length - 1}
              </Box>
            )}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}

const MEAL_LETTER_LOCAL: Record<string, string> = { breakfast: 'B', lunch: 'L', dinner: 'D' };

function TodayPill() {
  return (
    <Box
      sx={{
        bgcolor: tokens.accent.muted,
        border: `1px solid ${tokens.section.plans}55`,
        borderRadius: `${tokens.radius.lg}px`,
        py: '10px',
        minHeight: 130,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
      }}
    >
      <Box sx={{ color: tokens.section.plans, fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
        ↑
      </Box>
      <Box
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: 11,
          fontWeight: 700,
          color: tokens.section.plans,
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          letterSpacing: '0.18em',
        }}
      >
        TODAY
      </Box>
    </Box>
  );
}

export function PlanViewDesktop({
  mealsByDay,
  daysInOrder,
  dateLabelForDay,
  enabledMeals,
  todayDow,
  onEditMeal,
}: PlanViewProps) {
  const todayIdx = todayDow ? daysInOrder.indexOf(todayDow) : -1;
  const stripDays = todayIdx >= 0 ? daysInOrder.filter((d) => d !== todayDow) : daysInOrder;
  // calendar-order split for the pill: days before today vs after
  const before = todayIdx >= 0 ? daysInOrder.slice(0, todayIdx) : [];
  const after = todayIdx >= 0 ? daysInOrder.slice(todayIdx + 1) : [];
  const showPill = todayIdx >= 0;
  const gridCols = showPill
    ? `${before.map(() => '1fr').join(' ')} 28px ${after.map(() => '1fr').join(' ')}`.trim()
    : `repeat(${daysInOrder.length}, 1fr)`;

  const renderCell = (dow: DayOfWeek) => {
    const past = todayIdx >= 0 && daysInOrder.indexOf(dow) < todayIdx;
    return (
      <StripCell
        key={dow}
        dow={dow}
        dateLabel={dateLabelForDay(dow)}
        dayMeals={mealsByDay[dow] || {}}
        enabledMeals={enabledMeals}
        past={past}
        onEditMeal={onEditMeal}
      />
    );
  };

  return (
    <Box>
      {showPill && (
        <Hero
          dow={todayDow!}
          dateLabel={dateLabelForDay(todayDow!)}
          dayMeals={mealsByDay[todayDow!] || {}}
          enabledMeals={enabledMeals}
          onEditMeal={onEditMeal}
        />
      )}
      <Box sx={{ mt: 2.75 }}>
        <Box
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: tokens.text.secondary,
            textTransform: 'uppercase',
            px: 0.5,
            pb: 1,
          }}
        >
          This week
        </Box>
        <Box
          sx={{ display: 'grid', gridTemplateColumns: gridCols, gap: 1.25, alignItems: 'stretch' }}
        >
          {showPill ? (
            <>
              {before.map(renderCell)}
              <TodayPill />
              {after.map(renderCell)}
            </>
          ) : (
            stripDays.map(renderCell)
          )}
        </Box>
      </Box>
    </Box>
  );
}
```

> Note: the unused-import lint will flag nothing here, but double-check `MEAL_LETTER` vs the local map — the hero uses `MEAL_LABEL`; the strip uses `MEAL_LETTER_LOCAL`. Keep both or import `MEAL_LETTER` from `meal-display-utils` and delete the local — pick one in implementation and run the lint hook.

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/PlanViewDesktop.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-plans/PlanViewDesktop.tsx src/components/meal-plans/__tests__/PlanViewDesktop.test.tsx
git commit -m "feat(meal-plans): PlanViewDesktop hero + week strip + TODAY sliver (chunk 3)"
```

---

## Task 6: `ConfirmDialog` — reusable confirm

Small MUI `Dialog` used for discard-changes, remove-group, skip-clear, and delete-plan. Primary button color is configurable (danger by default).

**Files:**

- Create: `src/components/meal-plans/ConfirmDialog.tsx`
- Test: `src/components/meal-plans/__tests__/ConfirmDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

afterEach(cleanup);

describe('ConfirmDialog', () => {
  it('renders title + body and fires onConfirm / onCancel', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Discard changes?"
        body="They won't be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    expect(screen.getByText(/won't be saved/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not render content when closed', () => {
    render(
      <ConfirmDialog open={false} title="X" body="Y" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.queryByText('X')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/ConfirmDialog.test.tsx`
Expected: FAIL — cannot resolve `../ConfirmDialog`.

- [ ] **Step 3: Implement**

```tsx
// src/components/meal-plans/ConfirmDialog.tsx
'use client';

import { Dialog, DialogContent, DialogActions, Button, Box } from '@mui/material';
import { tokens } from '@/lib/design-tokens';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** MUI color of the confirm button. */
  confirmColor?: 'error' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'error',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      PaperProps={{
        sx: {
          bgcolor: tokens.surface.sheet,
          borderRadius: `${tokens.radius.xxl}px`,
          border: `1px solid ${tokens.border.strong}`,
          p: 0.5,
        },
      }}
    >
      <DialogContent sx={{ pb: 1 }}>
        <Box
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: tokens.text.primary,
          }}
        >
          {title}
        </Box>
        <Box sx={{ fontSize: 13, color: tokens.text.secondary, mt: 1, lineHeight: 1.55 }}>
          {body}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} sx={{ color: tokens.text.primary }}>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} variant="contained" color={confirmColor}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/ConfirmDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-plans/ConfirmDialog.tsx src/components/meal-plans/__tests__/ConfirmDialog.test.tsx
git commit -m "feat(meal-plans): reusable ConfirmDialog (chunk 3)"
```

---

## Task 7: `EditorItemRow` — B3 food/recipe row

One row in the editor. **Food:** name (or italic warn "Pick a food or recipe" when no `id`) + qty chip + unit chip + remove (✕). **Recipe:** emoji + accent name + `Recipe` tag + `× n` chip (no unit chip) + remove. Chips are `ButtonBase`; clicking qty/unit calls back with the chip's DOM node as the popover/sheet anchor. Warn border (`state.warn`) on qty/unit chips when the row is invalid (no `id`).

**Files:**

- Create: `src/components/meal-plans/EditorItemRow.tsx`
- Test: `src/components/meal-plans/__tests__/EditorItemRow.test.tsx`

**Interface:**

```ts
export interface EditorItemRowProps {
  item: MealItem; // type 'foodItem' | 'recipe'
  invalid?: boolean; // true when item.id is empty
  onQtyClick: (anchor: HTMLElement) => void;
  onUnitClick: (anchor: HTMLElement) => void;
  onRemove: () => void;
}
```

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorItemRow } from '../EditorItemRow';
import type { MealItem } from '@/types/meal-plan';

afterEach(cleanup);

describe('EditorItemRow', () => {
  it('food row shows qty + unit chips and remove', async () => {
    const user = userEvent.setup();
    const onQty = vi.fn();
    const onUnit = vi.fn();
    const onRemove = vi.fn();
    const item: MealItem = {
      type: 'foodItem',
      id: 'f1',
      name: 'romaine',
      quantity: 1,
      unit: 'head',
    };
    render(
      <EditorItemRow item={item} onQtyClick={onQty} onUnitClick={onUnit} onRemove={onRemove} />
    );
    expect(screen.getByText('romaine')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /quantity/i }));
    expect(onQty).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /unit/i }));
    expect(onUnit).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('recipe row shows × multiplier and a Recipe tag, no unit chip', () => {
    const item: MealItem = { type: 'recipe', id: 'r1', name: 'Coconut curry', quantity: 2 };
    render(
      <EditorItemRow item={item} onQtyClick={vi.fn()} onUnitClick={vi.fn()} onRemove={vi.fn()} />
    );
    expect(screen.getByText('Coconut curry')).toBeInTheDocument();
    expect(screen.getByText('Recipe')).toBeInTheDocument();
    expect(screen.getByText(/×\s*2/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unit/i })).not.toBeInTheDocument();
  });

  it('invalid food row shows the warn placeholder', () => {
    const item: MealItem = { type: 'foodItem', id: '', name: '', quantity: 1, unit: 'cup' };
    render(
      <EditorItemRow
        item={item}
        invalid
        onQtyClick={vi.fn()}
        onUnitClick={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText(/pick a food or recipe/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/EditorItemRow.test.tsx`
Expected: FAIL — cannot resolve `../EditorItemRow`.

- [ ] **Step 3: Implement**

```tsx
// src/components/meal-plans/EditorItemRow.tsx
'use client';

import { Box, ButtonBase, IconButton } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import type { MealItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { getUnitForm } from '@/lib/food-items-utils';

export interface EditorItemRowProps {
  item: MealItem;
  invalid?: boolean;
  onQtyClick: (anchor: HTMLElement) => void;
  onUnitClick: (anchor: HTMLElement) => void;
  onRemove: () => void;
}

const chipSx = (active: boolean, warn: boolean) => ({
  height: 30,
  px: 1.25,
  borderRadius: `${tokens.radius.md}px`,
  border: `1px solid ${warn ? tokens.state.warn : active ? tokens.section.plans : tokens.border.strong}`,
  bgcolor: active ? tokens.accent.muted : 'transparent',
  color: tokens.text.primary,
  fontSize: 13,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
});

export function EditorItemRow({
  item,
  invalid,
  onQtyClick,
  onUnitClick,
  onRemove,
}: EditorItemRowProps) {
  const isRecipe = item.type === 'recipe';
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 1.25,
        borderBottom: `1px solid ${tokens.border.subtle}`,
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          fontWeight: isRecipe ? 600 : 400,
          color: isRecipe
            ? tokens.section.plans
            : invalid
              ? tokens.state.warn
              : tokens.text.primary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.name || (
          <Box component="span" sx={{ fontStyle: 'italic', color: tokens.state.warn }}>
            Pick a food or recipe
          </Box>
        )}
      </Box>
      {isRecipe && (
        <Box
          component="span"
          sx={{
            fontSize: 10,
            color: tokens.text.secondary,
            px: 0.75,
            py: '1px',
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: `${tokens.radius.xs}px`,
          }}
        >
          Recipe
        </Box>
      )}
      <ButtonBase
        aria-label="Quantity"
        onClick={(e) => onQtyClick(e.currentTarget)}
        sx={chipSx(false, Boolean(invalid && !item.name))}
      >
        {isRecipe ? `× ${item.quantity ?? 1}` : (item.quantity ?? 1)}
      </ButtonBase>
      {!isRecipe && (
        <ButtonBase
          aria-label="Unit"
          onClick={(e) => onUnitClick(e.currentTarget)}
          sx={chipSx(false, Boolean(invalid && !item.name))}
        >
          {getUnitForm(item.unit || 'cup', item.quantity ?? 1)}{' '}
          <Icon name="expand_more" size={14} color={tokens.text.muted} />
        </ButtonBase>
      )}
      <IconButton
        aria-label="Remove item"
        onClick={onRemove}
        size="small"
        sx={{ color: tokens.text.muted }}
      >
        <Icon name="close" size={18} />
      </IconButton>
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/EditorItemRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-plans/EditorItemRow.tsx src/components/meal-plans/__tests__/EditorItemRow.test.tsx
git commit -m "feat(meal-plans): EditorItemRow B3 food/recipe row (chunk 3)"
```

---

## Task 8: `EditorGroupSection` — B3 flat group

A flat group (decision 8): `GROUP` label + a title `TextField` (warn border + "Group title is required" helper when empty) + a delete `✕` (calls `onRemoveGroup`) + the group's item rows (reusing `EditorItemRow`) + empty state (decision 6: "No items in this group" + faint "+ Add ingredient" hint). No enclosing box — just a top border under the header.

**Files:**

- Create: `src/components/meal-plans/EditorGroupSection.tsx`
- Test: `src/components/meal-plans/__tests__/EditorGroupSection.test.tsx`

**Interface:**

```ts
export interface EditorGroupSectionProps {
  group: MealItem; // type 'ingredientGroup'; ingredients[0] = { title, ingredients }
  titleInvalid?: boolean; // empty title
  onTitleChange: (title: string) => void;
  onRemoveGroup: () => void;
  onQtyClick: (ingredientIndex: number, anchor: HTMLElement) => void;
  onUnitClick: (ingredientIndex: number, anchor: HTMLElement) => void;
  onRemoveIngredient: (ingredientIndex: number) => void;
  invalidIngredientIndexes: number[]; // ingredients with empty id
}
```

> The group's ingredients are `RecipeIngredient` (`{type,id,quantity,unit,name}`), not `MealItem`. `EditorItemRow` expects a `MealItem`; pass an adapter object `{ type: ing.type, id: ing.id, name: ing.name ?? '', quantity: ing.quantity, unit: ing.unit }` — it has the same shape `EditorItemRow` reads.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorGroupSection } from '../EditorGroupSection';
import type { MealItem } from '@/types/meal-plan';

afterEach(cleanup);

function group(title: string, ings: any[] = []): MealItem {
  return {
    type: 'ingredientGroup',
    id: '',
    name: title,
    ingredients: [{ title, ingredients: ings }],
  };
}

const noop = {
  onTitleChange: vi.fn(),
  onRemoveGroup: vi.fn(),
  onQtyClick: vi.fn(),
  onUnitClick: vi.fn(),
  onRemoveIngredient: vi.fn(),
  invalidIngredientIndexes: [] as number[],
};

describe('EditorGroupSection', () => {
  it('renders the GROUP label and title value', () => {
    render(
      <EditorGroupSection
        group={group('Side salad', [
          { type: 'foodItem', id: 'a', name: 'romaine', quantity: 1, unit: 'head' },
        ])}
        {...noop}
      />
    );
    expect(screen.getByText('GROUP')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Side salad')).toBeInTheDocument();
    expect(screen.getByText('romaine')).toBeInTheDocument();
  });

  it('shows the required helper and warn when title is empty', () => {
    render(<EditorGroupSection group={group('', [])} titleInvalid {...noop} />);
    expect(screen.getByText(/group title is required/i)).toBeInTheDocument();
  });

  it('shows empty state when the group has no ingredients', () => {
    render(<EditorGroupSection group={group('Sides', [])} {...noop} />);
    expect(screen.getByText(/no items in this group/i)).toBeInTheDocument();
  });

  it('remove-group button fires onRemoveGroup', async () => {
    const user = userEvent.setup();
    const onRemoveGroup = vi.fn();
    render(
      <EditorGroupSection group={group('Sides', [])} {...noop} onRemoveGroup={onRemoveGroup} />
    );
    await user.click(screen.getByRole('button', { name: /remove group/i }));
    expect(onRemoveGroup).toHaveBeenCalledTimes(1);
  });

  it('editing the title fires onTitleChange', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    render(<EditorGroupSection group={group('S', [])} {...noop} onTitleChange={onTitleChange} />);
    await user.type(screen.getByDisplayValue('S'), 'x');
    expect(onTitleChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/EditorGroupSection.test.tsx`
Expected: FAIL — cannot resolve `../EditorGroupSection`.

- [ ] **Step 3: Implement**

```tsx
// src/components/meal-plans/EditorGroupSection.tsx
'use client';

import { Box, InputBase, IconButton } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import type { MealItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { EditorItemRow } from './EditorItemRow';

export interface EditorGroupSectionProps {
  group: MealItem;
  titleInvalid?: boolean;
  onTitleChange: (title: string) => void;
  onRemoveGroup: () => void;
  onQtyClick: (ingredientIndex: number, anchor: HTMLElement) => void;
  onUnitClick: (ingredientIndex: number, anchor: HTMLElement) => void;
  onRemoveIngredient: (ingredientIndex: number) => void;
  invalidIngredientIndexes: number[];
}

export function EditorGroupSection({
  group,
  titleInvalid,
  onTitleChange,
  onRemoveGroup,
  onQtyClick,
  onUnitClick,
  onRemoveIngredient,
  invalidIngredientIndexes,
}: EditorGroupSectionProps) {
  const ings = group.ingredients?.[0]?.ingredients ?? [];
  const title = group.name ?? group.ingredients?.[0]?.title ?? '';

  return (
    <Box sx={{ mt: 1.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5, mb: 0.5 }}>
        <Box
          component="span"
          sx={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: tokens.text.secondary,
          }}
        >
          GROUP
        </Box>
        <InputBase
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Group title (required)"
          sx={{
            flex: 1,
            height: 30,
            px: 1.25,
            border: `1px solid ${titleInvalid ? tokens.state.warn : tokens.border.subtle}`,
            borderRadius: `${tokens.radius.md}px`,
            fontSize: 13,
            fontWeight: 600,
            color: tokens.text.primary,
            '& input::placeholder': { color: tokens.text.muted, opacity: 1 },
          }}
        />
        <IconButton
          aria-label="Remove group"
          onClick={onRemoveGroup}
          size="small"
          sx={{ color: tokens.text.muted }}
        >
          <Icon name="delete" size={18} />
        </IconButton>
      </Box>
      {titleInvalid && (
        <Box sx={{ fontSize: 11, color: tokens.state.warn, px: 0.5, pb: 0.5 }}>
          Group title is required
        </Box>
      )}
      <Box sx={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
        {ings.length === 0 ? (
          <Box sx={{ py: 1.75, textAlign: 'center' }}>
            <Box sx={{ fontSize: 13, color: tokens.text.muted, mb: 0.75 }}>
              No items in this group
            </Box>
          </Box>
        ) : (
          ings.map((ing, i) => (
            <EditorItemRow
              key={i}
              item={{
                type: ing.type,
                id: ing.id,
                name: ing.name ?? '',
                quantity: ing.quantity,
                unit: ing.unit,
              }}
              invalid={invalidIngredientIndexes.includes(i)}
              onQtyClick={(anchor) => onQtyClick(i, anchor)}
              onUnitClick={(anchor) => onUnitClick(i, anchor)}
              onRemove={() => onRemoveIngredient(i)}
            />
          ))
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/EditorGroupSection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-plans/EditorGroupSection.tsx src/components/meal-plans/__tests__/EditorGroupSection.test.tsx
git commit -m "feat(meal-plans): EditorGroupSection flat B3 group (chunk 3)"
```

---

## Task 9: `QtyEditor` — quantity numpad / popover

A quantity entry overlay. On mobile (xs) it's a bottom-sheet (`Drawer anchor="bottom"`); on desktop (md+) it's a `Popover` anchored to the chip. Both contain: a large readout, preset pills (¼ ½ ¾ 1 1½ 2 3), a 1–9/0/. /⌫ key grid, and Cancel/Done. Pressing a preset or digit edits a working string; Done commits the parsed number (>0) via `onCommit`.

**Files:**

- Create: `src/components/meal-plans/QtyEditor.tsx`
- Test: `src/components/meal-plans/__tests__/QtyEditor.test.tsx`

**Interface:**

```ts
export interface QtyEditorProps {
  open: boolean;
  anchorEl: HTMLElement | null; // desktop popover anchor; ignored on mobile
  value: number;
  onCommit: (qty: number) => void;
  onClose: () => void;
}
```

> Preset fraction map: `{ '¼':0.25, '½':0.5, '¾':0.75, '1':1, '1½':1.5, '2':2, '3':3 }`. Use `useMediaQuery(theme.breakpoints.up('md'))` to pick Popover vs Drawer — both render the same `<NumpadBody>`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QtyEditor } from '../QtyEditor';

afterEach(cleanup);

describe('QtyEditor', () => {
  it('digit entry then Done commits the parsed number', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<QtyEditor open anchorEl={null} value={1} onCommit={onCommit} onClose={vi.fn()} />);
    // clear via backspace then type 2 5
    await user.click(screen.getByRole('button', { name: 'backspace' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '5' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onCommit).toHaveBeenCalledWith(25);
  });

  it('a preset pill sets the value', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<QtyEditor open anchorEl={null} value={1} onCommit={onCommit} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '½' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onCommit).toHaveBeenCalledWith(0.5);
  });

  it('Cancel closes without committing', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const onClose = vi.fn();
    render(<QtyEditor open anchorEl={null} value={1} onCommit={onCommit} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  // jsdom's matchMedia is undefined → useMediaQuery defaults to false (Drawer/mobile).
  // Force the desktop Popover branch so it isn't shipped untested.
  it('desktop branch: renders the numpad in a Popover and commits', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(<QtyEditor open anchorEl={anchor} value={1} onCommit={onCommit} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '½' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onCommit).toHaveBeenCalledWith(0.5);
    vi.unstubAllGlobals();
  });
});
```

> The desktop test stubs `matchMedia → matches:true` so `useMediaQuery(up('md'))` returns true and the `Popover` branch renders. Without this, jsdom always exercises only the `Drawer` branch.

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/QtyEditor.test.tsx`
Expected: FAIL — cannot resolve `../QtyEditor`.

- [ ] **Step 3: Implement**

```tsx
// src/components/meal-plans/QtyEditor.tsx
'use client';

import { useEffect, useState } from 'react';
import { Box, Button, ButtonBase, Drawer, Popover, useMediaQuery, useTheme } from '@mui/material';
import { tokens } from '@/lib/design-tokens';

export interface QtyEditorProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  value: number;
  onCommit: (qty: number) => void;
  onClose: () => void;
}

const PRESETS: [string, number][] = [
  ['¼', 0.25],
  ['½', 0.5],
  ['¾', 0.75],
  ['1', 1],
  ['1½', 1.5],
  ['2', 2],
  ['3', 3],
];

function NumpadBody({
  value,
  onCommit,
  onClose,
}: {
  value: number;
  onCommit: (q: number) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const press = (k: string) => {
    if (k === '⌫') setDraft((d) => d.slice(0, -1));
    else if (k === '.') setDraft((d) => (d.includes('.') ? d : d + '.'));
    else setDraft((d) => (d === '0' ? k : d + k));
  };
  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n) && n > 0) onCommit(n);
  };

  return (
    <Box sx={{ p: 2, minWidth: 280 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Button onClick={onClose} sx={{ color: tokens.text.secondary }}>
          Cancel
        </Button>
        <Box
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 700,
            color: tokens.text.primary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {draft || '0'}
        </Box>
        <Button onClick={commit} sx={{ color: tokens.section.plans, fontWeight: 600 }}>
          Done
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
        {PRESETS.map(([label, n]) => (
          <ButtonBase
            key={label}
            onClick={() => setDraft(String(n))}
            sx={{
              height: 28,
              px: 1.5,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: `${tokens.radius.pill}px`,
              color: tokens.text.secondary,
              fontSize: 12,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {label}
          </ButtonBase>
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
          <ButtonBase
            key={k}
            aria-label={k === '⌫' ? 'backspace' : k}
            onClick={() => press(k)}
            sx={{
              height: 50,
              borderRadius: `${tokens.radius.xl}px`,
              border: `1px solid ${tokens.border.subtle}`,
              bgcolor: /\d/.test(k) ? tokens.surface.raised : 'transparent',
              color: tokens.text.primary,
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            {k}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}

export function QtyEditor({ open, anchorEl, value, onCommit, onClose }: QtyEditorProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const body = (
    <NumpadBody
      value={value}
      onCommit={(n) => {
        onCommit(n);
        onClose();
      }}
      onClose={onClose}
    />
  );

  if (isDesktop) {
    return (
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{
          sx: {
            bgcolor: tokens.surface.sheet,
            borderRadius: `${tokens.radius.xl}px`,
            border: `1px solid ${tokens.border.subtle}`,
          },
        }}
      >
        {body}
      </Popover>
    );
  }
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          bgcolor: tokens.surface.sheet,
          borderTopLeftRadius: tokens.radius.sheet,
          borderTopRightRadius: tokens.radius.sheet,
        },
      }}
    >
      {body}
    </Drawer>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/QtyEditor.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-plans/QtyEditor.tsx src/components/meal-plans/__tests__/QtyEditor.test.tsx
git commit -m "feat(meal-plans): QtyEditor numpad/popover (chunk 3)"
```

---

## Task 10: `UnitEditor` — unit picker sheet / popover

Searchable flat unit list (from `getUnitOptions()`), styled as B3 radio rows; selecting one commits the unit. Sheet on mobile, popover on desktop (same responsive pattern as `QtyEditor`). The displayed label uses `getUnitForm(option.value, quantity)` so it matches qty pluralization.

**Files:**

- Create: `src/components/meal-plans/UnitEditor.tsx`
- Test: `src/components/meal-plans/__tests__/UnitEditor.test.tsx`

**Interface:**

```ts
export interface UnitEditorProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  value: string; // current unit (singular)
  quantity: number; // for plural display
  onCommit: (unit: string) => void;
  onClose: () => void;
}
```

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnitEditor } from '../UnitEditor';

afterEach(cleanup);

describe('UnitEditor', () => {
  it('lists units and commits the selected one', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <UnitEditor
        open
        anchorEl={null}
        value="cup"
        quantity={1}
        onCommit={onCommit}
        onClose={vi.fn()}
      />
    );
    // "pint" exists in the FOOD_UNITS list
    await user.click(screen.getByRole('button', { name: /^pint/i }));
    expect(onCommit).toHaveBeenCalledWith('pint');
  });

  it('search filters the list', async () => {
    const user = userEvent.setup();
    render(
      <UnitEditor
        open
        anchorEl={null}
        value="cup"
        quantity={1}
        onCommit={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await user.type(screen.getByPlaceholderText(/search units/i), 'gal');
    expect(screen.getByRole('button', { name: /^gallon/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^pint/i })).not.toBeInTheDocument();
  });

  // Force the desktop Popover branch (jsdom otherwise only exercises the Drawer).
  it('desktop branch: renders the picker in a Popover and commits a selection', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(
      <UnitEditor
        open
        anchorEl={anchor}
        value="cup"
        quantity={1}
        onCommit={onCommit}
        onClose={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: /^pint/i }));
    expect(onCommit).toHaveBeenCalledWith('pint');
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/UnitEditor.test.tsx`
Expected: FAIL — cannot resolve `../UnitEditor`.

- [ ] **Step 3: Implement**

```tsx
// src/components/meal-plans/UnitEditor.tsx
'use client';

import { useMemo, useState } from 'react';
import {
  Box,
  ButtonBase,
  InputBase,
  Drawer,
  Popover,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { getUnitOptions, getUnitForm } from '@/lib/food-items-utils';

export interface UnitEditorProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  value: string;
  quantity: number;
  onCommit: (unit: string) => void;
  onClose: () => void;
}

function PickerBody({
  value,
  quantity,
  onCommit,
}: {
  value: string;
  quantity: number;
  onCommit: (u: string) => void;
}) {
  const [q, setQ] = useState('');
  const options = useMemo(() => getUnitOptions(), []);
  const filtered = options.filter((o) => o.value.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Box sx={{ p: 1.5, minWidth: 280, maxHeight: 360, display: 'flex', flexDirection: 'column' }}>
      <InputBase
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search units"
        sx={{
          mb: 1,
          px: 1.5,
          py: 1,
          bgcolor: tokens.surface.elevated,
          border: `1px solid ${tokens.border.strong}`,
          borderRadius: `${tokens.radius.lg}px`,
          fontSize: 13,
          color: tokens.text.primary,
          '& input::placeholder': { color: tokens.text.muted, opacity: 1 },
        }}
      />
      <Box sx={{ overflowY: 'auto' }}>
        {filtered.map((o) => {
          const selected = o.value === value;
          return (
            <ButtonBase
              key={o.value}
              onClick={() => onCommit(o.value)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                width: '100%',
                justifyContent: 'flex-start',
                textAlign: 'left',
                px: 1.5,
                py: 1.125,
                borderRadius: `${tokens.radius.md}px`,
                bgcolor: selected ? tokens.accent.muted : 'transparent',
              }}
            >
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: `1.5px solid ${selected ? tokens.section.plans : tokens.border.strong}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {selected && (
                  <Box
                    sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tokens.section.plans }}
                  />
                )}
              </Box>
              <Box
                sx={{
                  flex: 1,
                  fontSize: 14,
                  color: tokens.text.primary,
                  fontWeight: selected ? 600 : 500,
                }}
              >
                {getUnitForm(o.value, quantity)}
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

export function UnitEditor({
  open,
  anchorEl,
  value,
  quantity,
  onCommit,
  onClose,
}: UnitEditorProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const body = (
    <PickerBody
      value={value}
      quantity={quantity}
      onCommit={(u) => {
        onCommit(u);
        onClose();
      }}
    />
  );

  if (isDesktop) {
    return (
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{
          sx: {
            bgcolor: tokens.surface.sheet,
            borderRadius: `${tokens.radius.xl}px`,
            border: `1px solid ${tokens.border.subtle}`,
          },
        }}
      >
        {body}
      </Popover>
    );
  }
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          bgcolor: tokens.surface.sheet,
          borderTopLeftRadius: tokens.radius.sheet,
          borderTopRightRadius: tokens.radius.sheet,
        },
      }}
    >
      {body}
    </Drawer>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/UnitEditor.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-plans/UnitEditor.tsx src/components/meal-plans/__tests__/UnitEditor.test.tsx
git commit -m "feat(meal-plans): UnitEditor picker sheet/popover (chunk 3)"
```

---

## Task 11: `CombinedSearch` — sticky bottom combined search

The B3 sticky search: a single input over a results dropdown. Reuses `useFoodItemSelector({ allowRecipes: true, excludeIds, onCreateRequested })` for the search/options/keyboard logic (unchanged data path) and `useFoodItemCreator({ onFoodItemAdded })` + `AddFoodItemDialog` for the create-new-food flow. Results are grouped: **Recipes**, **Food items**, then **Create** actions (`Add "<q>" as new food item`, `New group with "<q>"`). Selecting emits the right callback; the input clears after.

**Files:**

- Create: `src/components/meal-plans/CombinedSearch.tsx`
- Test: `src/components/meal-plans/__tests__/CombinedSearch.test.tsx`

**Interface:**

```ts
import type { FoodItem } from '@/lib/hooks/use-food-item-selector';

export interface CombinedSearchProps {
  excludeIds: string[]; // ids already in this meal (food + recipe)
  onAddFood: (item: FoodItem) => void; // selected an existing food item
  onAddRecipe: (recipe: { _id: string; title: string; emoji?: string }) => void;
  onAddGroup: (title: string) => void; // "New group with X"
  onFoodItemAdded: (item: FoodItem) => Promise<void>; // after creating a new food item (also auto-adds it)
}
```

> **Create flow:** when there are no matching options and the user hits Enter (or clicks `Add "<q>" as new`), call `creator.openDialog(query)`. `useFoodItemCreator({ onFoodItemAdded, onItemCreated })` — wire `onItemCreated` so the freshly created item is **also added to the meal** (calls `onAddFood(newItem)`), matching today's IngredientInput auto-select behavior. `onFoodItemAdded` is the parent's "also push into local foodItems cache" hook.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../vitest.setup';
import { CombinedSearch } from '../CombinedSearch';

// MSW is globally active (vitest.setup.ts). Do NOT stub global.fetch — override
// handlers per-test via server.use(); afterEach in the global setup resets them.
afterEach(cleanup);

function props(over = {}) {
  return {
    excludeIds: [],
    onAddFood: vi.fn(),
    onAddRecipe: vi.fn(),
    onAddGroup: vi.fn(),
    onFoodItemAdded: vi.fn(),
    ...over,
  };
}

describe('CombinedSearch', () => {
  it('typing a query searches and lists a matching recipe; selecting it calls onAddRecipe', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () =>
        HttpResponse.json([{ _id: 'r1', title: 'Parmesan pasta', emoji: '🍝' }])
      ),
      http.get('/api/food-items', () => HttpResponse.json([]))
    );
    const onAddRecipe = vi.fn();
    render(<CombinedSearch {...props({ onAddRecipe })} />);
    await user.type(screen.getByPlaceholderText(/add item, recipe, or new group/i), 'parm');
    await waitFor(() => expect(screen.getByText('Parmesan pasta')).toBeInTheDocument(), {
      timeout: 2000,
    });
    await user.click(screen.getByText('Parmesan pasta'));
    expect(onAddRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'r1', title: 'Parmesan pasta' })
    );
  });

  it('offers "New group with X" and calls onAddGroup with the query', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () => HttpResponse.json([])),
      http.get('/api/food-items', () => HttpResponse.json([]))
    );
    const onAddGroup = vi.fn();
    render(<CombinedSearch {...props({ onAddGroup })} />);
    await user.type(screen.getByPlaceholderText(/add item, recipe, or new group/i), 'Sides');
    await waitFor(() => expect(screen.getByText(/new group with "Sides"/i)).toBeInTheDocument(), {
      timeout: 2000,
    });
    await user.click(screen.getByText(/new group with "Sides"/i));
    expect(onAddGroup).toHaveBeenCalledWith('Sides');
  });
});
```

> The 750ms debounce in `useFoodItemSelector` means the `waitFor` timeout must exceed it — keep 2000ms. **Use MSW `server.use()`, never `vi.stubGlobal('fetch', …)`** — MSW is globally active for `src/components/**` and stubbing fetch fights it (CLAUDE.md fetch-mocking gotcha).

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/CombinedSearch.test.tsx`
Expected: FAIL — cannot resolve `../CombinedSearch`.

- [ ] **Step 3: Implement**

```tsx
// src/components/meal-plans/CombinedSearch.tsx
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Box, InputBase } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import {
  useFoodItemSelector,
  type FoodItem,
  type SearchOption,
} from '@/lib/hooks/use-food-item-selector';
import { useFoodItemCreator } from '@/lib/hooks/use-food-item-creator';

const AddFoodItemDialog = dynamic(() => import('@/components/AddFoodItemDialog'), { ssr: false });

export interface CombinedSearchProps {
  excludeIds: string[];
  onAddFood: (item: FoodItem) => void;
  onAddRecipe: (recipe: { _id: string; title: string; emoji?: string }) => void;
  onAddGroup: (title: string) => void;
  onFoodItemAdded: (item: FoodItem) => Promise<void>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.16em',
        color: tokens.text.secondary,
        textTransform: 'uppercase',
        px: 1.5,
        pt: 1.25,
        pb: 0.5,
      }}
    >
      {children}
    </Box>
  );
}

export function CombinedSearch({
  excludeIds,
  onAddFood,
  onAddRecipe,
  onAddGroup,
  onFoodItemAdded,
}: CombinedSearchProps) {
  const [focused, setFocused] = useState(false);

  const creator = useFoodItemCreator({
    onFoodItemAdded,
    onItemCreated: (item) => onAddFood(item),
  });

  const selector = useFoodItemSelector({
    allowRecipes: true,
    excludeIds,
    onCreateRequested: (q) => creator.openDialog(q),
  });

  const handlePick = (opt: SearchOption) => {
    if (opt.isExcluded) return;
    if (opt.type === 'recipe') onAddRecipe({ _id: opt._id, title: opt.title, emoji: opt.emoji });
    else onAddFood(opt);
    selector.setInputValue('');
  };

  const recipes = selector.options.filter((o) => o.type === 'recipe');
  const foods = selector.options.filter((o) => o.type === 'foodItem');
  const q = selector.inputValue.trim();
  const showResults = focused && (selector.options.length > 0 || q.length > 0);

  return (
    <Box sx={{ position: 'sticky', bottom: 0, pt: 1.25, pb: 2, bgcolor: 'background.default' }}>
      {showResults && (
        <Box
          sx={{
            mb: 1,
            bgcolor: 'background.paper',
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: `${tokens.radius.xl}px`,
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {recipes.length > 0 && <SectionLabel>Recipes</SectionLabel>}
          {recipes.map((o) => (
            <Box
              key={o._id}
              onMouseDown={(e) => {
                e.preventDefault();
                handlePick(o);
              }}
              sx={{
                display: 'flex',
                gap: 1.25,
                alignItems: 'center',
                px: 1.5,
                py: 1,
                cursor: 'pointer',
                opacity: o.isExcluded ? 0.4 : 1,
              }}
            >
              <Box
                component="span"
                sx={{ color: tokens.section.plans, fontSize: 14, fontWeight: 600 }}
              >
                {o.type === 'recipe' ? o.title : ''}
              </Box>
            </Box>
          ))}
          {foods.length > 0 && <SectionLabel>Food items</SectionLabel>}
          {foods.map((o) => (
            <Box
              key={o._id}
              onMouseDown={(e) => {
                e.preventDefault();
                handlePick(o);
              }}
              sx={{
                px: 1.5,
                py: 1,
                cursor: 'pointer',
                fontSize: 14,
                color: tokens.text.primary,
                opacity: o.isExcluded ? 0.4 : 1,
              }}
            >
              {o.type === 'foodItem' ? o.name : ''}
            </Box>
          ))}
          {q.length > 0 && (
            <>
              <SectionLabel>Create</SectionLabel>
              <Box
                onMouseDown={(e) => {
                  e.preventDefault();
                  creator.openDialog(q);
                }}
                sx={{
                  px: 1.5,
                  py: 1,
                  cursor: 'pointer',
                  fontSize: 14,
                  color: tokens.section.plans,
                  fontWeight: 600,
                }}
              >
                + Add &quot;{q}&quot; as new food item
              </Box>
              <Box
                onMouseDown={(e) => {
                  e.preventDefault();
                  onAddGroup(q);
                  selector.setInputValue('');
                }}
                sx={{
                  px: 1.5,
                  py: 1,
                  cursor: 'pointer',
                  fontSize: 14,
                  color: tokens.section.plans,
                  fontWeight: 600,
                }}
              >
                New group with &quot;{q}&quot;
              </Box>
            </>
          )}
        </Box>
      )}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1.25,
          bgcolor: tokens.surface.elevated,
          border: `1px solid ${focused ? `${tokens.section.plans}55` : tokens.border.strong}`,
          boxShadow: focused ? tokens.shadow.card : 'none',
          borderRadius: `${tokens.radius.xl}px`,
        }}
      >
        <Icon name="search" size={18} color={tokens.text.secondary} />
        <InputBase
          inputRef={selector.autocompleteRef}
          value={selector.inputValue}
          onChange={(e) => selector.handleInputChange(e.target.value, 'input')}
          onKeyDown={selector.handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Add item, recipe, or new group"
          sx={{
            flex: 1,
            fontSize: 14,
            color: tokens.text.primary,
            '& input::placeholder': { color: tokens.text.muted, opacity: 1 },
          }}
        />
      </Box>

      <AddFoodItemDialog
        open={creator.isDialogOpen}
        onClose={creator.closeDialog}
        onAdd={creator.handleCreate}
        prefillName={creator.prefillName}
      />
    </Box>
  );
}
```

> **Why `onMouseDown`+`preventDefault`:** the input's `onBlur` would fire before a result's `onClick`, closing the list before selection. `onMouseDown` fires first; `preventDefault` keeps focus. This mirrors the no-blur-race pattern; verify in the test (clicks still work because RTL `click` dispatches mousedown).

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/CombinedSearch.test.tsx`
Expected: PASS. If the dropdown closes before the click lands, switch the result handlers to `onClick` and remove the `onBlur` timeout shortening — but the `onMouseDown` path is correct for jsdom.

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-plans/CombinedSearch.tsx src/components/meal-plans/__tests__/CombinedSearch.test.tsx
git commit -m "feat(meal-plans): CombinedSearch sticky combined search (chunk 3)"
```

---

## Task 12: `MealEditorDialog` — B3 editor shell (the core)

Assembles everything: header (Cancel / title+subtitle / Done), skip bar (decision 5), item list (loose `EditorItemRow`s + `EditorGroupSection`s, decision 8), the sticky `CombinedSearch`, `QtyEditor`/`UnitEditor` overlays, and the three confirms (`ConfirmDialog`). Owns the draft state, dirtiness, validation (decision 1), and the **search-target** model. Full-screen `Dialog` on mobile, modal on desktop (uses `responsiveDialogStyle`).

**Files:**

- Create: `src/components/meal-plans/MealEditorDialog.tsx`
- Test: `src/components/meal-plans/__tests__/MealEditorDialog.test.tsx`

### Interaction model & state

- **`draft: EditableMeal`** seeded from `props.meal` each time `open` flips true; `initial` captured for dirtiness. `dirty = JSON.stringify(draft) !== JSON.stringify(initial)`.
- **Search target** (`searchTarget: number | null`): `null` = add loose to the meal; a number = add into that group (by index). Tapping a group's empty-state/`+ Add ingredient` sets the target to that group; a small "Adding to: <title> ✕" chip above the search clears it back to `null`. "New group with X" appends a group and sets target to it.
- **Validation (decision 1):** `invalidTopIdxs` = loose items (foodItem/recipe) with empty `id`; `invalidGroupTitleIdxs` = groups with empty title; per-group `invalidIngredientIdxs` = ingredients with empty `id`. `isValid` = all three empty. Done **disabled** when `!isValid`. No banner. Warn borders via the `invalid*` props already wired in Tasks 7–8.
- **Skip (decision 5):** toggling skip ON while `draft.items.length > 0` opens the skip-clear confirm ("Skip will clear N items"); confirming sets `skipped:true, items:[]`. Toggling OFF sets `skipped:false` and leaves items as-is (empty). Skip bar hidden when `isStaples`.
- **Cancel (decision 2):** if `dirty`, open discard confirm; else close immediately. Discard confirm "Keep editing" / "Discard".
- **Remove group (decision 7):** group `✕` opens remove confirm naming the group + its N items; confirm removes the group.
- **Recipe ×qty (decision 4):** recipes render `× n` chip, no unit chip (already in `EditorItemRow`). Qty edit on a recipe still uses `QtyEditor`.
- **Empty states (decision 6):** empty meal (no items, not skipped) → "No items planned yet" + faint hint. Empty group handled by `EditorGroupSection`.
- **Save:** Done calls `onSave({ items: draft.items, skipped: draft.skipped, skipReason: draft.skipReason })`. Parent persists.

### Qty/Unit targeting

`qtyState: { open, anchor, target } | null` where `target = { groupIdx: number | null, ingIdx: number }` (groupIdx null = loose item at index ingIdx). Same for `unitState`. `QtyEditor.onCommit(n)` and `UnitEditor.onCommit(u)` write into the right place in `draft`.

- [ ] **Step 1: Write the failing tests (one per locked decision)**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MealEditorDialog, type EditableMeal } from '../MealEditorDialog';
import type { MealItem } from '@/types/meal-plan';

// MSW is globally active (vitest.setup.ts) — the inner CombinedSearch auto-loads
// /api/food-items + /api/recipes on mount; the global handlers serve those. Do
// NOT stub global.fetch (CLAUDE.md fetch-mocking gotcha).
afterEach(cleanup);

function base(meal: Partial<EditableMeal> = {}) {
  return {
    open: true,
    title: 'Monday dinner',
    subtitle: 'May 11',
    meal: { items: [], skipped: false, skipReason: '', ...meal } as EditableMeal,
    onSave: vi.fn(),
    onClose: vi.fn(),
    onFoodItemAdded: vi.fn(),
  };
}
const recipe: MealItem = { type: 'recipe', id: 'r1', name: 'Lemon ricotta pasta', quantity: 1 };
const group = (title: string, ings: any[] = []): MealItem => ({
  type: 'ingredientGroup',
  id: '',
  name: title,
  ingredients: [{ title, ingredients: ings }],
});

describe('MealEditorDialog', () => {
  it('decision 1: Done disabled when a group has no title; enabled when valid', () => {
    render(<MealEditorDialog {...base({ items: [group('')] })} />);
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
    cleanup();
    render(<MealEditorDialog {...base({ items: [recipe] })} />);
    expect(screen.getByRole('button', { name: 'Done' })).not.toBeDisabled();
  });

  it('decision 1: empty meal is valid (Done enabled) and shows the empty state', () => {
    render(<MealEditorDialog {...base()} />);
    expect(screen.getByText(/no items planned yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).not.toBeDisabled();
  });

  it('decision 3: no per-meal notes field is rendered', () => {
    render(<MealEditorDialog {...base({ items: [recipe] })} />);
    expect(screen.queryByLabelText(/notes/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/notes?/i)).not.toBeInTheDocument();
  });

  it('decision 2: clean cancel closes immediately; dirty cancel confirms', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MealEditorDialog {...base({ items: [recipe] })} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1); // clean → immediate
    cleanup();

    const onClose2 = vi.fn();
    render(<MealEditorDialog {...base({ items: [recipe] })} onClose={onClose2} />);
    // make it dirty: remove the recipe
    await user.click(screen.getByRole('button', { name: /remove item/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose2).not.toHaveBeenCalled(); // dirty → confirm first
    expect(screen.getByText(/discard changes\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose2).toHaveBeenCalledTimes(1);
  });

  it('decision 4: recipe shows × qty chip and no unit chip', () => {
    render(<MealEditorDialog {...base({ items: [{ ...recipe, quantity: 2 }] })} />);
    expect(screen.getByText(/×\s*2/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unit/i })).not.toBeInTheDocument();
  });

  it('decision 5: toggling skip on with items confirms then clears', async () => {
    const user = userEvent.setup();
    render(<MealEditorDialog {...base({ items: [recipe] })} />);
    await user.click(screen.getByRole('checkbox', { name: /skip this meal/i }));
    expect(screen.getByText(/will clear 1 item/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip anyway' }));
    expect(screen.queryByText('Lemon ricotta pasta')).not.toBeInTheDocument();
  });

  it('decision 5: toggling skip off leaves the meal empty (no items restored)', async () => {
    const user = userEvent.setup();
    render(<MealEditorDialog {...base({ items: [], skipped: true, skipReason: 'out' })} />);
    await user.click(screen.getByRole('checkbox', { name: /skip this meal/i }));
    expect(screen.getByText(/no items planned yet/i)).toBeInTheDocument();
  });

  it('decision 7: remove-group asks to confirm and names the count', async () => {
    const user = userEvent.setup();
    render(
      <MealEditorDialog
        {...base({
          items: [
            group('Side salad', [
              { type: 'foodItem', id: 'a', name: 'romaine', quantity: 1, unit: 'head' },
            ]),
          ],
        })}
      />
    );
    await user.click(screen.getByRole('button', { name: /remove group/i }));
    expect(screen.getByText(/remove group\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Side salad/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByDisplayValue('Side salad')).not.toBeInTheDocument();
  });

  it('decision 8: group renders flat (GROUP label, no nested Paper/box) with its items as siblings', () => {
    render(
      <MealEditorDialog
        {...base({
          items: [
            recipe,
            group('Sides', [
              { type: 'foodItem', id: 'a', name: 'romaine', quantity: 1, unit: 'head' },
            ]),
          ],
        })}
      />
    );
    expect(screen.getByText('GROUP')).toBeInTheDocument();
    expect(screen.getByText('romaine')).toBeInTheDocument();
  });

  it('Done emits the current items/skipped/skipReason', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<MealEditorDialog {...base({ items: [recipe] })} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onSave).toHaveBeenCalledWith({ items: [recipe], skipped: false, skipReason: '' });
  });

  it('staples mode hides the skip bar', () => {
    render(<MealEditorDialog {...base()} isStaples title="Weekly staples" />);
    expect(screen.queryByRole('checkbox', { name: /skip this meal/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/MealEditorDialog.test.tsx`
Expected: FAIL — cannot resolve `../MealEditorDialog`.

- [ ] **Step 3: Implement** (see code block below — write it verbatim, then iterate to green)

```tsx
// src/components/meal-plans/MealEditorDialog.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  Box,
  Button,
  Switch,
  FormControlLabel,
  InputBase,
  IconButton,
} from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import { responsiveDialogStyle } from '@/lib/theme';
import type { MealItem } from '@/types/meal-plan';
import type { FoodItem } from '@/lib/hooks/use-food-item-selector';
import { EditorItemRow } from './EditorItemRow';
import { EditorGroupSection } from './EditorGroupSection';
import { CombinedSearch } from './CombinedSearch';
import { QtyEditor } from './QtyEditor';
import { UnitEditor } from './UnitEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { mealItemCount } from './meal-display-utils';

export interface EditableMeal {
  items: MealItem[];
  skipped: boolean;
  skipReason: string;
}

export interface MealEditorDialogProps {
  open: boolean;
  title: string;
  subtitle?: string;
  meal: EditableMeal;
  isStaples?: boolean;
  onSave: (next: EditableMeal) => void;
  onClose: () => void;
  onFoodItemAdded: (item: FoodItem) => Promise<void>;
}

type ChipTarget = { groupIdx: number | null; ingIdx: number };

const clone = (m: EditableMeal): EditableMeal => JSON.parse(JSON.stringify(m));

export function MealEditorDialog({
  open,
  title,
  subtitle,
  meal,
  isStaples,
  onSave,
  onClose,
  onFoodItemAdded,
}: MealEditorDialogProps) {
  const [draft, setDraft] = useState<EditableMeal>(clone(meal));
  const [initial, setInitial] = useState<EditableMeal>(clone(meal));
  const [searchTarget, setSearchTarget] = useState<number | null>(null);
  const pendingTargetRef = useRef<number | null>(null);
  const [qtyState, setQtyState] = useState<{
    anchor: HTMLElement | null;
    target: ChipTarget;
  } | null>(null);
  const [unitState, setUnitState] = useState<{
    anchor: HTMLElement | null;
    target: ChipTarget;
  } | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [removeGroupIdx, setRemoveGroupIdx] = useState<number | null>(null);
  const [skipClearOpen, setSkipClearOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(clone(meal));
      setInitial(clone(meal));
      setSearchTarget(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  // ---- validation ----
  const invalidTopIdxs = draft.items.reduce<number[]>((acc, it, i) => {
    if (it.type !== 'ingredientGroup' && !it.id) acc.push(i);
    return acc;
  }, []);
  const invalidGroupTitleIdxs = draft.items.reduce<number[]>((acc, it, i) => {
    if (it.type === 'ingredientGroup' && !(it.name || it.ingredients?.[0]?.title)) acc.push(i);
    return acc;
  }, []);
  const groupInvalidIngredients = (groupIdx: number): number[] => {
    const g = draft.items[groupIdx];
    const ings = g?.ingredients?.[0]?.ingredients ?? [];
    return ings.reduce<number[]>((acc, ing, i) => {
      if (!ing.id) acc.push(i);
      return acc;
    }, []);
  };
  const anyGroupIngredientInvalid = draft.items.some(
    (it, i) => it.type === 'ingredientGroup' && groupInvalidIngredients(i).length > 0
  );
  const isValid =
    invalidTopIdxs.length === 0 && invalidGroupTitleIdxs.length === 0 && !anyGroupIngredientInvalid;

  // ---- mutations ----
  const setItems = (items: MealItem[]) => setDraft((d) => ({ ...d, items }));

  const addLooseFood = (item: FoodItem) => {
    const newItem: MealItem = {
      type: 'foodItem',
      id: item._id,
      name: item.singularName || item.name,
      quantity: 1,
      unit: item.unit || 'cup',
    };
    routeAdd(newItem, {
      type: 'foodItem',
      id: item._id,
      name: item.singularName || item.name,
      quantity: 1,
      unit: item.unit || 'cup',
    });
  };
  const addLooseRecipe = (r: { _id: string; title: string; emoji?: string }) => {
    const newItem: MealItem = { type: 'recipe', id: r._id, name: r.title, quantity: 1 };
    routeAdd(newItem, { type: 'recipe', id: r._id, name: r.title, quantity: 1 });
  };
  // route an add into the search target group, or loose
  const routeAdd = (
    looseItem: MealItem,
    ingredient: {
      type: 'foodItem' | 'recipe';
      id: string;
      name: string;
      quantity: number;
      unit?: string;
    }
  ) => {
    setDraft((d) => {
      if (searchTarget != null && d.items[searchTarget]?.type === 'ingredientGroup') {
        const items = d.items.map((it, i) => {
          if (i !== searchTarget) return it;
          const grp = it.ingredients?.[0] ?? { title: it.name, ingredients: [] };
          return {
            ...it,
            ingredients: [{ ...grp, ingredients: [...grp.ingredients, ingredient] }],
          };
        });
        return { ...d, items };
      }
      return { ...d, items: [...d.items, looseItem] };
    });
  };
  const addGroup = (groupTitle: string) => {
    // Compute the new group's index INSIDE the updater (d.items is the committed
    // state; the enclosing `draft` closure can be stale under React 19 batching).
    setDraft((d) => {
      pendingTargetRef.current = d.items.length; // index the new group will occupy
      const items = [
        ...d.items,
        {
          type: 'ingredientGroup' as const,
          id: '',
          name: groupTitle,
          ingredients: [{ title: groupTitle, ingredients: [] }],
        },
      ];
      return { ...d, items };
    });
  };
  // Apply the staged search-target after the append commits.
  useEffect(() => {
    if (pendingTargetRef.current != null) {
      setSearchTarget(pendingTargetRef.current);
      pendingTargetRef.current = null;
    }
  });
  const removeLoose = (idx: number) => setItems(draft.items.filter((_, i) => i !== idx));
  const removeIngredient = (groupIdx: number, ingIdx: number) =>
    setItems(
      draft.items.map((it, i) => {
        if (i !== groupIdx || it.type !== 'ingredientGroup') return it;
        const grp = it.ingredients![0];
        return {
          ...it,
          ingredients: [{ ...grp, ingredients: grp.ingredients.filter((_, j) => j !== ingIdx) }],
        };
      })
    );
  const setGroupTitle = (groupIdx: number, t: string) =>
    setItems(
      draft.items.map((it, i) =>
        i === groupIdx && it.type === 'ingredientGroup'
          ? { ...it, name: t, ingredients: [{ ...it.ingredients![0], title: t }] }
          : it
      )
    );

  const writeQty = (target: ChipTarget, qty: number) =>
    setItems(
      draft.items.map((it, i) => {
        if (target.groupIdx == null) return i === target.ingIdx ? { ...it, quantity: qty } : it;
        if (i !== target.groupIdx || it.type !== 'ingredientGroup') return it;
        const grp = it.ingredients![0];
        return {
          ...it,
          ingredients: [
            {
              ...grp,
              ingredients: grp.ingredients.map((ing, j) =>
                j === target.ingIdx ? { ...ing, quantity: qty } : ing
              ),
            },
          ],
        };
      })
    );
  const writeUnit = (target: ChipTarget, unit: string) =>
    setItems(
      draft.items.map((it, i) => {
        if (target.groupIdx == null) return i === target.ingIdx ? { ...it, unit } : it;
        if (i !== target.groupIdx || it.type !== 'ingredientGroup') return it;
        const grp = it.ingredients![0];
        return {
          ...it,
          ingredients: [
            {
              ...grp,
              ingredients: grp.ingredients.map((ing, j) =>
                j === target.ingIdx ? { ...ing, unit } : ing
              ),
            },
          ],
        };
      })
    );

  // ---- skip ----
  const onToggleSkip = (next: boolean) => {
    if (next && draft.items.length > 0) {
      setSkipClearOpen(true);
      return;
    }
    setDraft((d) => ({ ...d, skipped: next }));
  };

  // ---- cancel ----
  const handleCancel = () => {
    if (dirty) setDiscardOpen(true);
    else onClose();
  };

  // qty/unit current value helpers
  const targetItem = (t: ChipTarget): MealItem | undefined =>
    t.groupIdx == null
      ? draft.items[t.ingIdx]
      : (draft.items[t.groupIdx]?.ingredients?.[0]?.ingredients[t.ingIdx] as unknown as
          | MealItem
          | undefined);

  const excludeIds = useMemo(() => {
    const ids: string[] = [];
    draft.items.forEach((it) => {
      if (it.type === 'ingredientGroup')
        it.ingredients?.[0]?.ingredients.forEach((ing) => ing.id && ids.push(ing.id));
      else if (it.id) ids.push(it.id);
    });
    return ids;
  }, [draft.items]);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      fullScreen={false}
      sx={responsiveDialogStyle}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { bgcolor: tokens.surface.sheet } }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.75,
          py: 2,
          borderBottom: `1px solid ${tokens.border.subtle}`,
        }}
      >
        <Button
          onClick={handleCancel}
          sx={{ color: tokens.section.plans, minWidth: 60, justifyContent: 'flex-start' }}
        >
          Cancel
        </Button>
        <Box sx={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
            {title}
          </Box>
          {subtitle && (
            <Box sx={{ fontSize: 12, color: tokens.text.secondary }}>
              {subtitle} · {mealItemCount(draft.items)} items
            </Box>
          )}
        </Box>
        <Button
          onClick={() => onSave(draft)}
          disabled={!isValid}
          sx={{
            minWidth: 60,
            justifyContent: 'flex-end',
            fontWeight: 600,
            color: tokens.section.plans,
            '&.Mui-disabled': { color: tokens.text.muted },
          }}
        >
          Done
        </Button>
      </Box>

      {/* Skip bar */}
      {!isStaples && (
        <Box sx={{ px: 2.75, py: 1.5, borderBottom: `1px solid ${tokens.border.subtle}` }}>
          <FormControlLabel
            control={
              <Switch checked={draft.skipped} onChange={(e) => onToggleSkip(e.target.checked)} />
            }
            label="Skip this meal"
            slotProps={{ typography: { sx: { fontSize: 13 } } }}
          />
          {draft.skipped && (
            <InputBase
              value={draft.skipReason}
              onChange={(e) => setDraft((d) => ({ ...d, skipReason: e.target.value }))}
              placeholder="Reason (optional) — e.g. out for work lunch"
              sx={{
                mt: 1,
                width: '100%',
                px: 1.5,
                py: 1.25,
                bgcolor: 'transparent',
                border: `1px solid ${tokens.border.subtle}`,
                borderRadius: `${tokens.radius.lg}px`,
                fontSize: 14,
                color: tokens.text.primary,
                '& input::placeholder': { color: tokens.text.muted, opacity: 1 },
              }}
            />
          )}
        </Box>
      )}

      {/* Body */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2.75,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {draft.skipped ? (
          <Box
            sx={{
              py: 5,
              textAlign: 'center',
              color: tokens.text.secondary,
              fontSize: 13,
              fontStyle: 'italic',
            }}
          >
            This meal is skipped. Toggle off above to plan it.
          </Box>
        ) : draft.items.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Box sx={{ fontSize: 14, color: tokens.text.secondary, mb: 0.5 }}>
              No items planned yet
            </Box>
            <Box sx={{ fontSize: 12, color: tokens.text.muted }}>Add from the search below</Box>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.14em',
                color: tokens.text.secondary,
                textTransform: 'uppercase',
                mb: 0.5,
              }}
            >
              Items
            </Box>
            {draft.items.map((it, i) =>
              it.type === 'ingredientGroup' ? (
                <Box key={i} onClick={() => setSearchTarget(i)}>
                  <EditorGroupSection
                    group={it}
                    titleInvalid={invalidGroupTitleIdxs.includes(i)}
                    onTitleChange={(t) => setGroupTitle(i, t)}
                    onRemoveGroup={() => setRemoveGroupIdx(i)}
                    invalidIngredientIndexes={groupInvalidIngredients(i)}
                    onRemoveIngredient={(j) => removeIngredient(i, j)}
                    onQtyClick={(j, anchor) =>
                      setQtyState({ anchor, target: { groupIdx: i, ingIdx: j } })
                    }
                    onUnitClick={(j, anchor) =>
                      setUnitState({ anchor, target: { groupIdx: i, ingIdx: j } })
                    }
                  />
                </Box>
              ) : (
                <EditorItemRow
                  key={i}
                  item={it}
                  invalid={invalidTopIdxs.includes(i)}
                  onRemove={() => removeLoose(i)}
                  onQtyClick={(anchor) =>
                    setQtyState({ anchor, target: { groupIdx: null, ingIdx: i } })
                  }
                  onUnitClick={(anchor) =>
                    setUnitState({ anchor, target: { groupIdx: null, ingIdx: i } })
                  }
                />
              )
            )}
          </>
        )}
        <Box sx={{ flex: 1 }} />
      </Box>

      {/* Sticky search */}
      {!draft.skipped && (
        <Box sx={{ px: 2.75 }}>
          {searchTarget != null && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 0.5,
                fontSize: 12,
                color: tokens.text.secondary,
              }}
            >
              Adding to:{' '}
              {draft.items[searchTarget]?.name ||
                draft.items[searchTarget]?.ingredients?.[0]?.title}
              <IconButton
                size="small"
                aria-label="Add to meal instead"
                onClick={() => setSearchTarget(null)}
              >
                <Icon name="close" size={16} />
              </IconButton>
            </Box>
          )}
          <CombinedSearch
            excludeIds={excludeIds}
            onAddFood={addLooseFood}
            onAddRecipe={addLooseRecipe}
            onAddGroup={addGroup}
            onFoodItemAdded={onFoodItemAdded}
          />
        </Box>
      )}

      {/* Overlays */}
      <QtyEditor
        open={Boolean(qtyState)}
        anchorEl={qtyState?.anchor ?? null}
        value={qtyState ? (targetItem(qtyState.target)?.quantity ?? 1) : 1}
        onCommit={(n) => qtyState && writeQty(qtyState.target, n)}
        onClose={() => setQtyState(null)}
      />
      <UnitEditor
        open={Boolean(unitState)}
        anchorEl={unitState?.anchor ?? null}
        value={unitState ? (targetItem(unitState.target)?.unit ?? 'cup') : 'cup'}
        quantity={unitState ? (targetItem(unitState.target)?.quantity ?? 1) : 1}
        onCommit={(u) => unitState && writeUnit(unitState.target, u)}
        onClose={() => setUnitState(null)}
      />

      {/* Confirms */}
      <ConfirmDialog
        open={discardOpen}
        title="Discard changes?"
        body={`You've made changes to ${title}. They won't be saved.`}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setDiscardOpen(false);
          onClose();
        }}
        onCancel={() => setDiscardOpen(false)}
      />
      <ConfirmDialog
        open={removeGroupIdx != null}
        title="Remove group?"
        body={
          removeGroupIdx != null
            ? `"${draft.items[removeGroupIdx]?.name || draft.items[removeGroupIdx]?.ingredients?.[0]?.title}" and its ${draft.items[removeGroupIdx]?.ingredients?.[0]?.ingredients.length ?? 0} items will be removed.`
            : ''
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (removeGroupIdx != null) removeLoose(removeGroupIdx);
          setRemoveGroupIdx(null);
          setSearchTarget(null);
        }}
        onCancel={() => setRemoveGroupIdx(null)}
      />
      <ConfirmDialog
        open={skipClearOpen}
        title="Skip this meal?"
        body={`Skip will clear ${mealItemCount(draft.items)} item${mealItemCount(draft.items) === 1 ? '' : 's'} from ${title}.`}
        confirmLabel="Skip anyway"
        cancelLabel="Keep items"
        onConfirm={() => {
          setDraft((d) => ({ ...d, skipped: true, items: [] }));
          setSkipClearOpen(false);
        }}
        onCancel={() => setSkipClearOpen(false)}
      />
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/MealEditorDialog.test.tsx`
Expected: PASS (13 tests). The skip-clear confirm button uses the distinct label **"Skip anyway"** (not "Skip") precisely so it doesn't collide with the "Skip this meal" toggle label — keep it. Iterate on real failures by fixing the test selectors, not the decisions.

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-plans/MealEditorDialog.tsx src/components/meal-plans/__tests__/MealEditorDialog.test.tsx
git commit -m "feat(meal-plans): B3 MealEditorDialog shell + locked edit-decisions (chunk 3)"
```

---

## Task 13: Plan-detail **route** + `PlanDetail` component

The plan detail is now a real route `/meal-plans/[id]` with a `‹ Plans` back button. The route `page.tsx` (server) wraps a client `PlanDetail` in `AuthenticatedLayout` — keeping `PlanDetail` itself free of the auth shell so it unit-tests cleanly. `PlanDetail` fetches the plan by id, renders header + `StaplesBar` + responsive `PlanViewDesktop`/`PlanViewMobile`, owns the per-meal `MealEditorDialog` (a dialog **over the page**), the staples editor, and the delete-confirm, and persists via the existing `updateMealPlan` / `updateMealPlanTemplate`.

**Files:**

- Create: `src/app/meal-plans/[id]/page.tsx`, `src/app/meal-plans/[id]/loading.tsx`, `src/app/meal-plans/[id]/error.tsx`
- Create: `src/components/meal-plans/PlanDetail.tsx`
- Create test: `src/components/meal-plans/__tests__/PlanDetail.test.tsx`
- Delete: `src/components/MealPlanViewDialog.tsx` + `src/components/__tests__/MealPlanViewDialog-recipe-view.test.tsx`
- Move (Task 14 removes them from `page.tsx`): the existing `getDaysInOrder` / `getDateForDay` closures (`page.tsx:660-679`) become pure helpers in `meal-display-utils.ts` — **move, don't rewrite** (honors "no logic change"):
  - `getDaysInOrder(startDay: DayOfWeek): DayOfWeek[]` — the week rotated to start at `startDay`.
  - `getDateForDay(startDate: string, dow: DayOfWeek, startDay: DayOfWeek): string` — "Mon, May 11" via the existing `parseLocalDate` + `addDays(startDate, indexInOrder)` logic.

**Route page (`src/app/meal-plans/[id]/page.tsx`)** — server component, Next 15 async params:

```tsx
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { PlanDetail } from '@/components/meal-plans/PlanDetail';

export default async function MealPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AuthenticatedLayout>
      <PlanDetail planId={id} />
    </AuthenticatedLayout>
  );
}
```

`loading.tsx` (dark skeleton inside `AuthenticatedLayout`) and `error.tsx` (`'use client'`, `reset()` button, dark tokens) mirror the existing `src/app/meal-plans/loading.tsx`/`error.tsx`.

**`PlanDetail` interface + behavior:**

```ts
export interface PlanDetailProps {
  planId: string;
}
```

- **Fetch:** `useEffect` → `fetchMealPlan(planId)` (existing `GET /api/meal-plans/:id`) into `plan/loading/error` state. On fetch error or 404, render a "Plan not found" state with a `‹ Plans` link. Re-fetch after any save.
- **Derivations** (same as the old dialog):
  ```ts
  const mealsByDay = useMemo(() => {
    const map: Record<string, Partial<Record<MealType, MealPlanItem>>> = {};
    (plan?.items ?? []).forEach((mpi) => {
      (map[mpi.dayOfWeek] ??= {})[mpi.mealType] = mpi;
    });
    return map;
  }, [plan]);
  const enabledMeals = getEnabledMeals(
    plan?.template?.meals ?? plan?.templateSnapshot?.meals ?? {}
  );
  const staples = plan?.template?.weeklyStaples ?? [];
  const startDay = plan?.template?.startDay ?? plan?.templateSnapshot?.startDay ?? 'monday';
  const daysInOrder = plan ? getDaysInOrder(startDay) : [];
  const todayDow = computeTodayDow(plan); // helper: today within [startDate,endDate] → DayOfWeek | null
  ```
- **Header:** `‹ Plans` back button → `router.push('/meal-plans')`; kicker "MEAL PLAN" (accent) + `plan.name` (display font) + date range + "Shared with …" text when applicable; a `⋯` `IconButton` → `Menu` with **Delete plan** (danger). (Sharing/template stay account-level on the index — the back button returns there.)
- **Body:** `StaplesBar` (onEdit → open staples editor) + `PlanViewDesktop` (`display: { xs: 'none', md: 'block' }`) + `PlanViewMobile` (`display: { xs: 'block', md: 'none' }`), both fed `mealsByDay/daysInOrder/dateLabelForDay/enabledMeals/todayDow/onEditMeal`. `dateLabelForDay = (dow) => getDateForDay(plan.startDate, dow, startDay)`.
- **Per-meal editor:** `const [editing, setEditing] = useState<{ dow; mealType } | null>(null)`. `onEditMeal` sets it; render `<MealEditorDialog open={!!editing} … />` with `meal` from `mealsByDay`, `title = \`${cap(dow)} ${mealType}\``, `subtitle = dateLabelForDay(dow)`. `onSave(next)`→`handleSaveMeal(dow, mealType, next)`then`setEditing(null)`.
- **Staples editor:** `const [editingStaples, setEditingStaples] = useState(false)`; `<MealEditorDialog isStaples open={editingStaples} title="Weekly staples" meal={{ items: staples, skipped:false, skipReason:'' }} onSave={(n)=>{ handleSaveStaples(n.items); setEditingStaples(false); }} … />`.
- **Persistence (unchanged payloads — the "no write-logic change" guarantee):**

  ```ts
  const handleSaveMeal = async (dow, mealType, next) => {
    const existing = plan!.items;
    const idx = existing.findIndex((it) => it.dayOfWeek === dow && it.mealType === mealType);
    const merged =
      idx >= 0
        ? {
            ...existing[idx],
            items: next.items,
            skipped: next.skipped,
            skipReason: next.skipReason,
          }
        : {
            _id: '',
            mealPlanId: plan!._id,
            dayOfWeek: dow,
            mealType,
            items: next.items,
            skipped: next.skipped,
            skipReason: next.skipReason,
          };
    const items =
      idx >= 0 ? existing.map((it, i) => (i === idx ? merged : it)) : [...existing, merged];
    const sanitized = items.map((mi) => ({
      ...mi,
      items: mi.items.map((x) => (x.type === 'recipe' ? { ...x, unit: undefined } : x)),
    }));
    await updateMealPlan(plan!._id, { items: sanitized }); // existing PUT, scoped to userId server-side
    setPlan(await fetchMealPlan(plan!._id));
  };
  const handleSaveStaples = async (items) => {
    await updateMealPlanTemplate({ weeklyStaples: items }); // existing PUT
    setPlan(await fetchMealPlan(plan!._id));
  };
  const handleDelete = async () => {
    await deleteMealPlan(plan!._id);
    router.push('/meal-plans');
  };
  ```

- [ ] **Step 1: Write the failing test** (`PlanDetail.test.tsx`)

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../vitest.setup';
import { PlanDetail } from '../PlanDetail';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

const plan = {
  _id: 'p1',
  userId: 'u',
  name: 'Week of May 11',
  startDate: '2026-05-11',
  endDate: '2026-05-17',
  templateId: 't',
  templateSnapshot: {
    startDay: 'monday',
    meals: { breakfast: true, lunch: true, dinner: true, staples: true },
  },
  template: {
    _id: 't',
    userId: 'u',
    startDay: 'monday',
    meals: { breakfast: true, lunch: true, dinner: true, staples: true },
    weeklyStaples: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  items: [
    {
      _id: 'm1',
      mealPlanId: 'p1',
      dayOfWeek: 'monday',
      mealType: 'dinner',
      items: [{ type: 'recipe', id: 'r1', name: 'Lemon ricotta pasta', quantity: 1 }],
    },
  ],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

afterEach(() => {
  cleanup();
  push.mockReset();
});

describe('PlanDetail (route surface)', () => {
  it('fetches and renders the plan title + a meal', async () => {
    server.use(http.get('/api/meal-plans/p1', () => HttpResponse.json(plan)));
    render(<PlanDetail planId="p1" />);
    await waitFor(() => expect(screen.getByText('Week of May 11')).toBeInTheDocument());
    expect(screen.getAllByText('Lemon ricotta pasta').length).toBeGreaterThan(0);
  });

  it('the back button navigates to the index', async () => {
    const user = userEvent.setup();
    server.use(http.get('/api/meal-plans/p1', () => HttpResponse.json(plan)));
    render(<PlanDetail planId="p1" />);
    await waitFor(() => screen.getByText('Week of May 11'));
    await user.click(screen.getByRole('button', { name: /plans/i })); // "‹ Plans"
    expect(push).toHaveBeenCalledWith('/meal-plans');
  });

  it('tapping a meal opens the B3 editor; Done persists with the unchanged { items } payload', async () => {
    const user = userEvent.setup();
    let putBody: any = null;
    server.use(
      http.get('/api/meal-plans/p1', () => HttpResponse.json(plan)),
      http.put('/api/meal-plans/p1', async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ ...plan, ...putBody });
      })
    );
    render(<PlanDetail planId="p1" />);
    await waitFor(() => screen.getByText('Week of May 11'));
    await user.click(screen.getAllByText('Lemon ricotta pasta')[0]);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(putBody).not.toBeNull());
    expect(putBody).toHaveProperty('items'); // same payload shape as today
    expect(Object.keys(putBody)).toEqual(['items']);
  });

  it('renders a not-found state when the plan 404s', async () => {
    server.use(http.get('/api/meal-plans/p1', () => new HttpResponse(null, { status: 404 })));
    render(<PlanDetail planId="p1" />);
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/PlanDetail.test.tsx`
Expected: FAIL — cannot resolve `../PlanDetail`.

- [ ] **Step 3: Implement** `PlanDetail.tsx` per the interface + behavior above, plus the route `page.tsx`/`loading.tsx`/`error.tsx`, and move the two helpers into `meal-display-utils.ts`. `PlanDetail` is `'use client'`, named export. It imports `fetchMealPlan`, `updateMealPlan`, `updateMealPlanTemplate`, `deleteMealPlan` from `@/lib/meal-plan-utils` (all existing). Delete `MealPlanViewDialog.tsx` + its recipe-view test.

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/meal-plans/__tests__/PlanDetail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git rm src/components/MealPlanViewDialog.tsx src/components/__tests__/MealPlanViewDialog-recipe-view.test.tsx
git add src/app/meal-plans/\[id\]/ src/components/meal-plans/PlanDetail.tsx src/components/meal-plans/__tests__/PlanDetail.test.tsx src/components/meal-plans/meal-display-utils.ts
git commit -m "feat(meal-plans): plan-detail route + PlanDetail (back button, per-meal B3 editor over page) (chunk 3)"
```

---

## Task 14: Wire `page.tsx` — index navigates to the route; drop the view dialog

Adapt `src/app/meal-plans/page.tsx` to the new `[id]` route. The index no longer renders a plan-detail dialog — rows **navigate** to `/meal-plans/<id>`. Per-meal/staples persistence, `todayDow`, and delete all live in `PlanDetail` (Task 13) now. **No new endpoints.**

**Files:**

- Modify: `src/app/meal-plans/page.tsx`
- Modify: `src/app/meal-plans/__tests__/page.test.tsx` (update assertions to the new flow)

**Changes:**

1. **Delete the whole view-dialog + edit plumbing:** remove `usePersistentDialog('viewMealPlan')`, `selectedMealPlan`, `editMode`, the `viewMealPlan_*` params + the restore `useEffect`, `mealPlanValidationErrors`, `showValidationErrors`, `validateMealPlan` (whole-plan), `handleUpdateMealPlan`, `handleEditMealPlan`, and the rendered `<MealPlanViewDialog>` (the component is deleted in Task 13). Also remove `getDaysInOrder`/`getDateForDay` (moved to `meal-display-utils.ts` in Task 13). Keep `deleteConfirmDialog`? **No** — delete moves to `PlanDetail`; remove the index delete-confirm + `handleDeleteMealPlan` too. Keep the create / template / sharing / leave-sharing flows.

2. **Navigate to the detail route.** Plan rows in every section call `router.push(\`/meal-plans/${plan.\_id}\`)` (`useRouter`from`next/navigation`). `MealPlanBrowser`'s `onPlanSelect` likewise pushes the route.

3. **Redirect old deep-links.** A `useEffect` over `useSearchParams()`: if `?viewMealPlan` is present, read the legacy `viewMealPlan_mealPlanId`, and `router.replace(\`/meal-plans/${id}\`)`(or`/meal-plans`if the id is missing). Keeps existing beta bookmarks / shared`?viewMealPlan=` links working.

```ts
const params = useSearchParams();
useEffect(() => {
  if (params.get('viewMealPlan')) {
    const id = params.get('viewMealPlan_mealPlanId');
    router.replace(id ? `/meal-plans/${id}` : '/meal-plans');
  }
}, [params, router]);
```

4. **Template Settings dialog (staples editing stays index-level).** The inline staples `MealEditor` (deleted) is replaced: in the ⚙ template dialog, show a read summary + an "Edit staples" button that opens `MealEditorDialog` (`isStaples`) seeded from `templateForm.weeklyStaples`, committing back into `templateForm` (saved by the existing `handleUpdateTemplate`). This is the only `MealEditorDialog` usage left on the index.

5. **Index redesign:** restyle the header (display-font "Your plans", `⚙` template, share icon w/ dot badge when invites pending, `+ New plan` primary). Three sections, each a `SectionLabel` + rows:
   - **Current** — plans where `today ≤ endDate` and you own them, from the existing `fetchMealPlans({ minEndDate: today })` load.
   - **Shared with you** — from `mealPlanOwners` (existing sharing data).
   - **Past · last 6 weeks** — add ONE read on the index using the existing endpoint: `fetchMealPlans({ startDate: formatDateForAPI(addDays(new Date(), -42)), endDate: formatDateForAPI(addDays(new Date(), -1)) })`, stored in a new `pastPlans` state, sorted most-recent-first. (`fetchMealPlans` + `formatDateForAPI` + `addDays` are all already imported/used in `page.tsx`. No new endpoint.) Render the rows like Current; empty → omit the section.

   Below the three sections, a **"View older →"** affordance reveals the restyled `MealPlanBrowser` (Task 15) accordion for all-history browsing (e.g. a `useState` toggle that mounts `MealPlanBrowser`, or render it collapsed-by-default). **No new `/meal-plans/history` route.** Pull colors from tokens; counts accented with `color="primary"`.

   > Add the past-plans fetch to the existing `loadData` `Promise.all` (Task 14 keeps `loadData`'s shape) so it loads alongside the others — don't add a second mount effect.

- [ ] **Step (test):** Rewrite `page.test.tsx` for the index-only surface. **Delete** the old "Delete Functionality" + "View Mode Quantity Display" blocks entirely — those behaviors moved to `PlanDetail.test.tsx` (Task 13). New index assertions: (a) clicking a plan row calls `router.push('/meal-plans/<id>')` (mock `next/navigation`); (b) **"Past · last 6 weeks"** — MSW returns a past plan for the date-range query (`server.use(http.get('/api/meal-plans', …))` keyed on the `startDate`/`endDate` params), assert the section header + that past plan's name render; (c) the legacy `?viewMealPlan=…&viewMealPlan_mealPlanId=p1` URL triggers `router.replace('/meal-plans/p1')`. Keep the share-dialog auto-focus test. Run:

`MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/app/meal-plans/__tests__/page.test.tsx`
Expected: PASS after the rewrite.

- [ ] **Step (commit):**

```bash
git add src/app/meal-plans/page.tsx src/app/meal-plans/__tests__/page.test.tsx
git commit -m "feat(meal-plans): index navigates to /meal-plans/[id], drop view dialog + old-URL redirect (chunk 3)"
```

---

## Task 15: Restyle `MealPlanCreateDialog` + `MealPlanBrowser`

Visual-only — **no prop or logic changes** beyond tokens/`sx`. Both already have tests; keep them green (update only assertions that key off removed light-mode styling, if any).

**Files:**

- Modify: `src/components/MealPlanCreateDialog.tsx`
- Modify: `src/components/MealPlanBrowser.tsx` (also add a named export alongside the default)
- Tests stay: `src/components/__tests__/MealPlanBrowser.test.tsx` (should pass unchanged — it asserts behavior, not colors)

**`MealPlanCreateDialog`:** dark `Dialog` (`bgcolor: surface.raised`), display-font title "New meal plan", `FieldLabel` uppercase muted labels, keep the `DatePicker` (restyle the input to `surface.elevated` + `border.strong`), keep the owner `Select` (only when owners exist), keep the overlap helper text — render the "✓ No overlap. Plan covers …" success chip with `state.success`/`state.successMuted` when `!validationError`, and the error in `state.danger` when present. Primary "Create plan" uses `variant="contained" color="primary"`; disabled rule unchanged (`!startDate || !!validationError`).

**`MealPlanBrowser`:** restyle the year/month accordion + plan rows to dark tokens (rows = `surface.raised`, radius `xl`, `📅`→`Icon name="calendar_month"` in an accent-tinted square, current plan gets the `section.plans`55 ring + `shadow.card`). Behavior, fetches, and `onPlanSelect` unchanged. Add `export { MealPlanBrowser }` (named) while keeping `export default` — so future chunks can import either; do not change the page's existing default import.

- [ ] **Step 1: Restyle, run existing tests**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/__tests__/MealPlanBrowser.test.tsx`
Expected: PASS (8 tests, unchanged behavior). If a test queried the old `📅` emoji text, update it to query the new `aria-label`/role instead.

- [ ] **Step 2: Commit**

```bash
git add src/components/MealPlanCreateDialog.tsx src/components/MealPlanBrowser.tsx src/components/__tests__/MealPlanBrowser.test.tsx
git commit -m "style(meal-plans): dark-token restyle of create dialog + browser (chunk 3)"
```

---

## Task 16: `loading.tsx` / `error.tsx` + delete orphaned `MealEditor`

**Files:**

- Modify: `src/app/meal-plans/loading.tsx`, `src/app/meal-plans/error.tsx`
- Delete: `src/components/MealEditor.tsx`, `src/components/__tests__/MealEditor.test.tsx`, `src/components/__tests__/MealEditor-name-display.test.tsx`

- [ ] **Step 1: Restyle loading/error**

- `loading.tsx`: dark skeleton matching the new index (header row + section labels + a few plan-row skeletons). Keep `maxWidth="xl"`.
- `error.tsx`: change `Container maxWidth="md"` → `"xl"` (match the page); dark tokens; keep the `reset()` button. Its 2 tests should still pass (they assert the message + reset call).

- [ ] **Step 2: Delete `MealEditor` and confirm nothing imports it**

```bash
git rm src/components/MealEditor.tsx src/components/__tests__/MealEditor.test.tsx src/components/__tests__/MealEditor-name-display.test.tsx
grep -rn "components/MealEditor\b\|from '.*MealEditor'" src && echo "STILL IMPORTED — fix before continuing" || echo "clean"
```

Expected: `clean` (page.tsx's template-settings staples editor was migrated to `MealEditorDialog` in Task 14). If any import remains, it's the template dialog — finish that migration.

- [ ] **Step 3: Full validation**

> Stop the dev server first if running (the documented Turbopack/build collision clobbers `.next`). Run once:

```bash
npm run check
```

Expected: lint clean, all tests pass, build succeeds. If `MODULE_NOT_FOUND`, `npm run clean` then re-run.

- [ ] **Step 4: Commit**

```bash
git add src/app/meal-plans/loading.tsx src/app/meal-plans/error.tsx
git commit -m "chore(meal-plans): restyle loading/error, remove orphaned MealEditor (chunk 3)"
```

---

## Self-Review (run before declaring the plan done)

**Spec coverage (§4 chunk 3 + edit-decisions):**

| Spec item                                                        | Task                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| B3 full-screen/modal editor                                      | 12                                                      |
| Numpad qty                                                       | 9                                                       |
| Unit picker                                                      | 10                                                      |
| Sticky combined search                                           | 11                                                      |
| Flat group headers (dec. 8)                                      | 8, 12                                                   |
| Validation Done-disabled + warn borders (dec. 1)                 | 7, 8, 12                                                |
| Dirty-cancel confirm vs clean close (dec. 2)                     | 12                                                      |
| Per-meal notes dropped (dec. 3)                                  | 12 (no notes UI)                                        |
| Recipe `× n` chip, no unit (dec. 4)                              | 7, 12                                                   |
| Skip clear-confirm + empty-on-untoggle (dec. 5)                  | 12                                                      |
| Empty group / empty meal states (dec. 6)                         | 8, 12                                                   |
| Remove-group confirm (dec. 7)                                    | 6, 12                                                   |
| Desktop today-hero + week strip + TODAY sliver                   | 5                                                       |
| Mobile day-card stack                                            | 4                                                       |
| Staples bar expand/collapse                                      | 3                                                       |
| Staples editing                                                  | 12 (isStaples), 13 (detail), 14 (template dialog)       |
| `src/app/meal-plans/*` (index + `[id]` route) + Create + Browser | 13, 14, 15, 16                                          |
| Section accent via `palette.primary` (no re-wire)                | all (consume primary / `tokens.section.plans`)          |
| Plan detail = real route w/ back button (deviation from §4)      | 13                                                      |
| No write-logic change (same payloads)                            | 13, 14 (same `updateMealPlan`/`updateMealPlanTemplate`) |

**Type consistency:** `EditableMeal` defined in Task 12, imported by 13/14. `PlanViewProps` defined in Task 1 (`meal-display-utils.ts`), imported by 4 and 5. `MealItem`/`MealPlanItem`/`MealPlanWithTemplate`/`DayOfWeek`/`MealType` all from `@/types/meal-plan`. `FoodItem` from `@/lib/hooks/use-food-item-selector`. Chip-target shape `{ groupIdx, ingIdx }` consistent in Task 12.

**Per-chunk test list (spec §4):** one test per locked decision ✅ (Task 12), staples expand/collapse ✅ (Task 3), numpad qty ✅ (Task 9). Rewritten components get rewritten tests; deleted components' tests deleted in the same chunk (§6 0e) ✅.

**Placeholder scan:** no "TBD"/"handle later"; the only deferred-to-implementation spots are the **restyle** tasks (15/16) and **`page.tsx` index sections** (14) — these are mechanical token swaps over existing, tested code, with exact target styling + the persistence code given verbatim.

---

## Post-implementation (the rest of the chunk loop — NOT part of this plan's tasks)

After all 16 tasks are green, the chunk continues per spec §5:

2. `/review-code --base redesign-chunk-02` (auto-fix loop). **Check for an intervening `main`→branch merge first** — if one exists, re-base the review on the pre-chunk-3 commit (see ledger carryover).
3. `npm run check` again after review fixes.
4. `/manual-testing chunk-03-meal-plans` — seed the local dev DB, post the checklist to PR #89.
5. Push → CI + beta deploy.
6. Execute the manual checklist locally via Chrome (the gate).
7. Fold fixes.
8. Tag `redesign-chunk-03`.
9. Update `docs/superpowers/plans/redesign-progress.md`.
10. Merge `main` → branch if main moved.
11. Compact.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/redesign-chunk-03-meal-plans-plan.md`.**

Per spec §5 step 0, the **next step is `/review-plan`** on this plan (chunk 3 is one of the three interaction-heavy chunks that require it) before any implementation. After review revisions, execute via **subagent-driven-development** (recommended for a 16-task chunk): fresh subagent per task, two-stage review between tasks.
