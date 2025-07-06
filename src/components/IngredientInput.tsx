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
import { Delete, Add, AddCircle } from '@mui/icons-material';
import { RecipeIngredient, RecipeIngredientList } from '../types/recipe';
import { getUnitOptions } from '../lib/food-items-utils';
import AddFoodItemDialog from './AddFoodItemDialog';

interface IngredientInputProps {
  ingredients: RecipeIngredientList[];
  onChange: (ingredients: RecipeIngredientList[]) => void;
  foodItems?: Array<{_id: string, name: string, singularName: string, pluralName: string, unit: string}>;
  onFoodItemAdded?: (newFoodItem: {_id: string, name: string, singularName: string, pluralName: string, unit: string}) => void;
  currentRecipeId?: string; // ID of the current recipe being edited (to prevent self-reference)
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

export default function IngredientInput({ ingredients, onChange, onFoodItemAdded, currentRecipeId }: IngredientInputProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [prefillName, setPrefillName] = useState('');
  const [inputTexts, setInputTexts] = useState<string[][]>([]);
  const [pendingSelection, setPendingSelection] = useState<{ listIndex: number; ingredientIndex: number } | null>(null);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  
  // Per-slot search state for real-time search
  const [slotSearch, setSlotSearch] = useState<{ [slot: string]: { input: string; options: SearchOption[]; loading: boolean; selectedIndex: number } }>({});
  const searchTimeouts = useRef<{ [slot: string]: NodeJS.Timeout }>({});
  const autocompleteRefs = useRef<{ [slot: string]: HTMLInputElement | null }>({});

  // Load food items and recipes on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [foodRes, recipeRes] = await Promise.all([
          fetch('/api/food-items?limit=1000'),
          fetch('/api/recipes?limit=1000')
        ]);
        const foodItemsData = foodRes.ok ? await foodRes.json() : [];
        const recipesData = recipeRes.ok ? await recipeRes.json() : [];
        setFoodItems(foodItemsData);
        setRecipes(recipesData);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    
    loadData();
  }, []);

  // Real-time search for a slot
  const searchSlot = useCallback((slot: string, input: string) => {
    setSlotSearch(prev => ({
      ...prev,
      [slot]: { ...prev[slot], loading: true, input, selectedIndex: 0 }
    }));
    // Debounce
    if (searchTimeouts.current[slot]) clearTimeout(searchTimeouts.current[slot]);
    searchTimeouts.current[slot] = setTimeout(async () => {
      if (!input.trim()) {
        setSlotSearch(prev => ({ ...prev, [slot]: { input, options: [], loading: false, selectedIndex: 0 } }));
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
        setSlotSearch(prev => ({ ...prev, [slot]: { input, options, loading: false, selectedIndex: 0 } }));
      } catch {
        setSlotSearch(prev => ({ ...prev, [slot]: { input, options: [], loading: false, selectedIndex: 0 } }));
      }
    }, 300);
  }, []);



  // Initialize input texts array when ingredients change
  useEffect(() => {
    setInputTexts(() => {
      const newInputTexts: string[][] = [];
      ingredients.forEach((list, listIndex) => {
        newInputTexts[listIndex] = [];
        list.ingredients.forEach((_, ingredientIndex) => {
          if (!newInputTexts[listIndex][ingredientIndex]) {
            newInputTexts[listIndex][ingredientIndex] = '';
          }
        });
      });
      return newInputTexts;
    });
  }, [ingredients]);

  const handleAddIngredientList = () => {
    const newList: RecipeIngredientList = {
      title: '',
      ingredients: []
    };
    onChange([...ingredients, newList]);
  };

  const handleRemoveIngredientList = (listIndex: number) => {
    const newIngredients = ingredients.filter((_, i) => i !== listIndex);
    onChange(newIngredients);
    
    // Remove the corresponding input texts
    setInputTexts(prev => prev.filter((_, i) => i !== listIndex));
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
    
    // Focus the new autocomplete after a short delay to ensure it's rendered
    setTimeout(() => {
      const newIngredientIndex = newIngredients[listIndex].ingredients.length - 1;
      const slot = `${listIndex}-${newIngredientIndex}`;
      const autocompleteRef = autocompleteRefs.current[slot];
      if (autocompleteRef && autocompleteRef.focus) {
        autocompleteRef.focus();
      }
    }, 100);
  };

  const handleRemoveIngredient = (listIndex: number, ingredientIndex: number) => {
    const newIngredients = [...ingredients];
    newIngredients[listIndex].ingredients = newIngredients[listIndex].ingredients.filter((_, i) => i !== ingredientIndex);
    onChange(newIngredients);
    
    // Remove the corresponding input text
    setInputTexts(prev => {
      const newTexts = [...prev];
      newTexts[listIndex] = newTexts[listIndex].filter((_, i) => i !== ingredientIndex);
      return newTexts;
    });
  };

  const handleIngredientChange = (listIndex: number, ingredientIndex: number, field: keyof RecipeIngredient, value: string | number) => {
    const newIngredients = [...ingredients];
    newIngredients[listIndex].ingredients[ingredientIndex] = { 
      ...newIngredients[listIndex].ingredients[ingredientIndex], 
      [field]: value 
    };
    onChange(newIngredients);
  };

  const handleListTitleChange = (listIndex: number, title: string) => {
    const newIngredients = [...ingredients];
    newIngredients[listIndex].title = title;
    onChange(newIngredients);
  };

  const handleItemSelect = (listIndex: number, ingredientIndex: number, item: SearchOption | null) => {
    if (item) {
      const newIngredient: RecipeIngredient = {
        type: item.type,
        id: item._id || '',
        quantity: 1,
        unit: item.type === 'foodItem' ? item.unit : undefined
      };
      
      const newIngredients = [...ingredients];
      newIngredients[listIndex].ingredients[ingredientIndex] = newIngredient;
      onChange(newIngredients);
      
      // Clear the input text and search results when an item is selected
      setInputTexts(prev => {
        const newTexts = [...prev];
        if (!newTexts[listIndex]) newTexts[listIndex] = [];
        newTexts[listIndex][ingredientIndex] = '';
        return newTexts;
      });
      
      const slot = `${listIndex}-${ingredientIndex}`;
      setSlotSearch(prev => ({ ...prev, [slot]: { input: '', options: [], loading: false, selectedIndex: 0 } }));
      
      // Auto-add a new ingredient and focus it
      setTimeout(() => {
        const newIngredientIndex = newIngredients[listIndex].ingredients.length;
        const autoNewIngredient: RecipeIngredient = {
          type: 'foodItem',
          id: '',
          quantity: 1,
          unit: 'cup',
        };
        const updatedIngredients = [...newIngredients];
        updatedIngredients[listIndex].ingredients.push(autoNewIngredient);
        onChange(updatedIngredients);
        
        // Focus the new autocomplete
        setTimeout(() => {
          const newSlot = `${listIndex}-${newIngredientIndex}`;
          const autocompleteRef = autocompleteRefs.current[newSlot];
          if (autocompleteRef && autocompleteRef.focus) {
            autocompleteRef.focus();
          }
        }, 100);
      }, 100);
    } else {
      // Clear the ingredient when selection is cleared
      const newIngredients = [...ingredients];
      newIngredients[listIndex].ingredients[ingredientIndex] = {
        type: 'foodItem',
        id: '',
        quantity: 1,
        unit: 'cup'
      };
      onChange(newIngredients);
    }
  };

  const handleInputChange = (listIndex: number, ingredientIndex: number, value: string) => {
    setInputTexts(prev => {
      const newTexts = [...prev];
      if (!newTexts[listIndex]) newTexts[listIndex] = [];
      newTexts[listIndex][ingredientIndex] = value;
      return newTexts;
    });
    
    // Perform real-time search
    const slot = `${listIndex}-${ingredientIndex}`;
    searchSlot(slot, value);
  };

  const handleKeyDown = (listIndex: number, ingredientIndex: number, event: React.KeyboardEvent) => {
    const slot = `${listIndex}-${ingredientIndex}`;
    const slotData = slotSearch[slot];
    
    if (event.key === 'Enter') {
      event.preventDefault();
      
      // Check if we're in the middle of a search
      if (isInSearch(listIndex, ingredientIndex)) {
              // Get the actual filtered options (which excludes already selected items)
      const filteredOptions = getFilteredOptions(listIndex, ingredientIndex);
      
      if (filteredOptions.length === 0) {
        // No options available, start create food item flow
        openAddDialog(listIndex, ingredientIndex);
      } else {
        // Select the currently highlighted option
        const selectedOption = filteredOptions[slotData?.selectedIndex || 0];
        if (selectedOption) {
          handleItemSelect(listIndex, ingredientIndex, selectedOption);
        }
      }
      } else {
        // Not in search mode, don't do anything on Enter
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (isInSearch(listIndex, ingredientIndex)) {
        const filteredOptions = getFilteredOptions(listIndex, ingredientIndex);
        if (filteredOptions.length > 0) {
          const newIndex = Math.min((slotData?.selectedIndex || 0) + 1, filteredOptions.length - 1);
          setSlotSearch(prev => ({
            ...prev,
            [slot]: { ...slotData, selectedIndex: newIndex }
          }));
        }
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (isInSearch(listIndex, ingredientIndex)) {
        const filteredOptions = getFilteredOptions(listIndex, ingredientIndex);
        if (filteredOptions.length > 0) {
          const newIndex = Math.max((slotData?.selectedIndex || 0) - 1, 0);
          setSlotSearch(prev => ({
            ...prev,
            [slot]: { ...slotData, selectedIndex: newIndex }
          }));
        }
      }
    }
  };

  const openAddDialog = (listIndex: number, ingredientIndex: number) => {
    const inputText = inputTexts[listIndex]?.[ingredientIndex] || '';
    setPrefillName(inputText);
    setPendingSelection({ listIndex, ingredientIndex });
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
      
      // Add the new food item to the local state
      setFoodItems(prev => [...prev, newFoodItem]);
      
      // Close the dialog
      setAddDialogOpen(false);
      
      // Automatically select the newly created food item for the pending selection
      if (pendingSelection) {
        handleItemSelect(pendingSelection.listIndex, pendingSelection.ingredientIndex, { ...newFoodItem, type: 'foodItem' as const });
        setPendingSelection(null);
      }
      
      // Notify parent component about the new food item
      if (onFoodItemAdded) {
        onFoodItemAdded(newFoodItem);
      }
      
      // Show success message (you could add a toast notification here)
      console.log('Food item added successfully:', newFoodItem);
    } catch (error) {
      console.error('Error adding food item:', error);
      setError(error instanceof Error ? error.message : 'Failed to add food item');
    }
  };

  // Get filtered options for a specific ingredient (exclude already selected items)
  const getFilteredOptions = (listIndex: number, currentIngredientIndex: number) => {
    const selectedIds = ingredients[listIndex].ingredients
      .map((ingredient, index) => index !== currentIngredientIndex ? ingredient.id : null)
      .filter(id => id !== null && id !== '');
    
    const slot = `${listIndex}-${currentIngredientIndex}`;
    const slotData = slotSearch[slot];
    

    
    // If there's no search input, load all available items
    if (!slotData?.input || slotData.input.trim() === '') {
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
    if (slotData?.input && (!slotData.options || slotData.options.length === 0)) {
      return [];
    }
    
    // Otherwise use search results
    const options = slotData?.options || [];
    const filtered = options.filter(option => 
      !selectedIds.includes(option._id || '') && 
      !(currentRecipeId && option.type === 'recipe' && option._id === currentRecipeId)
    );
    return filtered;
  };

  // Check if we're in the middle of a search (to prevent fallback to all items)
  const isInSearch = (listIndex: number, ingredientIndex: number) => {
    const slot = `${listIndex}-${ingredientIndex}`;
    const slotData = slotSearch[slot];
    return slotData?.input && slotData.input.trim() !== '';
  };

  // Get the currently selected option for a specific ingredient
  const getSelectedOption = (listIndex: number, ingredientIndex: number): SearchOption | null => {
    const ingredient = ingredients[listIndex]?.ingredients[ingredientIndex];
    if (!ingredient || !ingredient.id) return null;
    
    if (ingredient.type === 'foodItem') {
      const foodItem = foodItems.find(item => item._id === ingredient.id);
      return foodItem ? { ...foodItem, type: 'foodItem' as const } : null;
    } else {
      const recipe = recipes.find(item => item._id === ingredient.id);
      return recipe ? { ...recipe, type: 'recipe' as const } : null;
    }
  };

  // Render a single ingredient input (DRY helper)
  const renderIngredientInput = (listIndex: number, ingredientIndex: number) => {
    const slot = `${listIndex}-${ingredientIndex}`;
    const slotData = slotSearch[slot];
    
    return (
      <Paper key={ingredientIndex} sx={{ p: 2, mb: 2 }}>
        <Box 
          display="flex" 
          gap={2} 
          alignItems="flex-start"
          flexDirection={{ xs: 'column', sm: 'row' }}
        >
          <Box flex={1} width="100%">
            <Autocomplete
              options={getFilteredOptions(listIndex, ingredientIndex)}
              getOptionLabel={(option) => {
                if (option.type === 'foodItem') {
                  return option.name || '[Unknown Food Item]';
                } else {
                  return option.title || '[Unknown Recipe]';
                }
              }}
              loading={slotData?.loading || false}
              inputValue={slotData?.input || ''}
              value={getSelectedOption(listIndex, ingredientIndex)}
              onChange={(_, value) => handleItemSelect(listIndex, ingredientIndex, value)}
              onInputChange={(_, value) => handleInputChange(listIndex, ingredientIndex, value)}
              filterOptions={(options) => options}
              onKeyDown={(e) => handleKeyDown(listIndex, ingredientIndex, e)}
              renderOption={(props, option, { index }) => {
                const { key, ...otherProps } = props;
                const isSelected = slotData?.selectedIndex === index;
                
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
                    autocompleteRefs.current[slot] = input;
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
                    onClick={() => openAddDialog(listIndex, ingredientIndex)}
                  >
                    {slotData?.input
                      ? `Add "${slotData.input}" as a Food Item`
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
              value={ingredients[listIndex].ingredients[ingredientIndex].quantity > 0 ? ingredients[listIndex].ingredients[ingredientIndex].quantity : ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                // Allow any non-negative value during editing (including 0 and NaN for empty field)
                if (!isNaN(value) && value >= 0) {
                  handleIngredientChange(listIndex, ingredientIndex, 'quantity', value);
                } else if (e.target.value === '') {
                  // Allow empty field for editing
                  handleIngredientChange(listIndex, ingredientIndex, 'quantity', 0);
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
              error={ingredients[listIndex].ingredients[ingredientIndex].quantity <= 0}
              helperText={ingredients[listIndex].ingredients[ingredientIndex].quantity <= 0 ? 'Quantity must be greater than 0' : ''}
            />
            
            {ingredients[listIndex].ingredients[ingredientIndex].type === 'foodItem' && (
              <Autocomplete
                options={getUnitOptions()}
                value={getUnitOptions().find(option => option.value === ingredients[listIndex].ingredients[ingredientIndex].unit) ?? undefined}
                onChange={(_, value) => handleIngredientChange(listIndex, ingredientIndex, 'unit', value?.value || 'cup')}
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
              onClick={() => handleRemoveIngredient(listIndex, ingredientIndex)}
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
              onClick={() => handleRemoveIngredient(listIndex, ingredientIndex)}
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
              Remove Ingredient
            </Button>
          </Box>
        </Box>
      </Paper>
    );
  };



  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {ingredients.length === 1 ? (
        // Simplified UI for single ingredient group
        <Box>
          {ingredients[0].ingredients.map((ingredient, ingredientIndex) => 
            renderIngredientInput(0, ingredientIndex)
          )}

          <Button
            startIcon={<Add />}
            onClick={() => handleAddIngredient(0)}
            variant="outlined"
            size="small"
            sx={{ mt: 1 }}
          >
            Add Ingredient
          </Button>

          {ingredients[0].ingredients.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              No ingredients added yet. Click &quot;Add Ingredient&quot; to get started.
            </Typography>
          )}
        </Box>
      ) : (
        // Full sub-list UI for multiple ingredient groups
        ingredients.map((list, listIndex) => (
          <Paper key={listIndex} sx={{ p: 2, mb: 2 }}>
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
                sx={{ 
                  flex: 1, 
                  width: { xs: '100%', sm: 'auto' },
                  mr: { xs: 0, sm: 2 }
                }}
                required
                error={!list.title}
                helperText={!list.title ? 'Title is required for ingredient groups' : ''}
              />
              
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
            </Box>

            <Box>
              {list.ingredients.map((ingredient, ingredientIndex) => 
                renderIngredientInput(listIndex, ingredientIndex)
              )}

              <Button
                startIcon={<Add />}
                onClick={() => handleAddIngredient(listIndex)}
                variant="outlined"
                size="small"
                sx={{ mt: 1 }}
              >
                Add Ingredient
              </Button>

              {list.ingredients.length === 0 && (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                  No ingredients in this group. Click &quot;Add Ingredient&quot; to get started.
                </Typography>
              )}
            </Box>
          </Paper>
        ))
      )}

      {ingredients.length === 0 && (
        <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
          No ingredient groups added yet. Click the + button to add an ingredient group.
        </Typography>
      )}

      <Box display="flex" justifyContent="flex-start" mt={2}>
        <Button
          onClick={handleAddIngredientList}
          startIcon={<AddCircle />}
          variant="outlined"
          size="small"
          title="Add ingredient group"
        >
          Add Ingredient Group
        </Button>
      </Box>

      <AddFoodItemDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddFoodItem}
        prefillName={prefillName}
      />
    </Box>
  );
} 