// src/components/meal-plans/StaplesBar.tsx
'use client';

import { useState } from 'react';
import { Box, ButtonBase, IconButton } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import type { MealItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { mealItemCount } from './meal-display-utils';
import { getUnitForm } from '@/lib/food-items-utils';

export interface StaplesBarProps {
  staples: MealItem[];
  onEdit: () => void;
}

export function StaplesBar({ staples, onEdit }: StaplesBarProps) {
  const [open, setOpen] = useState(false);
  const groups = staples.filter((s) => s.type === 'ingredientGroup');
  const loose = staples.filter((s) => s.type !== 'ingredientGroup');
  const total = mealItemCount(staples);

  const summary =
    groups.length > 0
      ? groups
          .map(
            (g) =>
              `${g.name || g.ingredients?.[0]?.title} (${g.ingredients?.[0]?.ingredients.length ?? 0})`
          )
          .join(' · ') + (loose.length ? ` · Other (${loose.length})` : '')
      : `${total} items`;

  return (
    <Box
      sx={{
        border: `1px solid ${tokens.border.subtle}`,
        borderRadius: `${tokens.radius.xl}px`,
        mb: 2.25,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
        <ButtonBase
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 2,
            py: 1.25,
            textAlign: 'left',
            justifyContent: 'flex-start',
          }}
        >
          <Box
            component="span"
            sx={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: tokens.meal.staples,
            }}
          >
            Staples
          </Box>
          <Box
            component="span"
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              color: tokens.text.secondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {summary}
          </Box>
          <Box
            component="span"
            sx={{ fontSize: 12, color: tokens.text.muted, fontVariantNumeric: 'tabular-nums' }}
          >
            {total}
          </Box>
          <Icon
            name="expand_more"
            size={18}
            color={tokens.text.muted}
            sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
          />
        </ButtonBase>
        <IconButton
          aria-label="Edit staples"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          sx={{
            borderRadius: 0,
            borderLeft: `1px solid ${tokens.border.subtle}`,
            color: tokens.text.secondary,
            px: 1.5,
          }}
        >
          <Icon name="edit" size={18} />
        </IconButton>
      </Box>
      {open && (
        <Box sx={{ px: 2, pt: 0.5, pb: 1.5, borderTop: `1px solid ${tokens.border.subtle}` }}>
          {groups.map((g, gi) => (
            <Box key={gi} sx={{ mt: 1.25 }}>
              <Box sx={{ fontSize: 12, fontWeight: 600, color: tokens.text.primary, mb: 0.5 }}>
                {g.name || g.ingredients?.[0]?.title}
              </Box>
              <Box sx={{ pl: 1.25, display: 'flex', flexDirection: 'column', gap: 0.375 }}>
                {g.ingredients?.[0]?.ingredients.map((it, i) => (
                  <Box
                    key={i}
                    sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontSize: 13 }}
                  >
                    <Box component="span" sx={{ color: tokens.text.primary }}>
                      {it.name}
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        fontSize: 12,
                        color: tokens.text.muted,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {it.quantity}
                      {it.unit && it.unit !== 'each'
                        ? ` ${getUnitForm(it.unit, it.quantity ?? 1)}`
                        : ''}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
          {loose.length > 0 && (
            <Box sx={{ mt: 1.25 }}>
              {groups.length > 0 && (
                <Box sx={{ fontSize: 12, fontWeight: 600, color: tokens.text.primary, mb: 0.5 }}>
                  Other
                </Box>
              )}
              <Box
                sx={{
                  pl: groups.length > 0 ? 1.25 : 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.375,
                }}
              >
                {loose.map((it, i) => (
                  <Box
                    key={i}
                    sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontSize: 13 }}
                  >
                    <Box component="span" sx={{ color: tokens.text.primary }}>
                      {it.name}
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        fontSize: 12,
                        color: tokens.text.muted,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {it.quantity}
                      {it.unit && it.unit !== 'each'
                        ? ` ${getUnitForm(it.unit, it.quantity ?? 1)}`
                        : ''}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
