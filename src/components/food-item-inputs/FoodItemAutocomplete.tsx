/**
 * Reusable Autocomplete component for food item and recipe selection
 * 
 * Uses the useFoodItemSelector hook for consistent behavior.
 */

"use client";

import { Autocomplete, TextField, Box, Typography, Button } from '@mui/material';
import { useFoodItemSelector, SearchOption, FoodItem } from '@/lib/hooks/use-food-item-selector';
import { useFoodItemCreator } from '@/lib/hooks/use-food-item-creator';
import AddFoodItemDialog from '../AddFoodItemDialog';

export interface FoodItemAutocompleteProps {
  // Hook options
  allowRecipes?: boolean;
  excludeIds?: string[];
  foodItems?: Array<{
    _id: string;
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
  }>;
  recipes?: Array<{
    _id: string;
    title: string;
    emoji?: string;
  }>;
  currentRecipeId?: string;
  onFoodItemAdded?: (item: FoodItem) => Promise<void>;
  autoLoad?: boolean;

  // Selection handling
  value: SearchOption | null;
  onChange: (item: SearchOption | null) => void;

  // UI customization
  label?: string;
  placeholder?: string;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;

  // Create dialog
  onCreateItem?: (item: FoodItem) => void;
}

export default function FoodItemAutocomplete({
  allowRecipes = true,
  excludeIds = [],
  foodItems,
  recipes,
  currentRecipeId,
  onFoodItemAdded,
  autoLoad = true,
  value,
  onChange,
  label = 'Food Item or Recipe',
  placeholder,
  size = 'small',
  fullWidth = false,
  autoFocus = false,
  disabled = false,
  onCreateItem,
}: FoodItemAutocompleteProps) {
  const creator = useFoodItemCreator({
    onFoodItemAdded,
    onItemCreated: onCreateItem ? (item) => {
      // onCreateItem expects FoodItem, which is what onItemCreated provides
      onCreateItem(item);
    } : undefined,
  });

  const selector = useFoodItemSelector({
    allowRecipes,
    excludeIds,
    foodItems,
    recipes,
    currentRecipeId,
    autoLoad,
    onCreateRequested: (inputValue) => {
      creator.openDialog(inputValue);
    },
  });

  // Sync selector's selectedItem with external value
  const selectedItem = value || selector.selectedItem;

  const handleSelect = (item: SearchOption | null) => {
    selector.handleSelect(item);
    onChange(item);
  };

  const handleCreate = async (foodItemData: {
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
  }) => {
    const newItem = await creator.handleCreate(foodItemData);
    if (newItem) {
      // Auto-select the newly created item
      const searchOption: SearchOption = {
        ...newItem,
        type: 'foodItem' as const,
      };
      handleSelect(searchOption);
    }
  };

  // Open create dialog when button is clicked
  const handleOpenCreate = (e: React.MouseEvent) => {
    e.preventDefault();
    creator.openDialog(selector.inputValue);
  };

  return (
    <>
      <Autocomplete
        options={selector.options}
        loading={selector.isLoading}
        value={selectedItem}
        inputValue={selector.inputValue}
        onInputChange={(_, value, reason) => selector.handleInputChange(value, reason)}
        onChange={(_, value) => handleSelect(value)}
        getOptionLabel={(option) =>
          option.type === 'foodItem' ? option.name : option.title
        }
        isOptionEqualToValue={(option, value) => option._id === value._id && option.type === value.type}
        renderOption={(props, option) => {
          const { key, ...otherProps } = props;
          return (
            <Box component="li" key={key} {...otherProps}>
              <Box>
                <Typography variant="body1">
                  {option.type === 'foodItem' ? option.name : option.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ({option.type === 'foodItem' ? 'Food Item' : 'Recipe'})
                </Typography>
              </Box>
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={placeholder}
            size={size}
            fullWidth={fullWidth}
            inputRef={selector.autocompleteRef}
            onKeyDown={selector.handleKeyDown}
            autoFocus={autoFocus}
            disabled={disabled}
          />
        )}
        noOptionsText={
          <Box>
            <Typography variant="body2" color="text.secondary" mb={1}>
              {allowRecipes ? 'No food items or recipes found' : 'No food items found'}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={handleOpenCreate}
            >
              {selector.inputValue
                ? `Add "${selector.inputValue}" as a Food Item`
                : 'Add New Food Item'}
            </Button>
          </Box>
        }
      />

      <AddFoodItemDialog
        open={creator.isDialogOpen}
        onClose={creator.closeDialog}
        onAdd={handleCreate}
        prefillName={creator.prefillName}
      />
    </>
  );
}

