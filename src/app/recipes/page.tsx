"use client";

import { useSession } from "next-auth/react";
import { Session } from "next-auth";
import { useState, useEffect, useCallback, Suspense } from "react";
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Paper,
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Chip,
  Snackbar,
  Badge,
} from "@mui/material";
import {
  Restaurant,
  Add,
  Public,
  Person,
  RestaurantMenu,
  Share,
  Star,
} from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import {
  Recipe,
  CreateRecipeRequest,
  UpdateRecipeRequest,
} from "../../types/recipe";
import { fetchRecipe } from "../../lib/recipe-utils";
import dynamic from "next/dynamic";
const EmojiPicker = dynamic(() => import("../../components/EmojiPicker"), { ssr: false });
const RecipeViewDialog = dynamic(() => import("@/components/RecipeViewDialog"), { ssr: false });
const RecipeEditorDialog = dynamic(() => import("@/components/RecipeEditorDialog"), { ssr: false });
const RecipeSharingSection = dynamic(() => import("@/components/RecipeSharingSection"), { ssr: false });
import { RecipeIngredientList } from "../../types/recipe";
import { fetchFoodItems } from "../../lib/food-items-utils";
import { useRecipes } from "@/lib/hooks";
import {
  useSearchPagination,
  useDialog,
  useConfirmDialog,
  usePersistentDialog,
} from "@/lib/hooks";
import { responsiveDialogStyle } from "@/lib/theme";
import Pagination from "@/components/optimized/Pagination";
import SearchBar from "@/components/optimized/SearchBar";
import { DialogActions, DialogTitle } from "@/components/ui";
import {
  inviteUserToRecipeSharing,
  respondToRecipeSharingInvitation,
  removeUserFromRecipeSharing,
  fetchPendingRecipeSharingInvitations,
  fetchSharedRecipeUsers,
  PendingRecipeInvitation,
  SharedUser,
} from "@/lib/recipe-sharing-utils";
import {
  fetchRecipeUserData,
  fetchRecipeUserDataBatch,
  updateRecipeTags,
  updateRecipeRating,
  deleteRecipeRating,
} from "@/lib/recipe-user-data-utils";

import { RecipeUserDataResponse } from "@/types/recipe-user-data";

// ── Module-level sx constants (hoisted to avoid per-render allocations) ──

const sectionHeaderSx = {
  display: "flex",
  flexDirection: { xs: "column", sm: "row" },
  justifyContent: "space-between",
  alignItems: { xs: "flex-start", sm: "center" },
  gap: { xs: 1, sm: 0 },
  mb: 2,
} as const;

const tableRowHoverSx = {
  cursor: "pointer",
  "&:hover": { backgroundColor: "action.hover" },
} as const;

const recipeTitleFlexSx = {
  display: "flex",
  alignItems: "center",
  gap: 1,
} as const;

const recipeIconSmallSx = { fontSize: 24, color: "text.secondary" } as const;
const recipeIconLargeSx = { fontSize: 32, color: "text.secondary" } as const;

const tagContainerDesktopSx = {
  display: "flex",
  flexWrap: "wrap",
  gap: 0.5,
  justifyContent: "center",
} as const;

const tagContainerMobileSx = {
  display: "flex",
  flexWrap: "wrap",
  gap: 0.5,
  mb: 1,
} as const;

const chipDesktopSx = { fontSize: "0.7rem", height: 20 } as const;
const chipMobileSx = { fontSize: "0.75rem" } as const;

const ratingDesktopSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 0.25,
} as const;

const ratingMobileSx = {
  display: "flex",
  alignItems: "center",
  gap: 0.5,
} as const;

const mobileCardSx = {
  p: 3,
  mb: 2,
  cursor: "pointer",
  "&:hover": {
    backgroundColor: "action.hover",
    transform: "translateY(-2px)",
    boxShadow: 4,
  },
  transition: "all 0.2s ease-in-out",
  boxShadow: 2,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 2,
} as const;

const mobileCardTitleSx = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  mb: 2,
} as const;

const mobileCardFooterSx = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
} as const;

const paginationContainerSx = {
  display: "flex",
  justifyContent: "center",
  mt: 2,
} as const;

const centeredLoadingSx = {
  display: "flex",
  justifyContent: "center",
  py: 4,
} as const;

const tableHeaderCellSx = (width: string) => ({
  width,
  fontWeight: "bold",
  wordWrap: "break-word",
}) as const;

function RecipesPageContent() {
  const { data: session, status } = useSession();
  const {
    userRecipes,
    globalRecipes,
    loading,
    userLoading,
    globalLoading,
    createRecipe,
    updateRecipe,
    deleteRecipe,
  } = useRecipes();
  // Dialogs
  const createDialog = useDialog();
  const viewDialog = usePersistentDialog("viewRecipe");
  const deleteConfirmDialog = useConfirmDialog();
  const emojiPickerDialog = useDialog();
  const shareDialog = useDialog();
  // Selected recipe state
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  // Recipe user data state
  const [recipeUserData, setRecipeUserData] = useState<RecipeUserDataResponse | null>(null);
  // User data for all recipes (for list display)
  const [recipesUserData, setRecipesUserData] = useState<Map<string, RecipeUserDataResponse>>(new Map());
  // Sharing state
  const [pendingRecipeInvitations, setPendingRecipeInvitations] = useState<PendingRecipeInvitation[]>([]);
  const [sharedRecipeUsers, setSharedRecipeUsers] = useState<SharedUser[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [shareTags, setShareTags] = useState(true);
  const [shareRatings, setShareRatings] = useState(true);
  // Auto-focus refs for dialog inputs


  // Snackbar state
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  
  // Extract userId for dependency tracking
  const userId = (session?.user as { id?: string })?.id;
  
  // New/edit recipe state (keep as local state)
  const [newRecipe, setNewRecipe] = useState<CreateRecipeRequest>({
    title: "",
    emoji: "",
    ingredients: [{ title: "", ingredients: [], isStandalone: true }],
    instructions: "",
    isGlobal: true,
  });
  const [editingRecipe, setEditingRecipe] = useState<UpdateRecipeRequest>({
    title: "",
    emoji: "",
    ingredients: [{ title: "", ingredients: [], isStandalone: true }],
    instructions: "",
    isGlobal: false,
  });
  // Food items state (keep as local state)
  const [foodItems, setFoodItems] = useState<{
    [key: string]: { singularName: string; pluralName: string };
  }>({});
  const [foodItemsList, setFoodItemsList] = useState<
    Array<{
      _id: string;
      name: string;
      singularName: string;
      pluralName: string;
      unit: string;
    }>
  >([]);
  // Search and pagination
  const userPagination = useSearchPagination({
    data: userRecipes,
    itemsPerPage: 25,
    searchFields: ["title"],
  });
  const globalPagination = useSearchPagination({
    data: globalRecipes,
    itemsPerPage: 25,
    searchFields: ["title"],
  });
  const [editMode, setEditMode] = useState(false);

  const itemsPerPage = 25;

  const loadUserRecipes = useCallback(async () => {
    try {
      // ... your user recipe loading logic ...
    } catch (error) {
      console.error("Error loading user recipes:", error);
    }
  }, []);

  const loadGlobalRecipes = useCallback(async () => {
    try {
      // ... your global recipe loading logic ...
    } catch (error) {
      console.error("Error loading global recipes:", error);
    }
  }, []);

  const loadRecipes = useCallback(async () => {
    try {
      await Promise.all([loadUserRecipes(), loadGlobalRecipes()]);
    } catch (error) {
      console.error("Error loading recipes:", error);
    }
  }, [loadUserRecipes, loadGlobalRecipes]);

  const loadFoodItems = async () => {
    try {
      const items = await fetchFoodItems();
      const itemsMap: {
        [key: string]: { singularName: string; pluralName: string };
      } = {};
      items.forEach((item) => {
        itemsMap[item._id] = {
          singularName: item.singularName,
          pluralName: item.pluralName,
        };
      });
      setFoodItems(itemsMap);
      setFoodItemsList(items);
    } catch (error) {
      console.error("Error loading food items:", error);
    }
  };

  const handleFoodItemAdded = async (newFoodItem: {
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
  }) => {
    // For now, we'll need to create the food item via API and get the _id
    // This is a simplified version - in practice you'd want to handle the API call properly
    const foodItemWithId = {
      _id: `temp-${Date.now()}`, // This should come from the API response
      ...newFoodItem,
    };

    // Update both the map and the list
    setFoodItems((prev) => ({
      ...prev,
      [foodItemWithId._id]: {
        singularName: newFoodItem.singularName,
        pluralName: newFoodItem.pluralName,
      },
    }));
    setFoodItemsList((prev) => [...prev, foodItemWithId]);
  };

  // Load sharing data
  const loadSharingData = useCallback(async () => {
    try {
      const [pendingInvites, sharedUsers] = await Promise.all([
        fetchPendingRecipeSharingInvitations(),
        fetchSharedRecipeUsers(),
      ]);
      setPendingRecipeInvitations(pendingInvites);
      setSharedRecipeUsers(sharedUsers);
    } catch (error) {
      console.error('Error loading sharing data:', error);
    }
  }, []);

  // Load user data for all recipes in a single batch request
  const loadRecipesUserData = useCallback(async () => {
    if (!userId) return;

    const allRecipes = [...userRecipes, ...globalRecipes];
    if (allRecipes.length === 0) return;

    try {
      const recipeIds = allRecipes
        .map((recipe) => recipe._id)
        .filter((id): id is string => !!id);
      const userDataMap = await fetchRecipeUserDataBatch(recipeIds);
      setRecipesUserData(userDataMap);
    } catch (error) {
      console.error('Error loading recipes user data:', error);
    }
  }, [userRecipes, globalRecipes, userId]);

  // Load user data when recipes change
  useEffect(() => {
    if (status === "authenticated" && (userRecipes.length > 0 || globalRecipes.length > 0)) {
      loadRecipesUserData();
    }
  }, [status, userRecipes, globalRecipes, loadRecipesUserData]);

  useEffect(() => {
    if (status === "authenticated") {
      loadRecipes();
      loadFoodItems();
      loadSharingData();
    }
  }, [status, loadRecipes, loadSharingData]);

  // Filter recipes based on search term
  const filteredUserRecipes = userRecipes.filter((recipe) =>
    recipe.title.toLowerCase().includes(userPagination.searchTerm.toLowerCase())
  );

  const filteredGlobalRecipes = globalRecipes.filter((recipe) =>
    recipe.title
      .toLowerCase()
      .includes(globalPagination.searchTerm.toLowerCase())
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

  const getIngredientName = (ingredient: {
    type: "foodItem" | "recipe";
    id: string;
    quantity: number;
  }): string => {
    if (ingredient.type === "foodItem") {
      const foodItem = foodItems[ingredient.id];
      if (!foodItem) {
        return "Unknown food item";
      }
      return ingredient.quantity === 1
        ? foodItem.singularName
        : foodItem.pluralName;
    } else {
      // For recipes, we need to find the recipe in our lists
      const recipe = [...userRecipes, ...globalRecipes].find(
        (r) => r._id === ingredient.id
      );
      return recipe ? recipe.title : "Unknown recipe";
    }
  };

  const handleCreateRecipe = async () => {
    try {
      const filteredRecipe = {
        ...newRecipe,
        ingredients: filterBlankIngredients(newRecipe.ingredients),
      };
      await createRecipe(filteredRecipe);
      createDialog.closeDialog();
      setNewRecipe({
        title: "",
        emoji: "",
        ingredients: [{ title: "", ingredients: [], isStandalone: true }],
        instructions: "",
        isGlobal: true,
      });
      loadRecipes();
    } catch (error) {
      console.error("Error creating recipe:", error);
    }
  };

  const handleViewRecipe = useCallback(
    async (recipe: Recipe) => {
      try {
        // Fetch the full recipe data
        const fullRecipe = await fetchRecipe(recipe._id!);
        setSelectedRecipe(fullRecipe);
        viewDialog.openDialog({ recipeId: recipe._id! });
        // Load user data for this recipe
        try {
          const userData = await fetchRecipeUserData(recipe._id!);
          setRecipeUserData(userData);
        } catch (error) {
          console.error("Error loading recipe user data:", error);
          setRecipeUserData({ tags: [], rating: undefined });
        }
      } catch (error) {
        console.error("Error loading recipe details:", error);
      }
    },
    [viewDialog]
  );

  // Handle persistent dialog data
  useEffect(() => {
    if (viewDialog.open && viewDialog.data?.recipeId && !selectedRecipe) {
      // Find the recipe in our loaded data
      const recipe = [...userRecipes, ...globalRecipes].find(
        (r) => r._id === viewDialog.data?.recipeId
      );
      if (recipe) {
        handleViewRecipe(recipe);
      }
    }

    // Handle edit mode persistence
    if (
      viewDialog.open &&
      viewDialog.data?.editMode === "true" &&
      selectedRecipe &&
      !editMode
    ) {
      setEditMode(true);
      setEditingRecipe({
        title: selectedRecipe.title,
        emoji: selectedRecipe.emoji || "",
        ingredients: selectedRecipe.ingredients,
        instructions: selectedRecipe.instructions,
        isGlobal: selectedRecipe.isGlobal,
      });
    }
  }, [
    viewDialog.open,
    viewDialog.data,
    selectedRecipe,
    userRecipes,
    globalRecipes,
    editMode,
    handleViewRecipe,
  ]);

  const handleEditRecipe = async () => {
    if (!selectedRecipe?._id) return;
    
    setEditingRecipe({
      title: selectedRecipe.title,
      emoji: selectedRecipe.emoji || "",
      ingredients: selectedRecipe.ingredients,
      instructions: selectedRecipe.instructions,
      isGlobal: selectedRecipe.isGlobal,
    });
    setEditMode(true);
    // Update URL to include edit mode
    viewDialog.openDialog({
      recipeId: selectedRecipe._id!,
      editMode: "true",
    });
    
    // Load user data for editing
    try {
      const userData = await fetchRecipeUserData(selectedRecipe._id);
      setRecipeUserData(userData);
    } catch (error) {
      console.error("Error loading recipe user data:", error);
      setRecipeUserData({ tags: [], rating: undefined });
    }
  };

  const handleUpdateRecipe = async () => {
    if (!selectedRecipe?._id) return;

    try {
      const filteredRecipe = {
        ...editingRecipe,
        ingredients: filterBlankIngredients(editingRecipe.ingredients || []),
      };
      await updateRecipe(selectedRecipe._id, filteredRecipe);
      // Refresh the recipe data
      const updatedRecipe = await fetchRecipe(selectedRecipe._id);
      setSelectedRecipe(updatedRecipe);
      loadRecipes(); // Refresh the lists
      // Exit edit mode but keep dialog open in view mode
      setEditMode(false);
      viewDialog.openDialog({ recipeId: selectedRecipe._id });
    } catch (error) {
      console.error("Error updating recipe:", error);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipe?._id) return;

    try {
      await deleteRecipe(selectedRecipe._id);
      deleteConfirmDialog.closeDialog();
      viewDialog.closeDialog();
      setSelectedRecipe(null);
      setEditMode(false);
      loadRecipes();
    } catch (error) {
      console.error("Error deleting recipe:", error);
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
    return ingredients.map((list) => ({
      ...list,
      ingredients: list.ingredients.filter(
        (ingredient) => ingredient.id && ingredient.id.trim() !== ""
      ),
    }));
  };

  const handleIngredientsChange = (ingredients: RecipeIngredientList[]) => {
    if (editMode) {
      setEditingRecipe({ ...editingRecipe, ingredients });
    } else {
      setNewRecipe({ ...newRecipe, ingredients });
    }
  };

  // Sharing handlers
  const handleInviteUser = async () => {
    if (!shareEmail.trim()) return;
    if (!shareTags && !shareRatings) {
      showSnackbar('Please select at least one sharing type (tags or ratings)', 'error');
      return;
    }
    
    try {
      const sharingTypes: ('tags' | 'ratings')[] = [];
      if (shareTags) sharingTypes.push('tags');
      if (shareRatings) sharingTypes.push('ratings');
      
      await inviteUserToRecipeSharing(shareEmail.trim(), sharingTypes);
      setShareEmail("");
      showSnackbar(`Invitation sent to ${shareEmail}`, 'success');
      loadSharingData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to invite user';
      showSnackbar(message, 'error');
    }
  };

  const handleAcceptRecipeInvitation = async (userId: string) => {
    try {
      await respondToRecipeSharingInvitation(userId, 'accept');
      showSnackbar('Invitation accepted', 'success');
      loadSharingData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to accept invitation';
      showSnackbar(message, 'error');
    }
  };

  const handleRejectRecipeInvitation = async (userId: string) => {
    try {
      await respondToRecipeSharingInvitation(userId, 'reject');
      showSnackbar('Invitation rejected', 'success');
      loadSharingData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject invitation';
      showSnackbar(message, 'error');
    }
  };

  const handleRemoveRecipeUser = async (userId: string) => {
    try {
      await removeUserFromRecipeSharing(userId);
      showSnackbar('User removed from sharing', 'success');
      loadSharingData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove user';
      showSnackbar(message, 'error');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Recipe user data handlers
  const handleTagsChange = async (tags: string[]) => {
    if (!selectedRecipe?._id) return;
    try {
      await updateRecipeTags(selectedRecipe._id, tags);
      setRecipeUserData(prev => prev ? { ...prev, tags } : { tags, rating: undefined });
      // Update the map for list view
      setRecipesUserData(prev => {
        const newMap = new Map(prev);
        const currentData = newMap.get(selectedRecipe._id!) || { tags: [], rating: undefined };
        newMap.set(selectedRecipe._id!, { ...currentData, tags });
        return newMap;
      });
    } catch (error) {
      console.error('Error updating tags:', error);
      showSnackbar('Failed to update tags', 'error');
    }
  };

  const handleRatingChange = async (rating: number | undefined) => {
    if (!selectedRecipe?._id) return;
    try {
      if (rating === undefined) {
        await deleteRecipeRating(selectedRecipe._id);
        setRecipeUserData(prev => prev ? { ...prev, rating: undefined } : { tags: [], rating: undefined });
        // Update the map for list view
        setRecipesUserData(prev => {
          const newMap = new Map(prev);
          const currentData = newMap.get(selectedRecipe._id!) || { tags: [], rating: undefined };
          newMap.set(selectedRecipe._id!, { ...currentData, rating: undefined });
          return newMap;
        });
      } else {
        await updateRecipeRating(selectedRecipe._id, rating);
        setRecipeUserData(prev => prev ? { ...prev, rating } : { tags: [], rating });
        // Update the map for list view
        setRecipesUserData(prev => {
          const newMap = new Map(prev);
          const currentData = newMap.get(selectedRecipe._id!) || { tags: [], rating: undefined };
          newMap.set(selectedRecipe._id!, { ...currentData, rating });
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error updating rating:', error);
      showSnackbar('Failed to update rating', 'error');
    }
  };

  const handleCloseViewDialog = () => {
    viewDialog.closeDialog();
    setSelectedRecipe(null);
    setEditMode(false);
  };

  // Helper function to check if all ingredient groups have at least one ingredient and valid titles
  const hasValidIngredients = (ingredients: RecipeIngredientList[]) => {
    // Check if there's at least one ingredient across all groups
    const totalIngredients = ingredients.reduce(
      (total, group) => total + (group.ingredients?.length || 0),
      0
    );

    if (totalIngredients === 0) return false;

    // Check that each group is valid (standalone groups don't need titles, but regular groups do)
    return ingredients.every(
      (group) =>
        group.isStandalone || (group.title && group.title.trim() !== "")
    );
  };

  // Check if user can edit a recipe (only the creator can edit)
  const canEditRecipe = (recipe: Recipe) => {
    return recipe.createdBy === (session?.user as Session["user"])?.id;
  };

  // Show loading state while session is being fetched
  if (status === "loading") {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="xl">
          <Box sx={centeredLoadingSx}>
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
        <Box sx={{ py: { xs: 0.5, md: 1 } }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", sm: "center" },
              gap: { xs: 2, sm: 0 },
              mb: { xs: 2, md: 4 },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Restaurant sx={{ fontSize: 40, color: "#ed6c02" }} />
              <Typography variant="h3" component="h1" sx={{ color: "#ed6c02" }}>
                Recipes
              </Typography>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              gap: 2,
              alignItems: 'center',
              width: { xs: '100%', sm: 'auto' }
            }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => createDialog.openDialog()}
                sx={{
                  bgcolor: "#ed6c02",
                  "&:hover": { bgcolor: "#e65100" },
                  flexGrow: 1
                }}
              >
                Add New Recipe
              </Button>
              <Button 
                variant="outlined"
                onClick={() => shareDialog.openDialog()}
                sx={{ 
                  borderColor: "#ed6c02", 
                  color: "#ed6c02", 
                  "&:hover": { borderColor: "#e65100" },
                  minWidth: 'auto',
                  p: 1
                }}
              >
                <Badge badgeContent={pendingRecipeInvitations?.length || 0} color="error">
                  <Share />
                </Badge>
              </Button>
            </Box>
          </Box>

          <RecipeSharingSection
            pendingInvitations={pendingRecipeInvitations}
            onAcceptInvitation={handleAcceptRecipeInvitation}
            onRejectInvitation={handleRejectRecipeInvitation}
            shareDialogOpen={shareDialog.open}
            onShareDialogClose={shareDialog.closeDialog}
            shareEmail={shareEmail}
            onShareEmailChange={setShareEmail}
            shareTags={shareTags}
            onShareTagsChange={setShareTags}
            shareRatings={shareRatings}
            onShareRatingsChange={setShareRatings}
            onInviteUser={handleInviteUser}
            sharedUsers={sharedRecipeUsers}
            onRemoveUser={handleRemoveRecipeUser}
          />

          <Paper sx={{ p: 3, mb: 4, maxWidth: "md", mx: "auto" }}>
            <SearchBar
              value={userPagination.searchTerm}
              onChange={(value) => {
                userPagination.setSearchTerm(value);
                globalPagination.setSearchTerm(value);
              }}
              placeholder="Start typing to filter recipes by title..."
            />

            {loading ? (
              <Box sx={centeredLoadingSx}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* User Recipes Section */}
                <Box sx={{ mb: 4 }}>
                  <Box sx={sectionHeaderSx}>
                    <Typography variant="h6" gutterBottom>
                      <Person sx={{ mr: 1, verticalAlign: "middle" }} />
                      Your Recipes (
                      {userPagination.searchTerm
                        ? `${userPagination.totalItems}/${userRecipes.length}`
                        : userRecipes.length}
                      )
                    </Typography>
                    {userLoading && <CircularProgress size={20} />}
                  </Box>

                  {filteredUserRecipes.length > 0 ? (
                    <>
                      {/* Desktop Table View */}
                      <Box sx={{ display: { xs: "none", md: "block" } }}>
                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell
                                  sx={tableHeaderCellSx("40%")}
                                >
                                  Recipe
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={tableHeaderCellSx("15%")}
                                >
                                  Tags
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={tableHeaderCellSx("10%")}
                                >
                                  Rating
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={tableHeaderCellSx("15%")}
                                >
                                  Access Level
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={tableHeaderCellSx("20%")}
                                >
                                  Updated
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {paginatedUserRecipes.map((recipe) => (
                                <TableRow
                                  key={recipe._id}
                                  onClick={() => handleViewRecipe(recipe)}
                                  sx={tableRowHoverSx}
                                >
                                  <TableCell sx={{ wordWrap: "break-word" }}>
                                    <Box
                                      sx={recipeTitleFlexSx}
                                    >
                                      {recipe.emoji ? (
                                        <Typography variant="h6">
                                          {recipe.emoji}
                                        </Typography>
                                      ) : (
                                        <RestaurantMenu
                                          sx={recipeIconSmallSx}
                                        />
                                      )}
                                      <Typography variant="body1">
                                        {recipe.title}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    sx={{ wordWrap: "break-word" }}
                                  >
                                    {(() => {
                                      const userData = recipesUserData.get(recipe._id || '');
                                      const allTags = [...new Set([
                                        ...(userData?.tags || []),
                                        ...(userData?.sharedTags || [])
                                      ])];
                                      if (allTags.length === 0) {
                                        return <Typography variant="body2" color="text.secondary">—</Typography>;
                                      }
                                      return (
                                        <Box sx={tagContainerDesktopSx}>
                                          {allTags.slice(0, 3).map((tag) => (
                                            <Chip
                                              key={tag}
                                              label={tag}
                                              size="small"
                                              sx={chipDesktopSx}
                                            />
                                          ))}
                                          {allTags.length > 3 && (
                                            <Chip
                                              label={`+${allTags.length - 3}`}
                                              size="small"
                                              sx={chipDesktopSx}
                                            />
                                          )}
                                        </Box>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    sx={{ wordWrap: "break-word" }}
                                  >
                                    {(() => {
                                      const userData = recipesUserData.get(recipe._id || '');
                                      const rating = userData?.rating;
                                      if (!rating) {
                                        return <Typography variant="body2" color="text.secondary">—</Typography>;
                                      }
                                      return (
                                        <Box sx={ratingDesktopSx}>
                                          <Star sx={{ fontSize: 16, color: 'warning.main' }} />
                                          <Typography variant="body2">{rating}</Typography>
                                        </Box>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    sx={{ wordWrap: "break-word" }}
                                  >
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
                                  <TableCell
                                    align="center"
                                    sx={{ wordWrap: "break-word" }}
                                  >
                                    {new Date(
                                      recipe.updatedAt
                                    ).toLocaleDateString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>

                      {/* Mobile Card View */}
                      <Box sx={{ display: { xs: "block", md: "none" } }}>
                        {paginatedUserRecipes.map((recipe) => (
                          <Paper
                            key={recipe._id}
                            onClick={() => handleViewRecipe(recipe)}
                            sx={mobileCardSx}
                          >
                            <Box sx={mobileCardTitleSx}>
                              <Box sx={{ mb: 1 }}>
                                {recipe.emoji ? (
                                  <Typography variant="h4">
                                    {recipe.emoji}
                                  </Typography>
                                ) : (
                                  <RestaurantMenu
                                    sx={recipeIconLargeSx}
                                  />
                                )}
                              </Box>
                              <Typography
                                variant="h6"
                                sx={{ fontWeight: "medium" }}
                              >
                                {recipe.title}
                              </Typography>
                            </Box>
                            {(() => {
                              const userData = recipesUserData.get(recipe._id || '');
                              const allTags = [...new Set([
                                ...(userData?.tags || []),
                                ...(userData?.sharedTags || [])
                              ])];
                              const rating = userData?.rating;
                              return (allTags.length > 0 || rating) && (
                                <Box sx={{ mb: 2, width: '100%' }}>
                                  {allTags.length > 0 && (
                                    <Box sx={tagContainerMobileSx}>
                                      {allTags.slice(0, 5).map((tag) => (
                                        <Chip
                                          key={tag}
                                          label={tag}
                                          size="small"
                                          sx={chipMobileSx}
                                        />
                                      ))}
                                      {allTags.length > 5 && (
                                        <Chip
                                          label={`+${allTags.length - 5}`}
                                          size="small"
                                          sx={chipMobileSx}
                                        />
                                      )}
                                    </Box>
                                  )}
                                  {rating && (
                                    <Box sx={ratingMobileSx}>
                                      <Star sx={{ fontSize: 18, color: 'warning.main' }} />
                                      <Typography variant="body2">{rating}/5</Typography>
                                    </Box>
                                  )}
                                </Box>
                              );
                            })()}
                            <Box sx={mobileCardFooterSx}>
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
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Updated:{" "}
                                {new Date(
                                  recipe.updatedAt
                                ).toLocaleDateString()}
                              </Typography>
                            </Box>
                          </Paper>
                        ))}
                      </Box>

                      {filteredUserRecipes.length > itemsPerPage && (
                        <Box sx={paginationContainerSx}>
                          <Pagination
                            count={Math.ceil(
                              filteredUserRecipes.length / itemsPerPage
                            )}
                            page={userPagination.currentPage}
                            onChange={userPagination.setCurrentPage}
                          />
                        </Box>
                      )}
                    </>
                  ) : (
                    <Alert severity="info">
                      {userPagination.searchTerm
                        ? "No user recipes match your search criteria"
                        : "No user recipes found"}
                    </Alert>
                  )}
                </Box>

                {/* Global Recipes Section */}
                <Box>
                  <Box sx={sectionHeaderSx}>
                    <Typography variant="h6" gutterBottom>
                      <Public sx={{ mr: 1, verticalAlign: "middle" }} />
                      Global Recipes (
                      {globalPagination.searchTerm
                        ? `${globalPagination.totalItems}/${globalRecipes.length}`
                        : globalRecipes.length}
                      )
                    </Typography>
                    {globalLoading && <CircularProgress size={20} />}
                  </Box>

                  {filteredGlobalRecipes.length > 0 ? (
                    <>
                      {/* Desktop Table View */}
                      <Box sx={{ display: { xs: "none", md: "block" } }}>
                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell
                                  sx={tableHeaderCellSx("40%")}
                                >
                                  Recipe
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={tableHeaderCellSx("15%")}
                                >
                                  Tags
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={tableHeaderCellSx("10%")}
                                >
                                  Rating
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={tableHeaderCellSx("15%")}
                                >
                                  Access Level
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={tableHeaderCellSx("20%")}
                                >
                                  Updated
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {paginatedGlobalRecipes.map((recipe) => (
                                <TableRow
                                  key={recipe._id}
                                  onClick={() => handleViewRecipe(recipe)}
                                  sx={tableRowHoverSx}
                                >
                                  <TableCell sx={{ wordWrap: "break-word" }}>
                                    <Box
                                      sx={recipeTitleFlexSx}
                                    >
                                      {recipe.emoji ? (
                                        <Typography variant="h6">
                                          {recipe.emoji}
                                        </Typography>
                                      ) : (
                                        <RestaurantMenu
                                          sx={recipeIconSmallSx}
                                        />
                                      )}
                                      <Typography variant="body1">
                                        {recipe.title}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    sx={{ wordWrap: "break-word" }}
                                  >
                                    {(() => {
                                      const userData = recipesUserData.get(recipe._id || '');
                                      const allTags = [...new Set([
                                        ...(userData?.tags || []),
                                        ...(userData?.sharedTags || [])
                                      ])];
                                      if (allTags.length === 0) {
                                        return <Typography variant="body2" color="text.secondary">—</Typography>;
                                      }
                                      return (
                                        <Box sx={tagContainerDesktopSx}>
                                          {allTags.slice(0, 3).map((tag) => (
                                            <Chip
                                              key={tag}
                                              label={tag}
                                              size="small"
                                              sx={chipDesktopSx}
                                            />
                                          ))}
                                          {allTags.length > 3 && (
                                            <Chip
                                              label={`+${allTags.length - 3}`}
                                              size="small"
                                              sx={chipDesktopSx}
                                            />
                                          )}
                                        </Box>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    sx={{ wordWrap: "break-word" }}
                                  >
                                    {(() => {
                                      const userData = recipesUserData.get(recipe._id || '');
                                      const rating = userData?.rating;
                                      if (!rating) {
                                        return <Typography variant="body2" color="text.secondary">—</Typography>;
                                      }
                                      return (
                                        <Box sx={ratingDesktopSx}>
                                          <Star sx={{ fontSize: 16, color: 'warning.main' }} />
                                          <Typography variant="body2">{rating}</Typography>
                                        </Box>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    sx={{ wordWrap: "break-word" }}
                                  >
                                    <Chip
                                      label="Global"
                                      size="small"
                                      color="primary"
                                      variant="outlined"
                                      icon={<Public fontSize="small" />}
                                    />
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    sx={{ wordWrap: "break-word" }}
                                  >
                                    {new Date(
                                      recipe.updatedAt
                                    ).toLocaleDateString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>

                      {/* Mobile Card View */}
                      <Box sx={{ display: { xs: "block", md: "none" } }}>
                        {paginatedGlobalRecipes.map((recipe) => (
                          <Paper
                            key={recipe._id}
                            onClick={() => handleViewRecipe(recipe)}
                            sx={mobileCardSx}
                          >
                            <Box sx={mobileCardTitleSx}>
                              <Box sx={{ mb: 1 }}>
                                {recipe.emoji ? (
                                  <Typography variant="h4">
                                    {recipe.emoji}
                                  </Typography>
                                ) : (
                                  <RestaurantMenu
                                    sx={recipeIconLargeSx}
                                  />
                                )}
                              </Box>
                              <Typography
                                variant="h6"
                                sx={{ fontWeight: "medium" }}
                              >
                                {recipe.title}
                              </Typography>
                            </Box>
                            {(() => {
                              const userData = recipesUserData.get(recipe._id || '');
                              const allTags = [...new Set([
                                ...(userData?.tags || []),
                                ...(userData?.sharedTags || [])
                              ])];
                              const rating = userData?.rating;
                              return (allTags.length > 0 || rating) && (
                                <Box sx={{ mb: 2, width: '100%' }}>
                                  {allTags.length > 0 && (
                                    <Box sx={tagContainerMobileSx}>
                                      {allTags.slice(0, 5).map((tag) => (
                                        <Chip
                                          key={tag}
                                          label={tag}
                                          size="small"
                                          sx={chipMobileSx}
                                        />
                                      ))}
                                      {allTags.length > 5 && (
                                        <Chip
                                          label={`+${allTags.length - 5}`}
                                          size="small"
                                          sx={chipMobileSx}
                                        />
                                      )}
                                    </Box>
                                  )}
                                  {rating && (
                                    <Box sx={ratingMobileSx}>
                                      <Star sx={{ fontSize: 18, color: 'warning.main' }} />
                                      <Typography variant="body2">{rating}/5</Typography>
                                    </Box>
                                  )}
                                </Box>
                              );
                            })()}
                            <Box sx={mobileCardFooterSx}>
                              <Box>
                                <Chip
                                  label="Global"
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  icon={<Public fontSize="small" />}
                                />
                              </Box>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Updated:{" "}
                                {new Date(
                                  recipe.updatedAt
                                ).toLocaleDateString()}
                              </Typography>
                            </Box>
                          </Paper>
                        ))}
                      </Box>

                      {filteredGlobalRecipes.length > itemsPerPage && (
                        <Box sx={paginationContainerSx}>
                          <Pagination
                            count={Math.ceil(
                              filteredGlobalRecipes.length / itemsPerPage
                            )}
                            page={globalPagination.currentPage}
                            onChange={globalPagination.setCurrentPage}
                          />
                        </Box>
                      )}
                    </>
                  ) : (
                    <Alert severity="info">
                      {globalPagination.searchTerm
                        ? "No global recipes match your search criteria"
                        : "No global recipes found"}
                    </Alert>
                  )}
                </Box>
              </>
            )}
          </Paper>
        </Box>

        {/* Create Recipe Dialog */}
        <RecipeEditorDialog
          open={createDialog.open}
          onClose={() => createDialog.closeDialog()}
          recipe={newRecipe}
          onRecipeChange={setNewRecipe}
          onSubmit={handleCreateRecipe}
          onEmojiPickerOpen={() => emojiPickerDialog.openDialog()}
          onIngredientsChange={(ingredients) =>
            setNewRecipe({ ...newRecipe, ingredients })
          }
          foodItemsList={foodItemsList}
          onFoodItemAdded={handleFoodItemAdded}
          hasValidIngredients={hasValidIngredients}
        />

        {/* View/Edit Recipe Dialog */}
        <RecipeViewDialog
          open={viewDialog.open}
          onClose={handleCloseViewDialog}
          selectedRecipe={selectedRecipe}
          editMode={editMode}
          editingRecipe={editingRecipe}
          onEditingRecipeChange={setEditingRecipe}
          canEditRecipe={canEditRecipe}
          onEditRecipe={handleEditRecipe}
          onUpdateRecipe={handleUpdateRecipe}
          onDeleteConfirm={() => deleteConfirmDialog.openDialog()}
          onCancelEdit={() => {
            setEditMode(false);
            viewDialog.removeDialogData("editMode");
          }}
          onEmojiPickerOpen={() => emojiPickerDialog.openDialog()}
          recipeUserData={recipeUserData}
          onTagsChange={handleTagsChange}
          onRatingChange={handleRatingChange}
          onIngredientsChange={handleIngredientsChange}
          foodItemsList={foodItemsList}
          onFoodItemAdded={handleFoodItemAdded}
          hasValidIngredients={hasValidIngredients}
          getIngredientName={getIngredientName}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmDialog.open}
          onClose={() => deleteConfirmDialog.closeDialog()}
          sx={responsiveDialogStyle}
        >
          <DialogTitle onClose={() => deleteConfirmDialog.closeDialog()}>
            Delete Recipe
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete &quot;{selectedRecipe?.title}
              &quot;? This action cannot be undone.
            </DialogContentText>

            <DialogActions primaryButtonIndex={1}>
              <Button onClick={() => deleteConfirmDialog.closeDialog()}>
                Cancel
              </Button>
              <Button
                onClick={handleDeleteRecipe}
                color="error"
                variant="contained"
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

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </AuthenticatedLayout>
  );
}

export default function RecipesPage() {
  return (
    <Suspense
      fallback={
        <AuthenticatedLayout>
          <Container maxWidth="xl">
            <Box sx={centeredLoadingSx}>
              <CircularProgress />
            </Box>
          </Container>
        </AuthenticatedLayout>
      }
    >
      <RecipesPageContent />
    </Suspense>
  );
}
