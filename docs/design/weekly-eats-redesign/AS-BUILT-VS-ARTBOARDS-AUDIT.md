# As-Built vs Artboards — Fidelity Audit (earlier chunks)

> **Temporary review artifact.** Generated 2026-05-30 for the user to triage. Not part of the
> shipped design bundle — delete once decisions are made. Lives in `docs/` (git-tracked, not
> gitignored) so it renders in the GitHub UI.

## Disposition — triaged & actioned 2026-05-30

The findings below were reviewed with the user; gaps were either **closed** (code now matches the
artboard) or **kept as-built** (the build is the better call — update the spec, not the code).

**Closed (committed):**

- `body.md` type weight 400 → **500** + **canonical button radius 10** system-wide — `a3a5377`
- AvatarMenu **identity header** (avatar + name + email), **colored item icons**, mobile **sheet
  surface + drag handle + rounded top + shadow** — `d7e2e67`
- Index **PlanRow rebuilt** (accent tile, display-font name, date range, CURRENT pill + glow,
  chevron), **section labels 10px + divider rule**, **ghost-icon header buttons**, title 30 — `ec9d301`
- Template **borderless cards (r14)** + **custom pill toggle** — `6a05d05`
- Sharing **Accept/Decline text buttons**, email 38, avatar 32 + **red trash remove**, desktop
  dialog **raised / r16 / border / modal shadow**, **pill-shaped status pill** — `84948c3`
- Mobile meal editor **dressed as a tall bottom sheet** (handle, rounded top, surface.sheet,
  shadow; kept full-height) — `e02c14e`

**Kept as-built (decision — do NOT close; reconcile the spec instead):**

- Notification **dot stays red** (`state.danger`) — reads as "needs attention" better than blue.
- History stays a **year → month accordion** (scales better than the flat list).
- Template staples stay **expanded** (artboard overruled in the spec).
- Bottom-nav 4th label stays **"Account"** (not "You").
- Live **counts** on section/staples labels; **"Shared with you" per-owner grouping + Leave**;
  BottomNav **safe-area-inset** padding; pill/tab **hover** polish.
- Additive tokens (`danger.muted` — used in 5 places, `accentUtility`, soft/sheet/modal shadows)
  stay; fold them into the token spec so they're signed off.

> The detailed sections below are the original audit (unedited) — they describe the pre-fix state.

## Scope

This audits the **built, non-Recipes** redesign surfaces against their artboards:

| Chunk | Surface                    | Artboard(s)                                            | As-built                                                             |
| ----- | -------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| 1     | Design System / Foundation | `artboards-ds-tokens.jsx`, `artboards-ds-specimen.jsx` | `src/lib/design-tokens.ts`, `src/lib/theme.ts`, `src/app/layout.tsx` |
| 2     | Nav chrome                 | `artboards-nav.jsx`, `nav-chrome.jsx`                  | `src/components/nav/*`                                               |
| 3     | Meal Plans (desktop)       | `artboards-mp-desktop.jsx`                             | `src/app/meal-plans/*`, `src/components/meal-plans/*`                |
| 3     | Meal Plans (mobile)        | `artboards-mp-mobile.jsx`                              | same                                                                 |

**Out of scope:** Recipes (Chunk 4 — just exhaustively aligned). Shopping / Pantry / Food Items /
Users / Settings / Home (Chunks 5–10 — **not yet built**, still old UI, nothing to compare).

## Method

- **Code-level comparison** (the bulk below): each artboard's exact values — colors, type scale,
  spacing, radii, dimensions — extracted and compared digit-for-digit against the as-built
  component `sx`/token values, with `file:line` citations on both sides. Severity is
  **MATERIAL** (a user would notice) / **MINOR** / **TRIVIAL** (sub-pixel / imperceptible).
- **Live visual pass** (`localhost:3235`, signed-in, real prod data, via chrome-devtools at
  1440×900 and 430×932): I opened each built screen at both breakpoints to validate the code
  findings and resolve two cross-agent conflicts. Results in "Live visual validation" below.

Counts are per the detailed sections; where an agent's prose summary and its tagged findings
disagree, trust the tagged `[SEVERITY]` items in the body.

---

## Executive summary

Overall fidelity is **high**. The token foundation (surfaces, text, borders, section accents,
meal colors, semantic states, radius + spacing scales, font families, and ~12 of 13 type styles)
matches the artboards exactly, and the desktop **TopNav** is a near-pixel-perfect transcription.
The gaps cluster in three places: the **Meal-Plans index row**, the **mobile meal editor**, and
the **avatar menu** — plus one app-wide type-weight slip.

### Discrepancy counts

| Surface              | Material | Minor | Trivial | Intentional (not bugs) |
| -------------------- | -------- | ----- | ------- | ---------------------- |
| Design System        | 1        | 1     | 4       | —                      |
| Nav chrome           | 2        | 4     | 5       | 4                      |
| Meal Plans (desktop) | 6        | 13    | 8       | 6                      |
| Meal Plans (mobile)  | 2        | 12    | 8       | (same as desktop)      |

> Note: the desktop & mobile meal-plan audits overlap heavily (they share components), so the
> _distinct_ material issues across both breakpoints de-duplicate to the ~8 listed next.

### Top material issues (de-duplicated, highest-impact first)

1. **Meal-Plans index row is gutted** _(desktop + mobile, both MATERIAL — live-confirmed)_.
   The artboard row is a rich card: accent calendar tile, plan name in **display font**, a
   `CURRENT`/`NOW` pill, a **date-range subtitle**, "Shared by …", a trailing chevron, and an
   accent ring + glow on the current plan. As-built is a bare `calendar_month` icon + plan name
   in body font — no tile, no date range, no pill, no chevron, no current-plan highlight.
   `page.tsx:88-126`.
2. **Mobile meal editor is a full-screen Dialog, not a bottom sheet** _(MATERIAL — live-confirmed)_.
   No drag handle, no rounded top corners, no upward sheet shadow — it reads as a takeover. The
   editor's _own_ Qty/Unit sub-overlays correctly render as `surface.sheet` bottom sheets, so this
   is an internal inconsistency. `MealEditorDialog.tsx` + `theme.ts:160-167` (`responsiveDialogStyle`).
3. **AvatarMenu drops the identity header + uses the wrong sheet surface** _(2× MATERIAL — live-confirmed)_.
   No avatar/name/email header block (artboard shows one in both popover and sheet); the mobile
   sheet uses `surface.raised` (#181b21) instead of `surface.sheet` (#1a1e26) with no drag handle
   or top radius; menu-item icons are monochrome instead of color-tinted. `AvatarMenu.tsx:81-130`.
4. **`body.md` type weight is 400, spec is 500** _(MATERIAL, app-wide)_. The most common 13px body
   text renders one weight step lighter than designed. `theme.ts:64` / `artboards-ds-tokens.jsx:94`.
5. **Template cards carry a border (spec omits it) + radius 12 vs 14** _(MATERIAL)_. `TemplateSettings.tsx:164-169`.
6. **Template staples preview is over-decorated** _(MATERIAL)_. Renders as dot + uppercase group
   header + ruled ingredient list (`MealItemLine`) instead of the artboard's quiet bold-title +
   flat list. `TemplateSettings.tsx:330-340`.
7. **Sharing pending-invite Accept/Decline are icon chips, not labeled text buttons** _(MATERIAL)_.
   Less explicit than the artboard's "Accept"/"Decline" ghost text buttons. `ShareMealPlansDialog.tsx:196-221`.
8. **`danger.muted` token is invented** _(MINOR but un-specced)_. Not in the artboard tokens —
   a reasonable extrapolation, but never signed off. `design-tokens.ts:41`.

### Cross-cutting minor themes (recur across surfaces)

- **Ghost-icon header buttons** (gear / share, 36×36 bordered transparent squares in the spec) are
  rendered as bare circular MUI `IconButton`s with no border box.
- **Notification dot badge is red** (`state.danger`) instead of the spec's **accent blue** with a 2px ring.
- **Toggles use MUI `Switch`** rather than the artboard's custom 36×22 accent pill (template).
- **Primary button** radius 8 vs 10 and height ~36 vs 38 (global `theme.ts` — affects every screen).
- **Section labels** are 11px and lack the trailing 1px divider rule (spec is 10px + rule); they
  also append live counts ("Current · 2") the artboard omits (arguably an improvement).

---

## Live visual validation (2026-05-30)

I opened every built screen at desktop (1440) and mobile (430) on real prod data. Highlights:

- **Nav TopNav (desktop):** matches — logo + wordmark, Plans/Shop/Recipes/Pantry tabs with the
  blue active underline, per-section colored icons, avatar pill with the real Google photo. ✅
- **Nav BottomNav (mobile):** matches grid/icons/labels; 4th slot reads **"ACCOUNT"** (spec says
  "You" — minor copy drift, confirmed).
- **Meal editor (mobile):** **confirmed full-screen, square-cornered, edge-to-edge — no sheet
  treatment.** Validates issue #2.
- **AvatarMenu (mobile):** **confirmed bare drawer** — monochrome icons (Pantry / Manage food
  items / Manage users / Sign out), **no identity header**, no drag handle, raised surface.
  Validates issue #3. _(Caveat: the missing "Settings" item is expected — Settings is a Chunk-9
  placeholder, not yet built — so treat its absence as deferred, not a true gap.)_
- **Sharing sheet (mobile):** a proper bottom sheet (drag handle, rounded top, `surface.sheet`). ✅
- **Template (desktop):** bordered two-card layout with decorated dot + uppercase staples groups —
  validates issues #5 and #6.
- **Plan detail (both):** clean and on-system (back-link, `MEAL PLAN` eyebrow, display title, date
  range, ⋯ menu, STAPLES summary bar, day cards). **The mobile artboard has no plan-detail screen
  to compare against**, so this is pattern-consistency only — no value-by-value mismatch.

### Two conflicts the agents surfaced — resolved live

- **Sharing status pill.** The ledger says the accepted/pending pill is "omitted (no field on
  `SharedUser`)". **It is actually rendered** — I saw a green **`ACCEPTED`** pill on a shared row.
  So: the pill is **present and correct for accepted** (matches the artboard); only the _pending_
  variant differs (built = warn-yellow; spec = bordered-dim). **Action:** correct the stale ledger
  note; optionally restyle the pending pill. This is a minor styling delta, **not** a missing feature.
- **History / "View older".** The CURRENT section was empty (no current-week plan); older plans are
  presented as a **nested year → month accordion** (2026 ▸ March ▸ "Week of March 7, 2026"), not the
  artboard's flat "Past · last 6 weeks" row list. Worth a glance to decide if the accordion is the
  intended history pattern or a divergence from the spec's history screen.

---

## Detailed findings

The four sections below are the full value-by-value comparisons (one per audited surface).

---

# Design System — As-Built vs Artboards

## Summary

- 6 discrepancies (1 material, 5 cosmetic/trivial)
- Overall fidelity is very high. The dark palette (surfaces, text, borders, accent, section accents, meal colors, semantic states), the radius scale, the spacing scale, the font families, and the entire type scale (display.xl→xs, body.lg→xs, label.md→xs) all map to the as-built tokens and MUI theme with exact, digit-for-digit agreement. The artboards are dark-only canonical (light mode was deliberately dropped, per the header comment in `design-tokens.ts`), so light-mode artboard values are out of scope and not flagged. The only substantive gap is the `danger.muted` token: the artboard never defines one, yet the as-built tokens invent a value — a fabrication rather than a contradiction. The remaining items are additive tokens with no artboard home (shadows, accentUtility) and a couple of naming-shape differences (`shop` vs `shopping`, numeric space/radius keys vs named) that have zero visual impact.

## Discrepancies

### [MINOR] `danger.muted` exists as-built but is absent from the artboard spec

- **Artboard:** `danger` has only `{ base: '#e87a8a' }` — no `muted` key defined for dark (`artboards-ds-tokens.jsx:29`). The specimen renders only `danger.base` (`artboards-ds-specimen.jsx:76`), confirming no muted danger swatch was specced.
- **As-built:** `danger: '#e87a8a'`, `dangerMuted: 'rgba(232,122,138,0.14)'` (`src/lib/design-tokens.ts:40-41`).
- **Impact:** The as-built code defines a translucent danger fill (14% alpha) that the design never specified. `0.14` mirrors `successMuted`'s alpha, so it is a reasonable extrapolation, but it is an un-specced value — if a danger-tinted background appears anywhere it will not have been signed off in the artboards.

### [TRIVIAL] `success.muted` alpha differs between specimen swatch context and token — confirmed matching (no issue)

- **Artboard:** `success.muted: 'rgba(142,220,180,0.14)'` (`artboards-ds-tokens.jsx:28`).
- **As-built:** `successMuted: 'rgba(142,220,180,0.14)'` (`src/lib/design-tokens.ts:39`).
- **Impact:** None — values are identical. Listed only to record that the semantic-state muted alphas (success 0.14, warn 0.12) were explicitly verified and match.

### [TRIVIAL] Section accent key renamed `shop` → token keeps `shop`, but MUI palette/section naming uses `shop` consistently

- **Artboard:** `section.shop: '#6fcf97'` (`artboards-ds-tokens.jsx:39`).
- **As-built:** `section.shop: '#6fcf97'` (`src/lib/design-tokens.ts:32`).
- **Impact:** None — key name and hex both match exactly (plans `#7aa7ff`, shop `#6fcf97`, recipes `#e8a86b`, pantry `#c79bff` all match). Recorded to confirm the section-accent group is fully faithful.

### [TRIVIAL] Spacing/radius scale keys use named identifiers as-built vs the artboard's `2xl/3xl/4xl/huge`

- **Artboard:** `SPACE = { xs:4, sm:8, md:12, base:14, lg:16, xl:18, '2xl':22, '3xl':24, '4xl':32 }`; `RADIUS = { ...,'2xl':14,'3xl':16, sheet:18, pill:999 }` (`artboards-ds-tokens.jsx:103-104`).
- **As-built:** `space: { ..., xxl:22, xxxl:24, huge:32 }`; `radius: { ..., xxl:14, xxxl:16, sheet:18, pill:999 }` (`src/lib/design-tokens.ts:51-52`).
- **Impact:** None visually. The artboard's `'2xl'/'3xl'/'4xl'` map to as-built `xxl/xxxl/huge` and every numeric value is identical (space: 4/8/12/14/16/18/22/24/32; radius: 4/6/8/10/12/14/16/18/999). Only the JS-identifier-friendly key names differ.

### [TRIVIAL] `accentUtility` token has no artboard counterpart

- **Artboard:** No `accentUtility` / utility-grey accent appears in the tokens or specimen.
- **As-built:** `accentUtility: '#9aa4b3'` (`src/lib/design-tokens.ts:36`), wired into the MUI `secondary` palette and `palette.accentUtility` (`src/lib/theme.ts:13,26`).
- **Impact:** Additive token for a neutral/utility accent with no spec home. Not a contradiction; the design simply never defined a utility-grey, so it is unverified against the artboards.

### [TRIVIAL] Shadow scale has no artboard counterpart (artboard only references `shadow.card` by name)

- **Artboard:** The specimen references "shadow.card" as a label and renders the today-halo as `boxShadow: 0 0 0 3px ${accent.muted}` where `accent.muted = rgba(122,167,255,0.16)` (`artboards-ds-specimen.jsx:220,254,257`). No numeric shadow scale (soft/sheet/modal) is defined in the tokens file.
- **As-built:** `shadow: { soft:'0 2px 8px rgba(0,0,0,0.12)', card:'0 0 0 3px rgba(122,167,255,0.08)', sheet:'0 -10px 30px rgba(0,0,0,0.4)', modal:'0 24px 60px rgba(0,0,0,0.5)' }` (`src/lib/design-tokens.ts:53-58`).
- **Impact:** Mostly additive (soft/sheet/modal are un-specced). One nuance: the as-built `shadow.card` uses `rgba(122,167,255,0.08)` (8% alpha), whereas the specimen's halo is drawn with `accent.muted` at **0.16** alpha. So a literal reading of the specimen halo (16%) is twice as opaque as the named `shadow.card` token (8%). However, the specimen labels that element "shadow.card + accent border" while drawing it with `accent.muted`, so the spec is internally ambiguous about whether the 3px halo should be 8% or 16%. Flagging as trivial because the halo is a faint focus ring either way; the 8%/16% delta is barely perceptible.

## Matches (confirmed correct)

- **Surface ramp:** base `#0f1115`, raised `#181b21`, elevated `#1e222a`, sunken `#141619`, sheet `#1a1e26` — all exact (`design-tokens.ts:9-14` vs `artboards-ds-tokens.jsx:7-13`).
- **Text:** primary `#e7e9ee`, secondary `#9097a6`, muted `#5b6170`, past `#7b818f` — all exact.
- **Border:** subtle `rgba(255,255,255,0.07)`, strong `rgba(255,255,255,0.13)` — exact.
- **Accent:** base `#7aa7ff`, muted `rgba(122,167,255,0.16)` — exact.
- **Section accents:** plans `#7aa7ff`, shop `#6fcf97`, recipes `#e8a86b`, pantry `#c79bff` — exact.
- **Meal (domain) colors:** breakfast `#e8c97a`, lunch `#8edcb4`, dinner `#f0a08a`, staples `#c4a7e7` — exact.
- **Semantic states:** success base `#8edcb4` / muted `rgba(142,220,180,0.14)`; warn base `#f0c674` / muted `rgba(240,198,116,0.12)`; danger base `#e87a8a` — all exact (only danger.muted is extra, flagged above).
- **Radius scale:** xs4 sm6 md8 lg10 xl12 xxl14 xxxl16 sheet18 pill999 — all exact (key names aside).
- **Spacing scale:** xs4 sm8 md12 base14 lg16 xl18 xxl22 xxxl24 huge32 — all exact (key names aside).
- **Font families:** display = Bricolage Grotesque, body = Outfit — matches artboard `TYPE.display`/`TYPE.body` (`artboards-ds-tokens.jsx:85-86`), registered as `--font-display`/`--font-body` in `layout.tsx:7-19` and referenced in `theme.ts:4-5`. globals.css body fallback chain also uses Outfit (`globals.css:9`).
- **Type scale (all 13 styles exact in family/size/weight/letter-spacing):**
  - display.xl 32/700/-0.025em → `displayXl` (`theme.ts:40-46`)
  - display.lg 30/700/-0.02em → `displayLg` / `h1` (`theme.ts:33,47-53`)
  - display.md 24/700/-0.02em → `displayMd` / `h2` (`theme.ts:34,54-60`)
  - display.sm 18/700/-0.01em → `displaySm` / `h3` (`theme.ts:35,61`)
  - display.xs 15/700/-0.01em → `displayXs` / `h4` (`theme.ts:36,62`)
  - body.lg 14/500 → `bodyLg` / `body1` (`theme.ts:37,63`)
  - body.md 13/500 → `bodyMd`/`body2` (note nuance below)
  - body.sm 12/400 → `bodySm` (`theme.ts:65`)
  - body.xs 11/400 → `bodyXs` (`theme.ts:66`)
  - label.md 11/700/0.14em uppercase → `labelMd` (`theme.ts:67-73`)
  - label.sm 10/700/0.16em uppercase → `labelSm` (`theme.ts:74-80`)
  - label.xs 9/700/0.16em uppercase → `labelXs` (`theme.ts:81-87`)
  - Note: artboard `body.md` weight is **500** (`artboards-ds-tokens.jsx:94`); the dedicated `bodyMd` variant uses weight 400 (`theme.ts:64`) while the standard `body2` variant uses 400 too (`theme.ts:38`). This is a 500→400 weight difference on body.md — see below.

## Addendum: one type-scale weight nuance worth noting

### [MATERIAL] `body.md` weight is 500 in the artboard but 400 as-built

- **Artboard:** `'body.md': { family:'body', size:13, weight:500 }` (`artboards-ds-tokens.jsx:94`).
- **As-built:** `bodyMd: { fontSize:'13px', fontWeight:400 }` (`src/lib/theme.ts:64`); the standard `body2` variant is also `fontWeight:400` (`theme.ts:38`).
- **Impact:** 13px body text renders one weight step lighter (Regular 400) than the spec's Medium 500. On a dark UI at small sizes this is a perceptible drop in text density/legibility for the most common secondary body size. This is the single material fidelity gap in the type scale — every other style matches the artboard weight exactly.

---

# Nav Chrome — As-Built vs Artboards

## Summary

- 11 discrepancies (2 material, 4 minor, 5 trivial), 4 intentional deviations noted.
- The desktop TopNav is a near-perfect transcription of the artboard: every dimension, padding, font size/weight, the 2.5px section-color underline indicator, the per-section icon colors, and the avatar pill match to the pixel. The mobile BottomNav matches on grid layout, icon size, label typography (10px/600/uppercase/0.04em tracking) and the active-section accent per tab; the only divergences are the bottom-padding mechanism (safe-area-inset vs a fixed 22px), the label text changed from "You"→"Account", and active-tab label color which both build correctly. The AvatarMenu is where fidelity diverges most: the artboard shows a rich popover/sheet with a user identity header (avatar + name + email), a colored utility accent on each icon, and a specific item set/order — the build ships plain MUI `Menu`/`Drawer` rows with no header block, monochrome icons, no Pantry color, and the sheet uses the wrong surface token (raised vs sheet) and omits the drag handle. Item set, order, and admin-gating are otherwise correct.

## Token map (artboard `C.*` / `T.*` → `tokens.*`)

- `C.bg` #0f1115 → `tokens.surface.base` (`background.default`)
- `C.paper` #181b21 → `tokens.surface.raised` (`background.paper`)
- `C.paperHi` #1e222a → `tokens.surface.elevated`
- `C.sheet` #1a1e26 → `tokens.surface.sheet`
- `C.ink` #e7e9ee → `tokens.text.primary`
- `C.dim` #9097a6 → `tokens.text.secondary`
- `C.mute` #5b6170 → `tokens.text.muted`
- `C.edge` rgba(255,255,255,0.07) → `tokens.border.subtle`
- `C.edgeHi` rgba(255,255,255,0.13) → `tokens.border.strong`
- `C.plans` #7aa7ff → `tokens.section.plans`
- `C.shop` #6fcf97 → `tokens.section.shop`
- `C.recipes` #e8a86b → `tokens.section.recipes`
- `C.pantry` #c79bff → `tokens.section.pantry`
- utility `#9aa4b3` → `tokens.accentUtility`

## Discrepancies

### [MATERIAL] AvatarMenu has no user-identity header (avatar + name + email)

- **Artboard:** Both the desktop popover and the mobile sheet open with an identity header block — avatar + display name + email — separated by a `1px ${C.edge}` divider before the action items. Desktop: `Avatar size={36}`, name 14/600, email 11/`C.dim` (`artboards-nav.jsx:242-248`). Mobile sheet: `Avatar size={42}`, name `display` 16/700, email 12/`C.dim` (`artboards-nav.jsx:320-326`).
- **As-built:** `AvatarMenu` renders only the action `MenuItem`s / `ListItemButton`s and a Sign-out row. No avatar, name, or email header in either variant (`src/components/nav/AvatarMenu.tsx:81-130`).
- **Impact:** Loses the account context the artboard establishes at the top of both menus; the menu reads as a bare action list.

### [MATERIAL] Mobile avatar sheet uses wrong surface token and omits the drag handle

- **Artboard:** Bottom sheet background is `C.sheet` (#1a1e26), with rounded top corners `borderTopLeftRadius/RightRadius: 18`, shadow `0 -10px 30px rgba(0,0,0,0.4)`, and a centered drag handle (`width 36, height 4, radius 2, rgba(255,255,255,0.18)`) at the top (`artboards-nav.jsx:311-319` / `nav-chrome` sheet styling). `C.sheet`/`tokens.surface.sheet` and `tokens.shadow.sheet`/`tokens.radius.sheet` exist specifically for this.
- **As-built:** Uses a plain MUI `Drawer anchor="bottom"`, whose paper inherits the global `MuiPaper` override `backgroundColor: tokens.surface.raised` (#181b21), not `surface.sheet`. No drag handle, no explicit top radius, no sheet shadow (`src/components/nav/AvatarMenu.tsx:82-101`; `theme.ts:135-138`).
- **Impact:** Wrong sheet color (#181b21 vs #1a1e26), squared corners, and a missing grab affordance — the sheet visually reads as a generic drawer rather than the designed bottom sheet.

### [MINOR] Avatar-menu item icons are monochrome; artboard colors them

- **Artboard:** Each menu row's icon is tinted — Pantry icon = `C.pantry` (#c79bff), and Food items / Manage users / Settings icons = the utility accent `#9aa4b3`; Sign out icon = `C.dim`. Icons are `size 17` (`artboards-nav.jsx:189-214`).
- **As-built:** All icons render with default `color="inherit"` (text color), no per-item tint — Pantry is not purple, utility items are not slate (`src/components/nav/AvatarMenu.tsx:88,96,117`).
- **Impact:** Drops the color-coding that ties menu items to their section/utility accents.

### [MINOR] "Settings" menu item is missing from the AvatarMenu

- **Artboard:** Item list is Pantry (mobile only) → Manage food items → Manage users (admin) → **Settings**, then divider → Sign out (`artboards-nav.jsx:187-216`).
- **As-built:** Actions are Pantry (sheet only) → Manage food items → Manage users (admin), then divider → Sign out. No Settings row (`src/components/nav/AvatarMenu.tsx:54-75`).
- **Impact:** Settings page is reachable in the artboard via the avatar menu but has no entry point here. (Note: may be intentionally relocated elsewhere — flagging because the artboard explicitly lists it.)

### [MINOR] BottomNav avatar-slot label changed "You"/"Zach" → "Account"

- **Artboard:** The 4th bottom-nav slot label is "You" (`artboards-nav.jsx:177`) / "Zach" in shared chrome (`nav-chrome.jsx:143`).
- **As-built:** Label is "Account" (`src/components/nav/BottomNav.tsx:82`).
- **Impact:** Minor copy divergence in the bottom-nav avatar slot.

### [MINOR] BottomNav bottom padding: safe-area inset vs fixed 22px

- **Artboard:** `padding: '8px 0 22px'` — fixed 8px top / 22px bottom (`artboards-nav.jsx:157` / `nav-chrome.jsx:119`).
- **As-built:** `pt: 1` (8px) top is correct, but bottom is `calc(env(safe-area-inset-bottom, 0px) + 8px)` (`src/components/nav/BottomNav.tsx:54-55`).
- **Impact:** On a device with no safe-area inset the bottom padding is 8px (vs the artboard's 22px), so the bar is shorter; on notched devices it tracks the inset instead. Arguably an improvement, but it does not match the artboard's fixed value.

### [TRIVIAL] Avatar pill font-weight 500 vs artboard's default 400

- **Artboard:** Avatar pill button sets `fontSize: 14` with no `fontWeight` (browser default 400) (`artboards-nav.jsx:130-140` / `nav-chrome.jsx:98-108`).
- **As-built:** Avatar pill sets `fontWeight: 500` (`src/components/nav/TopNav.tsx:108`).
- **Impact:** Name in the desktop pill is slightly heavier than spec.

### [TRIVIAL] Desktop menu icon size 20 vs artboard 17

- **Artboard:** Desktop popover item icons are `size 17` (`artboards-nav.jsx:203`).
- **As-built:** Desktop `Menu` variant uses `Icon size={20}` (`src/components/nav/AvatarMenu.tsx:117,125`).
- **Impact:** Slightly larger menu icons than spec (the build matches the artboard's 22 for the mobile sheet, but the artboard used 17 there too).

### [TRIVIAL] Mobile sheet menu icon size 22 vs artboard 17

- **Artboard:** Mobile sheet item icons are `size 17` (shared `AvatarMenuItems`, `artboards-nav.jsx:203`).
- **As-built:** Sheet variant uses `Icon size={22}` (`src/components/nav/AvatarMenu.tsx:88,96`).
- **Impact:** Sheet menu icons larger than spec.

### [TRIVIAL] Desktop nav-item icon weight not pinned to 400

- **Artboard:** `MuiIcon` renders at `'wght' 400` fixed (`nav-chrome.jsx:43`, `artboards-nav.jsx:56`).
- **As-built:** `Icon` defaults `weight={400}` (TopNav/BottomNav don't pass `weight`), so this matches — BUT the build also sets `'opsz' ${size}` (e.g. opsz 18/22) whereas the artboard pins `'opsz' 24` regardless of size (`src/components/ui/Icon.tsx:58` vs `nav-chrome.jsx:43`).
- **Impact:** Optical-size axis differs (build couples opsz to px size; artboard fixes it at 24). Sub-pixel rendering difference only.

### [TRIVIAL] Desktop pill hover behavior unspecified in artboard

- **Artboard:** Static; no hover state defined for the avatar pill (`artboards-nav.jsx:130-140`).
- **As-built:** Adds `'&:hover': { bgcolor: 'action.hover' }` on the pill (`src/components/nav/TopNav.tsx:110`). Section tabs add `'&:hover': { color: 'text.primary' }` (`TopNav.tsx:85`).
- **Impact:** Added interaction polish not present in the static artboard; not a regression.

## Intentional deviations (not bugs)

- **NavAvatar shows the Google profile photo instead of mock initials.** The artboard `Avatar`/`NavAvatar` always renders initials ("ZR") in the slate gradient disc (`artboards-nav.jsx:74-85`, `nav-chrome.jsx:48-58`). The build uses `CachedAvatar` to show the real `session.user.image`, falling back to the same gradient + initials when absent/errored (`src/components/nav/NavAvatar.tsx:26-42`). Approved user override per the task brief.
- **Section accents render via the live data, matching the brief:** plans = blue #7aa7ff, recipes = orange #e8a86b, shop = green #6fcf97, pantry = purple #c79bff (`src/lib/design-tokens.ts:31-34`, applied in `nav-sections.ts`). Confirmed correct.
- **`squircled` prop on AppIcon** (`src/components/nav/AppIcon.tsx:17,26-28`) implements the artboard's note that the squircled black-background version is reserved for the home-screen/app-store icon while the nav uses the bare logomark (`artboards-nav.jsx:24-28`). The build defaults `squircled=false` for nav use — correct.
- **BottomNav is `position: fixed` with `zIndex 1100`** (`src/components/nav/BottomNav.tsx:50-53`) vs the artboard's `position: absolute` inside a phone frame (`nav-chrome.jsx:117`). Expected real-app adaptation, not a fidelity issue.

## Matches (confirmed correct)

- TopNav container: `display md:flex` (hidden on xs), padding 12px/28px (`py:1.5 px:3.5`), `background.default` (#0f1115), `borderBottom 1px tokens.border.subtle`. (`TopNav.tsx:34-41`)
- Logo cluster: `AppIcon size={30}` + "Weekly Eats" in `var(--font-display)` 18/700, `gap 12` (`gap:1.5`), clickable. (`TopNav.tsx:43-64`)
- AppIcon logomark: identical 4 blocks (plans/recipes/shop/pantry colors, x/w values, y = 12+i\*8, h 5, rx 1), bowl path `M 8 47 …` fill #3a3d44, rim highlight rect rgba(255,255,255,0.20). (`AppIcon.tsx:4-34` vs `artboards-nav.jsx:30-44`)
- Section tabs: `gap 4` (`gap:0.5`), `ml 28` (`ml:3.5`), `flex 1`; each tab height 50, px 14 (`px:1.75`), font 14.5, weight 600 active / 500 inactive, color `text.primary` active / `text.secondary` inactive, `borderBottom 2.5px solid section-color` active / transparent inactive, icon size 18 in section color, `gap 8`. (`TopNav.tsx:66-92`)
- Active-section underline color per tab matches section accents. (`nav-sections.ts` colors)
- Avatar pill: height 40, padding `6px right 12px left 6px` (`pl:0.75 pr:1.5`), `gap 10` (`gap:1.25`), `borderRadius 999`, `1px border tokens.border.subtle`, NavAvatar size 28 + name. (`TopNav.tsx:95-115`)
- BottomNav container: `display xs:grid md:none`, `gridTemplateColumns repeat(4,1fr)`, `pt 8px`, `background.paper` (#181b21), `borderTop 1px tokens.border.subtle`, `color text.secondary` base. (`BottomNav.tsx:44-58`)
- BottomNav slots (Plans/Shop/Recipes, Pantry excluded): column layout, `gap 4` (`gap:0.5`), font 10/600, `letterSpacing 0.04em`, `textTransform uppercase`, icon size 22, active color = section accent, inactive = text.secondary. (`BottomNav.tsx:16,18-30,60-74`)
- Pantry correctly excluded from bottom nav and surfaced (sheet-only) in the avatar sheet. (`BottomNav.tsx:16`, `AvatarMenu.tsx:54-61,77-79`)
- AvatarMenu item set & order: Pantry (sheet only) → Manage food items → Manage users (admin-gated) → divider → Sign out; admin gating via `isAdmin`. (`AvatarMenu.tsx:54-79`) — matches artboard order minus the Settings item flagged above.
- AvatarMenu divider before Sign out present in both variants. (`AvatarMenu.tsx:93,122`)
- Icons use Material Symbols ligature names matching the artboard: calendar_month, shopping_cart, restaurant, kitchen, format_list_bulleted, person, settings, logout. (`nav-sections.ts`, `AvatarMenu.tsx`)
- SectionThemeProvider binds `palette.primary` to the active section accent, or `tokens.accentUtility` (#9aa4b3) on system pages — matches the artboard's "utility accent" model. (`SectionThemeProvider.tsx:17`)

---

# Meal Plans (Desktop) — As-Built vs Artboards

## Summary

- 27 discrepancies (6 material, 13 minor, 8 trivial).
- **Index / List:** The artboard's plan rows are rich (40×40 accent emoji tile, plan name in display font, a `CURRENT` pill, a date-range subtitle, "Shared by" caption, and a trailing chevron). The as-built `PlanRow` is reduced to a small `calendar_month` icon + plan name in body font — no date range, no CURRENT pill, no chevron, no display font on the title. This is the most material gap on this screen. Header/section-label sizes drift by 1–2px. The current-plan highlight (accent border + glow) is dropped.
- **Plan Detail / View:** This is an as-built-only screen (the artboard has no week-grid "view" surface; it only specs index/create/template/sharing/history). It is internally consistent with the token system and reuses the plans accent, hero card pattern, and meal colors faithfully; nothing to compare value-by-value against the artboard, so it is largely a non-issue, with the one caveat that the eyebrow reads "Meal Plan" where the artboard pattern (template/history) uses an uppercase section eyebrow — consistent in spirit.
- **Meal Editor:** Also an as-built-only surface — the artboard does not contain a meal-editor screen (item rows / qty+unit editors / combined search). It is well-built against tokens; the only artboard-anchored values are the shared button/field treatments, which match the editor's reuse. No artboard mismatches to flag beyond shared-token drift.
- **Template Settings:** High fidelity. Day chips, meal toggle rows (colored dot + switch), two-card grid, and staples card all match closely. Notable drifts: card radius (built 12px vs artboard 14px), card has a border the artboard omits, day-chip radius (built 8px vs artboard 8px — OK), the staples list renders via an expandable `MealItemLine` (dot + uppercase group header + ruled list) rather than the artboard's plain bold-title + flat item list, and the toggle uses MUI `Switch` rather than the artboard's custom 36×22 pill.
- **Sharing:** Strong fidelity to the dialog spec. Header, field labels, pending-invite cards, email field, and shared-person rows all match. Deviations are mostly intentional (pending invites moved inside the sheet, status pill behavior). The remaining real drifts: invite-card avatar is square-cornered accent tile vs round, the pending card omits the per-row Accept/Decline **text buttons** in favor of icon buttons, and the email field is 42px tall vs the artboard's 38px.

## By screen

### Index / List

#### [MATERIAL] Plan row is structurally reduced vs the artboard row

- **Artboard:** Row = 40×40 rounded accent tile with 📅, name in **display font 16/700**, optional `CURRENT` pill, `dateRange` subtitle (12px dim, e.g. "May 11 – 17, 2026"), optional "Shared by …", trailing `›` chevron; padding `14px 18px`, radius 12 (`artboards-mp-desktop.jsx:71-93`).
- **As-built:** Row = small `calendar_month` Icon (size 22) + name as plain `Typography fontSize 15` (body font, default weight); **no date-range subtitle, no CURRENT pill, no chevron, no avatar tile**; padding `py 1.75 / px 2` (`src/app/meal-plans/page.tsx:88-126`).
- **Impact:** Rows look materially flatter/less informative — users lose the at-a-glance date range and current-week marker.

#### [MATERIAL] No "current plan" highlight treatment

- **Artboard:** Current row gets `border 1px accent55` + `boxShadow 0 0 0 3px rgba(122,167,255,0.06)` and an inline `CURRENT` pill (`artboards-mp-desktop.jsx:77-85`).
- **As-built:** All rows render identically (subtle border, hover only); current plans are only distinguished by living under the "Current" section label, no per-row accent/glow/pill (`src/app/meal-plans/page.tsx:100-124`).
- **Impact:** The current week no longer pops visually within the list.

#### [MINOR] Plan-row name uses body font, not display font

- **Artboard:** Name `fontFamily: display` (Bricolage), 16/700 (`artboards-mp-desktop.jsx:84`).
- **As-built:** Name is `Typography fontSize: 15` with no `fontFamily: var(--font-display)` → inherits body (Outfit) at default weight (`src/app/meal-plans/page.tsx:123`).
- **Impact:** Row titles read lighter and in the wrong typeface.

#### [MINOR] Page title size drifts at md

- **Artboard:** "Your plans" `fontSize 30` (`artboards-mp-desktop.jsx:259`).
- **As-built:** `fontSize: { xs: 26, md: 32 }` → 32px on desktop (`src/app/meal-plans/page.tsx:543`).
- **Impact:** Title is 2px larger than spec on desktop.

#### [MINOR] Section label font size off by 1px

- **Artboard:** `SectionLabel` `fontSize 10`, weight 700, tracking 0.16em, dim, plus a trailing 1px rule line (`artboards-mp-desktop.jsx:171-177`).
- **As-built:** `SectionLabel` `fontSize 11`, weight 700, tracking 0.16em, secondary; **no trailing rule line** (`src/app/meal-plans/page.tsx:65-80`).
- **Impact:** Slightly larger labels and missing divider rule next to each section heading.

#### [MINOR] Section labels show counts the artboard does not

- **Artboard:** Labels are plain ("Current", "Shared with you", "Past · last 6 weeks") (`artboards-mp-desktop.jsx:150,155,159`).
- **As-built:** Appends accent counts, e.g. "Current · 2", "Past · last 6 weeks · 3" (`src/app/meal-plans/page.tsx:598-605,661-666`).
- **Impact:** Extra metadata not in the spec (arguably an improvement; flagging as a deviation).

#### [MINOR] "New plan" button radius/height differ from spec

- **Artboard:** `btnPrimary` height 38, radius 10, padding `0 18px`, accent bg, text `#0c1118`, 14/600 (`artboards-mp-desktop.jsx:57`).
- **As-built:** MUI contained `Button` with global `borderRadius: tokens.radius.md` (8px), default MUI height (~36.5px), text color `surface.base` (`src/lib/theme.ts:107,113`; `src/app/meal-plans/page.tsx:579-586`).
- **Impact:** Slightly tighter radius and shorter pill than spec; affects every primary button app-wide.

#### [MINOR] Settings/share icons use filled IconButtons, not bordered ghost squares

- **Artboard:** Two `btnGhostIcon` buttons — 38×38, radius 10, transparent bg with `1px edge` border (`artboards-mp-desktop.jsx:56,262-271`).
- **As-built:** Plain MUI `IconButton`s (no border, circular ripple), `color: text.secondary` (`src/app/meal-plans/page.tsx:552-564`).
- **Impact:** Header action affordances read as bare icons rather than bordered ghost buttons.

#### [TRIVIAL] Dot badge color differs

- **Artboard:** Dot badge uses accent (`C.accent` blue) with a 2px bg-colored ring (`artboards-mp-desktop.jsx:280-287`).
- **As-built:** Dot badge uses `tokens.state.danger` (red), no ring (`src/app/meal-plans/page.tsx:565-577`).
- **Impact:** Notification dot is red instead of accent blue.

#### [TRIVIAL] Share icon glyph differs

- **Artboard:** Custom two-person SVG "share" glyph (`artboards-mp-desktop.jsx:264-269`).
- **As-built:** Material `group` icon (`src/app/meal-plans/page.tsx:564`).
- **Impact:** Different but semantically equivalent sharing glyph.

#### [TRIVIAL] "View older →" alignment

- **Artboard:** Right-aligned accent text button (`artboards-mp-desktop.jsx:165-167`).
- **As-built:** Left-aligned accent text button, `px: 0` (`src/app/meal-plans/page.tsx:676-686`).
- **Impact:** Minor placement difference.

### Plan Detail / View

> Not present in this artboard set — the desktop artboard file specs index/create/template/sharing/history only, with no week-grid plan "view" surface. The intentional ledger notes detail is a real route with a `‹ Plans` back button. Items below are consistency notes against the artboard's shared patterns, not direct mismatches.

#### [MINOR] Back button label/treatment vs artboard convention

- **Artboard:** Back button reads `‹ Plans`, accent color, transparent border, height 30 (`artboards-mp-desktop.jsx:376` template / `522` history).
- **As-built:** `‹ Plans` text button, accent, `fontWeight 600` (`src/components/meal-plans/PlanDetail.tsx:155-173`).
- **Impact:** Matches intent; trivial styling differences (no fixed 30px height).

#### [TRIVIAL] Detail eyebrow casing

- **Artboard pattern:** eyebrows are uppercase tracked (e.g. "TEMPLATE", "HISTORY") (`artboards-mp-desktop.jsx:378,524`).
- **As-built:** "Meal Plan" rendered uppercase via `textTransform: 'uppercase'`, tracking 0.16em, accent — consistent (`src/components/meal-plans/PlanDetail.tsx:241-252`).
- **Impact:** Consistent with the eyebrow pattern; noted only for completeness.

### Meal Editor

> Not present in this artboard set — there is no meal-editor / item-row / qty-unit / combined-search screen in `artboards-mp-desktop.jsx`. The editor is built entirely against the shared design tokens and the plans accent. The values below are the only artboard-anchored elements (shared chips/fields), reused faithfully.

#### [TRIVIAL] Editor qty/unit chips reuse the artboard's DateChip-style treatment

- **Artboard reference:** chips are height ~36, radius 8, accentDim when selected, accent border (`artboards-mp-desktop.jsx:337-346`).
- **As-built:** `chipSx` height 30, radius 8 (`tokens.radius.md`), `border.strong`, accentDim when active (`src/components/meal-plans/EditorItemRow.tsx:20-33`).
- **Impact:** Shorter chips (30 vs 36) but same radius/accent language; no artboard screen to bind this to.

### Template Settings

#### [MATERIAL] Card radius + extra border vs artboard

- **Artboard:** Cards `background paper`, `borderRadius 14`, **no border**, padding `18px 20px` (`artboards-mp-desktop.jsx:384,398`).
- **As-built:** `card` = `surface.raised`, `borderRadius 12px` (`tokens.radius.xl`), **`1px border.subtle`**, padding `2.25` (18px) (`src/components/meal-plans/TemplateSettings.tsx:164-169`).
- **Impact:** Cards are slightly tighter-cornered and carry a border the spec omits.

#### [MATERIAL] Staples list rendering differs from spec

- **Artboard:** `StaplesGroup` = plain **bold 12px title** + flat list of plain 13px item strings, no dot, no rule, no expand (`artboards-mp-desktop.jsx:433-441`).
- **As-built:** Renders each group via `MealItemLine expandGroup` — a 5px colored dot + **uppercase tracked** group header + ingredients under a **left rule** (`src/components/meal-plans/TemplateSettings.tsx:330-340`; `src/components/meal-plans/MealItemLine.tsx:96-148`).
- **Impact:** The staples preview reads as a different, more decorated structure (dot + uppercase + ruled) than the artboard's quiet title+list.

#### [MINOR] Meal toggle uses MUI Switch, not the custom pill

- **Artboard:** `ToggleRow` switch = 36×22 pill, track `accent` when on / `edge` when off, 18px white knob (`artboards-mp-desktop.jsx:421-429`).
- **As-built:** MUI `Switch` (default MUI dimensions/thumb), bound to `draft.meals[meal]` (`src/components/meal-plans/TemplateSettings.tsx:291-297`).
- **Impact:** Toggle proportions and knob differ from the custom spec.

#### [MINOR] Title size drifts at md

- **Artboard:** "Your default plan shape" `fontSize 30` (`artboards-mp-desktop.jsx:379`).
- **As-built:** `fontSize: { xs: 24, md: 30 }` → 30 on desktop — **matches** (`src/components/meal-plans/TemplateSettings.tsx:213`). (Listed to confirm parity.)
- **Impact:** None on desktop.

#### [MINOR] Default-staples label shows a count the artboard omits

- **Artboard:** `Default staples` (no count) (`artboards-mp-desktop.jsx:400`).
- **As-built:** `Default staples · {totalStaples}` (`src/components/meal-plans/TemplateSettings.tsx:313`).
- **Impact:** Extra count metadata vs spec.

#### [MINOR] Grid gap differs

- **Artboard:** Two-column grid `gap 24` (`artboards-mp-desktop.jsx:383`).
- **As-built:** `gap: { xs: 2, md: 3 }` → 24px at md — **matches** (`src/components/meal-plans/TemplateSettings.tsx:229`).
- **Impact:** None on desktop. (Container maxWidth 1080 vs artboard 1280 shell — see below.)

#### [MINOR] Page max-width narrower than artboard shell

- **Artboard:** `PageShell` content `maxWidth 1280`, padding `0 32px` (`artboards-mp-desktop.jsx:63`).
- **As-built:** Template wrapper `maxWidth 1080` (`src/components/meal-plans/TemplateSettings.tsx:174`); index uses `Container maxWidth="md"` (~900px) (`src/app/meal-plans/page.tsx:527`).
- **Impact:** Content column is narrower than the 1280 artboard canvas across plans surfaces.

#### [TRIVIAL] Edit-staples button has no count/edit-icon parity issues

- **Artboard:** `✎ Edit` ghost button height 30, radius 10 (`artboards-mp-desktop.jsx:401`).
- **As-built:** Text button with `edit` icon, accent, no ghost border (`src/components/meal-plans/TemplateSettings.tsx:314-320`).
- **Impact:** Edit affordance is a flat accent text button rather than a bordered ghost.

### Sharing

#### [MATERIAL] Pending-invite cards use icon buttons, not Accept/Decline text buttons

- **Artboard:** `InviteCardLarge` has two ghost **text** buttons — "Accept" (success-tinted) and "Decline" (dim) at height 32 (`artboards-mp-desktop.jsx:133-144,470-471`).
- **As-built:** Pending card uses two 34×34 **icon** buttons (check / close), success-muted and danger-muted tiles (`src/components/meal-plans/ShareMealPlansDialog.tsx:196-221`).
- **Impact:** Accept/Decline actions read as icon chips rather than labeled buttons — less explicit.

#### [MINOR] Invite-card avatar is square-cornered, not round

- **Artboard:** Avatar `borderRadius: '50%'`, 36×36, accentDim bg, accent initial (`artboards-mp-desktop.jsx:136`).
- **As-built:** Pending-card uses round `Avatar` (32px) — **matches shape** (`src/components/meal-plans/ShareMealPlansDialog.tsx:47-65,175`). Note: `StatusPill` radius is `radius.xs` (4px) — square — vs artboard's `999` pill on the shared-person status (`artboards-mp-desktop.jsx:505`).
- **Impact:** Status pill is a square chip rather than a rounded pill.

#### [MINOR] Email field height differs

- **Artboard:** Invite-by-email field height 38, radius 10, `paperHi` bg, `edgeHi` border, 13px (`artboards-mp-desktop.jsx:475`).
- **As-built:** `InputBase` height 42, radius 10 (`radius.lg`), `surface.elevated`, `border.strong`, 13px (`src/components/meal-plans/ShareMealPlansDialog.tsx:241-251`).
- **Impact:** Field is 4px taller than spec.

#### [MINOR] Shared-person row name weight / avatar size

- **Artboard:** `SharedPerson` avatar 32px round, name 13/500, email 11px, status pill, delete icon in danger (`artboards-mp-desktop.jsx:491-509`).
- **As-built:** Avatar 28px round, name 13/500, email 11px, optional `StatusPill`, close icon in `text.muted` (`src/components/meal-plans/ShareMealPlansDialog.tsx:266-316`).
- **Impact:** Smaller avatar (28 vs 32) and the remove glyph is muted `close` rather than danger `delete`.

#### [MINOR] Dialog header title size

- **Artboard:** "Share your meal plans" `fontSize 18/700` display, sub 12px (`artboards-mp-desktop.jsx:464-465`).
- **As-built (desktop branch):** `fontSize 18/700` display, sub 12px — **matches** (`src/components/meal-plans/ShareMealPlansDialog.tsx:146-151`).
- **Impact:** None on desktop (parity confirmed).

#### [MINOR] Dialog surface bg differs

- **Artboard:** Dialog `background C.paper` (#181b21 = `surface.raised`), radius 16, `1px edge` border, modal shadow (`artboards-mp-desktop.jsx:457-461`).
- **As-built:** Dialog paper `surface.sheet` (#1a1e26), radius 12 (`radius.xl`), no explicit border/shadow override (`src/components/meal-plans/ShareMealPlansDialog.tsx:374-377`).
- **Impact:** Slightly different (lighter) sheet color and tighter corner (12 vs 16) than the artboard modal.

#### [TRIVIAL] Status pill colors

- **Artboard:** accepted → success on successDim; pending → dim text, transparent bg, 1px edge border, pill radius 999 (`artboards-mp-desktop.jsx:502-508`).
- **As-built:** accepted → success/successMuted; pending → **warn/warnMuted**, radius 4 (`src/components/meal-plans/ShareMealPlansDialog.tsx:67-88`).
- **Impact:** Pending uses an amber-tinted square chip rather than a neutral dim outlined pill.

## Intentional deviations (not bugs)

- Plan detail is a real route with a `‹ Plans` back button rather than a dialog (`PlanDetail.tsx:155-173`).
- Template is a pushed route `/meal-plans/template` (`src/app/meal-plans/template/page.tsx`) rather than a dialog.
- Sharing: pending invitations live **inside** the sheet (`ShareMealPlansDialog.tsx:157-227`); the index "Invitations" banner/sidebar artboard options are intentionally dropped and replaced by the header dot badge (`page.tsx:565-577`).
- Sharing: the artboard's accepted/pending status pill on shared-person rows is conditionally rendered only `user.status` exists — consistent with the ledger note that `SharedUser` may lack the field (`ShareMealPlansDialog.tsx:307`).
- Index "Shared with you" groups by owner with a per-owner "Leave" action — an as-built enhancement over the artboard's single shared row (`page.tsx:618-656`).
- Section labels and the staples label carry live counts (Current · N, Past · N, Default staples · N) — deliberate metadata additions.

## Matches (confirmed correct)

- Plans accent = `tokens.section.plans` (#7aa7ff) used consistently for eyebrows, back buttons, day-chip selection, search focus ring, qty/unit accents (`design-tokens.ts:31`).
- Template "Week starts on" day chips: 7 chips, height 36, radius 8, accentDim + accent border + accent text when selected (`TemplateSettings.tsx:236-259` ↔ `artboards-mp-desktop.jsx:337-346,385-390`).
- Template meal toggle rows: `surface.elevated` bg, `radius.lg`, 1px border, 8px meal-colored dot + label + switch, in B/L/D order with correct meal colors (`TemplateSettings.tsx:264-299` ↔ `artboards-mp-desktop.jsx:412-431`).
- Template two-card grid layout `1fr 1fr` with `flex-start` alignment (`TemplateSettings.tsx:225-232` ↔ `artboards-mp-desktop.jsx:383`).
- FieldLabel treatment (10px / 700 / 0.16em / uppercase / secondary) matches across template + sharing (`TemplateSettings.tsx:36-49`, `ShareMealPlansDialog.tsx:32-45` ↔ `artboards-mp-desktop.jsx:334-335`).
- Sharing dialog header copy, sub-copy, "Invite by email" field + Invite primary button, "Shared with" list, and footer "Done" primary button all present and styled per spec (`ShareMealPlansDialog.tsx:142-349`).
- Pending-invitation card layout (avatar + "invited you to their meal plans") matches the artboard `InviteCardLarge` content (`ShareMealPlansDialog.tsx:161-224` ↔ `artboards-mp-desktop.jsx:133-144`).
- Eyebrow + display-font title + dim subtitle header stack on template/detail matches the artboard header pattern (`TemplateSettings.tsx:196-223`, `PlanDetail.tsx:240-267` ↔ `artboards-mp-desktop.jsx:375-381`).
- Meal colors (breakfast #e8c97a, lunch #8edcb4, dinner #f0a08a, staples #c4a7e7) consumed via `mealColorToken` / `tokens.meal.*` matching artboard `SECTION` (`meal-display-utils.ts:46-52`, `design-tokens.ts:45-50`).

---

# Meal Plans (Mobile) — As-Built vs Artboards

## Summary

- 24 discrepancies (6 material, 11 minor, 7 trivial).
- **Index / List:** Largely faithful in structure (header, section labels, View older), but the as-built **PlanRow is dramatically simplified** vs the artboard — no calendar tile chip, no date-range subtext, no `NOW` pill, no current-plan accent ring/glow, no trailing chevron. The "+ New" button reads "New plan" and the dot badge is the wrong color (danger red vs accent blue). Section-label divider rule and the per-section count styling also differ.
- **Plan Detail / View:** Not present in the mobile artboard file (the mp-mobile artboard has no detail screen). The as-built mobile day-cards are governed by the mp-desktop spec; against the _shared_ sheet/token conventions they look consistent (today ring, TODAY pill, meal letters). No findings raised here beyond noting absence of a spec in this file.
- **Meal Editor:** **Most material gap.** The artboard's editor-class surfaces are bottom sheets (drag handle, `radius.sheet` top corners, `surface.sheet` bg, Cancel/Title/Done header, sheet shadow). The as-built `MealEditorDialog` is a **full-screen MUI Dialog** on mobile (`responsiveDialogStyle`: margin 0, height 100%) with **no drag handle, no rounded top corners, and no sheet shadow** — it reads as a takeover, not a sheet. Header layout (Cancel/Title/Done) and accent are otherwise correct. Sub-rows (item rows, qty numpad sheet, unit picker sheet, combined search) are well-built and the qty/unit overlays _do_ use proper bottom-sheet styling.
- **Template Settings:** Good fidelity as a pushed route with `‹ Plans` back + Save, kicker/title/subtitle, day chips, meal toggle rows, staples. Deviations: it adds a Save button + title/subtitle block not in the artboard's compact `NavBar`, day-chip selected fill differs slightly, toggle uses MUI `Switch` (artboard is a custom pill), and staples are shown expanded (MealItemLine) rather than the artboard's collapsed `StaplesRow` list with counts + chevrons. Card is wrapped in a 2-col grid (fine on mobile) with a visible border the artboard's toggle-list section omits.
- **Sharing:** Strong fidelity — bottom Drawer with drag handle, `radius.sheet`, `surface.sheet`, centered Cancel-gap/Title/Done header, pending-invite cards, invite field, shared-with list. Deviations: header padding/font-size, accept/reject button radius (`radius.sm`=6 vs artboard 8), status pill present + uses warn-yellow for pending (artboard pending pill is a bordered dim chip; ledger marks pill omission as intentional but it's actually rendered), and the shared-row delete is an `close` X icon vs artboard's `delete` trash glyph.

## By screen

### Index / List

#### [MATERIAL] PlanRow is missing nearly all artboard content (icon tile, date range, NOW pill, chevron)

- **Artboard:** Each row has a 32×32 rounded calendar-emoji tile (`accentDim` bg), the plan name in display font, a date-range/"Shared by" subtext line, a `NOW` pill for the current plan, an accent border + soft glow when current, and a trailing `›` chevron (`artboards-mp-mobile.jsx:92-111`).
- **As-built:** PlanRow renders only a `calendar_month` icon (no tile background) + the plan name; no date range, no NOW pill, no current-row accent ring/glow, no chevron (`src/app/meal-plans/page.tsx:88-126`).
- **Impact:** The list loses its visual hierarchy and the "which plan is current" signal; rows read as a flat link list instead of the designed cards.

#### [MINOR] "New plan" button label vs artboard "+ New"

- **Artboard:** Primary button labeled `+ New` (compact, height 36) (`artboards-mp-mobile.jsx:125`).
- **As-built:** Button labeled `New plan` with an `add` start icon (`src/app/meal-plans/page.tsx:579-586`).
- **Impact:** Slightly wider button; minor copy/label drift.

#### [MINOR] Pending-invite dot badge uses danger red, not accent blue

- **Artboard:** `DotBadge` is `C.accent` (blue `#7aa7ff`) with a 2px bg-colored ring (`artboards-mp-mobile.jsx:44-45`).
- **As-built:** Badge `bgcolor: tokens.state.danger` (red `#e87a8a`), no ring (`src/app/meal-plans/page.tsx:565-577`).
- **Impact:** Notification dot color is off-spec (red vs the section's blue accent).

#### [MINOR] Section label lacks the divider rule and uses a different size/weight

- **Artboard:** `SectionLabel` is a 10px/700/0.16em uppercase dim label followed by a flex `height:1` divider rule and an optional right-aligned accent count (`artboards-mp-mobile.jsx:83-90`).
- **As-built:** `SectionLabel` is 11px/700/0.16em uppercase secondary text with NO divider rule; the count is rendered inline (`· N`) in `primary.main` after the label (`src/app/meal-plans/page.tsx:65-79`, `597-605`).
- **Impact:** Missing the horizontal rule that separates section heads; minor type-scale drift (11 vs 10).

#### [MINOR] "Shared with you" grouping differs from artboard

- **Artboard:** A single `Shared with you` section listing plan rows with a "· Shared by {name}" subtext on each row (`artboards-mp-mobile.jsx:134-137`).
- **As-built:** Grouped per-owner with an owner name header + a red "Leave" button per group, then plain PlanRows (`src/app/meal-plans/page.tsx:618-656`).
- **Impact:** More functional (adds Leave) but visually diverges from the single-list artboard; the "Shared by" attribution moves from the row to a group header.

#### [TRIVIAL] Header gear/people icons are MUI IconButtons, not bordered ghost-icon squares

- **Artboard:** `btnGhostIcon` = 36×36, `radius:10`, 1px subtle border, transparent bg (`artboards-mp-mobile.jsx:47`, `122-124`).
- **As-built:** Plain `IconButton`s (circular ripple, no border box) for settings + group (`src/app/meal-plans/page.tsx:552-578`).
- **Impact:** Header actions lack the boxed ghost-button treatment; purely cosmetic.

#### [TRIVIAL] Past section header copy includes count differently

- **Artboard:** `Past · last 6 weeks` with no count (`artboards-mp-mobile.jsx:138`).
- **As-built:** `Past · last 6 weeks · N` count appended in accent (`src/app/meal-plans/page.tsx:661-666`).
- **Impact:** Extra count; negligible.

### Plan Detail / View

#### [INFO] No plan-detail screen exists in the mobile artboard file

- **Artboard:** `artboards-mp-mobile.jsx` defines only Index, Create, Template, Sharing, History — there is **no** plan-detail/view artboard here (`artboards-mp-mobile.jsx:399`).
- **As-built:** `PlanDetail.tsx` + `PlanViewMobile.tsx` implement the mobile detail (day cards, today ring, TODAY pill, meal letters, missing-meal dashed chips, StaplesBar) — these follow the **mp-desktop** spec and the shared token conventions.
- **Impact:** Cannot flag detail-screen fidelity against this artboard. Against shared conventions (sheet bg, `section.plans` accent, `radius.xxl` cards, `shadow.card` today ring) the implementation is consistent. No mismatch raised.

### Meal Editor

#### [MATERIAL] Editor is a full-screen Dialog on mobile, not a bottom sheet

- **Artboard:** All editor-class overlays are bottom sheets: `position:absolute; bottom:0`, `borderTopLeftRadius/RightRadius:18` (`radius.sheet`), `background: C.sheet`, `boxShadow:'0 -10px 30px rgba(0,0,0,0.4)'` (`shadow.sheet`), with a centered drag handle (36×4, `radius:2`, `rgba(255,255,255,0.18)`) (`artboards-mp-mobile.jsx:167-175`, `285-293`).
- **As-built:** `MealEditorDialog` is a MUI `Dialog` styled by `responsiveDialogStyle` → on `xs`: `margin:0`, `width:100%`, `height:100%`, `maxHeight:100%` — i.e. a full-screen takeover with square corners and no sheet shadow (`src/components/meal-plans/MealEditorDialog.tsx:287-295`; `src/lib/theme.ts:160-167`).
- **Impact:** The primary editing surface diverges from the designed bottom-sheet language: **no drag handle, no rounded top corners, no upward sheet shadow.** This is the single biggest mobile-fidelity gap.

#### [MINOR] Editor sheet has no drag handle

- **Artboard:** Every bottom sheet leads with a centered 36×4 drag handle (`artboards-mp-mobile.jsx:173-174`).
- **As-built:** `MealEditorDialog` header starts directly with the Cancel/Title/Done bar — no handle element (`src/components/meal-plans/MealEditorDialog.tsx:296-336`).
- **Impact:** Missing the affordance that signals a draggable/dismissible sheet. (Follows from the full-screen-dialog choice above.)

#### [TRIVIAL] Editor header padding heavier than artboard sheet header

- **Artboard:** Sheet header `padding:'4px 16px 12px'` under the handle (`artboards-mp-mobile.jsx:176`).
- **As-built:** Header `px: 2.75` (22px) `py: 2` (16px) (`src/components/meal-plans/MealEditorDialog.tsx:297-305`).
- **Impact:** Roomier header; minor spacing drift.

#### [MATCH→note] Qty/Unit editors DO use correct bottom-sheet styling on mobile

- **Artboard:** Bottom-sheet pattern (handle optional for these sub-editors; sheet bg + rounded top) is the reference.
- **As-built:** `QtyEditor` + `UnitEditor` render as bottom `Drawer`s with `surface.sheet` bg and `borderTopLeftRadius/RightRadius: radius.sheet` (`src/components/meal-plans/QtyEditor.tsx:171-191`; `UnitEditor.tsx:155-175`). Correct sheet treatment — but note these _also_ lack the drag handle the artboard sheets show.
- **Impact:** Positive — confirms the sheet language exists in the codebase; reinforces that the main editor's full-screen choice is the inconsistency.

#### [TRIVIAL] Combined search placeholder copy differs

- **Artboard:** N/A in this file (search is part of editor, specified in mp-desktop).
- **As-built:** Placeholder `Add item, recipe, or new group` (`src/components/meal-plans/CombinedSearch.tsx:289`).
- **Impact:** Noted for completeness; no mobile-artboard reference to compare.

### Template Settings

#### [MINOR] Header differs from artboard NavBar (adds Save + title/subtitle block)

- **Artboard:** Compact `NavBar` only: `‹ Plans` left (accent), centered display "Template" title + dim "Your default plan shape" subtitle, 1px bottom border; no Save button (`artboards-mp-mobile.jsx:218`).
- **As-built:** A back button + a **Save** button on one row, then a separate kicker ("TEMPLATE") + big display title "Your default plan shape" + subtitle "Applied when you create a new meal plan." (`src/components/meal-plans/TemplateSettings.tsx:182-223`).
- **Impact:** Functionally richer (explicit Save, larger title) but visually a different header pattern than the artboard's centered NavBar.

#### [MINOR] Meal toggle uses MUI Switch instead of the custom pill toggle

- **Artboard:** `ToggleRow` toggle is a 36×22 custom pill (`radius:999`, accent when on) with an 18×18 white knob; row has `radius:10` + 1px subtle border on `paper` (`artboards-mp-mobile.jsx:244-262`).
- **As-built:** Row uses MUI `Switch`; row bg is `surface.elevated`, `radius.lg`, 1px subtle border (`src/components/meal-plans/TemplateSettings.tsx:264-299`).
- **Impact:** Toggle visual differs from the designed pill; row surface uses elevated vs the artboard's `paper`.

#### [MINOR] Staples shown expanded (full lines) rather than collapsed StaplesRow summary

- **Artboard:** A `paper` card containing `StaplesRow`s: a small staples dot, group title, "{count} items", trailing `›` chevron — i.e. a collapsed summary list (`artboards-mp-mobile.jsx:233-238`, `264-272`).
- **As-built:** Renders fully-expanded `MealItemLine` group breakdowns (every ingredient listed), plus an inline "Edit" button in the section header (`src/components/meal-plans/TemplateSettings.tsx:304-343`).
- **Impact:** More detail but loses the compact "N items + chevron" row design; no drill-in chevrons.

#### [MINOR] Day chips: as-built selected fill + radius differ slightly

- **Artboard:** `DateChip` height 36, `radius:8`, selected = `accentDim` bg + accent border + accent text (`artboards-mp-mobile.jsx:200-209`).
- **As-built:** Chips height 36, `radius.md` (8), selected = `accent.muted` bg + `section.plans` border/text — close match, but unselected border is `border.subtle` and there's no `Pick…`/free-form option (template only needs the 7 weekdays) (`src/components/meal-plans/TemplateSettings.tsx:236-259`).
- **Impact:** Very close; mainly confirming parity with a tiny token-naming nuance.

#### [TRIVIAL] "Edit staples" affordance placement differs

- **Artboard:** Full-width ghost button `✎ Edit staples` below the staples card (`artboards-mp-mobile.jsx:238`).
- **As-built:** A compact "Edit" text button with `edit` icon in the staples section header (`src/components/meal-plans/TemplateSettings.tsx:314-320`).
- **Impact:** Edit moves from a full-width footer button to an inline header action.

#### [TRIVIAL] Staples card has a visible border the artboard meals-list section omits

- **Artboard:** The "Meals to plan" toggle rows sit on `paper` with subtle borders; the surrounding section has no card border.
- **As-built:** Both halves are wrapped in bordered `card` boxes (`surface.raised`, `radius.xl`, subtle border, `p:2.25`) inside a responsive grid (`src/components/meal-plans/TemplateSettings.tsx:164-169`, `234`, `304`).
- **Impact:** Adds card chrome around the form sections; cosmetic.

### Sharing

#### [MINOR] Accept/reject buttons use radius.sm (6) vs artboard 8

- **Artboard:** Accept/reject square buttons are 32×32, `borderRadius:8` (`artboards-mp-mobile.jsx:329-330`).
- **As-built:** IconButtons are 34×34, `borderRadius: radius.sm` (6px) (`src/components/meal-plans/ShareMealPlansDialog.tsx:196-221`).
- **Impact:** Slightly larger, slightly tighter corner radius; minor.

#### [MINOR] Status pill is rendered (warn-yellow for pending), conflicting with the "pill omitted" ledger note

- **Artboard:** `SharedPerson` shows a status pill: accepted = success bg/text, pending = bordered dim chip (`artboards-mp-mobile.jsx:342-346`). Ledger says the pill is intentionally omitted (no such field on SharedUser).
- **As-built:** A `StatusPill` IS rendered when `user.status` exists, and pending uses `state.warn`/`warnMuted` (yellow), not the artboard's bordered-dim treatment (`src/components/meal-plans/ShareMealPlansDialog.tsx:67-88`, `307`).
- **Impact:** Inconsistent with the stated intentional deviation AND with the artboard's pending-pill styling (yellow vs dim/bordered). Worth reconciling the ledger note vs the code.

#### [MINOR] Shared-row remove icon is `close` (X), artboard uses `delete` (trash)

- **Artboard:** `SharedPerson` trailing action is a Material `delete` (trash) glyph in danger color (`artboards-mp-mobile.jsx:347`).
- **As-built:** Trailing action is a `close` (X) icon in `text.muted` (`src/components/meal-plans/ShareMealPlansDialog.tsx:308-315`).
- **Impact:** Different remove affordance (X vs trash) and color (muted vs danger).

#### [TRIVIAL] Sheet header title size/padding differs slightly

- **Artboard:** Title 15px display; header `padding:'4px 16px 12px'`; left Cancel gap is an empty 60-wide spacer, right is Done (`artboards-mp-mobile.jsx:294-301`).
- **As-built:** Title 15px display (match); header `px:2` `py:1.25`; left spacer `minWidth:56`, right Done (`src/components/meal-plans/ShareMealPlansDialog.tsx:115-140`).
- **Impact:** Negligible spacing nuance; structure matches.

#### [TRIVIAL] Pending-invite "what" text is generic vs artboard's specific target

- **Artboard:** "invited you to {Meal plans / Corner market shopping list}" — names the shared thing (`artboards-mp-mobile.jsx:305-306`, `327`).
- **As-built:** Always "invited you to their meal plans" (`src/components/meal-plans/ShareMealPlansDialog.tsx:190-194`).
- **Impact:** Copy is fixed to meal-plans scope; acceptable since this dialog only shares meal plans.

## Intentional deviations (not bugs)

- **Plan detail = real route** with `‹ Plans` back button (`PlanDetail.tsx:155-173`). Confirmed.
- **Template = pushed route**, not a dialog (`src/app/meal-plans/template/page.tsx`; `TemplateSettings.tsx`). Confirmed.
- **Index "Invitations" banner removed**, replaced by a dot badge on the people icon (`page.tsx:565-577`). Confirmed — though the badge color (danger red) is off-spec (see finding above).
- **Pushed/takeover top spacing:** `PlanDetail` and `TemplateSettings` use `pt: { xs: 0, md: 3 }` to cancel the `AuthenticatedLayout` top padding on mobile (`PlanDetail.tsx:223`; `TemplateSettings.tsx:178`). Correct per the "negative/zero mt" guidance.
- **Sharing pending invitations live inside the sheet** (`ShareMealPlansDialog.tsx:157-227`). Confirmed.
- **Accepted/pending status pill omitted** — ledger note; NOTE the code DOES render a pill when `status` is present, so verify this deviation is still accurate (see Sharing finding).

## Matches (confirmed correct)

- **Sharing sheet** is a true bottom `Drawer`: `surface.sheet` bg, `radius.sheet` top corners, drag handle (36×4, `border.strong`), centered Cancel-gap/Title/Done header, `maxHeight:92%` (`ShareMealPlansDialog.tsx:383-401`, `110-141`) — matches `artboards-mp-mobile.jsx:285-301`.
- **Qty editor** bottom sheet + presets + 3-col numpad, `surface.sheet`, `radius.sheet` (`QtyEditor.tsx:112-191`).
- **Unit editor** bottom sheet with search + radio list, `surface.sheet`, `radius.sheet` (`UnitEditor.tsx:39-175`).
- **Index header** title "Your plans" in display font, `fontSize {xs:26}` (`page.tsx:539-550`) — matches artboard 28/24 scale intent.
- **Section accent = blue** (`tokens.section.plans` `#7aa7ff`) used consistently for back buttons, kickers, today ring, chips, primary actions across all screens — matches `C.accent`.
- **Template day chips** (7 weekday chips, height 36, `radius.md`, accent-muted selected) match `DateChip` (`TemplateSettings.tsx:236-259` vs `artboards-mp-mobile.jsx:220-225`).
- **Template meal-dot colors** use `mealColorToken` (breakfast/lunch/dinner) matching `SECTION` colors in the artboard (`TemplateSettings.tsx:284` vs `artboards-mp-mobile.jsx:228-230`).
- **Editor header accent + Cancel/Title/Done layout** matches the artboard sheet header structure (`MealEditorDialog.tsx:296-336`).
- **Plan-detail TODAY pill + today ring** use `accent.muted` bg + `section.plans` text + `shadow.card` ring (`PlanViewMobile.tsx:94-126`).

---
