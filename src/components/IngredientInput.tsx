'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Paper, Button, Alert, TextField } from '@mui/material';
import { Delete, ExpandMore, ExpandLess, Add } from '@mui/icons-material';
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
  foodItems?: Array<{
    _id: string;
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
  }>;
  onFoodItemAdded?: (newFoodItem: {
    _id: string;
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
  }) => Promise<void>;
  currentRecipeId?: string;
  selectedIds?: string[];
  slotId: string;
  autoFocus?: boolean;
  removeButtonText?: string;
  allowPrepInstructions?: boolean; // Whether to show prep instructions editing (default: true)
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
  removeButtonText = 'Remove Ingredient',
  allowPrepInstructions = true,
}: IngredientInputProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  // Load recipes on mount (only if needed for recipe selection)
  useEffect(() => {
    const loadRecipes = async () => {
      try {
        const recipeRes = await fetch('/api/recipes?limit=1000');
        const recipesJson = recipeRes.ok ? await recipeRes.json() : { data: [] };
        setRecipes(Array.isArray(recipesJson) ? recipesJson : recipesJson.data || []);
      } catch (error) {
        console.error('Error loading recipes:', error);
      }
    };

    loadRecipes();
  }, []);

  // Use food item creator hook
  const creator = useFoodItemCreator({
    onFoodItemAdded: onFoodItemAdded
      ? async (item) => {
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
        }
      : undefined,
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
      const foodItem = propFoodItems?.find((item) => item._id === ingredient.id);
      // If we have a populated name from the API but can't find the food item, create a placeholder option
      if (!foodItem && ingredient.name) {
        return {
          _id: ingredient.id,
          name: ingredient.name,
          singularName: ingredient.name,
          pluralName: ingredient.name,
          unit: ingredient.unit || 'cup',
          type: 'foodItem' as const,
        };
      }
      return foodItem ? { ...foodItem, type: 'foodItem' as const } : null;
    } else {
      const recipe = recipes.find((item) => item._id === ingredient.id);
      // If we have a populated name from the API but can't find the recipe, create a placeholder option
      if (!recipe && ingredient.name) {
        return {
          _id: ingredient.id,
          title: ingredient.name,
          type: 'recipe' as const,
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
        name: item.type === 'foodItem' ? item.singularName : item.title,
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
        unit: 'cup',
      });
    }
  };

  // Handle quantity change
  const handleQuantityChange = (newQuantity: number) => {
    let updatedName = ingredient.name;

    // Update name based on quantity for food items
    if (ingredient.type === 'foodItem' && ingredient.id && propFoodItems) {
      const foodItem = propFoodItems.find((item) => item._id === ingredient.id);
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

  // Prep instructions state - auto-expand if ingredient has prepInstructions
  const [prepInstructionsExpanded, setPrepInstructionsExpanded] = useState(
    !!ingredient.prepInstructions
  );
  const userExpandedPrep = useRef(false);

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
            onFoodItemAdded={
              onFoodItemAdded
                ? async (item) => {
                    // Pass through the full FoodItem including _id
                    await onFoodItemAdded({
                      _id: item._id,
                      name: item.name,
                      singularName: item.singularName,
                      pluralName: item.pluralName,
                      unit: item.unit,
                      isGlobal: item.isGlobal ?? false,
                    });
                  }
                : undefined
            }
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
              minWidth: { xs: 'auto', sm: 100 },
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
                minWidth: { xs: 'auto', sm: 220 },
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
              display: { xs: 'none', sm: 'flex' },
            }}
          >
            <Delete />
          </IconButton>
        </Box>
      </Box>

      {/* Prep Instructions Section - Only for food items and when allowed */}
      {/* On mobile, prep instructions appear before remove button to prevent accidental deletion */}
      {allowPrepInstructions && ingredient.type === 'foodItem' && ingredient.id && (
        <Box sx={{ mt: { xs: 1, sm: 1 }, mb: { xs: 2, sm: 0 } }}>
          {prepInstructionsExpanded ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  autoFocus={userExpandedPrep.current}
                  label="Prep Instructions (optional)"
                  placeholder="e.g., chopped, diced, peeled"
                  value={ingredient.prepInstructions || ''}
                  onChange={(e) => {
                    onIngredientChange({
                      ...ingredient,
                      prepInstructions: e.target.value || undefined,
                    });
                  }}
                  size="small"
                  fullWidth
                  sx={{ flex: 1 }}
                />
                <IconButton
                  onClick={() => {
                    setPrepInstructionsExpanded(false);
                    // Clear prep instructions if field is empty
                    if (!ingredient.prepInstructions) {
                      onIngredientChange({
                        ...ingredient,
                        prepInstructions: undefined,
                      });
                    }
                  }}
                  size="small"
                  sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                  aria-label="Collapse prep instructions"
                >
                  <ExpandLess />
                </IconButton>
              </Box>
            </Box>
          ) : ingredient.prepInstructions ? (
            <Button
              startIcon={<ExpandMore />}
              onClick={() => {
                userExpandedPrep.current = true;
                setPrepInstructionsExpanded(true);
              }}
              size="small"
              variant="outlined"
              sx={{
                width: { xs: '100%', sm: 'auto' },
                fontSize: '0.75rem',
              }}
            >
              Show prep instructions ({ingredient.prepInstructions})
            </Button>
          ) : (
            <Button
              startIcon={<Add />}
              onClick={() => {
                userExpandedPrep.current = true;
                setPrepInstructionsExpanded(true);
              }}
              size="small"
              variant="outlined"
              sx={{
                width: { xs: '100%', sm: 'auto' },
                fontSize: '0.75rem',
              }}
            >
              Add prep instructions
            </Button>
          )}
        </Box>
      )}

      {/* Remove button on mobile - appears after prep instructions to prevent accidental deletion */}
      <Button
        onClick={onRemove}
        color="error"
        variant="outlined"
        size="small"
        startIcon={<Delete />}
        sx={{
          display: { xs: 'flex', sm: 'none' },
          width: '100%',
          mt: { xs: 0, sm: 1 },
        }}
      >
        {removeButtonText}
      </Button>
    </Paper>
  );
}
