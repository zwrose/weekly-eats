import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StoreEditorDialog } from '../StoreEditorDialog';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

describe('StoreEditorDialog', () => {
  it('create flow submits the typed name', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithTheme(<StoreEditorDialog open mode="create" onSave={onSave} onClose={() => {}} />);
    await user.type(screen.getByLabelText(/name/i), 'Greenleaf');
    await user.click(screen.getByRole('button', { name: /create store/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Greenleaf' }));
  });

  it('edit flow seeds the initial name and emoji and submits updates', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithTheme(
      <StoreEditorDialog
        open
        mode="edit"
        initialName="Target"
        initialEmoji="🎯"
        onSave={onSave}
        onClose={() => {}}
      />
    );
    const nameInput = screen.getByLabelText(/name/i);
    expect(nameInput).toHaveValue('Target');
    await user.clear(nameInput);
    await user.type(nameInput, 'Target North');
    await user.click(screen.getByRole('button', { name: /update store/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Target North', emoji: '🎯' })
    );
  });

  it('disables save when the name is empty', () => {
    renderWithTheme(<StoreEditorDialog open mode="create" onSave={vi.fn()} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /create store/i })).toBeDisabled();
  });
});
