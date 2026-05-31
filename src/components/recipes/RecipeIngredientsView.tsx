// src/components/recipes/RecipeIngredientsView.tsx
'use client';

import { Box } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import type { RecipeIngredientList } from '@/types/recipe';
import { formatIngredientQty } from './recipe-display-utils';

export function RecipeIngredientsView({ ingredients }: { ingredients: RecipeIngredientList[] }) {
  return (
    <Box>
      {ingredients.map((group, gi) => (
        <Box key={gi} sx={{ mb: gi < ingredients.length - 1 ? 2.5 : 0 }}>
          {group.title && (
            <Box
              sx={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: tokens.text.secondary,
                mb: { xs: 1, md: 1.25 },
              }}
            >
              {group.title}
            </Box>
          )}
          {group.ingredients.map((it, ii) => (
            <Box
              key={ii}
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: { xs: 1, md: 1.25 },
                py: { xs: '5px', md: '6px' },
                fontSize: { xs: 14, md: 15 },
              }}
            >
              <Box
                component="span"
                sx={{
                  width: { xs: 72, md: 80 },
                  flexShrink: 0,
                  color: tokens.text.secondary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatIngredientQty(it.quantity, it.unit)}
              </Box>
              <Box component="span" sx={{ flex: 1, color: tokens.text.primary }}>
                {it.name ?? ''}
                {it.prepInstructions && (
                  <Box component="span" sx={{ color: tokens.text.secondary, fontStyle: 'italic' }}>
                    , {it.prepInstructions}
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
