'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Typography, Alert, IconButton, Paper } from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { RecipeIngredientList, RecipeIngredient, FoodItemOption } from '../types/recipe';
import { InlineIngredientRow } from './ui/InlineIngredientRow';
import { CompactInput } from './ui/CompactInput';
import type { Recipe } from '@/lib/hooks/use-food-item-selector';

interface RecipeIngredientsProps {
  ingredients: RecipeIngredientList[];
  onChange: (ingredients: RecipeIngredientList[]) => void;
  foodItems?: FoodItemOption[];
  onFoodItemAdded?: (newFoodItem: {
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
  }) => Promise<void>;
  // Custom text overrides
  addIngredientButtonText?: string;
  addIngredientGroupButtonText?: string;
  emptyGroupText?: string;
  emptyNoGroupsText?: string;
  removeIngredientButtonText?: string;
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
      {/* Spacer for prep + delete icon columns */}
      <Box sx={{ flex: '0 0 auto', width: 60 }} />
    </Box>
  );
}

export default function RecipeIngredients({
  ingredients,
  onChange,
  foodItems,
  onFoodItemAdded,
  addIngredientButtonText = 'Add Ingredient',
  addIngredientGroupButtonText = 'Add Ingredient Group',
  emptyGroupText = 'No ingredients in this group. Click "Add Ingredient" to get started.',
  emptyNoGroupsText = 'No ingredients added yet. Click "Add Ingredient" to get started.',
}: RecipeIngredientsProps) {
  const [error, setError] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  // Load recipes once for all ingredient rows
  const loadRecipes = useCallback(async () => {
    try {
      const recipeRes = await fetch('/api/recipes?limit=1000');
      const recipesJson = recipeRes.ok ? await recipeRes.json() : { data: [] };
      setRecipes(Array.isArray(recipesJson) ? recipesJson : recipesJson.data || []);
    } catch (err) {
      console.error('Error loading recipes:', err);
    }
  }, []);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  // Ensure we always have at least one group or standalone ingredients
  useEffect(() => {
    if (ingredients.length === 0) {
      // Create a standalone group by default
      const newStandaloneGroup: RecipeIngredientList & { isStandalone?: boolean } = {
        title: '', // Empty title indicates standalone
        ingredients: [],
        isStandalone: true,
      };
      onChange([newStandaloneGroup]);
    }
  }, [ingredients.length, onChange]);

  // Handle the case where ingredients is empty during initial render
  if (ingredients.length === 0) {
    return (
      <Box>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        <Box>
          <Button
            startIcon={<Add />}
            onClick={() => {
              const newStandaloneGroup: RecipeIngredientList & { isStandalone?: boolean } = {
                title: '',
                ingredients: [],
                isStandalone: true,
              };
              onChange([newStandaloneGroup]);
            }}
            variant="text"
            size="small"
            sx={{ mt: 1 }}
          >
            {addIngredientButtonText}
          </Button>
          <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
            {emptyNoGroupsText}
          </Typography>
        </Box>
      </Box>
    );
  }

  // Check if we're in standalone mode (single group with empty title and isStandalone flag)
  const isStandaloneMode =
    ingredients.length === 1 &&
    ingredients[0].title === '' &&
    (ingredients[0] as RecipeIngredientList & { isStandalone?: boolean }).isStandalone;

  const handleAddIngredient = () => {
    if (isStandaloneMode) {
      // Add to the standalone group
      const newIngredient: RecipeIngredient = {
        type: 'foodItem',
        id: '',
        quantity: 1,
        unit: 'cup',
      };
      const updatedIngredients = [...ingredients];
      updatedIngredients[0] = {
        ...updatedIngredients[0],
        ingredients: [...updatedIngredients[0].ingredients, newIngredient],
      };
      onChange(updatedIngredients);
    } else {
      // Add to the first group (or create a new one if none exist)
      const newIngredient: RecipeIngredient = {
        type: 'foodItem',
        id: '',
        quantity: 1,
        unit: 'cup',
      };
      if (ingredients.length === 0) {
        onChange([
          {
            title: '',
            ingredients: [newIngredient],
          },
        ]);
      } else {
        const updatedIngredients = [...ingredients];
        updatedIngredients[0] = {
          ...updatedIngredients[0],
          ingredients: [...updatedIngredients[0].ingredients, newIngredient],
        };
        onChange(updatedIngredients);
      }
    }
  };

  const handleAddIngredientToGroup = (groupIndex: number) => {
    const newIngredient: RecipeIngredient = {
      type: 'foodItem',
      id: '',
      quantity: 1,
      unit: 'cup',
    };
    const updatedIngredients = [...ingredients];
    updatedIngredients[groupIndex] = {
      ...updatedIngredients[groupIndex],
      ingredients: [...updatedIngredients[groupIndex].ingredients, newIngredient],
    };
    onChange(updatedIngredients);
  };

  const handleAddGroup = () => {
    const newGroup: RecipeIngredientList = {
      title: '',
      ingredients: [],
    };
    onChange([...ingredients, newGroup]);
  };

  const handleConvertToGroups = () => {
    if (isStandaloneMode) {
      if (ingredients[0].ingredients.length > 0) {
        // Convert standalone ingredients to groups
        const groups: RecipeIngredientList[] = ingredients[0].ingredients.map(
          (ingredient, index) => ({
            title: `Group ${index + 1}`,
            ingredients: [ingredient],
          })
        );
        onChange(groups);
      } else {
        // Convert to empty group mode
        const emptyGroup: RecipeIngredientList = {
          title: '',
          ingredients: [],
        };
        onChange([emptyGroup]);
      }
    }
  };

  const handleRemoveGroup = (groupIndex: number) => {
    const newIngredients = ingredients.filter((_, index) => index !== groupIndex);
    onChange(newIngredients);
  };

  const handleGroupTitleChange = (groupIndex: number, title: string) => {
    const newIngredients = [...ingredients];
    newIngredients[groupIndex] = { ...newIngredients[groupIndex], title };
    onChange(newIngredients);
  };

  const handleIngredientChange = (
    groupIndex: number,
    ingredientIndex: number,
    updatedIngredient: RecipeIngredient
  ) => {
    const newIngredients = [...ingredients];
    newIngredients[groupIndex] = {
      ...newIngredients[groupIndex],
      ingredients: newIngredients[groupIndex].ingredients.map((ing, i) =>
        i === ingredientIndex ? updatedIngredient : ing
      ),
    };
    onChange(newIngredients);
  };

  const handleRemoveIngredient = (groupIndex: number, ingredientIndex: number) => {
    const newIngredients = [...ingredients];
    newIngredients[groupIndex] = {
      ...newIngredients[groupIndex],
      ingredients: newIngredients[groupIndex].ingredients.filter((_, i) => i !== ingredientIndex),
    };
    onChange(newIngredients);
  };

  const getAllSelectedIds = (): string[] => {
    return ingredients.flatMap((group) =>
      group.ingredients.map((ingredient) => ingredient.id).filter((id) => id !== '')
    );
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {isStandaloneMode ? (
        // Standalone mode - single group without title
        <Box>
          {ingredients[0].ingredients.length > 0 && <ColumnHeaders />}

          {ingredients[0].ingredients.map((ingredient, index) => (
            <InlineIngredientRow
              key={index}
              ingredient={ingredient}
              autoFocus={!ingredient.id || ingredient.id.trim() === ''}
              onIngredientChange={(updatedIngredient) => {
                handleIngredientChange(0, index, updatedIngredient);
              }}
              onRemove={() => {
                handleRemoveIngredient(0, index);
              }}
              foodItems={foodItems}
              recipes={recipes}
              onFoodItemAdded={onFoodItemAdded}
              selectedIds={getAllSelectedIds().filter((id) => id !== ingredient.id)}
            />
          ))}

          <Button
            startIcon={<Add />}
            onClick={handleAddIngredient}
            variant="text"
            size="small"
            sx={{
              mt: 1,
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            {addIngredientButtonText}
          </Button>

          {ingredients[0].ingredients.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              {emptyGroupText}
            </Typography>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 2 }}>
            <Button onClick={handleConvertToGroups} variant="text" size="small">
              Convert to Groups
            </Button>
          </Box>
        </Box>
      ) : (
        // Group mode - multiple groups with titles
        <Box>
          {ingredients.map((group, groupIndex) => (
            <Paper
              key={groupIndex}
              sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}
            >
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
                    value={group.title || ''}
                    onChange={(e) => handleGroupTitleChange(groupIndex, e.target.value)}
                    required
                    error={!group.title || group.title.trim() === ''}
                    helperText={
                      !group.title || group.title.trim() === '' ? 'Group title is required' : ''
                    }
                  />
                </Box>
                <IconButton
                  onClick={() => handleRemoveGroup(groupIndex)}
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

              {group.ingredients.length > 0 && <ColumnHeaders />}

              {group.ingredients.map((ingredient, ingredientIndex) => (
                <InlineIngredientRow
                  key={ingredientIndex}
                  ingredient={ingredient}
                  autoFocus={!ingredient.id || ingredient.id.trim() === ''}
                  onIngredientChange={(updatedIngredient) =>
                    handleIngredientChange(groupIndex, ingredientIndex, updatedIngredient)
                  }
                  onRemove={() => handleRemoveIngredient(groupIndex, ingredientIndex)}
                  foodItems={foodItems}
                  recipes={recipes}
                  onFoodItemAdded={onFoodItemAdded}
                  selectedIds={getAllSelectedIds().filter((id) => id !== ingredient.id)}
                />
              ))}

              <Button
                startIcon={<Add />}
                onClick={() => handleAddIngredientToGroup(groupIndex)}
                variant="text"
                size="small"
                sx={{
                  mt: 1,
                  width: { xs: '100%', sm: 'auto' },
                }}
              >
                {addIngredientButtonText}
              </Button>

              {group.ingredients.length === 0 && (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                  {emptyGroupText}
                </Typography>
              )}

              {/* Mobile remove group button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  onClick={() => handleRemoveGroup(groupIndex)}
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
          ))}

          {ingredients.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              {emptyNoGroupsText}
            </Typography>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 2 }}>
            <Button onClick={handleAddGroup} variant="text" size="small">
              {addIngredientGroupButtonText}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
