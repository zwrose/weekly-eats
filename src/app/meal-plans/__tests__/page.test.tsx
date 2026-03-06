import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next-auth
vi.mock('next-auth/react', async () => {
  const actual = await vi.importActual('next-auth/react');
  return {
    ...actual,
    useSession: vi.fn(() => ({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      status: 'authenticated',
    })),
  };
});

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/meal-plans'),
}));

// Mock the meal plan utilities
const mockFetchMealPlans = vi.fn();
const mockFetchMealPlanTemplate = vi.fn();

vi.mock('../../../lib/meal-plan-utils', () => ({
  fetchMealPlans: (...args: unknown[]) => mockFetchMealPlans(...args),
  fetchMealPlanTemplate: () => mockFetchMealPlanTemplate(),
  createMealPlan: vi.fn(),
  DEFAULT_TEMPLATE: {
    startDay: 'saturday' as const,
    meals: {
      breakfast: true,
      lunch: true,
      dinner: true,
      staples: false,
    },
    weeklyStaples: [],
  },
  checkMealPlanOverlap: vi.fn(() => ({ isOverlapping: false, conflict: null })),
  findNextAvailableMealPlanStartDate: vi.fn(() => ({
    startDate: '2024-01-06',
    skipped: false,
  })),
}));

// Mock meal plan sharing utilities
vi.mock('../../../lib/meal-plan-sharing-utils', () => ({
  inviteUserToMealPlanSharing: vi.fn().mockResolvedValue(undefined),
  respondToMealPlanSharingInvitation: vi.fn().mockResolvedValue(undefined),
  removeUserFromMealPlanSharing: vi.fn().mockResolvedValue(undefined),
  fetchPendingMealPlanSharingInvitations: vi.fn().mockResolvedValue([]),
  fetchSharedMealPlanUsers: vi.fn().mockResolvedValue([]),
  fetchMealPlanOwners: vi.fn().mockResolvedValue([]),
}));

// Mock hooks
vi.mock('@/lib/hooks', () => ({
  useDialog: vi.fn(() => ({
    open: false,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
  })),
  useConfirmDialog: vi.fn(() => ({
    open: false,
    data: null,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
  })),
}));

// Mock components
vi.mock('../../../components/AuthenticatedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/MealPlanBrowser', () => ({
  default: () => <div data-testid="meal-plan-browser">Meal Plan Browser</div>,
}));

// Import after mocks
import MealPlansPage from '../page';

const mockFetch = vi.fn();

describe('MealPlansPage - List View', () => {
  const mockMealPlan = {
    _id: 'meal-plan-123',
    name: 'Week of Jan 6, 2024',
    userId: 'user-123',
    startDate: '2024-01-06',
    items: [
      {
        _id: 'item-1',
        mealPlanId: 'meal-plan-123',
        dayOfWeek: 'saturday' as const,
        mealType: 'breakfast' as const,
        items: [],
      },
    ],
    template: {
      startDay: 'saturday' as const,
      meals: {
        breakfast: true,
        lunch: true,
        dinner: true,
        staples: false,
      },
      weeklyStaples: [],
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMealPlans.mockResolvedValue([mockMealPlan]);
    mockFetchMealPlanTemplate.mockResolvedValue(mockMealPlan.template);

    // Mock global fetch for user settings
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/user/settings') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              settings: {
                themeMode: 'system',
                mealPlanSharing: { invitations: [] },
                defaultMealPlanOwner: undefined,
              },
            }),
        } as Response);
      }
      return Promise.reject(new Error('Not mocked'));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('renders the page header with Meal Plans title', async () => {
    const { unmount } = render(<MealPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Meal Plans')).toBeInTheDocument();
    });

    unmount();
  });

  it('displays meal plans as list rows', async () => {
    const { unmount } = render(<MealPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Week of Jan 6, 2024')).toBeInTheDocument();
    });

    // Should have list rows (ListRow renders as role="button")
    const rows = screen.getAllByRole('button');
    const mealPlanRow = rows.find((row) => row.textContent?.includes('Week of Jan 6, 2024'));
    expect(mealPlanRow).toBeTruthy();

    unmount();
  });

  it('navigates to detail page when meal plan is clicked', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MealPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Week of Jan 6, 2024')).toBeInTheDocument();
    });

    // Click the meal plan row
    const rows = screen.getAllByRole('button');
    const mealPlanRow = rows.find((row) => row.textContent?.includes('Week of Jan 6, 2024'));
    expect(mealPlanRow).toBeTruthy();
    await user.click(mealPlanRow!);

    // Should navigate to detail page
    expect(mockPush).toHaveBeenCalledWith('/meal-plans/meal-plan-123');

    unmount();
  });

  it('shows empty state when no meal plans exist', async () => {
    mockFetchMealPlans.mockResolvedValue([]);
    const { unmount } = render(<MealPlansPage />);

    await waitFor(() => {
      expect(
        screen.getByText('No current meal plans. Create your first meal plan to get started!')
      ).toBeInTheDocument();
    });

    unmount();
  });

  it('shows meal plan count', async () => {
    const { unmount } = render(<MealPlansPage />);

    await waitFor(() => {
      expect(screen.getByText(/1 current meal plan/)).toBeInTheDocument();
    });

    unmount();
  });

  it('shows meal plan history browser', async () => {
    const { unmount } = render(<MealPlansPage />);

    await waitFor(() => {
      expect(screen.getByTestId('meal-plan-browser')).toBeInTheDocument();
    });

    unmount();
  });

  it('has settings button that navigates to settings page', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MealPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Meal Plans')).toBeInTheDocument();
    });

    // Click settings button
    const settingsButton = screen.getByLabelText(/template settings/i);
    await user.click(settingsButton);

    expect(mockPush).toHaveBeenCalledWith('/meal-plans/settings');

    unmount();
  });

  it('shows share button', async () => {
    const { unmount } = render(<MealPlansPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/share meal plans/i)).toBeInTheDocument();
    });

    unmount();
  });
});

describe('MealPlansPage - Auto-focus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMealPlans.mockResolvedValue([]);
    mockFetchMealPlanTemplate.mockResolvedValue(null);

    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/user/settings') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              settings: {
                themeMode: 'system',
                mealPlanSharing: { invitations: [] },
                defaultMealPlanOwner: undefined,
              },
            }),
        } as Response);
      }
      return Promise.reject(new Error('Not mocked'));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('auto-focuses Email Address field when share meal plans dialog opens', async () => {
    const { useDialog, useConfirmDialog } = await import('@/lib/hooks');
    // useDialog is called twice per render: createDialog, shareDialog
    let callCount = 0;
    (useDialog as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const index = callCount % 2;
      callCount++;
      if (index === 1) return { open: true, openDialog: vi.fn(), closeDialog: vi.fn() }; // shareDialog: open
      return { open: false, openDialog: vi.fn(), closeDialog: vi.fn() };
    });

    const { unmount } = render(<MealPlansPage />);

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveFocus();
    });

    unmount();
  });
});
