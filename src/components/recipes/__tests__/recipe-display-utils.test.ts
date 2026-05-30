import { describe, it, expect } from 'vitest';
import {
  accessLevelMeta,
  formatIngredientQty,
  recipeIngredientCount,
} from '../recipe-display-utils';
import { tokens } from '@/lib/design-tokens';

describe('accessLevelMeta', () => {
  it('maps each access level to a label + token color', () => {
    expect(accessLevelMeta('private')).toEqual({ label: 'Private', color: tokens.text.secondary });
    expect(accessLevelMeta('shared-by-you')).toEqual({
      label: 'Shared by you',
      color: tokens.state.success,
    });
    expect(accessLevelMeta('shared-by-others')).toEqual({
      label: 'Shared by others',
      color: tokens.section.recipes,
    });
  });
});

describe('formatIngredientQty', () => {
  it('omits the unit when it is "each" or missing', () => {
    expect(formatIngredientQty(2, 'each')).toBe('2');
    expect(formatIngredientQty(3, undefined)).toBe('3');
  });
  it('pluralizes the unit to match the quantity', () => {
    expect(formatIngredientQty(1, 'cup')).toBe('1 cup');
    expect(formatIngredientQty(2, 'cup')).toBe('2 cups');
    expect(formatIngredientQty(3, 'teaspoon')).toBe('3 teaspoons');
  });
  it('treats non-singular quantities (fractions, zero) as plural', () => {
    expect(formatIngredientQty(0.5, 'cup')).toBe('0.5 cups');
  });
  it('passes unknown units through unchanged', () => {
    expect(formatIngredientQty(2, 'splash')).toBe('2 splash');
  });
});

describe('recipeIngredientCount', () => {
  it('sums ingredients across all lists', () => {
    expect(
      recipeIngredientCount([
        { title: 'A', ingredients: [{ type: 'foodItem', id: 'x', quantity: 1 }] },
        {
          title: 'B',
          ingredients: [
            { type: 'foodItem', id: 'y', quantity: 1 },
            { type: 'recipe', id: 'z', quantity: 1 },
          ],
        },
      ])
    ).toBe(3);
  });
  it('handles empty / missing ingredient arrays', () => {
    expect(recipeIngredientCount([])).toBe(0);
    expect(recipeIngredientCount([{ title: '', ingredients: [] }])).toBe(0);
  });
});
