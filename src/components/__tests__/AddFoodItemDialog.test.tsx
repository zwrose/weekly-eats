import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddFoodItemDialog from '../AddFoodItemDialog';

describe('AddFoodItemDialog', () => {
  it('walks through steps and calls onAdd', async () => {
    const user = userEvent.setup();
    const handleAdd = vi.fn();

    render(
      <AddFoodItemDialog open onClose={() => {}} onAdd={handleAdd} />
    );

    // Step 1
    await user.type(screen.getByLabelText(/default name/i), 'apples');
    // Select unit (MUI Select appears as combobox in this setup)
    await user.click(screen.getByRole('combobox'));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /each/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 2 - confirm names
    await user.clear(screen.getByLabelText(/singular name/i));
    await user.type(screen.getByLabelText(/singular name/i), 'apple');
    await user.clear(screen.getByLabelText(/plural name/i));
    await user.type(screen.getByLabelText(/plural name/i), 'apples');
    await user.click(screen.getByRole('button', { name: /add food item/i }));

    expect(handleAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'apple', singularName: 'apple', pluralName: 'apples' })
    );
  });
});


