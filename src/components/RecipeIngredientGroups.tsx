"use client";

import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  Button,
  Alert,
} from '@mui/material';
import { Delete, Add, AddCircle } from '@mui/icons-material';
import { RecipeIngredient, RecipeIngredientList } from '../types/recipe';
import BaseIngredientInput from './BaseIngredientInput';

interface RecipeIngredientGroupsProps {
  ingredients: RecipeIngredientList[];
  onChange: (ingredients: RecipeIngredientList[]) => void;
  foodItems?: Array<{_id: string, name: string, singularName: string, pluralName: string, unit: string}>;
  onFoodItemAdded?: (newFoodItem: {_id: string, name: string, singularName: string, pluralName: string, unit: string}) => void;
  currentRecipeId?: string;
  // Custom text overrides
  addIngredientButtonText?: string;
  addIngredientGroupButtonText?: string;
  emptyGroupText?: string;
  emptyNoGroupsText?: string;
}

export default function RecipeIngredientGroups({ 
  ingredients, 
  onChange, 
  foodItems,
  onFoodItemAdded, 
  currentRecipeId,
  addIngredientButtonText = "Add Ingredient",
  addIngredientGroupButtonText = "Add Ingredient Group",
  emptyGroupText = "No ingredients in this group. Click \"Add Ingredient\" to get started.",
  emptyNoGroupsText = "No ingredients added yet. Click \"Add Ingredient\" to get started."
}: RecipeIngredientGroupsProps) {
  const [error, setError] = useState('');
  const [lastAddedIngredient, setLastAddedIngredient] = useState<{ groupIndex: number; ingredientIndex: number } | null>(null);

  // Ensure we always have at least one group or standalone ingredients
  useEffect(() => {
    if (ingredients.length === 0) {
      // Create a standalone group by default
      const newStandaloneGroup: RecipeIngredientList & { isStandalone?: boolean } = {
        title: '', // Empty title indicates standalone
        ingredients: [],
        isStandalone: true
      };
      onChange([newStandaloneGroup]);
    }
  }, [ingredients.length, onChange]);

  // Check if we're in standalone mode (first group is standalone)
  const isStandaloneMode = ingredients.length > 0 && (ingredients[0] as RecipeIngredientList & { isStandalone?: boolean }).isStandalone === true;

  const handleAddIngredientList = () => {
    if (isStandaloneMode) {
      // If we're in standalone mode, move all standalone ingredients to the new group
      const standaloneIngredients = ingredients[0].ingredients;
      const newGroup: RecipeIngredientList = {
        title: '',
        ingredients: [...standaloneIngredients]
      };
      onChange([newGroup]);
    } else {
      // Add a new group to existing groups
      const newList: RecipeIngredientList = {
        title: '',
        ingredients: []
      };
      onChange([...ingredients, newList]);
    }
  };

  const handleRemoveIngredientList = (listIndex: number) => {
    const newIngredients = ingredients.filter((_, i) => i !== listIndex);
    
    // If we're removing the last group, convert to standalone mode
    if (newIngredients.length === 0) {
      const standaloneGroup: RecipeIngredientList & { isStandalone?: boolean } = {
        title: '',
        ingredients: [],
        isStandalone: true
      };
      onChange([standaloneGroup]);
    } else {
      onChange(newIngredients);
    }
  };

  const handleAddIngredient = (listIndex: number) => {
    const newIngredient: RecipeIngredient = {
      type: 'foodItem',
      id: '',
      quantity: 1,
      unit: 'cup',
    };
    const newIngredients = [...ingredients];
    newIngredients[listIndex].ingredients.push(newIngredient);
    onChange(newIngredients);
    
    // Track the newly added ingredient for auto-focus
    setLastAddedIngredient({ groupIndex: listIndex, ingredientIndex: newIngredients[listIndex].ingredients.length - 1 });
  };

  const handleRemoveIngredient = (listIndex: number, ingredientIndex: number) => {
    const newIngredients = [...ingredients];
    newIngredients[listIndex].ingredients = newIngredients[listIndex].ingredients.filter((_, i) => i !== ingredientIndex);
    onChange(newIngredients);
    
    // Clear auto-focus tracking when ingredient is removed
    setLastAddedIngredient(null);
  };

  const handleIngredientChange = (listIndex: number, ingredientIndex: number, updatedIngredient: RecipeIngredient) => {
    const newIngredients = [...ingredients];
    newIngredients[listIndex].ingredients[ingredientIndex] = updatedIngredient;
    onChange(newIngredients);
    
    // Clear auto-focus tracking when ingredient is modified
    setLastAddedIngredient(null);
  };

  const handleListTitleChange = (listIndex: number, title: string) => {
    const newIngredients = [...ingredients];
    newIngredients[listIndex].title = title;
    onChange(newIngredients);
  };

  // Get all selected ingredient IDs across all groups for exclusion
  const getAllSelectedIds = () => {
    return ingredients.flatMap(group => 
      group.ingredients
        .filter(ingredient => ingredient.id && ingredient.id.trim() !== '')
        .map(ingredient => ingredient.id)
    );
  };

  // Helper function to check if an ingredient should be auto-focused
  const shouldAutoFocus = (groupIndex: number, ingredientIndex: number) => {
    return lastAddedIngredient?.groupIndex === groupIndex && lastAddedIngredient?.ingredientIndex === ingredientIndex;
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {isStandaloneMode ? (
        // Standalone mode - show ingredients without groups
        <Box>
          {ingredients[0].ingredients.map((ingredient, ingredientIndex) => (
            <BaseIngredientInput
              key={`standalone-${ingredientIndex}`}
              ingredient={ingredient}
              onIngredientChange={(updatedIngredient) => handleIngredientChange(0, ingredientIndex, updatedIngredient)}
              onRemove={() => handleRemoveIngredient(0, ingredientIndex)}
              foodItems={foodItems}
              onFoodItemAdded={onFoodItemAdded}
              currentRecipeId={currentRecipeId}
              selectedIds={getAllSelectedIds().filter(id => id !== ingredient.id)}
              slotId={`standalone-${ingredientIndex}`}
              autoFocus={shouldAutoFocus(0, ingredientIndex)}
              removeButtonText="Remove Ingredient"
            />
          ))}

          <Button
            startIcon={<Add />}
            onClick={() => handleAddIngredient(0)}
            variant="outlined"
            size="small"
            sx={{ mt: 1 }}
          >
            {addIngredientButtonText}
          </Button>

          {ingredients[0].ingredients.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              {emptyNoGroupsText}
            </Typography>
          )}
        </Box>
      ) : (
        // Group mode - show ingredients in groups
        <Box>
          {ingredients.map((list, listIndex) => (
            <Paper key={listIndex} sx={{ 
              p: 2, 
              mb: 2,
              border: !list.title || list.title.trim() === '' ? '2px solid #f44336' : '1px solid',
              borderColor: !list.title || list.title.trim() === '' ? '#f44336' : 'divider'
            }}>
              <Box 
                display="flex" 
                mb={2}
                flexDirection={{ xs: 'column', sm: 'row' }}
                gap={{ xs: 1, sm: 0 }}
                alignItems={{ xs: 'stretch', sm: 'flex-start' }}
              >
                <Box sx={{ flex: 1 }}>
                  <TextField
                    placeholder="Group title (required)"
                    value={list.title || ''}
                    onChange={(e) => handleListTitleChange(listIndex, e.target.value)}
                    size="small"
                    required
                    error={!list.title || list.title.trim() === ''}
                    helperText={!list.title || list.title.trim() === '' ? 'Group title is required' : ''}
                    sx={{ 
                      width: '100%'
                    }}
                  />
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'fit-content', ml: { sm: 2 } }}>
                  <IconButton
                    onClick={() => handleRemoveIngredientList(listIndex)}
                    color="error"
                    size="small"
                    title="Remove ingredient group"
                    sx={{ 
                      display: { xs: 'none', sm: 'flex' }
                    }}
                  >
                    <Delete />
                  </IconButton>
                </Box>
                
                <Button
                  onClick={() => handleRemoveIngredientList(listIndex)}
                  color="error"
                  variant="outlined"
                  size="small"
                  startIcon={<Delete />}
                  sx={{ 
                    display: { xs: 'flex', sm: 'none' },
                    width: '100%',
                    mt: 1
                  }}
                >
                  Remove Group
                </Button>
              </Box>

              <Box>
                {list.ingredients.map((ingredient, ingredientIndex) => (
                  <BaseIngredientInput
                    key={ingredientIndex}
                    ingredient={ingredient}
                    onIngredientChange={(updatedIngredient) => handleIngredientChange(listIndex, ingredientIndex, updatedIngredient)}
                    onRemove={() => handleRemoveIngredient(listIndex, ingredientIndex)}
                    foodItems={foodItems}
                    onFoodItemAdded={onFoodItemAdded}
                    currentRecipeId={currentRecipeId}
                    selectedIds={getAllSelectedIds().filter(id => id !== ingredient.id)}
                    slotId={`${listIndex}-${ingredientIndex}`}
                    autoFocus={shouldAutoFocus(listIndex, ingredientIndex)}
                    removeButtonText="Remove Ingredient"
                  />
                ))}

                <Button
                  startIcon={<Add />}
                  onClick={() => handleAddIngredient(listIndex)}
                  variant="outlined"
                  size="small"
                  sx={{ mt: 1 }}
                >
                  {addIngredientButtonText}
                </Button>

                {list.ingredients.length === 0 && (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                    {emptyGroupText}
                  </Typography>
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      <Box display="flex" justifyContent="flex-start" mt={2}>
        <Button
          onClick={handleAddIngredientList}
          startIcon={<AddCircle />}
          variant="outlined"
          size="small"
          title={isStandaloneMode ? "Convert to ingredient groups" : "Add ingredient group"}
        >
          {isStandaloneMode ? "Convert to Groups" : addIngredientGroupButtonText}
        </Button>
      </Box>
    </Box>
  );
} 