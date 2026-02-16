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
      status: 'authenticated'
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
    limit: 25,
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

// Mock the recipe utilities and hooks
vi.mock('@/lib/hooks', () => ({
  useDialog: vi.fn(() => ({
    open: false,
    openDialog: vi.fn(),
    closeDialog: vi.fn()
  })),
  useConfirmDialog: vi.fn(() => ({
    open: false,
    openDialog: vi.fn(),
    closeDialog: vi.fn()
  })),
  usePersistentDialog: vi.fn(() => ({
    open: false,
    data: null,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    removeDialogData: vi.fn()
  }))
}));

vi.mock('../../../lib/recipe-utils', () => ({
  fetchRecipe: vi.fn(() => Promise.resolve({
    _id: 'recipe-123',
    title: 'Test Recipe',
    emoji: '🍝',
    ingredients: [
      {
        title: '',
        ingredients: [
          { type: 'foodItem' as const, id: 'food-1', quantity: 2, unit: 'cup' }
        ],
        isStandalone: true
      }
    ],
    instructions: 'Test instructions',
    isGlobal: false,
    createdBy: 'user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  })),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
}));

vi.mock('../../../lib/food-items-utils', () => ({
  fetchFoodItems: vi.fn(() => Promise.resolve([
    { _id: 'food-1', name: 'Pasta', singularName: 'pasta', pluralName: 'pasta', unit: 'cup' }
  ])),
  getUnitForm: vi.fn((unit: string, quantity: number) => quantity === 1 ? unit : `${unit}s`)
}));

// Mock components
vi.mock('../../../components/AuthenticatedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('../../../components/RecipeIngredients', () => ({
  default: () => <div data-testid="recipe-ingredients">Recipe Ingredients</div>
}));

vi.mock('../../../components/EmojiPicker', () => ({
  default: () => <div data-testid="emoji-picker">Emoji Picker</div>
}));

vi.mock('@/components/RecipeFilterBar', () => ({
  default: ({ searchTerm, onSearchChange }: any) => (
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
const mockFetchRecipeUserData = vi.fn();
const mockUpdateRecipeTags = vi.fn();
const mockUpdateRecipeRating = vi.fn();
const mockDeleteRecipeRating = vi.fn();

vi.mock('../../../lib/recipe-user-data-utils', () => ({
  fetchRecipeUserData: () => mockFetchRecipeUserData(),
  fetchRecipeUserDataBatch: vi.fn(() => Promise.resolve(new Map())),
  updateRecipeTags: () => mockUpdateRecipeTags(),
  updateRecipeRating: () => mockUpdateRecipeRating(),
  deleteRecipeRating: () => mockDeleteRecipeRating(),
  fetchUserTags: vi.fn(() => Promise.resolve([])),
}));

// Mock recipe sharing utilities
const mockFetchPendingRecipeSharingInvitations = vi.fn();
const mockFetchSharedRecipeUsers = vi.fn();
const mockFetchRecipeSharingOwners = vi.fn();

vi.mock('../../../lib/recipe-sharing-utils', () => ({
  fetchPendingRecipeSharingInvitations: () => mockFetchPendingRecipeSharingInvitations(),
  fetchSharedRecipeUsers: () => mockFetchSharedRecipeUsers(),
  fetchRecipeSharingOwners: () => mockFetchRecipeSharingOwners(),
  inviteUserToRecipeSharing: vi.fn(),
  respondToRecipeSharingInvitation: vi.fn(),
  removeUserFromRecipeSharing: vi.fn(),
}));

// Mock RecipeTagsEditor and RecipeStarRating components
vi.mock('../../../components/RecipeTagsEditor', () => ({
  default: ({ tags, editable, onChange, sharedTags }: any) => {
    const tagsArray = Array.isArray(tags) ? tags : [];
    const sharedTagsArray = Array.isArray(sharedTags) ? sharedTags : [];

    return (
      <div data-testid="recipe-tags-editor" data-editable={String(editable)}>
        <div>Tags Editor</div>
        {tagsArray.map((tag: string) => (
          <span key={tag} data-testid={`tag-${tag}`}>{tag}</span>
        ))}
        {sharedTagsArray.length > 0 && (
          <div data-testid="shared-tags">
            {sharedTagsArray.map((tag: string) => (
              <span key={tag} data-testid={`shared-tag-${tag}`}>{tag}</span>
            ))}
          </div>
        )}
        {editable && onChange && (
          <button onClick={() => onChange(['new-tag'])}>Add Tag</button>
        )}
      </div>
    );
  },
}));

vi.mock('../../../components/RecipeStarRating', () => ({
  default: ({ rating, editable, onChange, sharedRatings }: any) => {
    const sharedRatingsArray = Array.isArray(sharedRatings) ? sharedRatings : [];

    return (
      <div data-testid="recipe-star-rating" data-editable={String(editable)}>
        <div>Star Rating: {rating || 'none'}</div>
        {sharedRatingsArray.length > 0 && (
          <div data-testid="shared-ratings">
            {sharedRatingsArray.map((sr: any, idx: number) => (
              <span key={idx} data-testid={`shared-rating-${sr.rating}`}>
                {sr.userEmail}: {sr.rating}
              </span>
            ))}
          </div>
        )}
        {editable && onChange && (
          <>
            <button onClick={() => onChange(5)}>Set 5 Stars</button>
            <button onClick={() => onChange(undefined)}>Clear Rating</button>
          </>
        )}
      </div>
    );
  },
}));

// Import after mocks
import RecipesPage from '../page';

const mockRecipe = {
  _id: 'recipe-123',
  title: 'Test Recipe',
  emoji: '🍝',
  ingredients: [
    {
      title: '',
      ingredients: [
        { type: 'foodItem' as const, id: 'food-1', quantity: 2, unit: 'cup' }
      ],
      isStandalone: true
    }
  ],
  instructions: 'Test instructions',
  isGlobal: false,
  createdBy: 'user-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  accessLevel: 'personal' as const,
};

const globalRecipe = {
  ...mockRecipe,
  _id: 'recipe-456',
  title: 'Global Recipe',
  isGlobal: true,
  createdBy: 'other-user-456',
  accessLevel: 'global' as const,
};

const sharedRecipe = {
  ...mockRecipe,
  _id: 'recipe-789',
  title: 'Shared Recipe',
  isGlobal: true,
  createdBy: 'user-123',
  accessLevel: 'shared-by-you' as const,
};

describe('RecipesPage - Unified List', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mock implementations to defaults (clearAllMocks only clears call counts)
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [],
      total: 0,
      page: 1,
      limit: 25,
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
    (useDebouncedSearch as any).mockReturnValue({
      searchTerm: '',
      debouncedSearchTerm: '',
      setSearchTerm: vi.fn(),
      clearSearch: vi.fn(),
    });

    mockFetchPendingRecipeSharingInvitations.mockResolvedValue([]);
    mockFetchSharedRecipeUsers.mockResolvedValue([]);
    mockFetchRecipeSharingOwners.mockResolvedValue([]);
    mockFetchRecipeUserData.mockResolvedValue({ tags: [], rating: undefined });
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
    (useServerPagination as any).mockReturnValue({
      data: [mockRecipe, globalRecipe],
      total: 2,
      page: 1,
      limit: 25,
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
      // Both desktop table and mobile card views render, so use getAllByText
      expect(screen.getAllByText('Test Recipe').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Global Recipe').length).toBeGreaterThan(0);
    });

    // Should NOT have separate section headers
    expect(screen.queryByText(/your recipes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/global recipes/i)).not.toBeInTheDocument();

    // Should show total count
    expect(screen.getByText('2 recipes found')).toBeInTheDocument();

    unmount();
  });

  it('shows access level badges for each recipe', async () => {
    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [mockRecipe, sharedRecipe, globalRecipe],
      total: 3,
      page: 1,
      limit: 25,
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
      // Access level chips should be rendered
      const personalChips = screen.getAllByText('Personal');
      const sharedChips = screen.getAllByText('Shared by You');
      const globalChips = screen.getAllByText('Global');

      expect(personalChips.length).toBeGreaterThan(0);
      expect(sharedChips.length).toBeGreaterThan(0);
      expect(globalChips.length).toBeGreaterThan(0);
    });

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
    (useDebouncedSearch as any).mockReturnValue({
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
    (useServerPagination as any).mockReturnValue({
      data: [],
      total: 0,
      page: 1,
      limit: 25,
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
    (useServerPagination as any).mockReturnValue({
      data: [mockRecipe],
      total: 50,
      page: 1,
      limit: 25,
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

describe('RecipesPage - Delete Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPendingRecipeSharingInvitations.mockResolvedValue([]);
    mockFetchSharedRecipeUsers.mockResolvedValue([]);
    mockFetchRecipeSharingOwners.mockResolvedValue([]);
    mockFetchRecipeUserData.mockResolvedValue({ tags: [], rating: undefined });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows delete button in edit mode', async () => {
    const mockPersistentDialog = vi.fn(() => ({
      open: true,
      data: { recipeId: 'recipe-123', editMode: 'true' },
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
      removeDialogData: vi.fn()
    }));

    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [mockRecipe],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { usePersistentDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(mockPersistentDialog);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    unmount();
  });

  it('opens confirmation dialog when delete button is clicked', async () => {
    const user = userEvent.setup();
    const mockOpenConfirmDialog = vi.fn();

    const mockPersistentDialog = vi.fn(() => ({
      open: true,
      data: { recipeId: 'recipe-123', editMode: 'true' },
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
      removeDialogData: vi.fn()
    }));

    const mockConfirmDialog = vi.fn(() => ({
      open: false,
      openDialog: mockOpenConfirmDialog,
      closeDialog: vi.fn()
    }));

    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [mockRecipe],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { useConfirmDialog, usePersistentDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(mockPersistentDialog);
    (useConfirmDialog as any).mockImplementation(mockConfirmDialog);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await user.click(deleteButtons[0]);

    expect(mockOpenConfirmDialog).toHaveBeenCalled();
    unmount();
  });

  it('calls deleteRecipe when deletion is confirmed', async () => {
    const user = userEvent.setup();
    const mockCloseDialog = vi.fn();
    const mockCloseConfirmDialog = vi.fn();

    const mockPersistentDialog = vi.fn(() => ({
      open: true,
      data: { recipeId: 'recipe-123', editMode: 'true' },
      openDialog: vi.fn(),
      closeDialog: mockCloseDialog,
      removeDialogData: vi.fn()
    }));

    const mockConfirmDialog = vi.fn(() => ({
      open: true,
      openDialog: vi.fn(),
      closeDialog: mockCloseConfirmDialog
    }));

    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [mockRecipe],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { useConfirmDialog, usePersistentDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(mockPersistentDialog);
    (useConfirmDialog as any).mockImplementation(mockConfirmDialog);

    const { deleteRecipe: mockDeleteRecipe } = await import('../../../lib/recipe-utils');
    (mockDeleteRecipe as any).mockResolvedValue(undefined);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const deleteTexts = screen.queryAllByText(/are you sure you want to delete/i);
      expect(deleteTexts.length).toBeGreaterThan(0);
    });

    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i });
    const confirmButton = deleteButtons[deleteButtons.length - 1];
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteRecipe).toHaveBeenCalledWith('recipe-123');
      expect(mockCloseConfirmDialog).toHaveBeenCalled();
      expect(mockCloseDialog).toHaveBeenCalled();
    });

    unmount();
  });
});

describe('RecipesPage - Tags and Ratings', () => {
  const otherUserRecipe = {
    ...mockRecipe,
    _id: 'recipe-456',
    createdBy: 'other-user-456',
    accessLevel: 'global' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRecipeUserData.mockResolvedValue({ tags: [], rating: undefined });
    mockFetchPendingRecipeSharingInvitations.mockResolvedValue([]);
    mockFetchSharedRecipeUsers.mockResolvedValue([]);
    mockFetchRecipeSharingOwners.mockResolvedValue([]);
    mockUpdateRecipeTags.mockResolvedValue({ tags: [] });
    mockUpdateRecipeRating.mockResolvedValue({ rating: 5 });
    mockDeleteRecipeRating.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows tags and ratings as editable in edit mode for owned recipes', async () => {
    const mockPersistentDialog = vi.fn(() => ({
      open: true,
      data: { recipeId: 'recipe-123', editMode: 'true' },
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
      removeDialogData: vi.fn()
    }));

    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [mockRecipe],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { usePersistentDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(mockPersistentDialog);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const tagsEditor = screen.getByTestId('recipe-tags-editor');
      expect(tagsEditor).toBeInTheDocument();
      expect(tagsEditor.getAttribute('data-editable')).toBe('true');
    });

    await waitFor(() => {
      const starRating = screen.getByTestId('recipe-star-rating');
      expect(starRating).toBeInTheDocument();
      expect(starRating.getAttribute('data-editable')).toBe('true');
    });

    unmount();
  });

  it('shows tags and ratings as NOT editable in view mode for owned recipes', async () => {
    const mockPersistentDialog = vi.fn(() => ({
      open: true,
      data: { recipeId: 'recipe-123' },
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
      removeDialogData: vi.fn()
    }));

    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [mockRecipe],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { usePersistentDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(mockPersistentDialog);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const tagsEditor = screen.getByTestId('recipe-tags-editor');
      expect(tagsEditor).toBeInTheDocument();
      expect(tagsEditor.getAttribute('data-editable')).toBe('false');
    });

    await waitFor(() => {
      const starRating = screen.getByTestId('recipe-star-rating');
      expect(starRating).toBeInTheDocument();
      expect(starRating.getAttribute('data-editable')).toBe('false');
    });

    unmount();
  });

  it('shows tags and ratings as editable in view mode for recipes not owned', async () => {
    const mockPersistentDialog = vi.fn(() => ({
      open: true,
      data: { recipeId: 'recipe-456' },
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
      removeDialogData: vi.fn()
    }));

    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [otherUserRecipe],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { usePersistentDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(mockPersistentDialog);

    const { fetchRecipe } = await import('../../../lib/recipe-utils');
    (fetchRecipe as any).mockResolvedValueOnce(otherUserRecipe);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const tagsEditor = screen.getByTestId('recipe-tags-editor');
      expect(tagsEditor).toBeInTheDocument();
      expect(tagsEditor.getAttribute('data-editable')).toBe('true');
    });

    await waitFor(() => {
      const starRating = screen.getByTestId('recipe-star-rating');
      expect(starRating).toBeInTheDocument();
      expect(starRating.getAttribute('data-editable')).toBe('true');
    });

    unmount();
  });

  it('calls updateRecipeTags when tags are changed in edit mode', async () => {
    const user = userEvent.setup();
    const mockPersistentDialog = vi.fn(() => ({
      open: true,
      data: { recipeId: 'recipe-123', editMode: 'true' },
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
      removeDialogData: vi.fn()
    }));

    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [mockRecipe],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { usePersistentDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(mockPersistentDialog);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const addTagButtons = screen.queryAllByText('Add Tag');
      expect(addTagButtons.length).toBeGreaterThan(0);
    });

    const addTagButtons = screen.getAllByText('Add Tag');
    await user.click(addTagButtons[0]);

    await waitFor(() => {
      expect(mockUpdateRecipeTags).toHaveBeenCalled();
    }, { timeout: 2000 });

    unmount();
  });

  it('calls updateRecipeRating when rating is changed in edit mode', async () => {
    const user = userEvent.setup();
    const mockPersistentDialog = vi.fn(() => ({
      open: true,
      data: { recipeId: 'recipe-123', editMode: 'true' },
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
      removeDialogData: vi.fn()
    }));

    const { useServerPagination } = await import('@/lib/hooks/use-server-pagination');
    (useServerPagination as any).mockReturnValue({
      data: [mockRecipe],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      loading: false,
      error: null,
      setPage: mockSetPage,
      setSort: mockSetSort,
      refetch: mockRefetch,
    });

    const { usePersistentDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(mockPersistentDialog);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const setRatingButtons = screen.queryAllByText('Set 5 Stars');
      expect(setRatingButtons.length).toBeGreaterThan(0);
    });

    const setRatingButtons = screen.getAllByText('Set 5 Stars');
    await user.click(setRatingButtons[0]);

    await waitFor(() => {
      expect(mockUpdateRecipeRating).toHaveBeenCalled();
    }, { timeout: 2000 });

    unmount();
  });

  it('auto-focuses Recipe Title field when create dialog opens', async () => {
    const { useDialog, usePersistentDialog, useConfirmDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(() => ({
      open: false, data: null, openDialog: vi.fn(), closeDialog: vi.fn(), removeDialogData: vi.fn()
    }));
    (useConfirmDialog as any).mockImplementation(() => ({
      open: false, openDialog: vi.fn(), closeDialog: vi.fn()
    }));
    let callCount = 0;
    (useDialog as any).mockImplementation(() => {
      const index = callCount % 3;
      callCount++;
      if (index === 0) return { open: true, openDialog: vi.fn(), closeDialog: vi.fn() };  // createDialog: open
      return { open: false, openDialog: vi.fn(), closeDialog: vi.fn() };
    });

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const titleInput = screen.getByLabelText(/recipe title/i);
      expect(titleInput).toHaveFocus();
    });

    unmount();
  });

  it('auto-focuses Email Address field when share recipes dialog opens', async () => {
    const { useDialog, usePersistentDialog, useConfirmDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(() => ({
      open: false, data: null, openDialog: vi.fn(), closeDialog: vi.fn(), removeDialogData: vi.fn()
    }));
    (useConfirmDialog as any).mockImplementation(() => ({
      open: false, openDialog: vi.fn(), closeDialog: vi.fn()
    }));
    let callCount = 0;
    (useDialog as any).mockImplementation(() => {
      const index = callCount % 3;
      callCount++;
      if (index === 2) return { open: true, openDialog: vi.fn(), closeDialog: vi.fn() };  // shareDialog: open
      return { open: false, openDialog: vi.fn(), closeDialog: vi.fn() };
    });

    mockFetchPendingRecipeSharingInvitations.mockResolvedValue([]);
    mockFetchSharedRecipeUsers.mockResolvedValue([]);
    mockFetchRecipeSharingOwners.mockResolvedValue([]);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveFocus();
    });

    unmount();
  });
});
