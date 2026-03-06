'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  IconButton,
  Button,
  Alert,
  Chip,
  Snackbar,
  Badge,
} from '@mui/material';
import { Restaurant, Add, RestaurantMenu, Share, Star } from '@mui/icons-material';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';
import { Recipe } from '../../types/recipe';
import dynamic from 'next/dynamic';
const RecipeSharingSection = dynamic(() => import('@/components/RecipeSharingSection'), {
  ssr: false,
});
import { useDialog } from '@/lib/hooks';
import { useServerPagination } from '@/lib/hooks/use-server-pagination';
import { useDebouncedSearch } from '@/lib/hooks/use-debounced-search';
import RecipeFilterBar from '@/components/RecipeFilterBar';
import Pagination from '@/components/optimized/Pagination';
import { ListRow, StaggeredList } from '@/components/ui';
import {
  inviteUserToRecipeSharing,
  respondToRecipeSharingInvitation,
  removeUserFromRecipeSharing,
  fetchPendingRecipeSharingInvitations,
  fetchSharedRecipeUsers,
  PendingRecipeInvitation,
  SharedUser,
} from '@/lib/recipe-sharing-utils';
import { fetchRecipeUserDataBatch, fetchUserTags } from '@/lib/recipe-user-data-utils';

import { RecipeUserDataResponse } from '@/types/recipe-user-data';

// ── Extended recipe type with server-computed accessLevel ──

interface RecipeWithAccessLevel extends Recipe {
  accessLevel: 'private' | 'shared-by-you' | 'shared-by-others';
}

// ── Module-level sx constants ──

const tinyChipSx = {
  fontSize: '0.6875rem',
  height: 18,
  '& .MuiChip-label': { px: 0.75 },
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

function RecipesPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

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
    [debouncedSearchTerm, selectedTags, selectedRatings],
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
    [debouncedSearchTerm, selectedTags, selectedRatings],
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
  } = useServerPagination<RecipeWithAccessLevel>({ fetchFn: fetchRecipes, filterKey });

  // ── Dialogs ──
  const shareDialog = useDialog();

  // ── User data for list display ──
  const [recipesUserData, setRecipesUserData] = useState<Map<string, RecipeUserDataResponse>>(
    new Map(),
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

  // ── Load supporting data ──
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
      loadSharingData();
      loadAvailableTags();
    }
  }, [status, loadSharingData, loadAvailableTags]);

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

  const handleAcceptRecipeInvitation = async (invUserId: string) => {
    try {
      await respondToRecipeSharingInvitation(invUserId, 'accept');
      showSnackbar('Invitation accepted', 'success');
      loadSharingData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to accept invitation';
      showSnackbar(message, 'error');
    }
  };

  const handleRejectRecipeInvitation = async (invUserId: string) => {
    try {
      await respondToRecipeSharingInvitation(invUserId, 'reject');
      showSnackbar('Invitation rejected', 'success');
      loadSharingData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject invitation';
      showSnackbar(message, 'error');
    }
  };

  const handleRemoveRecipeUser = async (removeUserId: string) => {
    try {
      await removeUserFromRecipeSharing(removeUserId);
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

  // ── Navigation ──
  const handleRecipeClick = (recipe: Recipe) => {
    router.push(`/recipes/${recipe._id}`);
  };

  // ── Sort handlers ──
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSort(newSortBy, newSortOrder);
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
          {/* Compact page header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: { xs: 1.5, md: 2 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Restaurant sx={{ fontSize: { xs: 24, sm: 32 }, color: '#d4915e' }} />
              <Typography
                variant="h5"
                component="h1"
                sx={{ fontSize: '1.125rem', fontWeight: 600 }}
              >
                Recipes
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {/* Desktop: full add button */}
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => router.push('/recipes/new')}
                size="small"
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  bgcolor: '#d4915e',
                  '&:hover': { bgcolor: '#c07f4e' },
                }}
              >
                Add Recipe
              </Button>
              <IconButton
                onClick={() => shareDialog.openDialog()}
                size="small"
                sx={{
                  color: '#d4915e',
                  width: 32,
                  height: 32,
                }}
              >
                <Badge badgeContent={pendingRecipeInvitations?.length || 0} color="error">
                  <Share sx={{ fontSize: 18 }} />
                </Badge>
              </IconButton>
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

          {/* Filter bar */}
          <Box sx={{ mb: 2 }}>
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
          </Box>

          {/* Content */}
          {loading ? (
            <Box sx={centeredLoadingSx}>
              <CircularProgress />
            </Box>
          ) : recipes.length > 0 ? (
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1, fontSize: '0.75rem' }}
              >
                {total} recipe{total !== 1 ? 's' : ''} found
              </Typography>

              {/* Flat row list — same layout for desktop and mobile */}
              <StaggeredList>
                {recipes.map((recipe) => {
                  const userData = recipesUserData.get(recipe._id || '');
                  const allTags = [
                    ...new Set([...(userData?.tags || []), ...(userData?.sharedTags || [])]),
                  ];
                  const rating = userData?.rating;

                  return (
                    <ListRow
                      key={recipe._id}
                      onClick={() => handleRecipeClick(recipe)}
                      accentColor="#d4915e"
                    >
                      {/* Desktop: single line */}
                      <Box
                        sx={{
                          display: { xs: 'none', md: 'flex' },
                          alignItems: 'center',
                          gap: 1.5,
                          width: '100%',
                          minWidth: 0,
                        }}
                      >
                        {/* Emoji */}
                        <Box sx={{ flexShrink: 0, width: 24, textAlign: 'center' }}>
                          {recipe.emoji ? (
                            <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>
                              {recipe.emoji}
                            </Typography>
                          ) : (
                            <RestaurantMenu sx={{ fontSize: 20, color: 'text.secondary' }} />
                          )}
                        </Box>

                        {/* Name */}
                        <Typography
                          variant="body2"
                          sx={{
                            flex: '1 1 auto',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: 500,
                          }}
                        >
                          {recipe.title}
                        </Typography>

                        {/* Tags (tiny pills) */}
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 0.5,
                            flexShrink: 0,
                            maxWidth: 200,
                            overflow: 'hidden',
                          }}
                        >
                          {allTags.slice(0, 3).map((tag) => (
                            <Chip key={tag} label={tag} size="small" sx={tinyChipSx} />
                          ))}
                          {allTags.length > 3 && (
                            <Chip label={`+${allTags.length - 3}`} size="small" sx={tinyChipSx} />
                          )}
                        </Box>

                        {/* Rating */}
                        <Box sx={{ flexShrink: 0, width: 40, textAlign: 'center' }}>
                          {rating ? (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.25,
                              }}
                            >
                              <Star sx={{ fontSize: 14, color: 'warning.main' }} />
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                {rating}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </Box>

                        {/* Date */}
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            flexShrink: 0,
                            width: 90,
                            textAlign: 'right',
                            fontSize: '0.75rem',
                          }}
                        >
                          {new Date(recipe.updatedAt).toLocaleDateString()}
                        </Typography>
                      </Box>

                      {/* Mobile: two lines */}
                      <Box
                        sx={{
                          display: { xs: 'flex', md: 'none' },
                          flexDirection: 'column',
                          width: '100%',
                          minWidth: 0,
                          gap: 0.25,
                        }}
                      >
                        {/* Line 1: emoji + name + date */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                          <Box sx={{ flexShrink: 0, width: 20, textAlign: 'center' }}>
                            {recipe.emoji ? (
                              <Typography sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                                {recipe.emoji}
                              </Typography>
                            ) : (
                              <RestaurantMenu sx={{ fontSize: 18, color: 'text.secondary' }} />
                            )}
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontWeight: 500,
                              fontSize: '0.875rem',
                            }}
                          >
                            {recipe.title}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ flexShrink: 0, fontSize: '0.6875rem' }}
                          >
                            {new Date(recipe.updatedAt).toLocaleDateString()}
                          </Typography>
                        </Box>

                        {/* Line 2: tags + rating */}
                        {(allTags.length > 0 || rating) && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              pl: 3.5,
                            }}
                          >
                            {allTags.slice(0, 3).map((tag) => (
                              <Chip key={tag} label={tag} size="small" sx={tinyChipSx} />
                            ))}
                            {allTags.length > 3 && (
                              <Chip
                                label={`+${allTags.length - 3}`}
                                size="small"
                                sx={tinyChipSx}
                              />
                            )}
                            {rating && (
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.25,
                                  ml: 'auto',
                                }}
                              >
                                <Star sx={{ fontSize: 12, color: 'warning.main' }} />
                                <Typography
                                  variant="body2"
                                  sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}
                                >
                                  {rating}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    </ListRow>
                  );
                })}
              </StaggeredList>

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
        </Box>

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

      {/* Mobile FAB */}
      <IconButton
        onClick={() => router.push('/recipes/new')}
        aria-label="Add recipe"
        sx={{
          display: { xs: 'flex', sm: 'none' },
          position: 'fixed',
          bottom: 68,
          right: 20,
          zIndex: 1050,
          bgcolor: '#d4915e',
          color: 'white',
          width: 48,
          height: 48,
          boxShadow: 3,
          '&:hover': { bgcolor: '#c07f4e' },
        }}
      >
        <Add />
      </IconButton>
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
