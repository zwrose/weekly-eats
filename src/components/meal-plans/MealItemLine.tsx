'use client';

import { Box } from '@mui/material';
import type { MealItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { getUnitAbbreviationForm } from '@/lib/food-items-utils';
import { useRecipeEmoji } from './recipe-emoji';

export interface MealItemLineProps {
  item: MealItem;
  /** Mute colors for past days. */
  muted?: boolean;
  /** Expand a group: dotted uppercase header + its ingredients listed under a rule. */
  expandGroup?: boolean;
  /** Accent color for the expanded group's leading dot (typically the meal color). */
  groupAccent?: string;
}

const numSx = { fontVariantNumeric: 'tabular-nums' } as const;

export function MealItemLine({ item, muted, expandGroup, groupAccent }: MealItemLineProps) {
  const ink = muted ? tokens.text.past : tokens.text.primary;
  const dim = muted ? tokens.text.muted : tokens.text.secondary;
  const recipeEmoji = useRecipeEmoji(item.type === 'recipe' ? item.id : undefined);

  if (item.type === 'recipe') {
    return (
      <Box
        sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontSize: 13, lineHeight: 1.4 }}
      >
        {recipeEmoji && (
          <Box component="span" sx={{ fontSize: 13, lineHeight: 1 }}>
            {recipeEmoji}
          </Box>
        )}
        <Box
          component="span"
          sx={{
            // Recipes are plain content here, not interactive text — use the normal ink
            // color instead of the accent used for links/actions.
            color: ink,
            fontWeight: 500,
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
  const title = item.name || group?.title;

  // Expanded: a dotted, uppercase group header with the ingredients listed beneath a
  // left rule — the full breakdown shown in the (roomy) mobile day-card detail.
  if (expandGroup && group) {
    return (
      <Box sx={{ fontSize: 13, lineHeight: 1.4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
          <Box
            component="span"
            sx={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              bgcolor: groupAccent ?? dim,
              flexShrink: 0,
            }}
          />
          <Box
            component="span"
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: dim,
            }}
          >
            {title}
          </Box>
        </Box>
        <Box
          sx={{
            ml: '2px',
            pl: 1.25,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.375,
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
      </Box>
    );
  }

  // Collapsed: just the title + a count, used where space is tight (desktop strip).
  return (
    <Box sx={{ fontSize: 13, lineHeight: 1.4 }}>
      <Box component="span" sx={{ color: ink, fontWeight: 500 }}>
        {title}
      </Box>
      <Box component="span" sx={{ fontSize: 11, color: dim, ml: 0.5, ...numSx }}>
        ({count})
      </Box>
    </Box>
  );
}
