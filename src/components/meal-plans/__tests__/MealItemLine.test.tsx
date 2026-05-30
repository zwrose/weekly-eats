import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MealItemLine } from '../MealItemLine';
import { RecipeEmojiProvider } from '../recipe-emoji';
import type { MealItem } from '@/types/meal-plan';

afterEach(cleanup);

describe('MealItemLine', () => {
  it('shows the recipe emoji (looked up by id from context) before the name', () => {
    render(
      <RecipeEmojiProvider value={{ r1: '🍝' }}>
        <MealItemLine item={{ type: 'recipe', id: 'r1', name: 'Pasta', quantity: 1 }} />
      </RecipeEmojiProvider>
    );
    expect(screen.getByText('🍝')).toBeInTheDocument();
    expect(screen.getByText('Pasta')).toBeInTheDocument();
  });

  it('recipe with qty>1 shows the name and a × multiplier (no unit)', () => {
    const item: MealItem = { type: 'recipe', id: 'r1', name: 'Thai coconut curry', quantity: 2 };
    render(<MealItemLine item={item} />);
    expect(screen.getByText('Thai coconut curry')).toBeInTheDocument();
    expect(screen.getByText(/×\s*2/)).toBeInTheDocument();
  });

  it('recipe with qty 1 shows no multiplier', () => {
    const item: MealItem = { type: 'recipe', id: 'r1', name: 'Overnight oats', quantity: 1 };
    render(<MealItemLine item={item} />);
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it('food item shows name and "qty unit", omitting unit for each', () => {
    render(
      <MealItemLine
        item={{ type: 'foodItem', id: 'f1', name: 'chicken thighs', quantity: 1.5, unit: 'lb' }}
      />
    );
    expect(screen.getByText('chicken thighs')).toBeInTheDocument();
    expect(screen.getByText(/1\.5\s*lb/)).toBeInTheDocument();

    cleanup();
    render(
      <MealItemLine
        item={{ type: 'foodItem', id: 'f2', name: 'eggs', quantity: 2, unit: 'each' }}
      />
    );
    expect(screen.getByText('eggs')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText(/each/)).not.toBeInTheDocument();
  });

  it('ingredient group shows title and ingredient count', () => {
    const item: MealItem = {
      type: 'ingredientGroup',
      id: '',
      name: 'Side salad',
      ingredients: [
        {
          title: 'Side salad',
          ingredients: [
            { type: 'foodItem', id: 'a', quantity: 1, unit: 'head' },
            { type: 'foodItem', id: 'b', quantity: 1, unit: 'pint' },
            { type: 'foodItem', id: 'c', quantity: 1, unit: 'each' },
          ],
        },
      ],
    };
    render(<MealItemLine item={item} />);
    expect(screen.getByText('Side salad')).toBeInTheDocument();
    expect(screen.getByText(/\(?\s*3\s*\)?/)).toBeInTheDocument();
  });
});
