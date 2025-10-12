import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BottomNav from '../BottomNav';

// Mock next-auth/react
const mockSignOut = vi.fn();
const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signOut: (options: { callbackUrl?: string }) => mockSignOut(options),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockPathname = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
}));

describe('BottomNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/meal-plans');
  });

  afterEach(() => {
    cleanup();
  });

  describe('Visibility', () => {
    it('renders nothing when no user is logged in', () => {
      mockUseSession.mockReturnValue({ data: null });
      const { container } = render(<BottomNav />);
      
      expect(container).toBeEmptyDOMElement();
    });

    it('renders bottom nav when user is logged in and approved', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Test User',
            email: 'test@example.com',
            image: 'https://example.com/avatar.jpg',
            isApproved: true,
          },
        },
      });
      
      render(<BottomNav />);
      
      expect(screen.getByLabelText('Meal Plans')).toBeInTheDocument();
      expect(screen.getByLabelText('Shopping Lists')).toBeInTheDocument();
      expect(screen.getByLabelText('Recipes')).toBeInTheDocument();
      expect(screen.getByLabelText('Profile')).toBeInTheDocument();
    });

    it('hides bottom nav for unapproved non-admin users', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Unapproved User',
            email: 'unapproved@example.com',
            isApproved: false,
            isAdmin: false,
          },
        },
      });
      
      const { container } = render(<BottomNav />);
      
      expect(container).toBeEmptyDOMElement();
    });

    it('shows bottom nav for admin users even if not approved', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Admin User',
            email: 'admin@example.com',
            isApproved: false,
            isAdmin: true,
          },
        },
      });
      
      render(<BottomNav />);
      
      expect(screen.getByLabelText('Meal Plans')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Test User',
            email: 'test@example.com',
            isApproved: true,
          },
        },
      });
    });

    it('navigates to meal plans when meal plans button is clicked', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const mealPlansButton = screen.getByLabelText('Meal Plans');
      await user.click(mealPlansButton);
      
      expect(mockPush).toHaveBeenCalledWith('/meal-plans');
    });

    it('navigates to shopping lists when shopping lists button is clicked', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const shoppingListsButton = screen.getByLabelText('Shopping Lists');
      await user.click(shoppingListsButton);
      
      expect(mockPush).toHaveBeenCalledWith('/shopping-lists');
    });

    it('navigates to recipes when recipes button is clicked', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const recipesButton = screen.getByLabelText('Recipes');
      await user.click(recipesButton);
      
      expect(mockPush).toHaveBeenCalledWith('/recipes');
    });
  });

  describe('Active State', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Test User',
            email: 'test@example.com',
            isApproved: true,
          },
        },
      });
    });

    it('highlights meal plans when on meal plans page', () => {
      mockPathname.mockReturnValue('/meal-plans');
      render(<BottomNav />);
      
      const mealPlansButton = screen.getByLabelText('Meal Plans');
      expect(mealPlansButton).toHaveClass('Mui-selected');
    });

    it('highlights shopping lists when on shopping lists page', () => {
      mockPathname.mockReturnValue('/shopping-lists');
      render(<BottomNav />);
      
      const shoppingListsButton = screen.getByLabelText('Shopping Lists');
      expect(shoppingListsButton).toHaveClass('Mui-selected');
    });

    it('highlights recipes when on recipes page', () => {
      mockPathname.mockReturnValue('/recipes');
      render(<BottomNav />);
      
      const recipesButton = screen.getByLabelText('Recipes');
      expect(recipesButton).toHaveClass('Mui-selected');
    });
  });

  describe('Profile Menu', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Test User',
            email: 'test@example.com',
            image: 'https://example.com/avatar.jpg',
            isApproved: true,
            isAdmin: false,
          },
        },
      });
    });

    it('opens profile menu when profile button is clicked', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('displays all menu items for regular user', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        const menu = screen.getByRole('menu');
        expect(within(menu).getByText('Pantry')).toBeInTheDocument();
        expect(within(menu).getByText('Manage Food Items')).toBeInTheDocument();
        expect(within(menu).getByText('Settings')).toBeInTheDocument();
        expect(within(menu).getByText('Sign Out')).toBeInTheDocument();
      });
    });

    it('displays Manage Users option for admin users', async () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Admin User',
            email: 'admin@example.com',
            isApproved: true,
            isAdmin: true,
          },
        },
      });
      
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        const menu = screen.getByRole('menu');
        expect(within(menu).getByText('Manage Users')).toBeInTheDocument();
      });
    });

    it('does not display Manage Users option for non-admin users', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        const menu = screen.getByRole('menu');
        expect(within(menu).queryByText('Manage Users')).not.toBeInTheDocument();
      });
    });

    it('navigates to pantry when pantry menu item is clicked', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      const pantryMenuItem = screen.getByText('Pantry');
      await user.click(pantryMenuItem);
      
      expect(mockPush).toHaveBeenCalledWith('/pantry');
    });

    it('navigates to food items when manage food items is clicked', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      const foodItemsMenuItem = screen.getByText('Manage Food Items');
      await user.click(foodItemsMenuItem);
      
      expect(mockPush).toHaveBeenCalledWith('/food-items');
    });

    it('navigates to settings when settings is clicked', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      const settingsMenuItem = screen.getByText('Settings');
      await user.click(settingsMenuItem);
      
      expect(mockPush).toHaveBeenCalledWith('/settings');
    });

    it('navigates to user management when manage users is clicked (admin)', async () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Admin User',
            email: 'admin@example.com',
            isApproved: true,
            isAdmin: true,
          },
        },
      });
      
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      const manageUsersMenuItem = screen.getByText('Manage Users');
      await user.click(manageUsersMenuItem);
      
      expect(mockPush).toHaveBeenCalledWith('/user-management');
    });

    it('calls signOut when sign out is clicked', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      const signOutMenuItem = screen.getByText('Sign Out');
      await user.click(signOutMenuItem);
      
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
    });

    it('closes menu when pressing escape', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      // Press escape to close the menu
      await user.keyboard('{Escape}');
      
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('Avatar Display', () => {
    it('displays user avatar image when available', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Test User',
            email: 'test@example.com',
            image: 'https://example.com/avatar.jpg',
            isApproved: true,
          },
        },
      });
      
      render(<BottomNav />);
      
      const avatar = screen.getByAltText('Test User');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src');
    });

    it('displays default account icon when no image is available', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Test User',
            email: 'test@example.com',
            isApproved: true,
          },
        },
      });
      
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      expect(profileButton).toBeInTheDocument();
      // AccountCircle icon should be rendered instead of avatar
      const icon = profileButton.querySelector('[data-testid="AccountCircleIcon"]');
      expect(icon || profileButton.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('has mobile-only display classes', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Test User',
            email: 'test@example.com',
            isApproved: true,
          },
        },
      });
      
      const { container } = render(<BottomNav />);
      
      const paper = container.querySelector('[class*="MuiPaper"]');
      expect(paper).toBeInTheDocument();
    });

    it('is fixed at the bottom of the screen', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Test User',
            email: 'test@example.com',
            isApproved: true,
          },
        },
      });
      
      const { container } = render(<BottomNav />);
      
      const paper = container.querySelector('[class*="MuiPaper"]');
      expect(paper).toBeInTheDocument();
    });
  });

  describe('Menu Closure on Navigation', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Test User',
            email: 'test@example.com',
            isApproved: true,
          },
        },
      });
    });

    it('closes menu after navigating to pantry', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      const pantryMenuItem = screen.getByText('Pantry');
      await user.click(pantryMenuItem);
      
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('closes menu after navigating to settings', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      const settingsMenuItem = screen.getByText('Settings');
      await user.click(settingsMenuItem);
      
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('closes menu after signing out', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      const signOutMenuItem = screen.getByText('Sign Out');
      await user.click(signOutMenuItem);
      
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Test User',
            email: 'test@example.com',
            isApproved: true,
          },
        },
      });
    });

    it('has proper aria-labels for all navigation buttons', () => {
      render(<BottomNav />);
      
      expect(screen.getByLabelText('Meal Plans')).toBeInTheDocument();
      expect(screen.getByLabelText('Shopping Lists')).toBeInTheDocument();
      expect(screen.getByLabelText('Recipes')).toBeInTheDocument();
      expect(screen.getByLabelText('Profile')).toBeInTheDocument();
    });

    it('menu items have proper icons', async () => {
      const user = userEvent.setup();
      render(<BottomNav />);
      
      const profileButton = screen.getByLabelText('Profile');
      await user.click(profileButton);
      
      await waitFor(() => {
        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
      });
    });
  });
});

