# Modal State Persistence

This document explains how to implement modal state persistence through browser refreshes using URL search parameters.

## Overview

The modal persistence system allows modals to maintain their state (open/closed, data, edit mode, etc.) when users refresh the browser or navigate back/forward. This is implemented using URL search parameters to store modal state.

## Basic Usage

### 1. Import the Hook

```typescript
import { usePersistentDialog } from '@/lib/hooks';
```

### 2. Replace Regular Dialog with Persistent Dialog

```typescript
// Before
const viewDialog = useDialog();

// After
const viewDialog = usePersistentDialog('viewRecipe');
```

### 3. Open Dialog with Data

```typescript
// Open dialog with data that will be persisted in URL
viewDialog.openDialog({ 
  recipeId: recipe._id,
  editMode: 'true' 
});
```

### 4. Handle Persisted Data on Load

```typescript
useEffect(() => {
  if (viewDialog.open && viewDialog.data?.recipeId && !selectedRecipe) {
    // Find the recipe in your data
    const recipe = recipes.find(r => r._id === viewDialog.data?.recipeId);
    if (recipe) {
      handleViewRecipe(recipe);
    }
  }
  
  // Handle additional persisted data (like edit mode)
  if (viewDialog.open && viewDialog.data?.editMode === 'true' && selectedRecipe && !editMode) {
    setEditMode(true);
    // Set up edit form data
  }
}, [viewDialog.open, viewDialog.data, selectedRecipe, recipes, editMode]);
```

## URL Structure

The system creates URLs like:
- `?viewRecipe=true&viewRecipe_recipeId=123&viewRecipe_editMode=true`

This allows the modal state to be:
- Bookmarkable
- Shareable
- Preserved on browser refresh
- Restored on back/forward navigation

## Available Hooks

### Generic Persistent Dialog
```typescript
const dialog = usePersistentDialog('dialogKey');
```

### Pre-configured Hooks
```typescript
const recipeModal = useRecipeModal();        // Uses 'recipe' key
const foodItemModal = useFoodItemModal();    // Uses 'foodItem' key
const mealPlanModal = useMealPlanModal();    // Uses 'mealPlan' key
```

### Helper Function
```typescript
import { createDialogKey } from '@/lib/hooks';

const dialogKey = createDialogKey('recipe', 'view'); // Creates 'recipe_view'
```

## Implementation Example

Here's a complete example for a recipe view/edit modal:

```typescript
import { usePersistentDialog } from '@/lib/hooks';

export default function RecipesPage() {
  const viewDialog = usePersistentDialog('viewRecipe');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Handle persistent dialog data on load
  useEffect(() => {
    if (viewDialog.open && viewDialog.data?.recipeId && !selectedRecipe) {
      const recipe = recipes.find(r => r._id === viewDialog.data?.recipeId);
      if (recipe) {
        handleViewRecipe(recipe);
      }
    }
    
    // Handle edit mode persistence
    if (viewDialog.open && viewDialog.data?.editMode === 'true' && selectedRecipe && !editMode) {
      setEditMode(true);
      setEditingRecipe({
        title: selectedRecipe.title,
        // ... other fields
      });
    }
  }, [viewDialog.open, viewDialog.data, selectedRecipe, recipes, editMode]);

  const handleViewRecipe = async (recipe: Recipe) => {
    const fullRecipe = await fetchRecipe(recipe._id!);
    setSelectedRecipe(fullRecipe);
    viewDialog.openDialog({ recipeId: recipe._id! });
  };

  const handleEditRecipe = () => {
    setEditMode(true);
    viewDialog.openDialog({ 
      recipeId: selectedRecipe._id!,
      editMode: 'true'
    });
  };

  const handleCloseDialog = () => {
    viewDialog.closeDialog();
    setSelectedRecipe(null);
    setEditMode(false);
  };

  return (
    <Dialog open={viewDialog.open} onClose={handleCloseDialog}>
      {/* Dialog content */}
    </Dialog>
  );
}
```

## Best Practices

1. **Use descriptive dialog keys** that won't conflict with other modals
2. **Handle loading states** when restoring data from URL
3. **Validate persisted data** before using it
4. **Clean up URL parameters** when closing dialogs
5. **Consider data size** - don't store large objects in URL parameters

## Migration Guide

To migrate existing modals:

1. Replace `useDialog()` with `usePersistentDialog('uniqueKey')`
2. Update `openDialog()` calls to include data: `openDialog({ id: '123' })`
3. Add useEffect to handle persisted data on component load
4. Test browser refresh and navigation behavior

## Limitations

- URL parameters have length limits (typically 2048 characters)
- Only string values can be stored in URL parameters
- Complex objects need to be serialized/deserialized
- Browser history will include modal state changes
