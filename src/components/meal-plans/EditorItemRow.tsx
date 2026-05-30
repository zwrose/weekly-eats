// src/components/meal-plans/EditorItemRow.tsx
'use client';

import { Box, ButtonBase, IconButton } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import type { MealItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { getUnitForm } from '@/lib/food-items-utils';

export interface EditorItemRowProps {
  item: MealItem;
  invalid?: boolean;
  onQtyClick: (anchor: HTMLElement) => void;
  onUnitClick: (anchor: HTMLElement) => void;
  onRemove: () => void;
}

const chipSx = (active: boolean, warn: boolean) => ({
  height: 30,
  px: 1.25,
  borderRadius: `${tokens.radius.md}px`,
  border: `1px solid ${warn ? tokens.state.warn : active ? tokens.section.plans : tokens.border.strong}`,
  bgcolor: active ? tokens.accent.muted : 'transparent',
  color: tokens.text.primary,
  fontSize: 13,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
});

export function EditorItemRow({
  item,
  invalid,
  onQtyClick,
  onUnitClick,
  onRemove,
}: EditorItemRowProps) {
  const isRecipe = item.type === 'recipe';
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 1.25,
        borderBottom: `1px solid ${tokens.border.subtle}`,
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          // Recipes aren't interactive text — style them as plain content (the "Recipe"
          // tag marks them), not in the accent color used for links/actions.
          fontWeight: isRecipe ? 500 : 400,
          color: invalid ? tokens.state.warn : tokens.text.primary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.name || (
          <Box component="span" sx={{ fontStyle: 'italic', color: tokens.state.warn }}>
            Pick a food or recipe
          </Box>
        )}
      </Box>
      {isRecipe && (
        <Box
          component="span"
          sx={{
            fontSize: 10,
            color: tokens.text.secondary,
            px: 0.75,
            py: '1px',
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: `${tokens.radius.xs}px`,
          }}
        >
          Recipe
        </Box>
      )}
      <ButtonBase
        aria-label="Quantity"
        onClick={(e) => onQtyClick(e.currentTarget)}
        sx={chipSx(false, Boolean(invalid && !item.name))}
      >
        {isRecipe ? `× ${item.quantity ?? 1}` : (item.quantity ?? 1)}
      </ButtonBase>
      {!isRecipe && (
        <ButtonBase
          aria-label="Unit"
          onClick={(e) => onUnitClick(e.currentTarget)}
          sx={chipSx(false, Boolean(invalid && !item.name))}
        >
          {getUnitForm(item.unit || 'cup', item.quantity ?? 1)}{' '}
          <Icon name="expand_more" size={14} color={tokens.text.muted} />
        </ButtonBase>
      )}
      <IconButton
        aria-label="Remove item"
        onClick={onRemove}
        size="small"
        sx={{ color: tokens.text.muted }}
      >
        <Icon name="close" size={18} />
      </IconButton>
    </Box>
  );
}
