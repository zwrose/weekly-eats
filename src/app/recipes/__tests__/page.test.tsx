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

// Mock the recipe utilities and hooks
const mockDeleteRecipe = vi.fn();
const mockUpdateRecipe = vi.fn();
const mockCreateRecipe = vi.fn();

vi.mock('@/lib/hooks', () => ({
  useRecipes: vi.fn(() => ({
    userRecipes: [],
    globalRecipes: [],
    loading: false,
    userLoading: false,
    globalLoading: false,
    createRecipe: mockCreateRecipe,
    updateRecipe: mockUpdateRecipe,
    deleteRecipe: mockDeleteRecipe
  })),
  useSearchPagination: vi.fn(() => ({
    searchTerm: '',
    setSearchTerm: vi.fn(),
    currentPage: 1,
    setCurrentPage: vi.fn(),
    totalPages: 1,
    paginatedData: [],
    totalItems: 0
  })),
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
  }))
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

// Import after mocks
import RecipesPage from '../page';

describe('RecipesPage - Delete Functionality', () => {
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
    updatedAt: new Date('2024-01-01')
  };

  beforeEach(() => {
    vi.clearAllMocks();
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

    const mockRecipesHook = vi.fn(() => ({
      userRecipes: [mockRecipe],
      globalRecipes: [],
      loading: false,
      userLoading: false,
      globalLoading: false,
      createRecipe: mockCreateRecipe,
      updateRecipe: mockUpdateRecipe,
      deleteRecipe: mockDeleteRecipe
    }));

    const { useRecipes, usePersistentDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(mockPersistentDialog);
    (useRecipes as any).mockImplementation(mockRecipesHook);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    unmount();
  });

  it('opens confirmation dialog when delete button is clicked', async () => {
    const user = userEvent.setup();
    const mockCloseDialog = vi.fn();
    const mockOpenConfirmDialog = vi.fn();
    
    const mockPersistentDialog = vi.fn(() => ({
      open: true,
      data: { recipeId: 'recipe-123', editMode: 'true' },
      openDialog: vi.fn(),
      closeDialog: mockCloseDialog,
      removeDialogData: vi.fn()
    }));

    const mockConfirmDialog = vi.fn(() => ({
      open: false,
      openDialog: mockOpenConfirmDialog,
      closeDialog: vi.fn()
    }));

    const mockRecipesHook = vi.fn(() => ({
      userRecipes: [mockRecipe],
      globalRecipes: [],
      loading: false,
      userLoading: false,
      globalLoading: false,
      createRecipe: mockCreateRecipe,
      updateRecipe: mockUpdateRecipe,
      deleteRecipe: mockDeleteRecipe
    }));

    const { useRecipes, useConfirmDialog, usePersistentDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(mockPersistentDialog);
    (useConfirmDialog as any).mockImplementation(mockConfirmDialog);
    (useRecipes as any).mockImplementation(mockRecipesHook);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    // Click the first delete button (the one in the edit dialog)
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

    const mockRecipesHook = vi.fn(() => ({
      userRecipes: [mockRecipe],
      globalRecipes: [],
      loading: false,
      userLoading: false,
      globalLoading: false,
      createRecipe: mockCreateRecipe,
      updateRecipe: mockUpdateRecipe,
      deleteRecipe: mockDeleteRecipe
    }));

    const { useRecipes, useConfirmDialog, usePersistentDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(mockPersistentDialog);
    (useConfirmDialog as any).mockImplementation(mockConfirmDialog);
    (useRecipes as any).mockImplementation(mockRecipesHook);

    mockDeleteRecipe.mockResolvedValue(undefined);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const deleteTexts = screen.queryAllByText(/are you sure you want to delete/i);
      expect(deleteTexts.length).toBeGreaterThan(0);
    });

    // Get all delete buttons and find the one in the confirmation dialog (should be the last one)
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

  it('delete button styled as error button in edit mode', async () => {
    const mockPersistentDialog = vi.fn(() => ({
      open: true,
      data: { recipeId: 'recipe-123', editMode: 'true' },
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
      removeDialogData: vi.fn()
    }));

    const mockRecipesHook = vi.fn(() => ({
      userRecipes: [mockRecipe],
      globalRecipes: [],
      loading: false,
      userLoading: false,
      globalLoading: false,
      createRecipe: mockCreateRecipe,
      updateRecipe: mockUpdateRecipe,
      deleteRecipe: mockDeleteRecipe
    }));

    const { useRecipes, usePersistentDialog } = await import('@/lib/hooks');
    (usePersistentDialog as any).mockImplementation(mockPersistentDialog);
    (useRecipes as any).mockImplementation(mockRecipesHook);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
      // Check the first delete button (the one in the edit dialog) has error styling
      expect(deleteButtons[0]?.className).toMatch(/MuiButton.*Error/);
    });

    unmount();
  });

  it('does not show edit button for recipes created by other users in view mode', async () => {
    const otherUserRecipe = {
      ...mockRecipe,
      _id: 'recipe-456',
      createdBy: 'other-user-456'
    };

    const mockRecipesHook = vi.fn(() => ({
      userRecipes: [mockRecipe],
      globalRecipes: [otherUserRecipe],
      loading: false,
      userLoading: false,
      globalLoading: false,
      createRecipe: mockCreateRecipe,
      updateRecipe: mockUpdateRecipe,
      deleteRecipe: mockDeleteRecipe
    }));

    const mockPersistentDialog = vi.fn(() => ({
      open: true,
      data: { recipeId: 'recipe-456' },
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
      removeDialogData: vi.fn()
    }));

    const { useRecipes, usePersistentDialog } = await import('@/lib/hooks');
    (useRecipes as any).mockImplementation(mockRecipesHook);
    (usePersistentDialog as any).mockImplementation(mockPersistentDialog);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      // Edit icon should not appear for recipes by other users
      expect(screen.queryByTestId('EditIcon')).not.toBeInTheDocument();
    });

    unmount();
  });
});

