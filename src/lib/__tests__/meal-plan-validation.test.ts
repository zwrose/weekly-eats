import { describe, it, expect } from 'vitest';
import { MealPlanItem, MealItem } from '../../types/meal-plan';
import { RecipeIngredientList } from '../../types/recipe';

// Mock validation function (copy of the one in meal-plans/page.tsx)
const validateMealPlan = (items: MealPlanItem[]): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Helper function to get meal type display name
  const getMealTypeName = (mealType: string): string => {
    return mealType.charAt(0).toUpperCase() + mealType.slice(1);
  };
  
  // Check each day's meals
  items.forEach((mealPlanItem) => {
    const dayOfWeek = mealPlanItem.dayOfWeek;
    const mealType = mealPlanItem.mealType;
    
    if (!mealPlanItem.items || !Array.isArray(mealPlanItem.items)) return;
    
    mealPlanItem.items.forEach((item: MealItem, itemIndex: number) => {
      if (item.type === 'foodItem' || item.type === 'recipe') {
        // Check if food item or recipe has an ID selected
        if (!item.id || item.id.trim() === '') {
          errors.push(`${getMealTypeName(mealType)} on ${getMealTypeName(dayOfWeek)}: Meal item ${itemIndex + 1} must have a food item or recipe selected`);
        }
      } else if (item.type === 'ingredientGroup') {
        // Check if ingredient group has a title
        if (!item.ingredients || !Array.isArray(item.ingredients) || item.ingredients.length === 0) {
          errors.push(`${getMealTypeName(mealType)} on ${getMealTypeName(dayOfWeek)}: Ingredient group ${itemIndex + 1} must have at least one ingredient`);
        } else {
          // Check if the group has a title
          const group = item.ingredients[0];
          if (!group.title || group.title.trim() === '') {
            errors.push(`${getMealTypeName(mealType)} on ${getMealTypeName(dayOfWeek)}: Ingredient group ${itemIndex + 1} must have a title`);
          }
          
          // Check if each ingredient in the group has a food item or recipe selected
          if (group.ingredients && Array.isArray(group.ingredients)) {
            group.ingredients.forEach((ingredient, ingredientIndex: number) => {
              if (!ingredient.id || ingredient.id.trim() === '') {
                errors.push(`${getMealTypeName(mealType)} on ${getMealTypeName(dayOfWeek)}: Ingredient group "${group.title || 'Untitled'}" - ingredient ${ingredientIndex + 1} must have a food item or recipe selected`);
              }
            });
          }
        }
      }
    });
  });
  
  return { isValid: errors.length === 0, errors };
};

describe('Meal Plan Validation', () => {
  it('should pass validation for valid meal plan', () => {
    const validMealPlan: MealPlanItem[] = [
      {
        _id: '1',
        mealPlanId: 'plan1',
        dayOfWeek: 'monday',
        mealType: 'breakfast',
        items: [
          {
            type: 'foodItem',
            id: 'food1',
            name: 'Apple',
            quantity: 1,
            unit: 'piece'
          },
          {
            type: 'recipe',
            id: 'recipe1',
            name: 'Oatmeal'
          },
          {
            type: 'ingredientGroup',
            id: '',
            name: '',
            ingredients: [{
              title: 'Fruits',
              ingredients: [
                { type: 'foodItem', id: 'food2', quantity: 2, unit: 'piece' },
                { type: 'recipe', id: 'recipe2', quantity: 1 }
              ]
            }]
          }
        ]
      }
    ];

    const result = validateMealPlan(validMealPlan);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail validation for meal item without food item or recipe selected', () => {
    const invalidMealPlan: MealPlanItem[] = [
      {
        _id: '1',
        mealPlanId: 'plan1',
        dayOfWeek: 'monday',
        mealType: 'breakfast',
        items: [
          {
            type: 'foodItem',
            id: '', // Empty ID - should fail
            name: '',
            quantity: 1,
            unit: 'piece'
          }
        ]
      }
    ];

    const result = validateMealPlan(invalidMealPlan);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('must have a food item or recipe selected');
  });

  it('should fail validation for ingredient group without title', () => {
    const invalidMealPlan: MealPlanItem[] = [
      {
        _id: '1',
        mealPlanId: 'plan1',
        dayOfWeek: 'monday',
        mealType: 'breakfast',
        items: [
          {
            type: 'ingredientGroup',
            id: '',
            name: '',
            ingredients: [{
              title: '', // Empty title - should fail
              ingredients: [
                { type: 'foodItem', id: 'food1', quantity: 1, unit: 'piece' }
              ]
            }]
          }
        ]
      }
    ];

    const result = validateMealPlan(invalidMealPlan);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('must have a title');
  });

  it('should fail validation for ingredient in group without food item or recipe selected', () => {
    const invalidMealPlan: MealPlanItem[] = [
      {
        _id: '1',
        mealPlanId: 'plan1',
        dayOfWeek: 'monday',
        mealType: 'breakfast',
        items: [
          {
            type: 'ingredientGroup',
            id: '',
            name: '',
            ingredients: [{
              title: 'Fruits',
              ingredients: [
                { type: 'foodItem', id: '', quantity: 1, unit: 'piece' } // Empty ID - should fail
              ]
            }]
          }
        ]
      }
    ];

    const result = validateMealPlan(invalidMealPlan);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('must have a food item or recipe selected');
  });

  it('should fail validation for ingredient group without ingredients', () => {
    const invalidMealPlan: MealPlanItem[] = [
      {
        _id: '1',
        mealPlanId: 'plan1',
        dayOfWeek: 'monday',
        mealType: 'breakfast',
        items: [
          {
            type: 'ingredientGroup',
            id: '',
            name: '',
            ingredients: [] // Empty ingredients array - should fail
          }
        ]
      }
    ];

    const result = validateMealPlan(invalidMealPlan);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('must have at least one ingredient');
  });

  it('should handle multiple validation errors', () => {
    const invalidMealPlan: MealPlanItem[] = [
      {
        _id: '1',
        mealPlanId: 'plan1',
        dayOfWeek: 'monday',
        mealType: 'breakfast',
        items: [
          {
            type: 'foodItem',
            id: '', // Empty ID - should fail
            name: '',
            quantity: 1,
            unit: 'piece'
          },
          {
            type: 'ingredientGroup',
            id: '',
            name: '',
            ingredients: [{
              title: '', // Empty title - should fail
              ingredients: [
                { type: 'foodItem', id: '', quantity: 1, unit: 'piece' } // Empty ID - should fail
              ]
            }]
          }
        ]
      }
    ];

    const result = validateMealPlan(invalidMealPlan);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]).toContain('must have a food item or recipe selected');
    expect(result.errors[1]).toContain('must have a title');
    expect(result.errors[2]).toContain('must have a food item or recipe selected');
  });
});
