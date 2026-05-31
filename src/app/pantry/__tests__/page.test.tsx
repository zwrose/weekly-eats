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

// Mock server pagination hook
const mockSetPage = vi.fn();
const mockSetSort = vi.fn();
const mockRefetch = vi.fn();

vi.mock('@/lib/hooks/use-server-pagination', () => ({
  useServerPagination: vi.fn(() => ({
    data: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
    sortBy: 'foodItem.name',
    sortOrder: 'asc',
    loading: false,
    error: null,
    setPage: mockSetPage,
    setSort: mockSetSort,
    refetch: mockRefetch,
  })),
}));

// Mock debounced search hook
vi.mock('@/lib/hooks/use-debounced-search', () => ({
  useDebouncedSearch: vi.fn(() => ({
    searchTerm: '',
    debouncedSearchTerm: '',
    setSearchTerm: vi.fn(),
    clearSearch: vi.fn(),
  })),
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
    cancel: vi.fn(),
  })),
  useFoodItems: vi.fn(() => ({
    foodItems: [],
    addFoodItem: vi.fn(),
  })),
  useSearchPagination: vi.fn(() => ({
    searchTerm: '',
    setSearchTerm: vi.fn(),
    paginatedData: [],
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    setCurrentPage: vi.fn(),
  })),
}));

vi.mock('../../../components/AuthenticatedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/food-item-inputs/FoodItemAutocomplete', () => ({
  // Expose onChange so add-flow tests can select a food item (enabling the Add button).
  default: ({ onChange }: { onChange?: (item: { _id: string; type: string }) => void }) => (
    <button
      data-testid="mock-select-food"
      onClick={() => onChange?.({ _id: 'f1', type: 'foodItem' })}
    >
      mock select food
    </button>
  ),
}));

vi.mock('@/lib/pantry-utils', () => ({
  createPantryItem: vi.fn(),
  deletePantryItem: vi.fn(),
}));

import PantryPage from '../page';

const pantryItem1 = {
  _id: 'p1',
  foodItemId: 'f1',
  userId: 'user-123',
  addedAt: '2024-01-01',
  foodItem: { _id: 'f1', name: 'Apple', singularName: 'apple', pluralName: 'apples', unit: 'each' },
};

const pantryItem2 = {
  _id: 'p2',
  foodItemId: 'f2',
  userId: 'user-123',
  addedAt: '2024-01-02',
  foodItem: {
    _id: 'f2',
    name: 'Banana',
    singularName: 'banana',
    pluralName: 'bananas',
    unit: 'each',
  },
};

describe('PantryPage - Server Paginated', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      sortBy: 'foodItem.name',
      sortOrder: 'asc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { useDebouncedSearch } = await import('@/lib/hooks/use-debounced-search');
    (useDebouncedSearch as any).mockReturnValue({
      searchTerm: '',
      debouncedSearchTerm: '',
      setSearchTerm: vi.fn(),
      clearSearch: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders search bar', async () => {
    const { unmount } = render(<PantryPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search your pantry/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('renders pantry items list', async () => {
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [pantryItem1, pantryItem2],
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
      sortBy: 'foodItem.name',
      sortOrder: 'asc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<PantryPage />);

    await waitFor(() => {
      // Both desktop and mobile views render the item
      expect(screen.getAllByText('apples').length).toBeGreaterThan(0);
      expect(screen.getAllByText('bananas').length).toBeGreaterThan(0);
    });

    unmount();
  });

  it('shows empty state when no items', async () => {
    const { unmount } = render(<PantryPage />);

    await waitFor(() => {
      expect(screen.getByText(/no pantry items yet/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('shows search-specific empty state when search is active', async () => {
    const { useDebouncedSearch } = await import('@/lib/hooks/use-debounced-search');
    (useDebouncedSearch as any).mockReturnValue({
      searchTerm: 'nonexistent',
      debouncedSearchTerm: 'nonexistent',
      setSearchTerm: vi.fn(),
      clearSearch: vi.fn(),
    });

    const { unmount } = render(<PantryPage />);

    await waitFor(() => {
      expect(screen.getByText(/no pantry items match your search/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('shows loading state', async () => {
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      sortBy: 'foodItem.name',
      sortOrder: 'asc',
      loading: true,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<PantryPage />);

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    unmount();
  });

  it('shows pagination when multiple pages exist', async () => {
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [pantryItem1],
      total: 50,
      page: 1,
      limit: 10,
      totalPages: 5,
      sortBy: 'foodItem.name',
      sortOrder: 'asc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<PantryPage />);

    await waitFor(() => {
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    unmount();
  });

  it('shows item count in header', async () => {
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [pantryItem1, pantryItem2],
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
      sortBy: 'foodItem.name',
      sortOrder: 'asc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<PantryPage />);

    await waitFor(() => {
      // Title + accent count subline (replaces the old "Pantry Items (2)" header).
      expect(screen.getByRole('heading', { name: /pantry/i })).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    unmount();
  });

  it('shows an error snackbar when adding an item fails', async () => {
    const user = userEvent.setup();
    const { useDialog } = await import('@/lib/hooks');
    (useDialog as any).mockReturnValue({ open: true, openDialog: vi.fn(), closeDialog: vi.fn() });
    const { createPantryItem } = await import('@/lib/pantry-utils');
    (createPantryItem as any).mockRejectedValueOnce(new Error('boom'));

    const { unmount } = render(<PantryPage />);
    // Select a food item (enables the Add button), then submit.
    await user.click(await screen.findByTestId('mock-select-food'));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByText(/failed to add pantry item/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('shows an error snackbar when removing an item fails', async () => {
    const user = userEvent.setup();
    const { useConfirmDialog } = await import('@/lib/hooks');
    (useConfirmDialog as any).mockReturnValue({
      open: true,
      data: pantryItem1,
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
      cancel: vi.fn(),
    });
    const { deletePantryItem } = await import('@/lib/pantry-utils');
    (deletePantryItem as any).mockRejectedValueOnce(new Error('boom'));

    const { unmount } = render(<PantryPage />);
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(screen.getByText(/failed to remove pantry item/i)).toBeInTheDocument();
    });

    unmount();
  });
});
