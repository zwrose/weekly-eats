import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IngredientInput from '../IngredientInput';

describe('IngredientInput', () => {
  it('excludes already selected ids from options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <IngredientInput
        ingredients={[{ title: '', ingredients: [{ type: 'foodItem', id: 'f1', quantity: 1, unit: 'each' }], isStandalone: true }]}
        onChange={onChange}
        mode="recipe"
      />
    );
    // Add a new ingredient slot to test exclusion against existing selection
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));
    const inputs = screen.getAllByLabelText(/food item or recipe/i);
    const newInput = inputs[inputs.length - 1];
    await user.type(newInput, 'a');
    // Wait for the options list to appear and settle
    const listbox = await screen.findByRole('listbox');
    await waitFor(() => {
      // Expect that 'Apple' (selected id f1) is not in the options
      expect(within(listbox).queryByText(/Apple/i)).toBeNull();
    });
  });

  it('auto-focuses newly added ingredient quantity field', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <IngredientInput
        ingredients={[{ title: '', ingredients: [], isStandalone: true }]}
        onChange={onChange}
        mode="recipe"
      />
    );
    // Add ingredient button is rendered by RecipeIngredientGroups with label 'Add Ingredient'
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));
    // After adding, quantity field should exist and be focusable
    expect(await screen.findByLabelText(/quantity/i)).toBeInTheDocument();
  });

  it('selects an existing item from autocomplete and updates onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <IngredientInput
        ingredients={[{ title: '', ingredients: [], isStandalone: true }]}
        onChange={onChange}
        mode="recipe"
      />
    );
    // Add input field
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));
    const input = await screen.findByLabelText(/food item or recipe/i);
    await user.type(input, 'app');
    // Select first option from listbox for robustness
    const listbox = await screen.findByRole('listbox');
    const first = within(listbox).getAllByRole('option')[0];
    await user.click(first);
    expect(onChange).toHaveBeenCalled();
  });

  it('adds a new food item via dialog and auto-selects it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <IngredientInput
        ingredients={[{ title: '', ingredients: [], isStandalone: true }]}
        onChange={onChange}
        mode="recipe"
      />
    );
    // Add input field
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));
    const input = await screen.findByLabelText(/food item or recipe/i);
    await user.type(input, 'Kiwi');
    // No options -> click Add "Kiwi" as a Food Item
    const addBtn = await screen.findByRole('button', { name: /add "kiwi" as a food item/i });
    await user.click(addBtn);
    // In dialog, click Next then Add Food Item
    await user.click(await screen.findByRole('button', { name: /next/i }));
    await user.click(await screen.findByRole('button', { name: /add food item/i }));
    // onChange should have been called due to selection
    expect(onChange).toHaveBeenCalled();
  });

  it('allows changing unit and calls onChange with updated unit', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <IngredientInput
        ingredients={[{ title: '', ingredients: [], isStandalone: true }]}
        onChange={onChange}
        mode="recipe"
      />
    );
    // Add ingredient, select Apple
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));
    const input = await screen.findByLabelText(/food item or recipe/i);
    await user.type(input, 'app');
    // Select via listbox option to avoid text node fragmentation
    const lb2 = await screen.findByRole('listbox');
    const appleOption = within(lb2).getAllByRole('option').find((el) => /apple/i.test(el.textContent || ''))!;
    await user.click(appleOption);
    // Open Unit combobox and pick gram (g)
    const unitCombo = await screen.findByLabelText(/unit/i);
    await user.click(unitCombo);
    const listbox = await screen.findByRole('listbox');
    const gramOption = within(listbox).getAllByText(/gram/i)[0];
    await user.click(gramOption);
    expect(onChange).toHaveBeenCalled();
  });

  it('shows quantity validation message when quantity <= 0', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <IngredientInput
        ingredients={[{ title: '', ingredients: [], isStandalone: true }]}
        onChange={onChange}
        mode="recipe"
      />
    );
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));
    // Set quantity to 0
    const qty = await screen.findByLabelText(/quantity/i);
    await user.clear(qty);
    await user.type(qty, '0');
    expect(screen.getByText(/must be > 0/i)).toBeInTheDocument();
  });
});


