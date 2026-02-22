import { ShoppingListItem } from '../types/shopping-list';

/**
 * Get remembered position for a food item in a store
 */
export async function getItemPosition(storeId: string, foodItemId: string): Promise<number | null> {
  try {
    const response = await fetch(
      `/api/shopping-lists/${storeId}/positions?foodItemId=${foodItemId}`
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.position ?? null;
  } catch (error) {
    console.error('Error fetching item position:', error);
    return null;
  }
}

/**
 * Get all remembered positions for a store
 */
export async function getStorePositions(storeId: string): Promise<Map<string, number>> {
  try {
    const response = await fetch(`/api/shopping-lists/${storeId}/positions`);
    if (!response.ok) {
      return new Map();
    }
    const data = await response.json();
    const positions = new Map<string, number>();
    if (Array.isArray(data.positions)) {
      for (const pos of data.positions) {
        positions.set(pos.foodItemId, pos.position);
      }
    }
    return positions;
  } catch (error) {
    console.error('Error fetching store positions:', error);
    return new Map();
  }
}

/**
 * Calculate and save relative positions from current list order
 */
export async function saveItemPositions(storeId: string, items: ShoppingListItem[]): Promise<void> {
  try {
    // Calculate relative positions: position = index / totalItems
    const positions: Array<{ foodItemId: string; position: number }> = [];

    if (items.length === 0) {
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const position = items.length === 1 ? 0.5 : i / (items.length - 1);
      positions.push({
        foodItemId: items[i].foodItemId,
        position: Math.max(0, Math.min(1, position)), // Clamp to 0-1
      });
    }

    await fetch(`/api/shopping-lists/${storeId}/positions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ positions }),
    });
  } catch (error) {
    console.error('Error saving item positions:', error);
    // Don't throw - position saving is non-critical
  }
}

/**
 * Insert item at appropriate position maintaining relative order
 * Uses a simple approach: calculates target index based on remembered position
 * relative to list length. For more accurate insertion, use insertItemsWithPositions
 * which fetches positions for all existing items.
 */
export function insertItemAtPosition(
  items: ShoppingListItem[],
  newItem: ShoppingListItem,
  rememberedPosition: number | null
): ShoppingListItem[] {
  // If no remembered position, append to end
  if (rememberedPosition === null) {
    return [...items, newItem];
  }

  // If list is empty, just add the item
  if (items.length === 0) {
    return [newItem];
  }

  // Calculate target index based on remembered position
  // Position 0.0 = start, 1.0 = end
  const targetIndex = Math.round(rememberedPosition * items.length);
  const insertIndex = Math.max(0, Math.min(items.length, targetIndex));

  const updatedItems = [...items];
  updatedItems.splice(insertIndex, 0, newItem);
  return updatedItems;
}

/**
 * Insert multiple items maintaining their relative order based on remembered positions
 * This is used when adding items from meal plans.
 * Fetches positions for existing items to determine accurate insertion points.
 */
export async function insertItemsWithPositions(
  items: ShoppingListItem[],
  newItems: ShoppingListItem[],
  storeId: string
): Promise<ShoppingListItem[]> {
  if (newItems.length === 0) {
    return items;
  }

  // Get positions for all items to determine accurate insertion
  const allPositions = await getStorePositions(storeId);

  // Get positions for new items
  const newItemsWithPositions = newItems.map((item) => ({
    item,
    position: allPositions.get(item.foodItemId) ?? null,
  }));

  // Separate items with and without positions
  const itemsWithKnownPositions = newItemsWithPositions.filter(
    (iwp) => iwp.position !== null
  ) as Array<{ item: ShoppingListItem; position: number }>;
  const itemsWithoutPositions = newItemsWithPositions
    .filter((iwp) => iwp.position === null)
    .map((iwp) => iwp.item);

  // Sort items with known positions by their position
  itemsWithKnownPositions.sort((a, b) => a.position - b.position);

  // Start with existing items, sorted by their positions if available
  const existingItemsWithPositions = items.map((item) => ({
    item,
    position: allPositions.get(item.foodItemId) ?? null,
  }));

  // Sort existing items by position (items without positions go to end)
  existingItemsWithPositions.sort((a, b) => {
    if (a.position === null && b.position === null) return 0;
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position - b.position;
  });

  let result = existingItemsWithPositions.map((iwp) => iwp.item);

  // Insert new items with known positions at appropriate positions
  for (const { item, position } of itemsWithKnownPositions) {
    // Find insertion point: after last item with position <= this position
    let insertIndex = result.length;
    for (let i = 0; i < result.length; i++) {
      const existingPosition = allPositions.get(result[i].foodItemId);
      if (existingPosition !== undefined && existingPosition > position) {
        insertIndex = i;
        break;
      }
    }
    result.splice(insertIndex, 0, item);
  }

  // Append items without positions to the end
  result = [...result, ...itemsWithoutPositions];

  return result;
}
