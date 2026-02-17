import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next-auth
vi.mock('next-auth/react', async () => {
  const actual = await vi.importActual('next-auth/react');
  return {
    ...actual,
    useSession: vi.fn(() => ({
      data: { user: { id: 'user-123', email: 'test@example.com', isAdmin: false } },
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
    sortBy: 'name',
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
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
  })),
  usePersistentDialog: vi.fn(() => ({
    open: false,
    data: null,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    removeDialogData: vi.fn(),
  })),
}));

vi.mock('@/lib/food-items-utils', () => ({
  getUnitOptions: vi.fn(() => [
    { value: 'cup', label: 'Cup' },
    { value: 'gram', label: 'Gram' },
  ]),
}));

vi.mock('../../../components/AuthenticatedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import FoodItemsPage from '../page';

const personalItem = {
  _id: 'food-1',
  name: 'My Flour',
  singularName: 'flour',
  pluralName: 'flours',
  unit: 'cup',
  isGlobal: false,
  createdBy: 'user-123',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  accessLevel: 'private' as const,
};

const globalItem = {
  _id: 'food-2',
  name: 'Global Sugar',
  singularName: 'sugar',
  pluralName: 'sugars',
  unit: 'gram',
  isGlobal: true,
  createdBy: 'other-user',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  accessLevel: 'shared-by-others' as const,
};

const sharedItem = {
  _id: 'food-3',
  name: 'Shared Salt',
  singularName: 'salt',
  pluralName: 'salts',
  unit: 'gram',
  isGlobal: true,
  createdBy: 'user-123',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  accessLevel: 'shared-by-you' as const,
};

describe('FoodItemsPage - Unified List', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mock implementations to defaults
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      sortBy: 'name',
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
    const { unmount } = render(<FoodItemsPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search food items/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('renders a single unified food item list', async () => {
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [personalItem, globalItem],
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
      sortBy: 'name',
      sortOrder: 'asc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<FoodItemsPage />);

    await waitFor(() => {
      // Both desktop and mobile render, so use getAllByText
      expect(screen.getAllByText('My Flour').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Global Sugar').length).toBeGreaterThan(0);
    });

    // Should NOT have separate section headers
    expect(screen.queryByText(/your food items/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/global food items/i)).not.toBeInTheDocument();

    // Should show total count
    expect(screen.getByText('2 food items found')).toBeInTheDocument();

    unmount();
  });

  it('shows access level badges', async () => {
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [personalItem, sharedItem, globalItem],
      total: 3,
      page: 1,
      limit: 10,
      totalPages: 1,
      sortBy: 'name',
      sortOrder: 'asc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<FoodItemsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Private').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Shared by You').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Shared by Others').length).toBeGreaterThan(0);
    });

    unmount();
  });

  it('shows empty state when no food items found', async () => {
    const { unmount } = render(<FoodItemsPage />);

    await waitFor(() => {
      expect(screen.getByText('No food items found')).toBeInTheDocument();
    });

    unmount();
  });

  it('shows filter-specific empty state when search is active', async () => {
    const { useDebouncedSearch } = await import('@/lib/hooks/use-debounced-search');
    (useDebouncedSearch as any).mockReturnValue({
      searchTerm: 'nonexistent',
      debouncedSearchTerm: 'nonexistent',
      setSearchTerm: vi.fn(),
      clearSearch: vi.fn(),
    });

    const { unmount } = render(<FoodItemsPage />);

    await waitFor(() => {
      expect(screen.getByText('No food items match your search')).toBeInTheDocument();
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
      sortBy: 'name',
      sortOrder: 'asc',
      loading: true,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<FoodItemsPage />);

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    unmount();
  });

  it('shows pagination when multiple pages exist', async () => {
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [personalItem],
      total: 50,
      page: 1,
      limit: 10,
      totalPages: 2,
      sortBy: 'name',
      sortOrder: 'asc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<FoodItemsPage />);

    await waitFor(() => {
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    unmount();
  });

  it('renders access level filter dropdown', async () => {
    const { unmount } = render(<FoodItemsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/access level/i)).toBeInTheDocument();
    });

    unmount();
  });
});
