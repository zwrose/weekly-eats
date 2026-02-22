import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MealEditor from '../MealEditor';
import { within } from '@testing-library/dom';

// API responses are handled by MSW server in vitest.setup.ts

describe('MealEditor - Name Display in Edit Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('displays food item name immediately after selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { unmount } = render(
      <MealEditor mealItems={[]} onChange={onChange} onFoodItemAdded={async () => {}} />
    );

    // Add a meal item - this triggers onChange with an empty item
    const addButton = screen.getByRole('button', { name: /add meal item$/i });
    await user.click(addButton);

    // The onChange should have been called with an empty meal item
    expect(onChange).toHaveBeenCalled();
    const addedItem = onChange.mock.calls[0][0][0];
    expect(addedItem).toBeDefined();
    expect(addedItem.id).toBe(''); // Empty initially

    // Re-render with the new item
    const { unmount: unmount2 } = render(
      <MealEditor mealItems={[addedItem]} onChange={onChange} onFoodItemAdded={async () => {}} />
    );

    // Wait for the component to load data
    await waitFor(
      () => {
        const inputs = screen.queryAllByRole('combobox');
        expect(inputs.length).toBeGreaterThan(0);
      },
      { timeout: 2000 }
    );

    // Type to search for a food item
    const input = screen.getAllByRole('combobox')[0];
    await user.type(input, 'appl');

    // Wait for search results to appear (should have food item options + "Add New" at the bottom)
    await waitFor(
      async () => {
        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        expect(options.length).toBeGreaterThan(1); // Should have at least one food item + "Add New"
      },
      { timeout: 3000 }
    );

    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');

    // The "Add New Food Item" option is at the bottom, so click the first option (the food item)
    await user.click(options[0]); // Click the food item (first option)

    // Verify onChange was called with a name
    await waitFor(() => {
      const calls = onChange.mock.calls;
      const lastCall = calls[calls.length - 1];
      const updatedItems = lastCall[0];
      expect(updatedItems[0]).toBeDefined();
      expect(updatedItems[0].name).toBeTruthy();
      expect(updatedItems[0].name).toBe('apple'); // Should be singular for quantity 1
    });

    unmount();
    unmount2();
  });

  it('displays recipe name immediately after selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { unmount } = render(
      <MealEditor mealItems={[]} onChange={onChange} onFoodItemAdded={async () => {}} />
    );

    // Add a meal item
    const addButton = screen.getByRole('button', { name: /add meal item$/i });
    await user.click(addButton);

    // The onChange should have been called with an empty meal item
    const addedItem = onChange.mock.calls[0][0][0];

    // Re-render with the new item
    const { unmount: unmount2 } = render(
      <MealEditor mealItems={[addedItem]} onChange={onChange} onFoodItemAdded={async () => {}} />
    );

    // Wait for the component to load data
    await waitFor(
      () => {
        const inputs = screen.queryAllByRole('combobox');
        expect(inputs.length).toBeGreaterThan(0);
      },
      { timeout: 2000 }
    );

    // Type to search for a recipe - use a search term that will match
    const input = screen.getAllByRole('combobox')[0];
    await user.type(input, 'past'); // Search for "past" which should match "Pasta"

    // Wait for search results to appear (should have recipe options + "Add New" at the bottom)
    await waitFor(
      async () => {
        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        expect(options.length).toBeGreaterThan(1); // Should have at least one recipe + "Add New"
      },
      { timeout: 3000 }
    );

    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');

    // The "Add New Food Item" option is at the bottom, so click the first option (the recipe)
    await user.click(options[0]); // Click the recipe (first option)

    // Verify onChange was called with recipe name
    await waitFor(() => {
      const calls = onChange.mock.calls;
      const lastCall = calls[calls.length - 1];
      const updatedItems = lastCall[0];
      expect(updatedItems[0]).toBeDefined();
      expect(updatedItems[0].id).toBeTruthy();
      expect(updatedItems[0].name).toBeTruthy();
      // Should have a recipe name (from vitest.setup.ts mock)
      expect(updatedItems[0].type).toBe('recipe');
      expect(updatedItems[0].name).toBe('Pasta');
    });

    unmount();
    unmount2();
  });

  it('updates food item name when quantity changes (singular/plural)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    // Start with an item that has a name - use 'f1' to match vitest.setup.ts mock
    const { unmount } = render(
      <MealEditor
        mealItems={[{ type: 'foodItem', id: 'f1', name: 'apple', quantity: 1, unit: 'each' }]}
        onChange={onChange}
        onFoodItemAdded={async () => {}}
      />
    );

    // Wait for data to load
    await waitFor(
      () => {
        expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Find the quantity input
    const quantityInput = screen.getByLabelText(/quantity/i);

    // Change quantity to 2 (type without clearing to avoid the "12" issue)
    await user.click(quantityInput);
    await user.keyboard('{Control>}a{/Control}'); // Select all
    await user.keyboard('2');

    // Trigger blur to ensure onChange fires
    await user.tab();

    // Verify name changed to plural
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      const updatedItems = lastCall[0];
      expect(updatedItems[0].quantity).toBe(2);
      expect(updatedItems[0].name).toBe('apples'); // Should be plural
    });

    unmount();
  });
});
