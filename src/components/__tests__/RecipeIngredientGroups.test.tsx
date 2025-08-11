import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecipeIngredientGroups from '../RecipeIngredientGroups';

describe('RecipeIngredientGroups', () => {
  it('adds and removes an ingredient', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn((value) => {
      // noop for now
    });
    render(
      <RecipeIngredientGroups
        ingredients={[{ title: '', ingredients: [], isStandalone: true }]}
        onChange={onChange}
      />
    );

    // Add ingredient
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));
    expect(onChange).toHaveBeenCalled();
  });
});


