# Frontend Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the frontend to a Linear-style dense, polished aesthetic with micro-interactions, replacing dialog-based navigation with page routes for complex views.

**Architecture:** Bottom-up approach — start with the theme/design tokens (everything depends on these), then shared components, then page-by-page migrations. Each phase is independently shippable and testable. Route migrations (dialogs → pages) happen per-feature to limit blast radius.

**Tech Stack:** Next.js 15 (App Router), React 19, MUI v7 (heavily re-themed), CSS animations, Figtree font

**Design Doc:** `docs/plans/2026-02-22-frontend-redesign-design.md`

---

## Phase 1: Design Tokens & Theme Foundation

Everything else depends on the theme. This phase creates the new visual system.

### Task 1.1: New Theme Tokens & Color System

**Files:**
- Modify: `src/lib/theme.ts` (entire file — rewrite color palette, typography scale, component overrides)

**Step 1: Update the dark theme palette**

Replace the existing color definitions (lines 7-26) with the new design tokens:

```typescript
// New dark palette
background: { default: '#0a0a0b', paper: '#141415' },
text: { primary: '#ececec', secondary: '#8a8a8a', disabled: '#5a5a5a' },
primary: { main: '#5b9bd5', light: '#7cb3e0', dark: '#4a82b5' },
secondary: { main: '#d4915e', light: '#e0a87a', dark: '#b57a4d' },
divider: 'rgba(255,255,255,0.06)',
```

Add custom palette entries for feature accent colors:

```typescript
// In theme augmentation or custom tokens
mealPlans: '#5b9bd5',    // muted steel blue
shopping: '#6baf7b',      // sage green
recipes: '#d4915e',       // warm amber
pantry: '#a87bb5',        // dusty lavender
```

Also update the light theme palette proportionally (lighter backgrounds, same desaturated accents).

**Step 2: Update typography scale**

Replace typography definitions (lines 28-74):

```typescript
typography: {
  fontFamily: 'var(--font-figtree), sans-serif',
  h1: { fontSize: '1.5rem', fontWeight: 600 },
  h2: { fontSize: '1.25rem', fontWeight: 600 },
  h3: { fontSize: '1.125rem', fontWeight: 600 },    // Page titles (was 1.75rem)
  h4: { fontSize: '1rem', fontWeight: 500 },
  h5: { fontSize: '0.875rem', fontWeight: 600 },     // Section headers
  h6: { fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' },
  body1: { fontSize: '0.875rem', fontWeight: 400 },   // Was 1rem
  body2: { fontSize: '0.8125rem', fontWeight: 400 },   // Was 0.875rem
  caption: { fontSize: '0.75rem', fontWeight: 400 },
  button: { textTransform: 'none', fontWeight: 500, fontSize: '0.8125rem' },
},
```

**Step 3: Update component overrides**

Replace button overrides (lines 80-97):

```typescript
MuiButton: {
  styleOverrides: {
    root: { borderRadius: 6, boxShadow: 'none', minHeight: 32, padding: '4px 12px' },
    sizeSmall: { minHeight: 28, padding: '2px 8px', fontSize: '0.75rem' },
  },
},
```

Replace card overrides (lines 98-105):

```typescript
MuiCard: { styleOverrides: { root: { borderRadius: 8, boxShadow: 'none', border: '1px solid', borderColor: 'rgba(255,255,255,0.06)' } } },
```

Update Paper, AppBar, TextField overrides:

```typescript
MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', borderRadius: 8 } } },
MuiAppBar: { styleOverrides: { root: { boxShadow: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)' } } },
MuiTextField: { defaultProps: { size: 'small' }, styleOverrides: { root: { '& .MuiOutlinedInput-root': { borderRadius: 6 } } } },
MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 6 }, input: { padding: '6px 10px', fontSize: '0.875rem' } } },
```

**Step 4: Add animation CSS custom properties**

Create or update `src/app/globals.css` to include:

```css
:root {
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);
}
```

**Step 5: Update responsiveDialogStyle**

Update the responsive dialog style (lines 128-135) — dialogs should still be full-screen on mobile but with tighter padding:

```typescript
export const responsiveDialogStyle = {
  '& .MuiDialog-paper': {
    margin: { xs: 0, sm: 2 },
    width: { xs: '100%', sm: 'auto' },
    height: { xs: '100%', sm: 'auto' },
    maxHeight: { xs: '100%', sm: '85vh' },
    maxWidth: { xs: '100%', sm: 600 },
    borderRadius: { xs: 0, sm: 2 },
  },
};
```

**Step 6: Run tests and verify nothing breaks**

Run: `npm test`
Expected: All tests pass (theme changes shouldn't break tests since tests mock UI)

**Step 7: Visually verify in browser**

Start dev server, check that all existing pages render with new theme values. The app will look different but should be functional.

**Step 8: Commit**

```bash
git add src/lib/theme.ts src/app/globals.css
git commit -m "feat(design): update theme tokens — colors, typography, spacing, component overrides"
```

---

### Task 1.2: Compact Form Input Components

**Files:**
- Create: `src/components/ui/CompactInput.tsx`
- Create: `src/components/ui/CompactSelect.tsx`
- Create: `src/components/ui/__tests__/CompactInput.test.tsx`
- Create: `src/components/ui/__tests__/CompactSelect.test.tsx`

These are thin wrappers that enforce the new compact input style (32px height, static labels above, no floating labels).

**Step 1: Write the test for CompactInput**

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompactInput } from '../CompactInput';

describe('CompactInput', () => {
  it('renders label above input', () => {
    render(<CompactInput label="Quantity" value="2" onChange={() => {}} />);
    expect(screen.getByText('Quantity')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('2');
  });

  it('renders without label when not provided', () => {
    render(<CompactInput value="test" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onChange on input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CompactInput label="Name" value="" onChange={onChange} />);
    await user.type(screen.getByRole('textbox'), 'a');
    expect(onChange).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ui/__tests__/CompactInput.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement CompactInput**

```typescript
'use client';

import React from 'react';
import { Box, InputBase, Typography, type SxProps, type Theme } from '@mui/material';

interface CompactInputProps {
  label?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  autoComplete?: string;
  name?: string;
}

export const CompactInput = React.memo(function CompactInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
  fullWidth = true,
  sx,
  inputProps,
  autoComplete,
  name,
}: CompactInputProps) {
  return (
    <Box sx={{ width: fullWidth ? '100%' : 'auto', ...sx as object }}>
      {label && (
        <Typography
          component="label"
          sx={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'text.secondary',
            mb: 0.5,
          }}
        >
          {label}{required && ' *'}
        </Typography>
      )}
      <InputBase
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        name={name}
        autoComplete={autoComplete}
        inputProps={inputProps}
        sx={{
          width: '100%',
          height: 32,
          px: 1.25,
          fontSize: '0.875rem',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '6px',
          bgcolor: 'transparent',
          '&:hover': { borderColor: 'rgba(255,255,255,0.16)' },
          '&.Mui-focused': {
            borderColor: 'primary.main',
            boxShadow: (theme) => `0 0 0 1px ${theme.palette.primary.main}25`,
          },
          '& input': { padding: 0 },
        }}
      />
    </Box>
  );
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ui/__tests__/CompactInput.test.tsx`
Expected: PASS

**Step 5: Write CompactSelect test and implementation**

Follow same TDD pattern for CompactSelect — a thin wrapper around MUI Select with static label, 32px height, consistent border styling.

**Step 6: Run all tests**

Run: `npm test`
Expected: All pass

**Step 7: Commit**

```bash
git add src/components/ui/CompactInput.tsx src/components/ui/CompactSelect.tsx src/components/ui/__tests__/
git commit -m "feat(design): add CompactInput and CompactSelect components"
```

---

### Task 1.3: Animation Utilities

**Files:**
- Create: `src/lib/animation-utils.ts`
- Create: `src/lib/__tests__/animation-utils.test.ts`

Shared animation keyframes and utility functions.

**Step 1: Write test**

```typescript
import { getStaggerDelay, ANIMATIONS } from '../animation-utils';

describe('animation-utils', () => {
  it('calculates stagger delay for items within limit', () => {
    expect(getStaggerDelay(0)).toBe(0);
    expect(getStaggerDelay(3)).toBe(90);  // 3 * 30ms
    expect(getStaggerDelay(9)).toBe(270); // 9 * 30ms
  });

  it('returns 0 for items beyond stagger limit', () => {
    expect(getStaggerDelay(10)).toBe(0);
    expect(getStaggerDelay(20)).toBe(0);
  });

  it('exports animation keyframe names', () => {
    expect(ANIMATIONS.fadeInUp).toBeDefined();
    expect(ANIMATIONS.fadeIn).toBeDefined();
  });
});
```

**Step 2: Implement**

```typescript
export const STAGGER_LIMIT = 10;
export const STAGGER_DELAY_MS = 30;

export function getStaggerDelay(index: number): number {
  if (index >= STAGGER_LIMIT) return 0;
  return index * STAGGER_DELAY_MS;
}

export const ANIMATIONS = {
  fadeInUp: 'fadeInUp',
  fadeIn: 'fadeIn',
  slideInRight: 'slideInRight',
  expandCollapse: 'expandCollapse',
} as const;

// Keyframes to be injected via globals.css:
// @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
// @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
// @keyframes slideInRight { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
```

Also add the keyframes to `src/app/globals.css`.

**Step 3: Test, commit**

```bash
git add src/lib/animation-utils.ts src/lib/__tests__/animation-utils.test.ts src/app/globals.css
git commit -m "feat(design): add animation utilities and keyframes"
```

---

## Phase 2: Navigation Components

### Task 2.1: Compact Header

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Header.tsx` test if exists, or verify visually

**Step 1: Refactor Header to 48px height, text-only nav, compact styling**

Key changes:
- Toolbar: `sx={{ minHeight: '48px !important', px: { xs: 1.5, md: 3 } }}`
- Logo: Remove 32px icon, keep text "Weekly Eats" at 14px, 600 weight
- Nav buttons: 13px font, 500 weight, no icons. Active = 2px bottom border in feature accent color (not underline on text). Remove the per-button custom colors from the button itself — use subtle hover.
- User area: 28px avatar, no name text. Name in dropdown menu.
- Remove `elevation: 1` from AppBar, use border-bottom via theme override (already done in Task 1.1)

**Step 2: Test visually in browser at desktop width**

**Step 3: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat(design): compact header — 48px height, text-only nav, refined styling"
```

---

### Task 2.2: Compact BottomNav

**Files:**
- Modify: `src/components/BottomNav.tsx`

**Step 1: Refactor BottomNav**

Key changes:
- Container height: 48px (from 70px)
- Icons: 20px (from default ~24px)
- Label font: 10px
- Active indicator: small dot/pill in feature accent color
- Add `paddingBottom: env(safe-area-inset-bottom)` to container
- Tighten item padding: `6px 8px 4px` (from `6px 12px 8px`)

**Step 2: Test visually in browser at mobile width (375px)**

**Step 3: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "feat(design): compact bottom nav — 48px height, refined indicators"
```

---

### Task 2.3: Update AuthenticatedLayout Spacing

**Files:**
- Modify: `src/components/AuthenticatedLayout.tsx`

**Step 1: Reduce container padding and spacing**

Key changes:
- Main content padding-top: adjust for new 48px header
- Main content padding-bottom on mobile: adjust for new 48px bottom nav
- Container margins: tighter (12px mobile, 24px desktop)

**Step 2: Commit**

```bash
git add src/components/AuthenticatedLayout.tsx
git commit -m "feat(design): tighten layout spacing for compact nav"
```

---

## Phase 3: Shared UI Components

### Task 3.1: Compact List Row Component

**Files:**
- Create: `src/components/ui/ListRow.tsx`
- Create: `src/components/ui/__tests__/ListRow.test.tsx`

A reusable flat list row with separator, hover state, and optional left accent border. Replaces Paper cards.

**Step 1: Write test**

Test that it renders children, shows separator, applies hover styles, supports onClick, supports accentColor prop.

**Step 2: Implement**

```typescript
// Flat row with:
// - border-bottom: 1px solid divider
// - hover: bg-surface-hover + optional left border accent
// - onClick navigation
// - 36-40px min-height
// - px: 1.5
```

**Step 3: Test, commit**

```bash
git add src/components/ui/ListRow.tsx src/components/ui/__tests__/ListRow.test.tsx
git commit -m "feat(design): add ListRow component — flat rows with separators"
```

---

### Task 3.2: Compact Inline Ingredient Row

**Files:**
- Create: `src/components/ui/InlineIngredientRow.tsx`
- Create: `src/components/ui/__tests__/InlineIngredientRow.test.tsx`

The most impactful density component — replaces 5 stacked fields with 1 inline row.

**Step 1: Write test**

Test that it renders food item name, quantity, unit on one line. Test that trash icon calls onRemove. Test that fields call onChange.

**Step 2: Implement**

```typescript
// Single row: [FoodItemAutocomplete ~55%] [Qty input ~15%] [Unit select ~20%] [Trash icon ~10%]
// Height: 32-36px
// On mobile: same layout but tighter — FoodItemAutocomplete truncates
// Column headers rendered by parent (not per-row)
```

This component wraps FoodItemAutocomplete, CompactInput (for quantity), CompactSelect (for unit), and an IconButton (trash).

**Step 3: Test, commit**

```bash
git add src/components/ui/InlineIngredientRow.tsx src/components/ui/__tests__/InlineIngredientRow.test.tsx
git commit -m "feat(design): add InlineIngredientRow — compact single-line ingredient editing"
```

---

### Task 3.3: Collapsible Section Component

**Files:**
- Create: `src/components/ui/CollapsibleSection.tsx`
- Create: `src/components/ui/__tests__/CollapsibleSection.test.tsx`

For meal plan day sections. Animated expand/collapse.

**Step 1: Write test**

Test expand/collapse toggle, default state (expanded/collapsed), chevron rotation, aria attributes.

**Step 2: Implement**

```typescript
// Header row with chevron + title + optional right-side content
// Content area uses grid-template-rows: 0fr/1fr for smooth animation
// CSS transition on grid-template-rows + opacity
// Chevron rotates 90° on expand
// duration-normal (200ms)
```

**Step 3: Test, commit**

```bash
git add src/components/ui/CollapsibleSection.tsx src/components/ui/__tests__/CollapsibleSection.test.tsx
git commit -m "feat(design): add CollapsibleSection with animated expand/collapse"
```

---

### Task 3.4: Staggered List Wrapper

**Files:**
- Create: `src/components/ui/StaggeredList.tsx`

A wrapper that applies staggered fade-in-up animation to its children on initial mount.

**Step 1: Implement**

```typescript
// Maps over children, applying animation-delay based on index
// Uses fadeInUp keyframe from globals.css
// Respects prefers-reduced-motion via CSS media query
// Only staggers first 10 items
```

**Step 2: Commit**

```bash
git add src/components/ui/StaggeredList.tsx
git commit -m "feat(design): add StaggeredList component for reveal animations"
```

---

### Task 3.5: Update SearchBar & Pagination

**Files:**
- Modify: `src/components/optimized/SearchBar.tsx`
- Modify: `src/components/optimized/Pagination.tsx`

**Step 1: Update SearchBar**

- Height: 36px
- Remove Paper/Card wrapper (mb: 4 → mb: 2)
- Add search icon inside left
- Compact input styling matching new theme
- Remove `fullWidth` Container wrapper

**Step 2: Update Pagination**

- Smaller pagination buttons
- Tighter margins (mt: 2 → mt: 1.5)

**Step 3: Commit**

```bash
git add src/components/optimized/SearchBar.tsx src/components/optimized/Pagination.tsx
git commit -m "feat(design): compact SearchBar and Pagination"
```

---

## Phase 4: Page Migrations — Recipes

Recipes first because the page structure is simpler than meal plans (no weekly staples, no skip meals).

### Task 4.1: Recipe Detail Page Route

**Files:**
- Create: `src/app/recipes/[id]/page.tsx`
- Create: `src/app/recipes/[id]/loading.tsx`

**Step 1: Create the recipe detail page**

This extracts the view/edit logic from `RecipeViewDialog.tsx` into a proper page component at `/recipes/[id]`. The page:
- Fetches recipe data by ID (server-side or client-side)
- Renders view mode by default
- Switches to edit mode via `?edit=true` query param
- Has a back button (← Recipes) in the page header
- Uses the new compact form components in edit mode
- Uses CollapsibleSection for ingredients/instructions in view mode

Reference the existing `RecipeViewDialog.tsx` (454 lines) for the exact data structure and edit logic. The goal is to move that logic into a page, not rewrite it.

**Step 2: Create content-shaped loading skeleton**

```typescript
// Skeleton matching the recipe detail layout:
// [← Back] [Title skeleton]        [Edit btn]
// Tags: [pill] [pill]  Rating: [stars]
// ─────────────────────────────────
// INGREDIENTS          INSTRUCTIONS
// ░░░░░░░░░░           ░░░░░░░░░░░░░░
// ░░░░░░░░             ░░░░░░░░░░░░░░
// ░░░░░░░░░░░          ░░░░░░░░░░░░░░
```

**Step 3: Test that page renders, verify visually**

**Step 4: Commit**

```bash
git add src/app/recipes/[id]/
git commit -m "feat(design): add recipe detail page route /recipes/[id]"
```

---

### Task 4.2: Create Recipe Page Route

**Files:**
- Create: `src/app/recipes/new/page.tsx`

**Step 1: Create the /recipes/new page**

Reuses the edit mode layout from the recipe detail page. Pre-populated with empty state. Saves via POST instead of PUT.

**Step 2: Commit**

```bash
git add src/app/recipes/new/
git commit -m "feat(design): add create recipe page route /recipes/new"
```

---

### Task 4.3: Redesign Recipe List Page

**Files:**
- Modify: `src/app/recipes/page.tsx`
- Modify: `src/app/recipes/loading.tsx`

**Step 1: Replace card/table views with flat ListRow components**

Key changes:
- Remove Paper card wrappers on mobile
- Remove Table on desktop — use flat ListRow everywhere
- Row: emoji + name + tags (tiny pills) + rating ("★ 3") + date
- On mobile: two-line row (name+date on line 1, tags+rating on line 2)
- Click navigates to `/recipes/[id]` (router.push, not dialog open)
- Wrap list in StaggeredList
- Page header: compact (18px title, icon-only "+" button on mobile)
- Remove RecipeViewDialog import and usage (replaced by page route)

**Step 2: Update loading.tsx**

Replace generic skeleton with content-shaped skeleton matching new flat row layout.

**Step 3: Run tests**

Run: `npm test -- src/app/recipes/`
Fix any broken tests due to changed markup.

**Step 4: Verify visually on desktop and mobile**

**Step 5: Commit**

```bash
git add src/app/recipes/page.tsx src/app/recipes/loading.tsx
git commit -m "feat(design): redesign recipe list — flat rows, page navigation, staggered reveal"
```

---

### Task 4.4: Update RecipeIngredients for Inline Rows

**Files:**
- Modify: `src/components/RecipeIngredients.tsx`

**Step 1: Replace stacked fields with InlineIngredientRow**

Key changes:
- Use InlineIngredientRow for each ingredient
- Add column headers above first row: "Item | Qty | Unit"
- Remove full-width "Add Ingredient" / "Remove Ingredient" buttons
- "Add Ingredient" becomes compact text button
- "Add prep instructions" becomes small icon button on the row
- Group titles use CompactInput

**Step 2: Run tests, fix any that break**

**Step 3: Verify visually — especially on mobile**

**Step 4: Commit**

```bash
git add src/components/RecipeIngredients.tsx
git commit -m "feat(design): inline ingredient rows in recipe editor"
```

---

## Phase 5: Page Migrations — Meal Plans

### Task 5.1: Meal Plan Detail Page Route

**Files:**
- Create: `src/app/meal-plans/[id]/page.tsx`
- Create: `src/app/meal-plans/[id]/loading.tsx`

**Step 1: Create the meal plan detail page**

Extracts view/edit logic from `MealPlanViewDialog.tsx` (849 lines) into a page at `/meal-plans/[id]`.

View mode:
- Weekly Staples as CollapsibleSection (starts expanded)
- Each day as CollapsibleSection: "Mon, Feb 23 · Dinner" header
- Empty days auto-collapsed
- "Skipped" as inline muted label
- Meal items as compact list inside each section

Edit mode (via `?edit=true`):
- Same collapsible day structure
- MealEditor uses InlineIngredientRow
- Skip checkbox inline with day header
- Cancel/Save in page header (sticky)

**Step 2: Create content-shaped loading skeleton**

**Step 3: Commit**

```bash
git add src/app/meal-plans/[id]/
git commit -m "feat(design): add meal plan detail page route /meal-plans/[id]"
```

---

### Task 5.2: Meal Plan Settings Page Route

**Files:**
- Create: `src/app/meal-plans/settings/page.tsx`

**Step 1: Create /meal-plans/settings page**

Extracts template settings dialog content into a page. Back button → /meal-plans.

**Step 2: Commit**

```bash
git add src/app/meal-plans/settings/
git commit -m "feat(design): add meal plan settings page route"
```

---

### Task 5.3: Redesign Meal Plan List Page

**Files:**
- Modify: `src/app/meal-plans/page.tsx`
- Modify: `src/app/meal-plans/loading.tsx`

**Step 1: Replace card views with flat rows, page navigation**

Key changes:
- Current Meal Plans: flat rows, click navigates to `/meal-plans/[id]`
- Meal Plan History: collapsible year groups using CollapsibleSection
- Remove MealPlanViewDialog usage
- Template settings button navigates to `/meal-plans/settings`
- Compact page header
- Wrap lists in StaggeredList

**Step 2: Update loading.tsx**

**Step 3: Run tests, fix breakage**

**Step 4: Commit**

```bash
git add src/app/meal-plans/page.tsx src/app/meal-plans/loading.tsx
git commit -m "feat(design): redesign meal plan list — flat rows, page navigation, collapsible history"
```

---

### Task 5.4: Update MealEditor for Inline Rows

**Files:**
- Modify: `src/components/MealEditor.tsx`

**Step 1: Replace stacked fields with InlineIngredientRow**

Same pattern as RecipeIngredients (Task 4.4). Column headers, compact buttons.

**Step 2: Run tests, verify visually**

**Step 3: Commit**

```bash
git add src/components/MealEditor.tsx
git commit -m "feat(design): inline ingredient rows in meal editor"
```

---

## Phase 6: Remaining Pages

### Task 6.1: Redesign Food Items Page

**Files:**
- Modify: `src/app/food-items/page.tsx`
- Modify: `src/app/food-items/loading.tsx` (if exists, else create)

**Step 1: Replace cards/table with flat ListRow**

- Flat rows: name + access level badge (tiny, inline) + date
- Remove Paper card wrappers
- Compact page header (no icon, just text "Manage Food Items" or "Food Items")
- Wrap in StaggeredList

**Step 2: Update loading skeleton**

**Step 3: Commit**

```bash
git add src/app/food-items/
git commit -m "feat(design): redesign food items page — flat rows, compact layout"
```

---

### Task 6.2: Redesign Pantry Page

**Files:**
- Modify: `src/app/pantry/page.tsx`
- Modify: `src/app/pantry/loading.tsx`

**Step 1: Replace cards with flat rows**

- Flat rows: name + trash icon, ~40px height
- No card chrome
- StaggeredList

**Step 2: Commit**

```bash
git add src/app/pantry/
git commit -m "feat(design): redesign pantry page — flat rows, compact layout"
```

---

### Task 6.3: Refine Shopping Lists Page

**Files:**
- Modify: `src/app/shopping-lists/page.tsx`
- Modify: `src/app/shopping-lists/loading.tsx`

**Step 1: Lighter refinements**

- Store list: reduce card chrome, tighter padding
- Action icons: 16px, text-tertiary
- Shopping list dialog: tighten row height to ~40px
- Apply new theme values (they propagate automatically from Task 1.1, but verify)

**Step 2: Commit**

```bash
git add src/app/shopping-lists/
git commit -m "feat(design): refine shopping lists — tighter spacing, subtle icons"
```

---

## Phase 7: Page Transitions & Polish

### Task 7.1: Page Transition Wrapper

**Files:**
- Create: `src/components/PageTransition.tsx`
- Modify: `src/components/AuthenticatedLayout.tsx` (wrap children in PageTransition)

**Step 1: Create PageTransition component**

Applies slideInRight + fadeIn animation on mount. Uses CSS animation with `animation-fill-mode: forwards`.

```typescript
// Wraps page content
// On mount: animate in (slideInRight, 200ms, ease-out)
// Respects prefers-reduced-motion
```

**Step 2: Integrate into AuthenticatedLayout**

Wrap `{children}` in `<PageTransition>`.

**Step 3: Verify transitions work on navigation**

**Step 4: Commit**

```bash
git add src/components/PageTransition.tsx src/components/AuthenticatedLayout.tsx
git commit -m "feat(design): add page transition animations"
```

---

### Task 7.2: Interactive Micro-Feedback

**Files:**
- Modify: `src/app/globals.css` (add global interaction styles)

**Step 1: Add global micro-interaction styles**

```css
/* Button press feedback */
@media (prefers-reduced-motion: no-preference) {
  button:active { transform: scale(0.97); }

  /* Checkbox animation */
  .MuiCheckbox-root svg { transition: transform var(--duration-fast) var(--ease-out); }
  .MuiCheckbox-root.Mui-checked svg { animation: checkBounce var(--duration-normal) var(--ease-out); }

  @keyframes checkBounce {
    0% { transform: scale(1); }
    50% { transform: scale(1.15); }
    100% { transform: scale(1); }
  }
}
```

**Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): add micro-interaction feedback — button press, checkbox bounce"
```

---

## Phase 8: Cleanup & Validation

### Task 8.1: Remove Dead Dialog Code

**Files:**
- Modify: `src/app/recipes/page.tsx` (remove RecipeViewDialog, RecipeEditorDialog imports)
- Modify: `src/app/meal-plans/page.tsx` (remove MealPlanViewDialog import)
- Potentially delete: `src/components/RecipeViewDialog.tsx` (if fully replaced)
- Potentially delete: `src/components/MealPlanViewDialog.tsx` (if fully replaced)

Only delete files that are no longer imported anywhere. Check with grep first.

**Step 1: Search for remaining imports of old dialog components**

Run: `grep -r "RecipeViewDialog\|MealPlanViewDialog\|RecipeEditorDialog" src/ --include="*.tsx" --include="*.ts"`

**Step 2: Remove unused imports and files**

**Step 3: Commit**

```bash
git commit -m "chore: remove dead dialog code replaced by page routes"
```

---

### Task 8.2: Full Validation

**Step 1: Run full check**

Run: `npm run check` (lint + test + build)

**Step 2: Fix any failures**

Lint errors, test failures, build errors — fix them.

**Step 3: Visual review**

Check all pages on desktop (1280px) and mobile (375px):
- [ ] Meal Plans list
- [ ] Meal Plan detail (view)
- [ ] Meal Plan detail (edit)
- [ ] Meal Plan settings
- [ ] Recipes list
- [ ] Recipe detail (view)
- [ ] Recipe detail (edit)
- [ ] Create recipe
- [ ] Food Items
- [ ] Pantry
- [ ] Shopping Lists (store list)
- [ ] Shopping List (item dialog)
- [ ] Settings
- [ ] Loading skeletons for each page

**Step 4: Final commit if any fixes**

```bash
git commit -m "fix: address lint/test/build issues from redesign"
```

---

### Task 8.3: Open PR

```bash
gh pr create --title "feat: frontend redesign — Linear-style density overhaul" --body "$(cat <<'EOF'
## Summary
- Overhauled visual system: richer dark theme, desaturated feature accents, tighter typography, compact inputs
- Replaced dialog-based navigation with page routes for meal plans and recipes
- Dramatically improved mobile information density: inline ingredient rows, flat list rows, collapsible sections
- Added micro-interactions: page transitions, staggered list reveals, expand/collapse animations
- Content-shaped skeleton loading states

## Design Doc
See `docs/plans/2026-02-22-frontend-redesign-design.md`

## Test Plan
- [ ] All existing tests pass
- [ ] Visual review on desktop (1280px) and mobile (375px)
- [ ] Page navigation works (forward/back) for recipe and meal plan detail pages
- [ ] Edit mode works for recipes and meal plans on new page routes
- [ ] Shopping list dialog still works correctly
- [ ] Loading skeletons render correctly
- [ ] Animations respect prefers-reduced-motion
- [ ] Light mode still looks acceptable

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
