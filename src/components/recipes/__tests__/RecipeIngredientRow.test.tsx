// src/components/recipes/__tests__/RecipeIngredientRow.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { RecipeIngredientRow } from '../RecipeIngredientRow';
import type { RecipeIngredient } from '@/types/recipe';

afterEach(cleanup);

const base: RecipeIngredient = {
  type: 'foodItem',
  id: 'a',
  quantity: 1,
  unit: 'cup',
  name: 'flour',
};

/** Stateful wrapper so the controlled prep field accumulates typed characters. */
function Harness({ base: initialIng }: { base: RecipeIngredient }) {
  const [ing, setIng] = useState(initialIng);
  return <RecipeIngredientRow ingredient={ing} onChange={setIng} onRemove={vi.fn()} />;
}

describe('RecipeIngredientRow', () => {
  it('renders name, qty, and unit; hides unit for recipe ingredients', () => {
    const { rerender } = render(
      <RecipeIngredientRow ingredient={base} onChange={vi.fn()} onRemove={vi.fn()} />
    );
    expect(screen.getByText('flour')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quantity/i })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /unit/i })).toBeInTheDocument();

    rerender(
      <RecipeIngredientRow
        ingredient={{ type: 'recipe', id: 'r', quantity: 2, name: 'pesto' }}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /unit/i })).not.toBeInTheDocument();
  });

  it('pluralizes the unit button to match the quantity', () => {
    render(
      <RecipeIngredientRow
        ingredient={{ ...base, quantity: 2, unit: 'cup' }}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /unit/i })).toHaveTextContent('cups');
  });

  it('remove fires onRemove', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<RecipeIngredientRow ingredient={base} onChange={vi.fn()} onRemove={onRemove} />);
    await user.click(screen.getByRole('button', { name: /remove flour/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('adds a prep field and typing accumulates in the controlled field', async () => {
    const user = userEvent.setup();
    render(<Harness base={base} />);
    await user.click(screen.getByRole('button', { name: /prep instructions/i }));
    const prep = screen.getByPlaceholderText(/sifted/i);
    await user.type(prep, 'sifted');
    expect(prep).toHaveValue('sifted');
  });
});
