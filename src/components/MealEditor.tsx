"use client";

import { useState, useEffect } from 'react';
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
}

export default function MealEditor({ 
  mealItems, 
  onChange, 
  onFoodItemAdded
}: MealEditorProps) {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState('');

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
                unit: item.unit || 'cup'
              }}
              onIngredientChange={(updatedIngredient) => {
                // Check if it's a food item or recipe based on the selected ID
                const foodItem = foodItems.find(f => f._id === updatedIngredient.id);
                const recipe = recipes.find(r => r._id === updatedIngredient.id);
                
                if (foodItem) {
                  handleItemChange(index, {
                    type: 'foodItem',
                    id: updatedIngredient.id,
                    name: foodItem.name,
                    quantity: updatedIngredient.quantity,
                    unit: updatedIngredient.unit
                  });
                } else if (recipe) {
                  handleItemChange(index, {
                    type: 'recipe',
                    id: updatedIngredient.id,
                    name: recipe.title
                  });
                } else {
                  // Handle cleared ingredient (when X button is clicked)
                  handleItemChange(index, {
                    type: 'foodItem',
                    id: '',
                    name: '',
                    quantity: 1,
                    unit: 'cup'
                  });
                }
              }}
              onRemove={() => handleRemoveItem(index)}
              foodItems={foodItems}
              onFoodItemAdded={onFoodItemAdded}
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
              onFoodItemAdded={onFoodItemAdded}
              addIngredientButtonText="Add Ingredient"
              emptyGroupText="No ingredients in this group. Click 'Add Ingredient' to begin."
              removeIngredientButtonText="Remove Ingredient"
            />
          )}
        </Box>
      ))}

      {mealItems.length === 0 && (
        <Typography variant="body2" color="text.secondary" textAlign="center" py={1}>
          Use the buttons below to add to this meal.
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
