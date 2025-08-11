import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MealPlanIngredientGroups from '../MealPlanIngredientGroups';

describe('MealPlanIngredientGroups', () => {
  it('adds ingredient group and toggles standalone mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MealPlanIngredientGroups
        ingredients={[{ title: '', ingredients: [], isStandalone: true }]}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole('button', { name: /convert to groups/i }));
    expect(onChange).toHaveBeenCalled();
  });
});


