# Frontend Redesign: Linear-Style Density Overhaul

**Date:** 2026-02-22
**Status:** Approved
**Approach:** Approach 2 ("Linear Overhaul") + micro-interactions from Approach 3

## Goals

- Dramatically improve mobile information density (the #1 problem)
- Remove excessive visual chrome (card wrappers, large padding, full-width destructive buttons)
- Replace generic skeleton loaders with content-shaped ones
- Modernize the aesthetic toward Linear/Notion: dense, polished, refined
- Add micro-interactions for premium feel (page transitions, staggered reveals, expand/collapse)
- Preserve all existing functionality

## Design Decisions

- **Theme:** Dark-mode-first design priority
- **Navigation:** Pages replace dialogs for complex views; lightweight dialogs for quick actions only
- **Aesthetic:** Refined utility — clean, dense, sophisticated type hierarchy. Distinctive but not flashy.
- **Colors:** Keep 4-feature color system but refine to desaturated, subtle accent usage
- **Inspiration:** Linear, Notion

---

## 1. Visual System

### Dark Theme Palette

| Token | Value | Usage |
|-------|-------|-------|
| `bg-base` | `#0a0a0b` | Page background |
| `bg-surface` | `#141415` | Cards, elevated surfaces |
| `bg-surface-hover` | `#1c1c1e` | Row hover states |
| `bg-subtle` | `#111112` | Inset areas |
| `border-subtle` | `rgba(255,255,255,0.06)` | List separators |
| `border-default` | `rgba(255,255,255,0.1)` | Input borders, cards |
| `border-emphasis` | `rgba(255,255,255,0.16)` | Focused inputs |
| `text-primary` | `#ececec` | Primary text (slightly off-white) |
| `text-secondary` | `#8a8a8a` | Secondary/muted text |
| `text-tertiary` | `#5a5a5a` | Placeholder, disabled |

### Feature Accent Colors (Desaturated)

| Feature | Old | New | Application |
|---------|-----|-----|-------------|
| Meal Plans | `#1976d2` | `#5b9bd5` (muted steel blue) | Left border, icon tint, active nav |
| Shopping Lists | `#2e7d32` | `#6baf7b` (sage green) | Same pattern |
| Recipes | `#ed6c02` | `#d4915e` (warm amber) | Same pattern |
| Pantry | `#9c27b0` | `#a87bb5` (dusty lavender) | Same pattern |

Colors appear as: nav indicator, page title icon tints, left-border accents on focused items. NOT as large background fills.

### Typography (Figtree, tightened scale)

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Page title | 18px (1.125rem) | 600 | — |
| Section header | 13px (0.8125rem) | 600 | Uppercase, tracking 0.04em, text-tertiary |
| Body | 14px (0.875rem) | 400 | — |
| Secondary | 13px (0.8125rem) | 400 | — |
| Compact/meta | 12px (0.75rem) | 400 | — |
| Button text | 13px (0.8125rem) | 500 | — |

### Spacing

| Element | Old | New |
|---------|-----|-----|
| List item row height | ~52-56px | 36-40px |
| Card/section padding | 24px | 12px |
| Gap between list items | 8-16px + card chrome | 0 (separator only) |
| Page margins (mobile) | 24px | 12px |
| Page margins (desktop) | 48px | 24px |
| Button height | 36-40px | 32px default, 28px compact |
| Input height | 56px (MUI default) | 32px |

### Buttons

- Border radius: 6px (from 24px pill)
- No box-shadow on default state
- Ghost/text buttons for secondary actions
- Icon-only buttons for destructive actions (trash icon, no text)

---

## 2. Navigation & Page Structure

### Desktop Top Nav

- Height: 48px (from ~64px)
- Background: `bg-base` + `border-subtle` bottom border (no shadow)
- Logo: 14px, 600 weight
- Nav items: Text-only (no icons), 13px, 500 weight. Active = 2px bottom border in feature accent color
- User menu: 28px avatar, name on click dropdown

### Mobile Bottom Nav

- Height: 48px (from ~56px)
- Icons: 20px (from 24px), 10px label text
- Active indicator: Small dot/pill in feature accent color
- Respect `env(safe-area-inset-bottom)`

### Page Layout Pattern

```
[Top Nav 48px]
[Page Header: Title (left) + Action Button (right)]
[Search / Filter Bar]
[Content List — flat rows with separators]
[Pagination]
```

- No Paper/Card wrappers around content area
- On mobile, action button = compact icon button (no text)

### Dialogs to Pages Migration

**Become pages:**
- Meal plan view/edit → `/meal-plans/[id]` (edit via `?edit=true`)
- Recipe view/edit → `/recipes/[id]` (edit via `?edit=true`)
- Create recipe → `/recipes/new`
- Meal plan settings → `/meal-plans/settings`

**Stay as dialogs:**
- Create meal plan (lightweight date picker)
- Add food item / pantry item / shopping list item
- Sharing invitations
- Confirm delete
- Shopping list view (checklist works well as modal)
- Shopping list item editor

### Back Navigation

New pages use browser back/forward. Mobile gets a back arrow in page header.

---

## 3. Component Redesigns

### List Rows (Recipes, Food Items, Pantry)

**From:** Bordered Paper cards, ~56px desktop / ~90-100px mobile
**To:** Flat rows with `border-subtle` separators, ~36px desktop / ~44px mobile

Desktop recipe row:
- Emoji + name + tags (tiny pills) + rating (compact "★ 3") + date
- All on one line

Mobile recipe row:
- Line 1: Emoji + name + date
- Line 2: Tags + rating
- ~44px total

Hover: `bg-surface-hover` + subtle left border accent in feature color

### Pantry & Food Items

Compact flat rows, ~40px each. Name + action icon. No card chrome.

### Meal Plan Day View

**From:** Large blue banner per day + separate "Dinner" label + bullet list
**To:** Collapsible single-line sections

```
▾ Mon, Feb 23 · Dinner
  Sweet Baby Ray's BBQ Sauce  ·  1 tbsp
▸ Tue, Feb 24 · Dinner
▾ Sun, Feb 22 · Dinner              Skipped
```

- Day + meal type on one line
- Empty days auto-collapse
- "Skipped" as inline muted label
- Weekly Staples: collapsible, starts expanded

### Meal Plan Edit Mode (Ingredients)

**From (mobile):** 5 stacked full-width elements per ingredient
**To:** Single inline row per ingredient

```
[Food Item ~55%] [Qty ~15%] [Unit ~20%] [🗑 ~10%]
```

- 32px row height
- Column headers above first row (not floating labels per input)
- "Add Meal Item" / "Add Meal Item Group" as compact text buttons

### Recipe Edit Mode (Ingredients)

Same inline row pattern with ingredient group headers:

```
Group: [title input]                    🗑
────────────────────────────────────────
Nectarines            │ 2  │ lbs    │🗑│
Water                 │ 2  │ pcs    │🗑│
+ Add ingredient
────────────────────────────────────────
+ Add ingredient group
```

- "Add prep instructions" = inline icon button (not full-width button per ingredient)
- Remove = trash icon only

### Form Inputs (Global)

**From:** MUI outlined TextField, 56px, floating labels
**To:** Compact inputs

- Height: 32px
- Border: 1px `border-default`
- Label: Static above input, 12px, `text-secondary`, 500 weight
- Focus: `border-emphasis` + subtle glow in feature accent
- No floating label animation

### Search Bar

- 36px height, search icon inside left
- No Paper wrapper
- Filter icon button on right (for tag/rating filters)

---

## 4. Loading States

### Content-Shaped Skeletons

Each page's skeleton exactly mirrors its loaded layout:
- Same row heights, column positions, separator lines
- Skeleton bars match text widths (randomized 40-80%)
- No generic circle + rectangle patterns

### Shimmer Animation

- Subtle left-to-right gradient sweep
- `animation: shimmer 1.5s ease-in-out infinite`
- Respects `prefers-reduced-motion`

### Transition Behavior

1. Skeleton renders immediately (no blank frame, no spinner)
2. Data arrives → skeleton crossfades to real content (~150ms)
3. Real content items do staggered fade-in reveal
4. Page header + search render immediately (not data-dependent)

### No CircularProgress Spinners

All loading states use content-shaped skeletons. Spinners only inside buttons during API calls.

---

## 5. Shopping Lists (Minor Refinements)

Shopping lists already work well. Changes limited to visual system alignment:

- Store list: Remove card wrappers → flat rows with separators
- Action icons: Shrink to 16px, `text-tertiary`
- Shopping list dialog: Tighten row height to ~40px, checkbox to 18px
- Remove "Tap an item to edit" hint (discoverable interaction)
- Checked items: Smooth height collapse animation to "Completed" section

---

## 6. Micro-Interactions & Animation

### Animation Primitives

```css
--duration-fast: 100ms;
--duration-normal: 200ms;
--duration-slow: 300ms;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);
```

### Page Transitions

- Forward (list → detail): Fade in + translate from right 16px, `duration-normal`
- Back: Fade out + translate right 8px, `duration-fast`
- Implementation: CSS animations on route change, or Next.js ViewTransition API

### List Stagger Reveal

- Items: `opacity 0→1`, `translateY(8px)→0`
- Stagger: 30ms per item, first 10 only
- Duration: `duration-normal`
- Only on initial load, not re-renders/filter changes

### Expand/Collapse

- `grid-template-rows: 0fr → 1fr` (no JS height measurement)
- Content fades in during expansion
- Chevron rotates 90° smoothly
- Duration: `duration-normal`

### Interactive Feedback

- Button press: `scale(0.97)` on `:active`
- Row hover: `bg-surface-hover`, `duration-fast`
- Checkbox: Scale bounce (`1→1.15→1`) + checkmark draw
- Delete hover: `text-tertiary` → red
- Input focus: Border color + glow transition

### Reduced Motion

All animations in `@media (prefers-reduced-motion: no-preference)`. Users who prefer reduced motion get instant state changes.

---

## Scope Summary

| Area | Key Changes |
|------|-------------|
| Visual system | Richer dark grays, desaturated accents, tighter type, 32px inputs, 6px radii |
| Navigation | Compact nav bars, pages replace dialogs for complex views |
| Lists | Flat rows with separators (no cards), 36-40px row height |
| Forms | Inline ingredient rows (1 row not 5), compact inputs, icon-only destructive |
| Meal plans | Collapsible day sections, compact headers, inline items |
| Loading | Content-shaped skeletons, shimmer, crossfade |
| Shopping lists | Minor density tightening, same dialog pattern |
| Animations | Page transitions, list stagger, expand/collapse, interactive feedback |
