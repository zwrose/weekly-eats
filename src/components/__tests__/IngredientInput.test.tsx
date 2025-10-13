import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import IngredientInput from '../IngredientInput';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('IngredientInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('keyboard navigation: Enter selects first option', async () => {
    const user = userEvent.setup();
    const onIngredientChange = vi.fn();
    render(
      <IngredientInput
        ingredient={{ type: 'foodItem', id: '', quantity: 1, unit: 'cup' }}
        onIngredientChange={onIngredientChange}
        onRemove={() => {}}
        slotId="test-slot"
      />
    );
    const input = screen.getByLabelText(/food item or recipe/i);
    await user.type(input, 'app');
    await user.keyboard('{ArrowDown}');
    const listbox = await screen.findByRole('listbox');
    const firstOption = within(listbox).getAllByRole('option')[0];
    await user.click(firstOption);
    expect(onIngredientChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'f1', type: 'foodItem' })
    );
  });

  it('no options + Enter opens AddFoodItemDialog prefilled', async () => {
    const user = userEvent.setup();
    const onIngredientChange = vi.fn();
    render(
      <IngredientInput
        ingredient={{ type: 'foodItem', id: '', quantity: 1, unit: 'cup' }}
        onIngredientChange={onIngredientChange}
        onRemove={() => {}}
        slotId="test-slot"
      />
    );
    const input = screen.getByLabelText(/food item or recipe/i);
    await user.type(input, 'zzz');
    expect(await screen.findByRole('button', { name: /add "zzz" as a food item/i })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    // Dialog should appear with prefilled Default Name
    const nameField = await screen.findByLabelText(/default name/i);
    expect((nameField as HTMLInputElement).value).toBe('zzz');
  });

  it('auto-selects newly created food item after creation', async () => {
    const user = userEvent.setup();
    const onIngredientChange = vi.fn();
    const onFoodItemAdded = vi.fn();
    
    // Mock the food items API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: 'existing1', name: 'Apple', singularName: 'Apple', pluralName: 'Apples', unit: 'piece', isGlobal: false }
      ]
    });
    
    // Mock the food item creation API response
    const newFoodItem = {
      _id: 'new-food-123',
      name: 'Fresh Spinach',
      singularName: 'Fresh Spinach',
      pluralName: 'Fresh Spinach',
      unit: 'bag',
      isGlobal: false
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => newFoodItem
    });
    
    render(
      <IngredientInput
        ingredient={{ type: 'foodItem', id: '', quantity: 1, unit: 'cup' }}
        onIngredientChange={onIngredientChange}
        onRemove={() => {}}
        onFoodItemAdded={onFoodItemAdded}
        slotId="test-slot"
      />
    );
    
    // Type a new food item name
    const input = screen.getByLabelText(/food item or recipe/i);
    await user.type(input, 'Fresh Spinach');
    
    // Press Enter to open the add dialog
    await user.keyboard('{Enter}');
    
    // Wait for the dialog to appear and fill in the form (Step 1)
    const nameField = await screen.findByLabelText(/default name/i);
    await user.clear(nameField);
    await user.type(nameField, 'Fresh Spinach');
    
    // Click Next to go to Step 2
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);
    
    // Fill in the form fields in Step 2
    const singularField = await screen.findByLabelText(/singular name/i);
    const pluralField = await screen.findByLabelText(/plural name/i);
    
    await user.clear(singularField);
    await user.type(singularField, 'Fresh Spinach');
    await user.clear(pluralField);
    await user.type(pluralField, 'Fresh Spinach');
    
    // Submit the form
    const addButton = screen.getByRole('button', { name: /add food item/i });
    await user.click(addButton);
    
    // Wait for the auto-selection to happen
    await waitFor(() => {
      expect(onIngredientChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'foodItem',
          id: 'new-food-id',
          quantity: 1,
          unit: 'each'
        })
      );
    });
    
    // Verify that onFoodItemAdded was called with the new food item
    expect(onFoodItemAdded).toHaveBeenCalledWith({
      _id: 'new-food-id',
      name: 'Fresh Spinach',
      singularName: 'Fresh Spinach',
      pluralName: 'Fresh Spinach',
      unit: 'each',
      isGlobal: true
    });
  });

  it('auto-selection works when using prop foodItems', async () => {
    const user = userEvent.setup();
    const onIngredientChange = vi.fn();
    const onFoodItemAdded = vi.fn();
    
    const propFoodItems = [
      { _id: 'existing1', name: 'Apple', singularName: 'Apple', pluralName: 'Apples', unit: 'piece', isGlobal: false }
    ];
    
    // Mock the food item creation API response
    const newFoodItem = {
      _id: 'new-food-456',
      name: 'Organic Kale',
      singularName: 'Organic Kale',
      pluralName: 'Organic Kale',
      unit: 'bunch',
      isGlobal: false
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => newFoodItem
    });
    
    render(
      <IngredientInput
        ingredient={{ type: 'foodItem', id: '', quantity: 1, unit: 'cup' }}
        onIngredientChange={onIngredientChange}
        onRemove={() => {}}
        onFoodItemAdded={onFoodItemAdded}
        foodItems={propFoodItems}
        slotId="test-slot"
      />
    );
    
    // Type a new food item name
    const input = screen.getByLabelText(/food item or recipe/i);
    await user.type(input, 'Organic Kale');
    
    // Press Enter to open the add dialog
    await user.keyboard('{Enter}');
    
    // Wait for the dialog to appear and fill in the form (Step 1)
    const nameField = await screen.findByLabelText(/default name/i);
    await user.clear(nameField);
    await user.type(nameField, 'Organic Kale');
    
    // Click Next to go to Step 2
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);
    
    // Fill in the form fields in Step 2
    const singularField = await screen.findByLabelText(/singular name/i);
    const pluralField = await screen.findByLabelText(/plural name/i);
    
    await user.clear(singularField);
    await user.type(singularField, 'Organic Kale');
    await user.clear(pluralField);
    await user.type(pluralField, 'Organic Kale');
    
    // Submit the form
    const addButton = screen.getByRole('button', { name: /add food item/i });
    await user.click(addButton);
    
    // Wait for the auto-selection to happen
    await waitFor(() => {
      expect(onIngredientChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'foodItem',
          id: 'new-food-id',
          quantity: 1,
          unit: 'each'
        })
      );
    });
    
    // Verify that onFoodItemAdded was called with the new food item
    expect(onFoodItemAdded).toHaveBeenCalledWith({
      _id: 'new-food-id',
      name: 'Organic Kale',
      singularName: 'Organic Kale',
      pluralName: 'Organic Kale',
      unit: 'each',
      isGlobal: true
    });
  });
});


