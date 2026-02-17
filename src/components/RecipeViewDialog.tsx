"use client";

import React from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  IconButton,
  Divider,
  Button,
} from "@mui/material";
import {
  Edit,
  EmojiEmotions,
  Public,
  Person,
  Delete,
  OpenInNew,
} from "@mui/icons-material";
import { Recipe, UpdateRecipeRequest, RecipeIngredientList } from "@/types/recipe";
import { getUnitForm } from "@/lib/food-items-utils";
import { responsiveDialogStyle } from "@/lib/theme";
import { DialogTitle } from "@/components/ui";
import { RecipeUserDataResponse } from "@/types/recipe-user-data";

const RecipeIngredients = dynamic(() => import("@/components/RecipeIngredients"), { ssr: false });
const RecipeInstructionsView = dynamic(() => import("@/components/RecipeInstructionsView"), { ssr: false });
const RecipeTagsEditor = dynamic(() => import("@/components/RecipeTagsEditor"), { ssr: false });
const RecipeStarRating = dynamic(() => import("@/components/RecipeStarRating"), { ssr: false });

interface FoodItemOption {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
}

export interface RecipeViewDialogProps {
  open: boolean;
  onClose: () => void;
  selectedRecipe: Recipe | null;
  editMode: boolean;
  editingRecipe: UpdateRecipeRequest;
  onEditingRecipeChange: (recipe: UpdateRecipeRequest) => void;
  canEditRecipe: (recipe: Recipe) => boolean;
  onEditRecipe: () => void;
  onUpdateRecipe: () => void;
  onDeleteConfirm: () => void;
  onCancelEdit: () => void;
  onEmojiPickerOpen: () => void;
  recipeUserData: RecipeUserDataResponse | null;
  onTagsChange: (tags: string[]) => void;
  onRatingChange: (rating: number | undefined) => void;
  onIngredientsChange: (ingredients: RecipeIngredientList[]) => void;
  foodItemsList: FoodItemOption[];
  onFoodItemAdded: (item: { name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean }) => Promise<void>;
  hasValidIngredients: (ingredients: RecipeIngredientList[]) => boolean;
  getIngredientName: (ingredient: { type: "foodItem" | "recipe"; id: string; quantity: number }) => string;
  onNavigateToRecipe?: (recipeId: string) => void;
}

const RecipeViewDialog: React.FC<RecipeViewDialogProps> = ({
  open,
  onClose,
  selectedRecipe,
  editMode,
  editingRecipe,
  onEditingRecipeChange,
  canEditRecipe,
  onEditRecipe,
  onUpdateRecipe,
  onDeleteConfirm,
  onCancelEdit,
  onEmojiPickerOpen,
  recipeUserData,
  onTagsChange,
  onRatingChange,
  onIngredientsChange,
  foodItemsList,
  onFoodItemAdded,
  hasValidIngredients,
  getIngredientName,
  onNavigateToRecipe,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      disableEscapeKeyDown={false}
      sx={responsiveDialogStyle}
    >
      <DialogTitle
        onClose={onClose}
        actions={
          !editMode && selectedRecipe && canEditRecipe(selectedRecipe) ? (
            <IconButton onClick={onEditRecipe} color="inherit">
              <Edit />
            </IconButton>
          ) : undefined
        }
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {selectedRecipe?.emoji && (
            <Typography variant="h4">{selectedRecipe.emoji}</Typography>
          )}
          <Typography variant="h5">{selectedRecipe?.title}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {editMode ? (
          <Box sx={{ pt: 2 }}>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                mb: 3,
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { xs: "stretch", sm: "flex-start" },
              }}
            >
              <IconButton
                onClick={onEmojiPickerOpen}
                sx={{
                  border: "1px solid #ccc",
                  width: { xs: 56, sm: 56 },
                  height: { xs: 56, sm: 56 },
                  fontSize: "1.5rem",
                  alignSelf: { xs: "flex-start", sm: "flex-start" },
                }}
              >
                {editingRecipe.emoji || <EmojiEmotions />}
              </IconButton>
              <TextField
                label="Recipe Title"
                value={editingRecipe.title}
                onChange={(e) =>
                  onEditingRecipeChange({
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
                  display: "flex",
                  gap: 2,
                  flexDirection: { xs: "column", sm: "row" },
                }}
              >
                <Button
                  variant={
                    editingRecipe.isGlobal ? "contained" : "outlined"
                  }
                  onClick={() =>
                    onEditingRecipeChange({ ...editingRecipe, isGlobal: true })
                  }
                  startIcon={<Public />}
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                >
                  Global (visible to all users)
                </Button>
                <Button
                  variant={
                    editingRecipe.isGlobal ? "outlined" : "contained"
                  }
                  onClick={() =>
                    onEditingRecipeChange({ ...editingRecipe, isGlobal: false })
                  }
                  startIcon={<Person />}
                  sx={{ width: { xs: "100%", sm: "auto" } }}
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
                onChange={onTagsChange}
                editable={true}
                label=""
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <RecipeStarRating
                rating={recipeUserData?.rating}
                onChange={onRatingChange}
                editable={true}
              />
            </Box>

            <Typography variant="h6" gutterBottom>
              Ingredients
            </Typography>
            <RecipeIngredients
              ingredients={editingRecipe.ingredients || []}
              onChange={onIngredientsChange}
              foodItems={foodItemsList}
              onFoodItemAdded={onFoodItemAdded}
              removeIngredientButtonText="Remove Ingredient"
            />

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Instructions
            </Typography>
            <TextField
              label="Cooking Instructions"
              value={editingRecipe.instructions}
              onChange={(e) =>
                onEditingRecipeChange({
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
                display: "flex",
                flexDirection: { xs: "column-reverse", sm: "row" },
                gap: 1,
                p: 2,
                justifyContent: { xs: "stretch", sm: "flex-start" },
                alignItems: { xs: "stretch", sm: "center" },
              }}
            >
              <Button
                onClick={onDeleteConfirm}
                color="error"
                variant="outlined"
                startIcon={<Delete />}
                sx={{
                  width: { xs: "100%", sm: "auto" },
                  mr: { xs: 0, sm: "auto" },
                  border: { sm: "none" },
                  "&:hover": {
                    border: { sm: "none" },
                    backgroundColor: { sm: "rgba(211, 47, 47, 0.04)" },
                  },
                }}
              >
                Delete
              </Button>
              <Button
                onClick={onCancelEdit}
                sx={{ width: { xs: "100%", sm: "auto" } }}
              >
                Cancel
              </Button>
              <Button
                onClick={onUpdateRecipe}
                variant="contained"
                disabled={
                  !editingRecipe.title ||
                  !editingRecipe.instructions ||
                  !hasValidIngredients(editingRecipe.ingredients || [])
                }
                sx={{ width: { xs: "100%", sm: "auto" } }}
              >
                Update Recipe
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ pt: 2 }}>
            {/* Tags and Rating in View Mode */}
            {selectedRecipe && (
              <>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Tags
                  </Typography>
                  <RecipeTagsEditor
                    tags={recipeUserData?.tags || []}
                    sharedTags={recipeUserData?.sharedTags}
                    onChange={onTagsChange}
                    editable={!canEditRecipe(selectedRecipe)}
                    label=""
                  />
                </Box>
                <Box sx={{ mb: 3 }}>
                  <RecipeStarRating
                    rating={recipeUserData?.rating}
                    sharedRatings={recipeUserData?.sharedRatings}
                    onChange={onRatingChange}
                    editable={!canEditRecipe(selectedRecipe)}
                  />
                </Box>
              </>
            )}
            <Divider sx={{ mb: 3 }} />
            <Box
              sx={{
                display: "flex",
                gap: 3,
                flexDirection: { xs: "column", md: "row" },
                minHeight: { xs: "auto", md: "40vh" },
                maxHeight: { xs: "none", md: "60vh" },
              }}
            >
              {/* Ingredients Section */}
              <Box
                sx={{
                  flex: { xs: "none", md: "0 0 25%" },
                  maxHeight: { xs: "none", md: "100%" },
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Typography variant="h5" gutterBottom>
                  Ingredients
                </Typography>
                <Box
                  sx={{
                    flex: 1,
                    overflow: "auto",
                    pr: 1,
                  }}
                >
                  {selectedRecipe?.ingredients.map((list, index) => (
                    <Box key={index} sx={{ mb: 2 }}>
                      {list.title && (
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: "bold", mb: 1 }}
                        >
                          {list.title}
                        </Typography>
                      )}
                      <Box component="ul" sx={{ pl: 2 }}>
                        {list.ingredients.map((ingredient, ingIndex) => (
                          <Typography
                            key={ingIndex}
                            component="li"
                            variant="body1"
                          >
                            {ingredient.quantity}{" "}
                            {ingredient.unit && ingredient.unit !== "each"
                              ? getUnitForm(
                                  ingredient.unit,
                                  ingredient.quantity
                                ) + " "
                              : ""}
                            {getIngredientName(ingredient)}
                            {ingredient.prepInstructions && `, ${ingredient.prepInstructions}`}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Instructions Section */}
              <Box
                sx={{
                  flex: { xs: "none", md: "1 1 auto" },
                  maxHeight: { xs: "none", md: "100%" },
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Typography variant="h5" gutterBottom>
                  Instructions
                </Typography>
                <Box
                  sx={{
                    flex: 1,
                    overflow: "auto",
                    pr: 1,
                  }}
                >
                  <RecipeInstructionsView
                    instructions={selectedRecipe?.instructions || ""}
                  />
                </Box>
              </Box>
            </Box>
            {onNavigateToRecipe && selectedRecipe?._id && (
              <>
                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    onClick={() => onNavigateToRecipe(selectedRecipe._id!)}
                    startIcon={<OpenInNew />}
                    size="small"
                  >
                    Edit in Recipes
                  </Button>
                </Box>
              </>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(RecipeViewDialog);
