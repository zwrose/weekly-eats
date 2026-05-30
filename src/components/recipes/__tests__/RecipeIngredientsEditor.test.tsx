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
vi.mock('@/lib/hooks/use-food-item-creator', () => ({
  useFoodItemCreator: () => ({
    isDialogOpen: false,
    prefillName: '',
    error: null,
    lastError: { current: null },
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    handleCreate: vi.fn(),
    clearError: vi.fn(),
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

  it('+ Group converts a standalone list to a titled group', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecipeIngredientsEditor value={standalone} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /\+ group/i }));
    // first call: the standalone list becomes grouped (isStandalone cleared, title editable)
    const next = onChange.mock.calls.at(-1)![0] as RecipeIngredientList[];
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
});
