# Plan: View Recipe Details from Meal Plan UI

## Phase 1: Make Recipe Items Clickable in Meal Plan View Mode

- [ ] Task: Write tests for clickable recipe items in MealPlanViewDialog view mode
  - Test that recipe-type meal items render as clickable elements (link styling, role=button or anchor)
  - Test that food item and ingredient group items remain non-clickable
  - Test that recipe items in edit mode are NOT clickable
  - Test that clicking a recipe item triggers the recipe view handler
- [ ] Task: Make recipe-type meal items clickable in MealPlanViewDialog view mode
  - Wrap recipe-type items in a clickable element with link styling (cursor pointer, underline/color hint)
  - Add onClick handler that captures the recipe ID from `mealItem.id`
  - Only apply in view mode (not edit mode)
  - Non-recipe items remain plain text

## Phase 2: Integrate RecipeViewDialog into MealPlanViewDialog

- [ ] Task: Write tests for RecipeViewDialog integration in MealPlanViewDialog
  - Test that clicking a recipe item fetches recipe data and opens RecipeViewDialog
  - Test that RecipeViewDialog opens in read-only mode (no edit/delete buttons)
  - Test that closing RecipeViewDialog returns to the meal plan view (meal plan dialog stays open)
  - Test loading state while recipe data is being fetched
- [ ] Task: Add RecipeViewDialog as a second dialog in MealPlanViewDialog
  - Dynamically import RecipeViewDialog
  - Add state for selected recipe, recipe user data, and recipe dialog open/closed
  - On recipe click: fetch full recipe via `fetchRecipe()`, fetch user data via `fetchRecipeUserData()`, open dialog
  - Pass read-only props to RecipeViewDialog (editMode=false, stub edit callbacks as no-ops)
  - Show loading indicator while fetching
  - On close: clear selected recipe state, meal plan dialog remains open

## Phase 3: Add "Edit in Recipes" Navigation Link

- [ ] Task: Write tests for "Edit in Recipes" navigation from recipe dialog
  - Test that an "Edit in Recipes" button/link is visible in the read-only recipe dialog
  - Test that clicking it navigates to the recipes page with the recipe ID
- [ ] Task: Add "Edit in Recipes" button to RecipeViewDialog when opened in read-only context
  - Add an optional prop or condition to RecipeViewDialog to show an "Edit in Recipes" link
  - On click: use Next.js router to navigate to `/recipes?viewRecipe={recipeId}&editMode=true`
  - Close both the recipe dialog and meal plan dialog on navigation
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
