/**
 * Core hook for food item creation flow
 * 
 * Handles the creation of new food items via API and manages dialog state.
 */

import { useState, useCallback } from 'react';
import { FoodItem } from './use-food-item-selector';

export interface UseFoodItemCreatorOptions {
  onFoodItemAdded?: (item: FoodItem) => Promise<void>;
  onItemCreated?: (item: FoodItem) => void;
}

export interface UseFoodItemCreatorReturn {
  isDialogOpen: boolean;
  prefillName: string;
  error: string | null;
  openDialog: (prefillName?: string) => void;
  closeDialog: () => void;
  handleCreate: (foodItemData: {
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
  }) => Promise<FoodItem | null>;
  clearError: () => void;
}

export function useFoodItemCreator(
  options: UseFoodItemCreatorOptions = {}
): UseFoodItemCreatorReturn {
  const { onFoodItemAdded, onItemCreated } = options;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [prefillName, setPrefillName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const openDialog = useCallback((prefill?: string) => {
    setPrefillName(prefill || '');
    setError(null);
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setPrefillName('');
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleCreate = useCallback(async (foodItemData: {
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
  }): Promise<FoodItem | null> => {
    try {
      setError(null);

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

      const newFoodItem: FoodItem = await response.json();

      // Notify parent component about the new food item
      if (onFoodItemAdded) {
        await onFoodItemAdded(newFoodItem);
      }

      // Call onItemCreated callback if provided
      if (onItemCreated) {
        onItemCreated(newFoodItem);
      }

      // Close the dialog
      closeDialog();

      return newFoodItem;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add food item';
      setError(errorMessage);
      console.error('Error adding food item:', err);
      return null;
    }
  }, [onFoodItemAdded, onItemCreated, closeDialog]);

  return {
    isDialogOpen,
    prefillName,
    error,
    openDialog,
    closeDialog,
    handleCreate,
    clearError,
  };
}

