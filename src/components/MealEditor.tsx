"use client";

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import { Group, Add } from '@mui/icons-material';
import { RecipeIngredientList } from '../types/recipe';
import IngredientInput from './IngredientInput';
import IngredientGroup from './IngredientGroup';

interface FoodItem {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
  isGlobal: boolean;
}

interface Recipe {
  _id?: string;
  title: string;
  emoji?: string;
}

interface MealItem {
  type: 'foodItem' | 'recipe' | 'ingredientGroup';
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  ingredients?: RecipeIngredientList[]; // For ingredient groups
}

interface MealEditorProps {
  mealItems: MealItem[];
  onChange: (items: MealItem[]) => void;
  onFoodItemAdded?: (newFoodItem: { name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean; }) => Promise<void>;
  removeItemButtonText?: string; // Text for remove button on items within ingredient groups
}

export default function MealEditor({ 
  mealItems, 
  onChange, 
  onFoodItemAdded,
  removeItemButtonText = "Remove Meal Item"
}: MealEditorProps) {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState('');
  
  // Store the last created food item temporarily for auto-selection
  const lastCreatedFoodItemRef = useRef<FoodItem | null>(null);

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

  // Handle food item creation and update local state
  const handleFoodItemAdded = async (newFoodItem: FoodItem | { name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean }) => {
    // Add the new food item to local state if it has _id (already created)
    if ('_id' in newFoodItem) {
      setFoodItems(prev => {
        const newItems = [...prev, newFoodItem as FoodItem];
        return newItems;
      });
      
      // Store the newly created food item temporarily so we can use it in onIngredientChange
      // This will be used when the auto-selection happens before the state update
      lastCreatedFoodItemRef.current = newFoodItem;
    }
    
    // Also notify parent component if callback exists
    if (onFoodItemAdded) {
      await onFoodItemAdded(newFoodItem as { name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean });
    }
  };

  const handleAddMealItem = () => {
    const newItem: MealItem = {
      type: 'foodItem', // Default to foodItem, but IngredientInput will allow selecting recipes too
      id: '',
      name: '',
      quantity: 1,
      unit: 'cup'
    };
    onChange([...mealItems, newItem]);
  };

  const handleAddIngredientGroup = () => {
    const newItem: MealItem = {
      type: 'ingredientGroup',
      id: '',
      name: '',
      ingredients: [{
        title: '',
        ingredients: []
      }]
    };
    onChange([...mealItems, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = mealItems.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleItemChange = (index: number, updatedItem: MealItem) => {
    const newItems = [...mealItems];
    newItems[index] = updatedItem;
    onChange(newItems);
  };

  const handleIngredientGroupChange = (index: number, ingredients: RecipeIngredientList[]) => {
    const newItems = [...mealItems];
    if (newItems[index].type === 'ingredientGroup') {
      newItems[index] = {
        ...newItems[index],
        ingredients
      };
      onChange(newItems);
    }
  };

  // Get all selected IDs for exclusion
  const getAllSelectedIds = () => {
    return mealItems
      .filter(item => item.id && item.id.trim() !== '')
      .map(item => item.id);
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Meal Items */}
      {mealItems.map((item, index) => (
        <Box key={index} sx={{ mb: 2 }}>

          {(item.type === 'foodItem' || item.type === 'recipe') && (
            <IngredientInput
              ingredient={{
                type: item.type, // Use the actual type from the meal item
                id: item.id,
                quantity: item.quantity || 1,
                unit: item.unit || 'cup',
                name: item.name // ✅ Preserve the name from the meal item
              }}
              onIngredientChange={(updatedIngredient) => {
                let itemName = '';
                
                // Always look up the name to ensure it's correct
                if (updatedIngredient.id) {
                  const foodItem = foodItems.find(f => f._id === updatedIngredient.id);
                  const recipe = recipes.find(r => r._id === updatedIngredient.id);
                  
                  if (foodItem) {
                    // For food items, use singular/plural based on quantity
                    itemName = updatedIngredient.quantity === 1 ? foodItem.singularName : foodItem.pluralName;
                  } else if (recipe) {
                    // For recipes, use the title
                    itemName = recipe.title;
                  } else if (lastCreatedFoodItemRef.current && lastCreatedFoodItemRef.current._id === updatedIngredient.id) {
                    // Use newly created food item (before it's in foodItems state)
                    itemName = lastCreatedFoodItemRef.current.name;
                    lastCreatedFoodItemRef.current = null;
                  } else if (updatedIngredient.name) {
                    // Fall back to the name from updatedIngredient (might be stale but better than nothing)
                    itemName = updatedIngredient.name;
                  }
                }
                
                // Update the meal item with the ingredient data
                handleItemChange(index, {
                  type: updatedIngredient.type,
                  id: updatedIngredient.id,
                  name: itemName,
                  quantity: updatedIngredient.quantity,
                  unit: updatedIngredient.unit
                });
              }}
              onRemove={() => handleRemoveItem(index)}
              foodItems={foodItems}
              onFoodItemAdded={handleFoodItemAdded}
              selectedIds={getAllSelectedIds().filter(id => id !== item.id)}
              slotId={`meal-item-${index}`}
              removeButtonText="Remove Meal Item"
            />
          )}

          {item.type === 'ingredientGroup' && item.ingredients && item.ingredients.length > 0 && (
            <IngredientGroup
              group={item.ingredients[0]}
              onChange={(group) => handleIngredientGroupChange(index, [group])}
              onRemove={() => handleRemoveItem(index)}
              foodItems={foodItems}
              onFoodItemAdded={handleFoodItemAdded}
              addIngredientButtonText="Add Ingredient"
              emptyGroupText="No ingredients in this group. Click 'Add Ingredient' to begin."
              removeIngredientButtonText={removeItemButtonText}
            />
          )}
        </Box>
      ))}

      {mealItems.length === 0 && (
        <Typography variant="body2" color="text.secondary" textAlign="center" py={1}>
          Use the buttons below to add items.
        </Typography>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 1, mt: 3, flexWrap: 'wrap' }}>
        <Button
          startIcon={<Add />}
          onClick={handleAddMealItem}
          variant="outlined"
          size="small"
        >
          Add Meal Item
        </Button>
        <Button
          startIcon={<Group />}
          onClick={handleAddIngredientGroup}
          variant="outlined"
          size="small"
        >
          Add Meal Item Group
        </Button>
      </Box>
    </Box>
  );
}
