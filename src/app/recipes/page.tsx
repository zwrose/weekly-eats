'use client';

import { useSession } from 'next-auth/react';
import { Session } from 'next-auth';
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Paper,
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Chip,
  Snackbar,
  Badge,
} from '@mui/material';
import {
  Restaurant,
  Add,
  RestaurantMenu,
  Share,
  Star,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';
import { Recipe, CreateRecipeRequest, UpdateRecipeRequest } from '../../types/recipe';
import { fetchRecipe, createRecipe, updateRecipe, deleteRecipe } from '../../lib/recipe-utils';
import dynamic from 'next/dynamic';
const EmojiPicker = dynamic(() => import('../../components/EmojiPicker'), { ssr: false });
const RecipeViewDialog = dynamic(() => import('@/components/RecipeViewDialog'), { ssr: false });
const RecipeEditorDialog = dynamic(() => import('@/components/RecipeEditorDialog'), { ssr: false });
const RecipeSharingSection = dynamic(() => import('@/components/RecipeSharingSection'), {
  ssr: false,
});
import { RecipeIngredientList } from '../../types/recipe';
import { fetchFoodItems } from '../../lib/food-items-utils';
import { useDialog, useConfirmDialog, usePersistentDialog } from '@/lib/hooks';
import { useServerPagination } from '@/lib/hooks/use-server-pagination';
import { useDebouncedSearch } from '@/lib/hooks/use-debounced-search';
import RecipeFilterBar from '@/components/RecipeFilterBar';
import { responsiveDialogStyle } from '@/lib/theme';
import Pagination from '@/components/optimized/Pagination';
import { DialogActions, DialogTitle } from '@/components/ui';
import {
  inviteUserToRecipeSharing,
  respondToRecipeSharingInvitation,
  removeUserFromRecipeSharing,
  fetchPendingRecipeSharingInvitations,
  fetchSharedRecipeUsers,
  PendingRecipeInvitation,
  SharedUser,
} from '@/lib/recipe-sharing-utils';
import {
  fetchRecipeUserData,
  fetchRecipeUserDataBatch,
  updateRecipeTags,
  updateRecipeRating,
  deleteRecipeRating,
  fetchUserTags,
} from '@/lib/recipe-user-data-utils';

import { RecipeUserDataResponse } from '@/types/recipe-user-data';

// ── Extended recipe type with server-computed accessLevel ──

interface RecipeWithAccessLevel extends Recipe {
  accessLevel: 'private' | 'shared-by-you' | 'shared-by-others';
}

// ── Module-level sx constants (hoisted to avoid per-render allocations) ──

const tableRowHoverSx = {
  cursor: 'pointer',
  '&:hover': { backgroundColor: 'action.hover' },
} as const;

const recipeTitleFlexSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
} as const;

const recipeIconSmallSx = { fontSize: 24, color: 'text.secondary' } as const;
const recipeIconLargeSx = { fontSize: 32, color: 'text.secondary' } as const;

const tagContainerDesktopSx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 0.5,
  justifyContent: 'center',
} as const;

const tagContainerMobileSx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 0.5,
  mb: 1,
} as const;

const chipDesktopSx = { fontSize: '0.7rem', height: 20 } as const;
const chipMobileSx = { fontSize: '0.75rem' } as const;

const ratingDesktopSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.25,
} as const;

const ratingMobileSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
} as const;

const mobileCardSx = {
  p: 3,
  mb: 2,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: 'action.hover',
    transform: 'translateY(-2px)',
    boxShadow: 4,
  },
  transition: 'all 0.2s ease-in-out',
  boxShadow: 2,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
} as const;

const mobileCardTitleSx = {
  display: 'flex',
  alignItems: 'flex-start',
} as const;

const paginationContainerSx = {
  display: 'flex',
  justifyContent: 'center',
  mt: 2,
} as const;

const centeredLoadingSx = {
  display: 'flex',
  justifyContent: 'center',
  py: 4,
} as const;

const tableHeaderCellSx = (width: string) =>
  ({
    width,
    fontWeight: 'bold',
    wordWrap: 'break-word',
  }) as const;

function RecipesPageContent() {
  const { data: session, status } = useSession();

  // ── Filter state ──
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<number[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // ── Debounced search ──
  const { searchTerm, debouncedSearchTerm, setSearchTerm, clearSearch } = useDebouncedSearch();

  const hasActiveFilters =
    searchTerm !== '' || selectedTags.length > 0 || selectedRatings.length > 0;

  const handleClearFilters = useCallback(() => {
    clearSearch();
    setSelectedTags([]);
    setSelectedRatings([]);
  }, [clearSearch]);

  // ── Server pagination ──
  const filterKey = useMemo(
    () => JSON.stringify({ q: debouncedSearchTerm, t: selectedTags, r: selectedRatings }),
    [debouncedSearchTerm, selectedTags, selectedRatings]
  );

  const fetchRecipes = useCallback(
    async (params: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' }) => {
      const sp = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      });
      if (debouncedSearchTerm) sp.set('query', debouncedSearchTerm);
      if (selectedTags.length > 0) sp.set('tags', selectedTags.join(','));
      if (selectedRatings.length > 0) sp.set('ratings', selectedRatings.join(','));

      const response = await fetch(`/api/recipes?${sp.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch recipes');
      return response.json();
    },
    [debouncedSearchTerm, selectedTags, selectedRatings]
  );

  const {
    data: recipes,
    total,
    page,
    totalPages,
    loading,
    sortBy,
    sortOrder,
    setPage,
    setSort,
    refetch,
  } = useServerPagination<RecipeWithAccessLevel>({ fetchFn: fetchRecipes, filterKey });

  // ── Dialogs ──
  const createDialog = useDialog();
  const viewDialog = usePersistentDialog('viewRecipe');
  const deleteConfirmDialog = useConfirmDialog();
  const emojiPickerDialog = useDialog();
  const shareDialog = useDialog();

  // ── Selected recipe state ──
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<
    RecipeWithAccessLevel['accessLevel'] | undefined
  >(undefined);
  const [recipeUserData, setRecipeUserData] = useState<RecipeUserDataResponse | null>(null);
  const [recipesUserData, setRecipesUserData] = useState<Map<string, RecipeUserDataResponse>>(
    new Map()
  );

  // ── Sharing state ──
  const [pendingRecipeInvitations, setPendingRecipeInvitations] = useState<
    PendingRecipeInvitation[]
  >([]);
  const [sharedRecipeUsers, setSharedRecipeUsers] = useState<SharedUser[]>([]);
  const [shareEmail, setShareEmail] = useState('');
  const [shareTags, setShareTags] = useState(true);
  const [shareRatings, setShareRatings] = useState(true);

  // ── Snackbar ──
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const userId = session?.user?.id;

  // ── New/edit recipe state ──
  const [newRecipe, setNewRecipe] = useState<CreateRecipeRequest>({
    title: '',
    emoji: '',
    ingredients: [{ title: '', ingredients: [], isStandalone: true }],
    instructions: '',
    isGlobal: true,
  });
  const [editingRecipe, setEditingRecipe] = useState<UpdateRecipeRequest>({
    title: '',
    emoji: '',
    ingredients: [{ title: '', ingredients: [], isStandalone: true }],
    instructions: '',
    isGlobal: false,
  });
  const [editMode, setEditMode] = useState(false);

  // ── Food items state ──
  const [foodItems, setFoodItems] = useState<{
    [key: string]: { singularName: string; pluralName: string };
  }>({});
  const [foodItemsList, setFoodItemsList] = useState<
    Array<{
      _id: string;
      name: string;
      singularName: string;
      pluralName: string;
      unit: string;
    }>
  >([]);

  // ── Load supporting data ──
  const loadFoodItems = async () => {
    try {
      const items = await fetchFoodItems();
      const itemsMap: {
        [key: string]: { singularName: string; pluralName: string };
      } = {};
      items.forEach((item) => {
        itemsMap[item._id] = {
          singularName: item.singularName,
          pluralName: item.pluralName,
        };
      });
      setFoodItems(itemsMap);
      setFoodItemsList(items);
    } catch (error) {
      console.error('Error loading food items:', error);
    }
  };

  const loadSharingData = useCallback(async () => {
    try {
      const [pendingInvites, sharedUsers] = await Promise.all([
        fetchPendingRecipeSharingInvitations(),
        fetchSharedRecipeUsers(),
      ]);
      setPendingRecipeInvitations(pendingInvites);
      setSharedRecipeUsers(sharedUsers);
    } catch (error) {
      console.error('Error loading sharing data:', error);
    }
  }, []);

  const loadAvailableTags = useCallback(async () => {
    try {
      const tags = await fetchUserTags();
      setAvailableTags(tags);
    } catch (error) {
      console.error('Error loading user tags:', error);
    }
  }, []);

  // ── Load user data for current page of recipes ──
  const loadRecipesUserData = useCallback(async () => {
    if (!userId || recipes.length === 0) return;
    try {
      const recipeIds = recipes.map((recipe) => recipe._id).filter((id): id is string => !!id);
      const userDataMap = await fetchRecipeUserDataBatch(recipeIds);
      setRecipesUserData(userDataMap);
    } catch (error) {
      console.error('Error loading recipes user data:', error);
    }
  }, [recipes, userId]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadRecipesUserData();
    }
  }, [status, loadRecipesUserData]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadFoodItems();
      loadSharingData();
      loadAvailableTags();
    }
  }, [status, loadSharingData, loadAvailableTags]);

  // ── Food item added handler ──
  const handleFoodItemAdded = async (newFoodItem: {
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
  }) => {
    const foodItemWithId = {
      _id: `temp-${Date.now()}`,
      ...newFoodItem,
    };
    setFoodItems((prev) => ({
      ...prev,
      [foodItemWithId._id]: {
        singularName: newFoodItem.singularName,
        pluralName: newFoodItem.pluralName,
      },
    }));
    setFoodItemsList((prev) => [...prev, foodItemWithId]);
  };

  // ── Ingredient name helper ──
  const getIngredientName = (ingredient: {
    type: 'foodItem' | 'recipe';
    id: string;
    quantity: number;
    name?: string;
  }): string => {
    // Prefer server-resolved name (populated by GET /api/recipes/[id])
    if (ingredient.name) return ingredient.name;

    // Fallback to client-side lookup for draft/unsaved recipes
    if (ingredient.type === 'foodItem') {
      const foodItem = foodItems[ingredient.id];
      if (!foodItem) return 'Unknown food item';
      return ingredient.quantity === 1 ? foodItem.singularName : foodItem.pluralName;
    } else {
      const recipe = recipes.find((r) => r._id === ingredient.id);
      return recipe ? recipe.title : 'Unknown recipe';
    }
  };

  // ── CRUD handlers ──
  const handleCreateRecipe = async () => {
    try {
      const filteredRecipe = {
        ...newRecipe,
        ingredients: filterBlankIngredients(newRecipe.ingredients),
      };
      await createRecipe(filteredRecipe);
      createDialog.closeDialog();
      setNewRecipe({
        title: '',
        emoji: '',
        ingredients: [{ title: '', ingredients: [], isStandalone: true }],
        instructions: '',
        isGlobal: true,
      });
      refetch();
    } catch (error) {
      console.error('Error creating recipe:', error);
    }
  };

  const handleViewRecipe = useCallback(
    async (recipe: Recipe) => {
      try {
        const fullRecipe = await fetchRecipe(recipe._id!);
        setSelectedRecipe(fullRecipe);
        if ('accessLevel' in recipe) {
          setSelectedAccessLevel((recipe as RecipeWithAccessLevel).accessLevel);
        }
        viewDialog.openDialog({ recipeId: recipe._id! });
        try {
          const userData = await fetchRecipeUserData(recipe._id!);
          setRecipeUserData(userData);
        } catch (error) {
          console.error('Error loading recipe user data:', error);
          setRecipeUserData({ tags: [], rating: undefined });
        }
      } catch (error) {
        console.error('Error loading recipe details:', error);
      }
    },
    [viewDialog]
  );

  // Handle persistent dialog data
  useEffect(() => {
    if (viewDialog.open && viewDialog.data?.recipeId && !selectedRecipe) {
      const recipe = recipes.find((r) => r._id === viewDialog.data?.recipeId);
      if (recipe) {
        handleViewRecipe(recipe);
      }
    }

    if (viewDialog.open && viewDialog.data?.editMode === 'true' && selectedRecipe && !editMode) {
      setEditMode(true);
      setEditingRecipe({
        title: selectedRecipe.title,
        emoji: selectedRecipe.emoji || '',
        ingredients: selectedRecipe.ingredients,
        instructions: selectedRecipe.instructions,
        isGlobal: selectedRecipe.isGlobal,
      });
    }
  }, [viewDialog.open, viewDialog.data, selectedRecipe, recipes, editMode, handleViewRecipe]);

  const handleEditRecipe = async () => {
    if (!selectedRecipe?._id) return;

    setEditingRecipe({
      title: selectedRecipe.title,
      emoji: selectedRecipe.emoji || '',
      ingredients: selectedRecipe.ingredients,
      instructions: selectedRecipe.instructions,
      isGlobal: selectedRecipe.isGlobal,
    });
    setEditMode(true);
    viewDialog.openDialog({
      recipeId: selectedRecipe._id!,
      editMode: 'true',
    });

    try {
      const userData = await fetchRecipeUserData(selectedRecipe._id);
      setRecipeUserData(userData);
    } catch (error) {
      console.error('Error loading recipe user data:', error);
      setRecipeUserData({ tags: [], rating: undefined });
    }
  };

  const handleUpdateRecipe = async () => {
    if (!selectedRecipe?._id) return;

    try {
      const filteredRecipe = {
        ...editingRecipe,
        ingredients: filterBlankIngredients(editingRecipe.ingredients || []),
      };
      await updateRecipe(selectedRecipe._id, filteredRecipe);
      const updatedRecipe = await fetchRecipe(selectedRecipe._id);
      setSelectedRecipe(updatedRecipe);
      refetch();
      setEditMode(false);
      viewDialog.openDialog({ recipeId: selectedRecipe._id });
    } catch (error) {
      console.error('Error updating recipe:', error);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipe?._id) return;

    try {
      await deleteRecipe(selectedRecipe._id);
      deleteConfirmDialog.closeDialog();
      viewDialog.closeDialog();
      setSelectedRecipe(null);
      setEditMode(false);
      refetch();
    } catch (error) {
      console.error('Error deleting recipe:', error);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    if (editMode) {
      setEditingRecipe({ ...editingRecipe, emoji });
    } else {
      setNewRecipe({ ...newRecipe, emoji });
    }
  };

  const filterBlankIngredients = (ingredients: RecipeIngredientList[]) => {
    return ingredients.map((list) => ({
      ...list,
      ingredients: list.ingredients.filter(
        (ingredient) => ingredient.id && ingredient.id.trim() !== ''
      ),
    }));
  };

  const handleIngredientsChange = (ingredients: RecipeIngredientList[]) => {
    if (editMode) {
      setEditingRecipe({ ...editingRecipe, ingredients });
    } else {
      setNewRecipe({ ...newRecipe, ingredients });
    }
  };

  // ── Sharing handlers ──
  const handleInviteUser = async () => {
    if (!shareEmail.trim()) return;
    if (!shareTags && !shareRatings) {
      showSnackbar('Please select at least one sharing type (tags or ratings)', 'error');
      return;
    }

    try {
      const sharingTypes: ('tags' | 'ratings')[] = [];
      if (shareTags) sharingTypes.push('tags');
      if (shareRatings) sharingTypes.push('ratings');

      await inviteUserToRecipeSharing(shareEmail.trim(), sharingTypes);
      setShareEmail('');
      showSnackbar(`Invitation sent to ${shareEmail}`, 'success');
      loadSharingData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to invite user';
      showSnackbar(message, 'error');
    }
  };

  const handleAcceptRecipeInvitation = async (userId: string) => {
    try {
      await respondToRecipeSharingInvitation(userId, 'accept');
      showSnackbar('Invitation accepted', 'success');
      loadSharingData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to accept invitation';
      showSnackbar(message, 'error');
    }
  };

  const handleRejectRecipeInvitation = async (userId: string) => {
    try {
      await respondToRecipeSharingInvitation(userId, 'reject');
      showSnackbar('Invitation rejected', 'success');
      loadSharingData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject invitation';
      showSnackbar(message, 'error');
    }
  };

  const handleRemoveRecipeUser = async (userId: string) => {
    try {
      await removeUserFromRecipeSharing(userId);
      showSnackbar('User removed from sharing', 'success');
      loadSharingData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove user';
      showSnackbar(message, 'error');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // ── Recipe user data handlers ──
  const handleTagsChange = async (tags: string[]) => {
    if (!selectedRecipe?._id) return;
    try {
      await updateRecipeTags(selectedRecipe._id, tags);
      setRecipeUserData((prev) => (prev ? { ...prev, tags } : { tags, rating: undefined }));
      setRecipesUserData((prev) => {
        const newMap = new Map(prev);
        const currentData = newMap.get(selectedRecipe._id!) || { tags: [], rating: undefined };
        newMap.set(selectedRecipe._id!, { ...currentData, tags });
        return newMap;
      });
    } catch (error) {
      console.error('Error updating tags:', error);
      showSnackbar('Failed to update tags', 'error');
    }
  };

  const handleRatingChange = async (rating: number | undefined) => {
    if (!selectedRecipe?._id) return;
    try {
      if (rating === undefined) {
        await deleteRecipeRating(selectedRecipe._id);
        setRecipeUserData((prev) =>
          prev ? { ...prev, rating: undefined } : { tags: [], rating: undefined }
        );
        setRecipesUserData((prev) => {
          const newMap = new Map(prev);
          const currentData = newMap.get(selectedRecipe._id!) || { tags: [], rating: undefined };
          newMap.set(selectedRecipe._id!, { ...currentData, rating: undefined });
          return newMap;
        });
      } else {
        await updateRecipeRating(selectedRecipe._id, rating);
        setRecipeUserData((prev) => (prev ? { ...prev, rating } : { tags: [], rating }));
        setRecipesUserData((prev) => {
          const newMap = new Map(prev);
          const currentData = newMap.get(selectedRecipe._id!) || { tags: [], rating: undefined };
          newMap.set(selectedRecipe._id!, { ...currentData, rating });
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error updating rating:', error);
      showSnackbar('Failed to update rating', 'error');
    }
  };

  const handleCloseViewDialog = () => {
    viewDialog.closeDialog();
    setSelectedRecipe(null);
    setSelectedAccessLevel(undefined);
    setEditMode(false);
  };

  const hasValidIngredients = (ingredients: RecipeIngredientList[]) => {
    const totalIngredients = ingredients.reduce(
      (total, group) => total + (group.ingredients?.length || 0),
      0
    );
    if (totalIngredients === 0) return false;
    return ingredients.every(
      (group) => group.isStandalone || (group.title && group.title.trim() !== '')
    );
  };

  const canEditRecipe = (recipe: Recipe) => {
    return recipe.createdBy === (session?.user as Session['user'])?.id;
  };

  // ── Sort handlers ──
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSort(newSortBy, newSortOrder);
  };

  const handleColumnSort = (column: string) => {
    if (sortBy === column) {
      setSort(column, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column, column === 'title' ? 'asc' : 'desc');
    }
  };

  // ── Render ──
  if (status === 'loading') {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="xl">
          <Box sx={centeredLoadingSx}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: { xs: 0.5, md: 1 } }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: { xs: 2, sm: 0 },
              mb: { xs: 2, md: 4 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Restaurant sx={{ fontSize: 40, color: '#ed6c02' }} />
              <Typography variant="h3" component="h1" sx={{ color: '#ed6c02' }}>
                Recipes
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => createDialog.openDialog()}
                sx={{
                  bgcolor: '#ed6c02',
                  '&:hover': { bgcolor: '#e65100' },
                  flexGrow: 1,
                }}
              >
                Add New Recipe
              </Button>
              <Button
                variant="outlined"
                onClick={() => shareDialog.openDialog()}
                sx={{
                  borderColor: '#ed6c02',
                  color: '#ed6c02',
                  '&:hover': { borderColor: '#e65100' },
                  minWidth: 'auto',
                  p: 1,
                }}
              >
                <Badge badgeContent={pendingRecipeInvitations?.length || 0} color="error">
                  <Share />
                </Badge>
              </Button>
            </Box>
          </Box>

          <RecipeSharingSection
            pendingInvitations={pendingRecipeInvitations}
            onAcceptInvitation={handleAcceptRecipeInvitation}
            onRejectInvitation={handleRejectRecipeInvitation}
            shareDialogOpen={shareDialog.open}
            onShareDialogClose={shareDialog.closeDialog}
            shareEmail={shareEmail}
            onShareEmailChange={setShareEmail}
            shareTags={shareTags}
            onShareTagsChange={setShareTags}
            shareRatings={shareRatings}
            onShareRatingsChange={setShareRatings}
            onInviteUser={handleInviteUser}
            sharedUsers={sharedRecipeUsers}
            onRemoveUser={handleRemoveRecipeUser}
          />

          <Paper sx={{ p: 3, mb: 4 }}>
            <RecipeFilterBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              availableTags={availableTags}
              selectedRatings={selectedRatings}
              onRatingsChange={setSelectedRatings}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearFilters}
            />

            {loading ? (
              <Box sx={centeredLoadingSx}>
                <CircularProgress />
              </Box>
            ) : recipes.length > 0 ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {total} recipe{total !== 1 ? 's' : ''} found
                </Typography>

                {/* Desktop Table View */}
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell
                            sx={{
                              ...tableHeaderCellSx('45%'),
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                            onClick={() => handleColumnSort('title')}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              Recipe
                              {sortBy === 'title' &&
                                (sortOrder === 'asc' ? (
                                  <ArrowUpward sx={{ fontSize: 16 }} />
                                ) : (
                                  <ArrowDownward sx={{ fontSize: 16 }} />
                                ))}
                            </Box>
                          </TableCell>
                          <TableCell align="center" sx={tableHeaderCellSx('15%')}>
                            Tags
                          </TableCell>
                          <TableCell
                            align="center"
                            sx={{
                              ...tableHeaderCellSx('15%'),
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                            onClick={() => handleColumnSort('rating')}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.5,
                              }}
                            >
                              Rating
                              {sortBy === 'rating' &&
                                (sortOrder === 'asc' ? (
                                  <ArrowUpward sx={{ fontSize: 16 }} />
                                ) : (
                                  <ArrowDownward sx={{ fontSize: 16 }} />
                                ))}
                            </Box>
                          </TableCell>
                          <TableCell
                            align="center"
                            sx={{
                              ...tableHeaderCellSx('25%'),
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                            onClick={() => handleColumnSort('updatedAt')}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.5,
                              }}
                            >
                              Updated
                              {sortBy === 'updatedAt' &&
                                (sortOrder === 'asc' ? (
                                  <ArrowUpward sx={{ fontSize: 16 }} />
                                ) : (
                                  <ArrowDownward sx={{ fontSize: 16 }} />
                                ))}
                            </Box>
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {recipes.map((recipe) => {
                          const userData = recipesUserData.get(recipe._id || '');
                          const allTags = [
                            ...new Set([
                              ...(userData?.tags || []),
                              ...(userData?.sharedTags || []),
                            ]),
                          ];
                          const rating = userData?.rating;

                          return (
                            <TableRow
                              key={recipe._id}
                              onClick={() => handleViewRecipe(recipe)}
                              sx={tableRowHoverSx}
                            >
                              <TableCell sx={{ wordWrap: 'break-word' }}>
                                <Box sx={recipeTitleFlexSx}>
                                  {recipe.emoji ? (
                                    <Typography variant="h6">{recipe.emoji}</Typography>
                                  ) : (
                                    <RestaurantMenu sx={recipeIconSmallSx} />
                                  )}
                                  <Typography variant="body1">{recipe.title}</Typography>
                                </Box>
                              </TableCell>
                              <TableCell align="center" sx={{ wordWrap: 'break-word' }}>
                                {allTags.length === 0 ? (
                                  <Typography variant="body2" color="text.secondary">
                                    —
                                  </Typography>
                                ) : (
                                  <Box sx={tagContainerDesktopSx}>
                                    {allTags.slice(0, 3).map((tag) => (
                                      <Chip key={tag} label={tag} size="small" sx={chipDesktopSx} />
                                    ))}
                                    {allTags.length > 3 && (
                                      <Chip
                                        label={`+${allTags.length - 3}`}
                                        size="small"
                                        sx={chipDesktopSx}
                                      />
                                    )}
                                  </Box>
                                )}
                              </TableCell>
                              <TableCell align="center" sx={{ wordWrap: 'break-word' }}>
                                {!rating ? (
                                  <Typography variant="body2" color="text.secondary">
                                    —
                                  </Typography>
                                ) : (
                                  <Box sx={ratingDesktopSx}>
                                    <Star sx={{ fontSize: 16, color: 'warning.main' }} />
                                    <Typography variant="body2">{rating}</Typography>
                                  </Box>
                                )}
                              </TableCell>
                              <TableCell align="center" sx={{ wordWrap: 'break-word' }}>
                                {new Date(recipe.updatedAt).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                {/* Mobile Card View */}
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                  {recipes.map((recipe) => {
                    const userData = recipesUserData.get(recipe._id || '');
                    const allTags = [
                      ...new Set([...(userData?.tags || []), ...(userData?.sharedTags || [])]),
                    ];
                    const rating = userData?.rating;

                    return (
                      <Paper
                        key={recipe._id}
                        onClick={() => handleViewRecipe(recipe)}
                        sx={mobileCardSx}
                      >
                        <Box sx={mobileCardTitleSx}>
                          <Box sx={{ mr: 1.5, flexShrink: 0 }}>
                            {recipe.emoji ? (
                              <Typography variant="h4">{recipe.emoji}</Typography>
                            ) : (
                              <RestaurantMenu sx={recipeIconLargeSx} />
                            )}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                              {recipe.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {new Date(recipe.updatedAt).toLocaleDateString()}
                            </Typography>
                          </Box>
                        </Box>
                        {(allTags.length > 0 || rating) && (
                          <Box sx={{ mt: 1, width: '100%' }}>
                            {allTags.length > 0 && (
                              <Box sx={tagContainerMobileSx}>
                                {allTags.slice(0, 5).map((tag) => (
                                  <Chip key={tag} label={tag} size="small" sx={chipMobileSx} />
                                ))}
                                {allTags.length > 5 && (
                                  <Chip
                                    label={`+${allTags.length - 5}`}
                                    size="small"
                                    sx={chipMobileSx}
                                  />
                                )}
                              </Box>
                            )}
                            {rating && (
                              <Box sx={ratingMobileSx}>
                                <Star sx={{ fontSize: 18, color: 'warning.main' }} />
                                <Typography variant="body2">{rating}/5</Typography>
                              </Box>
                            )}
                          </Box>
                        )}
                      </Paper>
                    );
                  })}
                </Box>

                {totalPages > 1 && (
                  <Box sx={paginationContainerSx}>
                    <Pagination count={totalPages} page={page} onChange={setPage} />
                  </Box>
                )}
              </>
            ) : (
              <Alert severity="info">
                {debouncedSearchTerm || selectedTags.length > 0 || selectedRatings.length > 0
                  ? 'No recipes match your filters'
                  : 'No recipes found'}
              </Alert>
            )}
          </Paper>
        </Box>

        {/* Create Recipe Dialog */}
        <RecipeEditorDialog
          open={createDialog.open}
          onClose={() => createDialog.closeDialog()}
          recipe={newRecipe}
          onRecipeChange={setNewRecipe}
          onSubmit={handleCreateRecipe}
          onEmojiPickerOpen={() => emojiPickerDialog.openDialog()}
          onIngredientsChange={(ingredients) => setNewRecipe({ ...newRecipe, ingredients })}
          foodItemsList={foodItemsList}
          onFoodItemAdded={handleFoodItemAdded}
          hasValidIngredients={hasValidIngredients}
        />

        {/* View/Edit Recipe Dialog */}
        <RecipeViewDialog
          open={viewDialog.open}
          onClose={handleCloseViewDialog}
          selectedRecipe={selectedRecipe}
          editMode={editMode}
          editingRecipe={editingRecipe}
          onEditingRecipeChange={setEditingRecipe}
          canEditRecipe={canEditRecipe}
          onEditRecipe={handleEditRecipe}
          onUpdateRecipe={handleUpdateRecipe}
          onDeleteConfirm={() => deleteConfirmDialog.openDialog()}
          onCancelEdit={() => {
            setEditMode(false);
            viewDialog.removeDialogData('editMode');
          }}
          onEmojiPickerOpen={() => emojiPickerDialog.openDialog()}
          recipeUserData={recipeUserData}
          onTagsChange={handleTagsChange}
          onRatingChange={handleRatingChange}
          onIngredientsChange={handleIngredientsChange}
          foodItemsList={foodItemsList}
          onFoodItemAdded={handleFoodItemAdded}
          hasValidIngredients={hasValidIngredients}
          getIngredientName={getIngredientName}
          accessLevel={selectedAccessLevel}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmDialog.open}
          onClose={() => deleteConfirmDialog.closeDialog()}
          sx={responsiveDialogStyle}
        >
          <DialogTitle onClose={() => deleteConfirmDialog.closeDialog()}>Delete Recipe</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete &quot;{selectedRecipe?.title}
              &quot;? This action cannot be undone.
            </DialogContentText>

            <DialogActions primaryButtonIndex={1}>
              <Button onClick={() => deleteConfirmDialog.closeDialog()}>Cancel</Button>
              <Button onClick={handleDeleteRecipe} color="error" variant="contained">
                Delete
              </Button>
            </DialogActions>
          </DialogContent>
        </Dialog>

        {/* Emoji Picker */}
        <EmojiPicker
          open={emojiPickerDialog.open}
          onClose={() => emojiPickerDialog.closeDialog()}
          onSelect={handleEmojiSelect}
          currentEmoji={selectedRecipe?.emoji || newRecipe.emoji}
        />

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </AuthenticatedLayout>
  );
}

export default function RecipesPage() {
  return (
    <Suspense
      fallback={
        <AuthenticatedLayout>
          <Container maxWidth="xl">
            <Box sx={centeredLoadingSx}>
              <CircularProgress />
            </Box>
          </Container>
        </AuthenticatedLayout>
      }
    >
      <RecipesPageContent />
    </Suspense>
  );
}
