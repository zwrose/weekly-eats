'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Button,
  IconButton,
  Divider,
  Chip,
  Snackbar,
  Alert,
  Dialog,
  DialogContent,
  DialogContentText,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Delete,
  EmojiEmotions,
  Public,
  Person,
  IosShare,
  RestaurantMenu,
} from '@mui/icons-material';
import dynamic from 'next/dynamic';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { Recipe, UpdateRecipeRequest, RecipeIngredientList, FoodItemOption } from '@/types/recipe';
import { fetchRecipe, updateRecipe, deleteRecipe, filterBlankIngredients, hasValidIngredients } from '@/lib/recipe-utils';
import { fetchFoodItems } from '@/lib/food-items-utils';
import { getUnitForm } from '@/lib/food-items-utils';
import {
  fetchRecipeUserData,
  updateRecipeTags,
  updateRecipeRating,
  deleteRecipeRating,
} from '@/lib/recipe-user-data-utils';
import { RecipeUserDataResponse } from '@/types/recipe-user-data';
import { useDialog, useConfirmDialog } from '@/lib/hooks';
import { responsiveDialogStyle } from '@/lib/theme';
import { CollapsibleSection, CompactInput, DialogActions, DialogTitle } from '@/components/ui';

const RecipeIngredients = dynamic(() => import('@/components/RecipeIngredients'), { ssr: false });
const RecipeInstructionsView = dynamic(() => import('@/components/RecipeInstructionsView'), {
  ssr: false,
});
const RecipeTagsEditor = dynamic(() => import('@/components/RecipeTagsEditor'), { ssr: false });
const RecipeStarRating = dynamic(() => import('@/components/RecipeStarRating'), { ssr: false });
const EmojiPicker = dynamic(() => import('@/components/EmojiPicker'), { ssr: false });

const recipeLinkSx = {
  color: 'primary.main',
  cursor: 'pointer',
  textDecoration: 'underline',
  textDecorationColor: 'transparent',
  transition: 'text-decoration-color 0.2s',
  '&:hover': {
    textDecorationColor: 'currentcolor',
  },
} as const;

function RecipeDetailContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const rawId = params.id;
  const recipeId = Array.isArray(rawId) ? rawId[0] : rawId ?? '';

  const isEditMode = searchParams.get('edit') === 'true';

  // ── Recipe state ──
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Edit state ──
  const [editMode, setEditMode] = useState(isEditMode);
  const [editingRecipe, setEditingRecipe] = useState<UpdateRecipeRequest>({
    title: '',
    emoji: '',
    ingredients: [{ title: '', ingredients: [], isStandalone: true }],
    instructions: '',
    isGlobal: false,
  });

  // ── User data ──
  const [recipeUserData, setRecipeUserData] = useState<RecipeUserDataResponse | null>(null);
  const [accessLevel, setAccessLevel] = useState<
    'private' | 'shared-by-you' | 'shared-by-others' | undefined
  >(undefined);

  // ── Food items ──
  const [foodItems, setFoodItems] = useState<{
    [key: string]: { singularName: string; pluralName: string };
  }>({});
  const [foodItemsList, setFoodItemsList] = useState<FoodItemOption[]>([]);

  // ── Dialogs ──
  const deleteConfirmDialog = useConfirmDialog();
  const emojiPickerDialog = useDialog();

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

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const userId = session?.user?.id;

  // ── Load recipe ──
  const loadRecipe = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedRecipe = await fetchRecipe(recipeId);
      setRecipe(fetchedRecipe);

      // Determine access level from the fetched recipe
      if ('accessLevel' in fetchedRecipe) {
        const rawRecipe = fetchedRecipe as Record<string, unknown>;
        if (typeof rawRecipe.accessLevel === 'string') {
          const al = rawRecipe.accessLevel;
          if (al === 'private' || al === 'shared-by-you' || al === 'shared-by-others') {
            setAccessLevel(al);
          }
        }
      }

      // If edit mode, initialize editing state
      if (isEditMode) {
        setEditingRecipe({
          title: fetchedRecipe.title,
          emoji: fetchedRecipe.emoji || '',
          ingredients: fetchedRecipe.ingredients,
          instructions: fetchedRecipe.instructions,
          isGlobal: fetchedRecipe.isGlobal,
        });
      }
    } catch (err) {
      console.error('Error loading recipe:', err);
      setError('Failed to load recipe');
    } finally {
      setLoading(false);
    }
  }, [recipeId, isEditMode]);

  const loadUserData = useCallback(async () => {
    try {
      const userData = await fetchRecipeUserData(recipeId);
      setRecipeUserData(userData);
    } catch (err) {
      console.error('Error loading recipe user data:', err);
      setRecipeUserData({ tags: [], rating: undefined });
    }
  }, [recipeId]);

  const loadFoodItems = useCallback(async () => {
    try {
      const items = await fetchFoodItems();
      const itemsMap: { [key: string]: { singularName: string; pluralName: string } } = {};
      items.forEach((item) => {
        itemsMap[item._id] = {
          singularName: item.singularName,
          pluralName: item.pluralName,
        };
      });
      setFoodItems(itemsMap);
      setFoodItemsList(items);
    } catch (err) {
      console.error('Error loading food items:', err);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      loadRecipe();
      loadUserData();
      loadFoodItems();
    }
  }, [status, loadRecipe, loadUserData, loadFoodItems]);

  // Sync editMode with URL param
  useEffect(() => {
    setEditMode(isEditMode);
    if (isEditMode && recipe) {
      setEditingRecipe({
        title: recipe.title,
        emoji: recipe.emoji || '',
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        isGlobal: recipe.isGlobal,
      });
    }
  }, [isEditMode, recipe]);

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
    if (ingredient.name) return ingredient.name;

    if (ingredient.type === 'foodItem') {
      const foodItem = foodItems[ingredient.id];
      if (!foodItem) return 'Unknown food item';
      return ingredient.quantity === 1 ? foodItem.singularName : foodItem.pluralName;
    } else {
      return 'Unknown recipe';
    }
  };

  // ── Edit handlers ──
  const handleEnterEditMode = () => {
    if (!recipe) return;
    setEditingRecipe({
      title: recipe.title,
      emoji: recipe.emoji || '',
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      isGlobal: recipe.isGlobal,
    });
    router.push(`/recipes/${recipeId}?edit=true`, { scroll: false });
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    router.push(`/recipes/${recipeId}`, { scroll: false });
  };

  const handleUpdateRecipe = async () => {
    if (!recipe?._id) return;

    try {
      const filteredRecipe = {
        ...editingRecipe,
        ingredients: filterBlankIngredients(editingRecipe.ingredients || []),
      };
      await updateRecipe(recipe._id, filteredRecipe);
      const updatedRecipe = await fetchRecipe(recipe._id);
      setRecipe(updatedRecipe);
      setEditMode(false);
      router.push(`/recipes/${recipeId}`, { scroll: false });
      showSnackbar('Recipe updated successfully', 'success');
    } catch (err) {
      console.error('Error updating recipe:', err);
      showSnackbar('Failed to update recipe', 'error');
    }
  };

  const handleDeleteRecipe = async () => {
    if (!recipe?._id) return;

    try {
      await deleteRecipe(recipe._id);
      deleteConfirmDialog.closeDialog();
      router.push('/recipes');
    } catch (err) {
      console.error('Error deleting recipe:', err);
      showSnackbar('Failed to delete recipe', 'error');
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setEditingRecipe({ ...editingRecipe, emoji });
  };

  const handleIngredientsChange = (ingredients: RecipeIngredientList[]) => {
    setEditingRecipe({ ...editingRecipe, ingredients });
  };

  const canEditRecipe = (r: Recipe) => {
    return r.createdBy === userId;
  };

  // ── Tags and rating handlers ──
  const handleTagsChange = async (tags: string[]) => {
    if (!recipe?._id) return;
    try {
      await updateRecipeTags(recipe._id, tags);
      setRecipeUserData((prev) => (prev ? { ...prev, tags } : { tags, rating: undefined }));
    } catch (err) {
      console.error('Error updating tags:', err);
      showSnackbar('Failed to update tags', 'error');
    }
  };

  const handleRatingChange = async (rating: number | undefined) => {
    if (!recipe?._id) return;
    try {
      if (rating === undefined) {
        await deleteRecipeRating(recipe._id);
        setRecipeUserData((prev) =>
          prev ? { ...prev, rating: undefined } : { tags: [], rating: undefined },
        );
      } else {
        await updateRecipeRating(recipe._id, rating);
        setRecipeUserData((prev) => (prev ? { ...prev, rating } : { tags: [], rating }));
      }
    } catch (err) {
      console.error('Error updating rating:', err);
      showSnackbar('Failed to update rating', 'error');
    }
  };

  const accessLevelChipMap: Record<
    string,
    { label: string; color: 'info' | 'primary' | 'default'; icon: React.ReactElement }
  > = {
    private: { label: 'Private', color: 'default', icon: <Person fontSize="small" /> },
    'shared-by-you': {
      label: 'Shared by You',
      color: 'info',
      icon: <IosShare fontSize="small" />,
    },
    'shared-by-others': {
      label: 'Shared by Others',
      color: 'primary',
      icon: <Public fontSize="small" />,
    },
  };

  // ── Render ──
  if (status === 'loading' || loading) {
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

  if (error || !recipe) {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="lg">
          <Box sx={{ py: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.push('/recipes')}
              sx={{ mb: 2 }}
            >
              Recipes
            </Button>
            <Alert severity="error">{error || 'Recipe not found'}</Alert>
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
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
            {!editMode && canEditRecipe(recipe) && (
              <IconButton onClick={handleEnterEditMode} color="inherit" size="small" aria-label="Edit recipe">
                <Edit />
              </IconButton>
            )}
          </Box>

          {editMode ? (
            /* ── Edit Mode ── */
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
                  onClick={() => emojiPickerDialog.openDialog()}
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
                  {editingRecipe.emoji || <EmojiEmotions />}
                </IconButton>
                <CompactInput
                  label="Recipe Title"
                  value={editingRecipe.title}
                  onChange={(e) =>
                    setEditingRecipe({
                      ...editingRecipe,
                      title: e.target.value,
                    })
                  }
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
                    variant={editingRecipe.isGlobal ? 'contained' : 'outlined'}
                    onClick={() => setEditingRecipe({ ...editingRecipe, isGlobal: true })}
                    startIcon={<Public />}
                    size="small"
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Global (visible to all users)
                  </Button>
                  <Button
                    variant={editingRecipe.isGlobal ? 'outlined' : 'contained'}
                    onClick={() => setEditingRecipe({ ...editingRecipe, isGlobal: false })}
                    startIcon={<Person />}
                    size="small"
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Personal (only visible to you)
                  </Button>
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Tags
                </Typography>
                <RecipeTagsEditor
                  tags={recipeUserData?.tags || []}
                  onChange={handleTagsChange}
                  editable={true}
                  label=""
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <RecipeStarRating
                  rating={recipeUserData?.rating}
                  onChange={handleRatingChange}
                  editable={true}
                />
              </Box>

              <Typography variant="h6" gutterBottom>
                Ingredients
              </Typography>
              <RecipeIngredients
                ingredients={editingRecipe.ingredients || []}
                onChange={handleIngredientsChange}
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
                value={editingRecipe.instructions}
                onChange={(e) =>
                  setEditingRecipe({
                    ...editingRecipe,
                    instructions: e.target.value,
                  })
                }
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
                  justifyContent: { xs: 'stretch', sm: 'flex-start' },
                  alignItems: { xs: 'stretch', sm: 'center' },
                }}
              >
                <Button
                  onClick={() => deleteConfirmDialog.openDialog()}
                  color="error"
                  variant="outlined"
                  startIcon={<Delete />}
                  size="small"
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                    mr: { xs: 0, sm: 'auto' },
                    border: { sm: 'none' },
                    '&:hover': {
                      border: { sm: 'none' },
                      backgroundColor: { sm: 'rgba(211, 47, 47, 0.04)' },
                    },
                  }}
                >
                  Delete
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  size="small"
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateRecipe}
                  variant="contained"
                  size="small"
                  disabled={
                    !editingRecipe.title ||
                    !editingRecipe.instructions ||
                    !hasValidIngredients(editingRecipe.ingredients || [])
                  }
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Update Recipe
                </Button>
              </Box>
            </Box>
          ) : (
            /* ── View Mode ── */
            <Box>
              {/* Title */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                {recipe.emoji ? (
                  <Typography variant="h4">{recipe.emoji}</Typography>
                ) : (
                  <RestaurantMenu sx={{ fontSize: '2rem', color: 'text.secondary' }} />
                )}
                <Typography variant="h5">{recipe.title}</Typography>
              </Box>

              {/* Tags */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Tags
                </Typography>
                <RecipeTagsEditor
                  tags={recipeUserData?.tags || []}
                  sharedTags={recipeUserData?.sharedTags}
                  onChange={handleTagsChange}
                  editable={!canEditRecipe(recipe)}
                  label=""
                />
              </Box>

              {/* Rating */}
              <Box sx={{ mb: 2 }}>
                <RecipeStarRating
                  rating={recipeUserData?.rating}
                  sharedRatings={recipeUserData?.sharedRatings}
                  onChange={handleRatingChange}
                  editable={!canEditRecipe(recipe)}
                />
              </Box>

              {/* Access level */}
              {accessLevel && accessLevelChipMap[accessLevel] && (
                <Box sx={{ mb: 3 }}>
                  <Chip
                    label={accessLevelChipMap[accessLevel].label}
                    size="small"
                    color={accessLevelChipMap[accessLevel].color}
                    variant="outlined"
                    icon={accessLevelChipMap[accessLevel].icon}
                  />
                </Box>
              )}

              <Divider sx={{ mb: 3 }} />

              {/* Ingredients + Instructions */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 3,
                  flexDirection: { xs: 'column', md: 'row' },
                  minHeight: { xs: 'auto', md: '40vh' },
                  maxHeight: { xs: 'none', md: '60vh' },
                }}
              >
                {/* Ingredients */}
                <Box
                  sx={{
                    flex: { xs: 'none', md: '0 0 25%' },
                    maxHeight: { xs: 'none', md: '100%' },
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Box
                    sx={{
                      flex: 1,
                      overflow: 'auto',
                      pr: 1,
                    }}
                  >
                    {recipe.ingredients.map((list, index) => (
                      <CollapsibleSection
                        key={index}
                        title={list.title || 'Ingredients'}
                        defaultExpanded
                      >
                        <Box component="ul" sx={{ pl: 2, py: 1 }}>
                          {list.ingredients.map((ingredient, ingIndex) => (
                            <Typography key={ingIndex} component="li" variant="body1">
                              {ingredient.quantity}{' '}
                              {ingredient.unit && ingredient.unit !== 'each'
                                ? getUnitForm(ingredient.unit, ingredient.quantity) + ' '
                                : ''}
                              {ingredient.type === 'recipe' ? (
                                <Box
                                  component="a"
                                  href={`/recipes/${ingredient.id}`}
                                  sx={recipeLinkSx}
                                >
                                  {getIngredientName(ingredient)}
                                </Box>
                              ) : (
                                getIngredientName(ingredient)
                              )}
                              {ingredient.prepInstructions && `, ${ingredient.prepInstructions}`}
                            </Typography>
                          ))}
                        </Box>
                      </CollapsibleSection>
                    ))}
                  </Box>
                </Box>

                {/* Instructions */}
                <Box
                  sx={{
                    flex: { xs: 'none', md: '1 1 auto' },
                    maxHeight: { xs: 'none', md: '100%' },
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Typography variant="h5" gutterBottom>
                    Instructions
                  </Typography>
                  <Box
                    sx={{
                      flex: 1,
                      overflow: 'auto',
                      pr: 1,
                    }}
                  >
                    <RecipeInstructionsView instructions={recipe.instructions || ''} />
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </Box>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmDialog.open}
          onClose={() => deleteConfirmDialog.closeDialog()}
          sx={responsiveDialogStyle}
        >
          <DialogTitle onClose={() => deleteConfirmDialog.closeDialog()}>Delete Recipe</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete &quot;{recipe?.title}
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
          currentEmoji={editingRecipe.emoji}
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

export default function RecipeDetailPage() {
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
      <RecipeDetailContent />
    </Suspense>
  );
}
