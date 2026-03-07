'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  IconButton,
  Paper,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogContent,
  DialogContentText,
} from '@mui/material';
import { Add, Delete, MoreVert } from '@mui/icons-material';
import { RecipeIngredientList, RecipeIngredient, FoodItemOption } from '../types/recipe';
import { InlineIngredientRow } from './ui/InlineIngredientRow';
import { CompactInput } from './ui/CompactInput';
import { DialogActions, DialogTitle } from './ui';
import { responsiveDialogStyle } from '@/lib/theme';
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
  const [groupMenuAnchor, setGroupMenuAnchor] = useState<null | HTMLElement>(null);
  const [groupMenuIndex, setGroupMenuIndex] = useState<number | null>(null);
  const [removeGroupConfirm, setRemoveGroupConfirm] = useState<number | null>(null);

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
          {ingredients[0].ingredients.map((ingredient, index) => (
            <InlineIngredientRow
              key={index}
              index={index}
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
                  mb: 1.5,
                  pb: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ flex: 1, mr: 1 }}>
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
                {/* Desktop: delete icon */}
                <IconButton
                  onClick={() => setRemoveGroupConfirm(groupIndex)}
                  color="error"
                  size="small"
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    alignSelf: 'flex-start',
                  }}
                >
                  <Delete />
                </IconButton>
                {/* Mobile: kebab menu */}
                <IconButton
                  onClick={(e) => {
                    setGroupMenuAnchor(e.currentTarget);
                    setGroupMenuIndex(groupIndex);
                  }}
                  size="small"
                  sx={{
                    display: { xs: 'flex', sm: 'none' },
                    color: 'text.secondary',
                    width: 28,
                    height: 28,
                  }}
                  aria-label="Group options"
                >
                  <MoreVert sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>

              {group.ingredients.map((ingredient, ingredientIndex) => (
                <InlineIngredientRow
                  key={ingredientIndex}
                  index={ingredientIndex}
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

          {/* Mobile group kebab menu */}
          <Menu
            anchorEl={groupMenuAnchor}
            open={Boolean(groupMenuAnchor)}
            onClose={() => {
              setGroupMenuAnchor(null);
              setGroupMenuIndex(null);
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem
              onClick={() => {
                setGroupMenuAnchor(null);
                if (groupMenuIndex !== null) setRemoveGroupConfirm(groupMenuIndex);
                setGroupMenuIndex(null);
              }}
              dense
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <Delete fontSize="small" sx={{ color: 'error.main' }} />
              </ListItemIcon>
              <ListItemText>Remove group</ListItemText>
            </MenuItem>
          </Menu>

          {/* Remove group confirmation dialog */}
          <Dialog
            open={removeGroupConfirm !== null}
            onClose={() => setRemoveGroupConfirm(null)}
            sx={responsiveDialogStyle}
          >
            <DialogTitle onClose={() => setRemoveGroupConfirm(null)}>Remove Group</DialogTitle>
            <DialogContent sx={{ flex: '1 1 auto' }}>
              <DialogContentText>
                {removeGroupConfirm !== null &&
                ingredients[removeGroupConfirm]?.ingredients.length > 0
                  ? `This will remove the group "${ingredients[removeGroupConfirm]?.title || 'Untitled'}" and its ${ingredients[removeGroupConfirm]?.ingredients.length} ingredient(s). This cannot be undone.`
                  : `Remove the group "${removeGroupConfirm !== null ? ingredients[removeGroupConfirm]?.title || 'Untitled' : ''}"?`}
              </DialogContentText>
            </DialogContent>
            <DialogActions primaryButtonIndex={1} sx={{ mt: 'auto' }}>
              <Button onClick={() => setRemoveGroupConfirm(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (removeGroupConfirm !== null) handleRemoveGroup(removeGroupConfirm);
                  setRemoveGroupConfirm(null);
                }}
                color="error"
                variant="contained"
              >
                Remove
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </Box>
  );
}
