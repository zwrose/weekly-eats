# Weekly Eats — Design System

Semantic tokens for the dark + light themes. These map 1:1 to the eventual `src/lib/theme.ts` palette + typography updates.

## Color tokens

Naming pattern: `{role}.{variant}`. Roles map to MUI's palette roles where they exist (`background.default`, `text.primary`, etc.) and add app-specific roles (`meal.*`, `accent.*`) on top.

### Surfaces

| Token | Dark | Light | Role |
|---|---|---|---|
| `surface.base`     | `#0f1115` | `#fafaf7` | Page background |
| `surface.raised`   | `#181b21` | `#ffffff` | Cards, paper |
| `surface.elevated` | `#1e222a` | `#f5f3ed` | Inputs, item rows inside cards |
| `surface.sunken`   | `#141619` | `#efeae0` | Past-day cards (dimmed history) |
| `surface.sheet`    | `#1a1e26` | `#ffffff` | Bottom sheets, modals |

### Text

| Token | Dark | Light | Role |
|---|---|---|---|
| `text.primary`   | `#e7e9ee` | `#1a1d23` | Default ink |
| `text.secondary` | `#9097a6` | `#5b6170` | Labels, sub-text |
| `text.muted`     | `#5b6170` | `#9097a6` | Disabled, placeholder, low-emphasis |
| `text.past`      | `#7b818f` | `#7b818f` | History text (dimmed in either mode) |

### Borders

| Token | Dark | Light | Role |
|---|---|---|---|
| `border.subtle` | `rgba(255,255,255,0.07)` | `rgba(0,0,0,0.08)` | Dividers, default card edges |
| `border.strong` | `rgba(255,255,255,0.13)` | `rgba(0,0,0,0.14)` | Hover edges, input focus rings |

### Accent (brand)

| Token | Dark | Light | Role |
|---|---|---|---|
| `accent.base`  | `#7aa7ff` | `#2a6fdb` | Primary action, today halo, recipe links, focused fields |
| `accent.muted` | `rgba(122,167,255,0.16)` | `rgba(42,111,219,0.10)` | Tinted backgrounds, selected pills, TODAY sliver |

### Section accents

Each top-level area of the app uses its own accent in addition to (or in place of) `accent.base`. Carries the current app's per-section color convention forward.

| Token | Dark | Light | Used on |
|---|---|---|---|
| `section.plans`   | `#7aa7ff` | `#2a6fdb` | Meal Plans surfaces |
| `section.shop`    | `#6fcf97` | `#1f8a5b` | Shopping Lists |
| `section.recipes` | `#e8a86b` | `#b56a1f` | Recipes |
| `section.pantry`  | `#c79bff` | `#6f4cb0` | Pantry |

> Within a section, `accent.base` and `accent.muted` resolve to the section color rather than a global value. `meal.*` colors are domain colors (B/L/D/staples) and stay scoped to meal-plan surfaces regardless of section.

---

### Semantic states

| Token | Dark | Light | Role |
|---|---|---|---|
| `success.base`  | `#8edcb4` | `#2e9b6e` | Confirm checks, "no overlap" message |
| `success.muted` | `rgba(142,220,180,0.14)` | `rgba(46,155,110,0.10)` | Success-tinted backgrounds |
| `danger.base`   | `#e87a8a` | `#c14b5d` | Destructive buttons, remove icons |
| `warn.base`     | `#f0c674` | `#b58430` | Validation borders, helper text |
| `warn.muted`    | `rgba(240,198,116,0.12)` | `rgba(181,132,48,0.10)` | Warn-tinted backgrounds |

### Domain (meal types + categories)

| Token | Dark | Light | Role |
|---|---|---|---|
| `meal.breakfast` | `#e8c97a` | `#b58430` | Breakfast section colors |
| `meal.lunch`     | `#8edcb4` | `#2e9b6e` | Lunch section colors |
| `meal.dinner`    | `#f0a08a` | `#c4634a` | Dinner section colors |
| `meal.staples`   | `#c4a7e7` | `#8a64c0` | Weekly-staples category |

> Light-mode meal colors are intentionally darker than the dark-mode ones to maintain ~4.5:1 contrast with `surface.raised`.

---

## Typography

Two families:
- **Display**: Bricolage Grotesque — variable, used for page titles, day-names, card headers.
- **Body**: Outfit — for everything else. Numerals: tabular-nums for qty and counts.

### Scale

| Token | Family | Size | Weight | Tracking | Role |
|---|---|---|---|---|---|
| `display.xl` | Bricolage | 32 | 700 | -0.025em | Hero day header (desktop) |
| `display.lg` | Bricolage | 30 | 700 | -0.02em  | Page H1 (desktop) |
| `display.md` | Bricolage | 24 | 700 | -0.02em  | Page H1 (mobile), section header |
| `display.sm` | Bricolage | 18 | 700 | -0.01em  | Dialog title |
| `display.xs` | Bricolage | 15 | 700 | -0.01em  | Sheet header, small dialog |
| `body.lg`    | Outfit    | 14 | 500 | normal   | Default UI text, button labels |
| `body.md`    | Outfit    | 13 | 400-500 | normal | Sub-text, secondary rows |
| `body.sm`    | Outfit    | 12 | 400-500 | normal | Captions, helper text |
| `body.xs`    | Outfit    | 11 | 400 | normal   | Hints, fine print |
| `label.md`   | Outfit    | 11 | 700 | 0.14em uppercase | Section labels (kicker), field labels |
| `label.sm`   | Outfit    | 10 | 700 | 0.16em uppercase | Strip-cell day labels, in-card labels |
| `label.xs`   | Outfit    |  9 | 700 | 0.16em uppercase | TODAY badge, meal-type letters |

---

## Spacing

4-base scale. Use these instead of arbitrary values.

| Token | px |
|---|---|
| `space.xs`  | 4  |
| `space.sm`  | 8  |
| `space.md`  | 12 |
| `space.base`| 14 (≈ default inner padding) |
| `space.lg`  | 16 |
| `space.xl`  | 18 |
| `space.2xl` | 22 |
| `space.3xl` | 24 |
| `space.4xl` | 32 |

---

## Radii

| Token | px | Used by |
|---|---|---|
| `radius.xs`   | 4  | Inline chip backgrounds, mini tags |
| `radius.sm`   | 6  | Result-row icon swatches |
| `radius.md`   | 8  | Chips, buttons, inputs |
| `radius.lg`   | 10 | Larger buttons, ghost icon buttons, smaller cards |
| `radius.xl`   | 12 | Default card row |
| `radius.2xl`  | 14 | Day card |
| `radius.3xl`  | 16 | Dialog |
| `radius.sheet`| 18 | Bottom-sheet top edges |
| `radius.pill` | 999 | TODAY pill, status chips |

---

## Shadows

| Token | Value | Role |
|---|---|---|
| `shadow.soft`     | `0 2px 8px rgba(0,0,0,0.12)` | Subtle lifts (light) |
| `shadow.card`     | `0 0 0 3px rgba(122,167,255,0.08)` | Today halo glow |
| `shadow.sheet`    | `0 -10px 30px rgba(0,0,0,0.4)` | Bottom sheet drop |
| `shadow.modal`    | `0 24px 60px rgba(0,0,0,0.5)` | Centered dialog |

---

## Primitive components

Shallow set — variants documented here, see the visual specimen for actual rendering.

- **Button** — primary / ghost / danger. Heights: 36 (compact), 40 (default).
- **IconButton** — square ghost button. 36×36, `border.subtle` outline.
- **Chip** — selectable text pill. Selected uses `accent.muted` bg + `accent.base` border.
- **Toggle** — 36×22 switch, `accent.base` when on.
- **Radio row** — full-width row with circle indicator, optional sub-label.
- **Input** — text input, 36 height, `border.subtle` default → `accent.base` + `accent.muted` ring on focus.
- **Search input** — has leading `⌕` glyph + ↵ hint tag, otherwise same as input.
- **Pill (status)** — small uppercase label badge, status-color tinted.
- **Card** — `surface.raised` + `radius.2xl` (`xl` for sub-cards) + `border.subtle`.

## Stars

5-star rating component. Used in: recipe list rows, recipe view, recipe edit.

- Color: `warn.base` (filled) + same color at 22% opacity (empty).
- Sizes: 12 (list rows), 13 (desktop table), 14-18 (recipe view).
- Read-only by default; in edit mode, each star is clickable + a Clear button sits adjacent.

## Access chip

Status pill variant for recipe access level. Three states:
- **Private** — `text.secondary`
- **Shared by you** — `success.base`
- **Shared by others** — `accent.base`

All three use the same pill shape as the standard status pill (`label.sm` text, `radius.pill`, `border.subtle`).

## Selectable tag

Tag chip variant for multi-select filters. Selected: `accent.muted` bg + `accent.base` border + leading ✓. Used in the tags filter sheet (mobile) and dropdown (desktop). The same component renders inline editable tag pills in recipe edit (with a trailing ✕ instead of a leading ✓).

---

## Domain components

- **Day card** — `surface.raised` card with day header, B/L/D rows, optional today halo (`accent.base/55` border + `shadow.card`).
- **Meal row** — flat row with B/L/D letter in meal color, item name(s), optional emoji + recipe tag + qty chip + unit chip.
- **Group section** — flat (no nesting box). Group label row with title input + ✕, then item rows underneath.
- **Staples bar** — accent-tinted collapsed row: `Staples | Group (n) · Group (n) | total | ✎ | ▾`. Expands inline.
- **Plan row** — list row for index/history: calendar emoji + name + sub-text + ›.
- **TODAY sliver** — 28px accent-tinted cell with `↑` + vertical "TODAY" text. Lives between Tue and Thu in the desktop week strip.
- **Hero today (desktop)** — wide card spanning content width with B/L/D in three columns.

---

## Light-mode notes

Light mode currently exists in the app and is required. The dark palette was designed first; the light values above mirror role-by-role with attention to contrast. A few things to test once we implement:

- Recipe link contrast against `surface.raised` (current light accent of `#2a6fdb` on `#ffffff` clears AAA).
- Meal-type chips at `label.xs` size in light mode (10-11px uppercase against dark text — should hit AA at minimum).
- The `accent.muted` tints behind selected chips — at 10% alpha they may be too subtle in light mode; bump to 14% if needed.

---

## Surfaces covered

As of now, the design system has been validated against:

- **Meal plans** — mobile + desktop list, plan view, edit flow, create, template, sharing, history.
- **Recipes** — mobile + desktop list (with filters), view, edit, sharing, emoji picker.

Not yet designed (will extend tokens + components as designed):
- Shopping lists
- Pantry
- Food items catalog
- Pending-approval state
- User management (admin)
- Settings
