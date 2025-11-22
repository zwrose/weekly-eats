/**
 * Core behavior tests for IngredientInput
 * 
 * These tests verify the essential behaviors that must be consistent:
 * - Quantity validation (empty, 0, positive, error states)
 * - Unit singular/plural updates
 * - Food item creation dialog prefill
 * 
 * These tests should pass on BOTH the current implementation AND the new
 * implementation after refactoring to use centralized hooks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IngredientInput from '../IngredientInput';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('IngredientInput - Core Behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => []
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Quantity input behavior', () => {
    it('should display empty string when quantity is 0', () => {
      const onIngredientChange = vi.fn();
      
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 0, unit: 'cup' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );

      const quantityInput = screen.getByLabelText(/quantity/i);
      // When quantity is 0, display should be empty
      expect(quantityInput).toHaveValue(null);
    });

    it('should display quantity when quantity > 0', () => {
      const onIngredientChange = vi.fn();
      
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 5, unit: 'cup' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );

      const quantityInput = screen.getByLabelText(/quantity/i);
      expect(quantityInput).toHaveValue(5);
    });

    it('should show error state when quantity <= 0', () => {
      const onIngredientChange = vi.fn();
      
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 0, unit: 'cup' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );

      const quantityInput = screen.getByLabelText(/quantity/i);
      expect(quantityInput).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText(/must be > 0/i)).toBeInTheDocument();
    });

    it('should not show error when quantity > 0', () => {
      const onIngredientChange = vi.fn();
      
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );

      const quantityInput = screen.getByLabelText(/quantity/i);
      expect(quantityInput).not.toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText(/must be > 0/i)).not.toBeInTheDocument();
    });

    it('should allow setting quantity to 0 (empty input)', async () => {
      const user = userEvent.setup();
      const onIngredientChange = vi.fn();
      
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 5, unit: 'cup' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );

      const quantityInput = screen.getByLabelText(/quantity/i);
      await user.clear(quantityInput);
      
      await waitFor(() => {
        expect(onIngredientChange).toHaveBeenCalledWith(
          expect.objectContaining({ quantity: 0 })
        );
      });
    });

    it('should allow positive decimal quantities', async () => {
      const user = userEvent.setup();
      const onIngredientChange = vi.fn();
      
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );

      const quantityInput = screen.getByLabelText(/quantity/i);
      await user.clear(quantityInput);
      await user.type(quantityInput, '1.5');
      
      await waitFor(() => {
        expect(onIngredientChange).toHaveBeenCalledWith(
          expect.objectContaining({ quantity: 1.5 })
        );
      });
    });
  });

  describe('Unit selector behavior', () => {
    it('should show singular form when quantity is 1', () => {
      const onIngredientChange = vi.fn();
      const foodItems = [
        { _id: 'f1', name: 'Apple', singularName: 'Apple', pluralName: 'Apples', unit: 'cup' },
      ];
      
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          foodItems={foodItems}
          slotId="test-slot"
        />
      );

      const unitInput = screen.getByLabelText(/unit/i);
      expect((unitInput as HTMLInputElement).value).toBe('cup');
    });

    it('should show plural form when quantity is not 1', () => {
      const onIngredientChange = vi.fn();
      const foodItems = [
        { _id: 'f1', name: 'Apple', singularName: 'Apple', pluralName: 'Apples', unit: 'cup' },
      ];
      
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 2, unit: 'cup' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          foodItems={foodItems}
          slotId="test-slot"
        />
      );

      const unitInput = screen.getByLabelText(/unit/i);
      expect((unitInput as HTMLInputElement).value).toBe('cups');
    });

    it('should update unit form when quantity changes from 1 to 2', async () => {
      const user = userEvent.setup();
      const onIngredientChange = vi.fn();
      const foodItems = [
        { _id: 'f1', name: 'Apple', singularName: 'Apple', pluralName: 'Apples', unit: 'cup' },
      ];
      
      const { rerender } = render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          foodItems={foodItems}
          slotId="test-slot"
        />
      );

      let unitInput = screen.getByLabelText(/unit/i);
      expect((unitInput as HTMLInputElement).value).toBe('cup');
      
      // Update quantity to 2
      const quantityInput = screen.getByLabelText(/quantity/i);
      await user.clear(quantityInput);
      await user.type(quantityInput, '2');
      
      // Wait for the change to propagate
      await waitFor(() => {
        expect(onIngredientChange).toHaveBeenCalled();
      });
      
      // Rerender with new quantity
      rerender(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 2, unit: 'cup' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          foodItems={foodItems}
          slotId="test-slot"
        />
      );
      
      unitInput = screen.getByLabelText(/unit/i);
      expect((unitInput as HTMLInputElement).value).toBe('cups');
    });
  });

  describe('Food item creation dialog prefill', () => {
    it('should prefill dialog with typed text when Enter is pressed', async () => {
      const user = userEvent.setup();
      const onIngredientChange = vi.fn();
      
      // Mock empty search results
      mockFetch.mockImplementation((url) => {
        if (url.includes('query=')) {
          return Promise.resolve({
            ok: true,
            json: async () => []
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => []
        });
      });
      
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: '', quantity: 1, unit: 'cup' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          foodItems={[]}
          slotId="test-slot"
        />
      );

      const input = screen.getByLabelText(/food item or recipe/i);
      await user.type(input, 'new food item');
      
      // Wait for no options message
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add "new food item" as a food item/i })).toBeInTheDocument();
      }, { timeout: 3000 });
      
      await user.keyboard('{Enter}');
      
      // Dialog should open with prefilled name
      await waitFor(() => {
        const nameField = screen.getByLabelText(/default name/i);
        expect((nameField as HTMLInputElement).value).toBe('new food item');
      }, { timeout: 2000 });
    });

    it('should prefill dialog with typed text when button is clicked', async () => {
      const user = userEvent.setup();
      const onIngredientChange = vi.fn();
      
      // Mock empty search results
      mockFetch.mockImplementation((url) => {
        if (url.includes('query=')) {
          return Promise.resolve({
            ok: true,
            json: async () => []
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => []
        });
      });
      
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: '', quantity: 1, unit: 'cup' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          foodItems={[]}
          slotId="test-slot"
        />
      );

      const input = screen.getByLabelText(/food item or recipe/i);
      await user.type(input, 'another item');
      
      // Wait for no options message
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add "another item" as a food item/i })).toBeInTheDocument();
      }, { timeout: 3000 });
      
      const createButton = screen.getByRole('button', { name: /add "another item" as a food item/i });
      await user.click(createButton);
      
      // Dialog should open with prefilled name
      await waitFor(() => {
        const nameField = screen.getByLabelText(/default name/i);
        expect((nameField as HTMLInputElement).value).toBe('another item');
      }, { timeout: 2000 });
    });
  });
});

