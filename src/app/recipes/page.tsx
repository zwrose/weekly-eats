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
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Divider,
} from "@mui/material";
import { 
  Restaurant, 
  Add, 
  Edit, 
  Delete, 
  Visibility,
  EmojiEmotions
} from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { Recipe, CreateRecipeRequest } from "../../types/recipe";
import { fetchRecipes, createRecipe, deleteRecipe } from "../../lib/recipe-utils";
import EmojiPicker from "../../components/EmojiPicker";
import IngredientInput from "../../components/IngredientInput";
import { RecipeIngredientList } from "../../types/recipe";

export default function RecipesPage() {
  const { status } = useSession();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [newRecipe, setNewRecipe] = useState<CreateRecipeRequest>({
    title: '',
    emoji: '',
    ingredients: [{ ingredients: [] }],
    instructions: '',
  });

  useEffect(() => {
    if (status === 'authenticated') {
      loadRecipes();
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

  const handleDeleteRecipe = async (id: string) => {
    if (confirm('Are you sure you want to delete this recipe?')) {
      try {
        await deleteRecipe(id);
        loadRecipes();
      } catch (error) {
        console.error('Error deleting recipe:', error);
      }
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewRecipe({ ...newRecipe, emoji });
  };

  const handleIngredientsChange = (ingredients: RecipeIngredientList[]) => {
    setNewRecipe({ ...newRecipe, ingredients });
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

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
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
                <Box key={recipe._id} sx={{ width: 'calc(33.33% - 10px)', flexGrow: 1 }}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        {recipe.emoji && (
                          <Typography variant="h4">{recipe.emoji}</Typography>
                        )}
                        <Typography variant="h6" component="h2" noWrap>
                          {recipe.title}
                        </Typography>
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {recipe.ingredients.reduce((total, list) => 
                          total + list.ingredients.length, 0
                        )} ingredients
                      </Typography>
                      
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {recipe.instructions}
                      </Typography>
                    </CardContent>
                    
                    <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
                      <Box>
                        <IconButton size="small" color="primary">
                          <Visibility />
                        </IconButton>
                        <IconButton size="small" color="primary">
                          <Edit />
                        </IconButton>
                      </Box>
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleDeleteRecipe(recipe._id!)}
                      >
                        <Delete />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Box>
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

        {/* Emoji Picker */}
        <EmojiPicker
          open={emojiPickerOpen}
          onClose={() => setEmojiPickerOpen(false)}
          onSelect={handleEmojiSelect}
          currentEmoji={newRecipe.emoji}
        />
      </Container>
    </AuthenticatedLayout>
  );
} 