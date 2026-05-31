import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

// Unstub in afterEach (not inline) so a failed assertion can't leak the matchMedia
// stub into later tests (CLAUDE.md stub→test / unstub→afterEach).
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it('mobile: renders the same title/body/buttons as a bottom sheet and fires onConfirm', async () => {
    // matches:true → useMediaQuery(down('sm')) is true → the Drawer (sheet) branch.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Remove pantry item"
        body="Are you sure?"
        confirmLabel="Remove"
        confirmColor="error"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText('Remove pantry item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
