# Chunk 5 — Shopping Lists Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **STATUS: PLAN READY (2026-05-30).** Gate #1 concerns resolved (§4) + `/review-plan` converged over 2 rounds (§7). Next: implement via subagent-driven-development (Tasks 1 → 11), then Gate #2 artboard-fidelity audit (§6) before `review-code`.
>
> **Locked decisions (Gate #1):** **C1 = Option A** (in-page master-detail, no real route nesting). **C2 = default KEEP** (opt-in SKIP). **C3 = full presence pill** (all 6 states, avatar color/initials derived client-side from email/name hash — no API change). **C6 = add both finish-shop confirms** (desktop dialog + mobile bottom sheet, over unchanged `finishShop`). C4 (keep DnD reorder), C5 (token additions), C7 (drop StatusBar, restyle existing history dialog) accepted as proposed.

**Goal:** Rebuild the Shopping Lists surface to the dark redesign — a two-pane desktop working view (store sidebar + working list, no modal), a restyled mobile flow, a presence/connection pill, a KEEP/SKIP pantry-check, a solid finish-shop bar, and a flat emoji picker — **visual-only on realtime/presence, with no API or write-logic change.**

**Architecture:** Carve the 2,885-line `src/app/shopping-lists/page.tsx` monolith into focused components under `src/components/shopping-list/`, replacing the URL-synced working-list **Dialog** with an in-page master-detail layout (sidebar + working list on desktop; store-list → pushed working view on mobile). All data fetching, optimistic updates, Ably realtime, pantry-check apply logic, and finish-shop logic are **preserved unchanged** — only the presentation layer and component boundaries change.

**Tech Stack:** Next.js 15 App Router, React 19, MUI v7 (`sx`/`styled`), `@dnd-kit` (existing reorder), Ably (existing realtime via `useShoppingSync`), design tokens (`@/lib/design-tokens`), `SectionThemeProvider` (shop accent `#6fcf97` already bound to `palette.primary` on `/shopping-lists`).

---

## 1. Current state (what exists today)

Source of truth for the rewrite. Full map in the session research; key facts:

- **Monolith:** `src/app/shopping-lists/page.tsx` is **2,885 lines** — one client component (`ShoppingListsPageContent`) owning ~30 `useState`, ~25 handlers, 9 dialogs, DnD, realtime, pantry-check, finish-shop, and the whole render tree. **No extracted subcomponents** (even `SortableShoppingListRow` is defined inline at `:1344`, re-created every render). There is **no** `src/components/shopping-list/shopping-list/` dir despite the cold-start note — only `ItemEditorDialog.tsx` (493) and `StoreHistoryDialog.tsx` (222) exist as components.
- **Working list is a Dialog,** not a route or pane: `viewListDialog = usePersistentDialog('shoppingList')` (`:171`) opened at `:1943` (`maxWidth="md" fullWidth`). It syncs `{ open, storeId }` to the **URL query string** and re-hydrates on refresh via a restore `useEffect` (`:549-574`). "Start Shopping" is now identical to "View List" (legacy `mode` param ignored — pinned by test `:1062`).
- **Realtime/presence is REAL and multi-user but thin.** Hook `useShoppingSync` (`src/lib/hooks/use-shopping-sync.ts`), enabled only while the working-list dialog is open, keyed to `selectedStore._id`, Ably channel `shopping-store:${storeId}`. Presence payload shape is **`ActiveUser = { email, name }`** (`:5-8`) — no avatar, no color, no id. The page excludes self: `activeUsers = members.filter(u => u.email !== session.email)` (`page.tsx:278`). Connection state enum (`connecting|connected|disconnected|suspended|failed`) is exposed via `shoppingSync.connectionState` / `isConnected`. **Any avatar color/initials in the presence pill must be derived client-side from name/email — the brief forbids API changes, so presence data cannot gain fields.**
- **Pantry-check ALREADY EXISTS** (`handleOpenPantryCheck` `:1186`, apply `:1231`, dialog `:2681`): fetches pantry + food items, matches list items whose `foodItemId` is in the pantry, each row gets a checkbox + `QuantityInput`; **checking a row (or qty ≤ 0) = drop it on apply.** No persisted pantry/skip state — lives only in `matchingPantryItems` for the dialog's lifetime. This binary "remove vs keep" decision is exactly where the KEEP/SKIP toggle attaches.
- **Finish-shop ALREADY EXISTS** (`handleClearCheckedItems` `:769` → `finishShop()` → `POST /finish-shop`): upserts checked items into `purchaseHistory` (last-purchased), removes them from the list, broadcasts `list_updated`. Shown only when `checked.length > 0`.
- **Import-from-plans, unit-conflict, share/invite, purchase-history** all exist as inline dialogs (`:2383`, `:2466`, `:2598`, `StoreHistoryDialog`). The artboard restyles them; **no new flows.**
- **EmojiPicker** (`src/components/EmojiPicker.tsx`, 269) — kept for store emoji. Curated `FOOD_EMOJIS` list + a search `TextField` that already filters by description; grid `repeat(auto-fill, minmax(50px,1fr))`, selected tile uses raw hex `2px solid #1976d2` (`:253`). Needs restyle to the flat token grid.
- **Token debt:** the shopping code imports **nothing** from `@/lib/design-tokens` — raw hex (`#2e7d32`, `#1b5e20`, `#1976d2`) in a few places; most surfaces use theme aliases (`success.main`, `primary.main`, `background.paper`). The redesign migrates these to tokens / `palette.primary`.

---

## 2. Token reconciliation (do this first, in theme/tokens)

The artboard hardcodes a local `C` palette that matches `tokens.*` exactly **except** for three gaps that need a home before components consume them:

| Need                                                                                                           | Artboard value                | Plan                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shop accent (fill)                                                                                             | `#6fcf97`                     | Already `tokens.section.shop`; on `/shopping-lists` it's `palette.primary.main` via `SectionThemeProvider`. Consume via `palette.primary` per token philosophy.                                                                    |
| Muted accent fill (`accentDim`)                                                                                | `rgba(111,207,151,0.14)`      | No token. Use `alpha(theme.palette.primary.main, 0.14)` (MUI `alpha`) so it tracks the section accent — **do not** hardcode green. (Precedent: `tokens.accent.muted` is the blue/plans one; we want the section-relative version.) |
| **On-accent ink** (text/icons on the green fill: primary buttons, finish bar, checked checkmark, KEEP segment) | `#0c1a13`                     | **Add `tokens.onAccent.shop = '#0c1a13'`** (or a small `onAccent` map keyed by section). Needed repeatedly; must be a token, not a magic hex.                                                                                      |
| **On-danger ink** (SKIP segment active, Retry)                                                                 | `#1a0f0f`                     | **Add `tokens.onDanger = '#1a0f0f'`.**                                                                                                                                                                                             |
| Off-scale button radius                                                                                        | `9` (artboard)                | **Snap to `tokens.radius.lg` (10)** — the canonical system-wide button radius locked in Chunk 4. Do not introduce a `9`.                                                                                                           |
| `dangerMuted` alpha                                                                                            | artboard `0.12`, token `0.14` | Use the token (`0.14`). Trivial drift; honor the token.                                                                                                                                                                            |

These token additions are the only `theme.ts`/`design-tokens.ts` edits and carry their own unit assertions.

---

## 3. Artboard compliance — exact-value spec (Gate #1, part a)

Extracted value-by-value from `docs/design/weekly-eats-redesign/project/artboards-shopping.jsx` (1602 lines) at **both** breakpoints. Token map: `bg`=`surface.base #0f1115`, `paper`=`surface.raised #181b21`, `paperHi`=`surface.elevated #1e222a`, `sheet`=`surface.sheet #1a1e26`, `paperPast`=`surface.sunken #141619`, `ink`=`text.primary`, `dim`=`text.secondary`, `mute`=`text.muted`, `edge`=`border.subtle`, `edgeHi`=`border.strong`, `accent`=`section.shop #6fcf97`, `accentDim`=accent@0.14, `success/warn/danger`=`state.*`. Fonts: display=`var(--font-display)`, body=`var(--font-body)`. Shared button atoms: **btnPrimary** h36 pad `0 14px` radius **10** bg accent color `#0c1a13` size 13.5/600; **btnGhost** h36 pad `0 14px` radius 10 transparent `1px edge` ink; **btnGhostIcon** 36×36 radius 10 `1px edge`.

### 3.1 Store list / index

**Mobile (`MobileStoreList`):** header pad `10px 18px 14px`, title "Shopping" display **26**/700/`-0.02em`; subline size12 `dim`, counts accent/600; `+ Store` btnPrimary h36 pad `0 12px`. Section label "Your stores" size10/700/`0.16em` uppercase `dim` margin `6px 4px 8px`. Store card: bg `paper` `1px edge` radius **12**, pad `14px`, gap12 — emoji tile 40×40 radius **10** bg `paperHi` size22; name display15/700 ellipsis (+ `group`@13 `dim` if shared); count "{n} to buy" size12 accent/600 or "List empty" size12 `mute`, "· last shop {x}" size11 `mute`; chevron `›` `dim` size14.

**Desktop (`DesktopStoreList`):** container pad `24px 56px 0`, **maxWidth 1100**. Title display **32**/700/`-0.025em`; subline size13; `+ Add store` btnPrimary. Search bar h40 bg `paperHi` `1px edgeHi` radius **12** maxWidth **360** mb16, search@16 `dim`. Table: bg `paper` `1px edge` radius **14** overflow hidden; **grid cols `60px 1fr 140px 180px 140px 90px`**; header pad `12px 22px` labels size10/700/`0.14em` uppercase `dim`; rows pad `14px 22px` bottom border (not last), cursor pointer — emoji size24, name display16/700, "{n} items" size13 accent/600 or "Empty" `mute`, shared col (`group`@14 + "with {names}") or "Just you" `mute`, lastShop size12 `dim`, `chevron_right`@18 `dim` right.

**Pending invite banner** (both): bg `warnMuted` `1px ${warn}55` radius 12(m)/14(d), pad `12px 14px`(m)/`14px 18px`(d), eyebrow "INVITATION"/"PENDING INVITATION" size12/11 700 `0.08em`/`0.10em` uppercase `warn`; Accept 30×30 radius8 bg `successMuted` `success` check@16 (mobile) or btnPrimary h34 (desktop); Decline 30×30 `1px edge` `dim` close@16 or btnGhost h34.

### 3.2 Working shopping list (the core)

**Mobile (`MobileShoppingList`):** StatusBar(drop) → top bar pad `6px 14px 10px` bottom border — back "‹ Stores" accent size14 (chevron_left@18), right cluster: **Live pill** + more btnGhostIcon 32×32 (more_vert@18). Store header pad `12px 18px 0` gap12 — emoji 🛒 size30, name display **22**/700/`-0.02em`, subline "{unchecked} to buy · {checked} in cart" size12 `dim` (unchecked count accent/600). Unchecked group bg `paper` `1px edge` radius **12** overflow hidden. Add-row button w100% mt10 pad `12px 14px` transparent **`1px dashed edgeHi`** radius 12 accent size13.5/600 centered (add@16 + "Add item"). Checked label "IN CART · {n}" size10/700/`0.16em` uppercase `dim` pad `20px 4px 10px` + 1px `edge` rule; group bg **`paperPast`** `1px edge` radius 12. **ItemRow (mobile):** flex gap12 pad `12px 14px` bottom border (not last), **opacity 0.6 when checked** — checkbox 22×22 radius **6** (unchecked transparent `1.5px edgeHi`; checked accent fill `1.5px accent` + check@14 `#0c1a13`); name size14.5/500 line-through if checked; qty/unit size11.5 `mute` tabular; drag_indicator@18 `mute`. **Finish bar (mobile):** `position:absolute left:0 right:0 bottom:0` pad `12px 16px 22px` bg `bg` (opaque) **`borderTop:1px edge` (hard edge, no gradient)** — button w100% **h48** bg accent color `#0c1a13` radius 12 size15/700 (done_all@18 + "Finish shop · {n} bought").

**Desktop (`DesktopShoppingList`):** **two-pane grid `gridTemplateColumns:'280px 1fr'` height `calc(100% - 75px)`**. Sidebar (fixed **280px**) `borderRight 1px edge` pad `20px 14px` scroll-y — header "Stores" display14/700 + add btnGhostIcon 28×28; store rows pad `8px 10px` radius **8**, **active** bg `accentDim` `1px ${accent}55` (inactive transparent), emoji size18, name size13 (active 600/inactive 500), count badge size11 accent(active)/`mute`. List pane scroll-y pad `24px 32px 110px`. List header: emoji size40 + name display **28**/700/`-0.025em` + subline size13 `dim`; right cluster: **Presence pill** + "Import from plans" btnGhost (event_note@14 `plans`) + "Pantry check" btnGhost (kitchen@14 `pantry`) + more btnGhostIcon 36×36. Unchecked group bg `paper` `1px edge` radius **14**. Add-row mt12 pad `13px 16px` `1px dashed edgeHi` radius 12 accent size14/600. Checked label "IN CART · {n}" size11/700/`0.16em` pad `22px 4px 10px` + rule + **"Uncheck all"** size12 `dim`; group bg `paperPast` radius 14. **ItemRow (desktop):** flex gap14 pad `12px 18px`, **opacity 0.55 when checked** — checkbox 22×22 radius6, name size15/500 + qty size12.5 `mute`, drag_indicator@18. **Finish bar (desktop):** `position:absolute left:280 right:0 bottom:0` pad `14px 32px 22px` bg `bg` `borderTop 1px edge` text-right — button **h46** bg accent color `#0c1a13` radius 12 size14.5/700 (done_all@18 + "Finish shop · {n} bought").

### 3.3 Presence / Live pill (`LivePillStates` reference board)

Maps to `useShoppingSync` `connectionState` + `activeUsers` (others, excluding self). Base pill: inline-flex gap6 pad `3px 10px 3px 3px` bg `paper` `1px edge` radius **999**; dot 6×6 radius999.

| State                  | Source                                 | Pill                                                                                                              |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Connected · alone      | `connected` + `activeUsers.length===0` | "LIVE" size11/600/`0.06em` uppercase `dim` + `success` dot                                                        |
| Connected · 1 other    | + 1 active                             | avatar 20px (derived color) + `success` dot, pad `3px 8px 3px 3px`                                                |
| Connected · 2+         | + N active                             | stacked avatars 20px (`marginLeft -4/-8`, `2px solid paper` ring) + `success` dot; **past 3 → "+N"**              |
| Connecting             | `connecting`                           | "CONNECTING…" `warn` + `warn` dot (pulse)                                                                         |
| Disconnected/suspended | `disconnected`/`suspended`             | "OFFLINE" `danger` + `danger` dot; border `${danger}55` bg `dangerMuted`; tap → `reconnect()`                     |
| Failed                 | `failed`                               | "SYNC FAILED" `danger` + **Retry** btn (bg `danger` color `#1a0f0f` radius999 pad `2px 8px` size10/700 uppercase) |

Avatars: derive a deterministic color from email/name hash (no schema field); initials from name. Mobile pill omits name text; desktop list-header pill uses 26px avatars with `2px solid paper` ring + 7×7 dot.

### 3.4 Pantry check — KEEP/SKIP (`MobilePantryCheck` / `DesktopPantryCheck`)

Mobile full-frame (Cancel/Apply header); desktop dialog **width 560** radius **16** modal shadow ("Pantry check" display18 + close). Summary banner bg `pantryMuted`(=pantry@~0.14) `1px ${pantry}44` radius 12 pad `12px 14px` — kitchen@18 `pantry` + copy size12.5. **Tally pill** inline-flex gap8 pad `6px 12px` bg `paper`(m)/`paperHi`(d) `1px edge` radius **999** mb14 — 8×8 `danger` dot + "**{removing}** dropping off · **{remaining}** still on list" (removing `danger`/700, remaining `ink`/600). Match rows gap8: **skip** state bg `dangerMuted` `1px ${danger}55`, name `mute` + line-through; **keep** state bg `paper`(m)/`paperHi`(d) `1px edge`, name `ink`; radius 12(m)/10(d); name display14.5/14 700, sub "{list} on list" size12 `dim`. **KEEP/SKIP segmented toggle:** outer inline-flex bg `paperHi`(m)/`bg`(d) `1px edge` radius **999** pad2; two segments pad `5px 11px` radius999 size11/700/`0.06em` uppercase — **KEEP** active → bg `success` text `#0c1a13`; **SKIP** active → bg `danger` text `#1a0f0f`; inactive segment transparent text `dim`; exactly one filled. Desktop footer Cancel btnGhost + Apply btnPrimary.

### 3.5 Create store / flat emoji picker (`MobileCreateStore` / `DesktopCreateStore`)

Mobile full-frame; desktop dialog **width 520** radius 16 modal maxHeight **85vh** flex-column. Preview+name card: flex gap12/14 pad `12px 14px` bg `paper`(m)/`paperHi`(d) `1px edge` radius 12 mb18 — emoji tile **52×52**(m)/**56×56**(d) radius 12 size28/30; name eyebrow "NAME" size10/700/`0.14em`, input h36 `1px accent` + `0 0 0 3px accentDim` ring radius **8** (value + caret). Search h40 bg `paperHi` `1px edgeHi` radius 12 mb12 (search@16 + "Search emoji…" `mute`). **Flat grid:** `display:grid` **mobile `repeat(7,1fr)` / desktop `repeat(10,1fr)`** gap4 — each cell w100% **aspect-ratio 1** size22 radius **8** transparent, **selected** → bg `accentDim` `1px accent` (unselected `1px transparent`). One uniform square grid, **no category headers/tabs/nesting** (this is the "flat" picker vs the old curated-by-category layout); the search box **must actually filter**. Desktop footer Cancel btnGhost + "Create store" btnPrimary.

### 3.6 Item editor (`MobileItemEditor` / `DesktopItemEditor[Edit]`)

Mobile full-frame (Cancel/title display15/Add-Save). Food field h44(m)/h40(d) bg `paperHi` `1px accent` + 3px accentDim ring radius 12(m)/10(d) (add-mode autocomplete below: first result bg `accentDim` + `↵`, "(already in list)" `mute`, "Create …" add@14). Qty+Unit grid `1fr 1.2fr`(m)/`1fr 1.4fr`(d) gap12 — qty stepper h44/h40 bg `paperHi` `1px edgeHi` radius 12/10, ∓ btnGhostIcon 32×32(m)/28×28(d) borderless, value size18/16 600 tabular; unit field same + expand_more. **Edit-mode Remove:** mobile mt26 w100% h44 bg `dangerMuted` `1px ${danger}55` radius **10** `danger` size14/600 (delete@15); desktop footer-left transparent `1px rgba(232,122,138,0.35)` `danger` radius8. Desktop dialog **width 480** radius 16 modal; footer bg `paperHi` top border, Add → Cancel btnGhost + "Add to list" btnPrimary, Edit → Remove (left) + Cancel + Save.

### 3.7 Import / unit-conflict / share / finish-confirm / actions menu

- **Import (`*Import`):** mobile full-frame / desktop dialog **width 540** radius 16. "RECENT PLANS" eyebrow size10/700/`0.16em`; plan rows gap8, selected bg `accentDim` `1px accent`, checkbox 22×22 radius6, event_note@18 `plans`, name display14/700 + meta size11.5 `dim`.
- **Unit conflict (`*UnitConflict`):** mobile bottom **sheet** (radius **18** top, `shadow.sheet`, grab handle 36×4) / desktop dialog **width 560/560** radius 16. Eyebrow "UNIT CONFLICT · 1 OF 3" size10/700/`0.16em`; title display20/700. Source rows bg `paper`(m)/`paperHi`(d) `1px edge` radius **10**. Suggestion banner bg `accentDim` `1px ${accent}33` radius 10 (auto_fix_high@14 + "Suggested: **1.31 cups**"). Qty+Unit both `1px accent` radius 10 h40. Footer Back btnGhost + "Next conflict ›" btnPrimary.
- **Share (`*Share`):** mobile full-frame / desktop dialog **width 540** radius 16 (+subtitle "Real-time sync — …"). Invite field h44/h40 `1px edgeHi` radius 12/10 + Invite btnPrimary. Shared-with: avatar 34px + name size13.5/600 + email size11.5 `dim` + remove 30×30 radius8 `1px edge` `danger`. Pending: dashed card, 34×34 round bg `warnMuted` hourglass_empty@16 `warn` + "Invited … awaiting response" + "Cancel" `dim` size12.
- **Finish-shop confirm (`DesktopFinishShop`, desktop only in artboard):** dialog **width 460** radius 16 modal pad `24px 26px 22px` — icon badge 56×56 radius 16 bg `accentDim` `accent` done_all@28; title "Finish this shop?" display22/700; body size14 `dim` lh1.55 ("**3 items** … saved to **{store}** purchase history and cleared … **{n} items** remain."); footer Cancel btnGhost + "Save trip" btnPrimary. **Mobile has no drawn confirm** — see concern C6.
- **Actions menu (`MobileActionsMenu`, mobile only):** bottom sheet bg `sheet` radius **18** top `shadow.sheet` pad `12px 0 24px`, grab handle 36×4; rows pad `14px 22px` gap14 icon@20 — Import (event_note `plans`), Pantry check (kitchen `pantry`), Purchase history (history `dim`), Share (group_add `success`, divider), Rename (edit `dim`), Delete (delete `danger` text `danger`). Desktop equivalent = the more-icon `Menu` already in code.

### 3.8 Drop / cosmetic

- **StatusBar** faux device chrome (9:41 / battery / signal) — **drop** (artboard framing only).
- Stray `\n`/`—` literals in artboard JSX comments (`:879`) — source artifact, ignore.

---

## 4. Artboard concerns — RESOLVED (Gate #1) ✅

Signed off 2026-05-30. Each genuine judgment call below; **outcome in bold** at the end of each. Most of the artboard's apparent "new features" already exist in code, so the list was short.

### C1 — Two-pane working view: in-page master-detail vs real nested route ⭐ (the one architectural decision)

**What:** The artboard desktop shows the **store sidebar + working list side-by-side on one screen** with instant selection (active-row highlight, no page transition); mobile is store-list → pushed working view. The current code uses a URL-synced **Dialog** for the working list. Spec §4 says "two-pane desktop route … **no modal**."

- **Option A — In-page master-detail (RECOMMENDED).** Keep the single `/shopping-lists` route. Desktop renders the persistent 280px sidebar + the selected store's working list together; mobile renders the store list and swaps to an in-page working view on tap (back button returns). Selection synced to `?store=<id>` reusing the **existing** `usePersistentDialog`/restore logic (deep-link + refresh keep working). No new API, no route nesting. **Most faithful** to the artboard's simultaneous two-pane + instant swap; **lowest risk**.
- **Option B — Real nested route `/shopping-lists/[storeId]`.** Matches the chunk 3/4 precedent (meal-plans/[id], recipes/[id] are real routes). But those are single-pane full-screen detail views; shopping's desktop is genuinely **two panes at once**, which fights real-route nav (full transitions + loading states between stores) and needs a shared-layout refactor to keep the sidebar mounted. Higher risk, less faithful to instant selection.
- **Recommendation: A.** "no modal" (the locked requirement) is satisfied either way; the artboard's desktop is master-detail, not page nav. Spec's word "route" is honored by the existing `/shopping-lists` route hosting the two-pane. → **✅ LOCKED: Option A.**

### C2 — KEEP/SKIP default state

**What:** New segmented KEEP/SKIP toggle replaces the current "check a row = remove it" pantry-check. Same underlying apply logic (skip = old checked→drop). The artboard mock shows several rows pre-skipped (just to show the state).

- **Recommendation (honor): default = KEEP** for every matched row; SKIP is opt-in. Copy is "Toggle _Skip_ on the ones you don't need to buy." Nothing drops unless the user explicitly skips it. The tally pill counts skipped→"dropping off". → **✅ LOCKED: default KEEP.**

### C3 — Presence pill: build the full multi-user pill with client-derived avatars

**What:** Presence data is real but thin (`{email,name}` for other active viewers + a connection-state enum). The artboard's pill has 6 states incl. stacked avatars with per-user colors and "+N".

- **Recommendation (honor + adapt): build all states** — they all map to **real** `connectionState`/`activeUsers` data. **Derive avatar color deterministically from an email/name hash and initials from name** (no schema change, no API change). Cap shown avatars at 3 then "+N". This unifies today's two ad-hoc constructs (the connection "Live" pill `:1997` + the "Also viewing" row `:2053`) into one pill. → **✅ LOCKED: full pill + derived avatars.**

### C4 — Drag-to-reorder: keep

**What:** Artboard shows `drag_indicator` on every unchecked row; current code already has `@dnd-kit` DnD + a `storeItemPositions` persistence layer.

- **Recommendation (honor):** keep the existing reorder wholesale; just restyle the row + handle. No logic change.

### C5 — `accentDim` / on-accent ink / radius-9 → tokens (see §2)

- **Recommendation (adapt):** add `tokens.onAccent.shop` (`#0c1a13`) + `tokens.onDanger` (`#1a0f0f`); use `alpha(palette.primary.main, 0.14)` for `accentDim`; snap button radius 9→10 (canonical). Trivial; flagged so it isn't left as magic hex.

### C6 — Mobile finish-shop confirmation (artboard gap)

**What:** Desktop has a "Finish this shop?" confirm dialog; **mobile's finish bar has no drawn destination.** Today's code finishes **without** a confirm (optimistic clear).

- **Recommendation (adapt): add a mobile confirm bottom sheet** reusing the desktop confirm's content (so finishing isn't an un-undoable tap with no warning), and **also add the desktop confirm dialog** (today there's none). This is a small UX add over unchanged finish-shop logic. → **✅ LOCKED: add both confirms** (desktop dialog + mobile bottom sheet).

### C7 — Faux StatusBar / purchase-history (no new artboard)

- **StatusBar:** drop (cosmetic framing).
- **Purchase history:** already exists (`StoreHistoryDialog`); the artboard doesn't redraw it. **Recommendation:** restyle the existing dialog to match the redesign's dialog vocabulary (dark `paper`, radius 16, modal shadow) — no new screen invented.

**→ All resolved (locked 2026-05-30): C1=A, C2=KEEP, C3=full pill, C6=both confirms.** C4/C5/C7 accepted as proposed.

---

## 5. File structure & bite-sized TDD tasks

**Decomposition target** — carve `page.tsx` into:

```
src/app/shopping-lists/
  page.tsx                      # thin: data orchestration + master-detail layout switch (was 2885 lines)
src/components/shopping-list/
  StoreList/
    StoreListView.tsx           # index: header + invite banner + search + (desktop table | mobile cards)
    StoreCard.tsx / StoreRow.tsx
    PendingInviteBanner.tsx
  Working/
    ShoppingListView.tsx        # two-pane (desktop) / pushed view (mobile) shell
    StoreSidebar.tsx            # desktop 280px sidebar
    ShoppingItemRow.tsx         # sortable row (extracted from inline :1344)
    AddItemRow.tsx              # dashed "Add item" affordance
    FinishShopBar.tsx           # solid sticky bar
    FinishShopConfirm.tsx       # desktop dialog + mobile sheet (C6)
  Presence/
    PresencePill.tsx            # unified connection + multi-user pill (C3)
    PresenceAvatar.tsx          # derived color/initials
  PantryCheck/
    PantryCheckDialog.tsx
    KeepSkipToggle.tsx          # segmented pill (C2)
  ItemEditorDialog.tsx          # restyle existing
  StoreHistoryDialog.tsx        # restyle existing (C7)
  ImportFromPlansDialog.tsx     # extract + restyle
  UnitConflictDialog.tsx        # extract + restyle (mobile sheet / desktop modal)
  ShareStoreDialog.tsx          # extract + restyle
  StoreEditorDialog.tsx         # create/edit store + flat emoji picker
src/components/ui/EmojiPicker.tsx  # shared flat picker (generalize Chunk-4 recipes/EmojiPicker w/ accent prop, §3.5)
src/components/EmojiPicker.tsx     # legacy: keep FOOD_EMOJIS data; convert to NAMED export
src/test-utils/renderWithTheme.tsx # shop-accent-bound render helper (Task 3A)
src/lib/design-tokens.ts           # + onAccent.shop, onDanger (§2)
```

**Known signatures (verified against current code — reuse, don't change):**

- `ShoppingListItem = { foodItemId: string; name: string; quantity: number; unit: string; checked: boolean }` (`src/types/shopping-list.ts:19`).
- `Store = { _id; userId; name; emoji?; invitations?: StoreInvitation[]; createdAt; updatedAt }`; `StoreInvitation = { userId; userEmail; status: 'pending'|'accepted'|'rejected'; invitedBy; invitedAt }`.
- `useShoppingSync(opts)` returns `{ isConnected, connectionState, lastConnectionError, activeUsers, reconnect, disconnect }`; `ActiveUser = { email: string; name: string }`; `connectionState ∈ 'initialized'|'connecting'|'connected'|'disconnected'|'suspended'|'closing'|'closed'|'failed'|'unknown'`.
- `ItemEditorDialog` props: `{ open, mode:'add'|'edit', title?, excludeFoodItemIds?, initialDraft?, onClose, onSave, onDelete?, onFoodItemAdded? }`.
- Tokens consumed via `palette.primary` (shop accent on `/shopping-lists`); `tokens.onAccent.shop`/`tokens.onDanger` added in Task 1; `accentDim` = `alpha(theme.palette.primary.main, 0.14)`.

Test conventions (CLAUDE.md): colocated `__tests__/`, `userEvent.setup()`, `waitFor()`, mock `@/lib/auth` + `@/lib/mongodb` for routes (not touched here), `vi.stubGlobal('fetch', mockFetch)` in `beforeEach` + `vi.unstubAllGlobals()` in `afterEach` (never module-scope `global.fetch`); when a component renders MUI, wrap in the app theme via a `renderWithTheme` helper so `palette.primary` resolves to the shop accent.

---

### Task 1: Design tokens — on-accent / on-danger ink

**Files:**

- Modify: `src/lib/design-tokens.ts`
- Test: `src/lib/__tests__/design-tokens.test.ts` (create if absent; else add cases)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { tokens } from '@/lib/design-tokens';

describe('shopping on-accent ink tokens', () => {
  it('exposes dark on-accent ink for the shop section fill', () => {
    expect(tokens.onAccent.shop).toBe('#0c1a13');
  });
  it('exposes dark on-danger ink for danger fills (SKIP segment / retry)', () => {
    expect(tokens.onDanger).toBe('#1a0f0f');
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `npx vitest run src/lib/__tests__/design-tokens.test.ts` → FAIL (`onAccent` undefined).
- [ ] **Step 3: Implement** — in `tokens`, add after `accentUtility`:

```ts
  onAccent: { shop: '#0c1a13' },
  onDanger: '#1a0f0f',
```

- [ ] **Step 4: Run it, verify PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(shopping): add on-accent/on-danger ink tokens"`

---

### Task 2: `PresenceAvatar` + derived color/initials (pure)

**Files:**

- Create: `src/components/shopping-list/Presence/presence-utils.ts`
- Create: `src/components/shopping-list/Presence/PresenceAvatar.tsx`
- Test: `src/components/shopping-list/Presence/__tests__/presence-utils.test.ts`, `.../PresenceAvatar.test.tsx`

- [ ] **Step 1: Failing test for the pure helpers**

```ts
import { describe, it, expect } from 'vitest';
import { presenceInitials, presenceColor, PRESENCE_PALETTE } from '../presence-utils';

describe('presenceInitials', () => {
  it('takes the first letter of the first two name words, uppercased', () => {
    expect(presenceInitials('Sara Rose')).toBe('SR');
  });
  it('falls back to one letter for a single-word name', () => {
    expect(presenceInitials('jamie')).toBe('J');
  });
  it('falls back to "?" for an empty name', () => {
    expect(presenceInitials('')).toBe('?');
  });
});

describe('presenceColor', () => {
  it('is deterministic for the same key', () => {
    expect(presenceColor('sara@x.com')).toBe(presenceColor('sara@x.com'));
  });
  it('returns a color from the fixed palette', () => {
    expect(PRESENCE_PALETTE).toContain(presenceColor('sara@x.com'));
  });
  it('distributes different keys across the palette (not all identical)', () => {
    const colors = ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com'].map(presenceColor);
    expect(new Set(colors).size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run → FAIL** (`presence-utils` missing).
- [ ] **Step 3: Implement `presence-utils.ts`**

```ts
// Avatar colors are derived client-side from the user's email/name — the realtime
// presence payload is only { email, name } and we must not add fields (no API change).
export const PRESENCE_PALETTE = [
  '#8c5b6d',
  '#5b6d8c',
  '#6d8c5b',
  '#8c7d5b',
  '#5b8c87',
  '#7d5b8c',
] as const;

export function presenceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function presenceColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return PRESENCE_PALETTE[Math.abs(hash) % PRESENCE_PALETTE.length];
}
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Failing test for `PresenceAvatar`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PresenceAvatar } from '../PresenceAvatar';

describe('PresenceAvatar', () => {
  it('shows derived initials and an accessible name', () => {
    render(<PresenceAvatar name="Sara Rose" email="sara@x.com" size={20} />);
    expect(screen.getByText('SR')).toBeInTheDocument();
    expect(screen.getByLabelText('Sara Rose')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run → FAIL. Implement `PresenceAvatar.tsx`** — a `Box` (size×size, `borderRadius:'50%'`, `bgcolor: presenceColor(email||name)`, `color:'#fff'`, centered initials size ~`size*0.42`/700), `aria-label={name}`, optional `ring` prop adding `border: 2px solid ${tokens.surface.raised}` for stacked variants. `"use client"`.
- [ ] **Step 7: Run → PASS. Commit** — `git commit -am "feat(shopping): PresenceAvatar + derived color/initials"`

---

### Task 3: `KeepSkipToggle` (segmented pill, controlled)

**Files:**

- Create: `src/components/shopping-list/PantryCheck/KeepSkipToggle.tsx`
- Test: `.../PantryCheck/__tests__/KeepSkipToggle.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { KeepSkipToggle } from '../KeepSkipToggle';

describe('KeepSkipToggle', () => {
  it('marks the active half via aria-pressed', () => {
    render(<KeepSkipToggle value="keep" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /keep/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /skip/i })).toHaveAttribute('aria-pressed', 'false');
  });
  it('calls onChange with the other value when the inactive half is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeepSkipToggle value="keep" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /skip/i }));
    expect(onChange).toHaveBeenCalledWith('skip');
  });
});
```

- [ ] **Step 2: Run → FAIL. Step 3: Implement** — outer `Box` (inline-flex, `1px solid` border.subtle, `borderRadius: tokens.radius.pill`, `p: '2px'`), two `ButtonBase` segments. KEEP active → `bgcolor: state.success`, `color: tokens.onAccent.shop`; SKIP active → `bgcolor: state.danger`, `color: tokens.onDanger`; inactive → transparent + `text.secondary`. Each `aria-pressed`, `aria-label="Keep"`/`"Skip"`, size 11/700/`0.06em` uppercase.
- [ ] **Step 4: Run → PASS. Step 5: Commit** — `git commit -am "feat(shopping): KeepSkipToggle segmented pill"`

---

### Task 3A: `renderWithTheme` test util (prerequisite for Tasks 4–9)

Nearly every new component test renders MUI and asserts token-derived colors, so it must render under a theme whose `palette.primary` is the **shop** accent (`#6fcf97`) — exactly as `SectionThemeProvider` binds it live on `/shopping-lists`. Build this **before** the first test that imports it (Task 4 Step 5). Only `src/test-utils/session.ts` exists today; this adds the render helper.

**Files:** Create `src/test-utils/renderWithTheme.tsx`; Test `src/test-utils/__tests__/renderWithTheme.test.tsx`

- [ ] **Step 1: Failing sanity test** — the helper's theme must resolve the shop accent (so downstream color assertions are trustworthy).

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTheme } from '@mui/material/styles';
import { renderWithTheme } from '../renderWithTheme';
import { tokens } from '@/lib/design-tokens';

function Probe() {
  const t = useTheme();
  return <span data-testid="primary">{t.palette.primary.main}</span>;
}

describe('renderWithTheme', () => {
  it('binds the shop section accent to palette.primary', () => {
    renderWithTheme(<Probe />);
    expect(screen.getByTestId('primary')).toHaveTextContent(tokens.section.shop);
  });
});
```

- [ ] **Step 2: Run → FAIL.** **Step 3: Implement `renderWithTheme.tsx`** — re-export RTL's `render` wrapped in the app `theme` (from `@/lib/theme`) with `palette.primary` overridden to `{ main: tokens.section.shop }` (the shop accent), mirroring `SectionThemeProvider`. Export `renderWithTheme(ui, options?)` returning the RTL result, plus a `stubHandlers()` factory returning the no-op **`ShoppingListView`-level** props it requires: `onSelectStore`, `onToggleItem`, `onEditItem`, `onAddItem`, `onFinish`, `onBack`, `onReconnect`, `connectionState: 'connected'`, `activeUsers: []`. (Note: these are the _view's_ handler names; the view maps them down to the narrower `ShoppingItemRow` props `onToggle`/`onEdit` — keep the two levels' names distinct, not a mismatch.) MUI `sx`-class colors still resolve from this `palette.primary` in jsdom for `toHaveStyle` on inline-mapped values; tests primarily assert text/aria, with color only where load-bearing.
- [ ] **Step 4: Run → PASS. Commit** — `git commit -am "test(shopping): renderWithTheme helper bound to shop accent"`

---

### Task 3B: `StoreListView` index surface (decompose the store list)

The index (list-of-stores) is a full surface in the artboard (§3.1) but had no dedicated task. Extract it from `page.tsx` (the index `return` at `:1433`, table `:1544`, mobile cards, pending-invite `Paper` `:1468`) into focused components, restyled to §3.1. **On desktop this is the zero-store / empty state and the mobile store-list; the two-pane (Task 4) is the populated desktop view.**

**Files:** Create `.../StoreList/StoreListView.tsx`, `.../StoreList/StoreCard.tsx`, `.../StoreList/StoreRow.tsx`, `.../StoreList/PendingInviteBanner.tsx`; Modify `page.tsx`; Test `.../StoreList/__tests__/StoreListView.test.tsx`, `.../PendingInviteBanner.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StoreListView } from '../StoreListView';
import { PendingInviteBanner } from '../PendingInviteBanner';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

const stores = [
  { _id: 's1', name: 'Corner market', emoji: '🛒', itemCount: 3 },
  { _id: 's2', name: 'Greenleaf', emoji: '🥬', itemCount: 0 },
];

describe('StoreListView', () => {
  it('renders each store with its name and to-buy count', () => {
    renderWithTheme(
      <StoreListView stores={stores} onSelectStore={() => {}} onAddStore={() => {}} />
    );
    expect(screen.getByText('Corner market')).toBeInTheDocument();
    expect(screen.getByText(/3 to buy/i)).toBeInTheDocument();
    expect(screen.getByText(/list empty/i)).toBeInTheDocument(); // s2 has 0
  });
  it('calls onSelectStore with the store id when a row is clicked', async () => {
    const user = userEvent.setup();
    const onSelectStore = vi.fn();
    renderWithTheme(
      <StoreListView stores={stores} onSelectStore={onSelectStore} onAddStore={() => {}} />
    );
    await user.click(screen.getByRole('button', { name: /Corner market/ }));
    expect(onSelectStore).toHaveBeenCalledWith('s1');
  });
});

describe('PendingInviteBanner', () => {
  it('renders an accept and decline control for a pending invite', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    renderWithTheme(
      <PendingInviteBanner
        invite={{ storeId: 's9', storeName: 'Sara’s store', inviterName: 'Sara' }}
        onAccept={onAccept}
        onDecline={() => {}}
      />
    );
    await user.click(screen.getByRole('button', { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledWith('s9');
  });
});
```

- [ ] **Step 2: Run → FAIL.** **Step 3: Implement** — `StoreListView` renders the §3.1 header (title display 26(m)/32(d)/700, `+ Store`/`+ Add store` btnPrimary), the `PendingInviteBanner` (warn-tinted, Accept/Decline), the desktop search bar + 6-col `60px 1fr 140px 180px 140px 90px` table **and** mobile `StoreCard` list; each row/card is a `ButtonBase` (accessible name = store name) → `onSelectStore(store._id)`. Migrate raw hex (`#2e7d32`/`#1b5e20`) → `palette.primary`/tokens. Keep `useSearchPagination` + the existing invite-respond handlers.
- [ ] **Step 4: Migrate `page.test.tsx` index cases** — `:191` render, `:233` item counts, `:263` "does not show View List button", and the pending-invitations cases — into `StoreListView.test.tsx`, preserving intent.
- [ ] **Step 5: Run → PASS. Commit** — `git commit -am "feat(shopping): extract StoreListView index surface + invite banner"`

---

### Task 4: Working-view shell — two-pane (desktop) / pushed (mobile), `StoreSidebar` ⭐

Implements C1=A. **Covers spec §4 required case: store-pane ↔ working-list selection.**

**Files:**

- Create: `src/components/shopping-list/Working/StoreSidebar.tsx`, `.../Working/ShoppingListView.tsx`
- Modify: `src/app/shopping-lists/page.tsx` (swap the working-list `Dialog` for `ShoppingListView`; keep `usePersistentDialog('shoppingList')` URL sync + restore `useEffect` as the `?store=` deep-link/selection source)
- Test: `.../Working/__tests__/StoreSidebar.test.tsx`, `.../Working/__tests__/ShoppingListView.test.tsx`

- [ ] **Step 1: Failing `StoreSidebar` test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StoreSidebar } from '../StoreSidebar';

const stores = [
  { _id: 's1', name: 'Corner market', emoji: '🛒', itemCount: 3 },
  { _id: 's2', name: 'Greenleaf', emoji: '🥬', itemCount: 0 },
];

describe('StoreSidebar', () => {
  it('marks the active store row', () => {
    render(
      <StoreSidebar stores={stores} activeStoreId="s1" onSelect={() => {}} onAddStore={() => {}} />
    );
    expect(screen.getByRole('button', { name: /Corner market/ })).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.getByRole('button', { name: /Greenleaf/ })).toHaveAttribute(
      'aria-current',
      'false'
    );
  });
  it('calls onSelect with the store id when a different store is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <StoreSidebar stores={stores} activeStoreId="s1" onSelect={onSelect} onAddStore={() => {}} />
    );
    await user.click(screen.getByRole('button', { name: /Greenleaf/ }));
    expect(onSelect).toHaveBeenCalledWith('s2');
  });
});
```

- [ ] **Step 2: Run → FAIL. Step 3: Implement `StoreSidebar.tsx`** — fixed 280px column, `borderRight: 1px border.subtle`, header "Stores" (display 14/700) + add `IconButton` (28×28, `add`, `aria-label="Add store"` → `onAddStore`). Rows: `ButtonBase` pad `8px 10px` radius `md`(8); active → `bgcolor: accentDim`, `border: 1px ${primary}55`, `aria-current`; emoji 18, name 13 (active 600), count badge 11 (`primary` active / `text.muted`). Map each store to `onSelect(store._id)`.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Failing `ShoppingListView` selection-integration test** — render `ShoppingListView` with two stores, `activeStoreId="s1"`, an `items` map, and `onSelectStore`; assert the desktop grid shows both the sidebar and store s1's items; clicking store s2 in the sidebar calls `onSelectStore('s2')`.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ShoppingListView } from '../ShoppingListView';
import { renderWithTheme, stubHandlers } from '@/test-utils/renderWithTheme'; // created in Task 3A

const stores = [
  { _id: 's1', name: 'Corner market', emoji: '🛒', itemCount: 1 },
  { _id: 's2', name: 'Greenleaf', emoji: '🥬', itemCount: 0 },
];
const items = [{ foodItemId: 'f1', name: 'shallots', quantity: 2, unit: 'each', checked: false }];

describe('ShoppingListView (two-pane selection)', () => {
  it('renders the active store list beside the sidebar and switches on sidebar click', async () => {
    const user = userEvent.setup();
    const onSelectStore = vi.fn();
    renderWithTheme(
      <ShoppingListView
        stores={stores}
        activeStoreId="s1"
        items={items}
        onSelectStore={onSelectStore}
        /* presence/handlers stubbed */
        {...stubHandlers()}
      />
    );
    expect(screen.getByText('Corner market')).toBeInTheDocument();
    expect(screen.getByText('shallots')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Greenleaf/ }));
    expect(onSelectStore).toHaveBeenCalledWith('s2');
  });
});
```

- [ ] **Step 6: (`renderWithTheme` + `stubHandlers` already exist from Task 3A — no work here.)**
- [ ] **Step 7: Run → FAIL. Implement `ShoppingListView.tsx`** — desktop (`md+`): `display:grid; gridTemplateColumns:'280px 1fr'` with `StoreSidebar` + the list pane; mobile (`xs`): show the list pane only with a `‹ Stores` back affordance (calls `onBack`); list pane renders the store header (emoji 40 / name display 28 / subline), the presence + actions cluster (Task 7/finish in later tasks slot in), the unchecked group, add-row, checked group. Items rendered via `ShoppingItemRow` (Task 5) — for this task a minimal inline row is fine; Task 5 swaps it in.
- [ ] **Step 8: Wire into `page.tsx`** — replace the working-list `Dialog` (`:1943`) with `ShoppingListView`; `activeStoreId` comes from the existing `usePersistentDialog('shoppingList')` `storeId` param; `onSelectStore` calls `viewListDialog.openDialog({ storeId })` + the existing fetch; `onBack` closes it (mobile). Desktop shows the two-pane whenever stores exist, defaulting selection to the first/last-viewed store; the standalone `StoreListView` (Task 3B) remains the **mobile** store-list and the **desktop empty/zero-store** state. (Resolve the exact desktop default-selection in implementation; assert restore-from-URL still works.)
  - **🔒 Locked (arch finding): `useShoppingSync` `enabled` becomes `selectedStore !== null`** (was `enabled: viewListDialog.open` at `page.tsx:270`). This is the correct lifecycle now that the working list is always mounted on desktop — it avoids connecting/entering presence on a null channel before a store is selected, and ensures the presence pill activates on desktop (the pill renders only inside `ShoppingListView` with an active store). Mobile: same rule (enabled once a store is in the pushed view).
- [ ] **Step 9: Migrate `page.test.tsx`** to the new view, keeping behavioral intent. Enumerate each load-bearing case with an explicit disposition (migrate-as-is / rewrite-for-new-DOM / superseded-by-component-test):
  - `:400` re-fetch-on-open → **rewrite** (open = select store in view).
  - `:966` URL restore, `:1062` ignore-legacy-mode → **migrate-as-is** (the `?store=` param contract is preserved).
  - `:691` **realtime `onItemChecked` integration** → **migrate (must survive) — stays a PAGE-level test** (`useShoppingSync` remains owned by `page.tsx`, so the test keeps rendering the page and driving `lastShoppingSyncOptions.onItemChecked('f1', true)` against the mocked hook). Task 7 deletes only the inline _presence_ constructs, not the sync wiring. Do **not** relocate it into `ShoppingListView.test.tsx` (the view receives items as props and never sees the hook options).
  - `:545`/`:589`/`:632` **start-shopping trio** (shows button / disabled-when-empty / opens view) → **rewrite-for-new-DOM** (no separate shop mode; "open store" replaces it).
  - `:839` finish-shop visibility → **rewrite** (now `FinishShopBar`, Task 6).
  - Checkbox assertions (`:758`/`:768`, `:691`) read `(el as HTMLInputElement).checked` — see Task 5 Step 3: the new row keeps a **native checkbox input**, so `.checked`/`toBeChecked()` still work; rewrite only the surrounding queries that moved.
  - Run the file → PASS.
- [ ] **Step 10: `npx vitest run src/app/shopping-lists src/components/shopping-list/Working` → PASS. Commit** — `git commit -am "feat(shopping): two-pane working view + StoreSidebar (no modal)"`

---

### Task 5: `ShoppingItemRow` + `AddItemRow` (sortable, restyled)

**Files:**

- Create: `.../Working/ShoppingItemRow.tsx`, `.../Working/AddItemRow.tsx`
- Modify: `ShoppingListView.tsx` (use them); preserve `@dnd-kit` `DndContext`/`SortableContext` + `storeItemPositions` save (extract from inline `page.tsx:1344`).
- Test: `.../Working/__tests__/ShoppingItemRow.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ShoppingItemRow } from '../ShoppingItemRow';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

const item = { foodItemId: 'f1', name: 'shallots', quantity: 2, unit: 'each', checked: false };

describe('ShoppingItemRow', () => {
  it('renders name + quantity and an unchecked checkbox', () => {
    renderWithTheme(<ShoppingItemRow item={item} onToggle={() => {}} onEdit={() => {}} />);
    expect(screen.getByText('shallots')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /shallots/i })).not.toBeChecked();
  });
  it('calls onToggle when the checkbox is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderWithTheme(<ShoppingItemRow item={item} onToggle={onToggle} onEdit={() => {}} />);
    await user.click(screen.getByRole('checkbox', { name: /shallots/i }));
    expect(onToggle).toHaveBeenCalledWith('f1');
  });
  it('reflects the checked state on the checkbox when checked', () => {
    renderWithTheme(
      <ShoppingItemRow item={{ ...item, checked: true }} onToggle={() => {}} onEdit={() => {}} />
    );
    // Assert checked state via the reliable native-input semantics, not computed CSS.
    expect(screen.getByRole('checkbox', { name: /shallots/i })).toBeChecked();
    // Line-through is applied as an INLINE style on the name element (see Step 3) so toHaveStyle
    // resolves in jsdom (MUI sx→emotion classes don't always surface to computed style).
    expect(screen.getByText('shallots')).toHaveStyle({ textDecoration: 'line-through' });
  });
});
```

- [ ] **Step 2: Run → FAIL. Step 3: Implement `ShoppingItemRow.tsx`** — **use a real checkbox input** so native `.checked` / `toBeChecked()` semantics survive the `page.test.tsx` migration (the existing suite reads `(el as HTMLInputElement).checked` at `:758`/`:768`). Render a **visually-hidden `<input type="checkbox">`** (accessible name = item.name, `checked`/`onChange→onToggle(foodItemId)`) layered under a styled 22×22 visual box (radius `sm`(6); unchecked transparent `1.5px border.strong`; checked `bgcolor: primary` + `check` glyph `tokens.onAccent.shop`). Name 14.5–15/500 with **`style={{ textDecoration: checked ? 'line-through' : 'none' }}`** (inline, not sx) + row `opacity 0.55–0.6` when checked; qty/unit `text.muted` tabular; `drag_indicator` handle wired to `@dnd-kit` `useSortable` listeners; tap on body (not checkbox/handle) → `onEdit(item)`.
- [ ] **Step 4: Implement `AddItemRow.tsx`** — full-width `ButtonBase`, `1px dashed border.strong`, radius `xl`(12), `primary` text, `add` icon + "Add item"; `onClick`. (Add a trivial render+click test.)
- [ ] **Step 5: Run → PASS. Step 6: Commit** — `git commit -am "feat(shopping): sortable ShoppingItemRow + AddItemRow"`

---

### Task 6: `FinishShopBar` + `FinishShopConfirm` (C6)

**Covers spec §4 required case: finish-shop bar behavior.**

**Files:**

- Create: `.../Working/FinishShopBar.tsx`, `.../Working/FinishShopConfirm.tsx`
- Modify: `ShoppingListView.tsx` (render bar; open confirm; confirm → existing `finishShop` handler in `page.tsx:769`).
- Test: `.../Working/__tests__/FinishShopBar.test.tsx`, `.../FinishShopConfirm.test.tsx`

- [ ] **Step 1: Failing `FinishShopBar` test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FinishShopBar } from '../FinishShopBar';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

describe('FinishShopBar', () => {
  it('renders nothing when no items are in the cart', () => {
    const { container } = renderWithTheme(<FinishShopBar boughtCount={0} onFinish={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows the bought count and calls onFinish when clicked', async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    renderWithTheme(<FinishShopBar boughtCount={3} onFinish={onFinish} />);
    const btn = screen.getByRole('button', { name: /finish shop · 3 bought/i });
    await user.click(btn);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run → FAIL. Step 3: Implement `FinishShopBar.tsx`** — returns `null` when `boughtCount === 0`; else a solid bar (`bgcolor: surface.base`, `borderTop: 1px border.subtle`, hard edge no gradient), full-width (mobile h48) / right-aligned (desktop h46) button `bgcolor: primary` `color: onAccent.shop` radius `xl`(12), `done_all` + `Finish shop · {n} bought`.
- [ ] **Step 4: Failing `FinishShopConfirm` test** — `variant:'dialog'|'sheet'`, when `open` shows title "Finish this shop?", body with store name + bought/remaining counts, Cancel → `onCancel`, "Save trip" → `onConfirm`.

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FinishShopConfirm } from '../FinishShopConfirm';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

describe('FinishShopConfirm', () => {
  it('confirms the trip', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithTheme(
      <FinishShopConfirm
        open
        variant="dialog"
        storeName="Corner market"
        boughtCount={3}
        remainingCount={2}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText('Finish this shop?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save trip/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5: Run → FAIL. Implement `FinishShopConfirm.tsx`** — `variant='dialog'` → MUI `Dialog` (width 460, radius `xxxl`(16), `boxShadow: tokens.shadow.modal`); `variant='sheet'` → bottom `Drawer` (rounded top `tokens.radius.sheet`, grab handle, `tokens.shadow.sheet`). Same content: 56×56 accent-badge `done_all`, title display 22/700, body "{bought} items … saved to {storeName} … {remaining} items remain.", Cancel btnGhost + "Save trip" btnPrimary.
  - **Rationale (vs the existing `meal-plans/ConfirmDialog`):** a standalone component is warranted because the artboard confirm is bespoke — an **icon badge** above the title and a **mobile `Drawer` sheet variant** (`ConfirmDialog` is dialog-only, iconless). Reuse `ConfirmDialog`'s token vocabulary (dark `paper`, radius, button styles) so the two stay visually consistent; do **not** inflate `ConfirmDialog`'s API with shopping-specific props.
- [ ] **Step 6: Wire** — `ShoppingListView` renders `FinishShopBar` (mobile absolute / desktop sticky after sidebar); clicking opens `FinishShopConfirm` (`variant` by breakpoint via `useMediaQuery`); confirm calls the existing `handleClearCheckedItems`/`finishShop` flow unchanged.
- [ ] **Step 7: Run → PASS. Commit** — `git commit -am "feat(shopping): solid finish-shop bar + confirm (desktop dialog / mobile sheet)"`

---

### Task 7: `PresencePill` (C3 — all states, derived avatars)

**Files:**

- Create: `.../Presence/PresencePill.tsx`
- Modify: `ShoppingListView.tsx` (replace the two ad-hoc constructs at `page.tsx:1997` + `:2053` with one `PresencePill` fed by `useShoppingSync` outputs).
- Test: `.../Presence/__tests__/PresencePill.test.tsx`

- [ ] **Step 1: Failing test (renders each state from props; no API)**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PresencePill } from '../PresencePill';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

describe('PresencePill', () => {
  it('shows LIVE when connected and alone', () => {
    renderWithTheme(
      <PresencePill connectionState="connected" activeUsers={[]} onReconnect={() => {}} />
    );
    expect(screen.getByText(/live/i)).toBeInTheDocument();
  });
  it('shows one avatar when one other user is present', () => {
    renderWithTheme(
      <PresencePill
        connectionState="connected"
        activeUsers={[{ name: 'Sara Rose', email: 'sara@x.com' }]}
        onReconnect={() => {}}
      />
    );
    expect(screen.getByLabelText('Sara Rose')).toBeInTheDocument();
  });
  it('caps avatars at 3 and shows +N for the rest', () => {
    const users = ['A A', 'B B', 'C C', 'D D', 'E E'].map((n, i) => ({
      name: n,
      email: `${i}@x.com`,
    }));
    renderWithTheme(
      <PresencePill connectionState="connected" activeUsers={users} onReconnect={() => {}} />
    );
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
  it('shows CONNECTING while connecting', () => {
    renderWithTheme(
      <PresencePill connectionState="connecting" activeUsers={[]} onReconnect={() => {}} />
    );
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });
  it('is an actionable reconnect control when offline', async () => {
    const user = userEvent.setup();
    const onReconnect = vi.fn();
    renderWithTheme(
      <PresencePill connectionState="suspended" activeUsers={[]} onReconnect={onReconnect} />
    );
    await user.click(screen.getByText(/offline/i));
    expect(onReconnect).toHaveBeenCalled();
  });
  it('offers Retry on failure', () => {
    renderWithTheme(
      <PresencePill connectionState="failed" activeUsers={[]} onReconnect={() => {}} />
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL. Step 3: Implement `PresencePill.tsx`** — pill base (inline-flex, `bgcolor: surface.raised`, `1px border.subtle`, radius `pill`). Map `connectionState`: `connected`+0 others → "LIVE" + success dot; `connected`+others → stacked `PresenceAvatar`s (cap 3, `ring`, then `+N`) + success dot; `connecting`/`initialized` → "CONNECTING…" + warn dot (pulse); `disconnected`/`suspended`/`closing`/`closed` → "OFFLINE" + danger dot, tap → `onReconnect`, danger-tinted border/bg; `failed` → "SYNC FAILED" + Retry button (`bgcolor: state.danger`, `color: tokens.onDanger`) → `onReconnect`.
- [ ] **Step 4: Wire** — in `ShoppingListView`, render `PresencePill connectionState={sync.connectionState} activeUsers={sync.activeUsers} onReconnect={sync.reconnect}` (the page already excludes self from `activeUsers`). Delete the old inline pill + "Also viewing" row.
- [ ] **Step 5: Run → PASS. Commit** — `git commit -am "feat(shopping): unified presence pill (connection + multi-user)"`

---

### Task 8: `PantryCheckDialog` + KEEP/SKIP (C2)

**Covers spec §4 required case: KEEP/SKIP pantry-check filtering. Apply logic unchanged (skip = old check→drop).**

**Files:**

- Create: `.../PantryCheck/PantryCheckDialog.tsx` (uses `KeepSkipToggle` from Task 3)
- Modify: `page.tsx` — `handleOpenPantryCheck` (`:1186`) feeds matches in; `handleApplyPantryCheck` (`:1231`) consumes a `decisions: Record<foodItemId,'keep'|'skip'>` map, mapping `'skip'` to the existing drop path (identical to today's `checked===true`).
- Test: `.../PantryCheck/__tests__/PantryCheckDialog.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PantryCheckDialog } from '../PantryCheckDialog';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

const matches = [
  { foodItemId: 'f1', name: 'unsalted butter', listLabel: '1 lb on list' },
  { foodItemId: 'f2', name: 'parmesan', listLabel: '0.5 lb on list' },
];

describe('PantryCheckDialog (KEEP/SKIP filtering)', () => {
  it('defaults every match to KEEP', () => {
    renderWithTheme(
      <PantryCheckDialog open matches={matches} onApply={() => {}} onClose={() => {}} />
    );
    expect(
      screen
        .getAllByRole('button', { name: /keep/i })
        .every((b) => b.getAttribute('aria-pressed') === 'true')
    ).toBe(true);
  });
  it('applies with only the kept items (skipped ones drop off)', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderWithTheme(
      <PantryCheckDialog open matches={matches} onApply={onApply} onClose={() => {}} />
    );
    // Skip the first match (already have butter), keep parmesan.
    const skipButtons = screen.getAllByRole('button', { name: /skip/i });
    await user.click(skipButtons[0]);
    await user.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith({ f1: 'skip', f2: 'keep' });
  });
  it('tally pill reflects how many will drop off', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <PantryCheckDialog open matches={matches} onApply={() => {}} onClose={() => {}} />
    );
    await user.click(screen.getAllByRole('button', { name: /skip/i })[0]);
    expect(screen.getByText(/1 dropping off/i)).toBeInTheDocument();
    expect(screen.getByText(/1 still on list/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL. Step 3: Implement `PantryCheckDialog.tsx`** — desktop `Dialog` (width 560, radius 16, modal shadow) / mobile full-screen; pantry summary banner (`bgcolor: alpha(section.pantry,0.14)`, `1px ${pantry}44`, `kitchen` icon); tally pill (8×8 danger dot + "{skipped} dropping off · {kept} still on list"); per-match row carrying `KeepSkipToggle` (state defaults `'keep'`, skip → `dangerMuted` bg + name `text.muted`+line-through); Cancel + Apply (Apply → `onApply(decisions)`).
- [ ] **Step 4: Wire** `handleApplyPantryCheck` to treat `'skip'` exactly as the old "remove" branch (no new write logic). Migrate the old pantry-check assertions in `page.test.tsx`.
- [ ] **Step 5: Run → PASS. Commit** — `git commit -am "feat(shopping): pantry check KEEP/SKIP toggle"`

---

### Task 9: Restyle remaining dialogs + flat `EmojiPicker`

Each is an **extract-and-restyle** of existing behavior — rewrite each dialog's tests to the new DOM, keep the behavioral assertions, change no data logic.

**9a — flat `EmojiPicker` (reuse the Chunk-4 redesigned picker — do NOT rebuild from the legacy one).**

⚠️ **Chunk 4 already built a redesigned flat-grid picker:** `src/components/recipes/EmojiPicker.tsx` — `ButtonBase` cells, token styles, `aspect-ratio:1`, search, responsive `repeat(10/7,1fr)`, **named export**, `Dialog`+`Drawer` breakpoint split — and it imports the curated `FOOD_EMOJIS` data from the legacy `src/components/EmojiPicker.tsx`. The shop picker needs the **same component shape with the shop accent** instead of the recipe accent. **Preferred path:** generalize into a shared `src/components/ui/EmojiPicker.tsx` that takes an `accentColor`/`accentMuted` (default to `palette.primary` so each section's `SectionThemeProvider` supplies its accent), then point both recipes and shopping at it. **Fallback:** copy the recipes version with the shop accent. Either way, **convert the legacy default export to a named export** (CLAUDE.md: named exports only) and update its consumers.

- [ ] **Failing test** (named import; works for the shared `ui/EmojiPicker` or the restyled component):

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EmojiPicker } from '@/components/ui/EmojiPicker'; // shared (preferred); or '@/components/EmojiPicker' if restyled in place
import { renderWithTheme } from '@/test-utils/renderWithTheme';

describe('EmojiPicker (flat grid)', () => {
  it('filters by search and selects an emoji', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithTheme(<EmojiPicker open onClose={() => {}} onSelect={onSelect} />);
    await user.type(screen.getByPlaceholderText(/search emoji/i), 'carrot');
    await user.click(screen.getByRole('button', { name: /carrot/i }));
    expect(onSelect).toHaveBeenCalled();
  });
});
```

- [ ] **Implement:** keep curated `FOOD_EMOJIS` + search filter; flat token cells `display:grid; gridTemplateColumns: { xs:'repeat(7,1fr)', md:'repeat(10,1fr)' }; gap: 0.5`, each cell `aspect-ratio:1` radius `md`(8), selected → `bgcolor: accentDim` + `1px primary` (no raw `#1976d2`); each cell `role="button"` `aria-label={description}`. **Named export.** Files to update **in the same commit** (CI stays green):
  - `page.tsx:98` dynamic import — **named-export form is mandatory** or it silently renders null: `const EmojiPickerDialog = dynamic(() => import('@/components/ui/EmojiPicker').then((m) => m.EmojiPicker), { ssr: false });`.
  - `src/components/__tests__/EmojiPicker.test.tsx` — switch to the named import.
  - **`src/components/recipes/__tests__/EmojiPicker.test.tsx:20`** ⚠️ — when recipes is pointed at the shared component, its cell `aria-label` changes from `emoji <glyph>` to `{description}`; that test's `getAllByRole('button', { name: /emoji /i })` query then matches **zero** buttons. Update the query to a description form (e.g. a known `/carrot/i`, or filter out the search button) so it passes against the shared picker.
  - `src/components/recipes/RecipeEditor.tsx` (the recipes consumer) — import the shared `ui/EmojiPicker`, passing the recipes accent (default `palette.primary` already supplies it under the recipes `SectionThemeProvider`).
  - Run the recipes + shopping emoji tests → PASS. Commit.

**9b — `StoreEditorDialog`** (create/edit store; hosts the emoji preview + name field, opens `EmojiPicker`): extract from `page.tsx` create/edit-store dialogs; restyle to §3.5.

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StoreEditorDialog } from '../StoreEditorDialog';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

it('create flow submits the typed name + selected emoji', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  renderWithTheme(<StoreEditorDialog open mode="create" onSave={onSave} onClose={() => {}} />);
  await user.type(screen.getByLabelText(/name/i), 'Greenleaf');
  await user.click(screen.getByRole('button', { name: /create store/i }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Greenleaf' }));
});
```

(Plus an edit-mode test asserting `onSave` carries the edited name. The page wires `onSave`→`createStore`/`updateStore` — unchanged.) Commit.

**9c — `ItemEditorDialog`** (`src/components/shopping-list/ItemEditorDialog.tsx`): restyle to §3.6 (food field accent ring, qty stepper, edit-mode danger Remove) — props unchanged; existing tests (`ItemEditorDialog.test.tsx`) kept, updated only where DOM moved. Commit.

**9d — `ImportFromPlansDialog`**: extract from `page.tsx:2383`; restyle to §3.7 (RECENT PLANS, accent-selected rows, checkbox).

```tsx
it('imports the selected plans', async () => {
  const user = userEvent.setup();
  const onImport = vi.fn();
  renderWithTheme(
    <ImportFromPlansDialog
      open
      plans={[{ _id: 'p1', label: 'Week of May 25', itemCount: 14 }]}
      onImport={onImport}
      onClose={() => {}}
    />
  );
  await user.click(screen.getByRole('checkbox', { name: /Week of May 25/i }));
  await user.click(screen.getByRole('button', { name: /^import/i }));
  expect(onImport).toHaveBeenCalledWith(['p1']);
});
```

(Migrates the `page.test.tsx:335` meal-plan-selection case.) Commit.

**9e — `UnitConflictDialog`**: extract from `page.tsx:2466`; mobile bottom **sheet** / desktop modal; eyebrow "UNIT CONFLICT · n OF m", source rows, suggestion banner, qty+unit accent fields. Keep conversion/merge behavior unchanged.

```tsx
it('advances and rewinds the conflict index', async () => {
  const user = userEvent.setup();
  const onNext = vi.fn();
  renderWithTheme(
    <UnitConflictDialog
      open
      conflicts={[c1, c2, c3]}
      index={0}
      onNext={onNext}
      onBack={() => {}}
      {...rest}
    />
  );
  expect(screen.getByText(/1 of 3/i)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /next conflict/i }));
  expect(onNext).toHaveBeenCalled();
});
```

Commit.

**9f — `ShareStoreDialog`**: extract from `page.tsx:2598`; restyle to §3.7 (invite field, shared-with rows w/ `PresenceAvatar`-style 34px avatar + remove, pending dashed card). Keep invite/respond/remove handlers.

```tsx
it('focuses the email field on open and invites a typed address', async () => {
  const user = userEvent.setup();
  const onInvite = vi.fn();
  renderWithTheme(
    <ShareStoreDialog
      open
      storeName="Corner market"
      sharedWith={[]}
      pending={[]}
      onInvite={onInvite}
      onRemove={() => {}}
      onClose={() => {}}
    />
  );
  const field = screen.getByPlaceholderText(/name@example\.com/i);
  expect(field).toHaveFocus(); // migrates the auto-focus assertion
  await user.type(field, 'jamie@x.com');
  await user.click(screen.getByRole('button', { name: /^invite/i }));
  expect(onInvite).toHaveBeenCalledWith('jamie@x.com');
});
```

Commit.

**9g — `StoreHistoryDialog`** (`src/components/shopping-list/StoreHistoryDialog.tsx`, C7): restyle to redesign dialog vocab (dark `paper`, radius 16, modal shadow); behavior + existing tests unchanged. Commit.

---

### Task 10: `page.tsx` slim-down + actions menu

**Files:** Modify `src/app/shopping-lists/page.tsx`; create `.../Working/StoreActionsMenu.tsx` (mobile sheet of §3.7 + desktop `Menu`).

- [ ] Move the overflow `Menu` (`:2086`) + mobile actions into `StoreActionsMenu` (Import / Pantry check / Purchase history / Share / Rename / Delete), wired to existing handlers. Test: each row fires the right callback.
- [ ] Delete now-dead inline render code; ensure `page.tsx` is orchestration-only (state + data + composing the extracted components). Migrate any remaining `page.test.tsx` cases; ensure restore-from-URL (`:966`) and ignore-legacy-mode (`:1062`) pass.
- [ ] Replace raw hex (`#2e7d32`/`#1b5e20`/`#1976d2`, scrollbar rgba) with tokens/`palette.primary`. Commit — `git commit -am "refactor(shopping): slim page.tsx to orchestration + StoreActionsMenu"`

---

### Task 11: Full validation

- [ ] `npm run check` (lint + test:coverage + build) → green. Fix any fallout (flaky/shared-state) at root cause.
- [ ] Commit any fixes. Proceed to **Gate #2** (§6).

**Per-chunk test list (spec §4, must be covered):** store-pane ↔ working-list selection (Task 4); KEEP/SKIP pantry-check filtering (Task 8); finish-shop bar behavior (Task 6). Realtime/presence stays visual-only — presence-pill tests assert rendering from props only (Task 7).

**Ordering rule (spec §6 0e):** within each task, delete the old component's tests and add the replacement tests in the same commit — never ship an interactive component with stale tests.

---

## 6. Gate #2 (post-implementation) & close-out — reference

After implementation + `npm run check` green, **before `review-code`**:

- Produce `docs/superpowers/plans/redesign-chunk-05-shopping-lists-artboard-audit.md` — value-by-value vs §3 **and** live dual-breakpoint (desktop 1440 + ~430px, seeded data, **chrome-devtools-mcp** per the mobile-viewport memory) — with a disposition log (close vs keep-as-built). Close material/minor gaps in-chunk.
- Then: `review-code --base redesign-chunk-04` → `npm run check` → `manual-testing chunk-05-shopping-lists` → push → execute the checklist gate locally → tag `redesign-chunk-05` → update ledger → merge `main` → compact. (Spec §5 steps 2–12.)

---

## 7. Self-review notes

- **Spec §4 coverage:** two-pane desktop (Task 4), presence pill (Task 7), KEEP/SKIP toggle (Task 8), solid finish-shop bar (Task 6), flat emoji picker (Task 9). ✓
- **"Visual only, no API change":** every task restyles/extracts; no route handler, no util write-logic, no presence-payload change. The only non-component edit is additive tokens (§2). ✓
- **Per-chunk test list:** the three required cases are pinned to Tasks 4/8/6. ✓
- **Reuse:** `EmojiPicker` kept + restyled (not rebuilt); `@dnd-kit` reorder + positions preserved; `useShoppingSync`, all `shopping-list-utils`, pantry/finish handlers untouched. ✓
- **Decomposition:** the 2,885-line `page.tsx` is carved into ~20 focused components (Tasks 3–10); `page.tsx` ends as orchestration-only. ✓
- **Gate #1 concerns:** all resolved + folded as locked decisions (§4 / header).
- **Risk note:** the `page.test.tsx` migration (Tasks 4/8/9/10) is the highest-churn area — the existing suite is tightly coupled to the dialog DOM. Task 4 Step 9 now enumerates each load-bearing case with an explicit disposition (incl. the realtime `:691` and start-shopping `:545/:589/:632`), and Task 5 keeps a **native checkbox input** so legacy `.checked` assertions survive.
- **`/review-plan` round 1 (2026-05-30):** verdict REVISE → 4 Important + 6 Minor, all auto-revised. Applied: EmojiPicker named-export + reuse Chunk-4 `recipes/EmojiPicker` (new shared `ui/EmojiPicker`); `renderWithTheme` promoted to prerequisite **Task 3A** (shop-accent-bound, with sanity test); **Task 3B** added for the StoreListView index surface + invite banner with pinned tests; checkbox→native input + migration-assertion note; migration enumeration extended (realtime/start-shopping/index); `useShoppingSync` `enabled: selectedStore !== null` locked; `FinishShopConfirm` rationale vs `ConfirmDialog`; concrete test blocks for 9b/9d/9e/9f; line-through assertion hardened. Security: clean (no API/write-logic change holds).
- **`/review-plan` round 2 (2026-05-30):** all 8 round-1 findings confirmed resolved; code dimension clean. 3 new mechanical residuals applied: (Important) the shared `ui/EmojiPicker` `aria-label` change would break `recipes/__tests__/EmojiPicker.test.tsx:20` — now listed for same-commit update + the `next/dynamic` `.then(m => m.EmojiPicker)` form spelled out; (Minor) the realtime `:691` test stays a **page-level** test (hook is page-owned, not view-owned); (Minor) `stubHandlers()` names clarified as view-level (mapped down to row `onToggle`/`onEdit`). **→ VERDICT: PLAN READY.** Round-2 residuals were determinate doc edits with no design ambiguity, so the loop closed without a 3rd dispatch.
