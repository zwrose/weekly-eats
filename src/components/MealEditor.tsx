'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Button, Typography, Alert, IconButton, Paper } from '@mui/material';
import { Group, Add, Delete } from '@mui/icons-material';
import { RecipeIngredientList, RecipeIngredient, FoodItemOption } from '../types/recipe';
import { InlineIngredientRow, CompactInput } from './ui';
import type { Recipe } from '@/lib/hooks/use-food-item-selector';

interface FoodItem {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
  isGlobal: boolean;
}

interface MealItem {
  type: 'foodItem' | 'recipe' | 'ingredientGroup';
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  ingredients?: RecipeIngredientList[];
}

interface MealEditorProps {
  mealItems: MealItem[];
  onChange: (items: MealItem[]) => void;
  onFoodItemAdded?: (newFoodItem: {
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
  }) => Promise<void>;
  removeItemButtonText?: string;
}

const columnHeadersSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  px: 0.5,
  mb: 0.5,
} as const;

const columnLabelSx = {
  fontSize: '0.6875rem',
  fontWeight: 500,
  color: 'text.secondary',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
} as const;

function ColumnHeaders() {
  return (
    <Box sx={columnHeadersSx}>
      <Box sx={{ flex: '1 1 55%', minWidth: 0 }}>
        <Typography sx={columnLabelSx}>Item</Typography>
      </Box>
      <Box sx={{ flex: '0 0 auto', width: { xs: 60, sm: 80 } }}>
        <Typography sx={columnLabelSx}>Qty</Typography>
      </Box>
      <Box sx={{ flex: '0 0 auto', width: { xs: 90, sm: 140 } }}>
        <Typography sx={columnLabelSx}>Unit</Typography>
      </Box>
      {/* Spacer for delete icon column */}
      <Box sx={{ flex: '0 0 auto', width: 32 }} />
    </Box>
  );
}

export default function MealEditor({
  mealItems,
  onChange,
  onFoodItemAdded,
}: MealEditorProps) {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState('');

  // Store the last created food item temporarily for auto-selection
  const lastCreatedFoodItemRef = useRef<FoodItem | null>(null);

  // Load food items and recipes on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [foodRes, recipeRes] = await Promise.all([
          fetch('/api/food-items?limit=1000'),
          fetch('/api/recipes?limit=1000'),
        ]);
        const foodItemsJson = foodRes.ok ? await foodRes.json() : { data: [] };
        const recipesJson = recipeRes.ok ? await recipeRes.json() : { data: [] };
        setFoodItems(Array.isArray(foodItemsJson) ? foodItemsJson : foodItemsJson.data || []);
        setRecipes(Array.isArray(recipesJson) ? recipesJson : recipesJson.data || []);
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };

    loadData();
  }, []);

  // Handle food item creation and update local state
  const handleFoodItemAdded = useCallback(
    async (
      newFoodItem:
        | FoodItem
        | {
            _id?: string;
            name: string;
            singularName: string;
            pluralName: string;
            unit: string;
            isGlobal: boolean;
          }
    ) => {
      if ('_id' in newFoodItem && newFoodItem._id) {
        setFoodItems((prev) => {
          const newItems = [...prev, newFoodItem as FoodItem];
          return newItems;
        });

        lastCreatedFoodItemRef.current = newFoodItem as FoodItem;
      }

      if (onFoodItemAdded) {
        await onFoodItemAdded(
          newFoodItem as {
            name: string;
            singularName: string;
            pluralName: string;
            unit: string;
            isGlobal: boolean;
          }
        );
      }
    },
    [onFoodItemAdded]
  );

  const handleAddMealItem = () => {
    const newItem: MealItem = {
      type: 'foodItem',
      id: '',
      name: '',
      quantity: 1,
      unit: 'cup',
    };
    onChange([...mealItems, newItem]);
  };

  const handleAddIngredientGroup = () => {
    const newItem: MealItem = {
      type: 'ingredientGroup',
      id: '',
      name: '',
      ingredients: [
        {
          title: '',
          ingredients: [],
        },
      ],
    };
    onChange([...mealItems, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = mealItems.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleItemChange = (index: number, updatedItem: MealItem) => {
    const newItems = [...mealItems];
    newItems[index] = updatedItem;
    onChange(newItems);
  };

  const handleIngredientGroupChange = (index: number, ingredients: RecipeIngredientList[]) => {
    const newItems = [...mealItems];
    if (newItems[index].type === 'ingredientGroup') {
      newItems[index] = {
        ...newItems[index],
        ingredients,
      };
      onChange(newItems);
    }
  };

  // Get all selected IDs for exclusion
  const getAllSelectedIds = () => {
    return mealItems.filter((item) => item.id && item.id.trim() !== '').map((item) => item.id);
  };

  // Convert FoodItem[] to FoodItemOption[] for InlineIngredientRow
  const foodItemOptions: FoodItemOption[] = foodItems.map((fi) => ({
    _id: fi._id,
    name: fi.name,
    singularName: fi.singularName,
    pluralName: fi.pluralName,
    unit: fi.unit,
  }));

  // Check if any regular (non-group) meal items exist for column headers
  const hasRegularItems = mealItems.some(
    (item) => item.type === 'foodItem' || item.type === 'recipe'
  );

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Column headers - shown above first regular item */}
      {hasRegularItems && <ColumnHeaders />}

      {/* Meal Items */}
      {mealItems.map((item, index) => (
        <Box key={index} sx={{ mb: item.type === 'ingredientGroup' ? 2 : 0 }}>
          {(item.type === 'foodItem' || item.type === 'recipe') && (
            <InlineIngredientRow
              ingredient={{
                type: item.type,
                id: item.id,
                quantity: item.quantity ?? 1,
                unit: item.type === 'foodItem' ? item.unit || 'cup' : undefined,
                name: item.name,
              }}
              autoFocus={!item.id || item.id.trim() === ''}
              onIngredientChange={(updatedIngredient) => {
                let itemName = updatedIngredient.name || '';

                if (updatedIngredient.id && (foodItems.length > 0 || recipes.length > 0)) {
                  const foodItem = foodItems.find((f) => f._id === updatedIngredient.id);
                  const recipe = recipes.find((r) => r._id === updatedIngredient.id);

                  if (foodItem) {
                    itemName =
                      updatedIngredient.quantity === 1
                        ? foodItem.singularName
                        : foodItem.pluralName;
                  } else if (recipe) {
                    itemName = recipe.title;
                  } else if (
                    lastCreatedFoodItemRef.current &&
                    lastCreatedFoodItemRef.current._id === updatedIngredient.id
                  ) {
                    itemName = lastCreatedFoodItemRef.current.name;
                    lastCreatedFoodItemRef.current = null;
                  }
                }

                handleItemChange(index, {
                  type: updatedIngredient.type,
                  id: updatedIngredient.id,
                  name: itemName,
                  quantity: updatedIngredient.quantity,
                  unit:
                    updatedIngredient.type === 'foodItem'
                      ? updatedIngredient.unit || 'cup'
                      : undefined,
                });
              }}
              onRemove={() => handleRemoveItem(index)}
              foodItems={foodItemOptions}
              recipes={recipes}
              onFoodItemAdded={handleFoodItemAdded}
              selectedIds={getAllSelectedIds().filter((id) => id !== item.id)}
              allowPrepInstructions={false}
            />
          )}

          {item.type === 'ingredientGroup' && item.ingredients && item.ingredients.length > 0 && (
            <Paper
              sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}
            >
              {/* Group title */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  mb: 2,
                }}
              >
                <Box sx={{ flex: 1, mr: 2 }}>
                  <CompactInput
                    placeholder="Group title (required)"
                    value={item.ingredients[0].title || ''}
                    onChange={(e) => {
                      const updatedGroup = {
                        ...item.ingredients![0],
                        title: e.target.value,
                      };
                      handleIngredientGroupChange(index, [updatedGroup]);
                    }}
                    required
                    error={!item.ingredients[0].title || item.ingredients[0].title.trim() === ''}
                    helperText={
                      !item.ingredients[0].title || item.ingredients[0].title.trim() === ''
                        ? 'Group title is required'
                        : ''
                    }
                  />
                </Box>
                <IconButton
                  onClick={() => handleRemoveItem(index)}
                  color="error"
                  size="small"
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    alignSelf: 'flex-start',
                  }}
                >
                  <Delete />
                </IconButton>
              </Box>

              {/* Group ingredients column headers */}
              {item.ingredients[0].ingredients.length > 0 && <ColumnHeaders />}

              {/* Group ingredients */}
              {item.ingredients[0].ingredients.map(
                (ingredient: RecipeIngredient, ingIndex: number) => (
                  <InlineIngredientRow
                    key={ingIndex}
                    ingredient={ingredient}
                    autoFocus={!ingredient.id || ingredient.id.trim() === ''}
                    onIngredientChange={(updatedIngredient) => {
                      const updatedGroup = { ...item.ingredients![0] };
                      updatedGroup.ingredients = updatedGroup.ingredients.map(
                        (ing: RecipeIngredient, i: number) =>
                          i === ingIndex ? updatedIngredient : ing
                      );
                      handleIngredientGroupChange(index, [updatedGroup]);
                    }}
                    onRemove={() => {
                      const updatedGroup = { ...item.ingredients![0] };
                      updatedGroup.ingredients = updatedGroup.ingredients.filter(
                        (_: RecipeIngredient, i: number) => i !== ingIndex
                      );
                      handleIngredientGroupChange(index, [updatedGroup]);
                    }}
                    foodItems={foodItemOptions}
                    recipes={recipes}
                    onFoodItemAdded={handleFoodItemAdded}
                    selectedIds={
                      item
                        .ingredients![0].ingredients.map((ing: RecipeIngredient) => ing.id)
                        .filter((id: string) => id !== '' && id !== ingredient.id)
                    }
                    allowPrepInstructions={false}
                  />
                )
              )}

              {/* Add ingredient to group */}
              <Button
                startIcon={<Add />}
                onClick={() => {
                  const updatedGroup = { ...item.ingredients![0] };
                  const newIngredient: RecipeIngredient = {
                    type: 'foodItem',
                    id: '',
                    quantity: 1,
                    unit: 'cup',
                  };
                  updatedGroup.ingredients = [...updatedGroup.ingredients, newIngredient];
                  handleIngredientGroupChange(index, [updatedGroup]);
                }}
                variant="text"
                size="small"
                sx={{ mt: 1 }}
              >
                Add Ingredient
              </Button>

              {item.ingredients[0].ingredients.length === 0 && (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={1}>
                  No ingredients in this group. Click &apos;Add Ingredient&apos; to begin.
                </Typography>
              )}

              {/* Mobile remove group button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  onClick={() => handleRemoveItem(index)}
                  color="error"
                  variant="outlined"
                  size="small"
                  startIcon={<Delete />}
                  sx={{
                    display: { xs: 'flex', sm: 'none' },
                    width: '100%',
                  }}
                >
                  Remove Group
                </Button>
              </Box>
            </Paper>
          )}
        </Box>
      ))}

      {mealItems.length === 0 && (
        <Typography variant="body2" color="text.secondary" textAlign="center" py={1}>
          Use the buttons below to add items.
        </Typography>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<Add />} onClick={handleAddMealItem} variant="text" size="small">
          Add Meal Item
        </Button>
        <Button
          startIcon={<Group />}
          onClick={handleAddIngredientGroup}
          variant="text"
          size="small"
        >
          Add Meal Item Group
        </Button>
      </Box>
    </Box>
  );
}
