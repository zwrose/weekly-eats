# Weekly Eats Redesign — preferences

## Design system + conventions (already established)

These are settled — match them on any new work, don't re-litigate.

- **Tokens live in `design-system.md`.** Surfaces, text, borders, section accents, semantic states, type scale, spacing, radii, shadows. Use the tokens; don't invent values.
- **Section accents (dark mode):** Plans `#7aa7ff` · Shop `#6fcf97` · Recipes `#e8a86b` · Pantry `#c79bff`. Avatar-menu / system pages (Food Items, Settings, User Management) share cool-slate `#9aa4b3`.
- **Fonts:** Bricolage Grotesque (display, 500–700) + Outfit (body, 400–700). Numerals use `font-variant-numeric: tabular-nums` for qty/counts.
- **Icons:** Material Symbols Outlined via the Google webfont. Use ligature names matching the existing `@mui/icons-material` imports (`kitchen`, `calendar_month`, `delete`, etc.). Every HTML host needs the font `<link>` + a `.ms` class definition.
- **No emoji icons in nav or controls.** Emoji are fine in user-content placeholders (store names, recipes); for UI chrome, use Material Symbols.
- **No real brand/store names** in mock data — use "Corner market", "Greenleaf", "Local bakery", "Warehouse run", etc.

## Nav chrome

- `nav-chrome.jsx` exposes `TopNav` / `BottomNav` / `AppIcon` / `NavAvatar` on `window.NavChrome`. Reuse — do not redefine these per canvas.
- Mobile bottom nav has **4 slots: Plans / Shop / Recipes / Avatar.** Pantry is NOT a bottom-nav slot (it's in the avatar menu).
- There is no "You" page. The 4th mobile slot is the avatar (opens a sheet menu); on desktop, the avatar pill (top-right) does the same.
- Active section gets a 2.5px bottom-border in its section color on desktop; mobile uses the section color on icon + label.
- Sub-pages reached via the avatar menu (Food Items / Settings / User Management) use `‹ Back` (contextual back), not `‹ You`.

## App icon

BM-α (bowl + meal blocks). Two variants:
- **Squircled** (black-squircle background) — used for the actual app icon and marketing surfaces.
- **Logomark** (no squircle) — used in-app nav chrome so the marks sit directly in the dark bg.

## Artboard file structure

- Each surface has its own `artboards-<surface>.jsx` exposing components on `window`.
- **Wrap every artboard JSX file in an IIFE** (`(function () { ... })()`) so internal helpers don't collide with other artboard files loaded into the same HTML host. There were real name-collision bugs before this was made the convention.
- Each HTML host injects `nav-chrome.jsx` BEFORE the per-surface `artboards-*.jsx` files.
- When iterating, cache-bust script src with `?v=<timestamp>` — the design-canvas preview caches aggressively.

## Notes / annotations on design canvases

**Use inline artboards, not floating post-its.** When attaching notes to a section of
a design canvas, add a final `<DCArtboard>` named "Notes" at the end of the section's
row with the notes content inside. Do NOT use `<DCPostIt>` with absolute coordinates —
floating post-its drift relative to artboards at different zoom levels and can cover
content up unpredictably.

Use this sticky-note styling for the notes-artboard content so they read like
annotations rather than design artboards:

```css
.notes {
  width: 100%; height: 100%; overflow: hidden;
  background: #fef4a8; color: #5a4a2a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  padding: 24px 26px; line-height: 1.5; font-size: 14px;
  box-sizing: border-box;
}
.notes h3 { font-family: 'Bricolage Grotesque', system-ui, sans-serif; margin: 0 0 12px; font-size: 17px; font-weight: 700; letter-spacing: -0.01em; color: #3d2f15; }
.notes h4 { margin: 14px 0 4px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b5826; }
.notes ul { margin: 4px 0 0; padding-left: 18px; }
.notes li { margin-bottom: 4px; }
.notes p  { margin: 0 0 8px; }
.notes b  { color: #3d2f15; }
.notes code { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 3px; }
```

For mobile sections (390px artboards), make the notes artboard ~450px wide so the
prose has room. For desktop sections (1440px artboards), use a narrower notes
artboard (~450px) — it doesn't need to match the design artboard width.

## Out of scope (don't add unless asked)

- `FoodItem.category` and grouped-by-category views in Pantry / Food Items. Earlier exploration mocked categories; final designs render flat.
- Default-meal-plan-owner Setting. Dropped per product call.
- Privacy / Terms / Contact links in the landing footer.
- Pricing, testimonials, or product screenshots in the marketing hero.

## Style preferences

- **No filler / speculative content in docs.** Handoff and product docs should state concrete facts and decisions, not "consider" / "could revisit" / "might want to". If it's deferred, that's fine; just say so once.
- **Tight headers.** Page titles only on top-level surfaces; sub-pages use the title alone (no kicker above it) and let the nav signal context. Counts in section accent color get used as data-ink (`<span style="color: accent">34</span> recipes`).
- **Delete via trash icon, not ✕.** ✕ remains for dismiss/close and tag-chip removal.
- **Don't ask before adding small UI tweaks** when the user has been making rapid iterations; just apply the smallest change that resolves the comment.

## Notes / annotations on design canvases

**Use inline artboards, not floating post-its.** When attaching notes to a section of
a design canvas, add a final `<DCArtboard>` named "Notes" at the end of the section's
row with the notes content inside. Do NOT use `<DCPostIt>` with absolute coordinates —
floating post-its drift relative to artboards at different zoom levels and can cover
content up unpredictably.

Use this sticky-note styling for the notes-artboard content so they read like
annotations rather than design artboards:

```css
.notes {
  width: 100%; height: 100%; overflow: hidden;
  background: #fef4a8; color: #5a4a2a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  padding: 24px 26px; line-height: 1.5; font-size: 14px;
  box-sizing: border-box;
}
.notes h3 { font-family: 'Bricolage Grotesque', system-ui, sans-serif; margin: 0 0 12px; font-size: 17px; font-weight: 700; letter-spacing: -0.01em; color: #3d2f15; }
.notes h4 { margin: 14px 0 4px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b5826; }
.notes ul { margin: 4px 0 0; padding-left: 18px; }
.notes li { margin-bottom: 4px; }
.notes p  { margin: 0 0 8px; }
.notes b  { color: #3d2f15; }
.notes code { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 3px; }
```

For mobile sections (390px artboards), make the notes artboard ~450px wide so the
prose has room. For desktop sections (1440px artboards), use a narrower notes
artboard (~450px) — it doesn't need to match the design artboard width.
