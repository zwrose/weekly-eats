import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../vitest.setup';

// Index page goes through async state transitions (loadData → setState → re-render)
// which can exceed the default 1000ms waitFor timeout under CPU contention.
configure({ asyncUtilTimeout: 3000 });

// next-auth
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

// next/navigation — the index now navigates to /meal-plans/<id>.
const push = vi.fn();
const replace = vi.fn();
let searchParamsMap = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  useSearchParams: () => searchParamsMap,
}));

// Meal plan utilities. fetchMealPlans dispatches by params:
//  - { minEndDate } → current/shared plans
//  - { startDate, endDate } → past (last 6 weeks) plans
const mockFetchMealPlans = vi.fn();
const mockFetchMealPlanTemplate = vi.fn();

vi.mock('../../../lib/meal-plan-utils', () => ({
  fetchMealPlans: (...args: unknown[]) => mockFetchMealPlans(...args),
  createMealPlan: vi.fn(),
  fetchMealPlanTemplate: () => mockFetchMealPlanTemplate(),
  updateMealPlanTemplate: vi.fn(),
  DEFAULT_TEMPLATE: {
    startDay: 'saturday' as const,
    meals: { breakfast: true, lunch: true, dinner: true, staples: false },
    weeklyStaples: [],
  },
  checkMealPlanOverlap: vi.fn(() => ({ isOverlapping: false, conflict: null })),
  findNextAvailableMealPlanStartDate: vi.fn(() => ({ startDate: '2024-01-06', skipped: false })),
}));

// Sharing utilities
vi.mock('../../../lib/meal-plan-sharing-utils', () => ({
  inviteUserToMealPlanSharing: vi.fn().mockResolvedValue(undefined),
  respondToMealPlanSharingInvitation: vi.fn().mockResolvedValue(undefined),
  removeUserFromMealPlanSharing: vi.fn().mockResolvedValue(undefined),
  fetchPendingMealPlanSharingInvitations: vi.fn().mockResolvedValue([]),
  fetchSharedMealPlanUsers: vi.fn().mockResolvedValue([]),
  fetchMealPlanOwners: vi.fn().mockResolvedValue([]),
}));

// Dialog hooks
vi.mock('@/lib/hooks', () => ({
  useDialog: vi.fn(() => ({ open: false, openDialog: vi.fn(), closeDialog: vi.fn() })),
  useConfirmDialog: vi.fn(() => ({
    open: false,
    data: null,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
  })),
}));

// Heavy / unrelated child components
vi.mock('../../../components/AuthenticatedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/AddFoodItemDialog', () => ({
  default: () => <div>Add Food Item Dialog</div>,
}));

vi.mock('@/components/meal-plans/MealEditorDialog', () => ({
  MealEditorDialog: () => <div data-testid="meal-editor-dialog">Meal Editor Dialog</div>,
}));

// MealPlanBrowser is the "View older →" reveal target — stub it so we can assert
// it is collapsed (absent) by default and mounts on click.
vi.mock('../../../components/MealPlanBrowser', () => ({
  default: () => <div data-testid="meal-plan-browser">Meal Plan Browser</div>,
}));

// Import after mocks
import MealPlansPage from '../page';

const currentPlan = {
  _id: 'p1',
  name: 'Week of Jan 6, 2024',
  userId: 'user-123',
  startDate: '2024-01-06',
  endDate: '2024-01-12',
  items: [],
  template: {
    startDay: 'saturday' as const,
    meals: { breakfast: true, lunch: true, dinner: true, staples: false },
    weeklyStaples: [],
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const pastPlan = {
  _id: 'past1',
  name: 'Week of last month',
  userId: 'user-123',
  startDate: '2024-05-01',
  endDate: '2024-05-07',
  items: [],
  template: {
    startDay: 'saturday' as const,
    meals: { breakfast: true, lunch: true, dinner: true, staples: false },
    weeklyStaples: [],
  },
  createdAt: new Date('2024-05-01'),
  updatedAt: new Date('2024-05-01'),
};

function setFetchMealPlansDispatch(opts?: { current?: unknown[]; past?: unknown[] }) {
  mockFetchMealPlans.mockImplementation(
    (params?: { minEndDate?: string; startDate?: string; endDate?: string }) => {
      // Past window read uses startDate + endDate.
      if (params?.startDate && params?.endDate) {
        return Promise.resolve(opts?.past ?? []);
      }
      return Promise.resolve(opts?.current ?? []);
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsMap = new URLSearchParams('');
  setFetchMealPlansDispatch({ current: [currentPlan], past: [] });
  mockFetchMealPlanTemplate.mockResolvedValue(currentPlan.template);

  // /api/user/settings is the only real network read on the index — serve it via MSW
  // (fetchMealPlans is module-mocked above, so it never hits the network).
  server.use(
    http.get('/api/user/settings', () =>
      HttpResponse.json({ settings: { themeMode: 'system', mealPlanSharing: { invitations: [] } } })
    )
  );
});

afterEach(() => {
  cleanup();
});

describe('MealPlansPage - index navigation', () => {
  it('clicking a current plan row navigates to its detail route', async () => {
    const user = userEvent.setup();
    render(<MealPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Week of Jan 6, 2024')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Week of Jan 6, 2024'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/meal-plans/p1'));
  });

  it('renders the "Your plans" header', async () => {
    render(<MealPlansPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /your plans/i })).toBeInTheDocument();
    });
  });

  it('the Template settings button navigates to the template route', async () => {
    const user = userEvent.setup();
    render(<MealPlansPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /template settings/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: /template settings/i }));
    expect(push).toHaveBeenCalledWith('/meal-plans/template');
  });
});

describe('MealPlansPage - Past (last 6 weeks)', () => {
  it('renders the Past section + past plan name from the date-range read', async () => {
    setFetchMealPlansDispatch({ current: [currentPlan], past: [pastPlan] });
    render(<MealPlansPage />);

    await waitFor(() => {
      expect(screen.getByText(/Past · last 6 weeks/i)).toBeInTheDocument();
      expect(screen.getByText('Week of last month')).toBeInTheDocument();
    });

    // The past read uses the date-range params, not minEndDate.
    expect(
      mockFetchMealPlans.mock.calls.some(
        ([p]) => p && typeof p.startDate === 'string' && typeof p.endDate === 'string'
      )
    ).toBe(true);
  });

  it('omits the Past section when there are no past plans', async () => {
    setFetchMealPlansDispatch({ current: [currentPlan], past: [] });
    render(<MealPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Week of Jan 6, 2024')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Past · last 6 weeks/i)).not.toBeInTheDocument();
  });

  it('does not list a plan in both Current and Past (the past-window read overlaps current plans)', async () => {
    // The server's past-window query returns plans that merely *started* in the last
    // 6 weeks — including a still-current plan. It must not appear in both sections.
    setFetchMealPlansDispatch({ current: [currentPlan], past: [currentPlan] });
    render(<MealPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Week of Jan 6, 2024')).toBeInTheDocument();
    });
    // Shown once (Current only), and the Past section is omitted entirely.
    expect(screen.getAllByText('Week of Jan 6, 2024')).toHaveLength(1);
    expect(screen.queryByText(/Past · last 6 weeks/i)).not.toBeInTheDocument();
  });
});

describe('MealPlansPage - legacy deep-link redirect', () => {
  it('redirects ?viewMealPlan=…&viewMealPlan_mealPlanId=p1 to /meal-plans/p1', async () => {
    searchParamsMap = new URLSearchParams('viewMealPlan=1&viewMealPlan_mealPlanId=p1');
    render(<MealPlansPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/meal-plans/p1');
    });
  });

  it('redirects to /meal-plans when the legacy id is missing', async () => {
    searchParamsMap = new URLSearchParams('viewMealPlan=1');
    render(<MealPlansPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/meal-plans');
    });
  });
});

describe('MealPlansPage - View older reveal', () => {
  it('hides MealPlanBrowser by default and reveals it on click', async () => {
    const user = userEvent.setup();
    render(<MealPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Week of Jan 6, 2024')).toBeInTheDocument();
    });

    // Collapsed by default.
    expect(screen.queryByTestId('meal-plan-browser')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /view older/i }));

    expect(screen.getByTestId('meal-plan-browser')).toBeInTheDocument();
  });
});

describe('MealPlansPage - Auto-focus', () => {
  it('auto-focuses Email Address field when share meal plans dialog opens', async () => {
    const { useDialog } = await import('@/lib/hooks');
    // useDialog is called: createDialog, shareDialog (template editing moved to its own route).
    // shareDialog is the 2nd call — open it.
    let callCount = 0;
    (useDialog as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const index = callCount % 2;
      callCount++;
      if (index === 1) return { open: true, openDialog: vi.fn(), closeDialog: vi.fn() };
      return { open: false, openDialog: vi.fn(), closeDialog: vi.fn() };
    });

    render(<MealPlansPage />);

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveFocus();
    });
  });
});
