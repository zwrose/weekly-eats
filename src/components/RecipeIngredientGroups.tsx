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
  emptyGroupText = "No ingredients in this group. Click \"Add Ingredient\" to get started."
}: RecipeIngredientGroupsProps) {
  const [error, setError] = useState('');

  // Ensure we always have at least one group
  useEffect(() => {
    if (ingredients.length === 0) {
      onChange([{ title: '', ingredients: [] }]);
    }
  }, [ingredients.length, onChange]);

  const handleAddIngredientList = () => {
    const newList: RecipeIngredientList = {
      title: '',
      ingredients: []
    };
    onChange([...ingredients, newList]);
  };

  const handleRemoveIngredientList = (listIndex: number) => {
    // Don't allow removing the last group
    if (ingredients.length <= 1) {
      setError('At least one ingredient group is required');
      return;
    }
    
    const newIngredients = ingredients.filter((_, i) => i !== listIndex);
    onChange(newIngredients);
    setError('');
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
  };

  const handleRemoveIngredient = (listIndex: number, ingredientIndex: number) => {
    const newIngredients = [...ingredients];
    newIngredients[listIndex].ingredients = newIngredients[listIndex].ingredients.filter((_, i) => i !== ingredientIndex);
    onChange(newIngredients);
  };

  const handleIngredientChange = (listIndex: number, ingredientIndex: number, updatedIngredient: RecipeIngredient) => {
    const newIngredients = [...ingredients];
    newIngredients[listIndex].ingredients[ingredientIndex] = updatedIngredient;
    onChange(newIngredients);
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

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {ingredients.map((list, listIndex) => (
        <Paper key={listIndex} sx={{ 
          p: 2, 
          mb: 2,
          border: !list.title || list.title.trim() === '' ? '2px solid #f44336' : '1px solid',
          borderColor: !list.title || list.title.trim() === '' ? '#f44336' : 'divider'
        }}>
          <Box 
            display="flex" 
            alignItems="center" 
            mb={2}
            flexDirection={{ xs: 'column', sm: 'row' }}
            gap={{ xs: 1, sm: 0 }}
          >
            <TextField
              placeholder="Group title (required)"
              value={list.title || ''}
              onChange={(e) => handleListTitleChange(listIndex, e.target.value)}
              size="small"
              required
              error={!list.title || list.title.trim() === ''}
              helperText={!list.title || list.title.trim() === '' ? 'Group title is required' : ''}
              sx={{ 
                flex: 1, 
                width: { xs: '100%', sm: 'auto' },
                mr: { xs: 0, sm: 2 }
              }}
            />
            
            {ingredients.length > 1 && (
              <>
                <IconButton
                  onClick={() => handleRemoveIngredientList(listIndex)}
                  color="error"
                  size="small"
                  title="Remove ingredient group"
                  sx={{ 
                    alignSelf: { xs: 'flex-end', sm: 'center' },
                    display: { xs: 'none', sm: 'flex' }
                  }}
                >
                  <Delete />
                </IconButton>
                
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
              </>
            )}
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

      <Box display="flex" justifyContent="flex-start" mt={2}>
        <Button
          onClick={handleAddIngredientList}
          startIcon={<AddCircle />}
          variant="outlined"
          size="small"
          title="Add ingredient group"
        >
          {addIngredientGroupButtonText}
        </Button>
      </Box>
    </Box>
  );
} 