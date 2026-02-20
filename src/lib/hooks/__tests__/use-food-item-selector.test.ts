/**
 * Tests for useFoodItemSelector hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFoodItemSelector, type FoodItem, type Recipe } from '../use-food-item-selector';

describe('useFoodItemSelector', () => {
  const mockFetch = vi.fn();

  const mockFoodItems: FoodItem[] = [
    { _id: 'f1', name: 'Apple', singularName: 'Apple', pluralName: 'Apples', unit: 'each' },
    { _id: 'f2', name: 'Banana', singularName: 'Banana', pluralName: 'Bananas', unit: 'each' },
    { _id: 'f3', name: 'Carrot', singularName: 'Carrot', pluralName: 'Carrots', unit: 'each' },
  ];

  const mockRecipes: Recipe[] = [
    { _id: 'r1', title: 'Apple Pie', emoji: '🥧' },
    { _id: 'r2', title: 'Banana Bread', emoji: '🍞' },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('local filtering with provided food items', () => {
    it('filters food items by name match', async () => {
      const { result } = renderHook(() =>
        useFoodItemSelector({
          foodItems: mockFoodItems,
          recipes: [],
          allowRecipes: false,
          autoLoad: false,
        })
      );

      await act(async () => {
        result.current.handleInputChange('app', 'input');
        vi.advanceTimersByTime(800);
      });

      expect(result.current.options.length).toBeGreaterThan(0);
      expect(result.current.options.some(o => o._id === 'f1')).toBe(true); // Apple matches
      expect(result.current.options.some(o => o._id === 'f2')).toBe(false); // Banana doesn't match
    });

    it('excludes IDs in excludeIds', async () => {
      const { result } = renderHook(() =>
        useFoodItemSelector({
          foodItems: mockFoodItems,
          recipes: [],
          allowRecipes: false,
          autoLoad: false,
          excludeIds: ['f1'],
        })
      );

      await act(async () => {
        result.current.handleInputChange('a', 'input');
        vi.advanceTimersByTime(800);
      });

      expect(result.current.options.some(o => o._id === 'f1')).toBe(false); // excluded
    });
  });

  describe('API search when no food items provided', () => {
    it('handles paginated API response format correctly', async () => {
      // Mock fetch to return paginated response format
      mockFetch.mockReset()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { _id: 'f1', name: 'Apple', singularName: 'Apple', pluralName: 'Apples', unit: 'each' },
            ],
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => [],
        });


      const { result } = renderHook(() =>
        useFoodItemSelector({
          // No foodItems prop → triggers API search path
          allowRecipes: false,
          autoLoad: false,
        })
      );

      await act(async () => {
        result.current.handleInputChange('apple', 'input');
        vi.advanceTimersByTime(800);
      });

      // Wait for async fetch to complete
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/food-items?query=apple')
      );
      expect(result.current.options.length).toBe(1);
      expect(result.current.options[0]._id).toBe('f1');
    });

    it('handles plain array API response format (backward compat)', async () => {
      mockFetch.mockReset()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { _id: 'f2', name: 'Banana', singularName: 'Banana', pluralName: 'Bananas', unit: 'each' },
          ],
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => [],
        });


      const { result } = renderHook(() =>
        useFoodItemSelector({
          allowRecipes: false,
          autoLoad: false,
        })
      );

      await act(async () => {
        result.current.handleInputChange('banana', 'input');
        vi.advanceTimersByTime(800);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.options.length).toBe(1);
      expect(result.current.options[0]._id).toBe('f2');
    });

    it('handles API search with recipes enabled', async () => {
      mockFetch.mockReset()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { _id: 'f1', name: 'Apple', singularName: 'Apple', pluralName: 'Apples', unit: 'each' },
            ],
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { _id: 'r1', title: 'Apple Pie', emoji: '🥧' },
            ],
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
          }),
        });


      const { result } = renderHook(() =>
        useFoodItemSelector({
          allowRecipes: true,
          autoLoad: false,
        })
      );

      await act(async () => {
        result.current.handleInputChange('apple', 'input');
        vi.advanceTimersByTime(800);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.options.length).toBe(2);
      expect(result.current.options.some(o => o._id === 'f1' && o.type === 'foodItem')).toBe(true);
      expect(result.current.options.some(o => o._id === 'r1' && o.type === 'recipe')).toBe(true);
    });

    it('returns empty results when API fails', async () => {
      mockFetch.mockReset()
        .mockResolvedValueOnce({ ok: false, json: async () => [] })
        .mockResolvedValueOnce({ ok: false, json: async () => [] });


      const { result } = renderHook(() =>
        useFoodItemSelector({
          allowRecipes: false,
          autoLoad: false,
        })
      );

      await act(async () => {
        result.current.handleInputChange('xyz', 'input');
        vi.advanceTimersByTime(800);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.options.length).toBe(0);
    });
  });

  describe('selection behavior', () => {
    it('clears input and options on selection', () => {
      const { result } = renderHook(() =>
        useFoodItemSelector({
          foodItems: mockFoodItems,
          allowRecipes: false,
          autoLoad: false,
        })
      );

      const item = { ...mockFoodItems[0], type: 'foodItem' as const };
      act(() => {
        result.current.handleSelect(item);
      });

      expect(result.current.selectedItem).toBe(item);
      expect(result.current.inputValue).toBe('');
      expect(result.current.options).toEqual([]);
    });
  });
});
