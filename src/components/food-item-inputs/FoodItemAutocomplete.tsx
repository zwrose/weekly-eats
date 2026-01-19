/**
 * Reusable Autocomplete component for food item and recipe selection
 *
 * Uses the useFoodItemSelector hook for consistent behavior.
 */

"use client";

import { useMemo, useState } from "react";
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Button,
} from "@mui/material";
import {
  useFoodItemSelector,
  SearchOption,
  FoodItem,
} from "@/lib/hooks/use-food-item-selector";
import { useFoodItemCreator } from "@/lib/hooks/use-food-item-creator";
import AddFoodItemDialog from "../AddFoodItemDialog";

// Extended SearchOption type for the special "Add New Food Item" option
type SearchOptionWithAddNew = SearchOption & {
  isAddNewOption?: boolean;
};

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
  // Note: onChange is a function prop, which Next.js flags as non-serializable.
  // This is expected and safe for client components that are only used within other client components.
  // All parent components (IngredientInput, pantry page, etc.) are client components.
  onChange: (item: SearchOption | null) => void;

  // UI customization
  label?: string;
  placeholder?: string;
  size?: "small" | "medium";
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
  onChange, // Client component callback - not a server action
  label = "Food Item or Recipe",
  placeholder,
  size = "small",
  fullWidth = false,
  autoFocus = false,
  disabled = false,
  onCreateItem,
}: FoodItemAutocompleteProps) {
  const creator = useFoodItemCreator({
    onFoodItemAdded,
    onItemCreated: onCreateItem
      ? (item) => {
          // onCreateItem expects FoodItem, which is what onItemCreated provides
          onCreateItem(item);
        }
      : undefined,
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

  // Track if dropdown should be open (prevent opening when input is empty)
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (item: SearchOption | null) => {
    selector.handleSelect(item);
    onChange(item);
    // Close the dropdown when an item is selected
    setIsOpen(false);
  };

  const handleCreate = async (foodItemData: {
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
    addToPantry?: boolean;
  }) => {
    const newItem = await creator.handleCreate(foodItemData);
    if (newItem) {
      // Auto-select the newly created item
      const searchOption: SearchOption = {
        ...newItem,
        type: "foodItem" as const,
      };
      handleSelect(searchOption);
    }
  };

  // Open create dialog when button is clicked
  const handleOpenCreate = (e: React.MouseEvent) => {
    e.preventDefault();
    creator.openDialog(selector.inputValue);
  };

  // Check if the input text matches any excluded food items
  const inputMatchesExcludedItem = useMemo(() => {
    if (!selector.inputValue || !foodItems || excludeIds.length === 0) {
      return false;
    }

    const inputLower = selector.inputValue.toLowerCase().trim();
    if (!inputLower) return false;

    // Check if any excluded food item matches the input
    return foodItems.some((item) => {
      if (!excludeIds.includes(item._id)) return false;

      // Check if input matches name, singularName, or pluralName
      return (
        item.name.toLowerCase() === inputLower ||
        item.singularName.toLowerCase() === inputLower ||
        item.pluralName.toLowerCase() === inputLower
      );
    });
  }, [selector.inputValue, foodItems, excludeIds]);

  // Create a special "Add New Food Item" option that appears at the bottom
  const ADD_NEW_FOOD_ITEM_OPTION: SearchOptionWithAddNew = {
    _id: "__add_new_food_item__",
    name: selector.inputValue
      ? `Add "${selector.inputValue}" as a Food Item`
      : "Add New Food Item",
    singularName: "",
    pluralName: "",
    unit: "cup",
    type: "foodItem" as const,
    isAddNewOption: true, // Special marker
  };

  // Helper to check if an option is the "Add New Food Item" option
  const isAddNewOption = (
    option: SearchOption | null
  ): option is SearchOptionWithAddNew => {
    return (
      option !== null &&
      "isAddNewOption" in option &&
      option.isAddNewOption === true
    );
  };

  // Include the "Add New Food Item" option at the bottom only if:
  // 1. There is input text
  // 2. The input doesn't match an excluded item
  const shouldShowAddNewOption =
    selector.inputValue.trim() && !inputMatchesExcludedItem;
  const optionsWithAddNew = shouldShowAddNewOption
    ? [...selector.options, ADD_NEW_FOOD_ITEM_OPTION]
    : selector.options;

  return (
    <>
      <Autocomplete
        options={optionsWithAddNew}
        loading={selector.isLoading}
        value={selectedItem}
        inputValue={selector.inputValue}
        open={isOpen && selector.inputValue.trim() ? isOpen : false}
        onOpen={() => {
          // Only allow opening if there's input text
          if (selector.inputValue.trim()) {
            setIsOpen(true);
          }
        }}
        onClose={() => setIsOpen(false)}
        onInputChange={(_, value, reason) => {
          selector.handleInputChange(value, reason);
          // Close dropdown if input becomes empty
          if (!value.trim()) {
            setIsOpen(false);
          }
        }}
        onChange={(_, value) => {
          // If the "Add New Food Item" option was selected, open the dialog instead
          if (isAddNewOption(value)) {
            creator.openDialog(selector.inputValue);
            return;
          }
          handleSelect(value);
        }}
        getOptionLabel={(option) => {
          if (isAddNewOption(option) && option.type === "foodItem") {
            return option.name;
          }
          return option.type === "foodItem" ? option.name : option.title;
        }}
        isOptionEqualToValue={(option, value) => {
          if (isAddNewOption(option) || isAddNewOption(value)) {
            return isAddNewOption(option) === isAddNewOption(value);
          }
          return option._id === value._id && option.type === value.type;
        }}
        renderOption={(props, option) => {
          const { key, ...otherProps } = props;

          // Special rendering for "Add New Food Item" option
          if (isAddNewOption(option) && option.type === "foodItem") {
            const addNewName = option.name;
            return (
              <Box
                component="li"
                key={key}
                {...otherProps}
                sx={{ p: "8px !important" }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    creator.openDialog(selector.inputValue);
                  }}
                  sx={{ justifyContent: "flex-start", textTransform: "none" }}
                >
                  {addNewName}
                </Button>
              </Box>
            );
          }

          // Regular option rendering
          return (
            <Box component="li" key={key} {...otherProps}>
              <Box>
                <Typography variant="body1">
                  {option.type === "foodItem" ? option.name : option.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ({option.type === "foodItem" ? "Food Item" : "Recipe"})
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
            onKeyDown={(e) => {
              // Override Enter key handling to ensure proper selection
              if (e.key === "Enter") {
                // If an item is already selected, don't do anything
                if (selectedItem) {
                  e.preventDefault();
                  return;
                }

                // If there are search results, select the currently highlighted option (or first one)
                if (selector.options.length > 0) {
                  e.preventDefault();
                  // Use the hook's selectedIndex to get the currently highlighted option
                  const highlightedIndex = selector.selectedIndex || 0;
                  const optionToSelect =
                    selector.options[highlightedIndex] || selector.options[0];
                  // Trigger the Autocomplete's onChange to properly select the item
                  handleSelect(optionToSelect);
                  return;
                }

                // The hook's handleKeyDown will trigger creation when there are no search options.
                // We need to prevent that if "Add New Food Item" option isn't available.
                if (!shouldShowAddNewOption && selector.inputValue.trim()) {
                  // Prevent the hook from triggering creation when option isn't available
                  e.preventDefault();
                  return;
                }
              }
              selector.handleKeyDown(e);
            }}
            autoFocus={autoFocus}
            disabled={disabled}
          />
        )}
        noOptionsText={
          selector.inputValue.trim() ? (
            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {allowRecipes
                  ? "No food items or recipes found"
                  : "No food items found"}
              </Typography>
              {!inputMatchesExcludedItem && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleOpenCreate}
                >
                  {`Add "${selector.inputValue}" as a Food Item`}
                </Button>
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {allowRecipes
                ? "Start typing to search for food items or recipes"
                : "Start typing to search for food items"}
            </Typography>
          )
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
