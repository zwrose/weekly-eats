/**
 * Core hook for food item creation flow
 * 
 * Handles the creation of new food items via API and manages dialog state.
 */

import { useState, useCallback, useRef } from 'react';
import { FoodItem } from './use-food-item-selector';
import { createPantryItem } from '../pantry-utils';

export interface UseFoodItemCreatorOptions {
  onFoodItemAdded?: (item: FoodItem) => Promise<void>;
  onItemCreated?: (item: FoodItem) => void;
}

export interface UseFoodItemCreatorReturn {
  isDialogOpen: boolean;
  prefillName: string;
  error: string | null;
  lastError: React.RefObject<string | null>;
  openDialog: (prefillName?: string) => void;
  closeDialog: () => void;
  handleCreate: (foodItemData: {
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
    addToPantry?: boolean;
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
  const lastErrorRef = useRef<string | null>(null);

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
    addToPantry?: boolean;
  }): Promise<FoodItem | null> => {
    try {
      setError(null);

      // Extract addToPantry before sending to API (API doesn't need it)
      const { addToPantry, ...foodItemPayload } = foodItemData;

      const response = await fetch('/api/food-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(foodItemPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to add food item');
      }

      const newFoodItem: FoodItem = await response.json();

      // Add to pantry if requested
      if (addToPantry && newFoodItem._id) {
        try {
          await createPantryItem({ foodItemId: newFoodItem._id });
        } catch (pantryError) {
          // Log error but don't fail the food item creation
          console.error('Error adding food item to pantry:', pantryError);
        }
      }

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
      lastErrorRef.current = errorMessage;
      setError(errorMessage);
      console.error('Error adding food item:', err);
      return null;
    }
  }, [onFoodItemAdded, onItemCreated, closeDialog]);

  return {
    isDialogOpen,
    prefillName,
    error,
    lastError: lastErrorRef,
    openDialog,
    closeDialog,
    handleCreate,
    clearError,
  };
}

