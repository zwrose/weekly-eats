# Decisions: Smart Unit Deconfliction for Shopping List Meal Plan Population

## ADR-001: Use `convert` library (jonahsnider/convert) for unit conversion

**Date:** 2026-02-16
**Status:** Accepted

**Context:** Need a library to convert between volume and weight units when merging shopping list items from meal plans.

**Decision:** Use the `convert` npm package (jonahsnider/convert). It is lightweight (~4KB gzip), tree-shakeable, type-safe, and supports all needed volume (teaspoon through gallon, milliliter through liter) and weight (gram, kilogram, ounce, pound) units. It also provides a `to("best")` feature for picking human-readable units and `getMeasureKind()` for checking if units share a measurement family.

**Alternatives considered:**
- `convert-units` (convert-units/convert-units) — larger bundle, less type-safe
- Custom conversion tables — more maintenance burden, no `best` unit feature
- No library (manual ratios) — error-prone, incomplete

## ADR-002: Conversion scope limited to volume and weight families

**Date:** 2026-02-16
**Status:** Accepted

**Context:** Food units in the app span volume (cup, gallon, etc.), weight (ounce, pound, etc.), countable (can, bag, piece, etc.), and special combinations (pound bag, fluid ounce can, etc.).

**Decision:** Only convert within volume-to-volume and weight-to-weight. Countable units, size modifiers, container types, and special combinations are never auto-converted. Cross-family conversion (weight↔volume) is out of scope because it requires density data per food item.

## ADR-003: Pre-filled conflict dialog with human-readable best unit

**Date:** 2026-02-16
**Status:** Accepted

**Context:** When auto-converting, the result unit should be human-readable (not "2000 teaspoons").

**Decision:** Use the `convert` library's `to("best", "imperial")` to pick a unit where the quantity falls in a comfortable range. The user sees a pre-filled conflict dialog with the converted+summed value and can modify it before confirming. This gives intelligence without removing user control.
