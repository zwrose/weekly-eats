"use client";

import { RecipeIngredientList } from '../types/recipe';
import RecipeIngredientGroups from './RecipeIngredientGroups';
import MealPlanIngredientGroups from './MealPlanIngredientGroups';

interface IngredientInputProps {
  ingredients: RecipeIngredientList[];
  onChange: (ingredients: RecipeIngredientList[]) => void;
  foodItems?: Array<{_id: string, name: string, singularName: string, pluralName: string, unit: string}>;
  onFoodItemAdded?: (newFoodItem: {_id: string, name: string, singularName: string, pluralName: string, unit: string}) => void;
  currentRecipeId?: string; // ID of the current recipe being edited (to prevent self-reference)
  mode?: 'recipe' | 'mealPlan'; // Determines which component to use
  // Custom text overrides
  addIngredientButtonText?: string;
  addIngredientGroupButtonText?: string;
  emptyMultipleGroupsText?: string;
  emptyNoGroupsText?: string;
}

export default function IngredientInput({ 
  ingredients, 
  onChange, 
  foodItems,
  onFoodItemAdded, 
  currentRecipeId,
  mode = 'recipe',
  addIngredientButtonText,
  addIngredientGroupButtonText,
  emptyMultipleGroupsText,
  emptyNoGroupsText
}: IngredientInputProps) {
  
  if (mode === 'recipe') {
    return (
      <RecipeIngredientGroups
        ingredients={ingredients}
        onChange={onChange}
        foodItems={foodItems}
        onFoodItemAdded={onFoodItemAdded}
        currentRecipeId={currentRecipeId}
        addIngredientButtonText={addIngredientButtonText}
        addIngredientGroupButtonText={addIngredientGroupButtonText}
        emptyGroupText={emptyMultipleGroupsText}
      />
    );
  } else {
    return (
      <MealPlanIngredientGroups
        ingredients={ingredients}
        onChange={onChange}
        foodItems={foodItems}
        onFoodItemAdded={onFoodItemAdded}
        currentRecipeId={currentRecipeId}
        addIngredientButtonText={addIngredientButtonText}
        addIngredientGroupButtonText={addIngredientGroupButtonText}
        emptyGroupText={emptyMultipleGroupsText}
        emptyNoGroupsText={emptyNoGroupsText}
      />
    );
  }
} 