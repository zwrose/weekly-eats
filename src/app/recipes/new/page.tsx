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
} from '@mui/material';
import { ArrowBack, EmojiEmotions, Public, Person } from '@mui/icons-material';
import dynamic from 'next/dynamic';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { CompactInput } from '@/components/ui';
import { CreateRecipeRequest, FoodItemOption } from '@/types/recipe';
import { createRecipe, filterBlankIngredients, hasValidIngredients } from '@/lib/recipe-utils';
import { fetchFoodItems } from '@/lib/food-items-utils';

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

  // ── Food items ──
  const [foodItemsList, setFoodItemsList] = useState<FoodItemOption[]>([]);

  // ── Emoji picker ──
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

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
          <Box>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                mb: 3,
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'flex-start' },
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
                  alignSelf: 'flex-start',
                }}
              >
                {recipe.emoji || <EmojiEmotions />}
              </IconButton>
              <CompactInput
                autoFocus
                label="Recipe Title"
                value={recipe.title}
                onChange={(e) => setRecipe({ ...recipe, title: e.target.value })}
                fullWidth
                required
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Access Level
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  flexDirection: { xs: 'column', sm: 'row' },
                }}
              >
                <Button
                  variant={recipe.isGlobal ? 'contained' : 'outlined'}
                  onClick={() => setRecipe({ ...recipe, isGlobal: true })}
                  startIcon={<Public />}
                  size="small"
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Global (visible to all users)
                </Button>
                <Button
                  variant={recipe.isGlobal ? 'outlined' : 'contained'}
                  onClick={() => setRecipe({ ...recipe, isGlobal: false })}
                  startIcon={<Person />}
                  size="small"
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Personal (only visible to you)
                </Button>
              </Box>
            </Box>

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

            <Typography variant="h6" gutterBottom>
              Instructions
            </Typography>
            <CompactInput
              label="Cooking Instructions"
              value={recipe.instructions}
              onChange={(e) => setRecipe({ ...recipe, instructions: e.target.value })}
              multiline
              rows={6}
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
          </Box>
        </Box>

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
