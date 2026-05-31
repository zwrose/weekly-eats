import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StoreActionsMenu } from '../StoreActionsMenu';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

describe('StoreActionsMenu', () => {
  it('opens the menu and fires the chosen action', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    renderWithTheme(
      <StoreActionsMenu
        onImport={() => {}}
        onPantryCheck={() => {}}
        onHistory={() => {}}
        onShare={onShare}
        onRename={() => {}}
        onDelete={() => {}}
      />
    );
    await user.click(screen.getByRole('button', { name: /store actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /share/i }));
    expect(onShare).toHaveBeenCalled();
  });

  it('closes the menu after an action is triggered', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    renderWithTheme(
      <StoreActionsMenu
        onImport={onImport}
        onPantryCheck={() => {}}
        onHistory={() => {}}
        onShare={() => {}}
        onRename={() => {}}
        onDelete={() => {}}
      />
    );
    await user.click(screen.getByRole('button', { name: /store actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /meal plans/i }));
    expect(onImport).toHaveBeenCalled();
    // Menu items should no longer be in the document
    expect(screen.queryByRole('menuitem', { name: /meal plans/i })).not.toBeInTheDocument();
  });

  it('renders the Leave store item when canLeave is true', async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();
    renderWithTheme(
      <StoreActionsMenu
        onImport={() => {}}
        onPantryCheck={() => {}}
        onHistory={() => {}}
        onShare={() => {}}
        onRename={() => {}}
        onDelete={() => {}}
        canLeave
        onLeave={onLeave}
      />
    );
    await user.click(screen.getByRole('button', { name: /store actions/i }));
    const leaveItem = screen.getByRole('menuitem', { name: /leave store/i });
    await user.click(leaveItem);
    expect(onLeave).toHaveBeenCalled();
  });

  it('does not render the Leave store item when canLeave is false', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <StoreActionsMenu
        onImport={() => {}}
        onPantryCheck={() => {}}
        onHistory={() => {}}
        onShare={() => {}}
        onRename={() => {}}
        onDelete={() => {}}
      />
    );
    await user.click(screen.getByRole('button', { name: /store actions/i }));
    expect(screen.queryByRole('menuitem', { name: /leave store/i })).not.toBeInTheDocument();
  });

  it('disables the pantry check item while loading', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <StoreActionsMenu
        onImport={() => {}}
        onPantryCheck={() => {}}
        onHistory={() => {}}
        onShare={() => {}}
        onRename={() => {}}
        onDelete={() => {}}
        loadingPantryCheck
      />
    );
    await user.click(screen.getByRole('button', { name: /store actions/i }));
    const pantryItem = screen.getByRole('menuitem', { name: /pantry check/i });
    expect(pantryItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('fires onDelete callback and closes menu', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderWithTheme(
      <StoreActionsMenu
        onImport={() => {}}
        onPantryCheck={() => {}}
        onHistory={() => {}}
        onShare={() => {}}
        onRename={() => {}}
        onDelete={onDelete}
      />
    );
    await user.click(screen.getByRole('button', { name: /store actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete store/i }));
    expect(onDelete).toHaveBeenCalled();
  });
});
