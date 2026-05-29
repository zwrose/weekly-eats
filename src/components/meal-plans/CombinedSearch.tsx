'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Box, InputBase } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import {
  useFoodItemSelector,
  type FoodItem,
  type SearchOption,
} from '@/lib/hooks/use-food-item-selector';
import { useFoodItemCreator } from '@/lib/hooks/use-food-item-creator';

const AddFoodItemDialog = dynamic(() => import('@/components/AddFoodItemDialog'), { ssr: false });

export interface CombinedSearchProps {
  excludeIds: string[];
  onAddFood: (item: FoodItem) => void;
  onAddRecipe: (recipe: { _id: string; title: string; emoji?: string }) => void;
  onAddGroup: (title: string) => void;
  onFoodItemAdded: (item: FoodItem) => Promise<void>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.16em',
        color: tokens.text.secondary,
        textTransform: 'uppercase',
        px: 1.5,
        pt: 1.25,
        pb: 0.5,
      }}
    >
      {children}
    </Box>
  );
}

export function CombinedSearch({
  excludeIds,
  onAddFood,
  onAddRecipe,
  onAddGroup,
  onFoodItemAdded,
}: CombinedSearchProps) {
  const [focused, setFocused] = useState(false);

  const creator = useFoodItemCreator({
    onFoodItemAdded,
    onItemCreated: (item) => onAddFood(item),
  });

  const selector = useFoodItemSelector({
    allowRecipes: true,
    excludeIds,
    onCreateRequested: (q) => creator.openDialog(q),
  });

  const handlePick = (opt: SearchOption) => {
    if (opt.isExcluded) return;
    if (opt.type === 'recipe') onAddRecipe({ _id: opt._id, title: opt.title, emoji: opt.emoji });
    else onAddFood(opt);
    selector.setInputValue('');
  };

  const recipes = selector.options.filter((o) => o.type === 'recipe');
  const foods = selector.options.filter((o) => o.type === 'foodItem');
  const q = selector.inputValue.trim();
  const showResults = focused && (selector.options.length > 0 || q.length > 0);

  return (
    <Box sx={{ position: 'sticky', bottom: 0, pt: 1.25, pb: 2, bgcolor: 'background.default' }}>
      {showResults && (
        <Box
          sx={{
            mb: 1,
            bgcolor: 'background.paper',
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: `${tokens.radius.xl}px`,
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {recipes.length > 0 && <SectionLabel>Recipes</SectionLabel>}
          {recipes.map((o) => (
            <Box
              key={o._id}
              onMouseDown={(e) => {
                e.preventDefault();
                handlePick(o);
              }}
              sx={{
                display: 'flex',
                gap: 1.25,
                alignItems: 'center',
                px: 1.5,
                py: 1,
                cursor: 'pointer',
                opacity: o.isExcluded ? 0.4 : 1,
              }}
            >
              <Box
                component="span"
                sx={{ color: tokens.section.plans, fontSize: 14, fontWeight: 600 }}
              >
                {o.type === 'recipe' ? o.title : ''}
              </Box>
            </Box>
          ))}
          {foods.length > 0 && <SectionLabel>Food items</SectionLabel>}
          {foods.map((o) => (
            <Box
              key={o._id}
              onMouseDown={(e) => {
                e.preventDefault();
                handlePick(o);
              }}
              sx={{
                px: 1.5,
                py: 1,
                cursor: 'pointer',
                fontSize: 14,
                color: tokens.text.primary,
                opacity: o.isExcluded ? 0.4 : 1,
              }}
            >
              {o.type === 'foodItem' ? o.name : ''}
            </Box>
          ))}
          {q.length > 0 && (
            <>
              <SectionLabel>Create</SectionLabel>
              <Box
                onMouseDown={(e) => {
                  e.preventDefault();
                  creator.openDialog(q);
                }}
                sx={{
                  px: 1.5,
                  py: 1,
                  cursor: 'pointer',
                  fontSize: 14,
                  color: tokens.section.plans,
                  fontWeight: 600,
                }}
              >
                + Add &quot;{q}&quot; as new food item
              </Box>
              <Box
                onMouseDown={(e) => {
                  e.preventDefault();
                  onAddGroup(q);
                  selector.setInputValue('');
                }}
                sx={{
                  px: 1.5,
                  py: 1,
                  cursor: 'pointer',
                  fontSize: 14,
                  color: tokens.section.plans,
                  fontWeight: 600,
                }}
              >
                New group with &quot;{q}&quot;
              </Box>
            </>
          )}
        </Box>
      )}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1.25,
          bgcolor: tokens.surface.elevated,
          border: `1px solid ${focused ? `${tokens.section.plans}55` : tokens.border.strong}`,
          boxShadow: focused ? tokens.shadow.card : 'none',
          borderRadius: `${tokens.radius.xl}px`,
        }}
      >
        <Icon name="search" size={18} color={tokens.text.secondary} />
        <InputBase
          inputRef={selector.autocompleteRef}
          value={selector.inputValue}
          onChange={(e) => selector.handleInputChange(e.target.value, 'input')}
          onKeyDown={selector.handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Add item, recipe, or new group"
          sx={{
            flex: 1,
            fontSize: 14,
            color: tokens.text.primary,
            '& input::placeholder': { color: tokens.text.muted, opacity: 1 },
          }}
        />
      </Box>

      <AddFoodItemDialog
        open={creator.isDialogOpen}
        onClose={creator.closeDialog}
        onAdd={(foodItemData) => {
          void creator.handleCreate(foodItemData);
        }}
        prefillName={creator.prefillName}
      />
    </Box>
  );
}
