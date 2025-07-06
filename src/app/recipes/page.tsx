"use client";

import { useSession } from "next-auth/react";
import { Session } from "next-auth";
import { useState, useEffect, useCallback } from "react";
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  TextField,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Chip,
} from "@mui/material";
import { 
  Restaurant, 
  Add, 
  Edit, 
  EmojiEmotions,
  Public,
  Person,
  RestaurantMenu
} from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { Recipe, CreateRecipeRequest, UpdateRecipeRequest } from "../../types/recipe";
import { fetchRecipe } from "../../lib/recipe-utils";
import EmojiPicker from "../../components/EmojiPicker";
import IngredientInput from "../../components/IngredientInput";
import { RecipeIngredientList } from "../../types/recipe";
import { fetchFoodItems, getUnitForm } from "../../lib/food-items-utils";
import { useRecipes } from '@/lib/hooks';
import { useSearchPagination, useDialog, useConfirmDialog } from '@/lib/hooks';
import Pagination from '@/components/optimized/Pagination';
import { DialogActions } from '@/components/ui/DialogActions';

export default function RecipesPage() {
  const { data: session, status } = useSession();
  const { userRecipes, globalRecipes, loading, userLoading, globalLoading, createRecipe, updateRecipe, deleteRecipe } = useRecipes();
  // Dialogs
  const createDialog = useDialog();
  const viewDialog = useDialog();
  const deleteConfirmDialog = useConfirmDialog();
  const emojiPickerDialog = useDialog();
  // Selected recipe state
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  // New/edit recipe state (keep as local state)
  const [newRecipe, setNewRecipe] = useState<CreateRecipeRequest>({
    title: '',
    emoji: '',
    ingredients: [{ ingredients: [] }],
    instructions: '',
    isGlobal: false,
  });
  const [editingRecipe, setEditingRecipe] = useState<UpdateRecipeRequest>({
    title: '',
    emoji: '',
    ingredients: [{ ingredients: [] }],
    instructions: '',
    isGlobal: false,
  });
  // Food items state (keep as local state)
  const [foodItems, setFoodItems] = useState<{[key: string]: {singularName: string, pluralName: string}}>({});
  const [foodItemsList, setFoodItemsList] = useState<Array<{_id: string, name: string, singularName: string, pluralName: string, unit: string}>>([]);
  // Search and pagination
  const userPagination = useSearchPagination({
    data: userRecipes,
    itemsPerPage: 25,
    searchFields: ['title']
  });
  const globalPagination = useSearchPagination({
    data: globalRecipes,
    itemsPerPage: 25,
    searchFields: ['title']
  });
  const [editMode, setEditMode] = useState(false);

  const itemsPerPage = 25;

  const loadUserRecipes = useCallback(async () => {
    try {
      // ... your user recipe loading logic ...
    } catch (error) {
      console.error('Error loading user recipes:', error);
    }
  }, []);

  const loadGlobalRecipes = useCallback(async () => {
    try {
      // ... your global recipe loading logic ...
    } catch (error) {
      console.error('Error loading global recipes:', error);
    }
  }, []);

  const loadRecipes = useCallback(async () => {
    try {
      await Promise.all([
        loadUserRecipes(),
        loadGlobalRecipes()
      ]);
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  }, [loadUserRecipes, loadGlobalRecipes]);

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
      setFoodItemsList(items);
    } catch (error) {
      console.error('Error loading food items:', error);
    }
  };

  const handleFoodItemAdded = (newFoodItem: {_id: string, name: string, singularName: string, pluralName: string, unit: string}) => {
    // Update both the map and the list
    setFoodItems(prev => ({
      ...prev,
      [newFoodItem._id]: {
        singularName: newFoodItem.singularName,
        pluralName: newFoodItem.pluralName
      }
    }));
    setFoodItemsList(prev => [...prev, newFoodItem]);
  };

  useEffect(() => {
    if (status === 'authenticated') {
      loadRecipes();
      loadFoodItems();
    }
  }, [status, loadRecipes]);

  // Filter recipes based on search term
  const filteredUserRecipes = userRecipes.filter(recipe =>
    recipe.title.toLowerCase().includes(userPagination.searchTerm.toLowerCase())
  );

  const filteredGlobalRecipes = globalRecipes.filter(recipe =>
    recipe.title.toLowerCase().includes(globalPagination.searchTerm.toLowerCase())
  );

  // Pagination
  const paginatedUserRecipes = filteredUserRecipes.slice(
    (userPagination.currentPage - 1) * itemsPerPage,
    userPagination.currentPage * itemsPerPage
  );

  const paginatedGlobalRecipes = filteredGlobalRecipes.slice(
    (globalPagination.currentPage - 1) * itemsPerPage,
    globalPagination.currentPage * itemsPerPage
  );

  // Reset pagination when search term changes
  useEffect(() => {
    userPagination.setCurrentPage(1);
    globalPagination.setCurrentPage(1);
  }, [userPagination, globalPagination]);

  const getIngredientName = (ingredient: { type: 'foodItem' | 'recipe'; id: string; quantity: number }): string => {
    if (ingredient.type === 'foodItem') {
      const foodItem = foodItems[ingredient.id];
      if (!foodItem) {
        return 'Unknown food item';
      }
      return ingredient.quantity === 1 ? foodItem.singularName : foodItem.pluralName;
    } else {
      // For recipes, we need to find the recipe in our lists
      const recipe = [...userRecipes, ...globalRecipes].find(r => r._id === ingredient.id);
      return recipe ? recipe.title : 'Unknown recipe';
    }
  };

  const handleCreateRecipe = async () => {
    try {
      const filteredRecipe = {
        ...newRecipe,
        ingredients: filterBlankIngredients(newRecipe.ingredients)
      };
      await createRecipe(filteredRecipe);
      createDialog.closeDialog();
      setNewRecipe({
        title: '',
        emoji: '',
        ingredients: [{ ingredients: [] }],
        instructions: '',
        isGlobal: false,
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
      viewDialog.openDialog();
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
        isGlobal: selectedRecipe.isGlobal,
      });
      setEditMode(true);
    }
  };

  const handleUpdateRecipe = async () => {
    if (!selectedRecipe?._id) return;
    
    try {
      const filteredRecipe = {
        ...editingRecipe,
        ingredients: filterBlankIngredients(editingRecipe.ingredients || [])
      };
      await updateRecipe(selectedRecipe._id, filteredRecipe);
      // Refresh the recipe data
      const updatedRecipe = await fetchRecipe(selectedRecipe._id);
      setSelectedRecipe(updatedRecipe);
      loadRecipes(); // Refresh the lists
      // Close the dialog and exit edit mode
      setEditMode(false);
      viewDialog.closeDialog();
    } catch (error) {
      console.error('Error updating recipe:', error);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipe?._id) return;
    
    try {
      await deleteRecipe(selectedRecipe._id);
      deleteConfirmDialog.closeDialog();
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

  // Filter out blank ingredients before saving
  const filterBlankIngredients = (ingredients: RecipeIngredientList[]) => {
    return ingredients.map(list => ({
      ...list,
      ingredients: list.ingredients.filter(ingredient => ingredient.id && ingredient.id.trim() !== '')
    }));
  };

  const handleIngredientsChange = (ingredients: RecipeIngredientList[]) => {
    if (editMode) {
      setEditingRecipe({ ...editingRecipe, ingredients });
    } else {
      setNewRecipe({ ...newRecipe, ingredients });
    }
  };

  const handleCloseViewDialog = () => {
    viewDialog.closeDialog();
    setSelectedRecipe(null);
    setEditMode(false);
  };

  // Helper function to check if all ingredient groups have at least one ingredient
  const hasValidIngredients = (ingredients: RecipeIngredientList[]) => {
    return ingredients.length > 0 && ingredients.every(group => 
      group.ingredients && group.ingredients.length > 0
    );
  };

  // Check if user can edit a recipe (only the creator can edit)
  const canEditRecipe = (recipe: Recipe) => {
    return recipe.createdBy === (session?.user as Session['user'])?.id;
  };

  // Show loading state while session is being fetched
  if (status === "loading") {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="xl">
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
      <Container maxWidth="xl">
        <Box sx={{ py: { xs: 2, md: 4 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: { xs: 2, md: 4 } }}>
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
            mb: { xs: 2, md: 4 } 
          }}>
            <Typography variant="h5" gutterBottom>
              Recipe Collection
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<Add />}
              onClick={() => createDialog.openDialog()}
              sx={{ bgcolor: "#ed6c02", "&:hover": { bgcolor: "#e65100" } }}
            >
              Add New Recipe
            </Button>
          </Box>

          <Paper sx={{ p: 3, mb: 4 }}>
            {/* Search Bar */}
            <Box sx={{ mb: 4 }}>
              <TextField
                fullWidth
                value={userPagination.searchTerm}
                onChange={(e) => userPagination.setSearchTerm(e.target.value)}
                placeholder="Start typing to filter recipes by title..."
                autoComplete="off"
              />
          </Box>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
            ) : (
              <>
                {/* User Recipes Section */}
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between', 
                    alignItems: { xs: 'flex-start', sm: 'center' }, 
                    gap: { xs: 1, sm: 0 },
                    mb: 2 
                  }}>
                    <Typography variant="h6" gutterBottom>
                      <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Your Recipes ({filteredUserRecipes.length})
              </Typography>
                    {userLoading && <CircularProgress size={20} />}
                  </Box>
                  
                  {filteredUserRecipes.length > 0 ? (
                    <>
                      {/* Desktop Table View */}
                      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ width: '65%', fontWeight: 'bold' }}>Recipe</TableCell>
                                <TableCell sx={{ width: '20%', fontWeight: 'bold' }}>Access Level</TableCell>
                                <TableCell sx={{ width: '15%', fontWeight: 'bold' }}>Updated</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {paginatedUserRecipes.map((recipe) => (
                                <TableRow 
                                  key={recipe._id}
                                  onClick={() => handleViewRecipe(recipe)}
                                  sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                >
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      {recipe.emoji ? (
                                        <Typography variant="h6">{recipe.emoji}</Typography>
                                      ) : (
                                        <RestaurantMenu sx={{ fontSize: 24, color: 'text.secondary' }} />
                                      )}
                                      <Typography variant="body1">{recipe.title}</Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    {recipe.isGlobal ? (
                                      <Chip 
                                        label="Global" 
                                        size="small" 
                                        color="primary" 
                                        variant="outlined"
                                        icon={<Public fontSize="small" />}
                                      />
                                    ) : (
                                      <Chip 
                                        label="Personal" 
                                        size="small" 
                                        color="default" 
                                        variant="outlined"
                                        icon={<Person fontSize="small" />}
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {new Date(recipe.updatedAt).toLocaleDateString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>

                      {/* Mobile Card View */}
                      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                        {paginatedUserRecipes.map((recipe) => (
                          <Paper
                            key={recipe._id}
                            onClick={() => handleViewRecipe(recipe)}
                            sx={{
                              p: 3,
                              mb: 2,
                              cursor: 'pointer',
                              '&:hover': { 
                                backgroundColor: 'action.hover',
                                transform: 'translateY(-2px)',
                                boxShadow: 4
                              },
                              transition: 'all 0.2s ease-in-out',
                              boxShadow: 2,
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 2
                            }}
                          >
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 2 }}>
                              <Box sx={{ mb: 1 }}>
                                {recipe.emoji ? (
                          <Typography variant="h4">{recipe.emoji}</Typography>
                                ) : (
                                  <RestaurantMenu sx={{ fontSize: 32, color: 'text.secondary' }} />
                        )}
                              </Box>
                              <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                          {recipe.title}
                        </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box>
                                {recipe.isGlobal ? (
                                  <Chip 
                                    label="Global" 
                                    size="small" 
                                    color="primary" 
                                    variant="outlined"
                                    icon={<Public fontSize="small" />}
                                  />
                                ) : (
                                  <Chip 
                                    label="Personal" 
                                    size="small" 
                                    color="default" 
                                    variant="outlined"
                                    icon={<Person fontSize="small" />}
                                  />
                                )}
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                Updated: {new Date(recipe.updatedAt).toLocaleDateString()}
                              </Typography>
                            </Box>
                          </Paper>
                        ))}
                      </Box>
                      
                      {filteredUserRecipes.length > itemsPerPage && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                          <Pagination
                            count={Math.ceil(filteredUserRecipes.length / itemsPerPage)}
                            page={userPagination.currentPage}
                            onChange={userPagination.setCurrentPage}
                          />
                        </Box>
                      )}
                    </>
                  ) : (
                    <Alert severity="info">
                      {userPagination.searchTerm ? 'No user recipes match your search criteria' : 'No user recipes found'}
                    </Alert>
                  )}
                </Box>

                {/* Global Recipes Section */}
                <Box>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between', 
                    alignItems: { xs: 'flex-start', sm: 'center' }, 
                    gap: { xs: 1, sm: 0 },
                    mb: 2 
                  }}>
                    <Typography variant="h6" gutterBottom>
                      <Public sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Global Recipes ({filteredGlobalRecipes.length})
                      </Typography>
                    {globalLoading && <CircularProgress size={20} />}
                  </Box>
                  
                  {filteredGlobalRecipes.length > 0 ? (
                    <>
                      {/* Desktop Table View */}
                      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ width: '65%', fontWeight: 'bold' }}>Recipe</TableCell>
                                <TableCell sx={{ width: '20%', fontWeight: 'bold' }}>Access Level</TableCell>
                                <TableCell sx={{ width: '15%', fontWeight: 'bold' }}>Updated</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {paginatedGlobalRecipes.map((recipe) => (
                                <TableRow 
                                  key={recipe._id}
                                  onClick={() => handleViewRecipe(recipe)}
                                  sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                >
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      {recipe.emoji ? (
                                        <Typography variant="h6">{recipe.emoji}</Typography>
                                      ) : (
                                        <RestaurantMenu sx={{ fontSize: 24, color: 'text.secondary' }} />
                                      )}
                                      <Typography variant="body1">{recipe.title}</Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    <Chip 
                                      label="Global" 
                                      size="small" 
                                      color="primary" 
                                      variant="outlined"
                                      icon={<Public fontSize="small" />}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {new Date(recipe.updatedAt).toLocaleDateString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>

                      {/* Mobile Card View */}
                      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                        {paginatedGlobalRecipes.map((recipe) => (
                          <Paper
                            key={recipe._id}
                            onClick={() => handleViewRecipe(recipe)}
                        sx={{
                              p: 3,
                              mb: 2,
                              cursor: 'pointer',
                              '&:hover': { 
                                backgroundColor: 'action.hover',
                                transform: 'translateY(-2px)',
                                boxShadow: 4
                              },
                              transition: 'all 0.2s ease-in-out',
                              boxShadow: 2,
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 2
                            }}
                          >
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 2 }}>
                              <Box sx={{ mb: 1 }}>
                                {recipe.emoji ? (
                                  <Typography variant="h4">{recipe.emoji}</Typography>
                                ) : (
                                  <RestaurantMenu sx={{ fontSize: 32, color: 'text.secondary' }} />
                                )}
                              </Box>
                              <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                                {recipe.title}
                      </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                                <Chip 
                                  label="Global" 
                                  size="small" 
                                  color="primary" 
                                  variant="outlined"
                                  icon={<Public fontSize="small" />}
                                />
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                Updated: {new Date(recipe.updatedAt).toLocaleDateString()}
                              </Typography>
                            </Box>
                          </Paper>
                        ))}
                      </Box>
                      
                      {filteredGlobalRecipes.length > itemsPerPage && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                          <Pagination
                            count={Math.ceil(filteredGlobalRecipes.length / itemsPerPage)}
                            page={globalPagination.currentPage}
                            onChange={globalPagination.setCurrentPage}
                          />
                        </Box>
                      )}
                    </>
                  ) : (
                    <Alert severity="info">
                      {globalPagination.searchTerm ? 'No global recipes match your search criteria' : 'No global recipes found'}
                    </Alert>
                  )}
                </Box>
              </>
          )}
          </Paper>
        </Box>

        {/* Create Recipe Dialog */}
        <Dialog 
          open={createDialog.open} 
          onClose={() => createDialog.closeDialog()}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>Create New Recipe</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Box sx={{ 
                display: 'flex', 
                gap: 2, 
                mb: 3,
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'flex-start' }
              }}>
                <IconButton 
                  onClick={() => emojiPickerDialog.openDialog()}
                  sx={{ 
                    border: '1px solid #ccc',
                    width: { xs: 56, sm: 56 },
                    height: { xs: 56, sm: 56 },
                    fontSize: '1.5rem',
                    alignSelf: { xs: 'flex-start', sm: 'flex-start' }
                  }}
                >
                  {newRecipe.emoji || <EmojiEmotions />}
                </IconButton>
                <TextField
                  label="Recipe Title"
                  value={newRecipe.title}
                  onChange={(e) => setNewRecipe({ ...newRecipe, title: e.target.value })}
                  fullWidth
                  required
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Access Level
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant={newRecipe.isGlobal ? "outlined" : "contained"}
                    onClick={() => setNewRecipe({ ...newRecipe, isGlobal: false })}
                    startIcon={<Person />}
                  >
                    Personal (only visible to you)
                  </Button>
                  <Button
                    variant={newRecipe.isGlobal ? "contained" : "outlined"}
                    onClick={() => setNewRecipe({ ...newRecipe, isGlobal: true })}
                    startIcon={<Public />}
                  >
                    Global (visible to all users)
                  </Button>
                </Box>
              </Box>

              <Typography variant="h6" gutterBottom>
                Ingredients
              </Typography>
              <IngredientInput
                ingredients={newRecipe.ingredients}
                onChange={handleIngredientsChange}
                foodItems={foodItemsList}
                onFoodItemAdded={handleFoodItemAdded}
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

          <DialogActions>
                <Button 
                  onClick={() => createDialog.closeDialog()}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
            <Button 
              onClick={handleCreateRecipe}
              variant="contained"
                  disabled={!newRecipe.title || !newRecipe.instructions || !hasValidIngredients(newRecipe.ingredients)}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Create Recipe
            </Button>
          </DialogActions>
            </Box>
          </DialogContent>
        </Dialog>

        {/* View/Edit Recipe Dialog */}
        <Dialog 
          open={viewDialog.open} 
          onClose={handleCloseViewDialog}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedRecipe?.emoji && (
                  <Typography variant="h4">{selectedRecipe.emoji}</Typography>
                )}
                <Typography variant="h5">
                  {selectedRecipe?.title}
                </Typography>
              </Box>
              {selectedRecipe && canEditRecipe(selectedRecipe) && !editMode && (
                <IconButton onClick={handleEditRecipe} color="primary">
                  <Edit />
                </IconButton>
              )}
            </Box>
          </DialogTitle>
          <DialogContent>
            {editMode ? (
              <Box sx={{ pt: 2 }}>
                <Box sx={{ 
                  display: 'flex', 
                  gap: 2, 
                  mb: 3,
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'flex-start' }
                }}>
                  <IconButton 
                    onClick={() => emojiPickerDialog.openDialog()}
                    sx={{ 
                      border: '1px solid #ccc',
                      width: { xs: 56, sm: 56 },
                      height: { xs: 56, sm: 56 },
                      fontSize: '1.5rem',
                      alignSelf: { xs: 'flex-start', sm: 'flex-start' }
                    }}
                  >
                    {editingRecipe.emoji || <EmojiEmotions />}
                  </IconButton>
                  <TextField
                    label="Recipe Title"
                    value={editingRecipe.title}
                    onChange={(e) => setEditingRecipe({ ...editingRecipe, title: e.target.value })}
                    fullWidth
                    required
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Access Level
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant={editingRecipe.isGlobal ? "outlined" : "contained"}
                      onClick={() => setEditingRecipe({ ...editingRecipe, isGlobal: false })}
                      startIcon={<Person />}
                    >
                      Personal (only visible to you)
                    </Button>
                    <Button
                      variant={editingRecipe.isGlobal ? "contained" : "outlined"}
                      onClick={() => setEditingRecipe({ ...editingRecipe, isGlobal: true })}
                      startIcon={<Public />}
                    >
                      Global (visible to all users)
                    </Button>
                  </Box>
                </Box>

                <Typography variant="h6" gutterBottom>
                  Ingredients
                </Typography>
                <IngredientInput
                  ingredients={editingRecipe.ingredients || []}
                  onChange={handleIngredientsChange}
                  foodItems={foodItemsList}
                  onFoodItemAdded={handleFoodItemAdded}
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

                <DialogActions>
                  <Button 
                    onClick={() => setEditMode(false)}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpdateRecipe}
                    variant="contained"
                    disabled={!editingRecipe.title || !editingRecipe.instructions || !hasValidIngredients(editingRecipe.ingredients || [])}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Update Recipe
                  </Button>
                </DialogActions>
              </Box>
            ) : (
              <Box sx={{ pt: 2 }}>
                <Box sx={{ 
                  display: 'flex', 
                  gap: 3,
                  flexDirection: { xs: 'column', md: 'row' },
                  minHeight: { xs: 'auto', md: '40vh' },
                  maxHeight: { xs: 'none', md: '60vh' }
                }}>
                  {/* Ingredients Section */}
                  <Box sx={{ 
                    flex: { xs: 'none', md: '0 0 35%' },
                    maxHeight: { xs: 'none', md: '100%' },
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <Typography variant="h5" gutterBottom>
                      Ingredients
                    </Typography>
                    <Box sx={{ 
                      flex: 1,
                      overflow: 'auto',
                      pr: 1
                    }}>
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
                                {ingredient.quantity} {ingredient.unit && ingredient.unit !== 'each' ? getUnitForm(ingredient.unit, ingredient.quantity) + ' ' : ''}{getIngredientName(ingredient)}
                              </Typography>
                            ))}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  {/* Instructions Section */}
                  <Box sx={{ 
                    flex: { xs: 'none', md: '0 0 65%' },
                    maxHeight: { xs: 'none', md: '100%' },
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <Typography variant="h5" gutterBottom>
                      Instructions
                    </Typography>
                    <Box sx={{ 
                      flex: 1,
                      overflow: 'auto',
                      pr: 1
                    }}>
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                        {selectedRecipe?.instructions}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmDialog.open}
          onClose={() => deleteConfirmDialog.closeDialog()}
        >
          <DialogTitle>Delete Recipe</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete &quot;{selectedRecipe?.title}&quot;? This action cannot be undone.
            </DialogContentText>
            
            <DialogActions>
              <Button 
                onClick={() => deleteConfirmDialog.closeDialog()}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleDeleteRecipe} 
                color="error" 
                variant="contained"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
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
          currentEmoji={selectedRecipe?.emoji || newRecipe.emoji}
        />
      </Container>
    </AuthenticatedLayout>
  );
} 