'use client';

import React, { useRef, useState } from 'react';
import { Box, IconButton, TextField } from '@mui/material';
import { Delete, Add, ExpandMore, ExpandLess } from '@mui/icons-material';
import { RecipeIngredient, FoodItemOption } from '@/types/recipe';
import { SearchOption } from '@/lib/hooks/use-food-item-selector';
import { useFoodItemCreator } from '@/lib/hooks/use-food-item-creator';
import { useQuantityInput } from '@/lib/hooks/use-quantity-input';
import FoodItemAutocomplete from '@/components/food-item-inputs/FoodItemAutocomplete';
import QuantityInput from '@/components/food-item-inputs/QuantityInput';
import UnitSelector from '@/components/food-item-inputs/UnitSelector';
import type { Recipe } from '@/lib/hooks/use-food-item-selector';

interface InlineIngredientRowProps {
  ingredient: RecipeIngredient;
  onIngredientChange: (ingredient: RecipeIngredient) => void;
  onRemove: () => void;
  foodItems?: FoodItemOption[];
  recipes?: Recipe[];
  onFoodItemAdded?: (newFoodItem: {
    _id?: string;
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
  }) => Promise<void>;
  currentRecipeId?: string;
  selectedIds?: string[];
  autoFocus?: boolean;
  allowPrepInstructions?: boolean;
}

export const InlineIngredientRow: React.FC<InlineIngredientRowProps> = React.memo(
  function InlineIngredientRow({
    ingredient,
    onIngredientChange,
    onRemove,
    foodItems: propFoodItems,
    recipes = [],
    onFoodItemAdded,
    currentRecipeId,
    selectedIds = [],
    autoFocus = false,
    allowPrepInstructions = true,
  }) {
    const [prepExpanded, setPrepExpanded] = useState(!!ingredient.prepInstructions);
    const userExpandedPrep = useRef(false);

    // Use food item creator hook for side effects (item creation flow)
    useFoodItemCreator({
      onFoodItemAdded: onFoodItemAdded
        ? async (item) => {
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
        const searchOption: SearchOption = {
          ...newItem,
          type: 'foodItem' as const,
        };
        handleSelect(searchOption);
      },
    });

    // Get the currently selected option
    const getSelectedOption = (): SearchOption | null => {
      if (!ingredient || !ingredient.id) return null;

      if (ingredient.type === 'foodItem') {
        const foodItem = propFoodItems?.find((item) => item._id === ingredient.id);
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

        setTimeout(() => {
          if (quantity.quantityRef?.current) {
            quantity.quantityRef.current.focus();
            quantity.quantityRef.current.select();
          }
        }, 100);
      } else {
        onIngredientChange({
          type: 'foodItem',
          id: '',
          quantity: 1,
          unit: 'cup',
        });
      }
    };

    const handleQuantityChange = (newQuantity: number) => {
      let updatedName = ingredient.name;
      if (ingredient.type === 'foodItem' && ingredient.id && propFoodItems) {
        const foodItem = propFoodItems.find((item) => item._id === ingredient.id);
        if (foodItem) {
          updatedName = newQuantity === 1 ? foodItem.singularName : foodItem.pluralName;
        }
      }
      onIngredientChange({ ...ingredient, quantity: newQuantity, name: updatedName });
    };

    const quantity = useQuantityInput({
      initialQuantity: ingredient.quantity ?? 1,
      onQuantityChange: handleQuantityChange,
    });

    return (
      <Box>
        {/* Main inline row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            minHeight: 36,
          }}
        >
          {/* Food Item Autocomplete ~55% */}
          <Box sx={{ flex: '1 1 55%', minWidth: 0 }}>
            <FoodItemAutocomplete
              allowRecipes={true}
              excludeIds={selectedIds}
              excludedItemLabel="Already in recipe"
              foodItems={propFoodItems}
              recipes={recipes}
              currentRecipeId={currentRecipeId}
              onFoodItemAdded={
                onFoodItemAdded
                  ? async (item) => {
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
              label=""
              placeholder="Food item or recipe"
              size="small"
              fullWidth
              autoFocus={autoFocus}
              onCreateItem={(item) => {
                const searchOption: SearchOption = {
                  ...item,
                  type: 'foodItem' as const,
                };
                handleSelect(searchOption);
              }}
            />
          </Box>

          {/* Quantity ~15% */}
          <Box sx={{ flex: '0 0 auto', width: { xs: 60, sm: 80 } }}>
            <QuantityInput
              value={ingredient.quantity ?? 1}
              onChange={handleQuantityChange}
              label=""
              size="small"
              inputRef={quantity.quantityRef}
              sx={{
                '& .MuiInputBase-root': { height: 32 },
                '& .MuiInputBase-input': { fontSize: '0.875rem', py: 0.5 },
              }}
            />
          </Box>

          {/* Unit ~20% */}
          {ingredient.type === 'foodItem' && (
            <Box sx={{ flex: '0 0 auto', width: { xs: 90, sm: 140 } }}>
              <UnitSelector
                value={ingredient.unit || 'cup'}
                quantity={ingredient.quantity ?? 1}
                onChange={(unit) => onIngredientChange({ ...ingredient, unit })}
                label=""
                size="small"
                sx={{
                  '& .MuiInputBase-root': { height: 32 },
                  '& .MuiInputBase-input': { fontSize: '0.875rem' },
                }}
              />
            </Box>
          )}

          {/* Prep instructions toggle (small icon) */}
          {allowPrepInstructions && ingredient.type === 'foodItem' && ingredient.id && (
            <IconButton
              onClick={() => {
                userExpandedPrep.current = true;
                setPrepExpanded(!prepExpanded);
              }}
              size="small"
              sx={{
                flex: '0 0 auto',
                width: 28,
                height: 28,
                color: ingredient.prepInstructions ? 'primary.main' : 'text.tertiary',
              }}
              aria-label={prepExpanded ? 'Hide prep instructions' : 'Add prep instructions'}
            >
              {prepExpanded ? <ExpandLess sx={{ fontSize: 16 }} /> : <Add sx={{ fontSize: 16 }} />}
            </IconButton>
          )}

          {/* Delete icon ~10% */}
          <IconButton
            onClick={onRemove}
            size="small"
            sx={{
              flex: '0 0 auto',
              width: 28,
              height: 28,
              color: 'text.secondary',
              '&:hover': { color: 'error.main' },
            }}
            aria-label="Remove ingredient"
          >
            <Delete sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* Prep instructions (expandable) */}
        {prepExpanded &&
          allowPrepInstructions &&
          ingredient.type === 'foodItem' &&
          ingredient.id && (
            <Box sx={{ pl: 1, pr: 4.5, mt: 0.5, mb: 0.5 }}>
              <TextField
                autoFocus={userExpandedPrep.current}
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
                sx={{
                  '& .MuiInputBase-root': { height: 28, fontSize: '0.8125rem' },
                  '& .MuiInputBase-input': { py: 0.25 },
                }}
              />
            </Box>
          )}
      </Box>
    );
  },
);
