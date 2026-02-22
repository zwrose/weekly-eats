/**
 * Core hook for quantity input validation and display
 *
 * Handles quantity input logic including validation, error states,
 * and name updates based on quantity for food items.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseQuantityInputOptions {
  initialQuantity?: number;
  onQuantityChange: (quantity: number) => void;
}

export interface UseQuantityInputReturn {
  quantity: number;
  displayValue: string; // Empty string when quantity is 0
  error: boolean;
  errorMessage: string;
  handleChange: (value: string) => void;
  quantityRef: React.RefObject<HTMLInputElement | null>;
}

export function useQuantityInput(options: UseQuantityInputOptions): UseQuantityInputReturn {
  const { initialQuantity = 1, onQuantityChange } = options;

  const [quantity, setQuantity] = useState(initialQuantity);
  const [error, setError] = useState(initialQuantity <= 0);
  const quantityRef = useRef<HTMLInputElement>(null);

  // Update quantity when initialQuantity changes
  useEffect(() => {
    setQuantity(initialQuantity);
    setError(initialQuantity <= 0);
  }, [initialQuantity]);

  const handleChange = useCallback(
    (value: string) => {
      const parsed = parseFloat(value);

      // Allow any non-negative value during editing (including 0 and NaN for empty field)
      if (!isNaN(parsed) && parsed >= 0) {
        setQuantity(parsed);
        onQuantityChange(parsed);
        setError(parsed <= 0);
      } else if (value === '') {
        // Allow empty field for editing
        setQuantity(0);
        onQuantityChange(0);
        setError(true);
      }
      // If value is negative or invalid, do nothing (don't update state)
    },
    [onQuantityChange]
  );

  // Display value: empty string when quantity is 0, otherwise show the quantity
  const displayValue = quantity > 0 ? String(quantity) : '';

  // Error state: true when quantity <= 0
  const errorMessage = error ? 'Must be > 0' : '';

  return {
    quantity,
    displayValue,
    error,
    errorMessage,
    handleChange,
    quantityRef,
  };
}
