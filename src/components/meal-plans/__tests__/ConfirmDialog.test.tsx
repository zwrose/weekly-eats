import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

afterEach(cleanup);

describe('ConfirmDialog', () => {
  it('renders title + body and fires onConfirm / onCancel', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Discard changes?"
        body="They won't be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    expect(screen.getByText(/won't be saved/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not render content when closed', () => {
    render(
      <ConfirmDialog open={false} title="X" body="Y" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.queryByText('X')).not.toBeInTheDocument();
  });
});
