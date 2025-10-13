"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Autocomplete,
  Typography,
  Paper,
  Button,
  Alert,
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import { RecipeIngredient } from '../types/recipe';
import { getUnitOptions } from '../lib/food-items-utils';
import AddFoodItemDialog from './AddFoodItemDialog';

interface IngredientInputProps {
  ingredient: RecipeIngredient;
  onIngredientChange: (ingredient: RecipeIngredient) => void;
  onRemove: () => void;
  foodItems?: Array<{_id: string, name: string, singularName: string, pluralName: string, unit: string}>;
  onFoodItemAdded?: (newFoodItem: { name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean; }) => Promise<void>;
  currentRecipeId?: string; // ID of the current recipe being edited (to prevent self-reference)
  selectedIds?: string[]; // IDs of other selected ingredients to exclude from options
  slotId: string; // Unique identifier for this ingredient slot
  autoFocus?: boolean; // Whether to auto-focus the input when component mounts
  // Custom text overrides
  removeButtonText?: string;
}

interface FoodItem {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
}

interface Recipe {
  _id?: string;
  title: string;
  emoji?: string;
}

type SearchOption = 
  | (FoodItem & { type: 'foodItem' })
  | (Recipe & { type: 'recipe' });

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
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [prefillName, setPrefillName] = useState('');
  const [pendingSelection, setPendingSelection] = useState<boolean>(false);
  const [localFoodItems, setLocalFoodItems] = useState<FoodItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  
  // Use prop foodItems if provided, otherwise use local state
  const foodItems = propFoodItems || localFoodItems;
  
  // Search state for this slot
  const [searchData, setSearchData] = useState<{ input: string; options: SearchOption[]; loading: boolean; selectedIndex: number }>({
    input: '',
    options: [],
    loading: false,
    selectedIndex: 0
  });
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const autocompleteRef = useRef<HTMLInputElement | null>(null);
  const quantityRef = useRef<HTMLInputElement | null>(null);

  // Load food items and recipes on mount (only if propFoodItems is not provided)
  useEffect(() => {
    if (propFoodItems) {
      // If propFoodItems is provided, we don't need to load food items
      return;
    }
    
    const loadData = async () => {
      try {
        const [foodRes, recipeRes] = await Promise.all([
          fetch('/api/food-items?limit=1000'),
          fetch('/api/recipes?limit=1000')
        ]);
        const foodItemsData = foodRes.ok ? await foodRes.json() : [];
        const recipesData = recipeRes.ok ? await recipeRes.json() : [];
        setLocalFoodItems(foodItemsData);
        setRecipes(recipesData);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    
    loadData();
  }, [propFoodItems]);

  // Auto-focus the input if autoFocus prop is true
  useEffect(() => {
    if (autoFocus && autocompleteRef.current) {
      autocompleteRef.current.focus();
    }
  }, [autoFocus]);

  // Real-time search
  const performSearch = useCallback((input: string) => {
    setSearchData(prev => ({ ...prev, loading: true, input, selectedIndex: 0 }));
    
    // Debounce
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      if (!input.trim()) {
        setSearchData(prev => ({ ...prev, input, options: [], loading: false, selectedIndex: 0 }));
        return;
      }
      try {
        const [foodRes, recipeRes] = await Promise.all([
          fetch(`/api/food-items?query=${encodeURIComponent(input)}&limit=20`),
          fetch(`/api/recipes?query=${encodeURIComponent(input)}&limit=20`)
        ]);
        const foodItems = foodRes.ok ? await foodRes.json() : [];
        const recipes = recipeRes.ok ? await recipeRes.json() : [];
        
        // Filter out items that don't actually match the search term
        const filteredFoodItems = foodItems.filter((item: FoodItem) => 
          item.name.toLowerCase().includes(input.toLowerCase()) ||
          item.singularName.toLowerCase().includes(input.toLowerCase()) ||
          item.pluralName.toLowerCase().includes(input.toLowerCase())
        );
        
        const filteredRecipes = recipes.filter((item: Recipe) => 
          item.title.toLowerCase().includes(input.toLowerCase())
        );
        
        const options = [
          ...filteredFoodItems.map((item: FoodItem) => ({ ...item, type: 'foodItem' as const })),
          ...filteredRecipes.map((item: Recipe) => ({ ...item, type: 'recipe' as const }))
        ];
        setSearchData(prev => ({ ...prev, input, options, loading: false, selectedIndex: 0 }));
      } catch {
        setSearchData(prev => ({ ...prev, input, options: [], loading: false, selectedIndex: 0 }));
      }
    }, 750);
  }, []);

  const handleItemSelect = (item: SearchOption | null) => {
    if (item) {
      const newIngredient: RecipeIngredient = {
        type: item.type,
        id: item._id || '',
        quantity: 1,
        unit: item.type === 'foodItem' ? item.unit : undefined,
        name: item.type === 'foodItem' ? item.singularName : item.title
      };
      
      onIngredientChange(newIngredient);
      
      // Clear the search results when an item is selected
      setSearchData(prev => ({ ...prev, input: '', options: [], loading: false, selectedIndex: 0 }));
      
      // Auto-advance to quantity field after a short delay to ensure component updates
      setTimeout(() => {
        if (quantityRef.current) {
          quantityRef.current.focus();
          // Select all text in the quantity field for easy editing
          quantityRef.current.select();
        }
      }, 100);
    } else {
      // Clear the ingredient when selection is cleared
      onIngredientChange({
        type: 'foodItem',
        id: '',
        quantity: 1,
        unit: 'cup'
      });
    }
  };

  const handleInputChange = (value: string, reason: string) => {
    // Update the input value for user typing and resets (when item is selected)
    setSearchData(prev => ({ ...prev, input: value }));
    
    // Only trigger search on user input, not on reset/clear events
    if (reason === 'input') {
      performSearch(value);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      
      // Check if we're in the middle of a search
      if (searchData.input && searchData.input.trim() !== '') {
        if (searchData.options.length === 0) {
          // No options available, start create food item flow
          openAddDialog();
        } else {
          // Select the currently highlighted option
          const selectedOption = searchData.options[searchData.selectedIndex || 0];
          if (selectedOption) {
            handleItemSelect(selectedOption);
          }
        }
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (searchData.options.length > 0) {
        const newIndex = Math.min((searchData.selectedIndex || 0) + 1, searchData.options.length - 1);
        setSearchData(prev => ({ ...prev, selectedIndex: newIndex }));
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (searchData.options.length > 0) {
        const newIndex = Math.max((searchData.selectedIndex || 0) - 1, 0);
        setSearchData(prev => ({ ...prev, selectedIndex: newIndex }));
      }
    }
  };

  const openAddDialog = () => {
    setPrefillName(searchData.input);
    setPendingSelection(true);
    setAddDialogOpen(true);
  };

  const handleAddFoodItem = async (foodItemData: { name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean }) => {
    try {
      const response = await fetch('/api/food-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(foodItemData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add food item');
      }

      const newFoodItem = await response.json();
      
      // Add the new food item to the local state only if we're not using prop foodItems
      if (!propFoodItems) {
        setLocalFoodItems(prev => [...prev, newFoodItem]);
      }
      
      // Close the dialog
      setAddDialogOpen(false);
      
      // Notify parent component about the new food item first (so parent state is updated)
      if (onFoodItemAdded) {
        await onFoodItemAdded(newFoodItem);
      }
      
      // Automatically select the newly created food item after parent state is updated
      if (pendingSelection) {
        // Use a small delay to ensure parent state update has propagated
        setTimeout(() => {
          // Convert newFoodItem to SearchOption format
          const searchOption: SearchOption = {
            ...newFoodItem,
            type: 'foodItem' as const
          };
          handleItemSelect(searchOption);
          setPendingSelection(false);
        }, 50);
      }
    } catch (error) {
      console.error('Error adding food item:', error);
      setError(error instanceof Error ? error.message : 'Failed to add food item');
    }
  };

  // Get filtered options (exclude already selected items)
  const getFilteredOptions = () => {
    // If there's no search input, load all available items
    if (!searchData.input || searchData.input.trim() === '') {
      const allOptions = [
        ...foodItems.map(item => ({ ...item, type: 'foodItem' as const })),
        ...recipes.map(item => ({ ...item, type: 'recipe' as const }))
      ];
      const filtered = allOptions.filter(option => 
        !selectedIds.includes(option._id || '') && 
        !(currentRecipeId && option.type === 'recipe' && option._id === currentRecipeId)
      );
      return filtered;
    }
    
    // If there's search input but no results, return empty array
    if (searchData.input && (!searchData.options || searchData.options.length === 0)) {
      return [];
    }
    
    // Otherwise use search results
    const options = searchData.options || [];
    const filtered = options.filter(option => 
      !selectedIds.includes(option._id || '') && 
      !(currentRecipeId && option.type === 'recipe' && option._id === currentRecipeId)
    );
    return filtered;
  };

  // Get the currently selected option
  const getSelectedOption = (): SearchOption | null => {
    if (!ingredient || !ingredient.id) return null;
    
    if (ingredient.type === 'foodItem') {
      const foodItem = foodItems.find(item => item._id === ingredient.id);
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

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box 
        display="flex" 
        gap={2} 
        alignItems="flex-start"
        flexDirection={{ xs: 'column', sm: 'row' }}
      >
        <Box flex={1} width="100%">
          <Autocomplete
            options={getFilteredOptions()}
            getOptionLabel={(option) => {
              if (option.type === 'foodItem') {
                return option.name || '[Unknown Food Item]';
  } else {
                return option.title || '[Unknown Recipe]';
              }
            }}
            loading={searchData.loading}
            inputValue={searchData.input}
            value={getSelectedOption()}
            onChange={(_, value) => handleItemSelect(value)}
            onInputChange={(_, value, reason) => handleInputChange(value, reason)}
            filterOptions={(options) => options}
            onKeyDown={handleKeyDown}
            renderOption={(props, option, { index }) => {
              const { key, ...otherProps } = props;
              const isSelected = searchData.selectedIndex === index;
              
    return (
                <Box 
                  component="li" 
                  key={key} 
                  {...otherProps}
                  sx={{
                    backgroundColor: isSelected ? 'action.selected' : 'transparent',
                    '&:hover': {
                      backgroundColor: isSelected ? 'action.selected' : 'action.hover'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {option.type === 'recipe' && (option as Recipe).emoji && (
                      <Typography variant="h6">{(option as Recipe).emoji}</Typography>
                    )}
                    <Typography>
                      {option.type === 'foodItem' ? (option as FoodItem).name : (option as Recipe).title}
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
                label="Food Item or Recipe"
                required
                fullWidth
                size="small"
                inputRef={(input) => {
                  autocompleteRef.current = input;
                }}
              />
            )}
            noOptionsText={
              <Box>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  No food items or recipes found
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={openAddDialog}
                >
                  {searchData.input
                    ? `Add "${searchData.input}" as a Food Item`
                    : 'Add New Food Item'}
                </Button>
              </Box>
            }
          />
        </Box>
        
        <Box 
          display="flex" 
          gap={2} 
          alignItems="flex-start"
          width={{ xs: '100%', sm: 'auto' }}
          flexDirection={{ xs: 'column', sm: 'row' }}
        >
          <TextField
            label="Quantity"
            type="number"
            value={ingredient.quantity > 0 ? ingredient.quantity : ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              // Allow any non-negative value during editing (including 0 and NaN for empty field)
              if (!isNaN(value) && value >= 0) {
                // Update name based on quantity for food items (singular/plural)
                let updatedName = ingredient.name;
                if (ingredient.type === 'foodItem' && ingredient.id) {
                  const foodItem = foodItems.find(item => item._id === ingredient.id);
                  if (foodItem) {
                    updatedName = value === 1 ? foodItem.singularName : foodItem.pluralName;
                  }
                }
                onIngredientChange({ ...ingredient, quantity: value, name: updatedName });
              } else if (e.target.value === '') {
                // Allow empty field for editing
                onIngredientChange({ ...ingredient, quantity: 0 });
              }
            }}
            sx={{ 
              width: { xs: '100%', sm: 100 },
              minWidth: { xs: 'auto', sm: 100 }
            }}
            size="small"
            slotProps={{
              htmlInput: {
                  min: 0,
                  step: 0.01
              }
            }}
            error={ingredient.quantity <= 0}
            helperText={ingredient.quantity <= 0 ? 'Must be > 0' : ''}
            inputRef={quantityRef}
          />
          
          {ingredient.type === 'foodItem' && (
            <Autocomplete
              options={getUnitOptions()}
              value={getUnitOptions().find(option => option.value === ingredient.unit) ?? undefined}
              onChange={(_, value) => onIngredientChange({ ...ingredient, unit: value?.value || 'cup' })}
              getOptionLabel={(option) => option.label}
              isOptionEqualToValue={(option, value) => option.value === value.value}
              disableClearable={true}
              sx={{ 
                width: { xs: '100%', sm: 220 },
                minWidth: { xs: 'auto', sm: 220 }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Unit"
                  size="small"
                />
              )}
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

      <AddFoodItemDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddFoodItem}
        prefillName={prefillName}
      />
    </Paper>
  );
} 