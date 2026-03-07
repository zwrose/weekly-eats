'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Button,
  IconButton,
  Divider,
  Snackbar,
  Alert,
  CircularProgress,
  Dialog,
  DialogContent,
  Paper,
  TextField,
} from '@mui/material';
import { ArrowBack, EmojiEmotions, OpenInFull } from '@mui/icons-material';
import dynamic from 'next/dynamic';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import RecipeMetadataEditor from '@/components/RecipeMetadataEditor';
import { CompactInput, DialogActions, DialogTitle } from '@/components/ui';
import { responsiveDialogStyle } from '@/lib/theme';
import { CreateRecipeRequest, FoodItemOption } from '@/types/recipe';
import { createRecipe, filterBlankIngredients, hasValidIngredients } from '@/lib/recipe-utils';
import { fetchFoodItems } from '@/lib/food-items-utils';
import { updateRecipeTags, updateRecipeRating } from '@/lib/recipe-user-data-utils';

const RecipeIngredients = dynamic(() => import('@/components/RecipeIngredients'), { ssr: false });
const EmojiPicker = dynamic(() => import('@/components/EmojiPicker'), { ssr: false });

function NewRecipeContent() {
  const { status } = useSession();
  const router = useRouter();

  // ── Recipe state ──
  const [recipe, setRecipe] = useState<CreateRecipeRequest>({
    title: '',
    emoji: '',
    ingredients: [{ title: '', ingredients: [], isStandalone: true }],
    instructions: '',
    isGlobal: true,
  });
  const [saving, setSaving] = useState(false);

  // ── Tags & Rating (saved after creation) ──
  const [tags, setTags] = useState<string[]>([]);
  const [rating, setRating] = useState<number | undefined>(undefined);

  // ── Food items ──
  const [foodItemsList, setFoodItemsList] = useState<FoodItemOption[]>([]);

  // ── Emoji picker ──
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // ── Instructions fullscreen ──
  const [instructionsFullscreen, setInstructionsFullscreen] = useState(false);

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

  const loadFoodItems = useCallback(async () => {
    try {
      const items = await fetchFoodItems();
      setFoodItemsList(items);
    } catch (err) {
      console.error('Error loading food items:', err);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      loadFoodItems();
    }
  }, [status, loadFoodItems]);

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
    setFoodItemsList((prev) => [...prev, foodItemWithId]);
  };

  const handleCreateRecipe = async () => {
    try {
      setSaving(true);
      const filteredRecipe = {
        ...recipe,
        ingredients: filterBlankIngredients(recipe.ingredients),
      };
      const created = await createRecipe(filteredRecipe);
      if (created._id) {
        // Save tags and rating in parallel if set
        const saves: Promise<unknown>[] = [];
        if (tags.length > 0) saves.push(updateRecipeTags(created._id, tags));
        if (rating !== undefined) saves.push(updateRecipeRating(created._id, rating));
        if (saves.length > 0) await Promise.all(saves);
        router.push(`/recipes/${created._id}`);
      } else {
        router.push('/recipes');
      }
    } catch (err) {
      console.error('Error creating recipe:', err);
      setSnackbar({ open: true, message: 'Failed to create recipe', severity: 'error' });
      setSaving(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setRecipe({ ...recipe, emoji });
  };

  if (status === 'loading') {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
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
      <Container maxWidth="lg">
        <Box sx={{ py: { xs: 1, md: 2 } }}>
          {/* Page header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 2,
            }}
          >
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.push('/recipes')}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              Recipes
            </Button>
            <Box sx={{ flex: 1 }} />
            <Typography variant="h6">New Recipe</Typography>
          </Box>

          {/* Form */}
          <Paper sx={{ p: { xs: 2, sm: 3 }, border: '1px solid', borderColor: 'divider' }}>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                mb: 3,
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'center' },
              }}
            >
              <IconButton
                onClick={() => setEmojiPickerOpen(true)}
                aria-label="Choose emoji"
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  width: 48,
                  height: 48,
                  fontSize: '1.5rem',
                }}
              >
                {recipe.emoji || <EmojiEmotions />}
              </IconButton>
              <TextField
                autoFocus
                label="Recipe Title"
                value={recipe.title}
                onChange={(e) => setRecipe({ ...recipe, title: e.target.value })}
                fullWidth
                required
                size="small"
              />
            </Box>

            <RecipeMetadataEditor
              isGlobal={recipe.isGlobal}
              onIsGlobalChange={(isGlobal) => setRecipe({ ...recipe, isGlobal })}
              rating={rating}
              onRatingChange={setRating}
              tags={tags}
              onTagsChange={setTags}
            />

            <Typography variant="h6" gutterBottom>
              Ingredients
            </Typography>
            <RecipeIngredients
              ingredients={recipe.ingredients}
              onChange={(ingredients) => setRecipe({ ...recipe, ingredients })}
              foodItems={foodItemsList}
              onFoodItemAdded={handleFoodItemAdded}
              removeIngredientButtonText="Remove Ingredient"
            />

            <Divider sx={{ my: 3 }} />

            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="h6">Instructions</Typography>
              <IconButton
                onClick={() => setInstructionsFullscreen(true)}
                size="small"
                aria-label="Edit instructions fullscreen"
                sx={{ color: 'text.secondary' }}
              >
                <OpenInFull sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
            <CompactInput
              value={recipe.instructions}
              onChange={(e) => setRecipe({ ...recipe, instructions: e.target.value })}
              multiline
              minRows={8}
              maxRows={12}
              fullWidth
              required
            />

            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column-reverse', sm: 'row' },
                gap: 1,
                mt: 3,
                justifyContent: { xs: 'stretch', sm: 'flex-end' },
                alignItems: { xs: 'stretch', sm: 'center' },
              }}
            >
              <Button
                onClick={() => router.push('/recipes')}
                size="small"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateRecipe}
                variant="contained"
                size="small"
                disabled={
                  saving ||
                  !recipe.title ||
                  !recipe.instructions ||
                  !hasValidIngredients(recipe.ingredients)
                }
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                {saving ? 'Creating...' : 'Create Recipe'}
              </Button>
            </Box>
          </Paper>
        </Box>

        {/* Instructions Fullscreen Dialog */}
        <Dialog
          open={instructionsFullscreen}
          onClose={() => setInstructionsFullscreen(false)}
          fullWidth
          maxWidth="md"
          sx={{
            ...responsiveDialogStyle,
            '& .MuiDialog-paper': {
              ...responsiveDialogStyle['& .MuiDialog-paper'],
              minHeight: { sm: '70vh' },
              display: 'flex',
              flexDirection: 'column',
            },
          }}
        >
          <DialogTitle onClose={() => setInstructionsFullscreen(false)}>Instructions</DialogTitle>
          <DialogContent
            sx={{
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
              p: 2,
              overflow: 'hidden',
            }}
          >
            <Box
              component="textarea"
              autoFocus
              value={recipe.instructions}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setRecipe({ ...recipe, instructions: e.target.value })
              }
              placeholder="Enter cooking instructions..."
              sx={{
                flex: 1,
                width: '100%',
                resize: 'none',
                border: '1px solid',
                borderColor: 'rgba(255,255,255,0.20)',
                borderRadius: '6px',
                bgcolor: 'transparent',
                color: 'text.primary',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                p: 1.5,
                outline: 'none',
                '&:focus': {
                  borderColor: 'primary.main',
                },
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.35) transparent',
                '&::-webkit-scrollbar': { width: 6 },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(255,255,255,0.35)',
                  borderRadius: 999,
                },
              }}
            />
          </DialogContent>
          <DialogActions sx={{ mt: 'auto' }}>
            <Button
              onClick={() => setInstructionsFullscreen(false)}
              variant="contained"
              size="small"
            >
              Done
            </Button>
          </DialogActions>
        </Dialog>

        {/* Emoji Picker */}
        <EmojiPicker
          open={emojiPickerOpen}
          onClose={() => setEmojiPickerOpen(false)}
          onSelect={handleEmojiSelect}
          currentEmoji={recipe.emoji}
        />

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </AuthenticatedLayout>
  );
}

export default function NewRecipePage() {
  return (
    <Suspense
      fallback={
        <AuthenticatedLayout>
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          </Container>
        </AuthenticatedLayout>
      }
    >
      <NewRecipeContent />
    </Suspense>
  );
}
