// src/components/recipes/RecipeEditor.tsx
'use client';

import { useMemo, useRef, useState } from 'react';
import { Box, Button, ButtonBase, InputBase, TextField } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { Icon } from '@/components/ui/Icon';
import { createRecipe, updateRecipe, deleteRecipe } from '@/lib/recipe-utils';
import {
  updateRecipeTags,
  updateRecipeRating,
  deleteRecipeRating,
} from '@/lib/recipe-user-data-utils';
import { EmojiPicker } from '@/components/recipes/EmojiPicker';
import { RecipeTagsEditor } from '@/components/recipes/RecipeTagsEditor';
import { Stars } from '@/components/recipes/Stars';
import { SectionLabel } from '@/components/recipes/SectionLabel';
import { RECIPE_ACCENT_MUTED } from '@/components/recipes/recipe-display-utils';
import {
  RecipeIngredientsEditor,
  validateRecipeIngredients,
  type RecipeIngredientsEditorHandle,
} from '@/components/recipes/RecipeIngredientsEditor';
import { ConfirmDialog } from '@/components/meal-plans/ConfirmDialog';
import type { Recipe, RecipeIngredientList } from '@/types/recipe';
import type { RecipeUserDataResponse } from '@/types/recipe-user-data';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function filterBlankIngredients(ingredients: RecipeIngredientList[]): RecipeIngredientList[] {
  return ingredients.map((list) => ({
    ...list,
    ingredients: list.ingredients.filter(
      (ingredient) => ingredient.id && ingredient.id.trim() !== ''
    ),
  }));
}

/** Uppercase form-field label (matches the artboard <FieldLabel>). */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: tokens.text.secondary,
        mb: 1,
      }}
    >
      {children}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface RecipeEditorProps {
  mode: 'create' | 'edit';
  recipe?: Recipe; // required for edit
  userData?: RecipeUserDataResponse; // tags + rating seed (edit)
  availableTags?: string[];
  currentRecipeId?: string; // exclude self from sub-recipe search (edit)
  onClose: () => void; // Cancel (after discard-confirm if dirty)
  onSaved: (recipe: Recipe) => void;
  onDeleted?: () => void; // edit only
}

// ---------------------------------------------------------------------------
// RecipeEditor
// ---------------------------------------------------------------------------
export function RecipeEditor({
  mode,
  recipe,
  userData,
  availableTags,
  currentRecipeId,
  onClose,
  onSaved,
  onDeleted,
}: RecipeEditorProps) {
  const seed = useMemo(
    () => ({
      title: recipe?.title ?? '',
      emoji: recipe?.emoji ?? '',
      isGlobal: recipe?.isGlobal ?? true,
      ingredients: recipe?.ingredients ?? [{ isStandalone: true, ingredients: [] }],
      instructions: recipe?.instructions ?? '',
    }),
    // `seed` is intentionally computed once from the initial `recipe` prop as a stable
    // dirty-check baseline; re-running on every prop identity change is not wanted.
    [recipe]
  );

  const [draft, setDraft] = useState(seed);
  const [tags, setTags] = useState<string[]>(userData?.tags ?? []);
  const [rating, setRating] = useState<number | undefined>(userData?.rating);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const ingredientsRef = useRef<RecipeIngredientsEditorHandle>(null);

  const valid = draft.title.trim() !== '' && validateRecipeIngredients(draft.ingredients);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(seed) ||
    JSON.stringify([...tags].sort()) !== JSON.stringify([...(userData?.tags ?? [])].sort()) ||
    rating !== userData?.rating;

  const cancel = () => (dirty ? setDiscardOpen(true) : onClose());

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        title: draft.title.trim(),
        emoji: draft.emoji,
        ingredients: filterBlankIngredients(draft.ingredients),
        instructions: draft.instructions,
        isGlobal: draft.isGlobal,
      };
      const saved =
        mode === 'create' ? await createRecipe(payload) : await updateRecipe(recipe!._id!, payload);
      const id = saved._id!;
      // Sync per-user tags/rating (only when changed) — same utils as today.
      if (JSON.stringify([...tags].sort()) !== JSON.stringify([...(userData?.tags ?? [])].sort()))
        await updateRecipeTags(id, tags);
      if (rating !== userData?.rating) {
        if (rating && rating > 0) await updateRecipeRating(id, rating);
        else await deleteRecipeRating(id);
      }
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!recipe?._id) return;
    await deleteRecipe(recipe._id);
    setDeleteOpen(false);
    onDeleted?.();
  };

  const mobileTitle = mode === 'create' ? 'New recipe' : 'Edit recipe';
  const desktopTitle = mode === 'create' ? 'New recipe' : 'Editing recipe';

  // Access option as a bordered radio card (matches the artboard <RadioRow>).
  const accessOption = (value: 'personal' | 'global', label: string) => {
    const selected = (draft.isGlobal ? 'global' : 'personal') === value;
    return (
      <ButtonBase
        aria-label={label}
        aria-pressed={selected}
        onClick={() => setDraft((d) => ({ ...d, isGlobal: value === 'global' }))}
        sx={{
          flex: 1,
          justifyContent: 'flex-start',
          gap: 1.25,
          px: 1.5,
          py: 1.25,
          borderRadius: `${tokens.radius.lg}px`,
          border: `1px solid ${selected ? `${tokens.section.recipes}55` : tokens.border.subtle}`,
          bgcolor: selected ? RECIPE_ACCENT_MUTED : 'transparent',
        }}
      >
        <Box
          sx={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            flexShrink: 0,
            border: `1.5px solid ${selected ? tokens.section.recipes : tokens.border.strong}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && (
            <Box
              sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tokens.section.recipes }}
            />
          )}
        </Box>
        <Box sx={{ fontSize: 14, fontWeight: selected ? 600 : 400, color: tokens.text.primary }}>
          {label}
        </Box>
      </ButtonBase>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        bgcolor: tokens.surface.base,
        color: tokens.text.primary,
      }}
    >
      {/* ── Sticky header ── */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: tokens.surface.base,
          borderBottom: `1px solid ${tokens.border.subtle}`,
          display: 'flex',
          alignItems: 'center',
          px: { xs: 2, md: 4 },
          py: 1.5,
        }}
      >
        {/* Mobile: Cancel (muted text) */}
        <Button
          onClick={cancel}
          sx={{
            display: { xs: 'inline-flex', md: 'none' },
            color: tokens.text.secondary,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: 14,
            minWidth: 0,
            p: 0,
            mr: 'auto',
          }}
        >
          Cancel
        </Button>

        {/* Desktop: "‹ Recipes" + title (left-grouped) */}
        <Box
          sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1.75, mr: 'auto' }}
        >
          <ButtonBase
            onClick={cancel}
            aria-label="Back to recipes"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.25,
              color: tokens.section.recipes,
              fontSize: 14,
              '&:hover': { opacity: 0.85 },
            }}
          >
            <Icon name="chevron_left" size={18} />
            Recipes
          </ButtonBase>
          <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>
            {desktopTitle}
          </Box>
        </Box>

        {/* Mobile: centered title */}
        <Box
          sx={{
            display: { xs: 'block', md: 'none' },
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {mobileTitle}
        </Box>

        {/* Mobile: Save (amber text) */}
        <ButtonBase
          onClick={save}
          disabled={!valid || saving}
          sx={{
            display: { xs: 'inline-flex', md: 'none' },
            ml: 'auto',
            fontSize: 14,
            fontWeight: 600,
            color: valid && !saving ? tokens.section.recipes : tokens.text.muted,
          }}
        >
          Save
        </ButtonBase>

        {/* Desktop: Cancel (ghost) + Save (filled pill) */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, ml: 'auto' }}>
          <Button
            onClick={cancel}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              fontSize: 14,
              color: tokens.text.secondary,
              border: `1px solid ${tokens.border.strong}`,
              borderRadius: `${tokens.radius.md}px`,
              px: 2,
              '&:hover': { bgcolor: tokens.surface.elevated, color: tokens.text.primary },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={!valid || saving}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 14,
              bgcolor: tokens.section.recipes,
              color: '#0c1118',
              borderRadius: `${tokens.radius.md}px`,
              px: 2.5,
              '&:hover': { bgcolor: tokens.section.recipes, filter: 'brightness(1.1)' },
              '&.Mui-disabled': { bgcolor: tokens.surface.elevated, color: tokens.text.muted },
            }}
          >
            Save
          </Button>
        </Box>
      </Box>

      {/* ── Body ── */}
      <Box
        sx={{
          maxWidth: 1280,
          mx: 'auto',
          width: '100%',
          px: { xs: 2, md: 4 },
          py: { xs: 2.5, md: 4 },
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {/* Emoji + Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 } }}>
          <ButtonBase
            aria-label="Choose emoji"
            onClick={() => setEmojiOpen(true)}
            sx={{
              width: { xs: 56, md: 64 },
              height: { xs: 56, md: 64 },
              borderRadius: '14px',
              bgcolor: tokens.surface.elevated,
              border: `1px dashed ${tokens.border.subtle}`,
              fontSize: 32,
              flexShrink: 0,
            }}
          >
            {draft.emoji || '🍽'}
          </ButtonBase>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <FieldLabel>Title</FieldLabel>
            <Box
              sx={{
                height: 40,
                px: 1.5,
                display: 'flex',
                alignItems: 'center',
                border: `1px solid ${tokens.border.subtle}`,
                borderRadius: `${tokens.radius.lg}px`,
                '&:focus-within': { borderColor: tokens.section.recipes },
              }}
            >
              <InputBase
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                inputProps={{ 'aria-label': 'Title' }}
                placeholder="Recipe name"
                sx={{
                  flex: 1,
                  fontSize: 16,
                  color: tokens.text.primary,
                  '& input::placeholder': { color: tokens.text.muted, opacity: 1 },
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Access + Rating (side by side on desktop) */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          <Box sx={{ flex: { md: 1 } }}>
            <FieldLabel>Access</FieldLabel>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {accessOption('personal', 'Personal')}
              {accessOption('global', 'Global')}
            </Box>
          </Box>
          <Box>
            <FieldLabel>Your rating</FieldLabel>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 40 }}>
              <Stars
                editable
                rating={rating ?? 0}
                onChange={(n) => setRating(n === 0 ? undefined : n)}
                size={20}
              />
              {rating !== undefined && (
                <ButtonBase
                  onClick={() => setRating(undefined)}
                  sx={{
                    fontSize: 12,
                    color: tokens.text.muted,
                    px: 1,
                    borderRadius: `${tokens.radius.sm}px`,
                  }}
                >
                  Clear
                </ButtonBase>
              )}
            </Box>
          </Box>
        </Box>

        {/* Tags */}
        <Box>
          <FieldLabel>Tags</FieldLabel>
          <RecipeTagsEditor value={tags} onChange={setTags} availableTags={availableTags} />
        </Box>

        {/* Ingredients + Instructions: two-column on md+, single on xs */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
          }}
        >
          {/* Ingredients */}
          <Box>
            <SectionLabel
              right={
                <ButtonBase
                  onClick={() => ingredientsRef.current?.addGroup()}
                  sx={{ fontSize: 12, color: tokens.section.recipes, '&:hover': { opacity: 0.85 } }}
                >
                  + Group
                </ButtonBase>
              }
            >
              Ingredients
            </SectionLabel>
            <RecipeIngredientsEditor
              ref={ingredientsRef}
              hideAddGroup
              value={draft.ingredients}
              onChange={(ings) => setDraft((d) => ({ ...d, ingredients: ings }))}
              currentRecipeId={currentRecipeId}
            />
          </Box>

          {/* Instructions */}
          <Box>
            <SectionLabel>Instructions</SectionLabel>
            <TextField
              multiline
              fullWidth
              minRows={6}
              value={draft.instructions}
              onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
              placeholder="Write your steps here…"
              helperText="Markdown supported"
              slotProps={{
                htmlInput: { 'aria-label': 'Instructions' },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: tokens.surface.raised,
                  borderRadius: `${tokens.radius.xl}px`,
                  color: tokens.text.primary,
                  fontSize: 14,
                  '& fieldset': { borderColor: tokens.border.subtle },
                  '&:hover fieldset': { borderColor: tokens.border.strong },
                  '&.Mui-focused fieldset': { borderColor: tokens.section.recipes },
                },
                '& .MuiFormHelperText-root': {
                  color: tokens.text.muted,
                  fontSize: 11,
                  mt: 0.5,
                },
                '& textarea::placeholder': { color: tokens.text.muted, opacity: 1 },
              }}
            />
          </Box>
        </Box>

        {/* Delete button (edit mode only) */}
        {mode === 'edit' && (
          <Box sx={{ pt: 2, borderTop: `1px solid ${tokens.border.subtle}` }}>
            <Button
              onClick={() => setDeleteOpen(true)}
              sx={{
                width: { xs: '100%', md: 'auto' },
                height: { xs: 40, md: 38 },
                color: tokens.state.danger,
                border: `1px solid ${tokens.state.danger}55`,
                borderRadius: `${tokens.radius.lg}px`,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 14,
                px: 2,
                '&:hover': { bgcolor: tokens.state.dangerMuted },
              }}
            >
              <Icon name="delete" size={16} color={tokens.state.danger} />
              <Box component="span" sx={{ ml: 1 }}>
                Delete recipe
              </Box>
            </Button>
          </Box>
        )}
      </Box>

      {/* ── Emoji Picker ── */}
      <EmojiPicker
        open={emojiOpen}
        onSelect={(e) => setDraft((d) => ({ ...d, emoji: e }))}
        onClose={() => setEmojiOpen(false)}
        currentEmoji={draft.emoji}
      />

      {/* ── Discard confirm ── */}
      <ConfirmDialog
        open={discardOpen}
        title="Discard changes?"
        body="Your edits won't be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setDiscardOpen(false);
          onClose();
        }}
        onCancel={() => setDiscardOpen(false)}
      />

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete recipe?"
        body={`"${recipe?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </Box>
  );
}
