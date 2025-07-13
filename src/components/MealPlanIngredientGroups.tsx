"use client";

import { useState } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  Button,
  Alert,
  Divider,
} from '@mui/material';
import { Delete, Add, AddCircle } from '@mui/icons-material';
import { RecipeIngredient, RecipeIngredientList } from '../types/recipe';
import BaseIngredientInput from './BaseIngredientInput';

interface MealPlanIngredientGroupsProps {
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

export default function MealPlanIngredientGroups({ 
  ingredients, 
  onChange, 
  foodItems,
  onFoodItemAdded, 
  currentRecipeId,
  addIngredientButtonText = "Add Meal Item",
  addIngredientGroupButtonText = "Add Ingredient Group",
  emptyGroupText = "No items in this group. Click \"Add Meal Item\" to get started.",
  emptyNoGroupsText = "No ingredient groups added yet. Click the + button to add an ingredient group."
}: MealPlanIngredientGroupsProps) {
  const [error, setError] = useState('');

  // Separate standalone ingredients from grouped ingredients
  // For meal plans, we'll use the isStandalone property to track whether a group was created as standalone
  const firstGroupIsStandalone = ingredients.length > 0 && (ingredients[0] as RecipeIngredientList & { isStandalone?: boolean }).isStandalone === true;
  
  // Only treat as standalone if it was explicitly created as standalone
  const standaloneIngredients = firstGroupIsStandalone ? ingredients[0] : null;
  const groupedIngredients = standaloneIngredients ? ingredients.slice(1) : ingredients;

  const handleAddIngredientList = () => {
    const newList: RecipeIngredientList = {
      title: '',
      ingredients: []
    };
    const newIngredients = [...ingredients, newList];
    onChange(newIngredients);
  };

  const handleRemoveIngredientList = (listIndex: number) => {
    const newIngredients = ingredients.filter((_, i) => i !== listIndex);
    onChange(newIngredients);
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

  // Handle standalone ingredients
  const handleAddStandaloneIngredient = () => {
    const newIngredient: RecipeIngredient = {
      type: 'foodItem',
      id: '',
      quantity: 1,
      unit: 'cup',
    };
    
    if (standaloneIngredients) {
      // Add to existing standalone group
      const newIngredients = [...ingredients];
      newIngredients[0].ingredients.push(newIngredient);
      onChange(newIngredients);
    } else {
      // Create new standalone group with a special property to track it as standalone
      const newStandaloneGroup: RecipeIngredientList & { isStandalone?: boolean } = {
        title: '', // Empty title indicates standalone
        ingredients: [newIngredient],
        isStandalone: true // Mark this as created via standalone button
      };
      onChange([newStandaloneGroup, ...ingredients]);
    }
  };

  const handleRemoveStandaloneIngredient = (ingredientIndex: number) => {
    const newIngredients = [...ingredients];
    newIngredients[0].ingredients = newIngredients[0].ingredients.filter((_, i) => i !== ingredientIndex);
    
    // If no more standalone ingredients, remove the group entirely
    if (newIngredients[0].ingredients.length === 0) {
      onChange(newIngredients.slice(1));
    } else {
      onChange(newIngredients);
    }
  };

  const handleStandaloneIngredientChange = (ingredientIndex: number, updatedIngredient: RecipeIngredient) => {
    const newIngredients = [...ingredients];
    newIngredients[0].ingredients[ingredientIndex] = updatedIngredient;
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

      {/* Standalone Ingredients Section */}
      {standaloneIngredients && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Standalone Items
          </Typography>
          
          {standaloneIngredients.ingredients.map((ingredient, ingredientIndex) => (
            <BaseIngredientInput
              key={`standalone-${ingredientIndex}`}
              ingredient={ingredient}
              onIngredientChange={(updatedIngredient) => handleStandaloneIngredientChange(ingredientIndex, updatedIngredient)}
              onRemove={() => handleRemoveStandaloneIngredient(ingredientIndex)}
              foodItems={foodItems}
              onFoodItemAdded={onFoodItemAdded}
              currentRecipeId={currentRecipeId}
              selectedIds={getAllSelectedIds().filter(id => id !== ingredient.id)}
              slotId={`standalone-${ingredientIndex}`}
              removeButtonText="Remove Meal Item"
            />
          ))}

          <Button
            startIcon={<Add />}
            onClick={handleAddStandaloneIngredient}
            variant="outlined"
            size="small"
            sx={{ mt: 1 }}
          >
            {addIngredientButtonText}
          </Button>
        </Box>
      )}

      {/* Add Standalone Ingredient Button (when no standalone group exists) */}
      {!standaloneIngredients && (
        <Box sx={{ mb: 3 }}>
          <Button
            startIcon={<Add />}
            onClick={handleAddStandaloneIngredient}
            variant="outlined"
            size="small"
          >
            {addIngredientButtonText}
          </Button>
        </Box>
      )}

      {/* Ingredient Groups Section */}
      {groupedIngredients.length > 0 && (
        <>
          {standaloneIngredients && <Divider sx={{ my: 3 }} />}
          
          <Typography variant="h6" gutterBottom>
            Ingredient Groups
          </Typography>
          
          {groupedIngredients.map((list, listIndex) => (
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
                  onChange={(e) => handleListTitleChange(standaloneIngredients ? listIndex + 1 : listIndex, e.target.value)}
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
                
                <IconButton
                  onClick={() => handleRemoveIngredientList(standaloneIngredients ? listIndex + 1 : listIndex)}
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
                  onClick={() => handleRemoveIngredientList(standaloneIngredients ? listIndex + 1 : listIndex)}
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
                    onIngredientChange={(updatedIngredient) => handleIngredientChange(standaloneIngredients ? listIndex + 1 : listIndex, ingredientIndex, updatedIngredient)}
                    onRemove={() => handleRemoveIngredient(standaloneIngredients ? listIndex + 1 : listIndex, ingredientIndex)}
                    foodItems={foodItems}
                    onFoodItemAdded={onFoodItemAdded}
                    currentRecipeId={currentRecipeId}
                    selectedIds={getAllSelectedIds().filter(id => id !== ingredient.id)}
                    slotId={`${listIndex}-${ingredientIndex}`}
                    removeButtonText="Remove Meal Item"
                  />
                ))}

                <Button
                  startIcon={<Add />}
                  onClick={() => handleAddIngredient(standaloneIngredients ? listIndex + 1 : listIndex)}
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
        </>
      )}

      {/* Add Ingredient Group Button */}
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

      {/* Empty state when no ingredients or groups exist */}
      {ingredients.length === 0 && (
        <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
          {emptyNoGroupsText}
        </Typography>
      )}
    </Box>
  );
} 