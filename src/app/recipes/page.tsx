"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Paper,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  IconButton,
  Divider,
} from "@mui/material";
import { 
  Restaurant, 
  Add, 
  Edit, 
  Delete, 
  EmojiEmotions,
  RestaurantMenu
} from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { Recipe, CreateRecipeRequest, UpdateRecipeRequest } from "../../types/recipe";
import { fetchRecipes, createRecipe, deleteRecipe, updateRecipe, fetchRecipe } from "../../lib/recipe-utils";
import EmojiPicker from "../../components/EmojiPicker";
import IngredientInput from "../../components/IngredientInput";
import { RecipeIngredientList } from "../../types/recipe";
import { fetchFoodItems, getUnitForm } from "../../lib/food-items-utils";

export default function RecipesPage() {
  const { status } = useSession();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [foodItems, setFoodItems] = useState<{[key: string]: {singularName: string, pluralName: string}}>({});
  const [newRecipe, setNewRecipe] = useState<CreateRecipeRequest>({
    title: '',
    emoji: '',
    ingredients: [{ ingredients: [] }],
    instructions: '',
  });
  const [editingRecipe, setEditingRecipe] = useState<UpdateRecipeRequest>({
    title: '',
    emoji: '',
    ingredients: [{ ingredients: [] }],
    instructions: '',
  });

  useEffect(() => {
    if (status === 'authenticated') {
      loadRecipes();
      loadFoodItems();
    }
  }, [status]);

  const loadRecipes = async () => {
    try {
      const fetchedRecipes = await fetchRecipes();
      setRecipes(fetchedRecipes);
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFoodItems = async () => {
    try {
      const items = await fetchFoodItems();
      const itemsMap: {[key: string]: {singularName: string, pluralName: string}} = {};
      items.forEach(item => {
        itemsMap[item._id] = {
          singularName: item.singularName,
          pluralName: item.pluralName
        };
      });
      setFoodItems(itemsMap);
    } catch (error) {
      console.error('Error loading food items:', error);
    }
  };

  const getFoodItemName = (foodItemId: string, quantity: number): string => {
    const foodItem = foodItems[foodItemId];
    if (!foodItem) {
      return 'Unknown item';
    }
    return quantity === 1 ? foodItem.singularName : foodItem.pluralName;
  };

  const handleCreateRecipe = async () => {
    try {
      await createRecipe(newRecipe);
      setCreateDialogOpen(false);
      setNewRecipe({
        title: '',
        emoji: '',
        ingredients: [{ ingredients: [] }],
        instructions: '',
      });
      loadRecipes();
    } catch (error) {
      console.error('Error creating recipe:', error);
    }
  };

  const handleViewRecipe = async (recipe: Recipe) => {
    try {
      // Fetch the full recipe data
      const fullRecipe = await fetchRecipe(recipe._id!);
      setSelectedRecipe(fullRecipe);
      setViewDialogOpen(true);
      setEditMode(false);
    } catch (error) {
      console.error('Error loading recipe details:', error);
    }
  };

  const handleEditRecipe = () => {
    if (selectedRecipe) {
      setEditingRecipe({
        title: selectedRecipe.title,
        emoji: selectedRecipe.emoji || '',
        ingredients: selectedRecipe.ingredients,
        instructions: selectedRecipe.instructions,
      });
      setEditMode(true);
    }
  };

  const handleUpdateRecipe = async () => {
    if (!selectedRecipe?._id) return;
    
    try {
      await updateRecipe(selectedRecipe._id, editingRecipe);
      setEditMode(false);
      // Refresh the recipe data
      const updatedRecipe = await fetchRecipe(selectedRecipe._id);
      setSelectedRecipe(updatedRecipe);
      loadRecipes(); // Refresh the list
    } catch (error) {
      console.error('Error updating recipe:', error);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipe?._id) return;
    
    try {
      await deleteRecipe(selectedRecipe._id);
      setDeleteConfirmOpen(false);
      setViewDialogOpen(false);
      setSelectedRecipe(null);
      loadRecipes();
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

  const handleIngredientsChange = (ingredients: RecipeIngredientList[]) => {
    if (editMode) {
      setEditingRecipe({ ...editingRecipe, ingredients });
    } else {
      setNewRecipe({ ...newRecipe, ingredients });
    }
  };

  const handleCloseViewDialog = () => {
    setViewDialogOpen(false);
    setSelectedRecipe(null);
    setEditMode(false);
  };

  // Show loading state while session is being fetched
  if (status === "loading") {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="md">
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  // Only redirect if session is definitely not available
  if (status === "unauthenticated") {
    return null; // Will be handled by AuthenticatedLayout
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
            <Restaurant sx={{ fontSize: 40, color: "#ed6c02" }} />
            <Typography variant="h3" component="h1" sx={{ color: "#ed6c02" }}>
              Recipes
            </Typography>
          </Box>

          <Box sx={{ 
            display: "flex", 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: "space-between", 
            alignItems: { xs: 'flex-start', sm: 'center' }, 
            gap: { xs: 2, sm: 0 },
            mb: 4 
          }}>
            <Typography variant="h5" gutterBottom>
              Your Recipe Collection
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{ bgcolor: "#ed6c02", "&:hover": { bgcolor: "#e65100" } }}
            >
              Add New Recipe
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : recipes.length === 0 ? (
            <Paper elevation={1} sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No recipes yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start by adding your first recipe to build your personal cookbook.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {recipes.map((recipe) => (
                <Card 
                  key={recipe._id} 
                  sx={{ 
                    width: '100%', 
                    flexGrow: 1,
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 4,
                    }
                  }}
                  onClick={() => handleViewRecipe(recipe)}
                >
                  <CardContent sx={{ 
                    py: { xs: 2, sm: 2.5, md: 3 },
                    px: { xs: 2, sm: 2.5, md: 3 }
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: { xs: 1, sm: 1.5, md: 2 }
                    }}>
                      {recipe.emoji ? (
                        <Typography variant="h2" sx={{ 
                          fontSize: { xs: '2rem', sm: '2.5rem', md: '2.5rem' },
                          flexShrink: 0,
                          lineHeight: 1
                        }}>
                          {recipe.emoji}
                        </Typography>
                      ) : (
                        <RestaurantMenu sx={{ 
                          fontSize: { xs: 32, sm: 40, md: 40 }, 
                          color: 'text.secondary',
                          flexShrink: 0
                        }} />
                      )}
                      <Typography 
                        variant="h2" 
                        component="h2" 
                        sx={{
                          fontSize: { xs: '1.5rem', sm: '2rem', md: '2rem' },
                          lineHeight: 1.2,
                          wordBreak: 'break-word',
                          flex: 1,
                          minWidth: 0
                        }}
                      >
                        {recipe.title}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>

        {/* Create Recipe Dialog */}
        <Dialog 
          open={createDialogOpen} 
          onClose={() => setCreateDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Create New Recipe</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <TextField
                  label="Recipe Title"
                  value={newRecipe.title}
                  onChange={(e) => setNewRecipe({ ...newRecipe, title: e.target.value })}
                  fullWidth
                  required
                />
                <IconButton 
                  onClick={() => setEmojiPickerOpen(true)}
                  sx={{ 
                    border: '1px solid #ccc',
                    minWidth: 56,
                    height: 56,
                    fontSize: '1.5rem'
                  }}
                >
                  {newRecipe.emoji || <EmojiEmotions />}
                </IconButton>
              </Box>

              <Typography variant="h6" gutterBottom>
                Ingredients
              </Typography>
              <IngredientInput
                ingredients={newRecipe.ingredients}
                onChange={handleIngredientsChange}
              />

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" gutterBottom>
                Instructions
              </Typography>
              <TextField
                label="Cooking Instructions"
                value={newRecipe.instructions}
                onChange={(e) => setNewRecipe({ ...newRecipe, instructions: e.target.value })}
                multiline
                rows={6}
                fullWidth
                required
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateRecipe}
              variant="contained"
              disabled={!newRecipe.title || !newRecipe.instructions || newRecipe.ingredients[0]?.ingredients.length === 0}
            >
              Create Recipe
            </Button>
          </DialogActions>
        </Dialog>

        {/* View/Edit Recipe Dialog */}
        <Dialog 
          open={viewDialogOpen} 
          onClose={handleCloseViewDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedRecipe?.emoji && (
                  <Typography variant="h4">{selectedRecipe.emoji}</Typography>
                )}
                <Typography variant="h5">
                  {editMode ? 'Edit Recipe' : selectedRecipe?.title}
                </Typography>
              </Box>
              {!editMode && (
                <IconButton onClick={handleEditRecipe} color="primary">
                  <Edit />
                </IconButton>
              )}
            </Box>
          </DialogTitle>
          <DialogContent>
            {editMode ? (
              // Edit Mode
              <Box sx={{ pt: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <TextField
                    label="Recipe Title"
                    value={editingRecipe.title}
                    onChange={(e) => setEditingRecipe({ ...editingRecipe, title: e.target.value })}
                    fullWidth
                    required
                  />
                  <IconButton 
                    onClick={() => setEmojiPickerOpen(true)}
                    sx={{ 
                      border: '1px solid #ccc',
                      minWidth: 56,
                      height: 56,
                      fontSize: '1.5rem'
                    }}
                  >
                    {editingRecipe.emoji || <EmojiEmotions />}
                  </IconButton>
                </Box>

                <Typography variant="h6" gutterBottom>
                  Ingredients
                </Typography>
                <IngredientInput
                  ingredients={editingRecipe.ingredients || []}
                  onChange={handleIngredientsChange}
                />

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" gutterBottom>
                  Instructions
                </Typography>
                <TextField
                  label="Cooking Instructions"
                  value={editingRecipe.instructions}
                  onChange={(e) => setEditingRecipe({ ...editingRecipe, instructions: e.target.value })}
                  multiline
                  rows={6}
                  fullWidth
                  required
                />
              </Box>
            ) : (
              // View Mode
              <Box sx={{ pt: 2 }}>
                <Typography variant="h4" gutterBottom>
                  Ingredients
                </Typography>
                {selectedRecipe?.ingredients.map((list, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    {list.title && (
                      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                        {list.title}
                      </Typography>
                    )}
                    <Box component="ul" sx={{ pl: 2 }}>
                      {list.ingredients.map((ingredient, ingIndex) => (
                        <Typography key={ingIndex} component="li" variant="body1">
                          {ingredient.quantity} {ingredient.unit !== 'each' ? getUnitForm(ingredient.unit, ingredient.quantity) + ' ' : ''}{getFoodItemName(ingredient.foodItemId, ingredient.quantity)}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                ))}

                <Divider sx={{ my: 3 }} />

                <Typography variant="h4" gutterBottom>
                  Instructions
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedRecipe?.instructions}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            {editMode ? (
              <>
                <IconButton 
                  onClick={() => setDeleteConfirmOpen(true)} 
                  color="error"
                  sx={{ mr: 'auto' }}
                >
                  <Delete />
                </IconButton>
                <Button onClick={() => setEditMode(false)}>Cancel</Button>
                <Button 
                  onClick={handleUpdateRecipe}
                  variant="contained"
                  disabled={!editingRecipe.title || !editingRecipe.instructions || editingRecipe.ingredients?.[0]?.ingredients.length === 0}
                >
                  Update Recipe
                </Button>
              </>
            ) : (
              <Button onClick={handleCloseViewDialog}>Close</Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
        >
          <DialogTitle>Delete Recipe</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete &quot;{selectedRecipe?.title}&quot;? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleDeleteRecipe} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Emoji Picker */}
        <EmojiPicker
          open={emojiPickerOpen}
          onClose={() => setEmojiPickerOpen(false)}
          onSelect={handleEmojiSelect}
          currentEmoji={editMode ? editingRecipe.emoji : newRecipe.emoji}
        />
      </Container>
    </AuthenticatedLayout>
  );
} 