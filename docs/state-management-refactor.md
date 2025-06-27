# State Management Refactor Guide

## Overview

This document outlines the state management refactor for the Weekly Eats application, designed to improve performance, maintainability, and code reusability.

## 🎯 Goals

1. **Reduce Component Complexity**: Extract data fetching and state management logic into reusable hooks
2. **Improve Performance**: Use React.memo and optimized components to prevent unnecessary re-renders
3. **Enhance Maintainability**: Centralize common patterns and reduce code duplication
4. **Better Error Handling**: Consistent error states and loading indicators
5. **Type Safety**: Full TypeScript support for all state management

## 📁 New File Structure

```
src/
├── lib/
│   ├── hooks/
│   │   ├── index.ts                 # Export all hooks
│   │   ├── use-food-items.ts        # Food items state management
│   │   ├── use-recipes.ts           # Recipes state management
│   │   ├── use-search-pagination.ts # Search and pagination logic
│   │   └── use-dialog.ts            # Dialog state management
│   └── context/
│       └── app-context.tsx          # Global app state (optional)
└── components/
    └── optimized/
        ├── SearchBar.tsx            # Optimized search component
        └── Pagination.tsx           # Optimized pagination component
```

## 🔧 Custom Hooks

### 1. useFoodItems

Manages food items state with caching and error handling.

```typescript
import { useFoodItems } from '@/lib/hooks';

function MyComponent() {
  const {
    foodItems,
    foodItemsMap,
    loading,
    error,
    refetch,
    addFoodItem
  } = useFoodItems();

  // Use the hook...
}
```

**Benefits:**
- Automatic caching of food items
- Efficient lookup map for food item names
- Consistent error handling
- Easy to add new food items to the cache

### 2. useRecipes

Manages recipes state with separate user and global recipe handling.

```typescript
import { useRecipes } from '@/lib/hooks';

function MyComponent() {
  const {
    userRecipes,
    globalRecipes,
    loading,
    userLoading,
    globalLoading,
    error,
    createRecipe,
    updateRecipe,
    deleteRecipe
  } = useRecipes();

  // Use the hook...
}
```

**Benefits:**
- Separate loading states for user and global recipes
- Built-in CRUD operations
- Automatic data refresh after mutations
- Consistent error handling

### 3. useSearchPagination

Generic hook for search and pagination functionality.

```typescript
import { useSearchPagination } from '@/lib/hooks';

function MyComponent() {
  const pagination = useSearchPagination({
    data: myData,
    itemsPerPage: 25,
    searchFields: ['title', 'description']
  });

  // Access: pagination.searchTerm, pagination.paginatedData, etc.
}
```

**Benefits:**
- Reusable across all list components
- Automatic pagination reset on search
- Flexible search configuration
- Memoized filtering and pagination

### 4. useDialog

Simple dialog state management.

```typescript
import { useDialog } from '@/lib/hooks';

function MyComponent() {
  const dialog = useDialog();

  return (
    <>
      <Button onClick={dialog.openDialog}>Open</Button>
      <Dialog open={dialog.open} onClose={dialog.closeDialog}>
        {/* Dialog content */}
      </Dialog>
    </>
  );
}
```

### 5. useConfirmDialog

Confirmation dialog with data passing.

```typescript
import { useConfirmDialog } from '@/lib/hooks';

function MyComponent() {
  const confirmDialog = useConfirmDialog<Recipe>();

  const handleDelete = (recipe: Recipe) => {
    confirmDialog.openDialog(recipe);
  };

  const handleConfirm = () => {
    if (confirmDialog.data) {
      deleteRecipe(confirmDialog.data._id);
      confirmDialog.closeDialog();
    }
  };

  return (
    <>
      <Dialog open={confirmDialog.open} onClose={confirmDialog.closeDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Delete {confirmDialog.data?.title}?
        </DialogContent>
        <DialogActions>
          <Button onClick={confirmDialog.cancel}>Cancel</Button>
          <Button onClick={handleConfirm} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
```

## 🚀 Optimized Components

### SearchBar

```typescript
import SearchBar from '@/components/optimized/SearchBar';

function MyComponent() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <SearchBar
      value={searchTerm}
      onChange={setSearchTerm}
      placeholder="Search items..."
    />
  );
}
```

**Features:**
- React.memo for performance
- Consistent styling
- Configurable placeholder
- Full-width option

### Pagination

```typescript
import Pagination from '@/components/optimized/Pagination';

function MyComponent() {
  const [page, setPage] = useState(1);
  const totalPages = 10;

  return (
    <Pagination
      count={totalPages}
      page={page}
      onChange={setPage}
      show={totalPages > 1}
    />
  );
}
```

**Features:**
- React.memo for performance
- Auto-hide when only one page
- Consistent styling
- Configurable visibility

## 🔄 Migration Guide

### Before (Current Pattern)

```typescript
export default function RecipesPage() {
  const [userRecipes, setUserRecipes] = useState<Recipe[]>([]);
  const [globalRecipes, setGlobalRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const loadRecipes = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadUserRecipes(),
        loadGlobalRecipes()
      ]);
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ... more state and effects
}
```

### After (Refactored Pattern)

```typescript
export default function RecipesPage() {
  const {
    userRecipes,
    globalRecipes,
    loading,
    createRecipe
  } = useRecipes();

  const userRecipesPagination = useSearchPagination({
    data: userRecipes,
    itemsPerPage: 25,
    searchFields: ['title']
  });

  const createDialog = useDialog();

  // Much cleaner and more focused!
}
```

## 📊 Performance Benefits

1. **Reduced Re-renders**: React.memo prevents unnecessary component updates
2. **Memoized Calculations**: useMemo for expensive operations like filtering
3. **Optimized Data Structures**: Pre-computed maps for efficient lookups
4. **Lazy Loading**: Components only load when needed
5. **Cached State**: Avoid redundant API calls

## 🛠 Implementation Steps

### Phase 1: Create Hooks (✅ Complete)
- [x] Create custom hooks in `src/lib/hooks/`
- [x] Add TypeScript types and error handling
- [x] Create optimized components

### Phase 2: Migrate Components
- [ ] Update `src/app/recipes/page.tsx`
- [ ] Update `src/app/food-items/page.tsx`
- [ ] Update `src/app/pantry/page.tsx`
- [ ] Update `src/app/meal-plans/page.tsx`
- [ ] Update `src/app/user-management/page.tsx`

### Phase 3: Add Global Context (Optional)
- [ ] Implement `AppProvider` in layout
- [ ] Add notification system
- [ ] Add sidebar state management

### Phase 4: Testing & Optimization
- [ ] Test all hooks with different scenarios
- [ ] Measure performance improvements
- [ ] Add error boundaries
- [ ] Optimize bundle size

## 🎨 Best Practices

1. **Use Hooks for Data**: Always use custom hooks for API calls and data management
2. **Optimize Components**: Use React.memo for list items and frequently re-rendered components
3. **Consistent Patterns**: Follow the same patterns across all pages
4. **Error Handling**: Always provide user-friendly error messages
5. **Loading States**: Show appropriate loading indicators
6. **Type Safety**: Use TypeScript for all new code

## 🔍 Example Usage

Here's how a typical page would look after refactoring:

```typescript
"use client";

import { useSession } from "next-auth/react";
import { 
  useRecipes, 
  useSearchPagination, 
  useDialog, 
  useConfirmDialog 
} from "@/lib/hooks";
import { SearchBar, Pagination } from "@/components/optimized";

export default function RecipesPage() {
  const { data: session } = useSession();
  
  // Data management
  const { userRecipes, loading, createRecipe, deleteRecipe } = useRecipes();
  
  // Search and pagination
  const pagination = useSearchPagination({
    data: userRecipes,
    searchFields: ['title']
  });
  
  // Dialog management
  const createDialog = useDialog();
  const deleteDialog = useConfirmDialog<Recipe>();
  
  // Event handlers
  const handleCreate = async (recipe: CreateRecipeRequest) => {
    await createRecipe(recipe);
    createDialog.closeDialog();
  };
  
  const handleDelete = async () => {
    if (deleteDialog.data) {
      await deleteRecipe(deleteDialog.data._id);
      deleteDialog.closeDialog();
    }
  };

  return (
    <Container>
      <SearchBar
        value={pagination.searchTerm}
        onChange={pagination.setSearchTerm}
      />
      
      {pagination.paginatedData.map(recipe => (
        <RecipeCard
          key={recipe._id}
          recipe={recipe}
          onDelete={() => deleteDialog.openDialog(recipe)}
        />
      ))}
      
      <Pagination
        count={pagination.totalPages}
        page={pagination.currentPage}
        onChange={pagination.setCurrentPage}
      />
    </Container>
  );
}
```

## 🎯 Next Steps

1. **Start with one page**: Choose a simple page to migrate first
2. **Test thoroughly**: Ensure all functionality works as expected
3. **Measure performance**: Use React DevTools to verify improvements
4. **Iterate**: Apply lessons learned to other pages
5. **Document**: Update this guide with any new patterns discovered

This refactor will significantly improve the maintainability and performance of your application while providing a consistent developer experience across all components. 