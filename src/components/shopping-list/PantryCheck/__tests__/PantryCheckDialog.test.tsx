import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PantryCheckDialog } from '../PantryCheckDialog';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

const matches = [
  { foodItemId: 'f1', name: 'unsalted butter', listLabel: '1 lb on list' },
  { foodItemId: 'f2', name: 'parmesan', listLabel: '0.5 lb on list' },
];

describe('PantryCheckDialog (KEEP/SKIP filtering)', () => {
  it('defaults every match to KEEP', () => {
    renderWithTheme(
      <PantryCheckDialog open matches={matches} onApply={() => {}} onClose={() => {}} />
    );
    expect(
      screen
        .getAllByRole('button', { name: /keep/i })
        .every((b) => b.getAttribute('aria-pressed') === 'true')
    ).toBe(true);
  });
  it('applies with only the kept items (skipped ones drop off)', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderWithTheme(
      <PantryCheckDialog open matches={matches} onApply={onApply} onClose={() => {}} />
    );
    const skipButtons = screen.getAllByRole('button', { name: /skip/i });
    await user.click(skipButtons[0]);
    await user.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith({ f1: 'skip', f2: 'keep' });
  });
  it('tally pill reflects how many will drop off', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <PantryCheckDialog open matches={matches} onApply={() => {}} onClose={() => {}} />
    );
    await user.click(screen.getAllByRole('button', { name: /skip/i })[0]);
    expect(screen.getByText(/1 dropping off/i)).toBeInTheDocument();
    expect(screen.getByText(/1 still on list/i)).toBeInTheDocument();
  });
});
