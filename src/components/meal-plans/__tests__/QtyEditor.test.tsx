import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QtyEditor } from '../QtyEditor';

// unstub in afterEach (not inline) so a failed assertion mid-test can't leak the
// matchMedia stub into later tests (CLAUDE.md stub→beforeEach / unstub→afterEach).
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('QtyEditor', () => {
  it('digit entry then Done commits the parsed number', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<QtyEditor open anchorEl={null} value={1} onCommit={onCommit} onClose={vi.fn()} />);
    // clear via backspace then type 2 5
    await user.click(screen.getByRole('button', { name: 'backspace' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '5' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onCommit).toHaveBeenCalledWith(25);
  });

  it('a preset pill sets the value', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<QtyEditor open anchorEl={null} value={1} onCommit={onCommit} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '½' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onCommit).toHaveBeenCalledWith(0.5);
  });

  it('Cancel closes without committing', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const onClose = vi.fn();
    render(<QtyEditor open anchorEl={null} value={1} onCommit={onCommit} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('decimal key produces a fractional value; a second "." is a no-op', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<QtyEditor open anchorEl={null} value={1} onCommit={onCommit} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'backspace' })); // clear "1"
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '.' }));
    await user.click(screen.getByRole('button', { name: '.' })); // guarded — ignored
    await user.click(screen.getByRole('button', { name: '5' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onCommit).toHaveBeenCalledWith(1.5);
  });

  // jsdom's matchMedia is undefined → useMediaQuery defaults to false (Drawer/mobile).
  // Force the desktop Popover branch so it isn't shipped untested.
  it('desktop branch: renders the numpad in a Popover and commits', async () => {
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
    const onCommit = vi.fn();
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(<QtyEditor open anchorEl={anchor} value={1} onCommit={onCommit} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '½' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onCommit).toHaveBeenCalledWith(0.5);
    anchor.remove();
  });
});
