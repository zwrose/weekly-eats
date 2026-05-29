import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnitEditor } from '../UnitEditor';

// unstub in afterEach (not inline) so a failed assertion can't leak the matchMedia stub.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('UnitEditor', () => {
  it('lists units and commits the selected one', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <UnitEditor
        open
        anchorEl={null}
        value="cup"
        quantity={1}
        onCommit={onCommit}
        onClose={vi.fn()}
      />
    );
    // "pint" exists in the FOOD_UNITS list (use exact match to avoid matching "pint container")
    await user.click(screen.getByRole('button', { name: /^pint$/i }));
    expect(onCommit).toHaveBeenCalledWith('pint');
  });

  it('search filters the list', async () => {
    const user = userEvent.setup();
    render(
      <UnitEditor
        open
        anchorEl={null}
        value="cup"
        quantity={1}
        onCommit={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await user.type(screen.getByPlaceholderText(/search units/i), 'gal');
    expect(screen.getByRole('button', { name: /^gallon$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^pint$/i })).not.toBeInTheDocument();
  });

  // Force the desktop Popover branch (jsdom otherwise only exercises the Drawer).
  it('desktop branch: renders the picker in a Popover and commits a selection', async () => {
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
    render(
      <UnitEditor
        open
        anchorEl={anchor}
        value="cup"
        quantity={1}
        onCommit={onCommit}
        onClose={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: /^pint$/i }));
    expect(onCommit).toHaveBeenCalledWith('pint');
    anchor.remove();
  });
});
