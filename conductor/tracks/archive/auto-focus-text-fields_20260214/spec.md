# Spec: Auto-focus text fields when they dynamically appear

## Overview

Improve UX by automatically focusing text fields when they become visible through user action (opening a dialog, toggling edit mode, expanding a section). This eliminates the extra tap/click required before the user can start typing.

## Functional Requirements

1. **EmojiPicker search field** (`EmojiPicker.tsx:228`) — Auto-focus the search TextField when the emoji picker dialog opens.

2. **Prep Instructions — IngredientInput** (`IngredientInput.tsx:281`) — Auto-focus the prep instructions TextField when the user clicks "Add prep instructions" to expand it.

3. **Prep Instructions — BaseIngredientInput** (`BaseIngredientInput.tsx:536`) — Same as above for the BaseIngredientInput variant.

4. **Create Recipe dialog — Recipe Title** (`recipes/page.tsx:1550`) — Auto-focus the Recipe Title TextField when the Create Recipe dialog opens.

5. **Edit Recipe dialog — Recipe Title** (`recipes/page.tsx:1693`) — Auto-focus the Recipe Title TextField when edit mode is toggled on.

6. **Skip reason — Meal Plans** (`meal-plans/page.tsx:1448`) — Auto-focus the skip reason TextField when "Skip this meal" checkbox is checked.

7. **Share Store dialog — Email Address** (`shopping-lists/page.tsx:2498`) — Auto-focus the email TextField when the Share Store dialog opens.

8. **Share Meal Plans dialog — Email Address** (`meal-plans/page.tsx:1911`) — Auto-focus the email TextField when the Share Meal Plans dialog opens.

9. **Share Recipes dialog — Email Address** (`recipes/page.tsx:2046`) — Auto-focus the email TextField when the Share Recipes dialog opens.

## Non-Functional Requirements

- Use the standard MUI `autoFocus` prop where applicable (dialog-contained fields).
- For conditionally rendered fields (prep instructions, skip reason), use `autoFocus` on the TextField or a `useEffect` + ref pattern if `autoFocus` doesn't trigger correctly on conditional render.
- No regressions to existing auto-focus behavior (store name dialogs, add food item, shopping list item editor, pantry item).

## Acceptance Criteria

- Each of the 9 listed fields receives keyboard focus automatically when it appears.
- No existing auto-focus behavior is broken.
- Mobile and desktop both work correctly.

## Out of Scope

- Food items edit mode fields (`food-items/page.tsx:629`)
- Page-level search bars (intentionally not auto-focused)
- Recipe instructions fields (secondary fields in dialogs)
