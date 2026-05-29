'use client';

import { useEffect, useRef, useState } from 'react';
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
  // Keyboard highlight across the flat row list. -1 = focus is in the input (no
  // row highlighted). The dropdown sits ABOVE the input, so ArrowUp enters the
  // list at the bottom-most row (the one nearest the input) and walks upward.
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const creator = useFoodItemCreator({
    onFoodItemAdded,
    onItemCreated: (item) => onAddFood(item),
  });

  const selector = useFoodItemSelector({
    allowRecipes: true,
    excludeIds,
    onCreateRequested: (q) => creator.openDialog(q),
  });

  const recipes = selector.options.filter((o) => o.type === 'recipe');
  const foods = selector.options.filter((o) => o.type === 'foodItem');
  const q = selector.inputValue.trim();
  const hasResults = recipes.length + foods.length > 0;
  const hasCreate = q.length > 0;
  const open = focused && (hasResults || hasCreate);

  // Flat, keyboard-navigable rows in visual (top→bottom) order: results first
  // (recipes, then food items), then the Create actions attached to the search box.
  const optionRows: SearchOption[] = [...recipes, ...foods];
  const createFoodIdx = optionRows.length;
  const newGroupIdx = optionRows.length + 1;
  const rowCount = optionRows.length + (hasCreate ? 2 : 0);

  // Reset the highlight whenever the query or the result set changes.
  useEffect(() => {
    setActiveIndex(-1);
  }, [selector.inputValue, selector.options]);

  // Keep the keyboard-highlighted result scrolled into view (the Create actions
  // live in the search box and are always visible, so only result rows need this).
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    // scrollIntoView is unimplemented in jsdom — guard so tests (and any non-DOM env) don't throw.
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const addOption = (opt: SearchOption) => {
    if (opt.isExcluded) return;
    if (opt.type === 'recipe') onAddRecipe({ _id: opt._id, title: opt.title, emoji: opt.emoji });
    else onAddFood(opt);
    selector.setInputValue('');
    setActiveIndex(-1);
  };

  const newGroup = () => {
    onAddGroup(q);
    selector.setInputValue('');
    setActiveIndex(-1);
  };

  const execIndex = (idx: number) => {
    if (idx < optionRows.length) addOption(optionRows[idx]);
    else if (idx === createFoodIdx) creator.openDialog(q);
    else if (idx === newGroupIdx) newGroup();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowCount === 0) return;
      setActiveIndex((i) => (i === -1 ? rowCount - 1 : Math.max(0, i - 1)));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowCount === 0) return;
      // Moving down heads back toward the input; from the bottom row, return to it.
      setActiveIndex((i) => (i === -1 || i >= rowCount - 1 ? -1 : i + 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < rowCount) {
        execIndex(activeIndex);
      } else if (!hasResults && q.length > 0) {
        // No matches: Enter goes straight to the new-food-item flow (no arrowing needed).
        creator.openDialog(q);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setActiveIndex(-1);
      selector.autocompleteRef.current?.blur();
    }
  };

  const rowSx = (idx: number, base: object = {}) => ({
    px: 1.5,
    py: 1,
    cursor: 'pointer',
    bgcolor: idx === activeIndex ? tokens.accent.muted : 'transparent',
    ...base,
  });

  // A Create action row that reads as part of the search box (accent, leading +).
  const createRow = (idx: number, dataKey: string, label: React.ReactNode, onPick: () => void) => (
    <Box
      data-create={dataKey}
      onMouseEnter={() => setActiveIndex(idx)}
      onMouseDown={(e) => {
        e.preventDefault();
        onPick();
      }}
      sx={rowSx(idx, {
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        fontSize: 14,
        color: tokens.section.plans,
        fontWeight: 600,
      })}
    >
      <Box component="span" sx={{ fontSize: 16, lineHeight: 1, width: 18, textAlign: 'center' }}>
        +
      </Box>
      {label}
    </Box>
  );

  return (
    // The sticky footer bg matches the editor dialog's surface (surface.sheet) so it
    // blends seamlessly instead of showing a darker band against the dialog body.
    <Box sx={{ position: 'sticky', bottom: 0, pt: 1.25, pb: 2, bgcolor: tokens.surface.sheet }}>
      {/* Results — a separate floating list (the scrolling section), distinct from the box. */}
      {open && hasResults && (
        <Box
          ref={listRef}
          sx={{
            mb: 1,
            bgcolor: 'background.paper',
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: `${tokens.radius.xl}px`,
            overflow: 'hidden',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {recipes.length > 0 && <SectionLabel>Recipes</SectionLabel>}
          {recipes.map((o, i) => (
            <Box
              key={o._id}
              data-active={i === activeIndex ? 'true' : undefined}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                addOption(o);
              }}
              sx={rowSx(i, {
                display: 'flex',
                gap: 1.25,
                alignItems: 'center',
                opacity: o.isExcluded ? 0.4 : 1,
              })}
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
          {foods.map((o, j) => {
            const idx = recipes.length + j;
            return (
              <Box
                key={o._id}
                data-active={idx === activeIndex ? 'true' : undefined}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addOption(o);
                }}
                sx={rowSx(idx, {
                  fontSize: 14,
                  color: tokens.text.primary,
                  opacity: o.isExcluded ? 0.4 : 1,
                })}
              >
                {o.type === 'foodItem' ? o.name : ''}
              </Box>
            );
          })}
        </Box>
      )}

      {/* The search box: its Create actions + the input share one surface + focus ring,
          so the actions read as belonging to the box, not the results list. */}
      <Box
        sx={{
          bgcolor: tokens.surface.elevated,
          border: `1px solid ${focused ? `${tokens.section.plans}55` : tokens.border.strong}`,
          boxShadow: focused ? tokens.shadow.card : 'none',
          borderRadius: `${tokens.radius.xl}px`,
          overflow: 'hidden',
        }}
      >
        {open && hasCreate && (
          <Box sx={{ pt: 0.5 }}>
            {!hasResults && (
              <Box sx={{ px: 1.5, pt: 0.5, pb: 0.25, fontSize: 12, color: tokens.text.muted }}>
                No matches found
              </Box>
            )}
            {createRow(createFoodIdx, 'food', <>Add &quot;{q}&quot; as new food item</>, () =>
              creator.openDialog(q)
            )}
            {createRow(newGroupIdx, 'group', <>New group with &quot;{q}&quot;</>, newGroup)}
          </Box>
        )}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1.25,
            borderTop: open && hasCreate ? `1px solid ${tokens.border.subtle}` : 'none',
          }}
        >
          <Icon name="search" size={18} color={tokens.text.secondary} />
          <InputBase
            inputRef={selector.autocompleteRef}
            value={selector.inputValue}
            onChange={(e) => selector.handleInputChange(e.target.value, 'input')}
            onKeyDown={handleKeyDown}
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
