import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddFoodItemDialog from '../AddFoodItemDialog';

describe('AddFoodItemDialog', () => {
  const handleAdd = vi.fn();
  const handleClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    handleAdd.mockReset();
    handleClose.mockReset();
  });

  afterEach(async () => {
    // Ensure all dialogs are closed and cleaned up
    await waitFor(() => {
      cleanup();
    }, { timeout: 100 });
  });

  it('renders single-page form (no stepper)', () => {
    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    // Should not have stepper or "Next" button
    expect(screen.queryByText(/basic information/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/confirm names/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
    
    // Should have direct "Add Food Item" button
    expect(screen.getByRole('button', { name: /add food item/i })).toBeInTheDocument();
  });

  it('shows singular/plural fields when "each" unit is selected', async () => {
    const user = userEvent.setup();
    
    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    // Initially, singular/plural fields should not be visible
    expect(screen.queryByLabelText(/singular name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/plural name/i)).not.toBeInTheDocument();

    // Type name first
    await user.type(screen.getByLabelText(/default name/i), 'apples');

    // Select "each" unit
    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /each/i }));

    // Now singular/plural fields should appear
    await waitFor(() => {
      expect(screen.getByLabelText(/singular name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/plural name/i)).toBeInTheDocument();
    });
  });

  it('auto-calculates singular/plural when "each" is selected and name is entered', async () => {
    const user = userEvent.setup();
    
    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    // Type plural name
    await user.type(screen.getByLabelText(/default name/i), 'apples');

    // Select "each" unit
    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /each/i }));

    // Wait for auto-calculation
    await waitFor(() => {
      const singularField = screen.getByLabelText(/singular name/i);
      const pluralField = screen.getByLabelText(/plural name/i);
      expect(singularField).toHaveValue('apple');
      expect(pluralField).toHaveValue('apples');
    });
  });

  it('hides singular/plural fields when switching from "each" to another unit', async () => {
    const user = userEvent.setup();
    
    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    // Type name and select "each"
    await user.type(screen.getByLabelText(/default name/i), 'apples');
    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox1 = await screen.findByRole('listbox');
    await user.click(within(listbox1).getByRole('option', { name: /each/i }));

    // Verify singular/plural fields are visible
    await waitFor(() => {
      expect(screen.getByLabelText(/singular name/i)).toBeInTheDocument();
    });

    // Switch to "cup" unit
    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox2 = await screen.findByRole('listbox');
    await user.click(within(listbox2).getByRole('option', { name: /cup/i }));

    // Singular/plural fields should disappear
    await waitFor(() => {
      expect(screen.queryByLabelText(/singular name/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/plural name/i)).not.toBeInTheDocument();
    });
  });

  it('creates food item with "each" unit using singular/plural names', async () => {
    const user = userEvent.setup();
    
    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    // Fill form with "each" unit
    await user.type(screen.getByLabelText(/default name/i), 'apples');
    
    // Select "each" unit
    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /each/i }));

    // Wait for auto-calculated fields and optionally edit them
    await waitFor(() => {
      expect(screen.getByLabelText(/singular name/i)).toBeInTheDocument();
    });

    const singularField = screen.getByLabelText(/singular name/i);
    await user.clear(singularField);
    await user.type(singularField, 'apple');

    const pluralField = screen.getByLabelText(/plural name/i);
    await user.clear(pluralField);
    await user.type(pluralField, 'apples');

    // Submit
    await user.click(screen.getByRole('button', { name: /add food item/i }));

    expect(handleAdd).toHaveBeenCalledWith({
      name: 'apple',
      singularName: 'apple',
      pluralName: 'apples',
      unit: 'each',
      isGlobal: true,
      addToPantry: false,
    });
  });

  it('creates food item with non-"each" unit using default name for both singular and plural', async () => {
    const user = userEvent.setup();
    
    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    // Fill form with non-"each" unit
    await user.type(screen.getByLabelText(/default name/i), 'Flour');
    
    // Select "cup" unit (not "each")
    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /cup/i }));

    // Singular/plural fields should not appear
    expect(screen.queryByLabelText(/singular name/i)).not.toBeInTheDocument();

    // Submit
    await user.click(screen.getByRole('button', { name: /add food item/i }));

    expect(handleAdd).toHaveBeenCalledWith({
      name: 'Flour',
      singularName: 'Flour',
      pluralName: 'Flour',
      unit: 'cup',
      isGlobal: true,
      addToPantry: false,
    });
  });

  it('disables submit button when required fields are missing', async () => {
    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    const submitButton = screen.getByRole('button', { name: /add food item/i });
    
    // Initially should be disabled (no name, no unit)
    expect(submitButton).toBeDisabled();

    // Type name but no unit - still disabled
    await userEvent.type(screen.getByLabelText(/default name/i), 'Flour');
    expect(submitButton).toBeDisabled();
  });

  it('disables submit button when "each" is selected but singular/plural are missing', async () => {
    const user = userEvent.setup();
    
    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    // Type name and select "each"
    await user.type(screen.getByLabelText(/default name/i), 'a');
    
    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /each/i }));

    const submitButton = screen.getByRole('button', { name: /add food item/i });

    // If singular/plural are empty, button should be disabled
    // Wait for fields to appear and clear them if they were auto-filled
    await waitFor(() => {
      expect(screen.getByLabelText(/singular name/i)).toBeInTheDocument();
    });

    // Clear auto-filled values
    await user.clear(screen.getByLabelText(/singular name/i));
    
    // Button should be disabled now
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('includes addToPantry option in onAdd callback', async () => {
    const user = userEvent.setup();
    
    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    // Fill form
    await user.type(screen.getByLabelText(/default name/i), 'Flour');
    
    // Select unit
    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /cup/i }));

    // Check pantry checkbox
    const pantryCheckbox = screen.getByLabelText(/also add to my pantry list/i);
    await user.click(pantryCheckbox);
    expect(pantryCheckbox).toBeChecked();

    // Submit
    await user.click(screen.getByRole('button', { name: /add food item/i }));

    expect(handleAdd).toHaveBeenCalledWith(
      expect.objectContaining({ addToPantry: true })
    );
  });

  it('prefills name when prefillName prop is provided', () => {
    render(
      <AddFoodItemDialog 
        open 
        onClose={handleClose} 
        onAdd={handleAdd} 
        prefillName="Prefilled Name"
      />
    );

    const nameField = screen.getByLabelText(/default name/i);
    expect(nameField).toHaveValue('Prefilled Name');
  });

  it('disables submit button when validation fails', async () => {
    const user = userEvent.setup();
    
    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    // Button should be disabled when form is invalid
    const submitButton = screen.getByRole('button', { name: /add food item/i });
    expect(submitButton).toBeDisabled();

    // Select unit but no name - still disabled
    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /cup/i }));
    
    // Button should still be disabled (no name)
    expect(submitButton).toBeDisabled();

    // Type a character then remove it - should stay disabled
    await user.type(screen.getByLabelText(/default name/i), 'a');
    await user.clear(screen.getByLabelText(/default name/i));
    
    // Button should remain disabled
    expect(submitButton).toBeDisabled();
  });

  it('resets form when closed', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AddFoodItemDialog open={true} onClose={handleClose} onAdd={handleAdd} />
    );

    // Fill form
    await user.type(await screen.findByLabelText(/default name/i), 'Test Item');
    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /cup/i }));

    // Verify form is filled
    const nameField = screen.getByLabelText(/default name/i);
    expect(nameField).toHaveValue('Test Item');

    // Close dialog
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(handleClose).toHaveBeenCalled();

    // Close the dialog (set open to false)
    rerender(
      <AddFoodItemDialog open={false} onClose={handleClose} onAdd={handleAdd} />
    );

    // Wait a bit for cleanup
    await waitFor(() => {
      expect(screen.queryByLabelText(/default name/i)).not.toBeInTheDocument();
    });

    // Reopen dialog - form should be reset
    rerender(
      <AddFoodItemDialog open={true} onClose={handleClose} onAdd={handleAdd} />
    );

    // Verify form is reset - name field should be empty
    const newNameField = await screen.findByLabelText(/default name/i);
    expect(newNameField).toHaveValue('');
    
    // Verify we can fill the form fresh (which means it was reset)
    await user.type(newNameField, 'New Item');
    expect(newNameField).toHaveValue('New Item');
    
    // Verify unit field works - we should be able to select a different unit
    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const newListbox = await screen.findByRole('listbox');
    await user.click(within(newListbox).getByRole('option', { name: /each/i }));
    
    // If we got here without errors, the form was properly reset
    expect(screen.getByLabelText(/singular name/i)).toBeInTheDocument();
  });

  it('allows editing auto-calculated singular/plural names', async () => {
    const user = userEvent.setup();
    
    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    // Type name that will be auto-calculated
    await user.type(screen.getByLabelText(/default name/i), 'apples');

    // Select "each" unit
    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /each/i }));

    // Wait for auto-calculation
    await waitFor(() => {
      expect(screen.getByLabelText(/singular name/i)).toHaveValue('apple');
    });

    // Edit the singular name
    const singularField = screen.getByLabelText(/singular name/i);
    await user.clear(singularField);
    await user.type(singularField, 'green apple');

    // Edit the plural name
    const pluralField = screen.getByLabelText(/plural name/i);
    await user.clear(pluralField);
    await user.type(pluralField, 'green apples');

    // Submit
    await user.click(screen.getByRole('button', { name: /add food item/i }));

    expect(handleAdd).toHaveBeenCalledWith({
      name: 'green apple',
      singularName: 'green apple',
      pluralName: 'green apples',
      unit: 'each',
      isGlobal: true,
      addToPantry: false,
    });
  });

  it('handles personal access level option', async () => {
    const user = userEvent.setup();
    
    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    // Fill form
    await user.type(screen.getByLabelText(/default name/i), 'Flour');
    
    // Select unit
    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /cup/i }));

    // Select personal access level
    const personalRadio = screen.getByLabelText(/personal \(only visible to you\)/i);
    await user.click(personalRadio);

    // Submit
    await user.click(screen.getByRole('button', { name: /add food item/i }));

    expect(handleAdd).toHaveBeenCalledWith(
      expect.objectContaining({ isGlobal: false })
    );
  });

  it('shows error when onAdd rejects with an error', async () => {
    const user = userEvent.setup();
    handleAdd.mockRejectedValueOnce(new Error('Food item already exists'));

    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    // Fill the form
    await user.type(screen.getByLabelText(/default name/i), 'Flour');

    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /cup/i }));

    // Submit
    await user.click(screen.getByRole('button', { name: /add food item/i }));

    // Assert the alert shows the error message
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Food item already exists');
    });

    // Assert the form was NOT reset (name field still has "Flour")
    expect(screen.getByLabelText(/default name/i)).toHaveValue('Flour');
  });

  it('clears error and resets form on successful onAdd after failure', async () => {
    const user = userEvent.setup();
    handleAdd
      .mockRejectedValueOnce(new Error('Food item already exists'))
      .mockResolvedValueOnce(undefined);

    render(
      <AddFoodItemDialog open onClose={handleClose} onAdd={handleAdd} />
    );

    // Fill the form
    await user.type(screen.getByLabelText(/default name/i), 'Flour');

    await user.click(screen.getByRole('combobox', { name: /typical usage unit/i }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /cup/i }));

    // First submit - fails
    await user.click(screen.getByRole('button', { name: /add food item/i }));

    // Verify alert is shown
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Food item already exists');
    });

    // Second submit - succeeds
    await user.click(screen.getByRole('button', { name: /add food item/i }));

    // Verify alert is gone and form is reset
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText(/default name/i)).toHaveValue('');
  });
});