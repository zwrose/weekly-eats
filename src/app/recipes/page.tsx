'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Button,
  Alert,
  Snackbar,
  IconButton,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';
import { useServerPagination } from '@/lib/hooks/use-server-pagination';
import { useDebouncedSearch } from '@/lib/hooks/use-debounced-search';
import Pagination from '@/components/optimized/Pagination';
import { RecipeFilterBar } from '@/components/recipes/RecipeFilterBar';
import { RecipeCardMobile, RecipeTableRow } from '@/components/recipes/RecipeRow';
import { RecipeSharingDialog } from '@/components/recipes/RecipeSharingDialog';
import { RecipeEditor } from '@/components/recipes/RecipeEditor';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
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
import { Recipe } from '@/types/recipe';

// ── Extended recipe type with server-computed accessLevel ──

interface RecipeWithAccessLevel extends Recipe {
  accessLevel: 'private' | 'shared-by-you' | 'shared-by-others';
}

// ── Module-level sx constants ──

const centeredLoadingSx = {
  display: 'flex',
  justifyContent: 'center',
  py: 4,
} as const;

const paginationContainerSx = {
  display: 'flex',
  justifyContent: 'center',
  mt: 2,
} as const;

// ── DotBadge — small orange dot for sharing button ──

function DotBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 6,
        right: 6,
        width: 7,
        height: 7,
        borderRadius: '50%',
        bgcolor: tokens.state.danger,
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Main content (needs useSearchParams → must be inside Suspense) ──

function RecipesPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Old deep-link redirect ──
  useEffect(() => {
    const viewRecipe = searchParams.get('viewRecipe');
    if (viewRecipe === 'true') {
      const recipeId = searchParams.get('viewRecipe_recipeId');
      if (recipeId) {
        router.replace(`/recipes/${recipeId}`);
      } else {
        router.replace('/recipes');
      }
    }
  }, [searchParams, router]);

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
  } = useServerPagination<RecipeWithAccessLevel>({ fetchFn: fetchRecipes, filterKey });

  // ── Create takeover state ──
  const [creating, setCreating] = useState(false);

  // ── Share dialog state ──
  const [shareOpen, setShareOpen] = useState(false);

  // ── Batch user-data (for list tags/ratings) ──
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
  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

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

  const handleAcceptRecipeInvitation = async (inviteUserId: string) => {
    try {
      await respondToRecipeSharingInvitation(inviteUserId, 'accept');
      showSnackbar('Invitation accepted', 'success');
      loadSharingData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to accept invitation';
      showSnackbar(message, 'error');
    }
  };

  const handleRejectRecipeInvitation = async (inviteUserId: string) => {
    try {
      await respondToRecipeSharingInvitation(inviteUserId, 'reject');
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

  // ── Sort handler ──
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSort(newSortBy, newSortOrder);
  };

  // ── Auth guards ──
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

  // ── Create takeover: render RecipeEditor full-page in place of list ──
  if (creating) {
    return (
      <AuthenticatedLayout>
        <RecipeEditor
          mode="create"
          availableTags={availableTags}
          onSaved={(r) => {
            setCreating(false);
            router.push(`/recipes/${r._id}`);
          }}
          onClose={() => setCreating(false)}
        />
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: { xs: 1, md: 2 } }}>
          {/* ── Header ── */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: { xs: 2, sm: 0 },
              mb: { xs: 2, md: 3 },
            }}
          >
            <Box>
              <Typography
                variant="h3"
                component="h1"
                sx={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  color: tokens.text.primary,
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                Your recipes
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: tokens.section.recipes, mt: 0.5, fontWeight: 500 }}
              >
                {total} {total === 1 ? 'recipe' : 'recipes'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              {/* Sharing button with dot badge */}
              <Box sx={{ position: 'relative' }}>
                <IconButton
                  onClick={() => setShareOpen(true)}
                  aria-label="Share recipes"
                  sx={{
                    color: tokens.text.secondary,
                    border: `1px solid ${tokens.border.subtle}`,
                    borderRadius: `${tokens.radius.md}px`,
                    p: 1,
                    '&:hover': {
                      bgcolor: tokens.surface.elevated,
                      color: tokens.text.primary,
                    },
                  }}
                >
                  <Icon name="group" sx={{ fontSize: 20 }} />
                </IconButton>
                <DotBadge show={pendingRecipeInvitations.length > 0} />
              </Box>

              {/* + New recipe */}
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setCreating(true)}
                sx={{
                  bgcolor: tokens.section.recipes,
                  color: '#0c1118',
                  fontWeight: 700,
                  borderRadius: `${tokens.radius.md}px`,
                  '&:hover': { bgcolor: '#d4944f' },
                }}
              >
                New recipe
              </Button>
            </Box>
          </Box>

          {/* ── Filter bar ── */}
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

          {/* ── List / loading / empty ── */}
          {loading ? (
            <Box sx={centeredLoadingSx}>
              <CircularProgress />
            </Box>
          ) : recipes.length > 0 ? (
            <>
              {/* Desktop table */}
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                {recipes.map((recipe) => {
                  const userData = recipesUserData.get(recipe._id ?? '');
                  const allTags = [
                    ...new Set([...(userData?.tags ?? []), ...(userData?.sharedTags ?? [])]),
                  ];
                  return (
                    <RecipeTableRow
                      key={recipe._id}
                      recipe={recipe}
                      tags={allTags}
                      rating={userData?.rating}
                      onOpen={() => router.push(`/recipes/${recipe._id}`)}
                    />
                  );
                })}
              </Box>

              {/* Mobile cards */}
              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                {recipes.map((recipe) => {
                  const userData = recipesUserData.get(recipe._id ?? '');
                  const allTags = [
                    ...new Set([...(userData?.tags ?? []), ...(userData?.sharedTags ?? [])]),
                  ];
                  return (
                    <RecipeCardMobile
                      key={recipe._id}
                      recipe={recipe}
                      tags={allTags}
                      rating={userData?.rating}
                      onOpen={() => router.push(`/recipes/${recipe._id}`)}
                    />
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
              {hasActiveFilters ? 'No recipes match your filters' : 'No recipes found'}
            </Alert>
          )}
        </Box>
      </Container>

      {/* ── Sharing dialog ── */}
      <RecipeSharingDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        pendingInvitations={pendingRecipeInvitations}
        onAcceptInvitation={handleAcceptRecipeInvitation}
        onRejectInvitation={handleRejectRecipeInvitation}
        shareTags={shareTags}
        onShareTagsChange={setShareTags}
        shareRatings={shareRatings}
        onShareRatingsChange={setShareRatings}
        shareEmail={shareEmail}
        onShareEmailChange={setShareEmail}
        onInviteUser={handleInviteUser}
        sharedUsers={sharedRecipeUsers}
        onRemoveUser={handleRemoveRecipeUser}
      />

      {/* ── Snackbar ── */}
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
