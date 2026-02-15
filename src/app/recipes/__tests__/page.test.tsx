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

// Mock recipe user data utilities
const mockFetchRecipeUserData = vi.fn();
const mockUpdateRecipeTags = vi.fn();
const mockUpdateRecipeRating = vi.fn();
const mockDeleteRecipeRating = vi.fn();

vi.mock('../../../lib/recipe-user-data-utils', () => ({
  fetchRecipeUserData: () => mockFetchRecipeUserData(),
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
    // Ensure tags is an array
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
    // Ensure sharedRatings is an array
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

describe('RecipesPage - Tags and Ratings', () => {
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

  const otherUserRecipe = {
    ...mockRecipe,
    _id: 'recipe-456',
    createdBy: 'other-user-456'
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

    const mockRecipesHook = vi.fn(() => ({
      userRecipes: [],
      globalRecipes: [otherUserRecipe],
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
      const addTagButtons = screen.queryAllByText('Add Tag');
      expect(addTagButtons.length).toBeGreaterThan(0);
    });

    const addTagButtons = screen.getAllByText('Add Tag');
    await user.click(addTagButtons[0]);

    await waitFor(() => {
      // The onChange handler should be called, which triggers updateRecipeTags
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
      const setRatingButtons = screen.queryAllByText('Set 5 Stars');
      expect(setRatingButtons.length).toBeGreaterThan(0);
    });

    const setRatingButtons = screen.getAllByText('Set 5 Stars');
    await user.click(setRatingButtons[0]);

    await waitFor(() => {
      // The onChange handler should be called, which triggers updateRecipeRating
      expect(mockUpdateRecipeRating).toHaveBeenCalled();
    }, { timeout: 2000 });

    unmount();
  });

  it('auto-focuses Recipe Title field when create dialog opens', async () => {
    const { useDialog, usePersistentDialog, useConfirmDialog } = await import('@/lib/hooks');
    // Reset all hook implementations to ensure clean state
    (usePersistentDialog as any).mockImplementation(() => ({
      open: false, data: null, openDialog: vi.fn(), closeDialog: vi.fn(), removeDialogData: vi.fn()
    }));
    (useConfirmDialog as any).mockImplementation(() => ({
      open: false, openDialog: vi.fn(), closeDialog: vi.fn()
    }));
    // useDialog is called 3 times: createDialog, emojiPickerDialog, shareDialog
    (useDialog as any)
      .mockImplementationOnce(() => ({ open: true, openDialog: vi.fn(), closeDialog: vi.fn() }))   // createDialog: open
      .mockImplementationOnce(() => ({ open: false, openDialog: vi.fn(), closeDialog: vi.fn() }))  // emojiPickerDialog: closed
      .mockImplementationOnce(() => ({ open: false, openDialog: vi.fn(), closeDialog: vi.fn() })); // shareDialog: closed

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const titleInput = screen.getByLabelText(/recipe title/i);
      expect(titleInput).toHaveFocus();
    });

    unmount();
  });

  it('auto-focuses Email Address field when share recipes dialog opens', async () => {
    const { useDialog, usePersistentDialog, useConfirmDialog } = await import('@/lib/hooks');
    // Reset all hook implementations to ensure clean state
    (usePersistentDialog as any).mockImplementation(() => ({
      open: false, data: null, openDialog: vi.fn(), closeDialog: vi.fn(), removeDialogData: vi.fn()
    }));
    (useConfirmDialog as any).mockImplementation(() => ({
      open: false, openDialog: vi.fn(), closeDialog: vi.fn()
    }));
    // useDialog is called 3 times: createDialog, emojiPickerDialog, shareDialog
    (useDialog as any)
      .mockImplementationOnce(() => ({ open: false, openDialog: vi.fn(), closeDialog: vi.fn() }))  // createDialog: closed
      .mockImplementationOnce(() => ({ open: false, openDialog: vi.fn(), closeDialog: vi.fn() }))  // emojiPickerDialog: closed
      .mockImplementationOnce(() => ({ open: true, openDialog: vi.fn(), closeDialog: vi.fn() }));  // shareDialog: open

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

  it('auto-focuses Recipe Title field when edit mode is toggled on', async () => {
    const { useDialog, usePersistentDialog, useConfirmDialog, useRecipes } = await import('@/lib/hooks');
    // Reset all hook implementations to ensure clean state
    (useDialog as any).mockImplementation(() => ({
      open: false, openDialog: vi.fn(), closeDialog: vi.fn()
    }));
    (useConfirmDialog as any).mockImplementation(() => ({
      open: false, openDialog: vi.fn(), closeDialog: vi.fn()
    }));
    // Open the view dialog in edit mode
    (usePersistentDialog as any).mockImplementation(() => ({
      open: true, data: { recipeId: 'recipe-123', editMode: 'true' },
      openDialog: vi.fn(), closeDialog: vi.fn(), removeDialogData: vi.fn()
    }));
    (useRecipes as any).mockImplementation(() => ({
      userRecipes: [mockRecipe], globalRecipes: [], loading: false,
      userLoading: false, globalLoading: false,
      createRecipe: mockCreateRecipe, updateRecipe: mockUpdateRecipe, deleteRecipe: mockDeleteRecipe
    }));

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      // The edit mode Recipe Title field should have focus
      const titleInputs = screen.getAllByLabelText(/recipe title/i);
      const editTitleInput = titleInputs.find(input => (input as HTMLInputElement).value === 'Test Recipe');
      expect(editTitleInput).toHaveFocus();
    });

    unmount();
  });

  it('calls updateRecipeTags when tags are changed in view mode for non-owned recipes', async () => {
    const user = userEvent.setup();
    const mockPersistentDialog = vi.fn(() => ({
      open: true,
      data: { recipeId: 'recipe-456' },
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
      removeDialogData: vi.fn()
    }));

    const mockRecipesHook = vi.fn(() => ({
      userRecipes: [],
      globalRecipes: [otherUserRecipe],
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

    const { fetchRecipe } = await import('../../../lib/recipe-utils');
    (fetchRecipe as any).mockResolvedValueOnce(otherUserRecipe);

    const { unmount } = render(<RecipesPage />);

    await waitFor(() => {
      const addTagButtons = screen.queryAllByText('Add Tag');
      expect(addTagButtons.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const addTagButtons = screen.getAllByText('Add Tag');
    await user.click(addTagButtons[0]);

    await waitFor(() => {
      // The onChange handler should be called, which triggers updateRecipeTags
      // Note: The component calls updateRecipeTags with the recipe ID from selectedRecipe
      // We verify that the mock was called, even if the exact arguments depend on the component state
      expect(mockUpdateRecipeTags).toHaveBeenCalled();
    }, { timeout: 2000 });

    unmount();
  });
});

