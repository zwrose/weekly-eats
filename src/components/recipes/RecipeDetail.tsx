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
import { SectionLabel } from './SectionLabel';
import { RecipeIngredientsView } from './RecipeIngredientsView';
import { RecipeInstructionsView } from './RecipeInstructionsView';
import dynamic from 'next/dynamic';
import { ConfirmDialog } from '@/components/meal-plans/ConfirmDialog';
import { type AccessLevel } from './recipe-display-utils';
import type { Recipe } from '@/types/recipe';
import type { RecipeUserDataResponse } from '@/types/recipe-user-data';

// ── Dynamically imported heavy editor ──
const RecipeEditor = dynamic(() => import('./RecipeEditor').then((m) => m.RecipeEditor), {
  ssr: false,
});

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

  const sharedRatings = userData?.sharedRatings;
  const tags = userData?.tags ?? [];

  // Shared "‹ Recipes" back link.
  const backLink = (sx: object) => (
    <ButtonBase
      aria-label="Back to recipes"
      onClick={() => router.push('/recipes')}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        color: tokens.section.recipes,
        fontSize: 14,
        '&:hover': { opacity: 0.85 },
        ...sx,
      }}
    >
      <Icon name="chevron_left" size={18} />
      Recipes
    </ButtonBase>
  );

  // Shared ⋯ more-menu (Delete). Kept on both breakpoints per product call.
  const moreButton = (size: number) => (
    <ButtonBase
      aria-label="More options"
      onClick={(e) => setMenuAnchor(e.currentTarget)}
      sx={{
        width: size,
        height: size,
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
  );

  // Section content wrapper: a borderless raised card on mobile, flat-on-page on desktop.
  const sectionCardSx = {
    bgcolor: { xs: tokens.surface.raised, md: 'transparent' },
    borderRadius: { xs: `${tokens.radius.xl}px`, md: 0 },
    p: { xs: 2, md: 0 },
  } as const;

  return (
    <Box sx={{ color: tokens.text.primary }}>
      {/* ── Mobile top app-bar ── */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1.25,
          borderBottom: `1px solid ${tokens.border.subtle}`,
          mb: 2,
        }}
      >
        {backLink({ ml: -0.5 })}
        {canEdit && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ButtonBase
              aria-label="Edit recipe"
              onClick={() => setEditing(true)}
              sx={{
                color: tokens.section.recipes,
                fontSize: 14,
                fontWeight: 600,
                '&:hover': { opacity: 0.85 },
              }}
            >
              Edit
            </ButtonBase>
            {moreButton(30)}
          </Box>
        )}
      </Box>

      {/* ── Desktop back link ── */}
      {backLink({ display: { xs: 'none', md: 'inline-flex' }, pt: 2.5, pb: 1 })}

      {/* ── Header (flat; desktop has a bottom divider) ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: { xs: 1.75, md: 2 },
          borderBottom: { xs: 'none', md: `1px solid ${tokens.border.subtle}` },
          pb: { xs: 0, md: 2.75 },
          mb: { xs: 2.25, md: 2.75 },
        }}
      >
        {/* Emoji tile — falls back to 🍽️ for emoji-less recipes */}
        <Box
          sx={{
            width: { xs: 56, md: 72 },
            height: { xs: 56, md: 72 },
            flexShrink: 0,
            borderRadius: { xs: '14px', md: '16px' },
            bgcolor: tokens.surface.elevated,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: { xs: 32, md: 42 },
          }}
        >
          {recipe.emoji || '🍽️'}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Eyebrow — desktop only */}
          <Box
            sx={{
              display: { xs: 'none', md: 'block' },
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: tokens.section.recipes,
              mb: 0.25,
            }}
          >
            Recipe
          </Box>

          {/* Title */}
          <Box
            sx={{
              fontSize: { xs: 22, md: 34 },
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
              color: tokens.text.primary,
              lineHeight: { xs: 1.1, md: 1.05 },
            }}
          >
            {recipe.title}
          </Box>

          {/* Meta row: stars + access + (desktop-inline tags) */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: { xs: 1, md: 1.5 },
              mt: { xs: 0.75, md: 1 },
            }}
          >
            {userData?.rating !== undefined && (
              <>
                <Box sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
                  <Stars rating={userData.rating} sharedRatings={sharedRatings} size={13} />
                </Box>
                <Box sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
                  <Stars rating={userData.rating} sharedRatings={sharedRatings} size={16} />
                </Box>
              </>
            )}
            <AccessChip access={accessLevel} />
            {/* Desktop: tags inline (small) */}
            <Box sx={{ display: { xs: 'none', md: 'inline-flex' }, flexWrap: 'wrap', gap: 1 }}>
              {tags.map((tag) => (
                <TagChip key={tag} small>
                  {tag}
                </TagChip>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Desktop actions */}
        {canEdit && (
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, flexShrink: 0 }}>
            <ButtonBase
              aria-label="Edit recipe"
              onClick={() => setEditing(true)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.875,
                borderRadius: `${tokens.radius.md}px`,
                border: `1px solid ${tokens.border.strong}`,
                color: tokens.text.secondary,
                fontSize: 14,
                '&:hover': { color: tokens.text.primary, bgcolor: tokens.surface.elevated },
              }}
            >
              <Icon name="edit" size={16} />
              Edit
            </ButtonBase>
            {moreButton(38)}
          </Box>
        )}
      </Box>

      {/* ── Mobile tags row (full-size chips) ── */}
      {tags.length > 0 && (
        <Box sx={{ display: { xs: 'flex', md: 'none' }, flexWrap: 'wrap', gap: 0.75, mb: 2.25 }}>
          {tags.map((tag) => (
            <TagChip key={tag}>{tag}</TagChip>
          ))}
        </Box>
      )}

      {/* ── Shared ⋯ menu ── */}
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

      {/* ── Body: flat two-column on desktop, stacked borderless cards on mobile ── */}
      <Box
        sx={{
          display: { xs: 'block', md: 'grid' },
          gridTemplateColumns: { md: 'minmax(320px, 420px) 1fr' },
          gap: { xs: 0, md: 4 },
          alignItems: 'flex-start',
        }}
      >
        {/* Ingredients */}
        <Box sx={{ mb: { xs: 2.25, md: 0 } }}>
          <SectionLabel>Ingredients</SectionLabel>
          <Box sx={sectionCardSx}>
            <RecipeIngredientsView ingredients={recipe.ingredients} />
          </Box>
        </Box>

        {/* Instructions */}
        <Box>
          <SectionLabel>Instructions</SectionLabel>
          <Box sx={sectionCardSx}>
            <RecipeInstructionsView instructions={recipe.instructions} />
          </Box>
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
