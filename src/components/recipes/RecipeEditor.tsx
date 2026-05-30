// src/components/recipes/RecipeEditor.tsx
'use client';

import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  FormControlLabel,
  InputBase,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { createRecipe, updateRecipe, deleteRecipe } from '@/lib/recipe-utils';
import {
  updateRecipeTags,
  updateRecipeRating,
  deleteRecipeRating,
} from '@/lib/recipe-user-data-utils';
import { EmojiPicker } from '@/components/recipes/EmojiPicker';
import { RecipeTagsEditor } from '@/components/recipes/RecipeTagsEditor';
import { Stars } from '@/components/recipes/Stars';
import {
  RecipeIngredientsEditor,
  validateRecipeIngredients,
} from '@/components/recipes/RecipeIngredientsEditor';
import { ConfirmDialog } from '@/components/meal-plans/ConfirmDialog';
import type { Recipe, RecipeIngredientList } from '@/types/recipe';
import type { RecipeUserDataResponse } from '@/types/recipe-user-data';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function filterBlankIngredients(ingredients: RecipeIngredientList[]): RecipeIngredientList[] {
  return ingredients.map((list) => ({
    ...list,
    ingredients: list.ingredients.filter(
      (ingredient) => ingredient.id && ingredient.id.trim() !== ''
    ),
  }));
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

  const headerTitle = mode === 'create' ? 'New recipe' : 'Editing recipe';

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
          gap: 1,
          px: { xs: 2, md: 3 },
          py: 1.5,
        }}
      >
        {/* Cancel (mobile: text; desktop: ghost button) */}
        <Button
          onClick={cancel}
          sx={{
            color: tokens.text.secondary,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: 14,
            minWidth: 0,
            mr: 'auto',
          }}
        >
          Cancel
        </Button>

        {/* Title */}
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: { xs: 15, md: 17 },
            color: tokens.text.primary,
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {headerTitle}
        </Typography>

        {/* Save */}
        <Button
          variant="contained"
          onClick={save}
          disabled={!valid || saving}
          sx={{
            ml: 'auto',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: 14,
            bgcolor: tokens.section.recipes,
            color: '#0c1118',
            borderRadius: `${tokens.radius.pill}px`,
            px: 2,
            py: 0.75,
            '&:hover': { bgcolor: tokens.section.recipes, filter: 'brightness(1.1)' },
            '&.Mui-disabled': { bgcolor: tokens.surface.elevated, color: tokens.text.muted },
          }}
        >
          Save
        </Button>
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
        {/* Emoji + Title row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ButtonBase
            onClick={() => setEmojiOpen(true)}
            sx={{
              width: 48,
              height: 48,
              borderRadius: `${tokens.radius.xl}px`,
              bgcolor: tokens.surface.elevated,
              border: `1px solid ${tokens.border.subtle}`,
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            {draft.emoji || '🍽'}
          </ButtonBase>
          <InputBase
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            inputProps={{ 'aria-label': 'Title' }}
            placeholder="Recipe name"
            sx={{
              flex: 1,
              fontSize: { xs: 20, md: 24 },
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              color: tokens.text.primary,
              '& input::placeholder': { color: tokens.text.muted, opacity: 1 },
            }}
          />
        </Box>

        {/* Access */}
        <Box>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 600,
              color: tokens.text.muted,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              mb: 1,
            }}
          >
            Access
          </Typography>
          <RadioGroup
            row
            value={draft.isGlobal ? 'global' : 'personal'}
            onChange={(e) => setDraft((d) => ({ ...d, isGlobal: e.target.value === 'global' }))}
            sx={{ gap: 2 }}
          >
            <FormControlLabel
              value="personal"
              control={
                <Radio
                  size="small"
                  sx={{
                    color: tokens.text.muted,
                    '&.Mui-checked': { color: tokens.section.recipes },
                  }}
                />
              }
              label={
                <Typography sx={{ fontSize: 14, color: tokens.text.primary }}>Personal</Typography>
              }
            />
            <FormControlLabel
              value="global"
              control={
                <Radio
                  size="small"
                  sx={{
                    color: tokens.text.muted,
                    '&.Mui-checked': { color: tokens.section.recipes },
                  }}
                />
              }
              label={
                <Typography sx={{ fontSize: 14, color: tokens.text.primary }}>Global</Typography>
              }
            />
          </RadioGroup>
        </Box>

        {/* Tags */}
        <Box>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 600,
              color: tokens.text.muted,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              mb: 1,
            }}
          >
            Tags
          </Typography>
          <RecipeTagsEditor value={tags} onChange={setTags} availableTags={availableTags} />
        </Box>

        {/* Your rating */}
        <Box>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 600,
              color: tokens.text.muted,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              mb: 1,
            }}
          >
            Your rating
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 600,
                color: tokens.text.muted,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                mb: 1.5,
              }}
            >
              Ingredients
            </Typography>
            <RecipeIngredientsEditor
              value={draft.ingredients}
              onChange={(ings) => setDraft((d) => ({ ...d, ingredients: ings }))}
              currentRecipeId={currentRecipeId}
            />
          </Box>

          {/* Instructions */}
          <Box>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 600,
                color: tokens.text.muted,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                mb: 1.5,
              }}
            >
              Instructions
            </Typography>
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
                  borderRadius: `${tokens.radius.lg}px`,
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
                color: tokens.state.danger,
                borderColor: tokens.state.danger,
                border: `1px solid ${tokens.state.danger}`,
                borderRadius: `${tokens.radius.lg}px`,
                textTransform: 'none',
                fontWeight: 500,
                fontSize: 14,
                px: 2,
                '&:hover': { bgcolor: tokens.state.dangerMuted },
              }}
            >
              🗑 Delete recipe
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
