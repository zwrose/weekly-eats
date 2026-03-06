import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../vitest.setup';
import MealEditor from '../MealEditor';

// Disable pointer-events check globally for this file.
// MUI Dialog's scroll lock (overflow:hidden, padding-right) persists on document.body
// across tests in single-fork vitest mode, causing userEvent to falsely reject clicks.
// The events themselves fire correctly — only the pre-check is unreliable.
const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

// Mock fetch for API calls
const mockFetch = vi.fn();

describe('MealEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('suppresses prep instructions UI for meal items', async () => {
    vi.stubGlobal('fetch', mockFetch);
    // MealEditor loads food items + recipes on mount, IngredientInput also loads recipes on mount.
    // Make all fetches resolve quickly to avoid hanging tests.
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/food-items')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      if (url.includes('/api/recipes')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    render(
      <MealEditor
        mealItems={[{ type: 'foodItem', id: 'f1', name: 'Onion', quantity: 1, unit: 'cup' }]}
        onChange={vi.fn()}
        onFoodItemAdded={vi.fn()}
      />
    );

    // Should not render at all in meal plan editing context
    await waitFor(() => {
      expect(screen.queryByText(/add prep instructions/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/show prep instructions/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/prep instructions/i)).not.toBeInTheDocument();
    });
  });

  it('suppresses prep instructions UI for ingredient group items', async () => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/food-items')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      if (url.includes('/api/recipes')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    render(
      <MealEditor
        mealItems={[
          {
            type: 'ingredientGroup',
            id: '',
            name: '',
            ingredients: [
              {
                title: 'Group 1',
                ingredients: [
                  {
                    type: 'foodItem',
                    id: 'f1',
                    quantity: 1,
                    unit: 'cup',
                    name: 'Onion',
                    prepInstructions: 'chopped',
                  } as any,
                ],
              },
            ],
          },
        ]}
        onChange={vi.fn()}
        onFoodItemAdded={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/add prep instructions/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/show prep instructions/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/prep instructions/i)).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/e.g., chopped/i)).not.toBeInTheDocument();
    });
  });

  it('auto-selects newly created food item in meal editor', async () => {
    // This test uses MSW for all fetches (food items GET, recipes GET, food item POST).
    // MSW's default POST handler returns { _id: 'new-food-id', ...body }.
    const user = setupUser();
    const onChange = vi.fn();
    const onFoodItemAdded = vi.fn();

    const { rerender } = render(
      <MealEditor mealItems={[]} onChange={onChange} onFoodItemAdded={onFoodItemAdded} />
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
        unit: 'cup',
      }),
    ]);

    // Get the updated meal items from the last onChange call
    const updatedMealItems = onChange.mock.calls[onChange.mock.calls.length - 1][0];

    // Re-render with the updated meal items
    rerender(
      <MealEditor
        mealItems={updatedMealItems}
        onChange={onChange}
        onFoodItemAdded={onFoodItemAdded}
      />
    );

    // Type a new food item name in the ingredient input
    const input = screen.getByPlaceholderText(/food item or recipe/i);
    await user.type(input, 'Fresh Avocado');

    // Press Enter to open the add dialog
    await user.keyboard('{Enter}');

    // Wait for the dialog to appear and fill in the form
    const nameField = await screen.findByLabelText(/default name/i);
    await user.clear(nameField);
    await user.type(nameField, 'Fresh Avocado');

    // Click the name field to ensure focus is in the dialog and close any autocomplete popups
    await user.click(nameField);

    // Wait for any stale popup to close before opening the unit selector
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    // Select "cup" unit — type to reliably trigger popup open
    const dialog = screen.getByRole('dialog');
    const unitCombobox = within(dialog).getByRole('combobox', { name: /typical usage unit/i });
    await user.clear(unitCombobox);
    await user.type(unitCombobox, 'cup');
    const unitListbox = await screen.findByRole('listbox');
    await user.click(within(unitListbox).getByRole('option', { name: /cup/i }));

    // Wait for unit popup to close
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

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
          unit: 'cup',
        })
      );
    });

    // Verify that onFoodItemAdded was called with the new food item
    expect(onFoodItemAdded).toHaveBeenCalledWith({
      name: 'Fresh Avocado',
      singularName: 'Fresh Avocado',
      pluralName: 'Fresh Avocado',
      unit: 'cup',
      isGlobal: true,
    });

    // Wait for the dialog to close so MUI's modal manager cleans up properly
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('handles auto-selection when foodItems state is not yet updated', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    const onFoodItemAdded = vi.fn();

    // Mock the initial data loading
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          _id: 'existing1',
          name: 'Apple',
          singularName: 'Apple',
          pluralName: 'Apples',
          unit: 'piece',
          isGlobal: false,
        },
      ],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [], // No recipes
    });

    // Override MSW handler for food item creation to return our test data
    // Note: The unit should match what the dialog sends (cup in this case)
    const newFoodItem = {
      _id: 'new-food-timing-test',
      name: 'Organic Blueberries',
      singularName: 'Organic Blueberries',
      pluralName: 'Organic Blueberries',
      unit: 'cup', // Matches what the test selects
      isGlobal: true, // Dialog defaults to global
    };

    server.use(
      http.post('/api/food-items', async ({ request }) => {
        const body = (await request.json()) as any;
        return HttpResponse.json(newFoodItem, { status: 201 });
      })
    );

    const { rerender } = render(
      <MealEditor mealItems={[]} onChange={onChange} onFoodItemAdded={onFoodItemAdded} />
    );

    // Add a meal item
    const addMealItemButton = screen.getByRole('button', { name: /^add meal item$/i });
    await user.click(addMealItemButton);

    // Get the updated meal items
    const updatedMealItems = onChange.mock.calls[onChange.mock.calls.length - 1][0];

    // Re-render with the updated meal items
    rerender(
      <MealEditor
        mealItems={updatedMealItems}
        onChange={onChange}
        onFoodItemAdded={onFoodItemAdded}
      />
    );

    // Type a new food item name
    const input = screen.getByPlaceholderText(/food item or recipe/i);
    await user.type(input, 'Organic Blueberries');

    // Press Enter to open the add dialog
    await user.keyboard('{Enter}');

    // Fill in the form (single page now)
    const nameField = await screen.findByLabelText(/default name/i);
    await user.clear(nameField);
    await user.type(nameField, 'Organic Blueberries');

    // Click the name field to ensure focus is in the dialog
    await user.click(nameField);

    // Wait for any stale popup to close
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    // Select "cup" unit — type to reliably trigger popup open
    const dialog = screen.getByRole('dialog');
    const unitCombobox = within(dialog).getByRole('combobox', { name: /typical usage unit/i });
    await user.clear(unitCombobox);
    await user.type(unitCombobox, 'cup');
    const unitListbox2 = await screen.findByRole('listbox');
    await user.click(within(unitListbox2).getByRole('option', { name: /cup/i }));

    // Submit the form (no Step 2 needed - single page form)
    const addButton = screen.getByRole('button', { name: /add food item/i });
    await user.click(addButton);

    // Wait for the auto-selection to happen
    await waitFor(() => {
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      const updatedItems = lastCall[0];
      expect(updatedItems[0]).toEqual(
        expect.objectContaining({
          type: 'foodItem',
          id: 'new-food-timing-test',
          name: 'Organic Blueberries',
          quantity: 1,
          unit: 'cup', // Matches what was selected in the dialog
        })
      );
    });

    // Verify that the ref-based fallback worked correctly (without _id, matching prop type)
    expect(onFoodItemAdded).toHaveBeenCalledWith({
      name: 'Organic Blueberries',
      singularName: 'Organic Blueberries',
      pluralName: 'Organic Blueberries',
      unit: 'cup',
      isGlobal: true,
    });
  });

  it('adds meal item group correctly', async () => {
    const user = setupUser();
    const onChange = vi.fn();

    // Mock the initial data loading
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<MealEditor mealItems={[]} onChange={onChange} onFoodItemAdded={async () => {}} />);

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
            ingredients: [],
          }),
        ],
      }),
    ]);
  });
});
