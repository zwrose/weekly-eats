import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

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
  default: () => <div data-testid="food-item-autocomplete" />,
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
      expect(screen.getByText(/no pantry items found/i)).toBeInTheDocument();
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
      expect(screen.getByText(/pantry items \(2\)/i)).toBeInTheDocument();
    });

    unmount();
  });
});
