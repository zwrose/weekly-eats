import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { RecipeIngredientList, RecipeIngredient } from '../types/recipe';
import IngredientInput from './IngredientInput';
import IngredientGroup from './IngredientGroup';

interface RecipeIngredientsProps {
  ingredients: RecipeIngredientList[];
  onChange: (ingredients: RecipeIngredientList[]) => void;
  foodItems?: Array<{_id: string, name: string, singularName: string, pluralName: string, unit: string}>;
  onFoodItemAdded?: (newFoodItem: { name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean; }) => Promise<void>;
  // Custom text overrides
  addIngredientButtonText?: string;
  addIngredientGroupButtonText?: string;
  emptyGroupText?: string;
  emptyNoGroupsText?: string;
  removeIngredientButtonText?: string;
}

export default function RecipeIngredients({ 
  ingredients, 
  onChange, 
  foodItems,
  onFoodItemAdded, 
  addIngredientButtonText = "Add Ingredient",
  addIngredientGroupButtonText = "Add Ingredient Group",
  emptyGroupText = "No ingredients in this group. Click \"Add Ingredient\" to get started.",
  emptyNoGroupsText = "No ingredients added yet. Click \"Add Ingredient\" to get started.",
  removeIngredientButtonText = "Remove Ingredient"
}: RecipeIngredientsProps) {
  const [error, setError] = useState('');

  // Ensure we always have at least one group or standalone ingredients
  useEffect(() => {
    if (ingredients.length === 0) {
      // Create a standalone group by default
      const newStandaloneGroup: RecipeIngredientList & { isStandalone?: boolean } = {
        title: '', // Empty title indicates standalone
        ingredients: [],
        isStandalone: true
      };
      onChange([newStandaloneGroup]);
    }
  }, [ingredients.length, onChange]);

  // Handle the case where ingredients is empty during initial render
  if (ingredients.length === 0) {
    return (
      <Box>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        <Box>
          <Button
            startIcon={<Add />}
            onClick={() => {
              const newStandaloneGroup: RecipeIngredientList & { isStandalone?: boolean } = {
                title: '',
                ingredients: [],
                isStandalone: true
              };
              onChange([newStandaloneGroup]);
            }}
            variant="outlined"
            size="small"
            sx={{ mt: 1 }}
          >
            {addIngredientButtonText}
          </Button>
          <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
            {emptyNoGroupsText}
          </Typography>
        </Box>
      </Box>
    );
  }

  // Check if we're in standalone mode (single group with empty title and isStandalone flag)
  const isStandaloneMode = ingredients.length === 1 && 
    ingredients[0].title === '' && 
    (ingredients[0] as RecipeIngredientList & { isStandalone?: boolean }).isStandalone;

  const handleAddIngredient = () => {
    if (isStandaloneMode) {
      // Add to the standalone group
      const newIngredient: RecipeIngredient = {
        type: 'foodItem',
        id: '',
        quantity: 1,
        unit: 'cup'
      };
      const updatedIngredients = [...ingredients];
      updatedIngredients[0] = {
        ...updatedIngredients[0],
        ingredients: [...updatedIngredients[0].ingredients, newIngredient]
      };
      onChange(updatedIngredients);
    } else {
      // Add to the first group (or create a new one if none exist)
      const newIngredient: RecipeIngredient = {
        type: 'foodItem',
        id: '',
        quantity: 1,
        unit: 'cup'
      };
      if (ingredients.length === 0) {
        onChange([{
          title: '',
          ingredients: [newIngredient]
        }]);
      } else {
        const updatedIngredients = [...ingredients];
        updatedIngredients[0] = {
          ...updatedIngredients[0],
          ingredients: [...updatedIngredients[0].ingredients, newIngredient]
        };
        onChange(updatedIngredients);
      }
    }
  };

  const handleAddGroup = () => {
    const newGroup: RecipeIngredientList = {
      title: '',
      ingredients: []
    };
    onChange([...ingredients, newGroup]);
  };

  const handleConvertToGroups = () => {
    if (isStandaloneMode) {
      if (ingredients[0].ingredients.length > 0) {
        // Convert standalone ingredients to groups
        const groups: RecipeIngredientList[] = ingredients[0].ingredients.map((ingredient, index) => ({
          title: `Group ${index + 1}`,
          ingredients: [ingredient]
        }));
        onChange(groups);
      } else {
        // Convert to empty group mode
        const emptyGroup: RecipeIngredientList = {
          title: '',
          ingredients: []
        };
        onChange([emptyGroup]);
      }
    }
  };

  const handleRemoveGroup = (groupIndex: number) => {
    const newIngredients = ingredients.filter((_, index) => index !== groupIndex);
    onChange(newIngredients);
  };

  const handleGroupChange = (groupIndex: number, updatedGroup: RecipeIngredientList) => {
    const newIngredients = [...ingredients];
    newIngredients[groupIndex] = updatedGroup;
    onChange(newIngredients);
  };



  const getAllSelectedIds = (): string[] => {
    return ingredients.flatMap(group => 
      group.ingredients.map(ingredient => ingredient.id).filter(id => id !== '')
    );
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {isStandaloneMode ? (
        // Standalone mode - single group without title
        <Box>

          {ingredients[0].ingredients.map((ingredient, index) => (
            <IngredientInput
              key={index}
              ingredient={ingredient}
              onIngredientChange={(updatedIngredient) => {
                const newIngredients = [...ingredients];
                newIngredients[0] = {
                  ...newIngredients[0],
                  ingredients: newIngredients[0].ingredients.map((ing, i) =>
                    i === index ? updatedIngredient : ing
                  )
                };
                onChange(newIngredients);
              }}
              onRemove={() => {
                const newIngredients = [...ingredients];
                newIngredients[0] = {
                  ...newIngredients[0],
                  ingredients: newIngredients[0].ingredients.filter((_, i) => i !== index)
                };
                onChange(newIngredients);
              }}
              foodItems={foodItems}
              onFoodItemAdded={onFoodItemAdded}
              selectedIds={getAllSelectedIds().filter(id => id !== ingredient.id)}
              slotId={`standalone-${index}`}
              removeButtonText={removeIngredientButtonText}
            />
          ))}

          <Button
            startIcon={<Add />}
            onClick={handleAddIngredient}
            variant="outlined"
            size="small"
            sx={{ 
              mt: 1,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            {addIngredientButtonText}
          </Button>

          {ingredients[0].ingredients.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              {emptyGroupText}
            </Typography>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 2 }}>
            <Button
              onClick={handleConvertToGroups}
              variant="outlined"
              size="small"
            >
              Convert to Groups
            </Button>
          </Box>
        </Box>
      ) : (
        // Group mode - multiple groups with titles
        <Box>

          {ingredients.map((group, groupIndex) => (
            <IngredientGroup
              key={groupIndex}
              group={group}
              onChange={(updatedGroup) => handleGroupChange(groupIndex, updatedGroup)}
              onRemove={() => handleRemoveGroup(groupIndex)}
              foodItems={foodItems}
              onFoodItemAdded={onFoodItemAdded}
              addIngredientButtonText={addIngredientButtonText}
              emptyGroupText={emptyGroupText}
              removeIngredientButtonText={removeIngredientButtonText}
            />
          ))}

          {ingredients.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              {emptyNoGroupsText}
            </Typography>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 2 }}>
            <Button
              onClick={handleAddGroup}
              variant="outlined"
              size="small"
            >
              {addIngredientGroupButtonText}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
