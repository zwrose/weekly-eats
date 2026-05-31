# Meal-plan edit flow — locked decisions

Shell: **B3** — full-screen editor, numpad qty, sticky combined search at bottom, flat group headers (no nesting box).

Open questions resolved as we go:
1. Validation feedback: **B** — Done disabled + inline warn borders + helper text. No banner.
2. Cancel with unsaved changes: **B** — confirm dialog ("Discard changes?") only if dirty; clean cancel closes immediately.
3. Per-meal notes: **A** — drop. No UI, schema field untouched.
4. Recipe ×qty wording: **C** — `[× 2]` inside the chip. No outside label.
5. Skip toggle: **C** — always available; toggling on with items present prompts a confirm dialog ("Skip will clear N items"); toggling off leaves the meal empty.
6. Empty-group state: **A** — helper text "No ingredients in this group" + faint "+ Add ingredient" button. Same treatment for empty meal body (no items, skip off): "No items planned" + faint Add hint pointing at sticky search.
7. _pending_
7. Remove-group affordance: **B** — ✕ icon in the group header; tapping it opens a small confirm dialog ("Remove group? N items will be removed.") with Cancel / Remove.
8. High-density group container: **A** — flat section headers always. Group title is a labeled row, items follow as siblings of the meal's other items. No enclosing box.
