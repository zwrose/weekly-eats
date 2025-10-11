import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import IngredientInput from '../IngredientInput';
import { RecipeIngredient } from '../../types/recipe';

// Mock the AddFoodItemDialog component
vi.mock('../AddFoodItemDialog', () => ({
  default: () => <div>Add Food Item Dialog</div>
}));

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'user-123', email: 'test@example.com' } }, status: 'authenticated' })
}));

describe('IngredientInput - Edit Mode Display', () => {
  const mockFoodItems = [
    { _id: 'f1', name: 'apple', singularName: 'apple', pluralName: 'apples', unit: 'piece' }
  ];

  const mockOnChange = vi.fn();
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('displays recipe name in autocomplete when recipe has name field but is not in recipes list', async () => {
    // Simulate a recipe ingredient that was populated by the API but isn't in the local recipes list
    const ingredientWithName: RecipeIngredient = {
      type: 'recipe',
      id: 'recipe-xyz',
      name: 'Spaghetti Carbonara', // This name came from the API
      quantity: 1
    };

    // Mock fetch to return empty recipes list (simulating the recipe not being loaded)
    global.fetch = vi.fn((url) => {
      if (url === '/api/food-items?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => mockFoodItems
        } as Response);
      }
      if (url === '/api/recipes?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => [] // Empty recipes list
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    }) as any;

    render(
      <IngredientInput
        ingredient={ingredientWithName}
        onIngredientChange={mockOnChange}
        onRemove={mockOnRemove}
        slotId="test-slot-1"
      />
    );

    // Wait for data to load
    await waitFor(() => {
      // The autocomplete should display the recipe name
      const input = screen.getByLabelText(/food item or recipe/i);
      expect(input).toHaveValue('Spaghetti Carbonara');
    });
  });

  it('displays food item name in autocomplete when food item has name field but is not in food items list', async () => {
    const ingredientWithName: RecipeIngredient = {
      type: 'foodItem',
      id: 'food-xyz',
      name: 'bananas', // This name came from the API
      quantity: 3,
      unit: 'piece'
    };

    // Mock fetch to return food items list without this specific item
    global.fetch = vi.fn((url) => {
      if (url === '/api/food-items?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => mockFoodItems // List doesn't include 'food-xyz'
        } as Response);
      }
      if (url === '/api/recipes?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => []
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    }) as any;

    render(
      <IngredientInput
        ingredient={ingredientWithName}
        onIngredientChange={mockOnChange}
        onRemove={mockOnRemove}
        slotId="test-slot-2"
      />
    );

    // Wait for data to load
    await waitFor(() => {
      // The autocomplete should display the food item name
      const input = screen.getByLabelText(/food item or recipe/i);
      expect(input).toHaveValue('bananas');
    });
  });

  it('displays nothing when ingredient has no name and is not in loaded data', async () => {
    const ingredientWithoutName: RecipeIngredient = {
      type: 'recipe',
      id: 'recipe-missing',
      // No name field
      quantity: 1
    };

    // Mock fetch to return empty lists
    global.fetch = vi.fn((url) => {
      if (url === '/api/food-items?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => []
        } as Response);
      }
      if (url === '/api/recipes?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => []
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    }) as any;

    render(
      <IngredientInput
        ingredient={ingredientWithoutName}
        onIngredientChange={mockOnChange}
        onRemove={mockOnRemove}
        slotId="test-slot-3"
      />
    );

    // Wait for data to load
    await waitFor(() => {
      // The autocomplete should be empty (no selected value)
      const input = screen.getByLabelText(/food item or recipe/i);
      expect(input).toHaveValue('');
    });
  });
});

