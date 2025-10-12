import { MealPlanWithTemplate } from '../types/meal-plan';
import { ShoppingListItem } from '../types/shopping-list';

interface ExtractedItem {
  foodItemId: string;
  quantity: number;
  unit: string;
}

interface UnitConflict {
  foodItemId: string;
  foodItemName: string;
  existingQuantity: number;
  existingUnit: string;
  newQuantity: number;
  newUnit: string;
}

const MAX_RECURSION_DEPTH = 50;

/**
 * Recursively extracts food items from a recipe
 */
async function extractFoodItemsFromRecipe(
  recipeId: string,
  depth: number = 0,
  visitedRecipes: Set<string> = new Set()
): Promise<ExtractedItem[]> {
  if (depth >= MAX_RECURSION_DEPTH) {
    console.warn('Max recursion depth reached while extracting recipe ingredients');
    return [];
  }

  // Prevent infinite loops
  if (visitedRecipes.has(recipeId)) {
    console.warn(`Circular recipe reference detected: ${recipeId}`);
    return [];
  }

  visitedRecipes.add(recipeId);

  try {
    const response = await fetch(`/api/recipes/${recipeId}`);
    if (!response.ok) {
      console.error(`Failed to fetch recipe ${recipeId}`);
      return [];
    }

    const recipe = await response.json();
    const items: ExtractedItem[] = [];

    // Go through all ingredient groups in the recipe
    if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
      for (const group of recipe.ingredients) {
        if (group.ingredients && Array.isArray(group.ingredients)) {
          for (const ingredient of group.ingredients) {
            if (ingredient.type === 'foodItem' && ingredient.id) {
              // Add food item
              items.push({
                foodItemId: ingredient.id,
                quantity: ingredient.quantity || 1,
                unit: ingredient.unit || 'piece'
              });
            } else if (ingredient.type === 'recipe' && ingredient.id) {
              // Recursively extract from nested recipe
              const nestedItems = await extractFoodItemsFromRecipe(
                ingredient.id,
                depth + 1,
                new Set(visitedRecipes)
              );
              items.push(...nestedItems);
            }
          }
        }
      }
    }

    return items;
  } catch (error) {
    console.error(`Error extracting items from recipe ${recipeId}:`, error);
    return [];
  }
}

/**
 * Extracts all food items from meal plans
 */
export async function extractFoodItemsFromMealPlans(
  mealPlans: MealPlanWithTemplate[]
): Promise<ExtractedItem[]> {
  const items: ExtractedItem[] = [];

  for (const mealPlan of mealPlans) {
    for (const mealPlanItem of mealPlan.items) {
      for (const mealItem of mealPlanItem.items) {
        if (mealItem.type === 'foodItem' && mealItem.id) {
          // Add food item directly
          items.push({
            foodItemId: mealItem.id,
            quantity: mealItem.quantity || 1,
            unit: mealItem.unit || 'piece'
          });
        } else if (mealItem.type === 'recipe' && mealItem.id) {
          // Recursively extract from recipe
          const recipeItems = await extractFoodItemsFromRecipe(mealItem.id);
          items.push(...recipeItems);
        } else if (mealItem.type === 'ingredientGroup' && mealItem.ingredients) {
          // Extract from ingredient group
          for (const group of mealItem.ingredients) {
            if (group.ingredients && Array.isArray(group.ingredients)) {
              for (const ingredient of group.ingredients) {
                if (ingredient.type === 'foodItem' && ingredient.id) {
                  items.push({
                    foodItemId: ingredient.id,
                    quantity: ingredient.quantity || 1,
                    unit: ingredient.unit || 'piece'
                  });
                } else if (ingredient.type === 'recipe' && ingredient.id) {
                  // Recursively extract from nested recipe
                  const recipeItems = await extractFoodItemsFromRecipe(ingredient.id);
                  items.push(...recipeItems);
                }
              }
            }
          }
        }
      }
    }
  }

  return items;
}

/**
 * Combines extracted items, summing quantities for items with the same unit
 * Returns combined items and any unit conflicts
 */
export function combineExtractedItems(
  extractedItems: ExtractedItem[]
): { combinedItems: ExtractedItem[]; conflicts: Map<string, ExtractedItem[]> } {
  const itemsByFoodId = new Map<string, ExtractedItem[]>();

  // Group by food item ID
  for (const item of extractedItems) {
    if (!itemsByFoodId.has(item.foodItemId)) {
      itemsByFoodId.set(item.foodItemId, []);
    }
    itemsByFoodId.get(item.foodItemId)!.push(item);
  }

  const combinedItems: ExtractedItem[] = [];
  const conflicts = new Map<string, ExtractedItem[]>();

  // Combine items with same unit, identify conflicts
  for (const [foodItemId, items] of itemsByFoodId.entries()) {
    if (items.length === 1) {
      combinedItems.push(items[0]);
    } else {
      // Group by unit
      const byUnit = new Map<string, number>();
      for (const item of items) {
        const currentQty = byUnit.get(item.unit) || 0;
        byUnit.set(item.unit, currentQty + item.quantity);
      }

      if (byUnit.size === 1) {
        // All same unit - combine
        const [unit, quantity] = Array.from(byUnit.entries())[0];
        combinedItems.push({ foodItemId, quantity, unit });
      } else {
        // Multiple units - conflict
        conflicts.set(foodItemId, items);
        // For now, just take the first one
        combinedItems.push(items[0]);
      }
    }
  }

  return { combinedItems, conflicts };
}

/**
 * Merges extracted items into existing shopping list
 * Returns merged items and conflicts that need resolution
 */
export function mergeWithShoppingList(
  existingItems: ShoppingListItem[],
  extractedItems: ExtractedItem[],
  foodItems: Map<string, { singularName: string; pluralName: string; unit: string }>
): { 
  mergedItems: ShoppingListItem[]; 
  conflicts: UnitConflict[] 
} {
  const conflicts: UnitConflict[] = [];
  const itemsMap = new Map<string, ShoppingListItem>();

  // Start with existing items
  for (const item of existingItems) {
    itemsMap.set(item.foodItemId, { ...item });
  }

  // Merge extracted items
  for (const extracted of extractedItems) {
    const existing = itemsMap.get(extracted.foodItemId);
    
    if (!existing) {
      // New item - add it
      const foodItem = foodItems.get(extracted.foodItemId);
      itemsMap.set(extracted.foodItemId, {
        foodItemId: extracted.foodItemId,
        name: foodItem 
          ? (extracted.quantity === 1 ? foodItem.singularName : foodItem.pluralName)
          : 'Unknown',
        quantity: extracted.quantity,
        unit: extracted.unit,
        checked: false
      });
    } else {
      // Item exists - check unit
      if (existing.unit === extracted.unit) {
        // Same unit - combine quantities
        const newQuantity = existing.quantity + extracted.quantity;
        const foodItem = foodItems.get(extracted.foodItemId);
        itemsMap.set(extracted.foodItemId, {
          ...existing,
          quantity: newQuantity,
          name: foodItem
            ? (newQuantity === 1 ? foodItem.singularName : foodItem.pluralName)
            : existing.name
        });
      } else {
        // Different unit - conflict
        const foodItem = foodItems.get(extracted.foodItemId);
        conflicts.push({
          foodItemId: extracted.foodItemId,
          foodItemName: foodItem?.pluralName || existing.name,
          existingQuantity: existing.quantity,
          existingUnit: existing.unit,
          newQuantity: extracted.quantity,
          newUnit: extracted.unit
        });
      }
    }
  }

  return {
    mergedItems: Array.from(itemsMap.values()),
    conflicts
  };
}

export type { UnitConflict };

