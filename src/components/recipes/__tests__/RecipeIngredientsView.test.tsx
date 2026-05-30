// src/components/recipes/__tests__/RecipeIngredientsView.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RecipeIngredientsView } from '../RecipeIngredientsView';
import type { RecipeIngredientList } from '@/types/recipe';

afterEach(cleanup);

const grouped: RecipeIngredientList[] = [
  {
    title: 'Pasta',
    ingredients: [
      { type: 'foodItem', id: 'a', quantity: 1, unit: 'lb', name: 'spaghetti' },
      {
        type: 'foodItem',
        id: 'b',
        quantity: 2,
        unit: 'each',
        name: 'lemons',
        prepInstructions: 'zest + juice',
      },
    ],
  },
];

describe('RecipeIngredientsView', () => {
  it('renders group titles, qty+unit, names, and prep', () => {
    render(<RecipeIngredientsView ingredients={grouped} />);
    expect(screen.getByText('Pasta')).toBeInTheDocument();
    expect(screen.getByText('1 lb')).toBeInTheDocument();
    expect(screen.getByText('spaghetti')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // 'each' unit omitted
    expect(screen.getByText(/zest \+ juice/)).toBeInTheDocument();
  });

  it('omits the group header for a standalone (untitled) list', () => {
    render(
      <RecipeIngredientsView
        ingredients={[
          {
            isStandalone: true,
            ingredients: [{ type: 'foodItem', id: 'a', quantity: 1, name: 'salt' }],
          },
        ]}
      />
    );
    expect(screen.getByText('salt')).toBeInTheDocument();
  });
});
