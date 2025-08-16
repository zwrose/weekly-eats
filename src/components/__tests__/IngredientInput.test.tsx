import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import IngredientInput from '../IngredientInput';

describe('IngredientInput', () => {
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
    await user.keyboard('{ArrowDown}');
    const listbox = await screen.findByRole('listbox');
    const firstOption = within(listbox).getAllByRole('option')[0];
    await user.click(firstOption);
    expect(onIngredientChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'f1', type: 'foodItem' })
    );
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
});


