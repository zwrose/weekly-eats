import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../vitest.setup';
import IngredientInput from '../IngredientInput';

// Mock fetch for API calls
const mockFetch = vi.fn();

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
      http.get('/api/food-items', () => {
        return HttpResponse.json({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
      }),
      http.get('/api/recipes', () => {
        return HttpResponse.json({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
      }),
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
      http.get('/api/food-items', () => {
        return HttpResponse.json({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
      }),
      http.get('/api/recipes', () => {
        return HttpResponse.json({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
      }),
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

  describe('Prep Instructions', () => {
    const mockFoodItems = [
      { _id: 'f1', name: 'Onion', singularName: 'Onion', pluralName: 'Onions', unit: 'cup' }
    ];

    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetch);
      // Mock fetch for food items and recipes
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/food-items')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFoodItems
          } as Response);
        }
        if (url.includes('/api/recipes')) {
          return Promise.resolve({
            ok: true,
            json: async () => []
          } as Response);
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('does not show prep instructions UI when allowPrepInstructions is false', async () => {
      const onIngredientChange = vi.fn();
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup', name: 'Onion' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
          allowPrepInstructions={false}
        />
      );

      // This UI should never render in this mode (even after async data loads)
      await waitFor(() => {
        expect(screen.queryByText(/add prep instructions/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/show prep instructions/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/prep instructions/i)).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText(/e.g., chopped/i)).not.toBeInTheDocument();
      });
    });

    it('does not show prep instructions field even if ingredient has prepInstructions when allowPrepInstructions is false', async () => {
      const onIngredientChange = vi.fn();
      render(
        <IngredientInput
          ingredient={{
            type: 'foodItem',
            id: 'f1',
            quantity: 1,
            unit: 'cup',
            name: 'Onion',
            prepInstructions: 'chopped',
          }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
          allowPrepInstructions={false}
        />
      );

      await waitFor(() => {
        expect(screen.queryByLabelText(/prep instructions/i)).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText(/e.g., chopped/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/show prep instructions/i)).not.toBeInTheDocument();
      });
    });

    it('does not show prep instructions field for recipe ingredients', () => {
      const onIngredientChange = vi.fn();
      render(
        <IngredientInput
          ingredient={{ type: 'recipe', id: 'r1', quantity: 1, name: 'Pasta' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );
      
      expect(screen.queryByText(/add prep instructions/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/prep instructions/i)).not.toBeInTheDocument();
    });

    it('does not show prep instructions field for food items without id', () => {
      const onIngredientChange = vi.fn();
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: '', quantity: 1, unit: 'cup' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );
      
      expect(screen.queryByText(/add prep instructions/i)).not.toBeInTheDocument();
    });

    it('shows "Add prep instructions" button for food items with id', async () => {
      const onIngredientChange = vi.fn();
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup', name: 'Onion' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText(/add prep instructions/i)).toBeInTheDocument();
      });
    });

    it('expands prep instructions field when "Add prep instructions" is clicked', async () => {
      const user = userEvent.setup();
      const onIngredientChange = vi.fn();
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup', name: 'Onion' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText(/add prep instructions/i)).toBeInTheDocument();
      });
      
      const addButton = screen.getByText(/add prep instructions/i);
      await user.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/e.g., chopped/i)).toBeInTheDocument();
      });
      expect(screen.queryByText(/add prep instructions/i)).not.toBeInTheDocument();
    });

    it('auto-focuses prep instructions field when "Add prep instructions" is clicked', async () => {
      const user = userEvent.setup();
      const onIngredientChange = vi.fn();
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup', name: 'Onion' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/add prep instructions/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add prep instructions/i);
      await user.click(addButton);

      await waitFor(() => {
        const prepField = screen.getByPlaceholderText(/e.g., chopped/i);
        expect(prepField).toHaveFocus();
      });
    });

    it('auto-expands prep instructions field when ingredient has prepInstructions', async () => {
      const onIngredientChange = vi.fn();
      render(
        <IngredientInput
          ingredient={{ 
            type: 'foodItem', 
            id: 'f1', 
            quantity: 2, 
            unit: 'cup', 
            name: 'Onions',
            prepInstructions: 'chopped'
          }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );
      
      await waitFor(() => {
        const prepField = screen.getByPlaceholderText(/e.g., chopped/i);
        expect(prepField).toBeInTheDocument();
        expect((prepField as HTMLInputElement).value).toBe('chopped');
      });
    });

    it('saves prep instructions when typed', async () => {
      const user = userEvent.setup();
      let currentIngredient = { type: 'foodItem' as const, id: 'f1', quantity: 1, unit: 'cup' as const, name: 'Onion' };
      const onIngredientChange = vi.fn((newIngredient) => {
        currentIngredient = { ...currentIngredient, ...newIngredient };
      });
      
      render(
        <IngredientInput
          ingredient={currentIngredient}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          foodItems={mockFoodItems}
          slotId="test-slot"
        />
      );
      
      // Wait for button to appear
      await waitFor(() => {
        expect(screen.getByText(/add prep instructions/i)).toBeInTheDocument();
      });
      
      // Expand the field
      const addButton = screen.getByText(/add prep instructions/i);
      await user.click(addButton);
      
      // Wait for the prep instructions field to appear
      const prepField = await waitFor(() => {
        return screen.getByPlaceholderText(/e.g., chopped/i) as HTMLInputElement;
      });
      
      // Use fireEvent.change to simulate typing (more reliable for controlled inputs)
      fireEvent.change(prepField, { target: { value: 'chopped' } });
      
      // Wait for onChange to be called with prepInstructions
      await waitFor(() => {
        expect(onIngredientChange).toHaveBeenCalled();
        const allCalls = onIngredientChange.mock.calls;
        
        // Check that we got at least one call with prepInstructions
        const hasPrepInstructions = allCalls.some(call => 
          call[0].prepInstructions && typeof call[0].prepInstructions === 'string' && call[0].prepInstructions.length > 0
        );
        expect(hasPrepInstructions).toBe(true);
        
        // Check for 'chopped' value
        const callsWithChopped = allCalls.filter(call => 
          call[0].prepInstructions === 'chopped'
        );
        expect(callsWithChopped.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('updates prep instructions when edited', async () => {
      const user = userEvent.setup();
      let currentIngredient = { 
        type: 'foodItem' as const, 
        id: 'f1', 
        quantity: 1, 
        unit: 'cup' as const, 
        name: 'Onion',
        prepInstructions: 'chopped'
      };
      const onIngredientChange = vi.fn((newIngredient) => {
        currentIngredient = { ...currentIngredient, ...newIngredient };
      });
      
      render(
        <IngredientInput
          ingredient={currentIngredient}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          foodItems={mockFoodItems}
          slotId="test-slot"
        />
      );
      
      const prepField = await waitFor(() => {
        return screen.getByPlaceholderText(/e.g., chopped/i) as HTMLInputElement;
      });
      
      // Verify initial value
      expect(prepField.value).toBe('chopped');
      
      // Use fireEvent.change to simulate typing new value
      fireEvent.change(prepField, { target: { value: 'diced' } });
      
      // Wait for onChange to be called with 'diced'
      await waitFor(() => {
        expect(onIngredientChange).toHaveBeenCalled();
        const allCalls = onIngredientChange.mock.calls;
        
        // Check that we got a call with 'diced'
        const callsWithDiced = allCalls.filter(call => 
          call[0].prepInstructions === 'diced'
        );
        expect(callsWithDiced.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('removes prep instructions when field is cleared', async () => {
      const user = userEvent.setup();
      const onIngredientChange = vi.fn();
      render(
        <IngredientInput
          ingredient={{ 
            type: 'foodItem', 
            id: 'f1', 
            quantity: 1, 
            unit: 'cup', 
            name: 'Onion',
            prepInstructions: 'chopped'
          }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );
      
      await waitFor(() => {
        const field = screen.getByPlaceholderText(/e.g., chopped/i);
        expect(field).toBeInTheDocument();
      });
      
      const prepField = screen.getByPlaceholderText(/e.g., chopped/i);
      await user.clear(prepField);
      
      // Should call with undefined prepInstructions (check last call)
      await waitFor(() => {
        const calls = onIngredientChange.mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0]).toMatchObject({
          prepInstructions: undefined
        });
      });
    });

    it('collapses prep instructions field when collapse button is clicked', async () => {
      const user = userEvent.setup();
      const onIngredientChange = vi.fn();
      render(
        <IngredientInput
          ingredient={{ 
            type: 'foodItem', 
            id: 'f1', 
            quantity: 1, 
            unit: 'cup', 
            name: 'Onion',
            prepInstructions: 'chopped'
          }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/e.g., chopped/i)).toBeInTheDocument();
      });
      
      // Find collapse button by aria-label
      const collapseButton = screen.getByLabelText(/collapse prep instructions/i);
      await user.click(collapseButton);
      
      // Field should be hidden, "Show prep instructions" button should appear
      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/e.g., chopped/i)).not.toBeInTheDocument();
        expect(screen.getByText(/show prep instructions/i)).toBeInTheDocument();
      });
    });

    it('clears prep instructions when collapsing empty field', async () => {
      const user = userEvent.setup();
      const onIngredientChange = vi.fn();
      render(
        <IngredientInput
          ingredient={{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'cup', name: 'Onion' }}
          onIngredientChange={onIngredientChange}
          onRemove={() => {}}
          slotId="test-slot"
        />
      );
      
      // Wait for button and expand
      await waitFor(() => {
        expect(screen.getByText(/add prep instructions/i)).toBeInTheDocument();
      });
      
      const addButton = screen.getByText(/add prep instructions/i);
      await user.click(addButton);
      
      // Wait for field to appear
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/e.g., chopped/i)).toBeInTheDocument();
      });
      
      // Collapse without entering anything
      const collapseButton = screen.getByLabelText(/collapse prep instructions/i);
      await user.click(collapseButton);
      
      // Should call with undefined prepInstructions (check last call)
      await waitFor(() => {
        const calls = onIngredientChange.mock.calls;
        if (calls.length > 0) {
          const lastCall = calls[calls.length - 1];
          expect(lastCall[0]).toMatchObject({
            prepInstructions: undefined
          });
        }
      });
    });
  });
});


