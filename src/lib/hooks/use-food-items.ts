import { useState, useEffect, useCallback } from 'react';
import { fetchFoodItems } from '../food-items-utils';

export interface FoodItem {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
  isGlobal?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UseFoodItemsReturn {
  foodItems: FoodItem[];
  foodItemsMap: { [key: string]: { singularName: string; pluralName: string } };
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addFoodItem: (newItem: FoodItem) => void;
}

export const useFoodItems = (): UseFoodItemsReturn => {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFoodItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await fetchFoodItems();
      setFoodItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load food items');
      console.error('Error loading food items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFoodItems();
  }, [loadFoodItems]);

  const addFoodItem = useCallback((newItem: FoodItem) => {
    setFoodItems(prev => [...prev, newItem]);
  }, []);

  // Create a memoized map for efficient lookups
  const foodItemsMap = useCallback(() => {
    const map: { [key: string]: { singularName: string; pluralName: string } } = {};
    foodItems.forEach(item => {
      map[item._id] = {
        singularName: item.singularName,
        pluralName: item.pluralName
      };
    });
    return map;
  }, [foodItems])();

  return {
    foodItems,
    foodItemsMap,
    loading,
    error,
    refetch: loadFoodItems,
    addFoodItem
  };
}; 