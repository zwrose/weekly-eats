import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { pushMock, signOutMock } = vi.hoisted(() => ({ pushMock: vi.fn(), signOutMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock('next-auth/react', () => ({ signOut: signOutMock }));

import { AvatarMenu } from '../AvatarMenu';

beforeEach(() => {
  pushMock.mockReset();
  signOutMock.mockReset();
});
afterEach(cleanup);

describe('AvatarMenu', () => {
  it('shows food items + sign out, and never a Settings link', () => {
    render(<AvatarMenu variant="menu" open onClose={vi.fn()} isAdmin={false} />);
    expect(screen.getByText('Manage food items')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
    expect(screen.queryByText(/settings/i)).not.toBeInTheDocument();
  });

  it('omits Pantry in the desktop menu variant but shows it in the sheet variant', () => {
    const { rerender } = render(
      <AvatarMenu variant="menu" open onClose={vi.fn()} isAdmin={false} />
    );
    expect(screen.queryByText('Pantry')).not.toBeInTheDocument();
    rerender(<AvatarMenu variant="sheet" open onClose={vi.fn()} isAdmin={false} />);
    expect(screen.getByText('Pantry')).toBeInTheDocument();
  });

  it('shows Manage users only for admins', () => {
    const { rerender } = render(
      <AvatarMenu variant="menu" open onClose={vi.fn()} isAdmin={false} />
    );
    expect(screen.queryByText('Manage users')).not.toBeInTheDocument();
    rerender(<AvatarMenu variant="menu" open onClose={vi.fn()} isAdmin />);
    expect(screen.getByText('Manage users')).toBeInTheDocument();
  });

  it('renders the user identity header (name + email) in both variants', () => {
    const { rerender } = render(
      <AvatarMenu
        variant="menu"
        open
        onClose={vi.fn()}
        isAdmin={false}
        name="Zach Rose"
        email="zwrose@gmail.com"
      />
    );
    expect(screen.getByText('Zach Rose')).toBeInTheDocument();
    expect(screen.getByText('zwrose@gmail.com')).toBeInTheDocument();
    rerender(
      <AvatarMenu
        variant="sheet"
        open
        onClose={vi.fn()}
        isAdmin={false}
        name="Zach Rose"
        email="zwrose@gmail.com"
      />
    );
    expect(screen.getByText('Zach Rose')).toBeInTheDocument();
    expect(screen.getByText('zwrose@gmail.com')).toBeInTheDocument();
  });

  it('navigates on item click and signs out', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AvatarMenu variant="menu" open onClose={onClose} isAdmin />);
    await user.click(screen.getByText('Manage food items'));
    expect(pushMock).toHaveBeenCalledWith('/food-items');
    await user.click(screen.getByText('Sign out'));
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/' });
  });
});
