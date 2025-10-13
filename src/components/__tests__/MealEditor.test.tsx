import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MealEditor from '../MealEditor';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MealEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('auto-selects newly created food item in meal editor', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onFoodItemAdded = vi.fn();
    
    // Mock the initial data loading
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: 'existing1', name: 'Apple', singularName: 'Apple', pluralName: 'Apples', unit: 'piece', isGlobal: false }
      ]
    });
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [] // No recipes
    });
    
    // Mock the food item creation API response
    const newFoodItem = {
      _id: 'new-food-789',
      name: 'Fresh Avocado',
      singularName: 'Fresh Avocado',
      pluralName: 'Fresh Avocados',
      unit: 'piece',
      isGlobal: false
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => newFoodItem
    });
    
    render(
      <MealEditor
        mealItems={[]}
        onChange={onChange}
        onFoodItemAdded={onFoodItemAdded}
      />
    );
    
    // Add a meal item
    const addMealItemButton = screen.getByRole('button', { name: /^add meal item$/i });
    await user.click(addMealItemButton);
    
    // Verify that onChange was called with a new meal item
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'foodItem',
        id: '',
        name: '',
        quantity: 1,
        unit: 'cup'
      })
    ]);
    
    // Get the updated meal items from the last onChange call
    const updatedMealItems = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    
    // Re-render with the updated meal items
    render(
      <MealEditor
        mealItems={updatedMealItems}
        onChange={onChange}
        onFoodItemAdded={onFoodItemAdded}
      />
    );
    
    // Type a new food item name in the ingredient input
    const input = screen.getByLabelText(/food item or recipe/i);
    await user.type(input, 'Fresh Avocado');
    
    // Press Enter to open the add dialog
    await user.keyboard('{Enter}');
    
    // Wait for the dialog to appear and fill in the form (Step 1)
    const nameField = await screen.findByLabelText(/default name/i);
    await user.clear(nameField);
    await user.type(nameField, 'Fresh Avocado');
    
    // Click Next to go to Step 2
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);
    
    // Fill in the form fields in Step 2
    const singularField = await screen.findByLabelText(/singular name/i);
    const pluralField = await screen.findByLabelText(/plural name/i);
    
    await user.clear(singularField);
    await user.type(singularField, 'Fresh Avocado');
    await user.clear(pluralField);
    await user.type(pluralField, 'Fresh Avocados');
    
    // Submit the form
    const addButton = screen.getByRole('button', { name: /add food item/i });
    await user.click(addButton);
    
    // Wait for the auto-selection to happen and verify the meal item was updated
    await waitFor(() => {
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      const updatedItems = lastCall[0];
      expect(updatedItems[0]).toEqual(
        expect.objectContaining({
          type: 'foodItem',
          id: 'new-food-id',
          name: 'Fresh Avocado',
          quantity: 1,
          unit: 'each'
        })
      );
    });
    
    // Verify that onFoodItemAdded was called with the new food item
    expect(onFoodItemAdded).toHaveBeenCalledWith({
      _id: 'new-food-id',
      name: 'Fresh Avocado',
      singularName: 'Fresh Avocado',
      pluralName: 'Fresh Avocados',
      unit: 'each',
      isGlobal: true
    });
  });

  it('handles auto-selection when foodItems state is not yet updated', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onFoodItemAdded = vi.fn();
    
    // Mock the initial data loading
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: 'existing1', name: 'Apple', singularName: 'Apple', pluralName: 'Apples', unit: 'piece', isGlobal: false }
      ]
    });
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [] // No recipes
    });
    
    // Mock the food item creation API response
    const newFoodItem = {
      _id: 'new-food-timing-test',
      name: 'Organic Blueberries',
      singularName: 'Organic Blueberries',
      pluralName: 'Organic Blueberries',
      unit: 'package',
      isGlobal: false
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => newFoodItem
    });
    
    render(
      <MealEditor
        mealItems={[]}
        onChange={onChange}
        onFoodItemAdded={onFoodItemAdded}
      />
    );
    
    // Add a meal item
    const addMealItemButton = screen.getByRole('button', { name: /^add meal item$/i });
    await user.click(addMealItemButton);
    
    // Get the updated meal items
    const updatedMealItems = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    
    // Re-render with the updated meal items
    render(
      <MealEditor
        mealItems={updatedMealItems}
        onChange={onChange}
        onFoodItemAdded={onFoodItemAdded}
      />
    );
    
    // Type a new food item name
    const input = screen.getByLabelText(/food item or recipe/i);
    await user.type(input, 'Organic Blueberries');
    
    // Press Enter to open the add dialog
    await user.keyboard('{Enter}');
    
    // Fill in the form (Step 1)
    const nameField = await screen.findByLabelText(/default name/i);
    await user.clear(nameField);
    await user.type(nameField, 'Organic Blueberries');
    
    // Click Next to go to Step 2
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);
    
    // Fill in the form fields in Step 2
    const singularField = await screen.findByLabelText(/singular name/i);
    const pluralField = await screen.findByLabelText(/plural name/i);
    
    await user.clear(singularField);
    await user.type(singularField, 'Organic Blueberries');
    await user.clear(pluralField);
    await user.type(pluralField, 'Organic Blueberries');
    
    // Submit the form
    const addButton = screen.getByRole('button', { name: /add food item/i });
    await user.click(addButton);
    
    // Wait for the auto-selection to happen
    await waitFor(() => {
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      const updatedItems = lastCall[0];
      expect(updatedItems[0]).toEqual(
        expect.objectContaining({
          type: 'foodItem',
          id: 'new-food-id',
          name: 'Organic Blueberries',
          quantity: 1,
          unit: 'each'
        })
      );
    });
    
    // Verify that the ref-based fallback worked correctly
    expect(onFoodItemAdded).toHaveBeenCalledWith({
      _id: 'new-food-id',
      name: 'Organic Blueberries',
      singularName: 'Organic Blueberries',
      pluralName: 'Organic Blueberries',
      unit: 'each',
      isGlobal: true
    });
  });

  it('adds meal item group correctly', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    
    // Mock the initial data loading
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });
    
    render(
      <MealEditor
        mealItems={[]}
        onChange={onChange}
        onFoodItemAdded={async () => {}}
      />
    );
    
    // Add a meal item group
    const addGroupButton = screen.getByRole('button', { name: /add meal item group/i });
    await user.click(addGroupButton);
    
    // Verify that onChange was called with a new ingredient group
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'ingredientGroup',
        id: '',
        name: '',
        ingredients: [
          expect.objectContaining({
            title: '',
            ingredients: []
          })
        ]
      })
    ]);
  });
});
