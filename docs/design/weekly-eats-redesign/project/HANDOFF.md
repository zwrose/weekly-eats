# Weekly Eats redesign — handoff

A complete dark-mode visual + interaction redesign of the Weekly Eats app, presented as a set of design canvases. Built to be implemented by Claude Code against the existing Next.js codebase.

---

## TL;DR

- **Eight HTML canvases**, one per app surface. Each is a [`<design-canvas>`](design-canvas.jsx) with multiple artboards (mobile, desktop, notes).
- **Two reference canvases**: `Design System.html` (tokens + specimen) and `Nav.html` (nav chrome with the chosen app-icon variant).
- **Section accents do the visual work** — the four top-level sections (Plans, Shop, Recipes, Pantry) each have a distinct color that telegraphs which area you're in. Sub-pages reached via the avatar menu (Food Items, Settings, User Management) share a cool-slate utility accent.
- **Material Symbols Outlined** for all icons. Names match the existing `@mui/icons-material` imports in the codebase 1:1 — when porting, swap `<KitchenIcon />` for `<Icon>kitchen</Icon>` etc.
- **MUI sx → tokenized values.** All color/typography/radii/spacing values trace back to `design-system.md`.

---

## File map

### Canvases (HTML) — open these to view the designs

| File | What's in it | Codebase route |
| --- | --- | --- |
| `Home.html` | Signed-out marketing landing | `src/app/page.tsx` |
| `Weekly Eats Redesign.html` | Meal plans: index, plan view, edit flow (10 states), template, sharing, history | `src/app/meal-plans/*` |
| `Recipes.html` | Recipe list, view, edit, sharing, emoji picker | `src/app/recipes/*` |
| `Shopping Lists.html` | Stores list, per-store list with presence, item editor, import, pantry check, share, finish-shop | `src/app/shopping-lists/*` |
| `Pantry.html` | Pantry list, add, delete confirm | `src/app/pantry/*` |
| `Food Items.html` | Catalog list, filter, view, edit, delete, make-global confirm | `src/app/food-items/*` |
| `Settings.html` | Theme toggle (only setting in scope) | `src/app/settings/*` |
| `Users.html` | User management + pending-approval gate | `src/app/user-management/*`, `src/app/pending-approval/*` |
| `Design System.html` | Token reference + visual specimen | — |
| `Nav.html` | Nav chrome spec, avatar menu, app-icon options | — |

### Source files

| File | Purpose |
| --- | --- |
| `design-system.md` | Canonical design tokens (colors, type, spacing, radii, shadows) |
| `edit-decisions.md` | Locked decisions from the meal-plan edit flow exploration |
| `nav-chrome.jsx` | Shared `<TopNav>`, `<BottomNav>`, `<AppIcon>`, `<NavAvatar>` exposed on `window.NavChrome` |
| `design-canvas.jsx` | Pan/zoom design-canvas primitives (`DCSection`, `DCArtboard`) |
| `artboards-*.jsx` | Per-surface artboard components, IIFE-wrapped, exposing components on `window` |
| `home_hero.png` | Hero photo on the landing page (preserved from main) |

### Older / supporting artboard files

The meal-plan canvas (`Weekly Eats Redesign.html`) is composed of several files that evolved together during the original exploration. They all coexist in the final canvas:

- `artboards-v4.jsx` — mobile plan view
- `artboards-n1-final.jsx` — desktop plan view
- `artboards-b3-spec.jsx` — mobile edit flow (9 states)
- `artboards-b3-desktop.jsx` — desktop edit flow (10 states)
- `artboards-mp-mobile.jsx` — mobile index/create/template/sharing/history
- `artboards-mp-desktop.jsx` — desktop index/create/template/sharing/history

---

## How to read a canvas

1. Open any HTML file in a browser.
2. **Pan** with mouse drag, **zoom** with scroll/pinch. Double-click an artboard label to focus it fullscreen.
3. Each section has a **Notes** artboard at the end — read these for design rationale and mapping back to existing code.
4. The orange post-it–styled "Notes" cards aren't part of the design; they're commentary for the implementer.

---

## Design system

### Color tokens (dark mode)

| Role | Hex | Used for |
| --- | --- | --- |
| `surface.base` | `#0f1115` | Page background |
| `surface.raised` | `#181b21` | Cards, paper |
| `surface.elevated` | `#1e222a` | Inputs, item rows inside cards |
| `surface.sheet` | `#1a1e26` | Modals, bottom sheets |
| `text.primary` | `#e7e9ee` | Default ink |
| `text.secondary` | `#9097a6` | Labels, subtext |
| `text.muted` | `#5b6170` | Disabled, placeholder |
| `border.subtle` | `rgba(255,255,255,0.07)` | Default card edges, dividers |
| `border.strong` | `rgba(255,255,255,0.13)` | Hover edges, focus rings |
| `section.plans` | `#7aa7ff` | Meal plans surfaces |
| `section.shop` | `#6fcf97` | Shopping lists |
| `section.recipes` | `#e8a86b` | Recipes |
| `section.pantry` | `#c79bff` | Pantry |
| `accent.utility` | `#9aa4b3` | Food items, settings, user management (sub-pages) |
| `success` | `#8edcb4` | Confirms, "live" presence |
| `warn` | `#f0c674` | Validation warnings, beta badges |
| `danger` | `#e87a8a` | Destructive actions |

Light-mode values are in `design-system.md`.

### Type

- **Display:** Bricolage Grotesque (variable, weights 500–700) — used for page titles, day names, card headers, dialog titles.
- **Body:** Outfit (400–700) — used for everything else. Numerals use `font-variant-numeric: tabular-nums` for qty/counts.

Full scale in `design-system.md`.

### Spacing, radii, shadows

4-base spacing scale. Radii roll up to 4/8/12/14/16/18/999 (pill). Three shadow tiers (soft / card / sheet / modal). Full reference in `design-system.md`.

---

## App icon

Two variants. Both encode the four section colors in their composition:

- **Squircled (BM-α)** — for the actual app icon (home screen, manifest, marketing landing). Rounded-black square with the bowl + meal blocks inside. See `Nav.html` → "App icon" section, or the `AppIconSq` function in `artboards-home.jsx`.
- **Logomark** — same composition without the black squircle, so the marks sit directly in the dark nav chrome at full contrast. Used in the in-app nav. See `nav-chrome.jsx` `AppIcon`.

When implementing: keep the existing `public/web-app-manifest-*.png` files for OS-level icon use, but render the squircled or logomark SVG inline in the React app.

---

## Nav chrome

`nav-chrome.jsx` is the canonical source. It exposes:

- `TopNav({ active })` — desktop top bar. App icon + wordmark on the left, 4 nav items (icon + label) in the middle, avatar+name pill on the right. Active section gets a 2.5px bottom-border in the section color.
- `BottomNav({ active })` — mobile bottom bar. 4 slots: Plans / Shop / Recipes / Avatar. **Pantry is NOT a bottom-nav slot** — it lives in the avatar menu on mobile (matches main).
- `AppIcon({ size })` — logomark variant (no squircle).
- `NavAvatar({ size })` — initials avatar (mocked "ZR" / Zach Rose).

The avatar menu is shown in `Nav.html`: Pantry (mobile only) · Manage food items · Manage users (admin only) · Settings · Sign out.

---

## What changed vs. main

A non-exhaustive list of meaningful deltas the implementer should know about. Each artboard's **Notes** card has the per-surface detail.

### Global
- **Dark mode is the default.** Main's `lightTheme` is preserved as the light pair but the redesign was designed dark-first.
- **Bricolage Grotesque + Outfit** replace the Figtree/Roboto fallback stack in main's `src/lib/theme.ts`.
- **Section accents on tabs + page chrome.** Active nav tab uses a bottom-border in the section color. Counts at the top of list pages are accented in the section color too (e.g. "**34** recipes").
- **Material Symbols Outlined** webfont for icons. Match MUI import names.
- **No "You" page.** The 4th nav slot on mobile is the user's avatar (opens the menu). On desktop, the avatar + name pill in the top-right serves the same role.
- **Kicker treatment dropped** on most list page headers (Recipes, Plans, Pantry) — the page title alone carries it, nav already signals context.

### Meal plans
- **B3 edit flow locked** — see `edit-decisions.md` for the 8 resolved decisions (validation feedback, dirty-cancel behavior, recipe-qty wording, skip behavior, empty states, remove-group flow, flat group containers).
- **Desktop plan view** uses a wide "today hero" card with B/L/D as columns, with the other six days as a strip beneath. A 28px "TODAY" sliver sits between Tue and Thu in calendar order.
- **Staples bar** is a compact accent-tinted row that expands inline.

### Recipes
- **Section accent: amber** (`#e8a86b`).
- **Recipe view** is now a full page on desktop (was a contained 980px modal).
- **Sharing per-invitee toggles** for Tags + Ratings.
- **Prep instructions** as an inline field below each ingredient row when set.

### Shopping
- **Desktop is a two-pane route** (sidebar of stores + working list) instead of a modal dialog.
- **Real-time presence pill** in the header. Avatar(s) + status dot. States documented in the `Live pill · states` artboard.
- **KEEP / SKIP segmented toggle** in pantry check (clearer than a checkbox for "are we removing this from the list?").
- **Solid finish-shop bar** with a hard top border (no gradient fade — items don't slide visually behind the button).
- **Flat searchable emoji picker** when creating/renaming stores. No categories.

### Pantry
- **Section accent: lavender** (`#c79bff`).
- Trash icons on row deletes (Material Symbols `delete`).

### Food Items / Settings / User Management
- **Cool-slate utility accent** (`#9aa4b3`) for this cluster — distinguishes "system surfaces" from the four primary sections.
- **`+ Add` button** on the Food Items page header. Opens the *same* `AddFoodItemDialog` that `FoodItemAutocomplete` launches elsewhere — designed once, reused.
- **Breadcrumb** is `‹ Back` (contextual, routes to wherever they came from), not `‹ You`.
- **Settings**: dropped the default-meal-plan-owner setting per product decision. Only theme remains.
- **User management actions** rendered as color-tinted action chips (Approve / Deny / Make admin / Revoke admin / Revoke access) for fast row-scan.
- **Pending-approval screen** rewritten with a personalized greeting ("Hang tight, Maya") instead of a boilerplate title.

### Home / marketing
- **Dark mode** to match the in-app aesthetic so the transition into the app is seamless.
- **Hero feature card** in Features section: full-width card with the auto-generation + pantry-check copy on the left and a mini meal-plan → arrow → shopping-list visualization on the right.
- **Limited-beta badge** in the hero (was buried as a caption in main) — sets expectation early.
- **Footer** trimmed to just icon + wordmark + copyright (no Privacy/Terms/Contact links since those pages don't exist).

---

## Implementation notes

- **Color tokens → `src/lib/theme.ts`.** Add the section accents as palette extensions; map `text.primary` etc. to the values above.
- **Type stack:** install Bricolage Grotesque and Outfit via `next/font/google`. Both are free Google Fonts.
- **Icons:** swap `@mui/icons-material` imports for Material Symbols. The icon names in the designs use snake_case (e.g. `calendar_month`, `format_list_bulleted`) — these are the Material Symbols ligature names, which correspond 1:1 to MUI's PascalCase imports.
- **`<deck-stage>` / `<DCArtboard>` are design-canvas-only.** Don't try to port them; they exist purely to lay out the artboards.
- **The IIFE wrappers in `artboards-*.jsx` files exist to prevent name collisions** between the many artboard files loaded into the same `Weekly Eats Redesign.html` page. Implementation can ignore them.
- **Mock data is mock.** All names, emails, recipes, stores, dates in the designs are fabricated. The pending-store-invite "Warehouse run", users "Maya Patel" / "Sara Rose" / "Casey Lin", recipes "Lemon ricotta pasta" etc. — all placeholders.

---

## Architecture & data model

**The redesign is purely visual + interaction.** No schema changes, no new collections, no new API endpoints required. Every surface in the canvases maps to existing model fields.

I audited every artboard against the current type definitions in `src/types/` to confirm this:

| Surface | What it shows | Backing model |
| --- | --- | --- |
| Recipes — tags + stars | per-user tags array, optional rating 1–5 | `RecipeUserData` (existing) |
| Recipes — sharing per-invitee Tags + Ratings | `shareTags` + `shareRatings` toggles, `sharingTypes` array | `RecipeSharingSection` already supports this in main |
| Recipes — ingredient groups, prep instructions | `ingredients: RecipeIngredientList[]` with optional titles, per-ingredient `prepInstructions` | `Recipe` (existing) |
| Pantry — flat checklist | per-user `foodItemId` reference | `PantryItem` (existing) |
| Food Items — Private / Shared by you / Shared by others | `isGlobal` flag + recipe-sharing relationships | existing FoodItem + sharing model |
| Food Items — admin "Make global" toggle | `isGlobal` write (admin-only) | existing |
| Shopping — drag-reorder positions | per-store, per-foodItem float `position` | `StoreItemPosition` (existing) |
| Shopping — Finish shop → purchase history | one record per item per trip | `PurchaseHistoryRecord` (existing) |
| Shopping — store sharing + presence | `Store.invitations[]`, `useShoppingSync` connection states + `activeUsers` | existing |
| Shopping — pantry check (KEEP / SKIP) | client-side filter intersecting `PantryItem.foodItemId` with `ShoppingListItem.foodItemId` | existing — no new field |
| Shopping — unit conflict resolution at import | client-side merge of meal-plan items into list | existing — runs in `lib/shopping-list-utils` already |
| Meal plans — full B3 edit flow | `MealPlan` with `template`, `staples`, day/meal structure | existing |
| Settings — theme | `User.theme` ('light' \| 'dark' \| 'system') | existing |
| Users + pending approval | `User.approvalStatus` + `User.isAdmin` | existing |

---

## Open questions for the implementer

- **Light-mode contrast pass** — the dark palette was designed first. Light-mode values in `design-system.md` need a contrast audit once implemented.
