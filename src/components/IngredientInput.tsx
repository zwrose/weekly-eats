"use client";

import { useEffect, useState } from 'react';
import {
  Box,
  IconButton,
  Paper,
  Button,
  Alert,
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import { RecipeIngredient } from '../types/recipe';
import { SearchOption, Recipe } from '../lib/hooks/use-food-item-selector';
import { useFoodItemCreator } from '../lib/hooks/use-food-item-creator';
import { useQuantityInput } from '../lib/hooks/use-quantity-input';
import FoodItemAutocomplete from './food-item-inputs/FoodItemAutocomplete';
import QuantityInput from './food-item-inputs/QuantityInput';
import UnitSelector from './food-item-inputs/UnitSelector';

interface IngredientInputProps {
  ingredient: RecipeIngredient;
  onIngredientChange: (ingredient: RecipeIngredient) => void;
  onRemove: () => void;
  foodItems?: Array<{_id: string, name: string, singularName: string, pluralName: string, unit: string}>;
  onFoodItemAdded?: (newFoodItem: { _id: string; name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean; }) => Promise<void>;
  currentRecipeId?: string;
  selectedIds?: string[];
  slotId: string;
  autoFocus?: boolean;
  removeButtonText?: string;
}

// Recipe type matches the one from use-food-item-selector

export default function IngredientInput({ 
  ingredient, 
  onIngredientChange, 
  onRemove,
  foodItems: propFoodItems,
  onFoodItemAdded, 
  currentRecipeId,
  selectedIds = [],
  autoFocus = false,
  removeButtonText = "Remove Ingredient"
}: IngredientInputProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  // Load recipes on mount (only if needed for recipe selection)
  useEffect(() => {
    const loadRecipes = async () => {
      try {
        const recipeRes = await fetch('/api/recipes?limit=1000');
        const recipesData = recipeRes.ok ? await recipeRes.json() : [];
        setRecipes(recipesData);
      } catch (error) {
        console.error('Error loading recipes:', error);
      }
    };
    
    loadRecipes();
  }, []);

  // Use food item creator hook
  const creator = useFoodItemCreator({
    onFoodItemAdded: onFoodItemAdded ? async (item) => {
      // Convert FoodItem to the expected shape
      const convertedItem = {
        _id: item._id,
        name: item.name,
        singularName: item.singularName,
        pluralName: item.pluralName,
        unit: item.unit,
        isGlobal: item.isGlobal ?? false,
      };
      await onFoodItemAdded(convertedItem);
    } : undefined,
    onItemCreated: (newItem) => {
      // Auto-select the newly created item
      const searchOption: SearchOption = {
        ...newItem,
        type: 'foodItem' as const,
      };
      handleSelect(searchOption);
    },
  });

  // Get the currently selected option from ingredient
  const getSelectedOption = (): SearchOption | null => {
    if (!ingredient || !ingredient.id) return null;
    
    if (ingredient.type === 'foodItem') {
      const foodItem = propFoodItems?.find(item => item._id === ingredient.id);
      // If we have a populated name from the API but can't find the food item, create a placeholder option
      if (!foodItem && ingredient.name) {
        return {
          _id: ingredient.id,
          name: ingredient.name,
          singularName: ingredient.name,
          pluralName: ingredient.name,
          unit: ingredient.unit || 'cup',
          type: 'foodItem' as const
        };
      }
      return foodItem ? { ...foodItem, type: 'foodItem' as const } : null;
    } else {
      const recipe = recipes.find(item => item._id === ingredient.id);
      // If we have a populated name from the API but can't find the recipe, create a placeholder option
      if (!recipe && ingredient.name) {
        return {
          _id: ingredient.id,
          title: ingredient.name,
          type: 'recipe' as const
        };
      }
      return recipe ? { ...recipe, type: 'recipe' as const } : null;
    }
  };

  const selectedOption = getSelectedOption();

  // Handle selection
  const handleSelect = (item: SearchOption | null) => {
    if (item) {
      const newIngredient: RecipeIngredient = {
        type: item.type,
        id: item._id || '',
        quantity: ingredient.quantity || 1,
        unit: item.type === 'foodItem' ? item.unit : undefined,
        name: item.type === 'foodItem' ? item.singularName : item.title
      };
      onIngredientChange(newIngredient);
      
      // Auto-advance to quantity field
      setTimeout(() => {
        if (quantity.quantityRef?.current) {
          quantity.quantityRef.current.focus();
          quantity.quantityRef.current.select();
        }
      }, 100);
    } else {
      // Clear the ingredient
      onIngredientChange({
        type: 'foodItem',
        id: '',
        quantity: 1,
        unit: 'cup'
      });
    }
  };

  // Handle quantity change
  const handleQuantityChange = (newQuantity: number) => {
    let updatedName = ingredient.name;
    
    // Update name based on quantity for food items
    if (ingredient.type === 'foodItem' && ingredient.id && propFoodItems) {
      const foodItem = propFoodItems.find(item => item._id === ingredient.id);
      if (foodItem) {
        updatedName = newQuantity === 1 ? foodItem.singularName : foodItem.pluralName;
      }
    }
    
    onIngredientChange({ ...ingredient, quantity: newQuantity, name: updatedName });
  };

  // Use quantity input hook
  const quantity = useQuantityInput({
    initialQuantity: ingredient.quantity ?? 1,
    onQuantityChange: handleQuantityChange,
  });

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      {creator.error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={creator.clearError}>
          {creator.error}
        </Alert>
      )}

      <Box 
        display="flex" 
        gap={2} 
        alignItems="flex-start"
        flexDirection={{ xs: 'column', sm: 'row' }}
      >
        <Box flex={1} width="100%">
          <FoodItemAutocomplete
            allowRecipes={true}
            excludeIds={selectedIds}
            foodItems={propFoodItems}
            recipes={recipes}
            currentRecipeId={currentRecipeId}
            onFoodItemAdded={onFoodItemAdded ? async (item) => {
              // Pass through the full FoodItem including _id
              await onFoodItemAdded({
                _id: item._id,
                name: item.name,
                singularName: item.singularName,
                pluralName: item.pluralName,
                unit: item.unit,
                isGlobal: item.isGlobal ?? false,
              });
            } : undefined}
            autoLoad={!propFoodItems}
            value={selectedOption}
            onChange={handleSelect}
            label="Food Item or Recipe"
            size="small"
            fullWidth
            autoFocus={autoFocus}
            onCreateItem={(item) => {
              // Convert FoodItem to SearchOption
              const searchOption: SearchOption = {
                ...item,
                type: 'foodItem' as const,
              };
              handleSelect(searchOption);
            }}
          />
        </Box>
        
        <Box 
          display="flex" 
          gap={2} 
          alignItems="flex-start"
          width={{ xs: '100%', sm: 'auto' }}
          flexDirection={{ xs: 'column', sm: 'row' }}
        >
          <QuantityInput
            value={ingredient.quantity ?? 1}
            onChange={handleQuantityChange}
            size="small"
            inputRef={quantity.quantityRef}
            sx={{ 
              width: { xs: '100%', sm: 100 },
              minWidth: { xs: 'auto', sm: 100 }
            }}
          />
          
          {ingredient.type === 'foodItem' && (
            <UnitSelector
              value={ingredient.unit || 'cup'}
              quantity={ingredient.quantity ?? 1}
              onChange={(unit) => onIngredientChange({ ...ingredient, unit })}
              size="small"
              sx={{ 
                width: { xs: '100%', sm: 220 },
                minWidth: { xs: 'auto', sm: 220 }
              }}
            />
          )}
          
          <IconButton
            onClick={onRemove}
            color="error"
            size="small"
            sx={{ 
              alignSelf: { xs: 'flex-start', sm: 'flex-start' },
              mt: { xs: 0, sm: 0 },
              display: { xs: 'none', sm: 'flex' }
            }}
          >
            <Delete />
          </IconButton>
          
          <Button
            onClick={onRemove}
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
            {removeButtonText}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
