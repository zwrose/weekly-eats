import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeIngredientsEditor, validateRecipeIngredients } from '../RecipeIngredientsEditor';
import type { RecipeIngredientList } from '@/types/recipe';

afterEach(cleanup);

// Stub the search hooks so the editor mounts without network.
vi.mock('@/lib/hooks/use-food-item-selector', () => ({
  useFoodItemSelector: () => ({
    inputValue: '',
    options: [],
    selectedItem: null,
    isLoading: false,
    selectedIndex: -1,
    setInputValue: vi.fn(),
    handleSelect: vi.fn(),
    handleInputChange: vi.fn(),
    handleKeyDown: vi.fn(),
    autocompleteRef: { current: null },
    quantityRef: { current: null },
  }),
}));

// useFoodItemCreator mock captures the options passed to it so tests can invoke
// onItemCreated and verify the append path (the most critical wiring in this component).
type CreatorOptions = Parameters<
  typeof import('@/lib/hooks/use-food-item-creator').useFoodItemCreator
>[0];
let capturedCreatorOptions: CreatorOptions | undefined;
vi.mock('@/lib/hooks/use-food-item-creator', () => ({
  useFoodItemCreator: vi.fn((opts: CreatorOptions) => {
    capturedCreatorOptions = opts;
    return {
      isDialogOpen: false,
      prefillName: '',
      error: null,
      lastError: { current: null },
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
      handleCreate: vi.fn(),
      clearError: vi.fn(),
    };
  }),
}));

const standalone: RecipeIngredientList[] = [
  {
    isStandalone: true,
    ingredients: [{ type: 'foodItem', id: 'a', quantity: 1, unit: 'cup', name: 'flour' }],
  },
];

describe('validateRecipeIngredients', () => {
  it('requires ≥1 ingredient and a title on every non-standalone group', () => {
    expect(validateRecipeIngredients([])).toBe(false);
    expect(validateRecipeIngredients(standalone)).toBe(true);
    expect(
      validateRecipeIngredients([
        { title: '', ingredients: [{ type: 'foodItem', id: 'a', quantity: 1 }] },
      ])
    ).toBe(false);
    expect(
      validateRecipeIngredients([
        { title: 'Sauce', ingredients: [{ type: 'foodItem', id: 'a', quantity: 1 }] },
      ])
    ).toBe(true);
  });
});

describe('RecipeIngredientsEditor', () => {
  it('renders existing ingredients and a + Group control', () => {
    render(<RecipeIngredientsEditor value={standalone} onChange={vi.fn()} />);
    expect(screen.getByText('flour')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ group/i })).toBeInTheDocument();
  });

  it('+ Group converts a standalone list to exactly 1 titled group (not 2)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecipeIngredientsEditor value={standalone} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /\+ group/i }));
    // Must produce exactly 1 group (convert-only, no extra empty group appended).
    const next = onChange.mock.calls.at(-1)![0] as RecipeIngredientList[];
    expect(next).toHaveLength(1);
    expect(next.every((l) => !l.isStandalone)).toBe(true);
  });

  it('editing a group title emits the new title', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RecipeIngredientsEditor
        value={[
          {
            title: 'Sauce',
            ingredients: [{ type: 'foodItem', id: 'a', quantity: 1, name: 'oil' }],
          },
        ]}
        onChange={onChange}
      />
    );
    const titleInput = screen.getByDisplayValue('Sauce');
    await user.type(titleInput, 'X');
    expect(onChange).toHaveBeenCalled();
  });

  it('onItemCreated appends the newly-created food item to the correct group', () => {
    // This is the most critical wiring: when the AddFoodItemDialog creates a new item,
    // useFoodItemCreator fires onItemCreated, which must append the item to the active group.
    const onChange = vi.fn();
    render(
      <RecipeIngredientsEditor
        value={[
          {
            title: 'Sauce',
            ingredients: [{ type: 'foodItem', id: 'a', quantity: 1, name: 'oil' }],
          },
          { title: 'Topping', ingredients: [] },
        ]}
        onChange={onChange}
      />
    );

    // The last AddIngredientSearch rendered corresponds to the last group (gi=1).
    // capturedCreatorOptions is set by the last useFoodItemCreator call (gi=1 group).
    expect(capturedCreatorOptions?.onItemCreated).toBeDefined();

    // Simulate the dialog creating a new food item.
    capturedCreatorOptions!.onItemCreated!({
      _id: 'new1',
      name: 'Basil',
      singularName: 'Basil',
      pluralName: 'Basil',
      unit: 'each',
    });

    // onChange should have been called with the item appended to group 1 (Topping).
    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted = onChange.mock.calls[0][0] as RecipeIngredientList[];
    expect(emitted[1].ingredients).toContainEqual({
      type: 'foodItem',
      id: 'new1',
      quantity: 1,
      unit: 'each',
      name: 'Basil',
    });
    // Group 0 must be untouched.
    expect(emitted[0].ingredients).toHaveLength(1);
  });
});
