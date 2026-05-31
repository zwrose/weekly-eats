# Chunk 6 — Pantry: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-theme the Pantry surface (`src/app/pantry/*`) to the dark-first lavender vocab — flat list, redesigned Add + Remove dialogs — with **no feature/API/write-logic change**.

**Architecture:** Slim `page.tsx` to orchestration (data fetch via `useServerPagination`, dialog state, handlers) and extract a presentational `PantryListView` (flat list + header + pagination + empty state + search slot, desktop table / mobile single-card). Reuse the shared `FoodItemAutocomplete` in a re-chromed Add dialog (gate-#1 decision). Extract a **reusable `ui/ConfirmDialog`** (desktop centered dialog / mobile bottom sheet, danger variant) that Pantry uses now and food-items/user-mgmt reuse in later chunks (gate-#1 decision). Accent comes free from `SectionThemeProvider` (the `/pantry` route already maps to `tokens.section.pantry` = `#c79bff`).

**Tech Stack:** Next 16 / React 19 / MUI v9 (`sx`, `Drawer`, `Dialog`, breakpoints), TypeScript, Vitest + RTL.

**Reference:** artboard `docs/design/weekly-eats-redesign/project/artboards-pantry.jsx` (6 surfaces: Mobile/Desktop × List/Add/Delete). **Review base = `64364b6`** (post Next16/MUI9 back-merge — NOT `redesign-chunk-05`).

**Scope (spec §4):** search, flat list of food items, Add dialog (autocomplete), Remove confirm. Visual-only. **No API change, no write-logic change** — `createPantryItem`/`deletePantryItem`/`/api/pantry` untouched.

---

## Gate #1 — artboard sign-off (DONE 2026-05-31)

- **D1 — Add dialog:** **Keep the shared `FoodItemAutocomplete`** (MUI Autocomplete: floating label + popup listbox), restyle only the dialog chrome to the lavender vocab. Consistent with chunks 4 & 5. **Recorded deviation:** the artboard's always-inline flat results list ("↵" / "Already in pantry" / "Create X" rows) is delivered functionally by `FoodItemAutocomplete` (it already supports `excludedItemLabel="Already in pantry"`, `onCreateItem`, keyboard select) but rendered as a MUI popup, not the flat inline list.
- **D2 — Remove confirm:** **Extract a reusable `ui/ConfirmDialog`** (desktop centered dialog / mobile bottom sheet with grab handle, `danger` variant) modeled on `FinishShopConfirm`. Pantry consumes it; food-items + user-mgmt reuse it later.

---

## §3 — Artboard exact-value spec

Tokens (already in `@/lib/design-tokens` unless noted): `surface.base #0f1115`, `surface.raised #181b21`, `surface.elevated #1e222a` (= artboard `paperHi`), `surface.sheet #1a1e26`; `border.subtle rgba(255,255,255,0.07)` (= `edge`), `border.strong rgba(255,255,255,0.13)` (= `edgeHi`); `text.primary #e7e9ee`, `text.secondary #9097a6` (= `dim`), `text.muted #5b6170` (= `mute`); `section.pantry #c79bff` (= accent), `accentDim rgba(199,155,255,0.16)` — **add `onAccent.pantry = '#1a0f24'`** (Task 1); `state.danger #e87a8a`, `onDanger #1a0f0f` (exist). Radii: `radius.lg 10`, `radius.xl 12`, `radius.xxl 14`, `radius.xxxl 16`, `radius.sheet 18`. **MUI gotcha: pixel `borderRadius` in `sx` MUST be the `` `${x}px` `` string form** (bare number ×8).

Accent/contrast resolve automatically via `SectionThemeProvider` (`palette.primary.main` = `#c79bff`). Use `theme.palette.primary.main` for accent fills and **`tokens.onAccent.pantry`** for text on the accent fill (do NOT rely on `contrastText`, which is `surface.base`). Danger remove button: `bgcolor: tokens.state.danger`, `color: tokens.onDanger`.

### Desktop · List (`DesktopList`)

- Page wrap: `maxWidth 900`, centered, `padding '28px 56px 0'` (Container handles the outer; match spacing).
- **Header row:** title `Pantry` (display font, 32/700, letterSpacing `-0.025em`); subline `{N} items` — count in accent (`primary.main`, 600), label `text.secondary` 13, `mt 6`. Right: primary button `+ Add item` (`height 38`, `padding 0 16px`, `borderRadius '10px'`, `bgcolor primary.main`, `color onAccent.pantry`, 14/600). `mb 22`.
- **Search box:** flex row, `height 40`, `bgcolor surface.elevated`, `border 1px border.strong`, `borderRadius '12px'`, `padding '0 12px'`, gap 8, `mb 16`; leading `Icon name="search" size 18` `text.secondary`; placeholder `Search your pantry…` 13. Reuse the StoreListView search-neutralization approach (flatten the inner `SearchBar` MUI styling).
- **List card:** `bgcolor surface.raised`, `border 1px border.subtle`, `borderRadius '14px'`, `overflow hidden`.
  - **Column header:** grid `1fr 80px`, `padding '12px 22px'`, `borderBottom 1px border.subtle`; eyebrow labels (10/700, letterSpacing `0.14em`, uppercase, `text.secondary`): `Food item` (left), `Remove` (right-aligned).
  - **Item rows:** grid `1fr 80px`, `alignItems center`, `padding '12px 22px'`, `borderBottom 1px border.subtle` except last. Left: name 14, `text.primary`. Right (right-aligned): **bordered ghost delete** button `30×30`, `borderRadius '8px'`, `bgcolor transparent`, `border 1px border.subtle`, `color state.danger`, `Icon name="delete" size 16`. Hover: `bgcolor surface.elevated` on row (optional, match other indexes).
- **Pagination** (only when `totalPages > 1`): centered, `mt 16` — keep MUI `Pagination` but ensure the active page reads as accent (it resolves via `palette.primary`). Artboard shows ghost pills w/ accent-dim active; MUI Pagination with primary accent is the accepted equivalent (record if it differs visually).

### Mobile · List (`MobileList`)

- Header: title `Pantry` 28/700; subline `{N} items` (accent count) 12, `mt 4`. Right: primary `+ Add` (`height 36`, `padding '0 12px'`).
- Search box: same as desktop but `borderRadius '12px'`, full-width, `mb 12`.
- **Single list card** (NOT floating per-item cards — replaces current mobile design): `bgcolor surface.raised`, `border 1px border.subtle`, `borderRadius '12px'`, `overflow hidden`. Rows: flex, `padding '12px 14px'`, `borderBottom 1px border.subtle` except last; name 14 `text.primary` (flex 1); **borderless dim delete** button `28×28`, `borderRadius '8px'`, `bgcolor transparent`, `border none`, `color text.secondary`, `Icon name="delete" size 17`.

### Empty state (both breakpoints)

Replace the MUI `Alert severity="info"` with a dark box: `bgcolor surface.raised`, `border 1px border.subtle`, `borderRadius '12px'`, centered text `text.secondary`, `py 4`. Copy: search-active → `No pantry items match your search`; else → `No pantry items yet. Add your first item to get started.`

### Add dialog (`DesktopAdd` 460 / `MobileAdd` full-screen)

- Desktop: `Dialog maxWidth` custom → paper `width 460`, `borderRadius '16px'`, `bgcolor surface.raised`, `border 1px border.strong`, `boxShadow tokens.shadow.modal`, `overflow hidden`. Mobile: `responsiveDialogStyle` → full-screen frame.
- **Header:** `DialogTitle onClose` → `Add pantry item` (display 18/700) + close ghost-icon (`30×30`, `Icon name="close" size 14`). `borderBottom 1px border.subtle`.
- **Body** (`padding '20px 22px'`): eyebrow `Food item` (11/700, letterSpacing `0.14em`, uppercase, `text.secondary`, `mb 8`). Then the shared `FoodItemAutocomplete` (`allowRecipes={false}`, `excludeIds` = current page items, `excludedItemLabel="Already in pantry"`, `autoFocus`, `onChange`/`onFoodItemAdded`/`onCreateItem` as today). Keep its MUI floating-label input but ensure the focus ring reads accent (resolves via `palette.primary`).
- **Footer:** `DialogActions primaryButtonIndex={1}` → `Cancel` (ghost) + `Add` (primary, `color onAccent.pantry`, disabled until `foodItemId`). `bgcolor surface.elevated`, `borderTop 1px border.subtle` (DialogActions already applies the redesign footer chrome — verify).

### Remove confirm → `ui/ConfirmDialog` (`DesktopDelete` 440 / `MobileDelete` sheet)

- **Desktop dialog:** paper `width 440`, `borderRadius '16px'`, `bgcolor surface.raised`, `border 1px border.strong`, `boxShadow tokens.shadow.modal`, `padding '22px 24px 20px'`. Title `Remove pantry item` (display 20/700, letterSpacing `-0.01em`); message 14 `text.secondary`, `mt 10`, lineHeight 1.5, item name bolded in `text.primary`. Footer right-aligned, `gap 8`, `mt 22`: `Cancel` (ghost) + `Remove` (danger: `bgcolor state.danger`, `color onDanger`).
- **Mobile sheet** (`Drawer anchor="bottom"`): `bgcolor surface.sheet`, top corners `borderRadius '18px 18px 0 0'`, `boxShadow '0 -10px 30px rgba(0,0,0,0.4)'`, `padding '12px 20px 28px'`. Grab handle (`36×4`, `borderRadius '2px'`, `rgba(255,255,255,0.18)`, centered, `pb 10`). Title 18/700; message 13 `text.secondary` `mt 8`; buttons full-width row `gap 8` `mt 20` `height 44`: `Cancel` ghost + `Remove` danger.

---

## File structure

- **Create** `src/components/ui/ConfirmDialog.tsx` — reusable confirm (dialog/sheet, danger variant).
- **Create** `src/components/ui/__tests__/ConfirmDialog.test.tsx`.
- **Create** `src/components/pantry/PantryListView.tsx` — presentational flat list (desktop table + mobile single-card), header, search slot, pagination slot, empty state.
- **Create** `src/components/pantry/__tests__/PantryListView.test.tsx`.
- **Modify** `src/lib/design-tokens.ts` — add `onAccent.pantry`.
- **Modify** `src/app/pantry/page.tsx` — slim to orchestration; lavender accent; Snackbar errors; wire `PantryListView`, re-chromed Add dialog, `ConfirmDialog`.
- **Modify** `src/app/pantry/__tests__/page.test.tsx` — update to new structure (title "Pantry", flat list, ConfirmDialog).
- **Export** `ConfirmDialog` from `src/components/ui/index.ts`.

---

## Tasks

### Task 1: Add `onAccent.pantry` token

**Files:** Modify `src/lib/design-tokens.ts`; Test `src/lib/__tests__/` (existing token test if present).

- [ ] **Step 1:** In `design-tokens.ts`, change `onAccent: { shop: '#0c1a13' }` → `onAccent: { shop: '#0c1a13', pantry: '#1a0f24' }`.
- [ ] **Step 2:** Typecheck passes (consumers reference `tokens.onAccent.pantry` in later tasks). Commit: `feat(pantry): add onAccent.pantry token`.

### Task 2: Reusable `ui/ConfirmDialog`

**Files:** Create `src/components/ui/ConfirmDialog.tsx` + `__tests__/ConfirmDialog.test.tsx`; Modify `src/components/ui/index.ts`.

Props:

```ts
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string; // default "Confirm"
  cancelLabel?: string; // default "Cancel"
  danger?: boolean; // danger styling on confirm button
  onConfirm: () => void;
  onCancel: () => void;
}
```

- [ ] **Step 1 (test first):** assert it renders `title` + `message`; clicking confirm fires `onConfirm`, cancel fires `onCancel`; `danger` applies the danger confirm color. Render via `renderWithTheme` (so `palette.primary` is bound). Use `useMediaQuery(theme.breakpoints.down('sm'))` to choose `Drawer` (mobile) vs `Dialog` (desktop); test the desktop dialog path (jsdom default width is desktop).
- [ ] **Step 2:** Implement. Desktop = `Dialog` (paper 440, `surface.raised`, `border.strong`, `borderRadius '16px'`, `tokens.shadow.modal`, padding `'22px 24px 20px'`). Mobile = `Drawer anchor="bottom"` (sheet vocab: `surface.sheet`, top `borderRadius '18px 18px 0 0'`, grab handle, padding `'12px 20px 28px'`, full-width buttons h44). Shared `ConfirmBody` renders title (display font) + message + Cancel (ghost) + confirm (danger → `bgcolor state.danger`/`color onDanger`; else primary → `color onAccent.pantry`). Mirror `FinishShopConfirm` structure.
- [ ] **Step 3:** Export from `ui/index.ts`. Run the test → pass. Commit: `feat(ui): reusable ConfirmDialog (dialog/sheet, danger variant)`.

### Task 3: `PantryListView`

**Files:** Create `src/components/pantry/PantryListView.tsx` + `__tests__/PantryListView.test.tsx`.

Props:

```ts
export interface PantryListItem {
  _id: string;
  name: string;
}
export interface PantryListViewProps {
  items: PantryListItem[];
  total: number;
  onAddItem: () => void;
  onDeleteItem: (id: string) => void;
  search?: React.ReactNode; // page owns the search control
  pagination?: React.ReactNode; // page owns MUI Pagination
  emptyMessage?: React.ReactNode;
}
```

(Page maps `pantryItems` → `{ _id, name: item.foodItem.pluralName }`.)

- [ ] **Step 1 (test first):** renders each item name; clicking a row's delete button fires `onDeleteItem(id)`; header shows `Pantry` + `{total} items`; empty list shows `emptyMessage`. Use `renderWithTheme` bound to the pantry accent (extend `renderWithTheme` to accept a section, or wrap in `SectionThemeProvider` — match how chunk-5 tests bound the shop accent).
- [ ] **Step 2:** Implement header (title + accent count subline + `+ Add` primary button), desktop table card (grid `1fr 80px`, eyebrow header, rows with bordered-ghost danger delete `Icon name="delete"`), mobile single card (rows with borderless dim delete), `{search}` slot above the card, `{pagination}` slot below. Exact values per §3. **Use `` `${px}px` `` string form for all `borderRadius`.**
- [ ] **Step 3:** Test green. Commit: `feat(pantry): PantryListView flat list (desktop table + mobile card)`.

### Task 4: Re-chrome the Add dialog (keep `FoodItemAutocomplete`)

**Files:** Modify `src/app/pantry/page.tsx`.

- [ ] **Step 1:** Replace the Add `Dialog` body chrome: `Food item` eyebrow label above `FoodItemAutocomplete` (unchanged props). Header `DialogTitle onClose` → "Add pantry item"; footer `DialogActions` Cancel + Add (`color: tokens.onAccent.pantry`, disabled until `newItem.foodItemId`). Desktop paper width 460 + redesign chrome; mobile full-screen via `responsiveDialogStyle`.
- [ ] **Step 2:** Manually confirm dialog still creates an item (no handler change). Commit folded into Task 6, or `style(pantry): re-chrome Add dialog`.

### Task 5: Wire Remove confirm to `ConfirmDialog`

**Files:** Modify `src/app/pantry/page.tsx`.

- [ ] **Step 1:** Replace the inline delete `Dialog` with `<ConfirmDialog open={deleteConfirmDialog.open} title="Remove pantry item" message={<>Are you sure you want to remove <b>{name}</b> from your pantry?</>} confirmLabel="Remove" danger onConfirm={handleDeleteItem} onCancel={deleteConfirmDialog.cancel} />`. Keep `useConfirmDialog` + `handleDeleteItem` unchanged.
- [ ] **Step 2:** Commit folded into Task 6.

### Task 6: Slim `page.tsx` + lavender accent + Snackbar

**Files:** Modify `src/app/pantry/page.tsx`; Modify `src/app/pantry/__tests__/page.test.tsx`.

- [ ] **Step 1:** Remove the `Kitchen` icon and all `#9c27b0`/`#fff` hex. Header → `PantryListView` (pass items/total/handlers + search slot using the existing `SearchBar` neutralized to the redesign box per §3 + pagination slot + empty box). Title becomes "Pantry" (the view owns it). Remove the MUI `Table`/`Paper`/`Alert` blocks (moved into `PantryListView`).
- [ ] **Step 2:** Replace both `alert('Failed…')` calls with a `Snackbar` (mirror `shopping-lists/page.tsx` `showSnackbar`/`handleCloseSnackbar`/state).
- [ ] **Step 3:** Update `page.test.tsx`: query "Pantry" (not "Pantry Items (N)"), flat-list rows, ConfirmDialog title "Remove pantry item". Keep coverage of: renders items, opens Add dialog, opens Remove confirm, delete calls API, empty state, search. Preserve the `food-item-input.behavior.test.tsx` + `loading.test.tsx` (adjust only if structure forces it).
- [ ] **Step 4:** Commit: `feat(pantry): lavender flat-list redesign + Snackbar errors`.

### Task 7: Validate

- [ ] **Step 1:** `npm run check` → GREEN (lint --max-warnings=0 + full suite + build). Fix any fallout. (Clear `.next` first if a prior build left a prod cache.)
- [ ] **Step 2:** Commit any fixes.

---

## Test list (explicit)

- `ConfirmDialog.test.tsx`: renders title+message; confirm fires `onConfirm`; cancel fires `onCancel`; `danger` applies danger color on confirm.
- `PantryListView.test.tsx`: renders item names; delete button fires `onDeleteItem(id)`; header count = `total`; empty → `emptyMessage`.
- `page.test.tsx` (updated): title "Pantry"; renders fetched items as flat rows; Add button opens Add dialog; delete icon opens ConfirmDialog ("Remove pantry item"); confirm calls `deletePantryItem`; Snackbar on failure; empty state copy (search vs none).
- Preserve `food-item-input.behavior.test.tsx`, `loading.test.tsx`.

## Ownership / auth / migration

No API, schema, or auth change. `/api/pantry`, `createPantryItem`, `deletePantryItem` untouched (still `userId`-scoped server-side). No migration. Visual-only.

## Mobile / responsive

Both breakpoints specified in §3. Desktop = table card; mobile = single list card + full-screen Add dialog + bottom-sheet Remove confirm. Verified at gate #2 (1440 + 430) by the rigorous artboard-scrub method (spec §5 step 2: `evaluate_script` measurement, element-by-element, MUI-gotcha checklist, drive every state).
