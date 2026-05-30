// src/components/recipes/RecipeDetail.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Box, ButtonBase, CircularProgress, Alert, Menu, MenuItem } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { Icon } from '@/components/ui/Icon';
import { fetchRecipe, deleteRecipe } from '@/lib/recipe-utils';
import { fetchRecipeUserData, fetchUserTags } from '@/lib/recipe-user-data-utils';
import { Stars } from './Stars';
import { TagChip, AccessChip } from './TagChip';
import { RecipeIngredientsView } from './RecipeIngredientsView';
import { RecipeInstructionsView } from './RecipeInstructionsView';
import { RecipeEditor } from './RecipeEditor';
import { ConfirmDialog } from '@/components/meal-plans/ConfirmDialog';
import { accessLevelMeta, type AccessLevel } from './recipe-display-utils';
import type { Recipe } from '@/types/recipe';
import type { RecipeUserDataResponse } from '@/types/recipe-user-data';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function computeAccessLevel(recipe: Recipe, userId: string): AccessLevel {
  if (recipe.createdBy !== userId) return 'shared-by-others';
  return recipe.isGlobal ? 'shared-by-you' : 'private';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecipeDetailProps {
  recipeId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecipeDetail({ recipeId }: RecipeDetailProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? '';

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [userData, setUserData] = useState<RecipeUserDataResponse | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchRecipe(recipeId), fetchRecipeUserData(recipeId), fetchUserTags()])
      .then(([r, ud, tags]) => {
        if (cancelled) return;
        setRecipe(r);
        setUserData(ud);
        setAvailableTags(tags);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : 'Failed to load recipe');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  const refetchUserData = () => {
    fetchRecipeUserData(recipeId)
      .then(setUserData)
      .catch(() => {
        // Best-effort; ignore error
      });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={32} sx={{ color: tokens.section.recipes }} />
      </Box>
    );
  }

  if (fetchError || !recipe) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {fetchError ?? 'Recipe not found.'}
      </Alert>
    );
  }

  const canEdit = recipe.createdBy === userId;
  const accessLevel = computeAccessLevel(recipe, userId);

  // Edit takeover
  if (editing) {
    return (
      <RecipeEditor
        mode="edit"
        recipe={recipe}
        userData={userData ?? undefined}
        availableTags={availableTags}
        currentRecipeId={recipeId}
        onSaved={(saved) => {
          setRecipe(saved);
          setEditing(false);
          refetchUserData();
        }}
        onClose={() => setEditing(false)}
        onDeleted={() => router.push('/recipes')}
      />
    );
  }

  const sharedRatings =
    userData && 'sharedRatings' in userData
      ? (userData.sharedRatings as Array<{
          userId: string;
          userName?: string;
          userEmail: string;
          rating: number;
        }>)
      : undefined;

  return (
    <Box sx={{ color: tokens.text.primary }}>
      {/* Back link */}
      <ButtonBase
        aria-label="‹ Recipes"
        onClick={() => router.push('/recipes')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          color: tokens.text.secondary,
          fontSize: 13,
          px: 1,
          py: 0.5,
          borderRadius: `${tokens.radius.sm}px`,
          mb: 2,
          '&:hover': { color: tokens.text.primary },
        }}
      >
        <Icon name="arrow_back_ios" size={13} />
        Recipes
      </ButtonBase>

      {/* Header */}
      <Box
        sx={{
          bgcolor: tokens.surface.raised,
          borderRadius: `${tokens.radius.xl}px`,
          border: `1px solid ${tokens.border.subtle}`,
          p: { xs: 2, md: 3 },
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          {/* Emoji tile */}
          {recipe.emoji && (
            <Box
              sx={{
                width: 56,
                height: 56,
                flexShrink: 0,
                borderRadius: `${tokens.radius.lg}px`,
                bgcolor: tokens.surface.elevated,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              {recipe.emoji}
            </Box>
          )}

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Eyebrow */}
            <Box
              sx={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: tokens.section.recipes,
                mb: 0.25,
              }}
            >
              RECIPE
            </Box>

            {/* Title */}
            <Box
              sx={{
                fontSize: { xs: 20, md: 24 },
                fontWeight: 700,
                fontFamily: 'var(--font-bricolage, inherit)',
                color: tokens.text.primary,
                mb: 0.5,
                lineHeight: 1.2,
              }}
            >
              {recipe.title}
            </Box>

            {/* Stars + access + tags row */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 0.75 }}>
              {userData?.rating !== undefined && (
                <Stars rating={userData.rating} sharedRatings={sharedRatings} />
              )}
              <AccessChip access={accessLevel} />
              {userData?.tags?.map((tag) => (
                <TagChip key={tag}>{tag}</TagChip>
              ))}
            </Box>
          </Box>

          {/* Actions (creator only) */}
          {canEdit && (
            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
              {/* Edit button */}
              <ButtonBase
                aria-label="Edit recipe"
                onClick={() => setEditing(true)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.25,
                  py: 0.75,
                  borderRadius: `${tokens.radius.md}px`,
                  border: `1px solid ${tokens.border.strong}`,
                  color: tokens.text.secondary,
                  fontSize: 13,
                  '&:hover': { color: tokens.text.primary, bgcolor: tokens.surface.elevated },
                }}
              >
                <Icon name="edit" size={15} />
                Edit
              </ButtonBase>

              {/* ⋯ more menu */}
              <ButtonBase
                aria-label="More options"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: `${tokens.radius.md}px`,
                  border: `1px solid ${tokens.border.subtle}`,
                  color: tokens.text.secondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '&:hover': { color: tokens.text.primary, bgcolor: tokens.surface.elevated },
                }}
              >
                <Icon name="more_horiz" size={18} />
              </ButtonBase>

              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                PaperProps={{
                  sx: {
                    bgcolor: tokens.surface.elevated,
                    border: `1px solid ${tokens.border.subtle}`,
                    color: tokens.text.primary,
                    minWidth: 140,
                  },
                }}
              >
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    setDeleteOpen(true);
                  }}
                  sx={{ color: tokens.state.danger, fontSize: 14 }}
                >
                  <Icon name="delete" size={16} color={tokens.state.danger} />
                  <Box component="span" sx={{ ml: 1 }}>
                    Delete
                  </Box>
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Box>
      </Box>

      {/* Body: two-column on md+, stacked on xs */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
        }}
      >
        {/* Ingredients */}
        <Box
          sx={{
            bgcolor: tokens.surface.raised,
            borderRadius: `${tokens.radius.xl}px`,
            border: `1px solid ${tokens.border.subtle}`,
            p: { xs: 2, md: 3 },
          }}
        >
          <Box
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: tokens.text.secondary,
              mb: 2,
            }}
          >
            Ingredients
          </Box>
          <RecipeIngredientsView ingredients={recipe.ingredients} />
        </Box>

        {/* Instructions */}
        <Box
          sx={{
            bgcolor: tokens.surface.raised,
            borderRadius: `${tokens.radius.xl}px`,
            border: `1px solid ${tokens.border.subtle}`,
            p: { xs: 2, md: 3 },
          }}
        >
          <Box
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: tokens.text.secondary,
              mb: 2,
            }}
          >
            Instructions
          </Box>
          <RecipeInstructionsView instructions={recipe.instructions} />
        </Box>
      </Box>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete recipe?"
        body="This will permanently delete the recipe. This cannot be undone."
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={async () => {
          setDeleteOpen(false);
          await deleteRecipe(recipeId);
          router.push('/recipes');
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </Box>
  );
}
