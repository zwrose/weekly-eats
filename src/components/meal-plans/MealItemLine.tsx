'use client';

import { Box } from '@mui/material';
import type { MealItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { getUnitAbbreviationForm } from '@/lib/food-items-utils';

export interface MealItemLineProps {
  item: MealItem;
  /** Mute colors for past days. */
  muted?: boolean;
  /** Show a group's ingredients beneath the title (used in staples expand). */
  expandGroup?: boolean;
}

const numSx = { fontVariantNumeric: 'tabular-nums' } as const;

export function MealItemLine({ item, muted, expandGroup }: MealItemLineProps) {
  const ink = muted ? tokens.text.past : tokens.text.primary;
  const dim = muted ? tokens.text.muted : tokens.text.secondary;

  if (item.type === 'recipe') {
    return (
      <Box
        sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontSize: 13, lineHeight: 1.4 }}
      >
        <Box
          component="span"
          sx={{
            color: tokens.section.plans,
            fontWeight: 600,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </Box>
        {item.quantity != null && item.quantity !== 1 && (
          <Box component="span" sx={{ fontSize: 11, color: dim, ...numSx }}>
            × {item.quantity}
          </Box>
        )}
      </Box>
    );
  }

  if (item.type === 'foodItem') {
    const unit =
      item.unit && item.unit !== 'each'
        ? ` ${getUnitAbbreviationForm(item.unit, item.quantity ?? 1) ?? item.unit}`
        : '';
    return (
      <Box
        sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontSize: 13, lineHeight: 1.4 }}
      >
        <Box
          component="span"
          sx={{
            color: ink,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </Box>
        <Box component="span" sx={{ fontSize: 11, color: dim, ...numSx }}>
          {item.quantity}
          {unit}
        </Box>
      </Box>
    );
  }

  // ingredientGroup
  const group = item.ingredients?.[0];
  const count = group?.ingredients?.length ?? 0;
  return (
    <Box sx={{ fontSize: 13, lineHeight: 1.4 }}>
      <Box component="span" sx={{ color: ink, fontWeight: 500 }}>
        {item.name || group?.title}
      </Box>
      <Box component="span" sx={{ fontSize: 11, color: dim, ml: 0.5, ...numSx }}>
        ({count})
      </Box>
      {expandGroup && group && (
        <Box
          sx={{
            pl: 1.25,
            mt: 0.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
            borderLeft: `1px solid ${tokens.border.subtle}`,
          }}
        >
          {group.ingredients.map((ing, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontSize: 13 }}>
              <Box component="span" sx={{ color: ink }}>
                {ing.name}
              </Box>
              <Box component="span" sx={{ fontSize: 11, color: dim, ...numSx }}>
                {ing.quantity}
                {ing.unit && ing.unit !== 'each'
                  ? ` ${getUnitAbbreviationForm(ing.unit, ing.quantity ?? 1) ?? ing.unit}`
                  : ''}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
