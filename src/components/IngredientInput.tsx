"use client";

import { useState, useEffect } from 'react';
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
import { fetchFoodItems, getUnitOptions } from '../lib/food-items-utils';
import AddFoodItemDialog from './AddFoodItemDialog';

interface IngredientInputProps {
  ingredients: RecipeIngredientList[];
  onChange: (ingredients: RecipeIngredientList[]) => void;
  foodItems?: Array<{_id: string, name: string, singularName: string, pluralName: string, unit: string}>;
  onFoodItemAdded?: (newFoodItem: {_id: string, name: string, singularName: string, pluralName: string, unit: string}) => void;
}

interface FoodItem {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
}

export default function IngredientInput({ ingredients, onChange, foodItems: propFoodItems, onFoodItemAdded }: IngredientInputProps) {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [prefillName, setPrefillName] = useState('');
  const [inputTexts, setInputTexts] = useState<string[][]>([]);
  const [pendingSelection, setPendingSelection] = useState<{ listIndex: number; ingredientIndex: number } | null>(null);

  const loadFoodItems = async () => {
    try {
      setLoading(true);
      const items = await fetchFoodItems();
      setFoodItems(items);
    } catch (error) {
      console.error('Error loading food items:', error);
      setError('Failed to load food items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propFoodItems) {
      // Use props if provided
      setFoodItems(propFoodItems);
      setLoading(false);
    } else {
      // Fall back to loading from API
      loadFoodItems();
    }
  }, [propFoodItems]);

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
      foodItemId: '',
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

  const handleFoodItemSelect = (listIndex: number, ingredientIndex: number, foodItem: FoodItem | null) => {
    if (foodItem) {
      handleIngredientChange(listIndex, ingredientIndex, 'foodItemId', foodItem._id);
      // Auto-set the unit to match the food item's unit
      handleIngredientChange(listIndex, ingredientIndex, 'unit', foodItem.unit);
      // Clear the input text when a food item is selected
      setInputTexts(prev => {
        const newTexts = [...prev];
        if (!newTexts[listIndex]) newTexts[listIndex] = [];
        newTexts[listIndex][ingredientIndex] = '';
        return newTexts;
      });
    } else {
      // Clear the food item ID when selection is cleared
      handleIngredientChange(listIndex, ingredientIndex, 'foodItemId', '');
    }
  };

  const handleInputChange = (listIndex: number, ingredientIndex: number, value: string) => {
    setInputTexts(prev => {
      const newTexts = [...prev];
      if (!newTexts[listIndex]) newTexts[listIndex] = [];
      newTexts[listIndex][ingredientIndex] = value;
      return newTexts;
    });
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
      
      // Close the dialog
      setAddDialogOpen(false);
      
      // Automatically select the newly created food item for the pending selection
      if (pendingSelection) {
        handleFoodItemSelect(pendingSelection.listIndex, pendingSelection.ingredientIndex, newFoodItem);
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

  // Get filtered food items for a specific ingredient group (exclude already selected items)
  const getFilteredFoodItems = (listIndex: number, currentIngredientIndex: number) => {
    const selectedFoodItemIds = ingredients[listIndex].ingredients
      .map((ingredient, index) => index !== currentIngredientIndex ? ingredient.foodItemId : null)
      .filter(id => id !== null && id !== '');
    
    return foodItems.filter(item => !selectedFoodItemIds.includes(item._id));
  };

  // Custom filter function that returns empty array when no matches found
  const filterOptions = (options: FoodItem[], { inputValue }: { inputValue: string }) => {
    if (!inputValue) return options;
    const filtered = options.filter(option => 
      option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
      option.singularName.toLowerCase().includes(inputValue.toLowerCase()) ||
      option.pluralName.toLowerCase().includes(inputValue.toLowerCase())
    );
    return filtered;
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
          {ingredients[0].ingredients.map((ingredient, ingredientIndex) => (
            <Paper key={ingredientIndex} sx={{ p: 2, mb: 2 }}>
              <Box 
                display="flex" 
                gap={2} 
                alignItems="flex-start"
                flexDirection={{ xs: 'column', sm: 'row' }}
              >
                <Box flex={1} width="100%">
                  <Autocomplete
                    options={getFilteredFoodItems(0, ingredientIndex)}
                    getOptionLabel={(option) => option.name}
                    loading={loading}
                    value={foodItems.find(item => item._id === ingredient.foodItemId) || null}
                    onChange={(_, value) => handleFoodItemSelect(0, ingredientIndex, value)}
                    onInputChange={(_, value) => handleInputChange(0, ingredientIndex, value)}
                    filterOptions={filterOptions}
                    onKeyUp={(e) => {
                      if (e.key === 'Enter') {
                        const currentInput = inputTexts[0]?.[ingredientIndex] || '';
                        if (currentInput) {
                          // Use setTimeout to ensure the filtering has completed
                          setTimeout(() => {
                            const filteredOptions = filterOptions(getFilteredFoodItems(0, ingredientIndex), { inputValue: currentInput });
                            if (filteredOptions.length === 0) {
                              openAddDialog(0, ingredientIndex);
                            }
                          }, 0);
                        }
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Food Item"
                        required
                        fullWidth
                        size="small"
                      />
                    )}
                    noOptionsText={
                      <Box>
                        <Typography variant="body2" color="text.secondary" mb={1}>
                          No food items found
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openAddDialog(0, ingredientIndex)}
                        >
                          {inputTexts[0]?.[ingredientIndex] 
                            ? `Add "${inputTexts[0][ingredientIndex]}" as a Food Item` 
                            : 'Add New Food Item'
                          }
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
                    value={ingredient.quantity}
                    onChange={(e) => handleIngredientChange(0, ingredientIndex, 'quantity', parseFloat(e.target.value) || 0)}
                    sx={{ 
                      width: { xs: '100%', sm: 100 },
                      minWidth: { xs: 'auto', sm: 100 }
                    }}
                    size="small"
                    slotProps={{
                      htmlInput: {
                          min: 0
                      }
                    }}
                  />
                  
                  <Autocomplete
                    options={getUnitOptions()}
                    value={getUnitOptions().find(option => option.value === ingredient.unit) || null}
                    onChange={(_, value) => handleIngredientChange(0, ingredientIndex, 'unit', value?.value || 'cup')}
                    getOptionLabel={(option) => option.label}
                    isOptionEqualToValue={(option, value) => option.value === value.value}
                    sx={{ 
                      width: { xs: '100%', sm: 120 },
                      minWidth: { xs: 'auto', sm: 120 }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Unit"
                        size="small"
                      />
                    )}
                  />
                  
                  <IconButton
                    onClick={() => handleRemoveIngredient(0, ingredientIndex)}
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
                    onClick={() => handleRemoveIngredient(0, ingredientIndex)}
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
          ))}

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
              {list.ingredients.map((ingredient, ingredientIndex) => (
                <Box key={ingredientIndex} sx={{ mb: 2 }}>
                  <Box 
                    display="flex" 
                    gap={2} 
                    alignItems="flex-start"
                    flexDirection={{ xs: 'column', sm: 'row' }}
                  >
                    <Box flex={1} width="100%">
                      <Autocomplete
                        options={getFilteredFoodItems(listIndex, ingredientIndex)}
                        getOptionLabel={(option) => option.name}
                        loading={loading}
                        value={foodItems.find(item => item._id === ingredient.foodItemId) || null}
                        onChange={(_, value) => handleFoodItemSelect(listIndex, ingredientIndex, value)}
                        onInputChange={(_, value) => handleInputChange(listIndex, ingredientIndex, value)}
                        filterOptions={filterOptions}
                        onKeyUp={(e) => {
                          if (e.key === 'Enter') {
                            const currentInput = inputTexts[listIndex]?.[ingredientIndex] || '';
                            if (currentInput) {
                              // Use setTimeout to ensure the filtering has completed
                              setTimeout(() => {
                                const filteredOptions = filterOptions(getFilteredFoodItems(listIndex, ingredientIndex), { inputValue: currentInput });
                                if (filteredOptions.length === 0) {
                                  openAddDialog(listIndex, ingredientIndex);
                                }
                              }, 0);
                            }
                          }
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Food Item"
                            required
                            fullWidth
                            size="small"
                          />
                        )}
                        noOptionsText={
                          <Box>
                            <Typography variant="body2" color="text.secondary" mb={1}>
                              No food items found
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => openAddDialog(listIndex, ingredientIndex)}
                            >
                              {inputTexts[listIndex]?.[ingredientIndex] 
                                ? `Add "${inputTexts[listIndex][ingredientIndex]}" as a Food Item` 
                                : 'Add New Food Item'
                              }
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
                        value={ingredient.quantity}
                        onChange={(e) => handleIngredientChange(listIndex, ingredientIndex, 'quantity', parseFloat(e.target.value) || 0)}
                        sx={{ 
                          width: { xs: '100%', sm: 100 },
                          minWidth: { xs: 'auto', sm: 100 }
                        }}
                        size="small"
                        slotProps={{
                          htmlInput: {
                              min: 0
                          }
                        }}
                      />
                      
                      <Autocomplete
                        options={getUnitOptions()}
                        value={getUnitOptions().find(option => option.value === ingredient.unit) || null}
                        onChange={(_, value) => handleIngredientChange(listIndex, ingredientIndex, 'unit', value?.value || 'cup')}
                        getOptionLabel={(option) => option.label}
                        isOptionEqualToValue={(option, value) => option.value === value.value}
                        sx={{ 
                          width: { xs: '100%', sm: 120 },
                          minWidth: { xs: 'auto', sm: 120 }
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Unit"
                            size="small"
                          />
                        )}
                      />
                      
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
                </Box>
              ))}

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