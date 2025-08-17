"use client";

import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  Alert,
  TextField,
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { RecipeIngredientList, RecipeIngredient } from '../types/recipe';
import IngredientInput from './IngredientInput';

interface IngredientGroupProps {
  group: RecipeIngredientList;
  onChange: (group: RecipeIngredientList) => void;
  onRemove?: () => void;
  foodItems?: Array<{_id: string, name: string, singularName: string, pluralName: string, unit: string}>;
  onFoodItemAdded?: (newFoodItem: { name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean; }) => Promise<void>;
  // Custom text overrides
  addIngredientButtonText?: string;
  emptyGroupText?: string;
  removeIngredientButtonText?: string;
  showRemoveButton?: boolean;
}

export default function IngredientGroup({ 
  group, 
  onChange, 
  onRemove,
  foodItems,
  onFoodItemAdded, 
  addIngredientButtonText = "Add Ingredient",
  emptyGroupText = "No ingredients in this group. Click \"Add Ingredient\" to get started.",
  removeIngredientButtonText = "Remove Ingredient",
  showRemoveButton = true
}: IngredientGroupProps) {
  const [error, setError] = useState('');

  const handleAddIngredient = () => {
    const newIngredient: RecipeIngredient = {
      type: 'foodItem',
      id: '',
      quantity: 1,
      unit: 'cup'
    };
    onChange({
      ...group,
      ingredients: [...group.ingredients, newIngredient]
    });
  };

  const handleIngredientChange = (ingredientIndex: number, updatedIngredient: RecipeIngredient) => {
    const newIngredients = group.ingredients.map((ing, index) =>
      index === ingredientIndex ? updatedIngredient : ing
    );
    onChange({
      ...group,
      ingredients: newIngredients
    });
  };

  const handleRemoveIngredient = (ingredientIndex: number) => {
    const newIngredients = group.ingredients.filter((_, index) => index !== ingredientIndex);
    onChange({
      ...group,
      ingredients: newIngredients
    });
  };

  const getAllSelectedIds = (): string[] => {
    return group.ingredients.map(ingredient => ingredient.id).filter(id => id !== '');
  };

  return (
    <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <TextField
          placeholder="Group title (required)"
          value={group.title || ''}
          onChange={(e) => onChange({ ...group, title: e.target.value })}
          size="small"
          required
          error={!group.title || group.title.trim() === ''}
          helperText={!group.title || group.title.trim() === '' ? 'Group title is required' : ''}
          sx={{ 
            flex: 1, 
            mr: 2,
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'transparent'
            }
          }}
        />
        {showRemoveButton && onRemove && (
          <IconButton
            onClick={onRemove}
            color="error"
            size="small"
            sx={{ 
              display: { xs: 'none', sm: 'flex' },
              alignSelf: 'flex-start'
            }}
          >
            <Delete />
          </IconButton>
        )}
      </Box>

      {group.ingredients.map((ingredient, ingredientIndex) => (
        <IngredientInput
          key={ingredientIndex}
          ingredient={ingredient}
          onIngredientChange={(updatedIngredient) => handleIngredientChange(ingredientIndex, updatedIngredient)}
          onRemove={() => handleRemoveIngredient(ingredientIndex)}
          foodItems={foodItems}
          onFoodItemAdded={onFoodItemAdded}
          selectedIds={getAllSelectedIds().filter(id => id !== ingredient.id)}
          slotId={`group-${ingredientIndex}`}
          removeButtonText={removeIngredientButtonText}
        />
      ))}

      <Button
        startIcon={<Add />}
        onClick={handleAddIngredient}
        variant="outlined"
        size="small"
        sx={{ 
          mt: 1,
          width: { xs: '100%', sm: 'auto' }
        }}
      >
        {addIngredientButtonText}
      </Button>

      {group.ingredients.length === 0 && (
        <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
          {emptyGroupText}
        </Typography>
      )}

      {showRemoveButton && onRemove && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            onClick={onRemove}
            color="error"
            variant="outlined"
            size="small"
            startIcon={<Delete />}
            sx={{ 
              display: { xs: 'flex', sm: 'none' },
              width: '100%'
            }}
          >
            Remove Group
          </Button>
        </Box>
      )}
    </Paper>
  );
}
