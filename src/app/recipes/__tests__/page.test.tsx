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
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  usePathname: vi.fn(() => '/recipes'),
}));

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
    sortBy: 'updatedAt',
    sortOrder: 'desc',
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

// Mock the hooks
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

vi.mock('../../../lib/food-items-utils', () => ({
  fetchFoodItems: vi.fn(() =>
    Promise.resolve([
      { _id: 'food-1', name: 'Pasta', singularName: 'pasta', pluralName: 'pasta', unit: 'cup' },
    ]),
  ),
  getUnitForm: vi.fn((unit: string, quantity: number) => (quantity === 1 ? unit : `${unit}s`)),
}));

// Mock components
vi.mock('../../../components/AuthenticatedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/RecipeFilterBar', () => ({
  default: ({ searchTerm, onSearchChange }: { searchTerm: string; onSearchChange: (v: string) => void }) => (
    <div data-testid="recipe-filter-bar">
      <input
        data-testid="filter-search"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search recipes..."
      />
    </div>
  ),
}));

// Mock recipe user data utilities
vi.mock('../../../lib/recipe-user-data-utils', () => ({
  fetchRecipeUserData: vi.fn(() => Promise.resolve({ tags: [], rating: undefined })),
  fetchRecipeUserDataBatch: vi.fn(() => Promise.resolve(new Map())),
  updateRecipeTags: vi.fn(),
  updateRecipeRating: vi.fn(),
  deleteRecipeRating: vi.fn(),
  fetchUserTags: vi.fn(() => Promise.resolve([])),
}));

// Mock recipe sharing utilities
const mockFetchPendingRecipeSharingInvitations = vi.fn();
const mockFetchSharedRecipeUsers = vi.fn();

vi.mock('../../../lib/recipe-sharing-utils', () => ({
  fetchPendingRecipeSharingInvitations: () => mockFetchPendingRecipeSharingInvitations(),
  fetchSharedRecipeUsers: () => mockFetchSharedRecipeUsers(),
  fetchRecipeSharingOwners: vi.fn(() => Promise.resolve([])),
  inviteUserToRecipeSharing: vi.fn(),
  respondToRecipeSharingInvitation: vi.fn(),
  removeUserFromRecipeSharing: vi.fn(),
}));

// Mock UI components
vi.mock('@/components/ui', async () => {
  const actual = await vi.importActual('@/components/ui');
  return {
    ...actual,
    ListRow: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <div data-testid="list-row" onClick={onClick} role="button">
        {children}
      </div>
    ),
    StaggeredList: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="staggered-list">{children}</div>
    ),
  };
});

// Import after mocks
import RecipesPage from '../page';

const mockRecipe = {
  _id: 'recipe-123',
  title: 'Test Recipe',
  emoji: '🍝',
  ingredients: [
    {
      title: '',
      ingredients: [{ type: 'foodItem' as const, id: 'food-1', quantity: 2, unit: 'cup' }],
      isStandalone: true,
    },
  ],
  instructions: 'Test instructions',
  isGlobal: false,
  createdBy: 'user-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  accessLevel: 'private' as const,
};

const globalRecipe = {
  ...mockRecipe,
  _id: 'recipe-456',
  title: 'Global Recipe',
  isGlobal: true,
  createdBy: 'other-user-456',
  accessLevel: 'shared-by-others' as const,
};

describe('RecipesPage - Unified List', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mock implementations to defaults
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { useDebouncedSearch } = await import('@/lib/hooks/use-debounced-search');
    (useDebouncedSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      searchTerm: '',
      debouncedSearchTerm: '',
      setSearchTerm: vi.fn(),
      clearSearch: vi.fn(),
    });

    mockFetchPendingRecipeSharingInvitations.mockResolvedValue([]);
    mockFetchSharedRecipeUsers.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the filter bar instead of a plain search bar', async () => {
    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('recipe-filter-bar')).toBeInTheDocument();
    });

    unmount();
  });

  it('renders a single unified recipe list (no Your Recipes / Global Recipes sections)', async () => {
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [mockRecipe, globalRecipe],
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      // Both desktop and mobile rows render, so use getAllByText
      expect(screen.getAllByText('Test Recipe').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Global Recipe').length).toBeGreaterThan(0);
    });

    // Should NOT have separate section headers
    expect(screen.queryByText(/your recipes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/global recipes/i)).not.toBeInTheDocument();

    // Should show total count
    expect(screen.getByText('2 recipes found')).toBeInTheDocument();

    // Should use StaggeredList wrapper
    expect(screen.getByTestId('staggered-list')).toBeInTheDocument();

    unmount();
  });

  it('shows empty state when no recipes found', async () => {
    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      expect(screen.getByText('No recipes found')).toBeInTheDocument();
    });

    unmount();
  });

  it('shows filter-specific empty state when filters are active', async () => {
    const { useDebouncedSearch } = await import('@/lib/hooks/use-debounced-search');
    (useDebouncedSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      searchTerm: 'nonexistent',
      debouncedSearchTerm: 'nonexistent',
      setSearchTerm: vi.fn(),
      clearSearch: vi.fn(),
    });

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      expect(screen.getByText('No recipes match your filters')).toBeInTheDocument();
    });

    unmount();
  });

  it('shows loading state', async () => {
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: true,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    unmount();
  });

  it('shows pagination when multiple pages exist', async () => {
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [mockRecipe],
      total: 50,
      page: 1,
      limit: 10,
      totalPages: 2,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      // MUI Pagination renders navigation with aria-label="pagination navigation"
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    unmount();
  });
});

describe('RecipesPage - Navigation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetchPendingRecipeSharingInvitations.mockResolvedValue([]);
    mockFetchSharedRecipeUsers.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('navigates to /recipes/new when add button is clicked', async () => {
    const user = userEvent.setup();

    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      expect(screen.getByText('Recipes')).toBeInTheDocument();
    });

    // Click the visible "Add Recipe" button (desktop)
    const addButton = screen.getByRole('button', { name: /add recipe/i });
    await user.click(addButton);

    expect(mockPush).toHaveBeenCalledWith('/recipes/new');

    unmount();
  });

  it('navigates to /recipes/[id] when a recipe row is clicked', async () => {
    const user = userEvent.setup();

    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [mockRecipe],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Test Recipe').length).toBeGreaterThan(0);
    });

    // Click on the recipe row
    const rows = screen.getAllByTestId('list-row');
    await user.click(rows[0]);

    expect(mockPush).toHaveBeenCalledWith('/recipes/recipe-123');

    unmount();
  });

  it('renders flat ListRow components instead of Table or Paper cards', async () => {
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [mockRecipe],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      // Should use ListRow components
      expect(screen.getAllByTestId('list-row').length).toBeGreaterThan(0);
    });

    // Should NOT have table elements
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    unmount();
  });
});
