'use client';

import React, { useRef, useState } from 'react';
import {
  Box,
  Divider,
  IconButton,
  TextField,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { MoreVert, Delete, NoteAdd, RemoveCircleOutline } from '@mui/icons-material';
import { RecipeIngredient, FoodItemOption } from '@/types/recipe';
import { SearchOption, FoodItem } from '@/lib/hooks/use-food-item-selector';
import { useFoodItemCreator } from '@/lib/hooks/use-food-item-creator';
import { useQuantityInput } from '@/lib/hooks/use-quantity-input';
import FoodItemAutocomplete from '@/components/food-item-inputs/FoodItemAutocomplete';
import QuantityInput from '@/components/food-item-inputs/QuantityInput';
import UnitSelector from '@/components/food-item-inputs/UnitSelector';
import type { Recipe } from '@/lib/hooks/use-food-item-selector';

interface InlineIngredientRowProps {
  ingredient: RecipeIngredient;
  onIngredientChange: (ingredient: RecipeIngredient) => void;
  onRemove: () => void;
  foodItems?: FoodItemOption[];
  recipes?: Recipe[];
  onFoodItemAdded?: (newFoodItem: {
    _id?: string;
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
  }) => Promise<void>;
  currentRecipeId?: string;
  selectedIds?: string[];
  autoFocus?: boolean;
  allowPrepInstructions?: boolean;
}

export const InlineIngredientRow: React.FC<InlineIngredientRowProps> = React.memo(
  function InlineIngredientRow({
    ingredient,
    onIngredientChange,
    onRemove,
    foodItems: propFoodItems,
    recipes = [],
    onFoodItemAdded,
    currentRecipeId,
    selectedIds = [],
    autoFocus = false,
    allowPrepInstructions = true,
  }) {
    const [prepExpanded, setPrepExpanded] = useState(!!ingredient.prepInstructions);
    const userExpandedPrep = useRef(false);
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

    // Use food item creator hook for side effects (item creation flow)
    useFoodItemCreator({
      onFoodItemAdded: onFoodItemAdded
        ? async (item) => {
            const convertedItem = {
              _id: item._id,
              name: item.name,
              singularName: item.singularName,
              pluralName: item.pluralName,
              unit: item.unit,
              isGlobal: item.isGlobal ?? false,
            };
            await onFoodItemAdded(convertedItem);
          }
        : undefined,
      onItemCreated: (newItem) => {
        const searchOption: SearchOption = {
          ...newItem,
          type: 'foodItem' as const,
        };
        handleSelect(searchOption);
      },
    });

    // Get the currently selected option
    const getSelectedOption = (): SearchOption | null => {
      if (!ingredient || !ingredient.id) return null;

      if (ingredient.type === 'foodItem') {
        const foodItem = propFoodItems?.find((item) => item._id === ingredient.id);
        if (!foodItem && ingredient.name) {
          return {
            _id: ingredient.id,
            name: ingredient.name,
            singularName: ingredient.name,
            pluralName: ingredient.name,
            unit: ingredient.unit || 'cup',
            type: 'foodItem' as const,
          };
        }
        return foodItem ? { ...foodItem, type: 'foodItem' as const } : null;
      } else {
        const recipe = recipes.find((item) => item._id === ingredient.id);
        if (!recipe && ingredient.name) {
          return {
            _id: ingredient.id,
            title: ingredient.name,
            type: 'recipe' as const,
          };
        }
        return recipe ? { ...recipe, type: 'recipe' as const } : null;
      }
    };

    const selectedOption = getSelectedOption();

    const handleSelect = (item: SearchOption | null) => {
      if (item) {
        const newIngredient: RecipeIngredient = {
          type: item.type,
          id: item._id || '',
          quantity: ingredient.quantity || 1,
          unit: item.type === 'foodItem' ? item.unit : undefined,
          name: item.type === 'foodItem' ? item.singularName : item.title,
        };
        onIngredientChange(newIngredient);

        setTimeout(() => {
          if (quantity.quantityRef?.current) {
            quantity.quantityRef.current.focus();
            quantity.quantityRef.current.select();
          }
        }, 100);
      } else {
        onIngredientChange({
          type: 'foodItem',
          id: '',
          quantity: 1,
          unit: 'cup',
        });
      }
    };

    const handleQuantityChange = (newQuantity: number) => {
      let updatedName = ingredient.name;
      if (ingredient.type === 'foodItem' && ingredient.id && propFoodItems) {
        const foodItem = propFoodItems.find((item) => item._id === ingredient.id);
        if (foodItem) {
          updatedName = newQuantity === 1 ? foodItem.singularName : foodItem.pluralName;
        }
      }
      onIngredientChange({ ...ingredient, quantity: newQuantity, name: updatedName });
    };

    const quantity = useQuantityInput({
      initialQuantity: ingredient.quantity ?? 1,
      onQuantityChange: handleQuantityChange,
    });

    const showPrepOption = allowPrepInstructions && ingredient.type === 'foodItem' && ingredient.id;

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
      setMenuAnchor(event.currentTarget);
    };

    const handleMenuClose = () => {
      setMenuAnchor(null);
    };

    const handleTogglePrep = () => {
      handleMenuClose();
      if (prepExpanded) {
        // Remove prep instructions
        onIngredientChange({ ...ingredient, prepInstructions: undefined });
        setPrepExpanded(false);
      } else {
        userExpandedPrep.current = true;
        setPrepExpanded(true);
      }
    };

    const handleDelete = () => {
      handleMenuClose();
      onRemove();
    };

    const kebabMenu = (
      <>
        <IconButton
          onClick={handleMenuOpen}
          size="small"
          sx={{
            flex: '0 0 auto',
            width: 28,
            height: 28,
            color: 'text.secondary',
          }}
          aria-label="Ingredient options"
        >
          <MoreVert sx={{ fontSize: 16 }} />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={handleDelete} dense sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <Delete fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
          {showPrepOption && <Divider />}
          {showPrepOption && (
            <MenuItem onClick={handleTogglePrep} dense>
              <ListItemIcon>
                {prepExpanded ? (
                  <RemoveCircleOutline fontSize="small" />
                ) : (
                  <NoteAdd fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText>
                {prepExpanded ? 'Remove prep instructions' : 'Add prep instructions'}
              </ListItemText>
            </MenuItem>
          )}
        </Menu>
      </>
    );

    const showPrep = prepExpanded && showPrepOption;

    const prepFieldProps = {
      placeholder: 'e.g. sifted',
      value: ingredient.prepInstructions || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        onIngredientChange({
          ...ingredient,
          prepInstructions: e.target.value || undefined,
        });
      },
      size: 'small' as const,
      sx: {
        '& .MuiInputBase-input': {
          fontStyle: 'italic',
          fontSize: '0.875rem',
        },
      },
    };

    const foodItemAutocompleteProps = {
      allowRecipes: true,
      excludeIds: selectedIds,
      excludedItemLabel: 'Already in recipe',
      foodItems: propFoodItems,
      recipes,
      currentRecipeId,
      onFoodItemAdded: onFoodItemAdded
        ? async (item: {
            _id?: string;
            name: string;
            singularName: string;
            pluralName: string;
            unit: string;
            isGlobal?: boolean;
          }) => {
            await onFoodItemAdded({
              _id: item._id,
              name: item.name,
              singularName: item.singularName,
              pluralName: item.pluralName,
              unit: item.unit,
              isGlobal: item.isGlobal ?? false,
            });
          }
        : undefined,
      autoLoad: !propFoodItems,
      value: selectedOption,
      onChange: handleSelect,
      label: '',
      placeholder: 'Food item or recipe',
      size: 'small' as const,
      fullWidth: true,
      autoFocus,
      onCreateItem: (item: FoodItem) => {
        handleSelect({ ...item, type: 'foodItem' as const });
      },
    };

    return (
      <Box sx={{ mb: { xs: 1.5, sm: 0.5 } }}>
        {/* Desktop: single row */}
        <Box
          sx={{
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            gap: 0.5,
            minHeight: 40,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <FoodItemAutocomplete {...foodItemAutocompleteProps} />
          </Box>

          {/* Prep instructions — inline */}
          {showPrep && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <TextField autoFocus={userExpandedPrep.current} fullWidth {...prepFieldProps} />
            </Box>
          )}

          <Box sx={{ flex: '0 0 auto', width: 80 }}>
            <QuantityInput
              value={ingredient.quantity ?? 1}
              onChange={handleQuantityChange}
              label=""
              size="small"
              inputRef={quantity.quantityRef}
            />
          </Box>

          {ingredient.type === 'foodItem' && (
            <Box sx={{ flex: '0 0 auto', width: 140 }}>
              <UnitSelector
                value={ingredient.unit || 'cup'}
                quantity={ingredient.quantity ?? 1}
                onChange={(unit) => onIngredientChange({ ...ingredient, unit })}
                label=""
                size="small"
              />
            </Box>
          )}

          {kebabMenu}
        </Box>

        {/* Mobile: two rows */}
        <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
          {/* Row 1: Item + kebab */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minHeight: 40 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <FoodItemAutocomplete {...foodItemAutocompleteProps} />
            </Box>
            {kebabMenu}
          </Box>

          {/* Row 2: Prep instructions (if active) */}
          {showPrep && (
            <Box sx={{ mt: 0.5, mr: '32px' }}>
              <TextField autoFocus={userExpandedPrep.current} fullWidth {...prepFieldProps} />
            </Box>
          )}

          {/* Row 3: Qty + Unit */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mt: 0.5,
              mr: '32px',
            }}
          >
            <Box sx={{ flex: '0 0 auto', width: 70 }}>
              <QuantityInput
                value={ingredient.quantity ?? 1}
                onChange={handleQuantityChange}
                label=""
                size="small"
                inputRef={quantity.quantityRef}
              />
            </Box>
            {ingredient.type === 'foodItem' && (
              <Box sx={{ flex: '1 1 auto', minWidth: 80 }}>
                <UnitSelector
                  value={ingredient.unit || 'cup'}
                  quantity={ingredient.quantity ?? 1}
                  onChange={(unit) => onIngredientChange({ ...ingredient, unit })}
                  label=""
                  size="small"
                  fullWidth
                />
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    );
  }
);
