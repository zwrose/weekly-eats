// src/components/recipes/RecipeIngredientsEditor.tsx
'use client';

import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import { Box, ButtonBase, InputBase } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { Icon } from '@/components/ui/Icon';
import { useFoodItemSelector } from '@/lib/hooks/use-food-item-selector';
import { useFoodItemCreator } from '@/lib/hooks/use-food-item-creator';
import { RecipeIngredientRow } from '@/components/recipes/RecipeIngredientRow';
import { RECIPE_ACCENT_MUTED } from '@/components/recipes/recipe-display-utils';
import type { RecipeIngredientList, RecipeIngredient } from '@/types/recipe';
import type { SearchOption } from '@/lib/hooks/use-food-item-selector';

const AddFoodItemDialog = dynamic(() => import('@/components/AddFoodItemDialog'), { ssr: false });

// ---------------------------------------------------------------------------
// Exported helper — also used by RecipeEditor (Task 13)
// ---------------------------------------------------------------------------
export function validateRecipeIngredients(lists: RecipeIngredientList[]): boolean {
  const total = lists.reduce((n, l) => n + l.ingredients.length, 0);
  if (total === 0) return false;
  return lists.every((l) => l.isStandalone || (l.title?.trim() ?? '') !== '');
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface RecipeIngredientsEditorProps {
  value: RecipeIngredientList[];
  onChange: (next: RecipeIngredientList[]) => void;
  currentRecipeId?: string;
  /** Hide the built-in "+ Group" button (RecipeEditor renders it in the section header instead). */
  hideAddGroup?: boolean;
}

/** Imperative handle so a parent can trigger "+ Group" from outside (e.g. a section header). */
export interface RecipeIngredientsEditorHandle {
  addGroup: () => void;
}

// ---------------------------------------------------------------------------
// Private subcomponent: per-group add-ingredient search bar
// ---------------------------------------------------------------------------
interface AddIngredientSearchProps {
  excludeIds: string[];
  currentRecipeId?: string;
  onAppend: (ingredient: RecipeIngredient) => void;
  onFoodItemAdded: (item: {
    _id: string;
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal?: boolean;
  }) => Promise<void>;
}

function AddIngredientSearch({
  excludeIds,
  currentRecipeId,
  onAppend,
  onFoodItemAdded,
}: AddIngredientSearchProps) {
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const creator = useFoodItemCreator({
    onFoodItemAdded: async (item) => {
      await onFoodItemAdded(item);
    },
    // CRITICAL: wire onItemCreated so a newly-created food item is appended to
    // the active group. Without this the dialog closes successfully but the new
    // item silently vanishes (onFoodItemAdded alone does NOT append).
    onItemCreated: (item) => {
      onAppend({
        type: 'foodItem',
        id: item._id,
        quantity: 1,
        unit: item.unit,
        name: item.singularName,
      });
    },
  });

  const selector = useFoodItemSelector({
    allowRecipes: true,
    excludeIds,
    currentRecipeId,
    autoLoad: true,
    onCreateRequested: (q) => creator.openDialog(q),
  });

  const recipes = selector.options.filter((o) => o.type === 'recipe');
  const foods = selector.options.filter((o) => o.type === 'foodItem');
  const q = selector.inputValue.trim();
  const hasResults = recipes.length + foods.length > 0;
  const hasCreate = q.length > 0;
  const open = focused && (hasResults || hasCreate);

  const optionRows: SearchOption[] = [...recipes, ...foods];
  const createFoodIdx = optionRows.length;
  const rowCount = optionRows.length + (hasCreate ? 1 : 0);

  const addOption = (opt: SearchOption) => {
    if (opt.isExcluded) return;
    onAppend({
      type: opt.type,
      id: opt._id,
      quantity: 1,
      unit: opt.type === 'foodItem' ? opt.unit : undefined,
      name: opt.type === 'foodItem' ? opt.singularName : opt.title,
    });
    selector.setInputValue('');
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowCount === 0) return;
      setActiveIndex((i) => (i === -1 ? rowCount - 1 : Math.max(0, i - 1)));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowCount === 0) return;
      setActiveIndex((i) => (i === -1 || i >= rowCount - 1 ? -1 : i + 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < optionRows.length) {
        addOption(optionRows[activeIndex]);
      } else if (activeIndex === createFoodIdx) {
        creator.openDialog(q);
      } else if (!hasResults && q.length > 0) {
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
    py: 0.875,
    cursor: 'pointer',
    bgcolor: idx === activeIndex ? RECIPE_ACCENT_MUTED : 'transparent',
    ...base,
  });

  return (
    <Box sx={{ mt: 1 }}>
      {/* Results dropdown */}
      {open && hasResults && (
        <Box
          sx={{
            mb: 0.75,
            bgcolor: tokens.surface.raised,
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: `${tokens.radius.xl}px`,
            overflow: 'hidden',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {recipes.length > 0 && (
            <Box
              sx={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.16em',
                color: tokens.text.secondary,
                textTransform: 'uppercase',
                px: 1.5,
                pt: 1,
                pb: 0.5,
              }}
            >
              Recipes
            </Box>
          )}
          {recipes.map((o, i) => (
            <Box
              key={o._id}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                addOption(o);
              }}
              sx={rowSx(i, {
                display: 'flex',
                gap: 0.75,
                alignItems: 'center',
                fontSize: 14,
                opacity: o.isExcluded ? 0.4 : 1,
              })}
            >
              {o.type === 'recipe' && o.emoji && (
                <Box component="span" sx={{ fontSize: 15, lineHeight: 1 }}>
                  {o.emoji}
                </Box>
              )}
              <Box component="span" sx={{ color: tokens.text.primary, fontWeight: 500 }}>
                {o.type === 'recipe' ? o.title : ''}
              </Box>
            </Box>
          ))}
          {foods.length > 0 && (
            <Box
              sx={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.16em',
                color: tokens.text.secondary,
                textTransform: 'uppercase',
                px: 1.5,
                pt: 1,
                pb: 0.5,
              }}
            >
              Food items
            </Box>
          )}
          {foods.map((o, j) => {
            const idx = recipes.length + j;
            return (
              <Box
                key={o._id}
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

      {/* Search box */}
      <Box
        sx={{
          bgcolor: tokens.surface.elevated,
          border: `1px solid ${focused ? `${tokens.section.recipes}55` : tokens.border.strong}`,
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
            <Box
              onMouseEnter={() => setActiveIndex(createFoodIdx)}
              onMouseDown={(e) => {
                e.preventDefault();
                creator.openDialog(q);
              }}
              sx={rowSx(createFoodIdx, {
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                fontSize: 14,
                color: tokens.section.recipes,
                fontWeight: 600,
              })}
            >
              <Box
                component="span"
                sx={{ fontSize: 16, lineHeight: 1, width: 18, textAlign: 'center' }}
              >
                +
              </Box>
              Add &quot;{q}&quot; as new food item
            </Box>
          </Box>
        )}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1.125,
            borderTop: open && hasCreate ? `1px solid ${tokens.border.subtle}` : 'none',
          }}
        >
          <Icon name="search" size={16} color={tokens.text.secondary} />
          <InputBase
            inputRef={selector.autocompleteRef}
            value={selector.inputValue}
            onChange={(e) => selector.handleInputChange(e.target.value, 'input')}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Add ingredient or recipe…"
            sx={{
              flex: 1,
              fontSize: 13,
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

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

/** Whether the value is in "grouped" mode (vs standalone). */
function isGroupedMode(value: RecipeIngredientList[]): boolean {
  return value.length > 1 || value.some((l) => !l.isStandalone && l.title !== undefined);
}

/** Collect all ingredient ids across all lists (for duplicate rejection). */
function getAllIds(lists: RecipeIngredientList[]): string[] {
  return lists.flatMap((l) => l.ingredients.map((i) => i.id).filter(Boolean));
}

export const RecipeIngredientsEditor = forwardRef<
  RecipeIngredientsEditorHandle,
  RecipeIngredientsEditorProps
>(function RecipeIngredientsEditor({ value, onChange, currentRecipeId, hideAddGroup }, ref) {
  // Each group renders its own AddIngredientSearch with local focus/draft/activeIndex state.
  // Using array-index keys causes that state to be misattributed when a middle group is
  // deleted (indices shift). Instead, assign each group a stable monotonic id on mount and
  // keep that array in lock-step with every add/delete operation.
  const groupKeyCounter = useRef(0);
  const groupIdsRef = useRef<number[]>(value.map(() => groupKeyCounter.current++));

  const grouped = isGroupedMode(value);

  // ------------------------------------------------------------------
  // + Group handler
  // ------------------------------------------------------------------
  const handleAddGroup = () => {
    if (!grouped) {
      // Convert-OR-append: standalone → exactly 1 grouped list (drop isStandalone, keep
      // ingredients). Do NOT append a second empty group; the user gets one titled group.
      const converted = value.map((l) => ({
        title: l.title ?? '',
        ingredients: l.ingredients,
        // isStandalone intentionally omitted
      }));
      // groupIdsRef already has one slot (from init) — list count stays 1, no push needed.
      onChange(converted);
    } else {
      // Already grouped: append a new empty group.
      groupIdsRef.current.push(groupKeyCounter.current++);
      onChange([...value, { title: '', ingredients: [] }]);
    }
  };

  // ------------------------------------------------------------------
  // Group-level handlers
  // ------------------------------------------------------------------
  const handleGroupTitleChange = (groupIdx: number, title: string) => {
    const next = value.map((l, i) => (i === groupIdx ? { ...l, title } : l));
    onChange(next);
  };

  const handleDeleteGroup = (groupIdx: number) => {
    // Keep groupIdsRef in lock-step: splice the id at the deleted index.
    groupIdsRef.current.splice(groupIdx, 1);
    const next = value.filter((_, i) => i !== groupIdx);
    if (next.length === 0) {
      // Fall back to a single empty standalone list; reset ids to match.
      groupIdsRef.current = [groupKeyCounter.current++];
      onChange([{ isStandalone: true, ingredients: [] }]);
    } else {
      onChange(next);
    }
  };

  // ------------------------------------------------------------------
  // Ingredient-level handlers
  // ------------------------------------------------------------------
  const handleIngredientChange = (groupIdx: number, ingIdx: number, next: RecipeIngredient) => {
    const nextLists = value.map((l, gi) => {
      if (gi !== groupIdx) return l;
      return { ...l, ingredients: l.ingredients.map((ing, ii) => (ii === ingIdx ? next : ing)) };
    });
    onChange(nextLists);
  };

  const handleIngredientRemove = (groupIdx: number, ingIdx: number) => {
    const nextLists = value.map((l, gi) => {
      if (gi !== groupIdx) return l;
      return { ...l, ingredients: l.ingredients.filter((_, ii) => ii !== ingIdx) };
    });
    onChange(nextLists);
  };

  const handleAppend = (groupIdx: number) => (ingredient: RecipeIngredient) => {
    // Reject duplicates across the entire recipe
    const existing = getAllIds(value);
    if (existing.includes(ingredient.id)) return;
    const nextLists = value.map((l, gi) => {
      if (gi !== groupIdx) return l;
      return { ...l, ingredients: [...l.ingredients, ingredient] };
    });
    onChange(nextLists);
  };

  // no-op onFoodItemAdded: the food item list is managed by the hook's autoLoad;
  // refreshing is not needed here (the new item comes back via onItemCreated).
  const noop = async () => {
    /* intentionally empty */
  };

  // Expose "+ Group" to a parent (RecipeEditor renders the trigger in the section header).
  // No deps array: re-bind every render so the closure over `grouped`/`value` stays fresh.
  useImperativeHandle(ref, () => ({ addGroup: handleAddGroup }));

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <Box>
      {/* Group cards */}
      {value.map((list, gi) => {
        const titleInvalid = !list.isStandalone && (list.title?.trim() ?? '') === '';

        return (
          <Box
            key={groupIdsRef.current[gi] ?? gi}
            sx={{
              bgcolor: tokens.surface.raised,
              // Borderless when valid (matches the artboard); only the invalid state shows a rule.
              border: `1px solid ${titleInvalid ? tokens.state.danger : 'transparent'}`,
              borderRadius: `${tokens.radius.xl}px`,
              p: 1.5,
              mb: 1.5,
            }}
          >
            {/* Group header row */}
            {grouped && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {/* GROUP label */}
                <Box
                  sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: tokens.text.secondary,
                    flexShrink: 0,
                  }}
                >
                  Group
                </Box>

                {/* Title input */}
                <InputBase
                  value={list.title ?? ''}
                  placeholder="Group title…"
                  onChange={(e) => handleGroupTitleChange(gi, e.target.value)}
                  sx={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 600,
                    color: tokens.text.primary,
                    border: `1px solid ${titleInvalid ? tokens.state.danger : tokens.border.strong}`,
                    borderRadius: `${tokens.radius.sm}px`,
                    px: 1,
                    py: 0.375,
                    '& input::placeholder': {
                      color: titleInvalid ? tokens.state.danger : tokens.text.muted,
                      opacity: 1,
                    },
                  }}
                />

                {/* Delete group */}
                <ButtonBase
                  aria-label={`Delete group ${gi + 1}`}
                  onClick={() => handleDeleteGroup(gi)}
                  sx={{ color: tokens.text.muted, px: 0.5, flexShrink: 0 }}
                >
                  <Icon name="delete" size={16} />
                </ButtonBase>
              </Box>
            )}

            {/* Ingredient rows */}
            {list.ingredients.map((ing, ii) => (
              <RecipeIngredientRow
                key={`${gi}-${ii}-${ing.id}`}
                ingredient={ing}
                onChange={(next) => handleIngredientChange(gi, ii, next)}
                onRemove={() => handleIngredientRemove(gi, ii)}
              />
            ))}

            {/* + Add ingredient search */}
            <AddIngredientSearch
              excludeIds={getAllIds(value)}
              currentRecipeId={currentRecipeId}
              onAppend={handleAppend(gi)}
              onFoodItemAdded={noop}
            />
          </Box>
        );
      })}

      {/* + Group button (hidden when the parent renders its own trigger) */}
      {!hideAddGroup && (
        <ButtonBase
          role="button"
          aria-label="+ Group"
          onClick={handleAddGroup}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            fontSize: 13,
            fontWeight: 600,
            color: tokens.section.recipes,
            border: `1px dashed ${tokens.section.recipes}66`,
            borderRadius: `${tokens.radius.lg}px`,
            px: 1.5,
            py: 0.875,
            mt: 0.5,
          }}
        >
          <Box component="span" sx={{ fontSize: 16, lineHeight: 1 }}>
            +
          </Box>
          Group
        </ButtonBase>
      )}
    </Box>
  );
});
