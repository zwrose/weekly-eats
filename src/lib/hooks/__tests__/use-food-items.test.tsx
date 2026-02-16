import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor, cleanup, act } from '@testing-library/react';
import { useFoodItems, type FoodItem } from '../use-food-items';

// Mock food-items-utils
const mockFetchFoodItems = vi.fn();
vi.mock('../../food-items-utils', () => ({
  fetchFoodItems: (...args: unknown[]) => mockFetchFoodItems(...args),
}));

const mockFoodItems: FoodItem[] = [
  { _id: 'f1', name: 'Apple', singularName: 'Apple', pluralName: 'Apples', unit: 'piece' },
  { _id: 'f2', name: 'Banana', singularName: 'Banana', pluralName: 'Bananas', unit: 'bunch' },
  { _id: 'f3', name: 'Carrot', singularName: 'Carrot', pluralName: 'Carrots', unit: 'piece' },
];

// Test harness to capture hook state
let latestHookState: ReturnType<typeof useFoodItems> | null = null;
let renderCount = 0;

const TestComponent: React.FC = () => {
  renderCount++;
  latestHookState = useFoodItems();
  return null;
};

describe('useFoodItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestHookState = null;
    renderCount = 0;
    mockFetchFoodItems.mockResolvedValue(mockFoodItems);
  });

  afterEach(() => {
    cleanup();
  });

  describe('foodItemsMap', () => {
    it('should create a map of food item IDs to singular/plural names', async () => {
      render(<TestComponent />);

      await waitFor(() => {
        expect(latestHookState?.loading).toBe(false);
      });

      expect(latestHookState?.foodItemsMap).toEqual({
        f1: { singularName: 'Apple', pluralName: 'Apples' },
        f2: { singularName: 'Banana', pluralName: 'Bananas' },
        f3: { singularName: 'Carrot', pluralName: 'Carrots' },
      });
    });

    it('should return an empty map when no food items are loaded', async () => {
      mockFetchFoodItems.mockResolvedValue([]);
      render(<TestComponent />);

      await waitFor(() => {
        expect(latestHookState?.loading).toBe(false);
      });

      expect(latestHookState?.foodItemsMap).toEqual({});
    });

    it('should maintain referential stability across re-renders when foodItems have not changed', async () => {
      const { rerender } = render(<TestComponent />);

      await waitFor(() => {
        expect(latestHookState?.loading).toBe(false);
      });

      const firstMapRef = latestHookState?.foodItemsMap;

      // Force a re-render without changing food items
      await act(async () => {
        rerender(<TestComponent />);
      });

      const secondMapRef = latestHookState?.foodItemsMap;

      // With useMemo, the reference should be the same
      // With useCallback()(), the reference changes every render
      expect(secondMapRef).toBe(firstMapRef);
    });
  });

  describe('data fetching', () => {
    it('should fetch food items on mount', async () => {
      render(<TestComponent />);

      await waitFor(() => {
        expect(latestHookState?.loading).toBe(false);
      });

      expect(mockFetchFoodItems).toHaveBeenCalledOnce();
      expect(latestHookState?.foodItems).toEqual(mockFoodItems);
    });

    it('should set loading state during fetch', async () => {
      render(<TestComponent />);

      // Initially loading
      expect(latestHookState?.loading).toBe(true);

      await waitFor(() => {
        expect(latestHookState?.loading).toBe(false);
      });
    });

    it('should handle fetch errors', async () => {
      mockFetchFoodItems.mockRejectedValue(new Error('Network error'));
      render(<TestComponent />);

      await waitFor(() => {
        expect(latestHookState?.loading).toBe(false);
      });

      expect(latestHookState?.error).toBe('Network error');
      expect(latestHookState?.foodItems).toEqual([]);
    });
  });

  describe('addFoodItem', () => {
    it('should append a new food item to the list', async () => {
      render(<TestComponent />);

      await waitFor(() => {
        expect(latestHookState?.loading).toBe(false);
      });

      const newItem: FoodItem = {
        _id: 'f4',
        name: 'Date',
        singularName: 'Date',
        pluralName: 'Dates',
        unit: 'piece',
      };

      act(() => {
        latestHookState?.addFoodItem(newItem);
      });

      expect(latestHookState?.foodItems).toHaveLength(4);
      expect(latestHookState?.foodItems[3]).toEqual(newItem);
      expect(latestHookState?.foodItemsMap).toHaveProperty('f4');
    });
  });
});
