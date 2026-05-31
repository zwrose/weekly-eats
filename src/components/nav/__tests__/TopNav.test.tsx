import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { pushMock, usePathnameMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  usePathnameMock: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: usePathnameMock,
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Zach Rose', isAdmin: true } } }),
  signOut: vi.fn(),
}));

import { TopNav } from '../TopNav';

beforeEach(() => {
  pushMock.mockReset();
  usePathnameMock.mockReturnValue('/recipes');
});
afterEach(cleanup);

describe('TopNav', () => {
  it('renders the wordmark and all four sections', () => {
    render(<TopNav />);
    expect(screen.getByText('Weekly Eats')).toBeInTheDocument();
    ['Plans', 'Shop', 'Recipes', 'Pantry'].forEach((l) =>
      expect(screen.getByRole('button', { name: l })).toBeInTheDocument()
    );
  });

  it('marks the active section with aria-current', () => {
    render(<TopNav />);
    expect(screen.getByRole('button', { name: 'Recipes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Plans' })).not.toHaveAttribute('aria-current');
  });

  it('navigates when a section is clicked', async () => {
    const user = userEvent.setup();
    render(<TopNav />);
    await user.click(screen.getByRole('button', { name: 'Plans' }));
    expect(pushMock).toHaveBeenCalledWith('/meal-plans');
  });

  it('opens the avatar menu', async () => {
    const user = userEvent.setup();
    render(<TopNav />);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByText('Manage food items')).toBeInTheDocument();
  });
});
