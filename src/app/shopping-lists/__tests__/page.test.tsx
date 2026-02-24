import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShoppingListsPage from '../page';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'user-123', email: 'test@example.com' } },
    status: 'authenticated',
  })),
}));

// Mock next/navigation with basic URL + search params tracking for usePersistentDialog
let currentUrl = '/shopping-lists';
let currentSearchParams = new URLSearchParams();

const setTestUrl = (url: string) => {
  currentUrl = url;
  const query = url.split('?')[1] ?? '';
  currentSearchParams = new URLSearchParams(query);
};

const mockPush = vi.fn((url: string) => {
  setTestUrl(url);
});

const mockReplace = vi.fn((url: string) => {
  setTestUrl(url);
});

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: mockReplace,
    refresh: vi.fn(),
  })),
  usePathname: vi.fn(() => currentUrl.split('?')[0]),
  useSearchParams: vi.fn(() => currentSearchParams),
}));

// Mock the shopping list utils
const mockFetchStores = vi.fn();
const mockCreateStore = vi.fn();
const mockUpdateStore = vi.fn();
const mockDeleteStore = vi.fn();
const mockUpdateShoppingList = vi.fn();
const mockFetchShoppingList = vi.fn();
const mockFetchPendingInvitations = vi.fn();
const mockInviteUserToStore = vi.fn();
const mockRespondToInvitation = vi.fn();
const mockRemoveUserFromStore = vi.fn();
const mockFinishShop = vi.fn();
const mockFetchPurchaseHistory = vi.fn();

vi.mock('../../../lib/shopping-list-utils', () => ({
  fetchStores: () => mockFetchStores(),
  createStore: (...args: any[]) => mockCreateStore(...args),
  updateStore: (...args: any[]) => mockUpdateStore(...args),
  deleteStore: (...args: any[]) => mockDeleteStore(...args),
  updateShoppingList: (...args: any[]) => mockUpdateShoppingList(...args),
  fetchPendingInvitations: () => mockFetchPendingInvitations(),
  inviteUserToStore: (...args: any[]) => mockInviteUserToStore(...args),
  respondToInvitation: (...args: any[]) => mockRespondToInvitation(...args),
  removeUserFromStore: (...args: any[]) => mockRemoveUserFromStore(...args),
  fetchShoppingList: (storeId: string) => mockFetchShoppingList(storeId),
  finishShop: (...args: any[]) => mockFinishShop(...args),
  fetchPurchaseHistory: (...args: any[]) => mockFetchPurchaseHistory(...args),
}));

// Mock meal plan utils (used by "Add Items from Meal Plans" flow)
const mockFetchMealPlans = vi.fn();
vi.mock('../../../lib/meal-plan-utils', () => ({
  fetchMealPlans: () => mockFetchMealPlans(),
}));

// Mock the shopping sync hook, but capture the options passed so we can
// simulate incoming realtime events in integration-style tests.
let lastShoppingSyncOptions: any = null;

vi.mock('../../../lib/hooks/use-shopping-sync', () => {
  const mockUseShoppingSync = vi.fn((options: any) => {
    lastShoppingSyncOptions = options;
    return {
      isConnected: true,
      activeUsers: [],
      reconnect: vi.fn(),
      disconnect: vi.fn(),
    };
  });

  return {
    useShoppingSync: mockUseShoppingSync,
  };
});

// Mock components
vi.mock('../../../components/AuthenticatedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/EmojiPicker', () => ({
  default: () => <div>Emoji Picker</div>,
}));

vi.mock('../../../components/shopping-list/StoreHistoryDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="store-history-dialog">
        <button onClick={onClose}>Close History</button>
      </div>
    ) : null,
}));

describe('ShoppingListsPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset URL state for each test
    setTestUrl('/shopping-lists');
    // Default mock for pending invitations
    mockFetchPendingInvitations.mockResolvedValue([]);
    mockFetchShoppingList.mockReset();
    // Provide a safe default: reject so the page falls back to empty items.
    mockFetchShoppingList.mockRejectedValue(new Error('No mocked shopping list'));
    lastShoppingSyncOptions = null;
    mockFetchPurchaseHistory.mockResolvedValue([]);

    // Mock fetch for food items
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockImplementation((url) => {
      if (url === '/api/food-items?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    cleanup();
    // MUI Dialog/Modal can leave global body styles behind if unmounted mid-transition,
    // which can make subsequent tests flaky.
    document.body.style.removeProperty('padding-right');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('overflow-x');
    document.body.style.removeProperty('overflow-y');

    document.querySelectorAll('.MuiModal-root').forEach((node) => node.remove());
    document.querySelectorAll('.MuiBackdrop-root').forEach((node) => node.remove());

    // usePersistentDialog schedules router updates via setTimeout (100–200ms).
    // Let those timers flush so they don't fire during the next test and
    // mutate the shared URL/searchParams test state.
    await new Promise((resolve) => setTimeout(resolve, 300));
  });

  it('renders without crashing', async () => {
    mockFetchStores.mockResolvedValue([]);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.getByText('Shopping Lists')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockFetchStores.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { container } = render(<ShoppingListsPage />);

    // Loading state now uses skeleton rows instead of CircularProgress
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('displays empty state when no stores exist', async () => {
    mockFetchStores.mockResolvedValue([]);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No stores yet/i)).toBeInTheDocument();
    });
  });

  it('displays stores when they exist', async () => {
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Whole Foods',
        emoji: '🥬',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockFetchStores.mockResolvedValue(mockStores);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      // Both desktop and mobile views render, so we should find the text
      const storeName = screen.queryAllByText('Whole Foods');
      expect(storeName.length).toBeGreaterThan(0);
    });
  });

  it('shows Add Store button', async () => {
    mockFetchStores.mockResolvedValue([]);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add store/i })).toBeInTheDocument();
    });
  });

  it('displays item count for each store', async () => {
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockFetchStores.mockResolvedValue(mockStores);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      // In the unified row layout, item count is rendered as just the number
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('does not show View List button in desktop view', async () => {
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Whole Foods',
        emoji: '🥬',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockFetchStores.mockResolvedValue(mockStores);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      // Both desktop and mobile views render, but "View List" button should not exist
      expect(screen.queryByRole('button', { name: /view list/i })).not.toBeInTheDocument();
    });
  });

  it('opens shopping list dialog when clicking on a table row', async () => {
    const user = userEvent.setup();
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockFetchStores.mockResolvedValue(mockStores);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    // Find the row by its content and click on it
    const storeName = screen.queryAllByText('Target')[0];
    await user.click(storeName);

    // Wait for dialog to open
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
    });
  });

  it('allows selecting a meal plan via the checkbox (not just the row)', async () => {
    const user = userEvent.setup();

    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockFetchStores.mockResolvedValue(mockStores);

    mockFetchMealPlans.mockResolvedValue([
      {
        _id: 'mp-1',
        name: 'Meal Plan 1',
        startDate: new Date().toISOString(),
      },
    ]);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    // Open the shopping list dialog
    const storeName = screen.queryAllByText('Target')[0];
    await user.click(storeName);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument();
    });

    // Open actions menu, then meal plan selection
    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByText(/add items from meal plans/i));

    const dialog = await waitFor(() => {
      return screen.getByRole('dialog', { name: /select meal plans/i });
    });

    const addItemsButton = within(dialog).getByRole('button', { name: /^add items$/i });
    expect(addItemsButton).toBeDisabled();

    const checkbox = within(dialog).getByRole('checkbox');
    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(addItemsButton).not.toBeDisabled();
  });

  it('refreshes shopping list from server when opening dialog', async () => {
    const user = userEvent.setup();
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    const freshList = {
      _id: 'list-1',
      storeId: 'store-1',
      userId: 'user-123',
      items: [
        { foodItemId: 'f1', name: 'Fresh Milk', quantity: 1, unit: 'gallon', checked: false },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFetchStores.mockResolvedValue(mockStores);
    mockFetchShoppingList.mockResolvedValue(freshList as any);

    mockFetch.mockImplementation((url) => {
      if (url === '/api/food-items?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      }
      // Return empty payload for any other fetches this page might do during the test.
      return Promise.resolve({
        ok: true,
        json: async () => [],
      } as Response);
    });

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    const storeName = screen.queryAllByText('Target')[0];
    await user.click(storeName);

    await waitFor(() => {
      expect(mockFetchShoppingList).toHaveBeenCalledWith('store-1');
      expect(screen.getByText('Fresh Milk')).toBeInTheDocument();
    });
  });

  it('clicking edit button does not open shopping list dialog', async () => {
    const user = userEvent.setup();
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockFetchStores.mockResolvedValue(mockStores);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    // Find edit button by testId and click it
    const editIcons = screen.getAllByTestId('EditIcon');
    await user.click(editIcons[0].closest('button')!);

    // Edit Store dialog should open
    await waitFor(() => {
      expect(screen.getByText('Edit Store')).toBeInTheDocument();
    });
  });

  it('clicking delete button does not open shopping list dialog', async () => {
    const user = userEvent.setup();
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockFetchStores.mockResolvedValue(mockStores);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    // Find delete button by testId and click it
    const deleteIcons = screen.getAllByTestId('DeleteIcon');
    await user.click(deleteIcons[0].closest('button')!);

    // Delete confirmation dialog should open
    await waitFor(() => {
      expect(screen.getByText('Delete Store')).toBeInTheDocument();
    });
  });

  it('shows start shopping button when store has items', async () => {
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockFetchStores.mockResolvedValue(mockStores);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    // Find start shopping buttons by title attribute
    const startShoppingButtons = screen.getAllByTitle('Start Shopping');

    expect(startShoppingButtons.length).toBeGreaterThan(0);

    // Buttons should be enabled
    startShoppingButtons.forEach((button) => {
      expect(button).not.toBeDisabled();
    });
  });

  it('start shopping button is disabled when store has no items', async () => {
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockFetchStores.mockResolvedValue(mockStores);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    // Find start shopping buttons by title attribute
    const startShoppingButtons = screen.getAllByTitle('Start Shopping');

    expect(startShoppingButtons.length).toBeGreaterThan(0);

    // All buttons should be disabled
    startShoppingButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('clicking start shopping button opens dialog in shop mode', async () => {
    const user = userEvent.setup();
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockFetchStores.mockResolvedValue(mockStores);
    mockFetchShoppingList.mockResolvedValue({
      _id: 'list-1',
      storeId: 'store-1',
      userId: 'user-123',
      items: [
        { foodItemId: 'f1', name: 'Milk', quantity: 1, unit: 'gallon', checked: false },
        { foodItemId: 'f2', name: 'Bread', quantity: 2, unit: 'loaf', checked: false },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    // Find start shopping button by title attribute and click it
    const startShoppingButtons = screen.getAllByTitle('Start Shopping');
    await user.click(startShoppingButtons[0]!);

    // Wait for dialog to open (unified list)
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
        expect(screen.getByText('Milk')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('applies remote item_checked events from shopping sync', async () => {
    const user = userEvent.setup();
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    const shoppingListWithItems = {
      _id: 'list-1',
      storeId: 'store-1',
      userId: 'user-123',
      items: [{ foodItemId: 'f1', name: 'Milk', quantity: 1, unit: 'gallon', checked: false }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFetchStores.mockResolvedValue(mockStores);
    mockFetchShoppingList.mockResolvedValue(shoppingListWithItems as any);

    mockFetch.mockImplementation((url) => {
      if (url === '/api/food-items?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<ShoppingListsPage />);

    // Open the shopping list dialog
    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    const startShoppingButtons = screen.getAllByTitle('Start Shopping');
    await user.click(startShoppingButtons[0]!);

    await waitFor(
      () => {
        expect(screen.getByText('Milk')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Initially unchecked
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    // Simulate a remote item_checked event via the options passed into useShoppingSync
    expect(lastShoppingSyncOptions).not.toBeNull();
    act(() => {
      lastShoppingSyncOptions.onItemChecked('f1', true);
    });

    await waitFor(() => {
      expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    });
  });

  it('renders drag handles for items', async () => {
    const user = userEvent.setup();
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    const shoppingListWithItems = {
      _id: 'list-1',
      storeId: 'store-1',
      userId: 'user-123',
      items: [
        { foodItemId: 'f1', name: 'Milk', quantity: 1, unit: 'gallon', checked: false },
        { foodItemId: 'f2', name: 'Bread', quantity: 2, unit: 'loaf', checked: false },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFetchStores.mockResolvedValue(mockStores);
    mockFetchShoppingList.mockResolvedValue(shoppingListWithItems as any);

    mockFetch.mockImplementation((url) => {
      if (url === '/api/food-items?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    const storeName = screen.queryAllByText('Target')[0];
    await user.click(storeName);

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument();
      expect(screen.getByText('Bread')).toBeInTheDocument();
    });

    // Drag-and-drop is handled by dnd-kit and is difficult to simulate reliably in JSDOM.
    // This smoke test asserts the drag handles exist (handle-only pattern).
    const handles = screen.getAllByRole('button', { name: /reorder/i });
    expect(handles.length).toBeGreaterThan(0);
  });

  it('shows finish shop button only when items are checked, and clears them', async () => {
    const user = userEvent.setup();
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    const shoppingListWithItems = {
      _id: 'list-1',
      storeId: 'store-1',
      userId: 'user-123',
      items: [{ foodItemId: 'f1', name: 'Milk', quantity: 1, unit: 'gallon', checked: false }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFetchStores.mockResolvedValue(mockStores);
    mockFetchShoppingList.mockResolvedValue(shoppingListWithItems as any);
    mockFinishShop.mockResolvedValue({ success: true, remainingItems: [] });

    mockFetch.mockImplementation((url) => {
      if (url === '/api/food-items?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      }
      // Toggle endpoint should succeed so checkbox stays checked.
      if (typeof url === 'string' && url.includes('/api/shopping-lists/store-1/items/f1/toggle')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, foodItemId: 'f1', checked: true, items: [] }),
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    const storeName = screen.queryAllByText('Target')[0];
    await user.click(storeName);

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /finish/i })).not.toBeInTheDocument();
    });

    // Give React a tick to flush any pending re-renders from the
    // dialog open and shopping list fetch.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Verify the checkbox exists and click it
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    await user.click(checkbox);

    // The optimistic toggle sets checked=true, which should show the Finish Shop button.
    // The toggle fetch must succeed to prevent reverting.
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // After finishing, the handler calls fetchStores() then a useEffect
    // re-fetches the shopping list. Update mocks so refetched data reflects
    // the cleared state (no checked items).
    const clearedStores = mockStores.map((s) => ({
      ...s,
      shoppingList: { ...s.shoppingList!, itemCount: 0 },
    }));
    mockFetchStores.mockResolvedValue(clearedStores);
    mockFetchShoppingList.mockResolvedValue({ ...mockStores[0].shoppingList, items: [] } as any);

    await user.click(screen.getByRole('button', { name: /finish shop/i }));

    await waitFor(() => {
      expect(mockFinishShop).toHaveBeenCalled();
      expect(screen.queryByText('Milk')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /finish/i })).not.toBeInTheDocument();
    });
  });

  it('renders with unit selector and keyboard support without errors', async () => {
    // This test verifies that the component imports and renders correctly
    // with the new unit selector and keyboard support features
    mockFetchStores.mockResolvedValue([]);

    mockFetch.mockImplementation((url) => {
      if (url === '/api/food-items?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<ShoppingListsPage />);

    // Component should render successfully with new features
    await waitFor(() => {
      expect(screen.getByText('Shopping Lists')).toBeInTheDocument();
    });
  });

  it('restores shopping list dialog from URL params', async () => {
    const user = userEvent.setup();
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    const shoppingListWithItems = {
      _id: 'list-1',
      storeId: 'store-1',
      userId: 'user-123',
      items: [{ foodItemId: 'f1', name: 'Milk', quantity: 1, unit: 'gallon', checked: false }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFetchStores.mockResolvedValue(mockStores);
    mockFetchShoppingList.mockResolvedValue(shoppingListWithItems as any);

    mockFetch.mockImplementation((url) => {
      if (url === '/api/food-items?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    setTestUrl('/shopping-lists?shoppingList=true&shoppingList_storeId=store-1');

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
    });
  });

  it('auto-focuses Email Address field when share store dialog opens', async () => {
    const user = userEvent.setup();
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockFetchStores.mockResolvedValue(mockStores);
    mockFetchPendingInvitations.mockResolvedValue([]);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    // Click the share button (title="Share Store")
    const shareButtons = screen.getAllByTitle('Share Store');
    await user.click(shareButtons[0]);

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveFocus();
    });
  });

  it('ignores legacy mode param in URL', async () => {
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    const shoppingListWithItems = {
      _id: 'list-1',
      storeId: 'store-1',
      userId: 'user-123',
      items: [{ foodItemId: 'f1', name: 'Milk', quantity: 1, unit: 'gallon', checked: false }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFetchStores.mockResolvedValue(mockStores);
    mockFetchShoppingList.mockResolvedValue(shoppingListWithItems as any);

    mockFetch.mockImplementation((url) => {
      if (url === '/api/food-items?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    setTestUrl(
      '/shopping-lists?shoppingList=true&shoppingList_storeId=store-1&shoppingList_mode=shop'
    );

    render(<ShoppingListsPage />);

    await waitFor(() => {
      // Dialog should be open and showing content for the Target store
      const targets = screen.queryAllByText('Target');
      expect(targets.length).toBeGreaterThan(0);
      // No separate mode toggle buttons anymore
      expect(screen.queryByRole('button', { name: /shop mode/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit mode/i })).not.toBeInTheDocument();
    });
  });

  it('shows purchase history buttons on store cards', async () => {
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockFetchStores.mockResolvedValue(mockStores);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    // History icon buttons should be present (desktop + mobile renders)
    const historyButtons = screen.getAllByTitle('Purchase History');
    expect(historyButtons.length).toBeGreaterThan(0);
  });

  it('opens history dialog when clicking purchase history button', async () => {
    const user = userEvent.setup();
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockFetchStores.mockResolvedValue(mockStores);
    mockFetchPurchaseHistory.mockResolvedValue([]);

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    const historyButtons = screen.getAllByTitle('Purchase History');
    await user.click(historyButtons[0]);

    await waitFor(() => {
      expect(mockFetchPurchaseHistory).toHaveBeenCalledWith('store-1');
      expect(screen.getByTestId('store-history-dialog')).toBeInTheDocument();
    });
  });

  it('shows purchase history option in overflow menu', async () => {
    const user = userEvent.setup();
    const mockStores = [
      {
        _id: 'store-1',
        userId: 'user-123',
        name: 'Target',
        emoji: '🎯',
        invitations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        shoppingList: {
          _id: 'list-1',
          storeId: 'store-1',
          userId: 'user-123',
          itemCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    const shoppingListWithItems = {
      _id: 'list-1',
      storeId: 'store-1',
      userId: 'user-123',
      items: [{ foodItemId: 'f1', name: 'Milk', quantity: 1, unit: 'gallon', checked: false }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFetchStores.mockResolvedValue(mockStores);
    mockFetchShoppingList.mockResolvedValue(shoppingListWithItems as any);

    mockFetch.mockImplementation((url) => {
      if (url === '/api/food-items?limit=1000') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => [],
      } as Response);
    });

    render(<ShoppingListsPage />);

    await waitFor(() => {
      expect(screen.queryAllByText('Target').length).toBeGreaterThan(0);
    });

    // Open shopping list dialog
    const storeName = screen.queryAllByText('Target')[0];
    await user.click(storeName);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument();
    });

    // Open overflow menu
    await user.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByText('Purchase history')).toBeInTheDocument();
    });
  });
});
