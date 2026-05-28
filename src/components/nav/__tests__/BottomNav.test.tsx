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
  useSession: () => ({ data: { user: { name: 'Zach Rose', isAdmin: false } } }),
  signOut: vi.fn(),
}));

import { BottomNav } from '../BottomNav';

beforeEach(() => {
  pushMock.mockReset();
  usePathnameMock.mockReturnValue('/shopping-lists');
});
afterEach(cleanup);

describe('BottomNav', () => {
  it('renders Plans/Shop/Recipes + Account, but not a Pantry slot', () => {
    render(<BottomNav />);
    ['Plans', 'Shop', 'Recipes'].forEach((l) =>
      expect(screen.getByRole('button', { name: l })).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pantry' })).not.toBeInTheDocument();
  });

  it('marks the active slot with aria-current', () => {
    render(<BottomNav />);
    expect(screen.getByRole('button', { name: 'Shop' })).toHaveAttribute('aria-current', 'page');
  });

  it('navigates on slot click', async () => {
    const user = userEvent.setup();
    render(<BottomNav />);
    await user.click(screen.getByRole('button', { name: 'Recipes' }));
    expect(pushMock).toHaveBeenCalledWith('/recipes');
  });

  it('opens the bottom sheet with Pantry from the avatar slot', async () => {
    const user = userEvent.setup();
    render(<BottomNav />);
    await user.click(screen.getByRole('button', { name: /account/i }));
    expect(screen.getByText('Pantry')).toBeInTheDocument();
  });
});
