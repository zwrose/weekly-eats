# Spec: View Recipe Details from Meal Plan UI

## Overview

Add the ability to open a recipe's full detail view directly from the meal plan view mode. When a user is viewing a meal plan and sees a recipe listed as a meal item, they can click on it to open the recipe in a read-only modal overlay without leaving the meal plan. An "Edit in Recipes" link provides a path to the recipes page for full editing.

## Functional Requirements

1. **Clickable recipe items in view mode**: In `MealPlanViewDialog` view mode, meal items with `type === 'recipe'` become clickable (visually styled as links with cursor pointer).
2. **Recipe detail modal**: Clicking a recipe opens `RecipeViewDialog` as a second dialog layered on top of the meal plan dialog.
3. **View-only mode**: The `RecipeViewDialog` opens in read-only mode — no edit toggle, no delete button. Tags and ratings are still visible.
4. **"Edit in Recipes" link**: A button/link in the recipe dialog navigates the user to the recipes page with that recipe selected for editing, closing the meal plan dialogs.
5. **Data fetching on click**: The full recipe and user data are fetched on demand when the user clicks (using existing `fetchRecipe` and `fetchRecipeUserData` utilities).
6. **Scope limited to view mode**: Recipe items are only clickable in the meal plan's view mode, not in edit mode.

## Non-Functional Requirements

- Reuse the existing `RecipeViewDialog` component — no new dialog component.
- Dynamic import `RecipeViewDialog` in `MealPlanViewDialog` to avoid bundle bloat.
- Maintain existing meal plan dialog behavior (closing recipe dialog returns to meal plan view).
- Keep integration minimal by stubbing edit-related props as no-ops.

## Acceptance Criteria

- [ ] Recipe-type meal items in meal plan view mode are visually distinct (link styling, cursor pointer).
- [ ] Clicking a recipe item opens `RecipeViewDialog` with the correct recipe loaded.
- [ ] User can view ingredients, instructions, tags, and ratings.
- [ ] RecipeViewDialog is read-only — no edit or delete buttons visible.
- [ ] An "Edit in Recipes" link/button navigates to the recipes page for full editing.
- [ ] Closing the recipe dialog returns to the meal plan view dialog (meal plan remains open).
- [ ] Non-recipe meal items (food items, ingredient groups) are not clickable.
- [ ] Edit mode of the meal plan does not show clickable recipes.

## Out of Scope

- Full recipe editing from within the meal plan dialog.
- Recipe quick-preview/tooltip on hover.
- Deep linking to a specific recipe from a meal plan URL.
- Opening food item details from the meal plan view.
