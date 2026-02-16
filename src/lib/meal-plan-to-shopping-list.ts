import { MealPlanWithTemplate } from '../types/meal-plan';
import { ShoppingListItem } from '../types/shopping-list';
import { areSameFamily, tryConvert, pickBestUnit } from './unit-conversion';

interface ExtractedItem {
  foodItemId: string;
  quantity: number;
  unit: string;
}

interface PreMergeConflict {
  foodItemId: string;
  items: ExtractedItem[];
  unitBreakdown: { quantity: number; unit: string }[];
  isAutoConverted: boolean;
  suggestedQuantity?: number;
  suggestedUnit?: string;
}

interface UnitConflict {
  foodItemId: string;
  foodItemName: string;
  existingQuantity: number;
  existingUnit: string;
  newQuantity: number;
  newUnit: string;
  isAutoConverted: boolean;
  suggestedQuantity?: number;
  suggestedUnit?: string;
  unitBreakdown?: { quantity: number; unit: string }[];
}

const MAX_RECURSION_DEPTH = 50;

/**
 * Recursively extracts food items from a recipe
 * @param recipeId - The ID of the recipe to extract from
 * @param multiplier - Quantity multiplier to apply to all extracted items (default: 1)
 * @param depth - Current recursion depth
 * @param visitedRecipes - Set of visited recipe IDs to prevent circular references
 */
async function extractFoodItemsFromRecipe(
  recipeId: string,
  multiplier: number = 1,
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
              // Add food item with multiplier applied
              items.push({
                foodItemId: ingredient.id,
                quantity: (ingredient.quantity || 1) * multiplier,
                unit: ingredient.unit || 'piece'
              });
            } else if (ingredient.type === 'recipe' && ingredient.id) {
              // Recursively extract from nested recipe
              // Multiply by both the current multiplier and the ingredient quantity
              const ingredientQuantity = ingredient.quantity || 1;
              const nestedItems = await extractFoodItemsFromRecipe(
                ingredient.id,
                multiplier * ingredientQuantity,
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
          // Multiply by meal item quantity (default to 1 if not specified)
          const mealItemQuantity = mealItem.quantity || 1;
          const recipeItems = await extractFoodItemsFromRecipe(mealItem.id, mealItemQuantity);
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
                  // Multiply by ingredient quantity (default to 1 if not specified)
                  const ingredientQuantity = ingredient.quantity || 1;
                  const recipeItems = await extractFoodItemsFromRecipe(ingredient.id, ingredientQuantity);
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
 * Combines extracted items, summing quantities for items with the same unit.
 * Items with different units are always flagged as conflicts for user review.
 * Convertible conflicts include pre-computed suggested values.
 * Returns combined items (same-unit sums only) and all multi-unit conflicts.
 */
export function combineExtractedItems(
  extractedItems: ExtractedItem[]
): { combinedItems: ExtractedItem[]; conflicts: PreMergeConflict[] } {
  const itemsByFoodId = new Map<string, ExtractedItem[]>();

  // Group by food item ID
  for (const item of extractedItems) {
    if (!itemsByFoodId.has(item.foodItemId)) {
      itemsByFoodId.set(item.foodItemId, []);
    }
    itemsByFoodId.get(item.foodItemId)!.push(item);
  }

  const combinedItems: ExtractedItem[] = [];
  const conflicts: PreMergeConflict[] = [];

  for (const [foodItemId, items] of itemsByFoodId.entries()) {
    if (items.length === 1) {
      combinedItems.push(items[0]);
      continue;
    }

    // Group by unit first
    const byUnit = new Map<string, number>();
    for (const item of items) {
      const currentQty = byUnit.get(item.unit) || 0;
      byUnit.set(item.unit, currentQty + item.quantity);
    }

    if (byUnit.size === 1) {
      // All same unit — sum directly (AC-5: silent sum)
      const [unit, quantity] = Array.from(byUnit.entries())[0];
      combinedItems.push({ foodItemId, quantity, unit });
      continue;
    }

    // Multiple different units — always flag as conflict for user review.
    // Add first entry as placeholder so item reaches the shopping list.
    combinedItems.push(items[0]);

    // Build unit breakdown from summed-by-unit map
    const unitBreakdown = Array.from(byUnit.entries()).map(([unit, quantity]) => ({
      quantity,
      unit,
    }));

    // Check if all units are in the same convertible family
    const units = Array.from(byUnit.keys());
    const allSameFamily = units.every((u, i) =>
      i === 0 ? true : areSameFamily(units[0], u)
    );

    if (allSameFamily) {
      // Convertible — compute suggested combined value
      const targetUnit = units[0];
      let totalInTarget = 0;
      let conversionFailed = false;

      for (const [unit, qty] of byUnit.entries()) {
        if (unit === targetUnit) {
          totalInTarget += qty;
        } else {
          const converted = tryConvert(qty, unit, targetUnit);
          if (converted !== null) {
            totalInTarget += converted;
          } else {
            conversionFailed = true;
            break;
          }
        }
      }

      if (!conversionFailed) {
        const best = pickBestUnit(totalInTarget, targetUnit);
        conflicts.push({
          foodItemId,
          items,
          unitBreakdown,
          isAutoConverted: true,
          suggestedQuantity: best.quantity,
          suggestedUnit: best.unit,
        });
      } else {
        conflicts.push({ foodItemId, items, unitBreakdown, isAutoConverted: false });
      }
    } else {
      // Non-convertible units
      conflicts.push({ foodItemId, items, unitBreakdown, isAutoConverted: false });
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
      } else if (areSameFamily(existing.unit, extracted.unit)) {
        // Convertible units — auto-convert and pre-fill suggested resolution
        const foodItem = foodItems.get(extracted.foodItemId);
        const convertedExtracted = tryConvert(
          extracted.quantity,
          extracted.unit,
          existing.unit
        );
        const totalInExistingUnit =
          convertedExtracted !== null
            ? existing.quantity + convertedExtracted
            : existing.quantity + extracted.quantity;
        const best = pickBestUnit(totalInExistingUnit, existing.unit);

        conflicts.push({
          foodItemId: extracted.foodItemId,
          foodItemName: foodItem?.pluralName || existing.name,
          existingQuantity: existing.quantity,
          existingUnit: existing.unit,
          newQuantity: extracted.quantity,
          newUnit: extracted.unit,
          isAutoConverted: true,
          suggestedQuantity: best.quantity,
          suggestedUnit: best.unit,
        });
      } else {
        // Non-convertible units — manual conflict
        const foodItem = foodItems.get(extracted.foodItemId);
        conflicts.push({
          foodItemId: extracted.foodItemId,
          foodItemName: foodItem?.pluralName || existing.name,
          existingQuantity: existing.quantity,
          existingUnit: existing.unit,
          newQuantity: extracted.quantity,
          newUnit: extracted.unit,
          isAutoConverted: false,
        });
      }
    }
  }

  return {
    mergedItems: Array.from(itemsMap.values()),
    conflicts
  };
}

export type { UnitConflict, PreMergeConflict };

