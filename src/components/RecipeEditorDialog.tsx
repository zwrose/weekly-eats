'use client';

import React, { useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  IconButton,
  Divider,
  Button,
} from '@mui/material';
import { EmojiEmotions, Public, Person } from '@mui/icons-material';
import { CreateRecipeRequest, RecipeIngredientList, FoodItemOption } from '@/types/recipe';
import { responsiveDialogStyle } from '@/lib/theme';
import { DialogActions, DialogTitle } from '@/components/ui';

const RecipeIngredients = dynamic(() => import('@/components/RecipeIngredients'), { ssr: false });

export interface RecipeEditorDialogProps {
  open: boolean;
  onClose: () => void;
  recipe: CreateRecipeRequest;
  onRecipeChange: (recipe: CreateRecipeRequest) => void;
  onSubmit: () => void;
  onEmojiPickerOpen: () => void;
  onIngredientsChange: (ingredients: RecipeIngredientList[]) => void;
  foodItemsList: FoodItemOption[];
  onFoodItemAdded: (item: {
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
  }) => Promise<void>;
  hasValidIngredients: (ingredients: RecipeIngredientList[]) => boolean;
}

const RecipeEditorDialog: React.FC<RecipeEditorDialogProps> = ({
  open,
  onClose,
  recipe,
  onRecipeChange,
  onSubmit,
  onEmojiPickerOpen,
  onIngredientsChange,
  foodItemsList,
  onFoodItemAdded,
  hasValidIngredients,
}) => {
  const titleRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={responsiveDialogStyle}
      TransitionProps={{ onEntered: () => titleRef.current?.focus() }}
    >
      <DialogTitle onClose={onClose}>Create New Recipe</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
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
              onClick={onEmojiPickerOpen}
              sx={{
                border: '1px solid #ccc',
                width: { xs: 56, sm: 56 },
                height: { xs: 56, sm: 56 },
                fontSize: '1.5rem',
                alignSelf: { xs: 'flex-start', sm: 'flex-start' },
              }}
            >
              {recipe.emoji || <EmojiEmotions />}
            </IconButton>
            <TextField
              inputRef={titleRef}
              label="Recipe Title"
              value={recipe.title}
              onChange={(e) => onRecipeChange({ ...recipe, title: e.target.value })}
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
                onClick={() => onRecipeChange({ ...recipe, isGlobal: true })}
                startIcon={<Public />}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Global (visible to all users)
              </Button>
              <Button
                variant={recipe.isGlobal ? 'outlined' : 'contained'}
                onClick={() => onRecipeChange({ ...recipe, isGlobal: false })}
                startIcon={<Person />}
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
            value={recipe.instructions}
            onChange={(e) => onRecipeChange({ ...recipe, instructions: e.target.value })}
            multiline
            rows={6}
            fullWidth
            required
          />

          <DialogActions primaryButtonIndex={1}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              onClick={onSubmit}
              variant="contained"
              disabled={
                !recipe.title || !recipe.instructions || !hasValidIngredients(recipe.ingredients)
              }
            >
              Create Recipe
            </Button>
          </DialogActions>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(RecipeEditorDialog);
