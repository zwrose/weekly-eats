// src/components/meal-plans/EditorItemRow.tsx
'use client';

import { Box, ButtonBase, IconButton } from '@mui/material';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import type { MealItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { getUnitForm } from '@/lib/food-items-utils';
import { useRecipeEmoji } from './recipe-emoji';

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
  const emoji = useRecipeEmoji(isRecipe ? item.id : undefined);
  const router = useRouter();

  const nameContent = (
    <>
      {emoji && (
        <Box component="span" sx={{ flexShrink: 0, fontSize: 15, lineHeight: 1 }}>
          {emoji}
        </Box>
      )}
      <Box
        component="span"
        sx={{
          minWidth: 0,
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
    </>
  );

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
      {isRecipe ? (
        <ButtonBase
          onClick={() => router.push(`/recipes/${item.id}`)}
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            fontSize: 14,
            fontWeight: 500,
            color: invalid ? tokens.state.warn : tokens.text.primary,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          {nameContent}
        </ButtonBase>
      ) : (
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            fontSize: 14,
            fontWeight: 400,
            color: invalid ? tokens.state.warn : tokens.text.primary,
          }}
        >
          {nameContent}
        </Box>
      )}
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
        onClick={(e) => {
          e.stopPropagation();
          onQtyClick(e.currentTarget);
        }}
        sx={chipSx(false, Boolean(invalid && !item.name))}
      >
        {isRecipe ? `× ${item.quantity ?? 1}` : (item.quantity ?? 1)}
      </ButtonBase>
      {!isRecipe && (
        <ButtonBase
          aria-label="Unit"
          onClick={(e) => {
            e.stopPropagation();
            onUnitClick(e.currentTarget);
          }}
          sx={chipSx(false, Boolean(invalid && !item.name))}
        >
          {getUnitForm(item.unit || 'cup', item.quantity ?? 1)}{' '}
          <Icon name="expand_more" size={14} color={tokens.text.muted} />
        </ButtonBase>
      )}
      <IconButton
        aria-label="Remove item"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        size="small"
        sx={{ color: tokens.text.muted }}
      >
        <Icon name="close" size={18} />
      </IconButton>
    </Box>
  );
}
