import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../vitest.setup';
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
    // Wait for search results to appear (should have food item options + "Add New" at the bottom)
    const listbox = await waitFor(async () => {
      const lb = await screen.findByRole('listbox');
      const opts = within(lb).getAllByRole('option');
      expect(opts.length).toBeGreaterThan(1); // Should have at least one food item + "Add New"
      return lb;
    }, { timeout: 3000 });
    // Press Enter to select first option (without using arrow keys)
    await user.keyboard('{Enter}');
    // Should select the first option
    await waitFor(() => {
      expect(onIngredientChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'f1', type: 'foodItem' })
      );
    });
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
    
    // Override MSW handler for food item creation to return our test data
    // Note: The dialog defaults to isGlobal: true, so the API should return true
    const newFoodItem = {
      _id: 'new-food-123',
      name: 'Fresh Spinach',
      singularName: 'Fresh Spinach',
      pluralName: 'Fresh Spinach',
      unit: 'bag',
      isGlobal: true
    };
    
    server.use(
      http.post('/api/food-items', async ({ request }) => {
        const body = await request.json() as any;
        return HttpResponse.json(newFoodItem, { status: 201 });
      })
    );
    
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
    
    // Wait for the dialog to appear and fill in the form (single page now)
    const nameField = await screen.findByLabelText(/default name/i);
    await user.clear(nameField);
    await user.type(nameField, 'Fresh Spinach');
    
    // Select unit (not "each" in this case, so no singular/plural fields)
    const unitCombobox = screen.getByRole('combobox', { name: /typical usage unit/i });
    await user.click(unitCombobox);
    const listbox = await screen.findByRole('listbox');
    // Select a non-"each" unit (like "bag" to match the mocked response)
    // Get the first "bag" option if multiple exist
    const bagOptions = within(listbox).getAllByRole('option', { name: /bag/i });
    await user.click(bagOptions[0]);
    
    // Verify the submit button is enabled
    const addButton = screen.getByRole('button', { name: /add food item/i });
    expect(addButton).not.toBeDisabled();
    
    // Submit the form - onAdd will be called (which is handleCreate in FoodItemAutocomplete)
    // which calls creator.handleCreate, which makes the fetch call
    await user.click(addButton);
    
    // Wait for the food item to be added - this will happen after the fetch completes
    await waitFor(() => {
      expect(onFoodItemAdded).toHaveBeenCalledWith({
        _id: 'new-food-123',
        name: 'Fresh Spinach',
        singularName: 'Fresh Spinach',
        pluralName: 'Fresh Spinach',
        unit: 'bag',
        isGlobal: true
      });
    }, { timeout: 5000 });
    
    // Wait for the auto-selection to happen (via onItemCreated callback in creator)
    await waitFor(() => {
      expect(onIngredientChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'foodItem',
          id: 'new-food-123',
          quantity: 1,
          unit: 'bag'
        })
      );
    }, { timeout: 5000 });
  });

  it('auto-selection works when using prop foodItems', async () => {
    const user = userEvent.setup();
    const onIngredientChange = vi.fn();
    const onFoodItemAdded = vi.fn();
    
    const propFoodItems = [
      { _id: 'existing1', name: 'Apple', singularName: 'Apple', pluralName: 'Apples', unit: 'piece', isGlobal: false }
    ];
    
    // Override MSW handler for food item creation to return our test data
    // Note: The dialog defaults to isGlobal: true, so the API should return true
    const newFoodItem = {
      _id: 'new-food-456',
      name: 'Organic Kale',
      singularName: 'Organic Kale',
      pluralName: 'Organic Kale',
      unit: 'bunch',
      isGlobal: true
    };
    
    server.use(
      http.post('/api/food-items', async ({ request }) => {
        const body = await request.json() as any;
        return HttpResponse.json(newFoodItem, { status: 201 });
      })
    );
    
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
    
    // Wait for the dialog to appear and fill in the form (single page now)
    const nameField = await screen.findByLabelText(/default name/i);
    await user.clear(nameField);
    await user.type(nameField, 'Organic Kale');
    
    // Select unit (not "each", so no singular/plural fields shown)
    const unitCombobox = screen.getByRole('combobox', { name: /typical usage unit/i });
    await user.click(unitCombobox);
    const listbox = await screen.findByRole('listbox');
    // Select a non-"each" unit (like "bunch" to match the mocked response)
    // Get the first "bunch" option if multiple exist
    const bunchOptions = within(listbox).getAllByRole('option', { name: /bunch/i });
    await user.click(bunchOptions[0]);
    
    // Verify the submit button is enabled
    const addButton = screen.getByRole('button', { name: /add food item/i });
    expect(addButton).not.toBeDisabled();
    
    // Submit the form - onAdd will be called (which is handleCreate in FoodItemAutocomplete)
    // which calls creator.handleCreate, which makes the fetch call
    await user.click(addButton);
    
    // Wait for the food item to be added - this will happen after the fetch completes
    await waitFor(() => {
      expect(onFoodItemAdded).toHaveBeenCalledWith({
        _id: 'new-food-456',
        name: 'Organic Kale',
        singularName: 'Organic Kale',
        pluralName: 'Organic Kale',
        unit: 'bunch',
        isGlobal: true
      });
    }, { timeout: 5000 });
    
    // Wait for the auto-selection to happen (via onItemCreated callback in creator)
    await waitFor(() => {
      expect(onIngredientChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'foodItem',
          id: 'new-food-456',
          quantity: 1,
          unit: 'bunch'
        })
      );
    }, { timeout: 5000 });
  });
});


