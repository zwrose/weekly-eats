# Chunk 5 — Shopping Lists Artboard-Fidelity Audit (Gate #2)

Post-implementation fidelity pass per spec §5 step 2, run **before** `review-code`. Method: value-by-value (as-built code vs plan §3 exact-value spec) **+** live dual-breakpoint screenshots (desktop 1440 / mobile 430, seeded data, chrome-devtools-mcp, authenticated session on `:3235`). Source of truth: `redesign-chunk-05-shopping-lists-plan.md` §3 + `src/lib/design-tokens.ts`.

**Disposition key:** **CLOSE** = fix in this chunk (lands in the `review-code` diff). **KEEP** = recorded deviation, not re-litigated (with reason). Trivial sub-px/copy drifts are folded into the CLOSE batches where cheap, otherwise ignored.

---

## Live findings (the screenshots caught what code-read alone couldn't)

1. **🔴 Item rows are center-aligned (Material bug).** Both breakpoints: the checkbox sits hard-left, the drag handle hard-right, and the **name + qty float in the horizontal center** of the pane. Artboard §3.2 packs checkbox → name → qty on the left with the drag handle pushed right. This is the most visible defect. → **CLOSE.**
2. **🔴 No group-container box around the list (Material).** Unchecked items render directly on `surface.base` with no `paper` box (`1px border` + radius 12/14). Artboard wraps the unchecked group (and the checked "IN CART" group in `surface.sunken`) in bordered boxes. → **CLOSE.**
3. **List-pane + sidebar padding too small (Material).** Pane is `p:16` vs spec `24px 32px (110 bottom)`; sidebar lacks the `20px 14px` pad. → **CLOSE.**
4. **Desktop index search bar double-box glitch.** The 360px search wrapper shows a larger empty rounded rect beside the input (nested border/bg). → **CLOSE.**
5. **Mobile back-link is `text.secondary` gray; artboard "‹ Stores" is accent.** → **CLOSE (cheap).**
6. **Mobile working view keeps the app BottomNav.** Artboard's mobile shopping screen is immersive (no bottom nav; finish bar at bottom). The as-built working view is an _in-page_ master-detail (C1=A locked decision), so it lives inside `AuthenticatedLayout` which always shows BottomNav. → **KEEP** (direct consequence of the locked C1=A architecture; an immersive full-screen mode would require a route, which C1 deliberately avoided).
7. **Index rows keep 5 inline action icons** (Start Shopping / History / Share / Edit / Delete) instead of the artboard's single `chevron_right` (with those actions living in the in-store actions menu). → **KEEP** (Task 3B preserved direct one-click access from the index + the ~10 tests that pin it; the same actions are also in `StoreActionsMenu` inside the store. Recorded; revisit only if the user prefers the clean chevron row.)

---

## §3.1 — Store index — mostly compliant

- **CLOSE:** search-bar double-box (live #4); add the mobile "Your stores" section label; PendingInviteBanner desktop letter-spacing `0.10em` + Accept button → btnPrimary (currently `warn`-filled) + mobile 30×30 icon-button variant; subline accent-count treatment.
- **KEEP — no data (API change forbidden):** `lastShop` column/`· last shop` (not surfaced by the index query); desktop "with {names}" shared-member names; `inviterName` line; `StoreRow` shared icon size 16→14 (trivial, fold in).
- **MATCH:** grid `60px 1fr 140px 180px 140px 90px`, table/card surfaces, radii, emoji tiles, count colors, header labels.

## §3.2 — Working view — the main CLOSE target

- **CLOSE (Material):** item-row centering (#1); group-container boxes + "IN CART · {n}" checked-section label + desktop "Uncheck all" (#2); list-pane padding `24px 32px 110px` + sidebar `20px 14px` (#3); FinishShopBar `position:absolute` anchored to pane bottom (mobile `bottom:0` / desktop `left:280 bottom:0`).
- **CLOSE (Minor, cheap):** mobile store-name 28→**22**/`-0.02em` + desktop name `-0.025em`; mobile back-link → accent (#5); `ShoppingItemRow` row padding (`12px 14/18px`) + bottom hairline, name desktop 15, qty 11.5/12.5 (not 13), drag handle 18 (not 20), checked opacity mobile 0.6; FinishShopBar button text **15/700·14.5/700** (not 14/600) + pad `…22px` bottom; StoreActionsMenu mobile bottom-sheet variant + terser labels.
- **MATCH:** two-pane `280px 1fr`, StoreSidebar rows (active accentDim + border, sizes), checkbox 22×22 + check glyph, AddItemRow dashed, presence/LIVE pill placement.

## §3.3 — Presence pill — compliant, minor drifts

- **CLOSE (cheap):** Retry button radius 6→**999** (pill); pill pad → asymmetric `3px 10px 3px 3px`; stacked-avatar margin -6→`-4/-8`; OFFLINE border `dangerMuted`→`{danger}55`.
- **KEEP:** desktop 26px-avatar/7×7-dot list-header variant not built (single 20px variant used both breakpoints — acceptable, low value); connecting "pulse" animation omitted.
- **MATCH (adapted):** all 6 states, derived avatar color/initials (the §3.3 no-schema approach), +N cap.

## §3.4 — Pantry KEEP/SKIP — CLOSE the container styling

- **CLOSE (Material/Minor):** tally pill needs its **pill container** (bg `paper`/`paperHi`, `1px border`, radius 999, pad `6px 12px`) — currently a bare dot+text; match rows need keep-state fill (`paper`/`paperHi`) + the `1px border` (keep) / `1px {danger}55` (skip) + radius 12/10 (not 8); KeepSkipToggle outer bg fill (`paperHi`/`bg`); banner radius 12 (not 10) + `kitchen`@18.
- **KEEP:** mobile full-frame variant not built (centered Dialog used both breakpoints — functional; low value).
- **MATCH:** KeepSkipToggle segment colors/sizes (exact), default-KEEP, drop-on-skip logic, row name/sub.

## §3.5 — Flat emoji picker — compliant

- **CLOSE (cheap):** search field h38→40 + radius 10→12; body maxHeight 80vh→85vh.
- **MATCH:** flat grid `repeat(7/10,1fr)` gap4, aspect-1 cells radius 8, selected accentDim + `1px accent`, working search filter. (Preview/name card lives in `StoreEditorDialog`, audited there.)

## §3.6 / §3.7 — Dialogs — CLOSE the widths + key accents

- **CLOSE (Minor):** explicit dialog widths — ItemEditor **480**, Import **540**, UnitConflict **560**, Share **540** (all currently default ~600); UnitConflict suggestion banner → `accentDim` + `auto_fix_high` icon + "Suggested:" copy (currently green `successMuted`); UnitConflict title display20 (not 18); ItemEditor add explicit **Cancel** btnGhost in the footer; Import plan rows add `event_note@18` icon + name weight 700; ItemEditor qty/unit fractional grid `1fr 1.2/1.4fr`; UnitConflict mobile sheet `shadow.sheet`.
- **KEEP — no data:** Share shared-with shows email only (member display-name not in the invitation payload); Share pending uses StatusPill vs the warn `hourglass_empty` badge + "Cancel" text (cosmetic; low value — fold in if cheap).
- **MATCH:** dark dialog vocab (paper/radius16/modal shadow), accent-ring inputs, primary/danger buttons, StoreHistory (C7 restyle — no artboard).

## §3.8 — StatusBar faux chrome — **DROP** (done; never rendered). ✓

---

## CLOSE batches (ordered for the gap-fix pass)

**Batch A — Working view (highest visual impact):** item-row left-alignment (#1) + group-container boxes + IN-CART label + Uncheck-all (#2) + list-pane/sidebar padding (#3) + FinishShopBar absolute positioning & text weight + mobile name 22 + mobile back-link accent + row padding/sizes.

**Batch B — Pantry + Presence:** tally-pill container + match-row fills/borders/radius + KeepSkipToggle outer bg + banner radius/icon; PresencePill Retry radius + pad asymmetry + stacked margins + OFFLINE border.

**Batch C — Dialogs + Index:** explicit dialog widths (480/540/560/540); UnitConflict suggestion→accent + `auto_fix_high` + title 20; ItemEditor Cancel + qty/unit grid; Import row icon + weight; EmojiPicker search h40/radius12 + 85vh; index search double-box fix + "Your stores" mobile label + PendingInviteBanner Accept=primary + letter-spacing.

After CLOSE: re-screenshot both breakpoints (working view + a dialog + pantry) to confirm, then `review-code --base redesign-chunk-04`.

---

## Gate #2 — CLOSED (2026-05-30)

All three CLOSE batches landed + verified live (chrome-devtools-mcp, authenticated `:3235`, desktop 1440 + mobile 430, seeded data). 100 shopping tests + 158 across ui/recipes/shopping stayed green; eslint clean.

- **Batch A — `fa84873`** (working view): item rows now **left-aligned** (checkbox→name→qty packed left, drag handle `ml:auto`); **group-container boxes** (`surface.raised` unchecked / `surface.sunken` checked) with per-row hairlines + "IN CART · {n}" label; list-pane `24px 32px 110px` / sidebar `20px 14px`; **FinishShopBar absolute-anchored** (mobile `bottom:0` / desktop `left:280`) + text 15/700·14.5/700; store name responsive 22/28; mobile back-link → **accent**; row metrics (padding/sizes/qty/handle/opacity). _Omitted:_ desktop "Uncheck all" — no bulk-uncheck handler exists (would require inventing write logic; the "IN CART" label renders without it). **KEEP.**
- **Batch B — `73ea24a`** (pantry/presence): tally **pill container**; match-row keep-fill + skip-border + radius 12; KeepSkipToggle outer bg; PresencePill Retry radius→pill, asymmetric pad, stacked-avatar margins, OFFLINE border `{danger}55`.
- **Batch C — `6e05a17`** (dialogs/index): explicit dialog widths **480/540/560/540**; ItemEditor **Cancel** button added; UnitConflict suggestion banner → **accentDim + `auto_fix_high`** + title 20 + sheet shadow; Import row `event_note` icon + name 700; EmojiPicker search h40/radius12 + 85vh; **index search double-box fixed** (single bordered field) + mobile "Your stores" label; PendingInviteBanner Accept → **btnPrimary** + eyebrow `0.10em`.

**Live-verified:** index (clean single search field, accent counts, primary Add-store), two-pane working view at both breakpoints (left-aligned rows in group box, active-store sidebar highlight, LIVE pill, ⋮ actions, finish-bar lifecycle), Add-Item dialog (≈480 paper, accent-ring field, Cancel+Add footer).

**KEEP-as-built deviations (recorded; not re-litigated):**

1. Mobile working view retains the app **BottomNav** — direct consequence of the locked **C1=A in-page** architecture (an immersive full-screen shop mode would need a route).
2. Index rows keep **5 inline action icons** (Start/History/Share/Edit/Delete) vs the artboard's chevron — Task 3B preserved direct one-click access + the ~10 tests that pin them; the same actions also live in the in-store `StoreActionsMenu`. _(Revisit only if the clean chevron row is preferred.)_
3. **No-data fields** (API change forbidden): index `lastShop`, desktop "with {names}" / Share member display-names (email-only), `inviterName`; pantry per-row quantity-adjust dropped (binary KEEP/SKIP per artboard).
4. Desktop 26px presence-pill list-header variant + connecting-dot pulse animation not built (single 20px pill both breakpoints) — low value.

**→ Gate #2 done. Next: `review-code --base redesign-chunk-04`.**
