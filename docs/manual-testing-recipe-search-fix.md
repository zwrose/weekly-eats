# Manual Testing Guide: Recipe Search Fix

## What Was Fixed

The hook now correctly uses API search when recipes start as an empty array (`[]`) and `autoLoad` is `true`, instead of trying to filter an empty array locally.

## Where to Test

The fix affects components that use `IngredientInput`:
1. **Recipe Editing** - `/recipes` page
2. **Meal Plans** - Pages that use `MealEditor` component

## Testing Steps

### Test 1: Recipe Editing Page

1. **Navigate to Recipes page**
   - Go to `/recipes` in your browser
   - Open browser DevTools (F12)
   - Go to the **Network** tab
   - Filter by "Fetch/XHR" requests

2. **Create or Edit a Recipe**
   - Click "Create Recipe" or edit an existing recipe
   - This opens the recipe editor with ingredient inputs

3. **Test Immediate Typing (Before Recipes Load)**
   - **Immediately** after the page loads, click on a "Food Item or Recipe" input field
   - Start typing a recipe name (e.g., "apple" or "pie")
   - **Expected behavior**: Recipes should appear in the dropdown
   - **Check Network tab**: You should see a request to `/api/recipes?query=...` if recipes haven't loaded yet

4. **Test After Recipes Load**
   - Wait a few seconds for recipes to load
   - Type in the same field again
   - **Expected behavior**: Recipes should still appear (now using local filtering)
   - **Check Network tab**: You should NOT see a new API search request (local filtering is used)

### Test 2: Meal Plans Page

1. **Navigate to Meal Plans page**
   - Find the page that uses `MealEditor` component
   - Open browser DevTools (F12)
   - Go to the **Network** tab

2. **Add a Meal Item**
   - Click to add a new meal item
   - This should show an `IngredientInput` component

3. **Test Recipe Selection**
   - Click on the "Food Item or Recipe" input field
   - Type a recipe name
   - **Expected behavior**: Recipes should appear in the dropdown
   - **Check Network tab**: Verify API calls are made when needed

## What to Look For

### ✅ Success Indicators

1. **Recipes appear in dropdown** when typing, even immediately after page load
2. **No empty dropdown** when recipes haven't loaded yet
3. **Network requests** show `/api/recipes?query=...` calls when recipes are still loading
4. **No errors** in browser console

### ❌ Failure Indicators

1. **Empty dropdown** when typing before recipes load (old bug)
2. **No API search requests** when recipes are empty (means it's trying to filter empty array)
3. **Console errors** about filtering or search

## Browser Console Debugging

You can add temporary logging to see what's happening:

1. Open browser console
2. The hook should log search decisions (if you added the debug logging)
3. Look for messages showing:
   - `propRecipes: 'array(0)'` or `'array(X)'` 
   - `shouldUseLocalFiltering: true/false`
   - `autoLoad: true/false`

## Quick Test Scenario

**Fastest way to test:**
1. Open `/recipes` page
2. Click "Create Recipe" 
3. **Immediately** (within 1 second) click the first ingredient input
4. Type "apple" or any recipe name
5. **Expected**: Recipe suggestions appear
6. **If broken**: Dropdown is empty or shows "No options"

## Network Tab Verification

In the Network tab, you should see:
- Initial load: `/api/recipes?limit=1000` (loads all recipes)
- If typing before load completes: `/api/recipes?query=apple` (search API call)
- After recipes load: No new API calls when typing (uses local filtering)

## Notes

- The fix ensures that when `recipes = []` initially, the hook uses API search
- Once recipes are loaded, it switches to local filtering (faster)
- This prevents the "empty dropdown" bug when typing before recipes finish loading

